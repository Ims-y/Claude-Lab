"""
YouTube Data API v3 OAuth 2.0 認証スクリプト
実行すると token.json が生成される。以降は token.json で自動認証。

使い方:
  python3 youtube_auth.py

生成物:
  token.json  ← アクセストークン + リフレッシュトークン（gitignoreに追加済み）
"""

import glob
import json
import os
import pathlib

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ─── 定数 ─────────────────────────────────────────────────────────────────────

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",   # チャンネル情報の読み取り
    "https://www.googleapis.com/auth/youtube",             # 動画管理（タイトル・説明欄の更新）
    "https://www.googleapis.com/auth/youtube.upload",      # 動画アップロード
    "https://www.googleapis.com/auth/yt-analytics.readonly",  # アナリティクス読み取り
]

BASE_DIR = pathlib.Path(__file__).parent
TOKEN_PATH = BASE_DIR / "token.json"

# ─── クライアントシークレットを自動検出 ──────────────────────────────────────

def _find_client_secret() -> pathlib.Path:
    pattern = str(BASE_DIR / "client_secret_*.json")
    matches = glob.glob(pattern)
    if not matches:
        raise FileNotFoundError(
            "client_secret_*.json が見つかりません。\n"
            "Google Cloud Console から OAuth 2.0 クライアント ID の JSON をダウンロードして\n"
            f"{BASE_DIR} に配置してください。"
        )
    if len(matches) > 1:
        print(f"⚠️  複数の client_secret_*.json が見つかりました。最初のものを使用します: {matches[0]}")
    return pathlib.Path(matches[0])

# ─── 認証フロー ───────────────────────────────────────────────────────────────

def authenticate() -> Credentials:
    creds: Credentials | None = None

    # 既存の token.json が有効なら再利用
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    # トークンが期限切れ → リフレッシュ
    if creds and creds.expired and creds.refresh_token:
        print("🔄 トークンを更新中...")
        creds.refresh(Request())
        _save_token(creds)
        print("✅ トークン更新完了")
        return creds

    # 新規認証が必要
    if not creds or not creds.valid:
        secret_path = _find_client_secret()
        print(f"📋 クライアントシークレット: {secret_path.name}")
        print()

        flow = InstalledAppFlow.from_client_secrets_file(str(secret_path), SCOPES)

        # コンテナ環境対応：URLを表示してコードを手動で貼り付け
        flow.redirect_uri = "urn:ietf:wg:oauth:2.0:oob"
        auth_url, _ = flow.authorization_url(
            prompt="consent",
            access_type="offline",
        )

        print("=" * 60)
        print("以下の URL をブラウザで開いて Google アカウントで認証してください")
        print("=" * 60)
        print()
        print(auth_url)
        print()
        print("=" * 60)
        code = input("認証後に表示されるコードを貼り付けてください: ").strip()

        flow.fetch_token(code=code)
        creds = flow.credentials

        _save_token(creds)
        print(f"\n✅ token.json を保存しました: {TOKEN_PATH}")

    return creds


def _save_token(creds: Credentials) -> None:
    TOKEN_PATH.write_text(creds.to_json())
    TOKEN_PATH.chmod(0o600)  # 所有者のみ読み書き可


# ─── 動作確認：チャンネル情報を取得 ──────────────────────────────────────────

def verify(creds: Credentials) -> None:
    youtube = build("youtube", "v3", credentials=creds)

    response = youtube.channels().list(
        part="snippet,statistics,contentDetails",
        mine=True,
    ).execute()

    if not response.get("items"):
        print("⚠️  チャンネルが見つかりませんでした（アカウントにチャンネルが存在しない可能性があります）")
        return

    ch = response["items"][0]
    snippet = ch["snippet"]
    stats = ch.get("statistics", {})

    print("\n── チャンネル情報 ───────────────────────────────")
    print(f"  名前         : {snippet['title']}")
    print(f"  チャンネルID : {ch['id']}")
    print(f"  説明         : {snippet.get('description','')[:80]}")
    print(f"  登録者数     : {int(stats.get('subscriberCount', 0)):,} 人")
    print(f"  総再生回数   : {int(stats.get('viewCount', 0)):,} 回")
    print(f"  動画本数     : {int(stats.get('videoCount', 0)):,} 本")
    print("────────────────────────────────────────────────")


# ─── エントリポイント ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🔐 YouTube Data API v3 OAuth 認証を開始します")
    print(f"   スコープ: {len(SCOPES)} 個")
    for s in SCOPES:
        print(f"   • {s.split('/')[-1]}")
    print()

    creds = authenticate()
    verify(creds)
