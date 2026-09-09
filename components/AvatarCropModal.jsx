"use client";

// 头像裁剪弹窗：拖拽 + 缩放，确认后输出裁剪后的 Blob。
import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import cropImage from "./cropImage.js";

export default function AvatarCropModal({ src, busy, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  const [error, setError] = useState("");

  const handleCropComplete = useCallback((_, pixels) => setArea(pixels), []);

  async function confirm() {
    if (!area) return;
    setError("");
    try {
      await onConfirm(await cropImage(src, area));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="modal-panel crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <p className="section-kicker">更换头像</p>
            <h3>裁剪头像</h3>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            disabled={busy}
          >
            取消
          </button>
        </div>

        <div className="crop-stage">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          aria-label="缩放"
          className="crop-zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
        />

        {error && <p className="lab-error">{error}</p>}

        <div className="crop-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={onCancel}
            disabled={busy}
          >
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={confirm}
            disabled={busy || !area}
          >
            {busy ? "上传中…" : "确定"}
          </button>
        </div>
      </div>
    </div>
  );
}
