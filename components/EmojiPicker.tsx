"use client";

// 本地表情面板：点选即插入，点击外部关闭。
import { useEffect, useRef, useState } from "react";

const EMOJIS = [
  "😀", "😄", "😁", "😊", "🙂", "😉", "😍", "😘",
  "😜", "🤔", "😐", "😴", "😭", "😅", "😳", "🙃",
  "👍", "👏", "🙏", "🤝", "💪", "🎉", "✨", "🔥",
  "❤️", "💔", "😂", "🤣", "😎", "🤗", "😇", "🙌",
  "🌱", "🌈", "☕", "🍜", "🎵", "📚", "💡", "⭐",
];

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="emoji-picker" ref={ref}>
      <button
        type="button"
        className="ghost-button"
        aria-label="插入表情"
        onClick={() => setOpen((value) => !value)}
      >
        😊
      </button>
      {open && (
        <div className="emoji-panel">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="emoji-item"
              onClick={() => onPick(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
