/**
 * フォルダ監視モード — Folder Watch CLI
 *
 * Usage:
 *   npm run 監視開始               # watches ./inbox
 *   npm run 監視開始 ./my-docs     # watches a custom directory
 *
 * Drops two files per processed document into <dir>/.summaries/:
 *   <stem>.<timestamp>.md    — rendered Markdown summary
 *   <stem>.<timestamp>.json  — full metadata + raw JSON for downstream use
 */

import { resolve, basename } from "node:path";
import { mkdir } from "node:fs/promises";
import { watchDirectory } from "./index.js";

const WATCH_DIR = process.argv[2] ?? "./inbox";
const ABS_DIR = resolve(WATCH_DIR);

// Ensure the inbox exists so chokidar doesn't throw on first run
await mkdir(ABS_DIR, { recursive: true });

console.log(`▸ 新規ドキュメント監視中: ${ABS_DIR}`);
console.log(`  対象: *.txt, *.md  |  出力: ${ABS_DIR}/.summaries/`);
console.log(`  Ctrl-C で停止\n`);

const watcher = watchDirectory(WATCH_DIR, {
  onResult: (file, result, passes) => {
    const score = result.cognitiveScore;
    const bar = "█".repeat(Math.round(score / 10)) + "░".repeat(10 - Math.round(score / 10));

    console.log(`✓ ${basename(file)}`);
    console.log(`  Template : ${result.rendered.templateId}`);
    console.log(`  Score    : [${bar}] ${score}/100  (${passes} pass${passes !== 1 ? "es" : ""})`);
    console.log(`  Chunking : ${result.metrics.chunkingScore}  Anchor: ${result.metrics.anchorScore}  Density: ${result.metrics.densityScore}  T/R: ${result.metrics.tensionResolutionScore}`);
    console.log(`  Tokens   : in=${result.inputTokens}  out=${result.outputTokens}  cached=${result.cachedTokens}\n`);
  },
  onError: (file, err) => {
    console.error(`✗ ${basename(file)}: ${err.message}\n`);
  },
});

process.on("SIGINT", async () => {
  console.log("\n▸ シャットダウン中...");
  await watcher.close();
  process.exit(0);
});
