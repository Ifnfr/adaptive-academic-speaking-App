"use client";

import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type NodeProps,
  type NodeTypes,
  useNodesState,
  useEdgesState,
  type EdgeTypes,
  type EdgeProps,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

import type { CommonplaceStorage } from "./CommonplaceView";

type CommonplaceMainMindMapCanvasProps = {
  onBackToLibrary: () => void;
  ownerId?: string | null;
  storage?: CommonplaceStorage | null;
};

type CommonplaceClusterNodeData = {
  subMindMapTitle: string;
  updatedAt?: string;
  isHighlighted?: boolean;
};

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function CommonplaceClusterNode({
  data,
}: NodeProps<CommonplaceClusterNodeData>) {
  return (
    <article
      className={`w-[260px] rounded-lg border bg-white p-4 text-left shadow-sm transition-all ${
        data.isHighlighted
          ? "border-2 border-[#534AB7] ring-4 ring-[#534AB7]/20"
          : "border-[#534AB7]/25 hover:border-[#534AB7]/50"
      }`}
      data-testid="commonplace-mainmap-cluster-node"
      style={data.isHighlighted ? { transform: "scale(1.02)" } : undefined}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <p className="text-xs font-semibold uppercase text-[#534AB7]">
        Sub Mind Map
      </p>
      <h3 className="mt-2 text-base font-semibold text-[var(--brand-ink)]">
        {data.subMindMapTitle}
      </h3>
      {data.updatedAt && (
        <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
          Updated: {formatDate(data.updatedAt)}
        </p>
      )}
    </article>
  );
}

const nodeTypes: NodeTypes = {
  commonplaceCluster: CommonplaceClusterNode,
};

function CommonplaceEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke: "#534AB7", strokeWidth: 2 }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: "#EEEDFE",
              color: "#332C85",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 600,
              border: "1px solid rgba(83, 74, 183, 0.3)",
              pointerEvents: "all",
            }}
            className="nodrag nopan rounded border border-[#534AB7]/30 bg-[#EEEDFE] px-2 py-0.5 text-[11px] font-semibold text-[#332C85] shadow-sm"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = {
  commonplaceEdge: CommonplaceEdge,
};

export function CommonplaceMainMindMapCanvas({
  onBackToLibrary,
  ownerId,
  storage,
}: CommonplaceMainMindMapCanvasProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const loadGraph = useCallback(async () => {
    if (!storage || !ownerId) return;
    if (!storage.getCommonplaceMainMindMapGraph) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await storage.getCommonplaceMainMindMapGraph(ownerId);
      if (!result.ok) {
        setError("Could not load Main Mind Map. Please try again.");
        return;
      }

      const { graph } = result;
      // Map clusters to nodes
      const mappedNodes = graph.clusters.map((c) => ({
        id: `cluster-${c.id}`,
        type: "commonplaceCluster",
        position: { x: c.positionX, y: c.positionY },
        data: {
          subMindMapTitle: c.subMindMapTitle,
          updatedAt: c.updatedAt,
        },
      }));

      // Map edges
      const mappedEdges = graph.edges.map((e) => ({
        id: e.id,
        source: `cluster-${e.sourceNodeId}`,
        target: `cluster-${e.targetNodeId}`,
        type: "commonplaceEdge",
        label: e.label || "",
      }));

      setNodes(mappedNodes);
      setEdges(mappedEdges);
    } catch {
      setError("Could not load Main Mind Map. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [storage, ownerId, setNodes, setEdges]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadGraph();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadGraph]);

  return (
    <div
      className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-[var(--brand-border)] bg-white"
      data-testid="commonplace-main-mindmap-view"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--brand-border)] bg-[#EEEDFE] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#534AB7]">
            Main Mind Map
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            Mind Map Utama
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--brand-ink-soft)]">
            Connect saved sub mind maps as high-level idea clusters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled
            className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-semibold text-gray-500 shadow-sm cursor-not-allowed"
            data-testid="commonplace-main-mindmap-save-btn"
          >
            Save (Coming next)
          </button>
          <button
            type="button"
            onClick={onBackToLibrary}
            className="rounded-lg border border-[#534AB7]/30 bg-white px-4 py-2 text-sm font-semibold text-[#332C85] hover:bg-[#F8F7FF]"
            data-testid="commonplace-main-mindmap-back-btn"
          >
            Back to Library
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="px-5 py-2.5 text-sm font-medium bg-[#FFF4F3] text-[#8A1F15]"
          data-testid="commonplace-main-mindmap-error"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center bg-[#FBFAFF] h-[540px]">
          <p className="text-sm text-[var(--brand-ink-soft)]">Loading Main Mind Map...</p>
        </div>
      ) : nodes.length === 0 ? (
        <div
          className="flex flex-col flex-1 items-center justify-center bg-[#FBFAFF] h-[540px]"
          data-testid="commonplace-main-mindmap-empty"
        >
          <p className="text-sm font-semibold text-[var(--brand-ink-soft)]">
            No clusters yet. Add saved sub mind maps in the next step.
          </p>
        </div>
      ) : (
        <div className="relative h-[540px] bg-[#FBFAFF]" data-testid="commonplace-main-mindmap-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            nodesConnectable={false}
            nodesDraggable={false}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            connectOnClick={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#D9D4F7" gap={24} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
