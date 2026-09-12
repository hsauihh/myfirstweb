"use client";

// 问答页的「记一笔」弹窗：不离开对话就能把一句话塞进知识库。
import { useEffect, useState } from "react";
import { errorMessage } from "./apiError";
import * as kbApi from "./kbApi";

const MAX_LENGTH = kbApi.NOTE_MAX_LENGTH;

interface NoteCaptureModalProps {
  open: boolean;
  onClose: () => void;
  /** 保存成功后通知外层（刷新笔记列表与知识库计数）。 */
  onSaved?: () => void;
}

export default function NoteCaptureModal({
  open,
  onClose,
  onSaved,
}: NoteCaptureModalProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 关闭时清空，避免下次打开看到上次的内容或报错
  useEffect(() => {
    if (!open) {
      setText("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  async function save() {
    const content = text.trim();
    if (!content || saving) return;
    setSaving(true);
    setError("");
    try {
      await kbApi.addNote(content);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel note-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="section-kicker">随心一记</p>
            <h3>记一笔</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="note-modal__hint">
          存进知识库后，直接问 AI 就能查到（比如「我的钥匙放哪了」）。
        </p>
        <textarea
          className="note-modal__input"
          rows={3}
          maxLength={MAX_LENGTH}
          autoFocus
          placeholder="比如：钥匙放在玄关柜第二层"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
        />
        <div className="note-modal__bar">
          <span className="lab-count">
            {text.length}/{MAX_LENGTH}
          </span>
          <button
            type="button"
            className="primary-button"
            disabled={saving || !text.trim()}
            onClick={() => void save()}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
        {error && <p className="lab-error">{error}</p>}
      </div>
    </div>
  );
}
