"""
YouTube Data API v3 動画情報ツール

使い方:
  python3 youtube_videos.py video   <VIDEO_ID> [VIDEO_ID ...]  # 動画詳細
  python3 youtube_videos.py search  <キーワード> [--max N]     # キーワード検索
  python3 youtube_videos.py list    [--channel CHANNEL_ID]     # チャンネル内動画一覧
                                    [--max N]
"""

import argparse
import pathlib
import sys
from datetime import datetime, timezone

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

BASE_DIR = pathlib.Path(__file__).parent
TOKEN_PATH = BASE_DIR / "token.json"
SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"]


# ── 認証 ─────────────────────────────────────────────────────────────────────

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


# ── ユーティリティ ────────────────────────────────────────────────────────────

def _fmt(n: int | str | None) -> str:
    if n is None:
        return "N/A"
    try:
        return f"{int(n):,}"
    except (ValueError, TypeError):
        return str(n)


def _parse_iso(dt_str: str | None) -> str:
    if not dt_str:
        return "N/A"
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.astimezone().strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return dt_str


def _sep(width: int = 56) -> None:
    print("─" * width)


def _video_url(video_id: str) -> str:
    return f"https://youtu.be/{video_id}"


# ── 動画詳細取得 ──────────────────────────────────────────────────────────────

def cmd_video(youtube, video_ids: list[str]) -> None:
    print(f"🎬 動画詳細を取得中 ({len(video_ids)} 件)...\n")

    response = youtube.videos().list(
        part="snippet,statistics,contentDetails,status",
        id=",".join(video_ids),
    ).execute()

    items = response.get("items", [])
    if not items:
        print("⚠️  動画が見つかりませんでした。")
        return

    for i, item in enumerate(items, 1):
        s = item["snippet"]
        st = item.get("statistics", {})
        cd = item.get("contentDetails", {})
        status = item.get("status", {})

        print(f"【{i}】{s['title']}")
        _sep()
        print(f"  動画ID       : {item['id']}")
        print(f"  URL          : {_video_url(item['id'])}")
        print(f"  チャンネル   : {s.get('channelTitle', 'N/A')}")
        print(f"  公開日時     : {_parse_iso(s.get('publishedAt'))}")
        print(f"  再生時間     : {cd.get('duration', 'N/A')}")
        print(f"  公開状態     : {status.get('privacyStatus', 'N/A')}")
        print(f"  再生回数     : {_fmt(st.get('viewCount'))} 回")
        print(f"  高評価数     : {_fmt(st.get('likeCount'))} 件")
        print(f"  コメント数   : {_fmt(st.get('commentCount'))} 件")
        tags = s.get("tags", [])
        if tags:
            print(f"  タグ         : {', '.join(tags[:8])}{'…' if len(tags) > 8 else ''}")
        desc = s.get("description", "").replace("\n", " ")
        if desc:
            print(f"  説明（抜粋） : {desc[:100]}{'…' if len(desc) > 100 else ''}")
        _sep()
        print()


# ── キーワード検索 ────────────────────────────────────────────────────────────

def cmd_search(youtube, query: str, max_results: int) -> None:
    print(f"🔍 「{query}」で検索中 (最大 {max_results} 件)...\n")

    response = youtube.search().list(
        part="snippet",
        q=query,
        type="video",
        maxResults=max_results,
        order="relevance",
    ).execute()

    items = response.get("items", [])
    if not items:
        print("⚠️  検索結果が見つかりませんでした。")
        return

    total = response.get("pageInfo", {}).get("totalResults", "?")
    print(f"検索結果: 約 {_fmt(total)} 件中 {len(items)} 件を表示\n")
    _sep()

    video_ids = [item["id"]["videoId"] for item in items]

    stats_resp = youtube.videos().list(
        part="statistics,contentDetails",
        id=",".join(video_ids),
    ).execute()
    stats_map = {v["id"]: v for v in stats_resp.get("items", [])}

    for i, item in enumerate(items, 1):
        s = item["snippet"]
        video_id = item["id"]["videoId"]
        st = stats_map.get(video_id, {}).get("statistics", {})
        cd = stats_map.get(video_id, {}).get("contentDetails", {})

        print(f"[{i:02d}] {s['title']}")
        print(f"      チャンネル : {s.get('channelTitle', 'N/A')}")
        print(f"      公開日     : {_parse_iso(s.get('publishedAt'))}")
        print(f"      再生時間   : {cd.get('duration', 'N/A')}")
        print(f"      再生回数   : {_fmt(st.get('viewCount'))} 回  "
              f"高評価: {_fmt(st.get('likeCount'))} 件")
        print(f"      URL        : {_video_url(video_id)}")
        _sep()

    print()


