"""
YouTube Data API v3 動画アップロードスクリプト

使い方:
  python3 youtube_upload.py <動画ファイル> [オプション]

例:
  python3 youtube_upload.py video.mp4 --title "タイトル"
  python3 youtube_upload.py video.mp4 --title "タイトル" --description "説明文" \\
      --tags "タグ1,タグ2" --privacy unlisted
"""

import argparse
import http.client
import pathlib
import random
import sys
import time

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

BASE_DIR = pathlib.Path(__file__).parent
TOKEN_PATH = BASE_DIR / "token.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]

# アップロード再試行対象の HTTP ステータスコード
RETRIABLE_STATUS_CODES = {500, 502, 503, 504}
RETRIABLE_EXCEPTIONS = (http.client.NotConnected, http.client.IncompleteRead,
                        http.client.ImproperConnectionState,
                        http.client.CannotSendRequest, http.client.CannotSendHeader,
                        http.client.ResponseNotReady, http.client.BadStatusLine,
                        ConnectionResetError, TimeoutError)

MAX_RETRIES = 10
CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB

# YouTube カテゴリID（主要なもの）
CATEGORIES = {
    "1":  "映画とアニメ",
    "2":  "自動車と乗り物",
    "10": "音楽",
    "15": "ペットと動物",
    "17": "スポーツ",
    "20": "ゲーム",
    "22": "ブログ",
    "23": "コメディー",
    "24": "エンターテインメント",
    "25": "ニュースと政治",
    "26": "ハウツーとスタイル",
    "27": "教育",
    "28": "科学と技術",
    "29": "非営利団体と社会活動",
}


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


# ── 進捗バー ──────────────────────────────────────────────────────────────────

def _progress_bar(done: int, total: int, width: int = 40) -> str:
    pct = done / total if total > 0 else 0
    filled = int(width * pct)
    bar = "█" * filled + "░" * (width - filled)
    mb_done = done / 1024 / 1024
    mb_total = total / 1024 / 1024
    return f"\r[{bar}] {pct*100:5.1f}%  {mb_done:.1f}/{mb_total:.1f} MB"


# ── アップロード ──────────────────────────────────────────────────────────────

def upload_video(
    youtube,
    file_path: pathlib.Path,
    title: str,
    description: str,
    tags: list[str],
    privacy: str,
    category_id: str,
    made_for_kids: bool,
) -> str:
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": category_id,
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": made_for_kids,
        },
    }

    media = MediaFileUpload(
        str(file_path),
        chunksize=CHUNK_SIZE,
        resumable=True,
    )

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    file_size = file_path.stat().st_size
    print(f"📤 アップロード開始: {file_path.name}  ({file_size / 1024 / 1024:.1f} MB)")
    print()

    response = None
    retry = 0

    while response is None:
        try:
            status, response = request.next_chunk()

            if status:
                done = status.resumable_progress
                print(_progress_bar(done, file_size), end="", flush=True)

        except HttpError as e:
            if e.status_code in RETRIABLE_STATUS_CODES:
                retry = _wait_and_retry(retry, f"HTTP {e.status_code}")
            else:
                raise

        except RETRIABLE_EXCEPTIONS as e:
            retry = _wait_and_retry(retry, str(e))

    print(_progress_bar(file_size, file_size))
    print()

    return response["id"]


def _wait_and_retry(retry: int, reason: str) -> int:
    retry += 1
    if retry > MAX_RETRIES:
        print(f"\n❌ 最大リトライ回数 ({MAX_RETRIES}) を超えました。")
        sys.exit(1)
    wait = (2 ** retry) + random.random()
    print(f"\n⚠️  一時的なエラー ({reason})。{wait:.1f} 秒後にリトライ ({retry}/{MAX_RETRIES})...")
    time.sleep(wait)
    return retry


# ── サムネイル設定 ────────────────────────────────────────────────────────────

