"use client";

// 知识库图谱：把 /api/rag/graph 的「章 / 来源 → 核心概念 → 关系」画成可缩放的结构图。
// 数据实时查库（按当前用户可见性过滤），所以在问答页命中的范围与这里一致。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type ColorMode,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { errorMessage } from "./apiError";
import { nodeTypes } from "./GraphNodes";
import KnowledgeGraphDetail from "./KnowledgeGraphDetail";
import * as ragApi from "./ragApi";
import { buildEdges, buildNodes } from "./graphLayout";
import type { RagGraph, RagGraphEntity } from "./types";

interface KnowledgeGraphProps {
  /** 页签是否可见：从隐藏切回来时容器尺寸才确定，需要重新 fitView。 */
  visible: boolean;
  onAsk: (name: string) => void;
}

/** 跟随站点深浅色（ThemeToggle 只改 data-theme）。 */
function useColorMode(): ColorMode {
  const [mode, setMode] = useState<ColorMode>("light");

  useEffect(() => {
    const read = () =>
      setMode(
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "dark"
          : "light"
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return mode;
}

interface GraphCanvasProps {
  graph: RagGraph;
  visible: boolean;
  activeId: string | null;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}

function GraphCanvas({
  graph,
  visible,
  activeId,
  onHover,
  onOpen,
}: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const colorMode = useColorMode();
  const nodes = useMemo(() => buildNodes(graph, activeId), [graph, activeId]);
  const edges = useMemo(() => buildEdges(graph, activeId), [graph, activeId]);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(() => fitView({ padding: 0.15 }), 80);
    return () => window.clearTimeout(timer);
  }, [visible, fitView, graph]);

  const handleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "concept") onOpen(node.id);
    },
    [onOpen]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      colorMode={colorMode}
      fitView
      minZoom={0.2}
      maxZoom={1.6}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      onNodeClick={handleClick}
      onNodeMouseEnter={(_event, node) => onHover(node.id)}
      onPaneClick={() => onHover(null)}
    >
      <Background gap={18} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export default function KnowledgeGraph({ visible, onAsk }: KnowledgeGraphProps) {
  const [graph, setGraph] = useState<RagGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RagGraphEntity | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    let alive = true;
    ragApi
      .ragGraph()
      .then((data) => {
        if (alive) {
          setGraph(data);
          setError("");
        }
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const open = useCallback(
    async (id: string) => {
      const node = graph?.nodes.find((item) => item.id === id);
      if (!node) return;
      setSelected(id);
      setDetail(null);
      setDetailError("");
      setDetailLoading(true);
      const token = requestRef.current + 1;
      requestRef.current = token;
      try {
        const data = await ragApi.ragGraphEntity(node.entity_id);
        if (requestRef.current === token) setDetail(data);
      } catch (err) {
        if (requestRef.current === token) setDetailError(errorMessage(err));
      } finally {
        if (requestRef.current === token) setDetailLoading(false);
      }
    },
    [graph]
  );

  const openByName = useCallback(
    (name: string) => {
      const node = graph?.nodes.find((item) => item.name === name);
      if (node) void open(node.id);
    },
    [graph, open]
  );

  const close = useCallback(() => {
    requestRef.current += 1;
    setSelected(null);
    setDetail(null);
    setDetailError("");
  }, []);

  if (loading) {
    return (
      <div className="panel panel-full card kg-panel">
        <p className="kg-empty">知识图谱加载中…</p>
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="panel panel-full card kg-panel">
        <p className="lab-error">{error || "知识图谱加载失败"}</p>
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="panel panel-full card kg-panel">
        <p className="kg-empty">
          {graph.stats.chunks === 0
            ? "知识库还是空的，先去「来源管理」添加内容。"
            : "这批资料还没有图谱数据：站内公共资料需要在配好模型后重新入库，个人文章在加入知识库时会自动抽取。"}
        </p>
      </div>
    );
  }

  const stats = graph.stats;
  const selectedNode = graph.nodes.find((item) => item.id === selected) ?? null;
  const activeId = hovered ?? selected;

  return (
    <div className="panel panel-full card kg-panel">
      <div className="kg-head">
        <div>
          <p className="section-kicker">知识图谱</p>
          <h2 className="kb-section__title">知识库结构图</h2>
        </div>
        <p className="kg-stats">
          {stats.chunks} 片段 / {stats.entities} 实体 / {stats.relations} 关系 ·
          展示 {stats.nodes} 概念 / {stats.edges} 关系
          {stats.truncated ? " · 每组只展示最关键的 8 个概念" : ""}
        </p>
      </div>

      <div className={"kg-body" + (selectedNode ? " has-detail" : "")}>
        <div
          className="kg-canvas"
          // 高亮只在「离开整张画布」时清除，不能在离开某个节点时清除：
          // 没有激活节点时全图都不淡化，有一个就淡化其余 50+ 个节点，
          // 挂在 mouseleave 上会让指针在图上移动时整张图明暗振荡（闪烁）。
          onMouseLeave={() => setHovered(null)}
        >
          <ReactFlowProvider>
            <GraphCanvas
              graph={graph}
              visible={visible}
              activeId={activeId}
              onHover={setHovered}
              onOpen={open}
            />
          </ReactFlowProvider>
          <p className="kg-hint">滚轮缩放 · 点概念看详情</p>
        </div>
        {selectedNode && (
          <KnowledgeGraphDetail
            name={selectedNode.name}
            detail={detail}
            loading={detailLoading}
            error={detailError}
            onSelect={openByName}
            onAsk={onAsk}
            onClose={close}
          />
        )}
      </div>
    </div>
  );
}
