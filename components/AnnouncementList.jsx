"use client";

// 公告列表：点标题展开正文并标记已读。
import { useState } from "react";

function formatTime(iso) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AnnouncementList({ announcements, onMarkRead }) {
  const [openId, setOpenId] = useState(null);

  if (announcements.length === 0) {
    return <p className="messages-empty">还没有公告。</p>;
  }

  function toggle(item) {
    const next = openId === item.id ? null : item.id;
    setOpenId(next);
    if (next !== null && !item.read) onMarkRead(item.id);
  }

  return (
    <ul className="announcement-list">
      {announcements.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="announcement-item"
            onClick={() => toggle(item)}
          >
            <span className="announcement-top">
              <span className="announcement-title">
                {!item.read && <span className="announcement-dot" />}
                {item.title}
              </span>
              <span className="announcement-time">{formatTime(item.created_at)}</span>
            </span>
            {openId === item.id && (
              <span className="announcement-body">{item.body}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
