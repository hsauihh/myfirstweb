"""头像文件：校验图片类型/大小并落盘。"""
import secrets
from pathlib import Path

from fastapi import UploadFile

AVATAR_DIR = Path("avatars")
MAX_BYTES = 2 * 1024 * 1024
ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
SIGNATURES = {
    "jpg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "webp": lambda data: len(data) >= 12
    and data[:4] == b"RIFF"
    and data[8:12] == b"WEBP",
}


class AvatarError(Exception):
    """头像文件不合法。"""


def ensure_dir() -> None:
    AVATAR_DIR.mkdir(exist_ok=True)


async def save_avatar(user_id: int, upload: UploadFile) -> str:
    """校验并保存头像，返回可访问的相对路径（/avatars/xxx.png）。"""
    extension = ALLOWED_TYPES.get(upload.content_type or "")
    if extension is None:
        raise AvatarError("只支持 jpg / png / webp 图片")

    data = await upload.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise AvatarError("图片不能超过 2MB")
    if not SIGNATURES[extension](data):
        raise AvatarError("图片内容与格式不符")

    ensure_dir()
    filename = f"{user_id}-{secrets.token_hex(8)}.{extension}"
    (AVATAR_DIR / filename).write_bytes(data)
    return f"/avatars/{filename}"


def remove_avatar(path: str | None) -> None:
    """删除旧头像文件；路径不合法或文件不存在时忽略。"""
    if not path:
        return
    name = Path(path).name
    if not name:
        return
    target = AVATAR_DIR / name
    if target.is_file():
        target.unlink()
