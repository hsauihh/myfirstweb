// 头像：有图片地址显示图片，否则回退首字母圆形。
const API = process.env.NEXT_PUBLIC_API_BASE_URL;

function resolveSrc(src) {
  if (!src) return "";
  return src.startsWith("http") ? src : `${API}${src}`;
}

export default function Avatar({ name, src, size = 36 }) {
  const url = resolveSrc(src);

  if (url) {
    return (
      <img
        className="avatar avatar--image"
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }

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
