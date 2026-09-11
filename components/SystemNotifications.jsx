"use client";

// 系统通知：公告 + 好友申请。
import AnnouncementList from "./AnnouncementList";
import FriendRequests from "./FriendRequests";

export default function SystemNotifications({
  announcements,
  onMarkRead,
  requests,
  onAccept,
  onDelete,
}) {
  const hasRequests =
    requests.incoming.length > 0 || requests.outgoing.length > 0;

  return (
    <div className="messages-content">
      <div className="messages-content-heading">
        <h2>系统通知</h2>
      </div>

      <div>
        <h3 className="settings-subheading">公告</h3>
        <AnnouncementList announcements={announcements} onMarkRead={onMarkRead} />
      </div>

      <hr className="settings-divider" />

      <div>
        <h3 className="settings-subheading">好友申请</h3>
        {hasRequests ? (
          <FriendRequests
            requests={requests}
            onAccept={onAccept}
            onDelete={onDelete}
          />
        ) : (
          <p className="messages-empty">暂时没有新的好友申请。</p>
        )}
      </div>
    </div>
  );
}
