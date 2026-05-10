/**
 * Mock summary generator for offline testing and score-recovery design.
 *
 * "perfect" mode — data engineered to satisfy every cognitive constraint.
 * "chaos"   mode — deliberately degenerate data to stress-test renderers
 *                  and downstream consumers that must handle bad input.
 */

import type { SummaryResult, TemplateId } from "../types/index.js";
import { TEMPLATES } from "./templates.js";
import type { TemplateData } from "./templates.js";
import { computeMetrics, compositeScore } from "./採点ロジック.js";

// ─── Perfect-mode data ────────────────────────────────────────────────────────
// Designed to maximise every CognitiveMetrics sub-score:
//   chunkCount ≤ 4  |  anchor within word limit  |  prose fields within budget

const PERFECT_DATA: Record<TemplateId, TemplateData> = {
  bluf: {
    verdict: "TypeScriptの型システムはバグを早期に発見し開発速度を向上させる。",
    why: "静的型付けにより実行前にエラーを検出でき、大規模チームでのリファクタリングが安全になる。",
    evidence: [
      "構造的型付けがJavaScriptとの後方互換性を保つ",
      "ユニオン型と交差型で複雑なドメインを正確にモデル化できる",
      "型推論により明示的な注釈なしで安全性を確保できる",
    ],
    action: "tsconfig.jsonでstrictモードを有効化せよ。",
  },

  layered: {
    gist: "TypeScriptの型システムはJavaScriptに安全性と保守性をもたらす。",
    keyPoints: [
      "構造的型付けが既存コードとの互換性を維持する",
      "ユニオン型・交差型で複雑なデータ構造を正確にモデル化できる",
      "適切な型設計はバグの早期発見と開発者体験を向上させる",
    ],
    context:
      "TypeScriptは大規模アプリケーション開発において、静的型付けによってコンパイル時に" +
      "エラーを検出する。構造的型付けの採用により既存コードとの互換性が保たれ、段階的な移行が可能だ。",
  },

  scqa: {
    situation:
      "JavaScriptは動的型付け言語であり、大規模開発での型安全性確保が困難だった。",
    complication:
      "チームが拡大しコードベースが複雑化するにつれ、実行時エラーとリファクタリングコストが急増した。",
    question: "型安全性を保ちながらJavaScriptエコシステムを活用するにはどうすればよいか？",
    answer:
      "TypeScriptの構造的型付けとユニオン型・交差型を組み合わせることで、既存資産を活かしながら" +
      "静的型安全性を段階的に導入できる。",
  },

  chunked: {
    coreIdea: "3つの型機能の組み合わせが安全な大規模開発を実現する。",
    chunks: [
      "構造的型付け：形状が一致すれば同じ型として扱われ、JavaScriptとの互換性が保たれる",
      "ユニオン型：複数の型のいずれかを表し、条件分岐を型レベルで安全に表現できる",
      "交差型：複数の型をすべて満たす合成型で、ミックスインパターンを型安全に実装できる",
    ],
    connections:
      "3機能は独立して使えるが、組み合わせることで複雑なドメインモデルを過不足なく表現できる。",
  },

  narrative: {
    hook: "なぜJavaScriptの達人たちは自ら型制約を課すことを選んだのか？",
    context:
      "JavaScriptは柔軟性の代わりに型安全性を犠牲にしてきた。チームや規模が拡大すると" +
      "その代償が顕在化し、見えないバグと膨大なリファクタリングコストが発生する。",
    insight:
      "TypeScriptの構造的型付けは、既存コードを壊さず型安全性を段階的に導入する解答だ。" +
      "ユニオン型と交差型が加わることで、実際のドメインの複雑さを型システムで正確に表現できる。",
    takeaway: "型設計はドキュメントであり、テストであり、設計そのものだ。",
  },
};

// ─── Chaos-mode data ──────────────────────────────────────────────────────────
// Every constraint is violated:
//   chunkCount >> 4  |  anchor bloated  |  prose fields over limit  |  no coherence
// Use this to verify that renderers degrade gracefully and scoring penalises correctly.

