#!/bin/bash
# sort_downloads.sh — Downloads フォルダ自動仕分け
# 実行タイミング: launchd 毎週月曜 08:00

DOWNLOADS="/Users/ims/Downloads"
LOG="/Users/ims/Claude-Lab/logs/sort_downloads.log"

# ログヘッダー
echo "========================================" >> "$LOG"
echo "実行日時: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG"
echo "========================================" >> "$LOG"

# 仕分け関数
move_files() {
    local folder_name="$1"
    local dest_dir="$DOWNLOADS/$1"
    shift
    local moved=0

    # 対象ファイルがあればフォルダ作成
    for ext in "$@"; do
        for f in "$DOWNLOADS"/*."$ext" "$DOWNLOADS"/*."$(echo "$ext" | tr '[:lower:]' '[:upper:]')"; do
            [ -f "$f" ] || continue
            mkdir -p "$dest_dir"
            fname=$(basename "$f")
            mv "$f" "$dest_dir/$fname"
            echo "  移動: $fname → ${folder_name}/" >> "$LOG"
            ((moved++))
        done
    done
    echo "$moved"
}

# 仕分け実行
PDF=$(move_files      "PDF"        pdf)
INST=$(move_files     "Installers" zip dmg pkg)
IMG=$(move_files      "Images"     png jpg jpeg gif webp heic)
VID=$(move_files      "Videos"     mp4 mov m4v)
DOC=$(move_files      "Documents"  md txt csv xlsx docx)

TOTAL=$((PDF + INST + IMG + VID + DOC))

# サマリーログ
echo "" >> "$LOG"
echo "--- サマリー ---" >> "$LOG"
echo "PDF        : ${PDF}件" >> "$LOG"
echo "Installers : ${INST}件" >> "$LOG"
echo "Images     : ${IMG}件" >> "$LOG"
echo "Videos     : ${VID}件" >> "$LOG"
echo "Documents  : ${DOC}件" >> "$LOG"
echo "合計移動   : ${TOTAL}件" >> "$LOG"
echo "" >> "$LOG"
