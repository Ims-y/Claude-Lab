/**
 * Cognitive-science-based summary templates.
 *
 * Design principles applied:
 *  - BLUF (Bottom Line Up Front)     : answer before evidence — reduces cognitive scanning cost
 *  - Miller's Law / Cowan's 4±1      : max 4 chunks per working memory slot
 *  - Progressive Disclosure           : 1-sentence → bullets → full context layering
 *  - Minto Pyramid Principle          : Situation → Complication → Question → Answer
 *  - Dual Coding Theory               : pair symbolic labels with prose to create dual memory traces
 *  - Primacy & Recency Effect         : most critical info first AND last
 *  - Zeigarnik Hook                   : open a tension (question/problem) before resolving it
 */

import type { AnalysisResult, TemplateId, RenderedSummary } from "../types/index.js";

export type { TemplateId, RenderedSummary };

// ─── Core types ──────────────────────────────────────────────────────────────

export interface TemplateField {
  key: string;
  /** Human-readable label shown in rendered output */
  label: string;
  /** Which cognitive function this slot serves */
  cognitiveRole:
    | "anchor"        // single-sentence ground truth; reduces searching
    | "elaboration"   // expands the anchor without overloading WM
    | "chunk"         // one atomic piece; stays within 4±1 limit
    | "tension"       // Zeigarnik hook — creates forward motivation
    | "resolution"    // closes the tension opened above
    | "meta";         // context the reader needs to calibrate trust
  maxWords?: number;
  required: boolean;
}

export interface Template {
  id: TemplateId;
  name: string;
  /** Plain-English description of the cognitive science rationale */
  rationale: string;
  /** Best-fit document types */
  bestFor: string[];
  fields: TemplateField[];
  /**
   * Render a structured output from filled field data.
   * Each key in `data` corresponds to a TemplateField.key.
   */
  render(data: TemplateData): RenderedSummary;
  /**
   * Produce the system-prompt fragment to inject into Claude
   * so the model structures its JSON response for this template.
   */
  toPromptInstructions(): string;
}

export type TemplateData = Record<string, string | string[]>;

// ─── Render helpers ───────────────────────────────────────────────────────────

const RULE = "─".repeat(52);
const THIN = "·".repeat(52);

function header(label: string): string {
  return `┌ ${label}\n`;
}

function field(icon: string, label: string, value: string): string {
  return `│ ${icon} ${label.padEnd(14)} ${value}\n`;
}

function bullets(icon: string, items: string[]): string {
  return items.map((it) => `│   ${icon} ${it}`).join("\n") + "\n";
}

function mdBullets(items: string[]): string {
  return items.map((it) => `- ${it}`).join("\n");
}

// ─── Template definitions ─────────────────────────────────────────────────────

/**
 * BLUF — Bottom Line Up Front
 * Optimised for decisions and reports: answer before evidence.
 * Reduces cognitive scanning cost to near zero.
 */
const bluf: Template = {
  id: "bluf",
  name: "BLUF — Bottom Line Up Front",
  rationale:
    "Places the single most important conclusion at position 1 (primacy effect). " +
    "Readers who stop early still leave with the key finding. " +
    "Evidence follows for those who need to verify.",
  bestFor: ["research reports", "executive briefings", "product specs", "decision memos"],

  fields: [
    {
      key: "verdict",
      label: "Verdict",
      cognitiveRole: "anchor",
      maxWords: 25,
      required: true,
    },
    {
      key: "why",
      label: "Why it matters",
      cognitiveRole: "elaboration",
      maxWords: 50,
      required: true,
    },
    {
      key: "evidence",
      label: "Supporting evidence",
      cognitiveRole: "chunk",
      required: true,
    },
    {
      key: "action",
      label: "Recommended action",
      cognitiveRole: "resolution",
      maxWords: 30,
      required: false,
    },
  ],

  render(data) {
    const verdict = String(data["verdict"] ?? "");
    const why = String(data["why"] ?? "");
    const evidence = (data["evidence"] as string[]) ?? [];
    const action = String(data["action"] ?? "");

    const text =
      `${RULE}\n` +
      `▌ BLUF — Bottom Line Up Front\n` +
      `${RULE}\n` +
      `  ◉ ${verdict}\n\n` +
      `  WHY  ${why}\n\n` +
      `  EVIDENCE\n` +
      evidence.map((e) => `    • ${e}`).join("\n") + "\n" +
      (action ? `\n  ACTION → ${action}\n` : "") +
      `${THIN}\n`;

    const markdown =
      `## ◉ ${verdict}\n\n` +
      `**Why it matters:** ${why}\n\n` +
      `**Evidence:**\n${mdBullets(evidence)}\n` +
      (action ? `\n**Recommended action:** ${action}\n` : "");

    return { templateId: this.id, templateName: this.name, text, markdown };
  },

  toPromptInstructions() {
    return `Use the BLUF (Bottom Line Up Front) template. Return JSON with these keys:
- "verdict": one sentence (≤25 words) — the single most important conclusion
- "why": 1–2 sentences explaining why this matters
- "evidence": array of 3–5 strings, each one supporting fact or quote
- "action": optional one sentence — what the reader should do next`;
  },
};

