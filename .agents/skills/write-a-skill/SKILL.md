---
name: write-a-skill
description: Create new agent skills with proper structure, progressive disclosure, and bundled resources. Use when user wants to create, write, or build a new skill.
---

# Writing Skills

## このプロジェクトのルール

- **インストール先**: `.agents/skills/<skill-name>/`
- **言語**: ユーザーへの報告は日本語。スキル本文は英語でよい
- **セキュリティ優先**: スクリプトを含む場合は必ずsecurity-guidanceの危険パターンを避ける
- **外部ライブラリ**: スクリプトが外部パッケージを使う場合はcontext7で最新APIを確認

## Process

1. **Gather requirements** - ask user about:
   - What task/domain does the skill cover?
   - What specific use cases should it handle?
   - Does it need executable scripts or just instructions?
   - Any reference materials to include?

2. **Draft the skill** - create:
   - SKILL.md with concise instructions
   - Additional reference files if content exceeds 100 lines
   - Utility scripts if deterministic operations needed

3. **Review with user（日本語で）** - present draft and ask:
   - このユースケースをカバーできていますか？
   - 不足・不明瞭な点はありますか？
   - 詳細度は適切ですか？

## Skill Structure

```
.agents/skills/skill-name/
├── SKILL.md           # Main instructions (required)
├── REFERENCE.md       # Detailed docs (if needed)
├── EXAMPLES.md        # Usage examples (if needed)
└── scripts/           # Utility scripts (if needed)
    └── helper.js
```

## SKILL.md Template

```md
---
name: skill-name
description: Brief description of capability. Use when [specific triggers].
---

# Skill Name

## Quick start

[Minimal working example]

## Workflows

[Step-by-step processes with checklists for complex tasks]

## Advanced features

[Link to separate files: See [REFERENCE.md](REFERENCE.md)]
```

## Description Requirements

The description is **the only thing your agent sees** when deciding which skill to load.

**Format**:
- Max 1024 chars
- Write in third person
- First sentence: what it does
- Second sentence: "Use when [specific triggers]"

**Good example**:
```
Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when user mentions PDFs, forms, or document extraction.
```

## Workflow Integration（このプロジェクト固有）

新スキルが以下のいずれかと連携する場合、対応するトリガーをdescriptionに明記する：

| 連携先 | descriptionに含めるべき語句の例 |
|---|---|
| Linear | "linear", "task", "issue", "sprint" |
| GitHub | "pr", "pull request", "branch", "commit" |
| feature-dev | "feature", "implement", "新機能" |
| context7 | "library", "docs", "ライブラリ" |
| security-guidance | "security", "セキュリティ" |

## Security Checklist（スクリプト作成時）

スクリプトを含む場合、必ず確認：

- [ ] `child_process.exec()` を使っていない → `execFile()` を使用
- [ ] `eval()` / `new Function()` を使っていない
- [ ] `innerHTML` / `document.write` を使っていない
- [ ] ユーザー入力をシェルコマンドに直接渡していない
- [ ] 外部エンドポイントへの機密データ送信がない

## When to Add Scripts

Add utility scripts when:
- Operation is deterministic (validation, formatting)
- Same code would be generated repeatedly
- Errors need explicit handling

## Review Checklist

After drafting, verify:

- [ ] Description includes triggers ("Use when...")
- [ ] SKILL.md under 100 lines
- [ ] No time-sensitive info
- [ ] Consistent terminology
- [ ] Concrete examples included
- [ ] Security checklist passed (if scripts included)
- [ ] 日本語でユーザーにドラフト提示済み
