import type { ComplexityLevel, ComplexityResult, TemplateId } from "../types/index.js";

// ─── Language helpers ─────────────────────────────────────────────────────────

const CJK_RE = /[　-鿿豈-﫿]/g;

function isJapanese(text: string): boolean {
  const cjk = (text.match(CJK_RE) ?? []).length;
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length;
  return cjk / Math.max(1, cjk + latin) > 0.5;
}

// ─── Metric 1: Technical Term Density ────────────────────────────────────────
// Heuristics for "technical" tokens:
//   ALL_CAPS acronyms (API, HTTP)  |  camelCase / PascalCase (TypeScript, useState)
//   snake_case / SCREAMING_SNAKE   |  dotted.notation (Array.from)
//   inline `code` spans            |  numeric literals with units (16px, 200ms)

const TECHNICAL_RE =
  /`[^`]+`|\b[A-Z]{2,}\b|\b[a-z]+[A-Z]\w*\b|\b[A-Z][a-z]+[A-Z]\w*\b|\b\w+_\w+\b|\b\w+\.\w+\b|\b\d+(?:px|ms|rem|em|vh|vw|%|kb|mb|gb)\b/gi;

function technicalDensity(text: string, totalWords: number): number {
  if (totalWords === 0) return 0;
  const hits = new Set(text.match(TECHNICAL_RE) ?? []).size; // deduplicate repeated terms
  return Math.min(1, hits / totalWords);
}

// ─── Metric 2: Average Sentence Length ───────────────────────────────────────
// Latin: average word count per sentence.
// Japanese: average character count per sentence (no spaces → can't count words).

const SENTENCE_SPLIT_RE = /[.!?。！？]+/;

function avgSentenceLength(text: string, japanese: boolean): number {
  const sentences = text
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return 0;

  if (japanese) {
    const totalChars = sentences.reduce((n, s) => n + (s.match(/\S/g) ?? []).length, 0);
    return Math.round(totalChars / sentences.length);
  }

  const totalWords = sentences.reduce(
    (n, s) => n + (s.match(/\S+/g) ?? []).length,
    0,
  );
  return Math.round(totalWords / sentences.length);
}

// ─── Metric 3: Structuring Score (Entropy / Organisation) ────────────────────
// Measures the ratio of lines that carry structural signal:
//   Markdown headings (#–######)  |  bullets (-, *, +)
//   numbered lists (1.)           |  blockquotes (>)  |  code fences (```)
// Higher ratio = lower extraneous cognitive load (Sweller CLT).

const STRUCTURAL_LINE_RE = /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)/;

function structuringScore(text: string): number {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return 0;
  const structured = lines.filter((l) => STRUCTURAL_LINE_RE.test(l.trim())).length;
  return structured / lines.length;
}

// ─── Estimated Tokens ─────────────────────────────────────────────────────────
// CJK characters tokenize at ~1 char/token in most BPE vocabularies.
// Latin text tokenizes at ~4 chars/token on average.

function estimatedTokens(text: string): number {
  const cjk = (text.match(CJK_RE) ?? []).length;
  const rest = text.length - cjk;
  return Math.round(cjk * 1.0 + rest / 4);
}

// ─── Total word count (reused across metrics) ─────────────────────────────────

function wordCount(text: string, japanese: boolean): number {
  if (japanese) return (text.match(/\S/g) ?? []).length;
  return (text.match(/\S+/g) ?? []).length;
}

// ─── Difficulty thresholds ────────────────────────────────────────────────────

function difficulty(
  density: number,
  sentLen: number,
  structure: number,
  japanese: boolean,
): ComplexityLevel {
  const sentThreshold = japanese ? 60 : 25;

  const highSignals =
    (density > 0.12 ? 1 : 0) +
    (sentLen > sentThreshold ? 1 : 0) +
    (structure < 0.05 ? 1 : 0);

  const lowSignals =
    (density < 0.04 ? 1 : 0) +
    (sentLen < (japanese ? 25 : 10) ? 1 : 0) +
    (structure > 0.2 ? 1 : 0);

  if (highSignals >= 2) return "high";
  if (lowSignals >= 2) return "low";
  return "medium";
}

// ─── Template recommendation ──────────────────────────────────────────────────

function suggestTemplate(
  level: ComplexityLevel,
  density: number,
  structure: number,
): TemplateId {
  if (level === "high") return density > 0.1 ? "chunked" : "scqa";
  if (level === "low") return "bluf";
  return structure > 0.15 ? "layered" : "narrative";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function テキスト難易度分析(text: string): ComplexityResult {
  const ja = isJapanese(text);
  const wc = wordCount(text, ja);

  const density = technicalDensity(text, wc);
  const sentLen = avgSentenceLength(text, ja);
  const structure = structuringScore(text);
  const level = difficulty(density, sentLen, structure, ja);

  return {
    difficulty: level,
    technicalDensity: Math.round(density * 1000) / 1000,
    avgSentenceLength: sentLen,
    structuringScore: Math.round(structure * 1000) / 1000,
    suggestedTemplate: suggestTemplate(level, density, structure),
    estimatedTokens: estimatedTokens(text),
  };
}
