// 首字母圆形头像，供导航卡片、会话列表、聊天窗口与好友申请共用。
export default function Avatar({ name, size = 36 }) {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