/**
 * Layered — Progressive Disclosure
 * Three cognitive zoom levels: 1 sentence → 3–5 bullets → full paragraph.
 * Readers self-select depth without being forced through extra content.
 */
const layered: Template = {
  id: "layered",
  name: "Layered — Progressive Disclosure",
  rationale:
    "Information Foraging Theory: readers scan before they read. " +
    "Layer 1 (1 sentence) serves the skimmer; " +
    "Layer 2 (bullets) serves the explorer; " +
    "Layer 3 (paragraph) serves the analyst.",
  bestFor: ["knowledge articles", "wiki pages", "newsletters", "blog posts"],

  fields: [
    {
      key: "gist",
      label: "Gist",
      cognitiveRole: "anchor",
      maxWords: 20,
      required: true,
    },
    {
      key: "keyPoints",
      label: "Key points",
      cognitiveRole: "chunk",
      required: true,
    },
    {
      key: "context",
      label: "Full context",
      cognitiveRole: "elaboration",
      required: true,
    },
  ],

  render(data) {
    const gist = String(data["gist"] ?? "");
    const keyPoints = (data["keyPoints"] as string[]) ?? [];
    const context = String(data["context"] ?? "");

    const text =
      `${RULE}\n` +
      `▌ LAYERED — Progressive Disclosure\n` +
      `${RULE}\n` +
      `  L1  ${gist}\n\n` +
      `  L2  KEY POINTS\n` +
      keyPoints.map((p) => `      · ${p}`).join("\n") + "\n\n" +
      `  L3  CONTEXT\n` +
      `      ${context.replace(/\n/g, "\n      ")}\n` +
      `${THIN}\n`;

    const markdown =
      `### ${gist}\n\n` +
      `**Key points:**\n${mdBullets(keyPoints)}\n\n` +
      `**Context:**\n${context}\n`;

    return { templateId: this.id, templateName: this.name, text, markdown };
  },

  toPromptInstructions() {
    return `Use the Layered Progressive Disclosure template. Return JSON with:
- "gist": one sentence (≤20 words) — the irreducible essence
- "keyPoints": array of 3–5 strings — one insight each, scan-readable
- "context": 1–3 paragraphs of full background and nuance`;
  },
};

/**
 * SCQA — Situation / Complication / Question / Answer
 * Barbara Minto's Pyramid Principle.
 * Activates narrative comprehension circuits before presenting the answer,
 * making recall dramatically higher than flat-fact formats.
 */
