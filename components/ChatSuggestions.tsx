"use client";

// 空对话时的建议问题 chips（DeepSeek 版式：居中欢迎语下面一排可点的例子）。
// 点击只把问题填进输入框，不自动发送。
import type { PromptChip } from "../data/site";

interface ChatSuggestionsProps {
  items: PromptChip[];
  disabled?: boolean;
  onPick: (prompt: string) => void;
}

export default function ChatSuggestions({
  items,
  disabled = false,
  onPick,
}: ChatSuggestionsProps) {
  return (
    <div className="ds-suggestions" role="group" aria-label="建议问题">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="ds-suggestion"
          disabled={disabled}
          onClick={() => onPick(item.prompt)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
