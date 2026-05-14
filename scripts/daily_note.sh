#!/bin/bash
# daily_note.sh — Obsidian デイリーノート自動生成
# 実行タイミング: launchd 毎朝 07:00

VAULT="/Users/ims/Documents/Brain"
DAILY_DIR="$VAULT/Daily"
LOG="/Users/ims/Claude-Lab/logs/daily_note.log"

TODAY=$(date '+%y-%m-%d')
YESTERDAY=$(date -v-1d '+%y-%m-%d')
TODAY_FILE="$DAILY_DIR/$TODAY.md"
YESTERDAY_FILE="$DAILY_DIR/$YESTERDAY.md"

echo "========================================" >> "$LOG"
echo "実行日時: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG"

# Daily フォルダ作成（初回のみ）
mkdir -p "$DAILY_DIR"

# 既に今日のノートがあればスキップ
if [ -f "$TODAY_FILE" ]; then
    echo "スキップ: 本日のノートは既に存在します" >> "$LOG"
    open -a Obsidian "$TODAY_FILE"
    exit 0
fi

# 前日の未完了タスクを抽出
if [ -f "$YESTERDAY_FILE" ]; then
    CARRY_OVER=$(grep '^- \[ \]' "$YESTERDAY_FILE")
    COUNT=$(echo "$CARRY_OVER" | grep -c '^- \[ \]' || echo 0)
    if [ -z "$CARRY_OVER" ]; then
        CARRY_OVER="（引き継ぎタスクなし）"
        COUNT=0
    fi
    echo "前日ノート発見: 未完了タスク ${COUNT}件を引き継ぎ" >> "$LOG"
else
    CARRY_OVER="（前日のノートなし）"
    echo "前日ノートなし: $YESTERDAY_FILE" >> "$LOG"
fi

# ノートを生成
{
    echo "# $TODAY デイリー"
    echo ""
    echo "## 🔄 前日からの引き継ぎ"
    echo "$CARRY_OVER"
    echo ""
    echo "## ✅ 今日のタスク"
    echo "- [ ] "
    echo "- [ ] "
    echo "- [ ] "
    echo ""
    echo "## 📝 今日のメモ・気づき"
    echo ""
    echo ""
    echo "## 🔁 振り返り"
    echo ""
    echo "### できたこと"
    echo ""
    echo ""
    echo "### 明日に持ち越すこと"
    echo ""
} > "$TODAY_FILE"

echo "作成完了: $TODAY_FILE" >> "$LOG"

# Obsidian で開く
open -a Obsidian "$TODAY_FILE"
echo "Obsidianで開きました" >> "$LOG"
