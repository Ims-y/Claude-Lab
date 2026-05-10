import type { AnalysisInput, AnalysisResult, TextSection } from "../types/index.js";

const HEADING_RE = /^(#{1,6})\s+(.+)$/m;
const SECTION_SPLIT_RE = /\n(?=#{1,6}\s)/;
const WORDS_PER_MINUTE = 200;

function detectLanguage(text: string): AnalysisResult["languageHint"] {
  const jaChars = (text.match(/[　-鿿豈-﫿]/g) ?? []).length;
  const enChars = (text.match(/[a-zA-Z]/g) ?? []).length;
  const total = jaChars + enChars;
  if (total === 0) return "unknown";
  const jaRatio = jaChars / total;
  if (jaRatio > 0.6) return "ja";
  if (jaRatio < 0.1) return "en";
  return "mixed";
}

function countWords(text: string): number {
  const lang = detectLanguage(text);
  if (lang === "ja") {
    // Japanese: count characters (excluding whitespace)
    return (text.match(/\S/g) ?? []).length;
  }
  return (text.trim().match(/\S+/g) ?? []).length;
}

function extractTitle(text: string): string | null {
  const match = text.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function splitIntoSections(text: string): TextSection[] {
  const hasHeadings = HEADING_RE.test(text);

  if (!hasHeadings) {
    return [{ heading: null, content: text.trim(), wordCount: countWords(text) }];
  }

  return text
    .split(SECTION_SPLIT_RE)
    .filter((s) => s.trim())
    .map((block) => {
      const lines = block.trim().split("\n");
      const firstLine = lines[0];
      const headingMatch = firstLine.match(/^#{1,6}\s+(.+)$/);

      if (headingMatch) {
        const content = lines.slice(1).join("\n").trim();
        return {
          heading: headingMatch[1].trim(),
          content,
          wordCount: countWords(content),
        };
      }

      return { heading: null, content: block.trim(), wordCount: countWords(block) };
    });
}

export function analyze(input: AnalysisInput): AnalysisResult {
  const { text, title } = input;
  const sections = splitIntoSections(text);
  const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0);
  const languageHint = detectLanguage(text);
  const estimatedReadingMinutes = Math.max(1, Math.round(totalWords / WORDS_PER_MINUTE));

  return {
    title: title ?? extractTitle(text),
    sections,
    totalWords,
    estimatedReadingMinutes,
    languageHint,
  };
}