# ── チャンネル内動画一覧 ──────────────────────────────────────────────────────

def _get_my_channel_id(youtube) -> str:
    resp = youtube.channels().list(part="id", mine=True).execute()
    items = resp.get("items", [])
    if not items:
        print("❌ チャンネルが見つかりません。")
        sys.exit(1)
    return items[0]["id"]


def _get_uploads_playlist_id(youtube, channel_id: str) -> str:
    resp = youtube.channels().list(
        part="contentDetails",
        id=channel_id,
    ).execute()
    items = resp.get("items", [])
    if not items:
        print(f"❌ チャンネル {channel_id} が見つかりません。")
        sys.exit(1)
    return items[0]["contentDetails"]["relatedPlaylists"]["uploads"]


def cmd_list(youtube, channel_id: str | None, max_results: int) -> None:
    if channel_id is None:
        channel_id = _get_my_channel_id(youtube)
        print(f"📋 自分のチャンネル動画一覧を取得中 (最大 {max_results} 件)...\n")
    else:
        print(f"📋 チャンネル {channel_id} の動画一覧を取得中 (最大 {max_results} 件)...\n")

    uploads_playlist_id = _get_uploads_playlist_id(youtube, channel_id)

    playlist_items = []
    next_page_token = None

    while len(playlist_items) < max_results:
        fetch_count = min(50, max_results - len(playlist_items))
        resp = youtube.playlistItems().list(
            part="snippet,contentDetails",
            playlistId=uploads_playlist_id,
            maxResults=fetch_count,
            pageToken=next_page_token,
        ).execute()

        playlist_items.extend(resp.get("items", []))
        next_page_token = resp.get("nextPageToken")
        if not next_page_token:
            break

    if not playlist_items:
        print("⚠️  動画が見つかりませんでした。")
        return

    video_ids = [item["contentDetails"]["videoId"] for item in playlist_items]

    stats_resp = youtube.videos().list(
        part="statistics,contentDetails",
        id=",".join(video_ids),
    ).execute()
    stats_map = {v["id"]: v for v in stats_resp.get("items", [])}

    print(f"取得件数: {len(playlist_items)} 件\n")
    _sep()

    for i, item in enumerate(playlist_items, 1):
        s = item["snippet"]
        video_id = item["contentDetails"]["videoId"]
        st = stats_map.get(video_id, {}).get("statistics", {})
        cd = stats_map.get(video_id, {}).get("contentDetails", {})

        print(f"[{i:02d}] {s['title']}")
        print(f"      公開日     : {_parse_iso(s.get('publishedAt'))}")
        print(f"      再生時間   : {cd.get('duration', 'N/A')}")
        print(f"      再生回数   : {_fmt(st.get('viewCount'))} 回  "
              f"高評価: {_fmt(st.get('likeCount'))} 件  "
              f"コメント: {_fmt(st.get('commentCount'))} 件")
        print(f"      URL        : {_video_url(video_id)}")
        _sep()

    print()


# ── CLI エントリポイント ──────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="YouTube Data API v3 動画情報ツール",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  python3 youtube_videos.py video dQw4w9WgXcQ
  python3 youtube_videos.py search "Python チュートリアル" --max 5
  python3 youtube_videos.py list --max 20
  python3 youtube_videos.py list --channel UCxxxxxx --max 10
        """,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # video サブコマンド
    p_video = sub.add_parser("video", help="動画IDで詳細情報を取得")
    p_video.add_argument("video_ids", nargs="+", metavar="VIDEO_ID")

    # search サブコマンド
    p_search = sub.add_parser("search", help="キーワードで動画を検索")
    p_search.add_argument("query", help="検索キーワード")
    p_search.add_argument("--max", type=int, default=10, metavar="N",
                          help="最大取得件数 (デフォルト: 10, 上限: 50)")

    # list サブコマンド
    p_list = sub.add_parser("list", help="チャンネル内の動画一覧を取得")
    p_list.add_argument("--channel", metavar="CHANNEL_ID", default=None,
                        help="対象チャンネルID（省略時は自分のチャンネル）")
    p_list.add_argument("--max", type=int, default=20, metavar="N",
                        help="最大取得件数 (デフォルト: 20)")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    creds = load_credentials()
    youtube = build("youtube", "v3", credentials=creds)

    try:
        if args.command == "video":
            cmd_video(youtube, args.video_ids)
        elif args.command == "search":
            max_results = min(max(1, args.max), 50)
            cmd_search(youtube, args.query, max_results)
        elif args.command == "list":
            max_results = min(max(1, args.max), 200)
            cmd_list(youtube, args.channel, max_results)
    except HttpError as e:
        print(f"❌ API エラー: {e.status_code} - {e.reason}")
        sys.exit(1)


if __name__ == "__main__":
    main()
