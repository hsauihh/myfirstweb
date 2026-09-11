"use client";

// 消息中心左侧导航：上方「我的消息」「系统通知」，底部「消息设置」。
const TOP_SECTIONS = [
  { id: "chats", label: "我的消息", badge: "chats" },
  { id: "notifications", label: "系统通知", badge: "notifications" },
] as const;

export type MessageSection = "chats" | "notifications" | "settings";

interface MessagesRailProps {
  section: MessageSection;
  onSelect: (section: MessageSection) => void;
  chatUnread: number;
  notificationCount: number;
}

export default function MessagesRail({
  section,
  onSelect,
  chatUnread,
  notificationCount,
}: MessagesRailProps) {
  const badges: Record<(typeof TOP_SECTIONS)[number]["badge"], number> = {
    chats: chatUnread,
    notifications: notificationCount,
  };

  function renderItem(item: (typeof TOP_SECTIONS)[number]) {
    const count = badges[item.badge];
    return (
      <button
        key={item.id}
        type="button"
        className={"rail-item" + (section === item.id ? " is-active" : "")}
        onClick={() => onSelect(item.id)}
      >
        <span className="rail-label">{item.label}</span>
        {count > 0 && <span className="rail-badge">{count > 99 ? "99+" : count}</span>}
      </button>
    );
  }

  return (
    <nav className="messages-rail" aria-label="消息中心导航">
      <div className="messages-rail-top">{TOP_SECTIONS.map(renderItem)}</div>
      <button
        type="button"
        className={"rail-item" + (section === "settings" ? " is-active" : "")}
        onClick={() => onSelect("settings")}
      >
        <span className="rail-label">设置</span>
      </button>
    </nav>
  );
}