const scqa: Template = {
  id: "scqa",
  name: "SCQA — Minto Pyramid",
  rationale:
    "Narrative transportation theory: a Situation→Complication arc engages " +
    "the reader's problem-solving schema before the answer is delivered, " +
    "producing deeper encoding and higher recall (Minto, 1987).",
  bestFor: ["business proposals", "case studies", "analytical reports", "academic papers"],

  fields: [
    {
      key: "situation",
      label: "Situation",
      cognitiveRole: "anchor",
      maxWords: 40,
      required: true,
    },
    {
      key: "complication",
      label: "Complication",
      cognitiveRole: "tension",
      maxWords: 40,
      required: true,
    },
    {
      key: "question",
      label: "Question",
      cognitiveRole: "tension",
      maxWords: 20,
      required: true,
    },
    {
      key: "answer",
      label: "Answer",
      cognitiveRole: "resolution",
      required: true,
    },
  ],

  render(data) {
    const situation    = String(data["situation"]    ?? "");
    const complication = String(data["complication"] ?? "");
    const question     = String(data["question"]     ?? "");
    const answer       = String(data["answer"]       ?? "");

    const text =
      `${RULE}\n` +
      `▌ SCQA — Minto Pyramid Principle\n` +
      `${RULE}\n` +
      header("S  Situation") +
      `│   ${situation}\n` +
      `│\n` +
      header("C  Complication") +
      `│   ${complication}\n` +
      `│\n` +
      header("Q  Question") +
      `│   ${question}\n` +
      `│\n` +
      header("A  Answer") +
      `│   ${answer}\n` +
      `${THIN}\n`;

    const markdown =
      `**S — Situation:** ${situation}\n\n` +
      `**C — Complication:** ${complication}\n\n` +
      `**Q — Question:** ${question}\n\n` +
      `**A — Answer:** ${answer}\n`;

    return { templateId: this.id, templateName: this.name, text, markdown };
  },

  toPromptInstructions() {
    return `Use the SCQA (Minto Pyramid) template. Return JSON with:
- "situation": the stable background context (≤40 words)
- "complication": what changed or creates tension (≤40 words)
- "question": the natural question that arises from the complication (≤20 words)
- "answer": the document's answer — can be multiple sentences`;
  },
};

/**
 * Chunked — Cognitive Load Reduction
 * Sweller's Cognitive Load Theory (1988) + Cowan's 4±1 working memory limit.
 * Each chunk is a self-contained atomic idea ≤ 4 items.
 */
const chunked: Template = {
  id: "chunked",
  name: "Chunked — Cognitive Load Reduction",
  rationale:
    "Sweller's CLT: intrinsic load is fixed by content complexity; " +
    "extraneous load (caused by poor structure) can be eliminated. " +
    "Grouping facts into ≤4 named chunks reduces WM overflow " +
    "and enables chunk-level retrieval rather than item-by-item recall.",
  bestFor: ["technical documentation", "tutorials", "reference guides", "spec sheets"],

  fields: [
    {
      key: "coreIdea",
      label: "Core idea",
      cognitiveRole: "anchor",
      maxWords: 20,
      required: true,
    },
    {
      key: "chunks",
      label: "Chunks",
      cognitiveRole: "chunk",
      required: true,
    },
    {
      key: "connections",
      label: "Connections",
      cognitiveRole: "meta",
      required: false,
    },
  ],

  render(data) {
    const coreIdea    = String(data["coreIdea"]    ?? "");
    const chunks      = (data["chunks"] as string[]) ?? [];
    const connections = String(data["connections"] ?? "");

    const chunkLines = chunks
      .slice(0, 4) // enforce ≤4 cognitive chunks
      .map((c, i) => `  ┌─ ${["①", "②", "③", "④"][i]} ─────────────────────────────────\n  │  ${c}`)
      .join("\n  │\n");

    const text =
      `${RULE}\n` +
      `▌ CHUNKED — Cognitive Load Reduction\n` +
      `${RULE}\n` +
      `  CORE  ${coreIdea}\n\n` +
      chunkLines + "\n\n" +
      (connections ? `  CONNECTIONS\n  ${connections}\n` : "") +
      `${THIN}\n`;

    const markdown =
      `**Core:** ${coreIdea}\n\n` +
      chunks.slice(0, 4).map((c, i) => `**${i + 1}.** ${c}`).join("\n\n") + "\n" +
      (connections ? `\n**Connections:** ${connections}\n` : "");

    return { templateId: this.id, templateName: this.name, text, markdown };
  },

  toPromptInstructions() {
    return `Use the Chunked (Cognitive Load Reduction) template. Return JSON with:
- "coreIdea": one sentence (≤20 words) — the unifying concept
- "chunks": array of EXACTLY 3–4 strings, each a self-contained atomic insight (one concept per chunk, no overlap)
- "connections": optional sentence explaining how the chunks relate to each other`;
  },
};

