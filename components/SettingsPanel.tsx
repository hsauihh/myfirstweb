"use client";

// 设置面板：个人资料（换头像）+ 消息设置（提醒开关、清空聊天记录）。
import { useState } from "react";
import ProfileSettings from "./ProfileSettings";
import { useMessages } from "./MessagesContext";
import type { Friend } from "./types";
import type { PerformResult } from "./useFriends";

interface SettingsPanelProps {
  reminderEnabled: boolean;
  onToggleReminder: (value: boolean) => void;
  activeFriend: Friend | null;
  onClearConversation: (friendId: number) => Promise<PerformResult<unknown>>;
  onClearAll: () => Promise<PerformResult<unknown>>;
}

export default function SettingsPanel({
  reminderEnabled,
  onToggleReminder,
  activeFriend,
  onClearConversation,
  onClearAll,
}: SettingsPanelProps) {
  const { vipBadgeEnabled, setVipBadgeEnabled } = useMessages();
  const [message, setMessage] = useState("");

  async function clearCurrent() {
    if (!activeFriend) return;
    const confirmed = window.confirm(
      `清空与 ${activeFriend.username} 的聊天记录？此操作不可恢复。`
    );
    if (!confirmed) return;
    const outcome = await onClearConversation(activeFriend.id);
    setMessage(outcome.ok ? "已清空当前会话" : outcome.message);
  }

  async function clearAll() {
    if (!window.confirm("清空与所有好友的聊天记录？此操作不可恢复。")) return;
    const outcome = await onClearAll();
    setMessage(outcome.ok ? "已清空全部聊天记录" : outcome.message);
  }

  return (
    <div className="messages-content">
      <div className="messages-content-heading">
        <h2>设置</h2>
      </div>

      <ProfileSettings />

      <hr className="settings-divider" />

      <h3 className="settings-subheading">消息设置</h3>

      <div className="setting-row">
        <div>
          <p className="setting-title">消息提醒</p>
          <p className="setting-desc">
            开启后，收到新消息时导航栏「消息」右上角显示红点。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reminderEnabled}
          aria-label="消息提醒"
          className={"switch" + (reminderEnabled ? " is-on" : "")}
          onClick={() => onToggleReminder(!reminderEnabled)}
        >
          <span className="switch-knob" />
        </button>
      </div>

      <div className="setting-row">
        <div>
          <p className="setting-title">头像 VIP 标识</p>
          <p className="setting-desc">
            开通 VIP 后，在头像右上角显示金色「VIP」小字。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={vipBadgeEnabled}
          aria-label="头像 VIP 标识"
          className={"switch" + (vipBadgeEnabled ? " is-on" : "")}
          onClick={() => setVipBadgeEnabled(!vipBadgeEnabled)}
        >
          <span className="switch-knob" />
        </button>
      </div>

      <div className="setting-row">
        <div>
          <p className="setting-title">清空当前会话</p>
          <p className="setting-desc">
            {activeFriend
              ? `当前会话：${activeFriend.username}`
              : "先在「我的消息」里选择一个好友。"}
          </p>
        </div>
        <button
          type="button"
          className="ghost-button danger"
          disabled={!activeFriend}
          onClick={clearCurrent}
        >
          清空
        </button>
      </div>

      <div className="setting-row">
        <div>
          <p className="setting-title">清空全部聊天记录</p>
          <p className="setting-desc">删除与所有好友的消息，好友关系保留。</p>
        </div>
        <button type="button" className="ghost-button danger" onClick={clearAll}>
          清空全部
        </button>
      </div>

      {message && <p className="add-friend-hint">{message}</p>}
    </div>
  );
}
