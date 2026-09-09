// 好友申请列表：收到的可接受/拒绝，发出的可撤回。
export default function FriendRequests({ requests, onAccept, onDelete }) {
  const { incoming, outgoing } = requests;
  return (
    <div className="request-list">
      {incoming.map((item) => (
        <div className="request-item" key={item.id}>
          <span className="request-name">{item.user.username}</span>
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
          <span className="request-name">{item.user.username}（待通过）</span>
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
