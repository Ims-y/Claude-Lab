import type { CognitiveMetrics } from "../types/index.js";
import type { Template, TemplateData } from "./templates.js";

/**
 * Injected into the cached system prompt so Claude self-optimises toward
 * high CognitiveMetrics scores before output is scored post-hoc.
 * Mirrors the exact penalty/reward weights used in computeMetrics().
 */
export const SCORING_INSTRUCTION = `
CRITICAL CONSTRAINTS:
- CHUNKING: Output exactly 3-4 items. Every item over 4 reduces cognitive efficiency by 20%.
- PRIMACY: The first 20 words (Anchor) must contain the core value proposition.
- TENSION: Start with a 'Gap/Problem' and end with a 'Resolution'.
`.trim();

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function computeMetrics(template: Template, data: TemplateData): CognitiveMetrics {
  // chunkCount: item count of the highest-cardinality array field
  const arrayCounts = template.fields
    .filter((f) => Array.isArray(data[f.key]))
    .map((f) => (data[f.key] as string[]).length);
  const chunkCount = arrayCounts.length > 0 ? Math.max(...arrayCounts) : 1;

  // chunkingScore: Cowan's 4±1 — penalise each item above 4 by 20 points
  const chunkingScore = Math.max(0, 100 - Math.max(0, chunkCount - 4) * 20);

  // anchorScore: anchor field present + within word budget → 100
  const anchorField = template.fields.find((f) => f.cognitiveRole === "anchor");
  let anchorScore = 0;
  if (anchorField) {
    const text = String(data[anchorField.key] ?? "");
    if (anchorField.maxWords) {
      const ratio = anchorField.maxWords / Math.max(1, wordCount(text));
      anchorScore = Math.min(100, Math.round(ratio * 100));
    } else {
      anchorScore = text.length > 0 ? 100 : 0;
    }
  }

  // densityScore: mean adherence to maxWords across bounded prose fields
  const boundedFields = template.fields.filter(
    (f) => f.maxWords !== undefined && !Array.isArray(data[f.key]),
  );
  let densityScore = 100;
  if (boundedFields.length > 0) {
    const ratios = boundedFields.map((f) => {
      const wc = wordCount(String(data[f.key] ?? ""));
      return Math.min(1, f.maxWords! / Math.max(1, wc));
    });
    densityScore = Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100);
  }

  // tensionResolutionScore: Zeigarnik — both tension and resolution fields must exist
  const hasTension = template.fields.some((f) => f.cognitiveRole === "tension");
  const hasResolution = template.fields.some((f) => f.cognitiveRole === "resolution");
  const tensionResolutionScore = hasTension && hasResolution ? 100 : 0;

  // estimatedReadSeconds: all field text at 200 wpm
  const allText = template.fields
    .map((f) =>
      Array.isArray(data[f.key])
        ? (data[f.key] as string[]).join(" ")
        : String(data[f.key] ?? ""),
    )
    .join(" ");
  const estimatedReadSeconds = Math.max(1, Math.round((wordCount(allText) / 200) * 60));

  return {
    chunkingScore,
    anchorScore,
    densityScore,
    tensionResolutionScore,
    chunkCount,
    estimatedReadSeconds,
  };
}

// Weights: chunking 35% | anchor 30% | density 25% | tension-resolution 10%
export function compositeScore(m: CognitiveMetrics): number {
  return Math.round(
    m.chunkingScore          * 0.35 +
    m.anchorScore            * 0.30 +
    m.densityScore           * 0.25 +
    m.tensionResolutionScore * 0.10,
  );
}
