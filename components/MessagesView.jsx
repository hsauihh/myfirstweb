"use client";

// 消息中心：左侧导航（我的消息 / 系统通知 / 消息设置）+ 右侧内容。
import Link from "next/link";
import { useEffect, useState } from "react";
import ChatWindow from "./ChatWindow.jsx";
import ConversationList from "./ConversationList.jsx";
import MessagesRail from "./MessagesRail.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import SystemNotifications from "./SystemNotifications.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useMessages } from "./MessagesContext.jsx";

const SECTION_IDS = ["chats", "notifications", "settings"];

export default function MessagesView() {
  const { user, loading } = useAuth();
  const messages = useMessages();
  const { openAddFriend } = messages;
  const [section, setSection] = useState("chats");

  // 邀请链接 /messages?code=XXXX：登录后自动弹出添加好友弹窗
  useEffect(() => {
    if (!user) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) openAddFriend(code);
  }, [user, openAddFriend]);

  // 深链 /messages?section=settings（导航头像菜单的「个人资料」用它直达设置分区）
  useEffect(() => {
    if (!user) return;
    const target = new URLSearchParams(window.location.search).get("section");
    if (SECTION_IDS.includes(target)) setSection(target);
  }, [user]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="messages-guest">
        <p className="section-kicker">消息</p>
        <h1 className="messages-title">登录后添加好友、实时聊天</h1>
        <p className="section-subtitle">用用户名或好友码加好友，消息实时送达。</p>
        <Link href="/login" className="btn btn-primary">
          去登录 / 注册
        </Link>
      </div>
    );
  }

  const activeFriend =
    messages.friends.find((item) => item.id === messages.activeId) || null;

  return (
    <div className="messages-layout">
      <MessagesRail
        section={section}
        onSelect={setSection}
        chatUnread={messages.chatUnread}
        notificationCount={messages.notificationCount}
      />

      <div className="messages-main">
        {messages.error && <p className="lab-error">{messages.error}</p>}

        {section === "chats" && (
          <div className="messages-chats">
            <div className="messages-title-card">我的消息</div>
            <div className="messages-combined">
              <ConversationList
                friends={messages.friends}
                activeId={messages.activeId}
                selfId={user.id}
                onSelect={messages.selectFriend}
              />
              <ChatWindow
                friend={activeFriend}
                selfId={user.id}
                selfName={user.username}
                selfAvatar={user.avatar}
                messages={messages.messages}
                hasMore={messages.hasMore}
                sending={messages.sending}
                onSend={messages.send}
                onLoadOlder={messages.loadOlder}
                onRemove={messages.removeFriend}
              />
            </div>
          </div>
        )}

        {section === "notifications" && (
          <SystemNotifications
            announcements={messages.announcements}
            onMarkRead={messages.markAnnouncementRead}
            requests={messages.requests}
            onAccept={messages.acceptRequest}
            onDelete={messages.deleteRequest}
          />
        )}

        {section === "settings" && (
          <SettingsPanel
            reminderEnabled={messages.reminderEnabled}
            onToggleReminder={messages.setReminderEnabled}
            activeFriend={activeFriend}
            onClearConversation={messages.clearConversation}
            onClearAll={messages.clearAllConversations}
          />
        )}
      </div>
    </div>
  );
}
