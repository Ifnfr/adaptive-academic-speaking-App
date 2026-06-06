"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

import type { CommonplaceStorage } from "./CommonplaceView";
import type { CommonplaceMindMapSummary } from "../lib/storage/supabase-commonplace-mindmap-adapter";

type CommonplaceMainMindMapCanvasProps = {
  onBackToLibrary: () => void;
  onOpenSubMindMap?: (subMindMapId: string) => Promise<boolean>;
  ownerId?: string | null;
  storage?: CommonplaceStorage | null;
};

type CommonplaceClusterNodeData = {
  subMindMapId: string;
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
      className={`w-[260px] cursor-pointer rounded-lg border bg-white p-4 text-left shadow-sm transition-all ${
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
      <p className="mt-3 text-xs font-semibold text-[#534AB7]">
        Click to open
      </p>
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
  onOpenSubMindMap,
  ownerId,
  storage,
}: CommonplaceMainMindMapCanvasProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CommonplaceClusterNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [savedSubMaps, setSavedSubMaps] = useState<CommonplaceMindMapSummary[]>([]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "error" | "info" } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((message: string, type: "error" | "info") => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedback({ message, type });
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 4000);
  }, []);

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
      const clusterIdToNodeId = new Map(
        graph.clusters.map((cluster) => [
          cluster.id,
          `cluster-${cluster.subMindMapId}`,
        ]),
      );

      const mappedNodes: Node<CommonplaceClusterNodeData>[] = graph.clusters.map((c) => ({
        id: `cluster-${c.subMindMapId}`,
        type: "commonplaceCluster",
        position: { x: c.positionX, y: c.positionY },
        data: {
          subMindMapId: c.subMindMapId,
          subMindMapTitle: c.subMindMapTitle,
          updatedAt: c.updatedAt,
        },
      }));

      const mappedEdges: Edge[] = graph.edges.map((e) => ({
        id: e.id,
        source: clusterIdToNodeId.get(e.sourceNodeId) ?? `cluster-${e.sourceNodeId}`,
        target: clusterIdToNodeId.get(e.targetNodeId) ?? `cluster-${e.targetNodeId}`,
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

  const loadSavedSubMaps = useCallback(async () => {
    if (!storage || !ownerId) return;
    if (!storage.listCommonplaceSubMindMaps) return;

    try {
      const result = await storage.listCommonplaceSubMindMaps(ownerId);
      if (result.ok) {
        setSavedSubMaps(result.mindMaps);
      }
    } catch {
      // Ignored
    }
  }, [storage, ownerId]);

  const handleInsertCluster = useCallback((map: CommonplaceMindMapSummary) => {
    // Check duplicate
    const exists = nodes.some((n) => n.data.subMindMapId === map.id);
    if (exists) {
      showFeedback("Cluster already exists on canvas.", "error");
      return;
    }

    // Offset position
    const lastNode = nodes[nodes.length - 1];
    const x = lastNode ? lastNode.position.x + 300 : 150;
    const y = lastNode ? lastNode.position.y + 100 : 150;

    const newNode: Node<CommonplaceClusterNodeData> = {
      id: `cluster-${map.id}`,
      type: "commonplaceCluster",
      position: { x, y },
      data: {
        subMindMapId: map.id,
        subMindMapTitle: map.title,
        updatedAt: map.updatedAt,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    showFeedback(`Added cluster for "${map.title}"`, "info");
  }, [nodes, setNodes, showFeedback]);

  const handleClusterClick = useCallback(async (_event: React.MouseEvent, node: Node<CommonplaceClusterNodeData>) => {
    if (!onOpenSubMindMap) return;

    const didOpen = await onOpenSubMindMap(node.data.subMindMapId);
    if (!didOpen) {
      showFeedback("Could not open sub mind map.", "error");
    }
  }, [onOpenSubMindMap, showFeedback]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadGraph();
      void loadSavedSubMaps();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadGraph, loadSavedSubMaps]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

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
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSelectorOpen(!isSelectorOpen)}
              className="rounded-lg border border-[#534AB7]/30 bg-[#EEEDFE] px-4 py-2 text-sm font-semibold text-[#332C85] hover:bg-[#E3E0FF]"
              data-testid="commonplace-mainmap-add-cluster-btn"
            >
              Tambah cluster
            </button>
            {isSelectorOpen && (
              <div
                className="absolute right-0 mt-2 w-80 rounded-xl border border-[var(--brand-border)] bg-white p-3 shadow-xl z-50"
                data-testid="commonplace-mainmap-cluster-selector"
              >
                <h4 className="text-xs font-semibold uppercase text-[#534AB7] mb-2">
                  Select Sub Mind Map
                </h4>
                {savedSubMaps.length === 0 ? (
                  <p
                    className="text-sm text-[var(--brand-ink-soft)] py-2 text-center"
                    data-testid="commonplace-mainmap-no-submaps"
                  >
                    No saved sub mind maps yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                    {savedSubMaps.map((map) => (
                      <button
                        key={map.id}
                        type="button"
                        onClick={() => {
                          handleInsertCluster(map);
                          setIsSelectorOpen(false);
                        }}
                        className="flex flex-col text-left w-full rounded-lg border border-[var(--brand-border)] p-3 hover:bg-[#F8F7FF] transition-colors"
                        data-testid={`commonplace-mainmap-select-item-${map.id}`}
                      >
                        <span className="text-[10px] font-semibold uppercase text-[#534AB7]">
                          Sub Mind Map
                        </span>
                        <span className="mt-1 text-sm font-semibold text-[var(--brand-ink)] truncate">
                          {map.title}
                        </span>
                        {map.updatedAt && (
                          <span className="mt-1 text-[10px] text-[var(--brand-ink-soft)]">
                            Updated: {formatDate(map.updatedAt)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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

      {feedback && (
        <div
          role="status"
          className={`px-5 py-2.5 text-sm font-medium ${
            feedback.type === "error"
              ? "bg-[#FFF4F3] text-[#8A1F15]"
              : "bg-[#F0EFFF] text-[#332C85]"
          }`}
          data-testid="commonplace-main-mindmap-feedback"
        >
          {feedback.message}
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
            onNodeClick={handleClusterClick}
            fitView
            nodesConnectable={false}
            nodesDraggable={true}
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
