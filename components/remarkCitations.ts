// remark 插件：把助手回答里的 [1] [2] 变成指向 `#cite-N` 的链接节点。
// 只在本轮来源里真的存在该编号时才转（避免把 [2024]、代码块、已有链接误当引用）；
// 直接手写 mdast 递归——节点就是普通对象，不引入额外依赖。
import type { Link, Nodes, Root, Text } from "mdast";

const CITATION = /\[(\d{1,2})\]/g;
// 这些节点内部不重写：代码里出现 [1] 不应变成角标，链接里不应嵌套按钮
const SKIP = new Set<string>(["code", "inlineCode", "link", "linkReference"]);

// mdast 的父节点是联合类型（各父节点的 children 类型不同），这里统一按 Nodes[] 递归：
// 我们只把 text 换成 text/link，父节点种类不变，所以写回是安全的。
type MutableParent = { children: Nodes[] };

export interface RemarkCitationsOptions {
  indexes?: Set<number>;
}

export default function remarkCitations(options: RemarkCitationsOptions = {}) {
  const indexes = options.indexes;
  return (tree: Root): void => {
    if (!indexes || indexes.size === 0) return;
    rewriteChildren(tree as MutableParent, indexes);
  };
}

function rewriteChildren(node: MutableParent, indexes: Set<number>): void {
  const next: Nodes[] = [];
  for (const child of node.children) {
    if (child.type === "text") {
      next.push(...splitText(child.value, indexes));
      continue;
    }
    if (!SKIP.has(child.type)) rewriteChildren(child as MutableParent, indexes);
    next.push(child);
  }
  node.children = next;
}

function splitText(value: string, indexes: Set<number>): Nodes[] {
  const nodes: Nodes[] = [];
  let cursor = 0;
  CITATION.lastIndex = 0;
  let match = CITATION.exec(value);
  while (match !== null) {
    const index = Number(match[1]);
    if (indexes.has(index)) {
      if (match.index > cursor) {
        nodes.push({ type: "text", value: value.slice(cursor, match.index) } satisfies Text);
      }
      nodes.push({
        type: "link",
        url: `#cite-${index}`,
        children: [{ type: "text", value: match[0] }],
      } satisfies Link);
      cursor = match.index + match[0].length;
    }
    match = CITATION.exec(value);
  }
  if (cursor < value.length) nodes.push({ type: "text", value: value.slice(cursor) });
  return nodes.length > 0 ? nodes : [{ type: "text", value }];
}
