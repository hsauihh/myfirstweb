"use client";

// 聊天面板的额度 / VIP 提示（普通对话与知识库共用）。
import Link from "next/link";

const SCOPE_LABELS = {
  anonymous: "匿名",
  daily: "今日",
  rag_daily: "知识库",
};

function formatExpiry(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function ChatQuotaHint({ user, quota, useRag, onOpenVip }) {
  if (user?.vip) {
    return (
      <span
        className="vip-badge"
        title={`到期 ${formatExpiry(user.vip_expires_at)}`}
      >
        👑 至尊无敌黄金VIP
      </span>
    );
  }

  if (useRag && !user) {
    return <span className="chat-quota">登录后使用知识库</span>;
  }

  const label = SCOPE_LABELS[quota?.scope] || "今日";
  const exhausted = quota ? quota.remaining === 0 : false;

  return (
    <>
      {quota && (
        <span className="chat-quota">
          {label}剩余 {quota.remaining}/{quota.limit} 句
        </span>
      )}
      {user ? (
        <button type="button" className="vip-link" onClick={onOpenVip}>
          开通 VIP
        </button>
      ) : (
        exhausted && (
          <Link href="/login" className="chat-quota-link">
            登录 / 注册
          </Link>
        )
      )}
    </>
  );
}
