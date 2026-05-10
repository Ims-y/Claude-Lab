// ─── Input ───────────────────────────────────────────────────────────────────

export interface AnalysisInput {
  text: string;
  title?: string;
}

// ─── Analyzer output ─────────────────────────────────────────────────────────

export interface TextSection {
  heading: string | null;
  content: string;
  wordCount: number;
}

export interface AnalysisResult {
  title: string | null;
  sections: TextSection[];
  totalWords: number;
  estimatedReadingMinutes: number;
  languageHint: "ja" | "en" | "mixed" | "unknown";
}

// ─── Templates ────────────────────────────────────────────────────────────────

export type TemplateId = "bluf" | "layered" | "scqa" | "chunked" | "narrative";

// ─── Complexity analysis ──────────────────────────────────────────────────────

export type ComplexityLevel = "high" | "medium" | "low";

export interface ComplexityResult {
  difficulty: ComplexityLevel;
  /** Ratio of technical/domain terms to total tokens (0–1) */
  technicalDensity: number;
  /** Mean sentence length in words (Latin) or characters (Japanese) */
  avgSentenceLength: number;
  /**
   * Ratio of structured lines (headings, bullets, numbered lists) to total lines (0–1).
   * Higher = lower extraneous cognitive load; lower = wall-of-text risk.
   */
  structuringScore: number;
  /** Template best suited to this complexity profile */
  suggestedTemplate: TemplateId;
  /** Approximate API token count for billing estimation */
  estimatedTokens: number;
}

export interface RenderedSummary {
  templateId: TemplateId;
  templateName: string;
  /** Plain-text output — for terminal / raw display */
  text: string;
  /** Markdown output — for web / note-taking apps */
  markdown: string;
}

// ─── Summarizer output ───────────────────────────────────────────────────────

export type SummaryStyle = "concise" | "detailed" | "bullets";

export interface SummaryOptions {
  style?: SummaryStyle;
  maxWords?: number;
  language?: "ja" | "en" | "auto";
  stream?: boolean;
  /** Explicit template override; auto-selected from document signals if omitted */
  templateId?: TemplateId;
}

/**
 * Per-dimension cognitive-load scores (0–100 each, higher = less load).
 * Each dimension maps to a named cognitive science principle.
 */
export interface CognitiveMetrics {
  /** Cowan's 4±1: 100 when array-field item count ≤ 4; penalised above that */
  chunkingScore: number;
  /** Primacy effect: 100 when the anchor field is present and within its word limit */
  anchorScore: number;
  /** Extraneous cognitive load: avg adherence to per-field word-count budgets (0–1 → 0–100) */
  densityScore: number;
  /** Zeigarnik effect: 100 when the template includes both a tension and a resolution field */
  tensionResolutionScore: number;
  /** Raw item count of the highest-cardinality array field (reference value for chunkingScore) */
  chunkCount: number;
  /** Estimated reading time of the rendered summary content in seconds */
  estimatedReadSeconds: number;
}

export interface SummaryResult {
  rendered: RenderedSummary;
  /** Weighted composite of CognitiveMetrics sub-scores (0–100) */
  cognitiveScore: number;
  metrics: CognitiveMetrics;
  /** Raw JSON string returned by Claude — replayed as assistant turn in refinement */
  rawJson: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}
