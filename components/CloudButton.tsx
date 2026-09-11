// 右下角固定悬浮按钮「哒哒哒哒哒」：点击跳转到米哈游云。
// 它只是一个 <a> 链接、无交互逻辑，所以是服务端组件（不用 "use client"）。
interface CloudButtonProps {
  label?: string;
  href?: string;
}

export default function CloudButton({
  label = "哒哒哒哒哒",
  href = "https://ys.mihoyo.com/cloud/#/",
}: CloudButtonProps) {
  return (
    <a
      className="cloud-fab"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}（打开米哈游云·原神）`}
    >
      <span className="cloud-fab-label">{label}</span>
    </a>
  );
}