/**
 * Narrative — Zeigarnik Hook + Story Arc
 * Opens a tension before resolving it, exploiting the Zeigarnik effect
 * (incomplete tasks are better remembered than completed ones).
 */
const narrative: Template = {
  id: "narrative",
  name: "Narrative — Zeigarnik Hook",
  rationale:
    "Zeigarnik (1927): unresolved tensions create sustained attention. " +
    "Opening with a 'hook' question or gap keeps WM primed until the " +
    "insight arrives, producing stronger memory consolidation.",
  bestFor: ["long-form articles", "opinion pieces", "thought leadership", "explainers"],

  fields: [
    {
      key: "hook",
      label: "Hook",
      cognitiveRole: "tension",
      maxWords: 25,
      required: true,
    },
    {
      key: "context",
      label: "Context",
      cognitiveRole: "anchor",
      maxWords: 60,
      required: true,
    },
    {
      key: "insight",
      label: "Key insight",
      cognitiveRole: "resolution",
      maxWords: 60,
      required: true,
    },
    {
      key: "takeaway",
      label: "Takeaway",
      cognitiveRole: "meta",
      maxWords: 30,
      required: true,
    },
  ],

  render(data) {
    const hook     = String(data["hook"]     ?? "");
    const context  = String(data["context"]  ?? "");
    const insight  = String(data["insight"]  ?? "");
    const takeaway = String(data["takeaway"] ?? "");

    const text =
      `${RULE}\n` +
      `▌ NARRATIVE — Zeigarnik Hook\n` +
      `${RULE}\n` +
      `  ❝ ${hook} ❞\n\n` +
      `  CONTEXT\n  ${context}\n\n` +
      `  INSIGHT  ▶\n  ${insight}\n\n` +
      `  TAKEAWAY  ★ ${takeaway}\n` +
      `${THIN}\n`;

    const markdown =
      `> ${hook}\n\n` +
      `**Context:** ${context}\n\n` +
      `**Insight:** ${insight}\n\n` +
      `**Takeaway:** ${takeaway}\n`;

    return { templateId: this.id, templateName: this.name, text, markdown };
  },

  toPromptInstructions() {
    return `Use the Narrative Zeigarnik Hook template. Return JSON with:
- "hook": a provocative question or surprising claim that creates curiosity (≤25 words)
- "context": background needed to understand the hook (≤60 words)
- "insight": the document's key revelation — what resolves the tension (≤60 words)
- "takeaway": one memorable sentence the reader should carry away (≤30 words)`;
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TEMPLATES: Record<TemplateId, Template> = {
  bluf,
  layered,
  scqa,
  chunked,
  narrative,
};

// ─── Auto-selector ────────────────────────────────────────────────────────────

/**
 * Recommend the best template based on document structure signals.
 * Uses a simple heuristic rule set — replace with a classifier if needed.
 */
export function selectTemplate(analysis: AnalysisResult): Template {
  const { sections, totalWords, languageHint } = analysis;

  // Technical / multi-section documents → Chunked
  if (sections.length >= 4 && totalWords > 600) return chunked;

  // Short documents (≤300 words) → BLUF for maximum density
  if (totalWords <= 300) return bluf;

  // Documents with a clear narrative arc (headings like intro/conclusion) → SCQA
  const headings = sections.map((s) => (s.heading ?? "").toLowerCase());
  const hasIntroConclusion =
    headings.some((h) => /intro|background|situation|概要/.test(h)) &&
    headings.some((h) => /conclu|summary|result|まとめ/.test(h));
  if (hasIntroConclusion) return scqa;

  // Japanese long-form → Narrative (cultural preference for implied flow)
  if (languageHint === "ja" && totalWords > 400) return narrative;

  // Default: layered progressive disclosure
  return layered;
}
