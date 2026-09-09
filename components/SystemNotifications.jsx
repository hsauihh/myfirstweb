"use client";

// 系统通知：目前是好友申请，后续更新公告也放这里。
import FriendRequests from "./FriendRequests.jsx";

export default function SystemNotifications({ requests, onAccept, onDelete }) {
  const hasRequests =
    requests.incoming.length > 0 || requests.outgoing.length > 0;

  return (
    <div className="messages-content">
      <div className="messages-content-heading">
        <h2>系统通知</h2>
        <p className="messages-content-desc">
          好友申请会出现在这里，后续的更新公告也会在这里发布。
        </p>
      </div>

      {hasRequests ? (
        <FriendRequests
          requests={requests}
          onAccept={onAccept}
          onDelete={onDelete}
        />
      ) : (
        <p className="messages-empty">暂时没有新的通知。</p>
      )}
    </div>
  );
}
