// 知识图谱的确定性布局：分组框按 3 列码放，概念在框内纵向等距堆叠。
// 纯计算、无副作用，所以同一份数据永远得到同一张图（不用力导向布局）。
import type { Edge, Node } from "@xyflow/react";
import type { RagGraph } from "./types";

const GROUP_WIDTH = 236;
const GROUP_PADDING = 12;
const GROUP_HEADER = 44;
const NODE_HEIGHT = 40;
const NODE_GAP = 10;
const COLUMNS = 3;
const COLUMN_GAP = 40;
const ROW_GAP = 40;

function groupHeight(count: number): number {
  return (
    GROUP_HEADER + GROUP_PADDING * 2 + count * (NODE_HEIGHT + NODE_GAP) - NODE_GAP
  );
}

/** 当前激活节点及其一跳邻居。 */
function neighborsOf(graph: RagGraph, activeId: string | null): Set<string> {
  const neighbors = new Set<string>();
  if (!activeId) return neighbors;
  neighbors.add(activeId);
  for (const edge of graph.edges) {
    if (edge.source === activeId) neighbors.add(edge.target);
    if (edge.target === activeId) neighbors.add(edge.source);
  }
  return neighbors;
}

export function buildNodes(graph: RagGraph, activeId: string | null): Node[] {
  const members = new Map<string, typeof graph.nodes>();
  for (const node of graph.nodes) {
    const list = members.get(node.group);
    if (list) list.push(node);
    else members.set(node.group, [node]);
  }
  const neighbors = neighborsOf(graph, activeId);
  const cursors = new Array<number>(COLUMNS).fill(0);
  const nodes: Node[] = [];
  graph.groups.forEach((group, index) => {
    const column = index % COLUMNS;
    const list = members.get(group.key) ?? [];
    const height = groupHeight(list.length);
    nodes.push({
      id: group.key,
      type: "group",
      position: { x: column * (GROUP_WIDTH + COLUMN_GAP), y: cursors[column] },
      data: { label: group.label, count: list.length },
      style: { width: GROUP_WIDTH, height },
      selectable: false,
      draggable: false,
      focusable: false,
    });
    cursors[column] += height + ROW_GAP;
    list.forEach((member, row) => {
      nodes.push({
        id: member.id,
        type: "concept",
        parentId: group.key,
        extent: "parent",
        position: {
          x: GROUP_PADDING,
          y: GROUP_HEADER + row * (NODE_HEIGHT + NODE_GAP),
        },
        data: {
          name: member.name,
          kind: member.kind,
          degree: member.degree,
          dimmed: Boolean(activeId) && !neighbors.has(member.id),
          active: member.id === activeId,
        },
        style: { width: GROUP_WIDTH - GROUP_PADDING * 2, height: NODE_HEIGHT },
      });
    });
  });
  return nodes;
}

/** 有激活节点时只强调与它相连的边并显示关系文案，其余淡化。 */
export function buildEdges(graph: RagGraph, activeId: string | null): Edge[] {
  return graph.edges.map((edge) => {
    const touching =
      !activeId || edge.source === activeId || edge.target === activeId;
    return {
      id: `${edge.source}->${edge.target}:${edge.relation}`,
      source: edge.source,
      target: edge.target,
      label: activeId && touching ? edge.relation : undefined,
      type: "bezier",
      selectable: false,
      focusable: false,
      style: {
        stroke: activeId && touching ? "var(--brand)" : "var(--border-soft)",
        strokeWidth: activeId && touching ? 2 : 1.2,
        opacity: activeId && !touching ? 0.15 : 0.9,
      },
      labelStyle: { fill: "var(--text-soft)", fontSize: 11 },
      labelBgStyle: { fill: "var(--surface)" },
    };
  });
}