def set_thumbnail(youtube, video_id: str, thumbnail_path: pathlib.Path) -> None:
    media = MediaFileUpload(str(thumbnail_path), resumable=False)
    youtube.thumbnails().set(
        videoId=video_id,
        media_body=media,
    ).execute()
    print(f"🖼️  サムネイル設定完了: {thumbnail_path.name}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    category_help = "カテゴリID (デフォルト: 22=ブログ)\n" + "\n".join(
        f"  {k}: {v}" for k, v in CATEGORIES.items()
    )

    parser = argparse.ArgumentParser(
        description="YouTube Data API v3 動画アップロードツール",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # 最小構成（タイトルのみ）
  python3 youtube_upload.py video.mp4 --title "動画タイトル"

  # フル指定
  python3 youtube_upload.py video.mp4 \\
      --title "動画タイトル" \\
      --description "説明文をここに書く" \\
      --tags "タグ1,タグ2,タグ3" \\
      --privacy unlisted \\
      --category 28 \\
      --thumbnail thumb.jpg
        """,
    )

    parser.add_argument("file", help="アップロードする動画ファイルのパス")
    parser.add_argument("--title", required=True, help="動画タイトル（必須）")
    parser.add_argument("--description", default="", metavar="TEXT",
                        help="動画説明文")
    parser.add_argument("--tags", default="", metavar="TAG1,TAG2,...",
                        help="タグ（カンマ区切り）")
    parser.add_argument("--privacy", choices=["public", "unlisted", "private"],
                        default="private",
                        help="公開設定: public/unlisted/private (デフォルト: private)")
    parser.add_argument("--category", default="22", metavar="ID",
                        help=category_help)
    parser.add_argument("--thumbnail", metavar="FILE",
                        help="サムネイル画像ファイル（JPG/PNG）")
    parser.add_argument("--made-for-kids", action="store_true",
                        help="子ども向けコンテンツとしてマーク")

    return parser


def _validate_args(args) -> tuple[pathlib.Path, pathlib.Path | None]:
    video_path = pathlib.Path(args.file)
    if not video_path.exists():
        print(f"❌ ファイルが見つかりません: {video_path}")
        sys.exit(1)
    if not video_path.is_file():
        print(f"❌ ファイルではありません: {video_path}")
        sys.exit(1)

    thumbnail_path = None
    if args.thumbnail:
        thumbnail_path = pathlib.Path(args.thumbnail)
        if not thumbnail_path.exists():
            print(f"❌ サムネイルが見つかりません: {thumbnail_path}")
            sys.exit(1)
        if thumbnail_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            print("❌ サムネイルは JPG または PNG を指定してください。")
            sys.exit(1)

    if args.category not in CATEGORIES:
        print(f"⚠️  未定義のカテゴリID '{args.category}'。そのまま使用します。")

    return video_path, thumbnail_path


def _confirm(args, video_path: pathlib.Path, tags: list[str]) -> None:
    privacy_label = {"public": "公開", "unlisted": "限定公開", "private": "非公開"}
    category_label = CATEGORIES.get(args.category, args.category)

    print("=" * 56)
    print("  アップロード内容の確認")
    print("=" * 56)
    print(f"  ファイル     : {video_path.name}")
    print(f"  サイズ       : {video_path.stat().st_size / 1024 / 1024:.1f} MB")
    print(f"  タイトル     : {args.title}")
    print(f"  説明文       : {args.description[:60]}{'…' if len(args.description) > 60 else ''}")
    print(f"  タグ         : {', '.join(tags) if tags else '（なし）'}")
    print(f"  公開設定     : {privacy_label[args.privacy]}")
    print(f"  カテゴリ     : {category_label} (ID: {args.category})")
    print(f"  子ども向け   : {'はい' if args.made_for_kids else 'いいえ'}")
    print("=" * 56)

    answer = input("\n続行しますか？ [y/N]: ").strip().lower()
    if answer not in {"y", "yes"}:
        print("キャンセルしました。")
        sys.exit(0)
    print()


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    video_path, thumbnail_path = _validate_args(args)
    tags = [t.strip() for t in args.tags.split(",") if t.strip()]

    _confirm(args, video_path, tags)

    creds = load_credentials()
    youtube = build("youtube", "v3", credentials=creds)

    try:
        video_id = upload_video(
            youtube=youtube,
            file_path=video_path,
            title=args.title,
            description=args.description,
            tags=tags,
            privacy=args.privacy,
            category_id=args.category,
            made_for_kids=args.made_for_kids,
        )

        if thumbnail_path:
            set_thumbnail(youtube, video_id, thumbnail_path)

        privacy_label = {"public": "公開", "unlisted": "限定公開", "private": "非公開"}
        print("✅ アップロード完了！")
        print(f"   動画ID   : {video_id}")
        print(f"   URL      : https://youtu.be/{video_id}")
        print(f"   管理画面 : https://studio.youtube.com/video/{video_id}/edit")
        print(f"   公開設定 : {privacy_label[args.privacy]}")

    except HttpError as e:
        print(f"\n❌ API エラー: {e.status_code} - {e.reason}")
        sys.exit(1)


if __name__ == "__main__":
    main()
