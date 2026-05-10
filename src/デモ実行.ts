import { analyze } from "./lib/構造分析器.js";
import { テキスト難易度分析 } from "./lib/難易度判定器.js";
import { summarize } from "./lib/要約実行部.js";
import { refineUntil, buildRefinementConfig } from "./lib/自己修正プロセッサ.js";
import type { SummaryOptions } from "./types/index.js";

// ─── Demo ─────────────────────────────────────────────────────────────────────

const SAMPLE_TEXT = `
# TypeScriptにおける型システムの設計原則

## はじめに

TypeScriptは静的型付けをJavaScriptに持ち込むことで、大規模アプリケーション開発の安全性と
保守性を大幅に向上させました。本稿では、実務で役立つ型システムの設計原則を解説します。

## 構造的型付けと名義的型付け

TypeScriptは構造的型付け（Structural Typing）を採用しています。これはオブジェクトの
形状（プロパティとその型）が一致すれば、同じ型として扱われることを意味します。
これにより既存のJavaScriptコードとの互換性が保たれています。

## ユニオン型と交差型

ユニオン型（Union Types）は複数の型のいずれかを表し、交差型（Intersection Types）は
複数の型をすべて満たすことを要求します。これらを組み合わせることで、
複雑なデータ構造を正確にモデル化できます。

## まとめ

適切な型設計はバグの早期発見と開発者体験の向上をもたらします。
過度な型の複雑化を避けつつ、ドメインを正確に表現する型を目指しましょう。
`.trim();

async function main() {
  console.log("=== Super Summary System ===\n");

  // 1. 構造分析
  console.log("▸ Analyzing text structure...");
  const analysis = analyze({ text: SAMPLE_TEXT });
  console.log(`  Title       : ${analysis.title ?? "(none)"}`);
  console.log(`  Sections    : ${analysis.sections.length}`);
  console.log(`  Total words : ${analysis.totalWords}`);
  console.log(`  Language    : ${analysis.languageHint}`);
  console.log(`  Reading time: ~${analysis.estimatedReadingMinutes} min\n`);

  // 2. 難易度分析
  console.log("▸ Analyzing complexity...");
  const complexity = テキスト難易度分析(SAMPLE_TEXT);
  console.log(`  Difficulty        : ${complexity.difficulty}`);
  console.log(`  Technical density : ${(complexity.technicalDensity * 100).toFixed(1)}%`);
  console.log(`  Avg sentence len  : ${complexity.avgSentenceLength}`);
  console.log(`  Structuring score : ${(complexity.structuringScore * 100).toFixed(1)}%`);
  console.log(`  Estimated tokens  : ~${complexity.estimatedTokens}`);
  console.log(`  Suggested template: ${complexity.suggestedTemplate}\n`);

  // 3. 初回要約（ストリーミング）
  console.log("▸ Generating initial summary (streaming)...\n");
  const opts: SummaryOptions = { style: "concise" };

  process.stdout.write("  ");
  const initial = await summarize(SAMPLE_TEXT, complexity, opts, (chunk) => {
    process.stdout.write(chunk);
  });
  console.log(`\n\n  Initial score: ${initial.cognitiveScore}/100\n`);

  // 4. 自己進化リファインメントループ
  const config = buildRefinementConfig(complexity, {
    onPass: (n, r) =>
      console.log(
        `  [Pass ${n}] Score: ${r.cognitiveScore}/100` +
        ` | Chunks: ${r.metrics.chunkCount}` +
        ` | Anchor: ${r.metrics.anchorScore}` +
        ` | Density: ${r.metrics.densityScore}`,
      ),
  });

  console.log(
    `▸ Refining (target: ${config.targetScore}, max passes: ${config.maxPasses})...\n`,
  );
  const { result, passes } = await refineUntil(SAMPLE_TEXT, complexity, initial, config);

  const improved = result.cognitiveScore > initial.cognitiveScore;
  console.log(
    `\n  Done in ${passes} pass${passes !== 1 ? "es" : ""}` +
    ` — score ${initial.cognitiveScore} → ${result.cognitiveScore}` +
    (improved ? " ▲" : " (no improvement)") + "\n",
  );

  // 5. レンダリング済み出力
  console.log("=== Rendered Summary ===\n");
  console.log(result.rendered.text);

  console.log("=== Markdown Preview ===\n");
  console.log(result.rendered.markdown);

  // 6. 認知スコア
  console.log("=== Cognitive Score ===\n");
  console.log(`  Overall         : ${result.cognitiveScore} / 100`);
  console.log(`  Chunking        : ${result.metrics.chunkingScore} / 100  (chunks: ${result.metrics.chunkCount})`);
  console.log(`  Anchor clarity  : ${result.metrics.anchorScore} / 100`);
  console.log(`  Density         : ${result.metrics.densityScore} / 100`);
  console.log(`  Tension–resolve : ${result.metrics.tensionResolutionScore} / 100`);
  console.log(`  Read time       : ~${result.metrics.estimatedReadSeconds}s\n`);

  console.log("=== Token Usage ===");
  console.log(`  Input   : ${result.inputTokens}`);
  console.log(`  Output  : ${result.outputTokens}`);
  console.log(`  Cached  : ${result.cachedTokens}`);
  console.log(`  Model   : ${result.model}`);
  console.log(`  Template: ${result.rendered.templateId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
