#!/bin/bash
set -e

ENV_FILE="$HOME/.config/mcp-secrets/mcp-keys.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "エラー：$ENV_FILE が見つかりません"
  echo "MacBookで手動作成が必要です："
  echo "  mkdir -p ~/.config/mcp-secrets"
  echo "  nano ~/.config/mcp-secrets/mcp-keys.env"
  exit 1
fi

source "$ENV_FILE"
echo "MCPをインストール中..."

claude mcp add -s user brave-search \
  -e BRAVE_API_KEY=$BRAVE_API_KEY \
  -- npx -y @modelcontextprotocol/server-brave-search

claude mcp add -s user firecrawl \
  -e FIRECRAWL_API_KEY=$FIRECRAWL_API_KEY \
  -- npx -y firecrawl-mcp

claude mcp add -s user memory \
  -- npx -y @modelcontextprotocol/server-memory

# yt-analysisのビルド（nodeユーザー所有ディレクトリ）
YT_DIR="/home/node/yt-analysis-mcp"
if [ ! -f "$YT_DIR/dist/index.js" ]; then
  git clone https://github.com/Legorobotdude/yt-analysis-mcp.git "$YT_DIR"
  cd "$YT_DIR" && pnpm install && pnpm build
fi

claude mcp add -s user yt-analysis \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -- node "$YT_DIR/dist/index.js"

# gitleaksインストール（シークレットスキャン用）
echo "gitleaksをインストール中..."
curl -sSfL https://raw.githubusercontent.com/gitleaks/gitleaks/main/scripts/install.sh | sh -s -- -b ~/.local/bin
echo "✅ gitleaksインストール完了"

echo "✅ MCP設置完了"
claude mcp list
