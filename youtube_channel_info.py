"""
YouTube Data API v3 チャンネル情報取得スクリプト
token.json が存在する前提で動作する（認証済みのみ）。
事前に youtube_auth.py を実行して token.json を生成してください。
"""

import pathlib
import sys

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

BASE_DIR = pathlib.Path(__file__).parent
TOKEN_PATH = BASE_DIR / "token.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
]


def load_credentials() -> Credentials:
    if not TOKEN_PATH.exists():
        print(f"❌ token.json が見つかりません: {TOKEN_PATH}")
        print("   先に youtube_auth.py を実行してください。")
        sys.exit(1)

    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if creds.expired and creds.refresh_token:
        print("🔄 トークンを自動更新中...")
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json())
        TOKEN_PATH.chmod(0o600)
        print("✅ トークン更新完了\n")

    if not creds.valid:
        print("❌ トークンが無効です。youtube_auth.py を再実行してください。")
        sys.exit(1)

    return creds


def fetch_channel_info(creds: Credentials) -> dict:
    youtube = build("youtube", "v3", credentials=creds)

    response = youtube.channels().list(
        part="snippet,statistics",
        mine=True,
    ).execute()

    items = response.get("items", [])
    if not items:
        print("⚠️  チャンネルが見つかりません。")
        sys.exit(1)

    ch = items[0]
    snippet = ch["snippet"]
    stats = ch.get("statistics", {})

    return {
        "id":          ch["id"],
        "name":        snippet["title"],
        "description": snippet.get("description", ""),
        "subscribers": int(stats.get("subscriberCount", 0)),
        "views":       int(stats.get("viewCount", 0)),
        "videos":      int(stats.get("videoCount", 0)),
        "hidden_subscribers": stats.get("hiddenSubscriberCount", False),
    }


def display(info: dict) -> None:
    subscribers = (
        "非公開"
        if info["hidden_subscribers"]
        else f"{info['subscribers']:,} 人"
    )
    desc_preview = info["description"][:80].replace("\n", " ")
    if len(info["description"]) > 80:
        desc_preview += "…"

    print("╔══════════════════════════════════════════════════╗")
    print("║         YouTube チャンネル情報                   ║")
    print("╠══════════════════════════════════════════════════╣")
    print(f"║  チャンネル名   : {info['name']}")
    print(f"║  チャンネルID   : {info['id']}")
    print(f"║  登録者数       : {subscribers}")
    print(f"║  総再生回数     : {info['views']:,} 回")
    print(f"║  動画本数       : {info['videos']:,} 本")
    if desc_preview:
        print(f"║  説明（抜粋）   : {desc_preview}")
    print("╚══════════════════════════════════════════════════╝")


if __name__ == "__main__":
    print("📡 YouTube Data API v3 でチャンネル情報を取得中...\n")
    creds = load_credentials()
    info = fetch_channel_info(creds)
    display(info)
