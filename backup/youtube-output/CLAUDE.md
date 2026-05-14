# YouTube制作 Claude Code設定

## 正本ドキュメント（必ず最初に読む）

タスク開始前に以下を必ずRead:
1. /workspaces/Claude-Lab/docs/youtube/チャンネル基本設計.md
2. /workspaces/Claude-Lab/docs/youtube/制作ワークフロー.md
3. /workspaces/Claude-Lab/docs/youtube/第1回企画メモ.md（第1話作業時のみ）

これらが設計の正本。本ファイルとの矛盾があれば
/workspaces/Claude-Lab/docs/youtube/ 側を優先せよ。

## 絶対遵守ルール（要約）

### 必須キーワード（毎本1つ以上）
それな／ビジュ爆発／詰んだ（笑）／タイパ神

### 絶対NG（即刻拒否）
- 犬飯／男子／名前先頭の「AI」／肉球中心の命名
- 実在の事件・災害ネタ化
- 政治・宗教の直接対立
- AIっぽい定型説明・箇条書き羅列の台詞
- 背景の毎秒暴走

### 文体ルール
- 1文60文字以内、話し言葉
- 専門用語は一言説明
- コメディ80% + ほっこり20%
- ユーモア最低3箇所

### KPI優先順位（固定）
維持率 → CTR → 保存率

## 検証フロー（台本完成後必須）

1. codex-reviewerサブエージェントで第三者検証
2. SEOタイトル案を最低3パターン生成
3. 視聴離脱リスク箇所を必ず指摘させる
4. 結果を ~/Obsidian/YouTube/ へ保存

## ファイルパス

- 台本: ~/YouTube/台本/
- レビュー: ~/YouTube/reviews/
- Obsidian: ~/Obsidian/YouTube/

## 作業開始時の確認事項

1. 上記「正本ドキュメント」を必ずRead
2. 「絶対NG」リストに該当する表現を排除
3. 必須キーワードを最低1つ含める
4. 台本生成後はCodex検証を必須実行
