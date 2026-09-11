// 好友申请列表：收到的可接受/拒绝，发出的可撤回。
import Avatar from "./Avatar";
import type { FriendRequests as FriendRequestsData } from "./types";

interface FriendRequestsProps {
  requests: FriendRequestsData;
  onAccept: (requestId: number) => void;
  onDelete: (requestId: number) => void;
}

export default function FriendRequests({
  requests,
  onAccept,
  onDelete,
}: FriendRequestsProps) {
  const { incoming, outgoing } = requests;
  return (
    <div className="request-list">
      {incoming.map((item) => (
        <div className="request-item" key={item.id}>
          <div className="request-user">
            <Avatar name={item.user.username} src={item.user.avatar} size={32} />
            <span className="request-name">{item.user.username}</span>
          </div>
          <div className="request-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => onAccept(item.id)}
            >
              接受
            </button>
            <button
              type="button"
              className="ghost-button danger"
              onClick={() => onDelete(item.id)}
            >
              拒绝
            </button>
          </div>
        </div>
      ))}
      {outgoing.map((item) => (
        <div className="request-item" key={item.id}>
          <div className="request-user">
            <Avatar name={item.user.username} src={item.user.avatar} size={32} />
            <span className="request-name">{item.user.username}（待通过）</span>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => onDelete(item.id)}
          >
            撤回
          </button>
        </div>
      ))}
    </div>
  );
}
