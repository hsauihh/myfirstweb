// 标题锚点：把标题文本变成稳定的 id，供引用跳转定位。
// 只有前端需要 slug（后端只存 section 文本），标题渲染与引用链接共用这一个函数，
// 避免两处实现漂移。
import type { ReactElement, ReactNode } from "react";

export function headingSlug(text: unknown): string {
  const slug = String(text ?? "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .toLowerCase();
  return slug || "section";
}

/** 把 React 子节点（可能是嵌套的元素数组）拍平成纯文本，用于生成标题 id。 */
export function nodeText(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === "boolean") {
    return "";
  }
  if (Array.isArray(children)) return children.map(nodeText).join("");
  if (typeof children === "object") {
    // ReactNode 里的元素一定带 props，这里断言成带 children 的元素即可拍平
    return nodeText((children as ReactElement<{ children?: ReactNode }>).props?.children);
  }
  return String(children);
}

/** 「甲 / 乙 / 丙」形式的 section 路径 → 最后一级（也就是那一节的标题）。
 *  分隔符是带空格的「 / 」，所以标题里的单个斜杠（如 8.2 I/O设备）不会被截断。 */
export function lastSection(section: string | null | undefined): string {
  return String(section || "")
    .split(" / ")
    .pop()!
    .trim();
}
