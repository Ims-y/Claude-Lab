import pLimit from "p-limit";
import type { ComplexityResult, SummaryOptions, SummaryResult } from "../types/index.js";
import { テキスト難易度分析 } from "./難易度判定器.js";
import { summarize } from "./要約実行部.js";
import { refineUntil, buildRefinementConfig } from "./自己修正プロセッサ.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchInput {
  /** Stable identifier for the document; auto-generated if omitted */
  id?: string;
  text: string;
  opts?: SummaryOptions;
}

export type BatchResult =
  | {
      id: string;
      status: "fulfilled";
      result: SummaryResult;
      complexity: ComplexityResult;
      passes: number;
      durationMs: number;
    }
  | {
      id: string;
      status: "rejected";
      error: Error;
      durationMs: number;
    };

export interface BatchOptions {
  /**
   * Maximum simultaneous API calls.
   * Default 5 — respects Anthropic rate limits while saturating local CPU.
   */
  concurrency?: number;
  /** Called after each document completes (fulfilled or rejected). */
  onProgress?: (completed: number, total: number, latest: BatchResult) => void;
}

// ─── Single-document pipeline ─────────────────────────────────────────────────

export async function スーパー要約実行(doc: BatchInput): Promise<{
  result: SummaryResult;
  complexity: ComplexityResult;
  passes: number;
}> {
  const complexity = テキスト難易度分析(doc.text);
  const initial = await summarize(doc.text, complexity, doc.opts ?? {});
  const config = buildRefinementConfig(complexity);
  const { result, passes } = await refineUntil(doc.text, complexity, initial, config);
  return { result, complexity, passes };
}

// ─── Batch processor ──────────────────────────────────────────────────────────

export async function 一括要約処理(
  documents: BatchInput[],
  options: BatchOptions = {},
): Promise<BatchResult[]> {
  const { concurrency = 5, onProgress } = options;
  const limit = pLimit(concurrency);

  let completed = 0;
  const total = documents.length;

  return Promise.all(
    documents.map((doc) =>
      limit(async (): Promise<BatchResult> => {
        const id = doc.id ?? crypto.randomUUID();
        const start = Date.now();

        try {
          const { result, complexity, passes } = await スーパー要約実行(doc);
          const outcome: BatchResult = {
            id,
            status: "fulfilled",
            result,
            complexity,
            passes,
            durationMs: Date.now() - start,
          };
          onProgress?.(++completed, total, outcome);
          return outcome;
        } catch (err) {
          const outcome: BatchResult = {
            id,
            status: "rejected",
            error: err instanceof Error ? err : new Error(String(err)),
            durationMs: Date.now() - start,
          };
          onProgress?.(++completed, total, outcome);
          return outcome;
        }
      }),
    ),
  );
}
