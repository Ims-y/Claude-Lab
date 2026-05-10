import Anthropic from "@anthropic-ai/sdk";
import type { CognitiveMetrics, ComplexityLevel, ComplexityResult, SummaryOptions, SummaryResult } from "../types/index.js";
import { analyze } from "./構造分析器.js";
import type { TemplateData } from "./templates.js";
import { computeMetrics, compositeScore } from "./採点ロジック.js";
import { resolveTemplate, resolveMaxTokens } from "./template-resolver.js";
import { BASE_SYSTEM_PROMPT, buildUserPrompt } from "./prompt-builder.js";

const MODEL = "claude-opus-4-7";

const FAIL_THRESHOLD = 70;

type ScoredDimension = keyof Pick<
  CognitiveMetrics,
  "chunkingScore" | "anchorScore" | "densityScore" | "tensionResolutionScore"
>;

const DIMENSION_ADVICE: Record<ScoredDimension, string> = {
  chunkingScore:
    "CHUNKING (Cowan 4±1): reduce array items to exactly 3–4. " +
    "Merge the lowest-value items; never split a concept just to fill slots.",
  anchorScore:
    "PRIMACY (anchor field): front-load the single most important conclusion " +
    "in the first field, ≤20 words. Every word past that limit is noise.",
  densityScore:
    "DENSITY (word budgets): trim prose fields to stay within their word limits. " +
    "Cut filler phrases; keep only load-bearing sentences.",
  tensionResolutionScore:
    "TENSION-RESOLUTION (Zeigarnik): open with an explicit gap or problem statement, " +
    "then close with its resolution. The arc must be complete.",
};

export function createRefinementPrompt(prev: SummaryResult): string {
  const failing = (
    Object.entries({
      chunkingScore:          prev.metrics.chunkingScore,
      anchorScore:            prev.metrics.anchorScore,
      densityScore:           prev.metrics.densityScore,
      tensionResolutionScore: prev.metrics.tensionResolutionScore,
    }) as [ScoredDimension, number][]
  )
    .filter(([, score]) => score < FAIL_THRESHOLD)
    .sort(([, a], [, b]) => a - b);

  const improvements =
    failing.length > 0
      ? failing.map(([dim, score]) => `• [${score}/100] ${DIMENSION_ADVICE[dim]}`).join("\n")
      : "• All dimensions pass threshold. Make only minor polish — do not restructure.";

  return `Your previous output scored ${prev.cognitiveScore}/100 overall.

DIMENSION BREAKDOWN:
  Chunking        : ${prev.metrics.chunkingScore}/100  (items: ${prev.metrics.chunkCount})
  Anchor clarity  : ${prev.metrics.anchorScore}/100
  Density         : ${prev.metrics.densityScore}/100
  Tension–resolve : ${prev.metrics.tensionResolutionScore}/100

REQUIRED IMPROVEMENTS (worst first):
${improvements}

Rewrite the JSON using the same schema. Preserve all information that is not contradicted by the instructions above. Do not introduce content absent from the original document. Return corrected JSON only.`;
}

export async function refine(
  text: string,
  complexity: ComplexityResult,
  prev: SummaryResult,
  opts: SummaryOptions = {},
  onDelta?: (chunk: string) => void,
): Promise<SummaryResult> {
  const client = new Anthropic();
  const analysis = analyze({ text });
  const template = resolveTemplate(opts, complexity, analysis);
  const originalPrompt = buildUserPrompt(analysis, opts, template, complexity);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: resolveMaxTokens(complexity),
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: BASE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      { role: "user",      content: originalPrompt },
      { role: "assistant", content: prev.rawJson },
      { role: "user",      content: createRefinementPrompt(prev) },
    ],
  });

  let raw = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      raw += event.delta.text;
      onDelta?.(event.delta.text);
    }
  }

  const final = await stream.finalMessage();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Refine pass did not return valid JSON. Raw response:\n${raw}`);
  }
  const data = JSON.parse(jsonMatch[0]) as TemplateData;
  const rendered = template.render(data);
  const metrics = computeMetrics(template, data);

  return {
    rendered,
    cognitiveScore: compositeScore(metrics),
    metrics,
    rawJson: jsonMatch[0],
    model: final.model,
    inputTokens: final.usage.input_tokens,
    outputTokens: final.usage.output_tokens,
    cachedTokens: final.usage.cache_read_input_tokens ?? 0,
  };
}

export interface RefinementConfig {
  targetScore?: number;
  maxPasses?: number;
  opts?: SummaryOptions;
  onPass?: (pass: number, result: SummaryResult) => void;
  onDelta?: (chunk: string) => void;
}

const DIFFICULTY_DEFAULTS: Record<ComplexityLevel, Required<Pick<RefinementConfig, "targetScore" | "maxPasses">>> = {
  low:    { targetScore: 80, maxPasses: 2 },
  medium: { targetScore: 85, maxPasses: 3 },
  high:   { targetScore: 90, maxPasses: 5 },
};

export function buildRefinementConfig(
  complexity: ComplexityResult,
  overrides: Omit<RefinementConfig, "targetScore" | "maxPasses"> = {},
): RefinementConfig {
  return {
    ...DIFFICULTY_DEFAULTS[complexity.difficulty],
    ...overrides,
  };
}

export async function refineUntil(
  text: string,
  complexity: ComplexityResult,
  initial: SummaryResult,
  config: RefinementConfig = {},
): Promise<{ result: SummaryResult; passes: number }> {
  const { targetScore = 85, maxPasses = 3, opts = {}, onPass, onDelta } = config;

  let current = initial;
  let passes = 0;

  while (current.cognitiveScore < targetScore && passes < maxPasses) {
    current = await refine(text, complexity, current, opts, onDelta);
    passes++;
    onPass?.(passes, current);
  }

  return { result: current, passes };
}
