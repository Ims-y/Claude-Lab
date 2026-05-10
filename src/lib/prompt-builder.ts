import type { AnalysisResult, ComplexityLevel, ComplexityResult, SummaryOptions } from "../types/index.js";
import { SCORING_INSTRUCTION } from "./採点ロジック.js";
import type { Template } from "./templates.js";

// ─── System prompt ────────────────────────────────────────────────────────────
// Stable — cache-controlled. Never put per-request values here.

export const BASE_SYSTEM_PROMPT = `You are an expert summarization engine. Given a structured \
analysis of a text document, produce a summary using the output format specified in the \
user message.

Rules:
- Always respond with valid JSON only — no preamble, no markdown fences, no explanation
- Match the language of the source document (Japanese → Japanese, English → English)
- Never add information not present in the source
- Follow the template schema exactly as described in the OUTPUT FORMAT section

${SCORING_INSTRUCTION}`;

// ─── Difficulty notes ─────────────────────────────────────────────────────────
// Appended to the user message (not system) so the cached prefix stays stable.

export const DIFFICULTY_NOTE: Record<ComplexityLevel, string> = {
  low:
    "Source complexity: LOW. Be maximally concise — the material is simple and so should the summary be.",
  medium: "",
  high:
    "Source complexity: HIGH (technical density detected). " +
    "Prioritise clarity over completeness. " +
    "Decompose complex ideas into the smallest atomic units before synthesising.",
};

// ─── User prompt builder ──────────────────────────────────────────────────────

export function buildUserPrompt(
  analysis: AnalysisResult,
  opts: SummaryOptions,
  template: Template,
  complexity: ComplexityResult,
): string {
  const { style = "concise", maxWords, language = "auto" } = opts;

  const styleGuide: Record<NonNullable<SummaryOptions["style"]>, string> = {
    concise: "Keep each field tight — brevity over completeness.",
    detailed: "Write thorough, multi-sentence responses for prose fields.",
    bullets: "Where a field is prose, write it as a tight bulleted list instead.",
  };

  const langGuide =
    language === "auto"
      ? `The document language is detected as: ${analysis.languageHint}.`
      : `Output language: ${language}.`;

  const wordLimit = maxWords ? `\nTarget summary length: ≤ ${maxWords} words.` : "";

  const sectionDump = analysis.sections
    .map((s, i) =>
      s.heading
        ? `[Section ${i + 1}: ${s.heading}]\n${s.content}`
        : `[Section ${i + 1}]\n${s.content}`,
    )
    .join("\n\n---\n\n");

  const difficultyNote = DIFFICULTY_NOTE[complexity.difficulty];

  return `Document title: ${analysis.title ?? "(untitled)"}
Total words: ${analysis.totalWords} | Estimated tokens: ${complexity.estimatedTokens}
Reading time: ~${analysis.estimatedReadingMinutes} min
Style: ${style} — ${styleGuide[style]}
${langGuide}${wordLimit}

=== DOCUMENT CONTENT ===
${sectionDump}
=== END ===

=== OUTPUT FORMAT ===
${template.toPromptInstructions()}${difficultyNote ? `\n\n=== COMPLEXITY CONTEXT ===\n${difficultyNote}` : ""}`;
}
