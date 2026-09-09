"use client";

// 导航栏登录态：未登录显示「登录」；已登录显示头像卡片（悬停显示用户名），点击弹出添加好友。
// VIP 用户头像右上角显示金色「VIP」小字（可在设置中关闭）。
import Link from "next/link";
import Avatar from "./Avatar.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useMessages } from "./MessagesContext.jsx";

export default function NavAuth({ children }) {
  const { user, loading, logout } = useAuth();
  const { openAddFriend, vipBadgeEnabled } = useMessages();

  if (loading) return null;

  if (!user) {
    return (
      <Link href="/login" className="btn btn-outline">
        登录
      </Link>
    );
  }

  return (
    <div className="nav-user">
      <button
        type="button"
        className="user-card"
        data-name={user.username}
        aria-label={`${user.username}，添加好友`}
        title="添加好友"
        onClick={() => openAddFriend()}
      >
        <Avatar name={user.username} src={user.avatar} size={30} />
        {user.vip && vipBadgeEnabled && <span className="vip-tag">VIP</span>}
      </button>
      {children}
      <button type="button" className="ghost-button" onClick={logout}>
        退出
      </button>
    </div>
  );
}
