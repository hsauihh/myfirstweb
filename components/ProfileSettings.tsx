"use client";

// 个人资料：选图后先裁剪（输出 256×256）再上传。
import { useRef, useState, type ChangeEvent } from "react";
import { errorMessage } from "./apiError";
import Avatar from "./Avatar";
import AvatarCropModal from "./AvatarCropModal";
import { useAuth } from "./AuthContext";

const MAX_SOURCE_MB = 10;

export default function ProfileSettings() {
  const { user, uploadAvatar } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [imageSrc, setImageSrc] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_SOURCE_MB * 1024 * 1024) {
      setMessage(`图片不能超过 ${MAX_SOURCE_MB}MB`);
      return;
    }
    setMessage("");
    setImageSrc(URL.createObjectURL(file));
  }

  function closeCrop() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc("");
  }

  async function handleConfirm(blob: Blob) {
    setBusy(true);
    setMessage("");
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      await uploadAvatar(file);
      setMessage("头像已更新");
      closeCrop();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // 这个面板只在登录后的消息中心里出现；未登录时后端也拿不到头像
  if (!user) return null;

  return (
    <div className="profile-row">
      <Avatar name={user.username} src={user.avatar} size={64} />
      <div className="profile-info">
        <p className="setting-title">个人资料</p>
        <p className="setting-desc">{user.username}</p>
        <div className="profile-actions">
          <button
            type="button"
            className="ghost-button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            更换头像
          </button>
          <span className="add-friend-hint">jpg / png / webp，选图后可裁剪</span>
        </div>
        {message && <p className="add-friend-hint">{message}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handleFile}
      />
      {imageSrc && (
        <AvatarCropModal
          src={imageSrc}
          busy={busy}
          onCancel={closeCrop}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
