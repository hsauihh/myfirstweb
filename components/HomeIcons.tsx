// 首页卡片用的线性图标（内联 SVG，24×24 网格、2px 描边，跟随 currentColor）。
// 按 ui-ux-pro-max 的规则：不用 emoji 当图标，全部可访问性友好（aria-hidden + 无文字时配 aria-label）。
interface IconProps {
  size?: number;
}

function base(size: number) {
  return {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

/** 随心一记：纸笔 */
export function NoteIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

/** 最新博客：文档列表 */
export function DocIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

/** 公告：喇叭 */
export function BellIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15 9a3.5 3.5 0 0 1 0 6M18 6.5a7 7 0 0 1 0 11" />
    </svg>
  );
}

/** 最热博客：火苗 */
export function FlameIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 22a7 7 0 0 0 7-7c0-5-4-6-5-11-2 2-2 4-2 5-1 0-2-1-2-3-2 2-5 5-5 9a7 7 0 0 0 7 7z" />
    </svg>
  );
}

/** 概览：仪表 */
export function GaugeIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 14l4-4" />
      <path d="M4 18a9 9 0 1 1 16 0" />
    </svg>
  );
}

/** 展开指示 */
export function ChevronIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** 点赞 */
export function HeartIcon({ size = 13 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 20s-7-4.3-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7c0 5-7 9.3-7 9.3z" />
    </svg>
  );
}
