"use client";

// 导航栏用户区：桌面为「头像 + 下拉菜单」，窄屏为汉堡菜单里的整行列表。
// 未登录显示「登录」。消息未读数在提醒开启时展示（桌面为头像红点 + 菜单数字）。
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useMessages } from "./MessagesContext.jsx";

function rowClass(variant) {
  return variant === "mobile" ? "nav-user-row" : "user-panel-link";
}

export default function NavUser({ variant = "desktop", onNavigate }) {
  const { user, loading, logout } = useAuth();
  const { openAddFriend, vipBadgeEnabled, reminderEnabled, totalUnread } = useMessages();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // 点击外部 / 按 Escape 关闭下拉
  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading) return null;

  const unread = reminderEnabled && totalUnread > 0 ? totalUnread : 0;

  function close() {
    setOpen(false);
    if (onNavigate) onNavigate();
  }

  async function onLogout() {
    close();
    await logout();
  }

  function onAddFriend() {
    close();
    openAddFriend();
  }

  if (!user) {
    if (variant === "mobile") {
      return (
        <div className="nav-user-mobile">
          <Link href="/login" className="nav-user-row" onClick={close}>
            登录 / 注册
          </Link>
        </div>
      );
    }
    return (
      <Link href="/login" className="btn btn-outline" onClick={close}>
        登录
      </Link>
    );
  }

  const itemProps = variant === "desktop" ? { role: "menuitem" } : {};

  const items = (
    <>
      <Link href="/messages" className={rowClass(variant)} onClick={close} {...itemProps}>
        <span>消息</span>
        {unread > 0 && (
          <span className="nav-badge">{unread > 99 ? "99+" : unread}</span>
        )}
      </Link>
      <Link
        href="/messages?section=settings"
        className={rowClass(variant)}
        onClick={close}
        {...itemProps}
      >
        个人资料
      </Link>
      <button type="button" className={rowClass(variant)} onClick={onAddFriend} {...itemProps}>
        添加好友
      </button>
      <button type="button" className={rowClass(variant)} onClick={onLogout} {...itemProps}>
        退出
      </button>
    </>
  );

  if (variant === "mobile") {
    return (
      <div className="nav-user-mobile">
        <p className="nav-user-name">{user.username}</p>
        {items}
      </div>
    );
  }

  return (
    <div className="nav-user" ref={ref}>
      <button
        type="button"
        className="user-card"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.username}，账号菜单`}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={user.username} src={user.avatar} size={30} />
        {user.vip && vipBadgeEnabled && <span className="vip-tag">VIP</span>}
        {unread > 0 && <span className="user-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="user-panel" role="menu" aria-label="账号菜单">
          <p className="user-panel-name">{user.username}</p>
          {items}
        </div>
      )}
    </div>
  );
}
