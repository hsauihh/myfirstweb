"use client";

// 全站添加好友弹窗：由导航栏头像卡片触发，状态在 MessagesContext 里。
import { useEffect } from "react";
import AddFriend from "./AddFriend";
import { useMessages } from "./MessagesContext";

export default function AddFriendModal() {
  const { addFriendOpen, presetCode, closeAddFriend, addFriend } = useMessages();

  useEffect(() => {
    if (!addFriendOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") closeAddFriend();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addFriendOpen, closeAddFriend]);

  if (!addFriendOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeAddFriend}>
      <div
        className="modal-panel add-friend-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="section-kicker">添加好友</p>
            <h3>找到并添加好友</h3>
          </div>
          <button type="button" className="modal-close" onClick={closeAddFriend}>
            关闭
          </button>
        </div>
        <AddFriend onAdd={addFriend} presetCode={presetCode} />
      </div>
    </div>
  );
}
