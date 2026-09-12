"use client";

// 知识图谱的自定义节点：概念卡片与章 / 来源分组框。
// nodeTypes 必须定义在模块级（每次渲染新建对象会让 React Flow 反复重建节点）。
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";

export type ConceptData = {
  name: string;
  kind: string;
  degree: number;
  /** 当前有选中/悬停节点，且自己不是它的邻居时淡化。 */
  dimmed: boolean;
  active: boolean;
};

export type GroupData = {
  label: string;
  count: number;
};

export type ConceptNodeType = Node<ConceptData, "concept">;
export type GroupNodeType = Node<GroupData, "group">;

export function ConceptNode({ data }: NodeProps<ConceptNodeType>) {
  const className =
    "kg-node" +
    (data.dimmed ? " is-dimmed" : "") +
    (data.active ? " is-active" : "");

  return (
    <div className={className} title={`${data.name} · 出现 ${data.degree} 次`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <span className="kg-node__name">{data.name}</span>
      {data.kind && <span className="kg-node__kind">{data.kind}</span>}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

export function GroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="kg-group">
      <p className="kg-group__label">
        <span className="kg-group__title">{data.label}</span>
        <span className="kg-group__count">{data.count} 个概念</span>
      </p>
    </div>
  );
}

export const nodeTypes: NodeTypes = {
  concept: ConceptNode,
  group: GroupNode,
};