const CHAOS_DATA: Record<TemplateId, TemplateData> = {
  bluf: {
    // anchor grossly over the 25-word limit
    verdict:
      "TypeScriptは素晴らしいかもしれないし、そうでないかもしれない。多くの人がそう言っており、" +
      "一部の専門家は別の意見を持っているが、これは非常に複雑なトピックであり簡単に結論を出せない。",
    why:
      "理由は複数存在し、それぞれが互いに関連しているため一概に説明することは困難だが、あえて言えば、" +
      "プログラミングとは本質的に複雑な行為であり型システムはその一側面に過ぎない。",
    // 8 items — well beyond Cowan's ceiling
    evidence: [
      "TypeScriptは人気がある",
      "JavaScriptも人気がある",
      "PythonもRubyもGoもRustも人気がある",
      "プログラミング言語は多数存在する",
      "型システムには賛否両論がある",
      "静的型付けは動的型付けとは異なる",
      "コンパイル時エラーは実行時エラーとは異なる",
      "大規模開発と小規模開発では要件が異なる",
    ],
    // action field bloated beyond its 30-word limit
    action:
      "何かを決めてください。ただし決める前によく考えてチームと相談しドキュメントを読み" +
      "プロトタイプを作成しベンチマークを実施しセキュリティ審査を行い法務確認をして" +
      "経営陣に承認を得てから実装に進んでください。",
  },

  layered: {
    // anchor over 20-word limit
    gist:
      "TypeScriptというプログラミング言語はMicrosoftによって開発されたJavaScriptの" +
      "スーパーセットであり、オプションの静的型付けとクラスベースのOOPを追加している複雑な言語です。",
    // 8 key points — double the ideal maximum
    keyPoints: [
      "TypeScriptはJavaScriptのスーパーセットである",
      "静的型付けが可能である",
      "クラスをサポートしている",
      "インターフェースをサポートしている",
      "ジェネリクスをサポートしている",
      "デコレータをサポートしている（実験的）",
      "型推論がある",
      "型ガードが使える",
    ],
    context: "非常に長い文脈の説明がここに入る。".repeat(20),
  },

  scqa: {
    // situation over 40-word limit
    situation:
      "JavaScriptは1995年にBrendan Eichによって開発され、当初はNetscape Navigatorのためだけに" +
      "設計されたが、その後急速に普及し、現在では世界で最も使用されているプログラミング言語の一つとなっており、" +
      "フロントエンドからバックエンド、さらにはモバイルアプリまで幅広く利用されている。",
    // complication over 40-word limit
    complication:
      "問題は多岐にわたり、技術的負債、チームのスキルセット、レガシーコードの存在、ビジネス要件の変化、" +
      "セキュリティ上の懸念、パフォーマンス要件、スケーラビリティの問題、テストカバレッジの不足など、" +
      "あらゆる側面で課題が存在し、それらが複雑に絡み合っている。",
    // question over 20-word limit
    question:
      "この状況をどのように解決すればよいのか、また誰が責任を持つべきなのか、いつまでに対処すべきなのか、" +
      "どのくらいのコストがかかるのかを教えてください？",
    answer: "答えはケースバイケースである。",
  },

  chunked: {
    // anchor over 20-word limit
    coreIdea:
      "TypeScriptには非常に多くの機能があり、それらすべてを理解するには時間がかかる" +
      "長い学習曲線が存在する複雑なシステムである。",
    // 6 chunks — exceeds Cowan's ceiling
    chunks: [
      "構造的型付けは名義的型付けとは異なる哲学的アプローチを取る",
      "ユニオン型は複数の型を組み合わせる方法の一つである",
      "交差型はユニオン型とは逆のアプローチを取る",
      "ジェネリクスは型パラメータを抽象化する機能である",
      "条件型は型レベルでの条件分岐を可能にする",
      "マップ型は既存の型から新しい型を生成する",
    ],
  },

  narrative: {
    // hook over 25-word limit with no real tension
    hook:
      "これは本当に興味深い質問であり多くの開発者が日々直面している根本的な問題の核心に触れるものであって" +
      "単純に答えられるものではないがあえて問いを立てるとすれば。",
    context: "非常に長い背景説明。".repeat(15),
    insight: "洞察もまた非常に長く、読者が途中で迷子になってしまう。".repeat(10),
    // takeaway over 30-word limit
    takeaway:
      "まとめると、プログラミングは難しく、TypeScriptはその難しさを一部解決するが新たな複雑さをもたらすこともあり、" +
      "最終的には状況と要件によって判断する必要があり、銀の弾丸は存在しない。",
  },
};

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateMockSummary(
  templateId: TemplateId,
  mode: "perfect" | "chaos",
): SummaryResult {
  const template = TEMPLATES[templateId];
  const data = mode === "perfect" ? PERFECT_DATA[templateId] : CHAOS_DATA[templateId];

  const rendered = template.render(data);
  const metrics = computeMetrics(template, data);

  return {
    rendered,
    cognitiveScore: compositeScore(metrics),
    metrics,
    rawJson: "",
    model: `mock-${mode}`,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
  };
}
