import chokidar, { type FSWatcher } from "chokidar";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, basename, extname, join } from "node:path";
import pLimit from "p-limit";
import type { SummaryOptions, SummaryResult } from "../types/index.js";
import { スーパー要約実行 } from "./一括処理エンジン.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatchOptions {
  /** Directory to write .json and .md results into. Default: `<inputDir>/.summaries` */
  outputDir?: string;
  /** Passed through to summarize() for every file */
  summaryOpts?: SummaryOptions;
  /** Max simultaneous pipeline runs. Default: 3 (leave headroom for rapid saves) */
  concurrency?: number;
  /** Called after each successful pipeline run */
  onResult?: (file: string, result: SummaryResult, passes: number) => void;
  /** Called when a file fails */
  onError?: (file: string, error: Error) => void;
}

// ─── Output writers ───────────────────────────────────────────────────────────

async function writeOutputs(
  filePath: string,
  outputDir: string,
  result: SummaryResult,
  passes: number,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const stem = basename(filePath, extname(filePath));
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  const meta = {
    sourceFile: filePath,
    processedAt: new Date().toISOString(),
    passes,
    cognitiveScore: result.cognitiveScore,
    metrics: result.metrics,
    model: result.model,
    templateId: result.rendered.templateId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cachedTokens: result.cachedTokens,
  };

  await Promise.all([
    writeFile(
      join(outputDir, `${stem}.${ts}.json`),
      JSON.stringify({ ...meta, rawJson: result.rawJson }, null, 2),
      "utf8",
    ),
    writeFile(
      join(outputDir, `${stem}.${ts}.md`),
      `<!-- ${JSON.stringify(meta)} -->\n\n${result.rendered.markdown}`,
      "utf8",
    ),
  ]);
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

export function watchDirectory(inputDir: string, options: WatchOptions = {}): FSWatcher {
  const {
    outputDir = join(inputDir, ".summaries"),
    summaryOpts = {},
    concurrency = 3,
    onResult,
    onError,
  } = options;

  const limit = pLimit(concurrency);
  const absDir = resolve(inputDir);

  const watcher = chokidar.watch(join(absDir, "**/*.{txt,md}"), {
    ignoreInitial: false,       // process existing files on startup
    ignored: /(^|[/\\])\../,   // skip dot-files and dot-directories
    awaitWriteFinish: {
      stabilityThreshold: 300, // wait 300ms after last write before triggering
      pollInterval: 50,
    },
  });

  async function process(filePath: string): Promise<void> {
    const text = await readFile(filePath, "utf8");
    if (!text.trim()) return;

    const { result, passes } = await スーパー要約実行({ id: filePath, text, opts: summaryOpts });
    await writeOutputs(filePath, outputDir, result, passes);
    onResult?.(filePath, result, passes);
  }

  function handle(filePath: string): void {
    limit(() =>
      process(filePath).catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(filePath, error);
      }),
    );
  }

  watcher.on("add", handle).on("change", handle);

  return watcher;
}
