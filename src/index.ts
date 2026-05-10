// ─── Public API barrel ────────────────────────────────────────────────────────
// Import from here, not from individual lib files.

export { analyze } from "./lib/構造分析器.js";
export { テキスト難易度分析 } from "./lib/難易度判定器.js";
export { summarize } from "./lib/要約実行部.js";
export { スーパー要約実行, 一括要約処理 } from "./lib/一括処理エンジン.js";
export { watchDirectory } from "./lib/watcher.js";
export {
  refineUntil,
  buildRefinementConfig,
  createRefinementPrompt,
} from "./lib/自己修正プロセッサ.js";
export { TEMPLATES, selectTemplate } from "./lib/templates.js";

export type {
  AnalysisInput,
  AnalysisResult,
  TextSection,
  ComplexityLevel,
  ComplexityResult,
  TemplateId,
  RenderedSummary,
  SummaryStyle,
  SummaryOptions,
  SummaryResult,
  CognitiveMetrics,
} from "./types/index.js";
export type { Template, TemplateField, TemplateData } from "./lib/templates.js";
export type { BatchInput, BatchResult, BatchOptions } from "./lib/一括処理エンジン.js";
export type { WatchOptions } from "./lib/watcher.js";
export type { RefinementConfig } from "./lib/自己修正プロセッサ.js";
