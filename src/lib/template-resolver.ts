import type { AnalysisResult, ComplexityResult, ComplexityLevel, SummaryOptions } from "../types/index.js";
import { TEMPLATES, selectTemplate } from "./templates.js";
import type { Template } from "./templates.js";

// ─── Template resolution ──────────────────────────────────────────────────────
// Three-tier precedence — later tiers are progressively less authoritative:
//   1. opts.templateId          — caller's explicit instruction
//   2. complexity.suggestedTemplate — complexity analysis recommendation
//   3. selectTemplate(analysis) — document structure fallback

export function resolveTemplate(
  opts: SummaryOptions,
  complexity: ComplexityResult,
  analysis: AnalysisResult,
): Template {
  const finalId =
    opts.templateId ??
    complexity.suggestedTemplate ??
    selectTemplate(analysis).id;

  return TEMPLATES[finalId];
}

// ─── Token budget ─────────────────────────────────────────────────────────────
// Scales output space with source complexity.
// High-complexity sources need room to decompose dense content into atomic units;
// low-complexity sources should produce compact output to match the source.

const MAX_TOKENS: Record<ComplexityLevel, number> = {
  low:    1024,
  medium: 2048,
  high:   4096,
};

export function resolveMaxTokens(complexity: ComplexityResult): number {
  return MAX_TOKENS[complexity.difficulty];
}
