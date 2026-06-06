"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type NodeProps,
  type NodeTypes,
  useNodesState,
  useEdgesState,
  type Edge,
  type EdgeTypes,
  type EdgeProps,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

import type { CommonplaceNote } from "../lib/storage/supabase-commonplace-adapter";

type CommonplaceMindMapCanvasProps = {
  note: CommonplaceNote;
  onBackToDetail: () => void;
  onLookupByShortcode: (shortcode: string) => Promise<
    | { ok: true; note: CommonplaceNote }
    | { ok: false; error: string }
  >;
};

type CommonplaceMindMapNodeData = {
  shortcode: string;
  title: string;
  insight: string;
  tags: string[];
  isHighlighted?: boolean;
};

type CanvasFeedback = {
  message: string;
  type: "error" | "info";
};

function displayTitle(note: CommonplaceNote): string {
  return note.title?.trim() || note.sourceBook || "Untitled Source";
}

function insightPreview(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 220) return trimmed;
  return `${trimmed.slice(0, 220)}...`;
}

function noteToNodeData(note: CommonplaceNote): CommonplaceMindMapNodeData {
  return {
    shortcode: note.shortcode,
    title: displayTitle(note),
    insight: insightPreview(note.insight),
    tags: note.tags,
  };
}

function CommonplaceNoteNode({
  data,
}: NodeProps<CommonplaceMindMapNodeData>) {
  return (
    <article
      className={`w-[280px] rounded-lg border bg-white p-4 text-left shadow-sm transition-all ${
        data.isHighlighted
          ? "border-2 border-[#534AB7] ring-4 ring-[#534AB7]/20"
          : "border-[#534AB7]/25 hover:border-[#534AB7]/50"
      }`}
      data-testid="commonplace-mindmap-note-node"
      style={data.isHighlighted ? { transform: "scale(1.02)" } : undefined}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <p className="text-xs font-semibold uppercase text-[#534AB7]">
        {data.shortcode}
      </p>
      <h3 className="mt-2 text-base font-semibold text-[var(--brand-ink)]">
        {data.title}
      </h3>
      <p className="mt-3 max-h-24 overflow-hidden text-sm leading-6 text-[var(--brand-ink-soft)]">
        {data.insight}
      </p>
      {data.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#534AB7]/20 bg-[#EEEDFE] px-2.5 py-1 text-xs text-[#332C85]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

const nodeTypes: NodeTypes = {
  commonplaceNote: CommonplaceNoteNode,
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
            data-testid="commonplace-mindmap-edge-label"
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

function normalizeShortcodeInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function CommonplaceMindMapCanvas({
  note,
  onBackToDetail,
  onLookupByShortcode,
}: CommonplaceMindMapCanvasProps) {
  const [shortcodeInput, setShortcodeInput] = useState("");
  const [isLooking, setIsLooking] = useState(false);
  const [feedback, setFeedback] = useState<CanvasFeedback | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [connectTarget, setConnectTarget] = useState<string | null>(null);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [labelText, setLabelText] = useState("");

  const initialNodes = useMemo<Node<CommonplaceMindMapNodeData>[]>(
    () => [
      {
        id: `commonplace-note-${note.id}`,
        type: "commonplaceNote",
        position: { x: 120, y: 120 },
        data: noteToNodeData(note),
      },
    ],
    [note],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

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

  const handleToggleConnectMode = useCallback(() => {
    setIsConnectMode((prev) => {
      const next = !prev;
      if (!next) {
        // Clear all highlight and connection form states
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            data: { ...n.data, isHighlighted: false },
          }))
        );
        setConnectSource(null);
        setConnectTarget(null);
        setShowLabelForm(false);
        setLabelText("");
      } else {
        showFeedback("Connect mode active. Click source node.", "info");
      }
      return next;
    });
  }, [setNodes, showFeedback]);

  const handleNodeClick = useCallback((event: React.MouseEvent, clickedNode: Node) => {
    if (!isConnectMode) return;

    if (!connectSource) {
      // First click: select source
      setConnectSource(clickedNode.id);
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === clickedNode.id) {
            return {
              ...n,
              data: { ...n.data, isHighlighted: true },
            };
          }
          return n;
        })
      );
      showFeedback("Select target node to connect.", "info");
    } else {
      // Second click: select target
      if (clickedNode.id === connectSource) {
        showFeedback("Choose a different target node.", "error");
        return;
      }

      // Check duplicates
      const isDuplicate = edges.some(
        (edge) =>
          (edge.source === connectSource && edge.target === clickedNode.id) ||
          (edge.source === clickedNode.id && edge.target === connectSource)
      );

      if (isDuplicate) {
        showFeedback("Connection already exists.", "error");
        return;
      }

      setConnectTarget(clickedNode.id);
      setLabelText("");
      setShowLabelForm(true);
    }
  }, [isConnectMode, connectSource, edges, setNodes, showFeedback]);

  const handleConfirmConnection = useCallback(() => {
    if (!connectSource || !connectTarget) return;

    const trimmedLabel = labelText.trim();
    const finalLabel = trimmedLabel.length > 0 ? trimmedLabel : "terhubung";

    const newEdge: Edge = {
      id: `edge-${connectSource}-${connectTarget}`,
      source: connectSource,
      target: connectTarget,
      type: "commonplaceEdge",
      label: finalLabel,
    };

    setEdges((eds) => [...eds, newEdge]);
    showFeedback(`Connection created with label: "${finalLabel}"`, "info");

    // Clean up connection highlights and temporary form states
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isHighlighted: false },
      }))
    );
    setConnectSource(null);
    setConnectTarget(null);
    setShowLabelForm(false);
    setLabelText("");
  }, [connectSource, connectTarget, labelText, setEdges, setNodes, showFeedback]);

  const handleCancelConnection = useCallback(() => {
    // Clear selections and hide form, but stay in connect mode
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isHighlighted: false },
      }))
    );
    setConnectSource(null);
    setConnectTarget(null);
    setShowLabelForm(false);
    setLabelText("");
    showFeedback("Connection cancelled.", "info");
  }, [setNodes, showFeedback]);

  const connectSourceShortcode = useMemo(() => {
    if (!connectSource) return "";
    const found = nodes.find((n) => n.id === connectSource);
    return found?.data.shortcode || "";
  }, [connectSource, nodes]);

  const connectTargetShortcode = useMemo(() => {
    if (!connectTarget) return "";
    const found = nodes.find((n) => n.id === connectTarget);
    return found?.data.shortcode || "";
  }, [connectTarget, nodes]);

  const handleShortcodeSubmit = useCallback(async () => {
    const normalized = normalizeShortcodeInput(shortcodeInput);
    if (normalized.length === 0) return;

    // Check duplicate
    const alreadyOnCanvas = nodes.some(
      (n) => (n.data as CommonplaceMindMapNodeData).shortcode === normalized,
    );
    if (alreadyOnCanvas) {
      showFeedback("Node already exists on canvas.", "info");
      setShortcodeInput("");
      return;
    }

    setIsLooking(true);
    setFeedback(null);

    const result = await onLookupByShortcode(normalized);

    setIsLooking(false);

    if (!result.ok) {
      showFeedback("Shortcode not found.", "error");
      return;
    }

    // Compute position offset from last node
    const lastNode = nodes[nodes.length - 1];
    const baseX = lastNode ? lastNode.position.x + 340 : 120;
    const baseY = lastNode ? lastNode.position.y + 120 : 120;

    const newNode: Node<CommonplaceMindMapNodeData> = {
      id: `commonplace-note-${result.note.id}`,
      type: "commonplaceNote",
      position: { x: baseX, y: baseY },
      data: noteToNodeData(result.note),
    };

    setNodes((current) => [...current, newNode]);
    setShortcodeInput("");
    showFeedback(`Added ${normalized} to canvas.`, "info");
  }, [shortcodeInput, nodes, onLookupByShortcode, setNodes, showFeedback]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleShortcodeSubmit();
      }
    },
    [handleShortcodeSubmit],
  );

  return (
    <div
      className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-[var(--brand-border)] bg-white"
      data-testid="commonplace-mindmap-view"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--brand-border)] bg-[#EEEDFE] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#534AB7]">
            Sub Mind Map
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {displayTitle(note)}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--brand-ink-soft)]">
            Add related notes by shortcode to build connections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleToggleConnectMode}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all border ${
              isConnectMode
                ? "bg-[#534AB7] text-white border-[#534AB7] hover:bg-[#413797]"
                : "border-[#534AB7]/30 bg-white text-[#332C85] hover:bg-[#F8F7FF]"
            }`}
            data-testid="commonplace-mindmap-connect-toggle"
          >
            Hubungkan node
          </button>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shortcodeInput}
              onChange={(e) => setShortcodeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik shortcode..."
              disabled={isLooking || isConnectMode}
              data-testid="commonplace-mindmap-shortcode-input"
              className="w-44 rounded-lg border border-[#534AB7]/30 bg-white px-3 py-2 text-sm text-[var(--brand-ink)] placeholder:text-[var(--brand-ink-soft)] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleShortcodeSubmit()}
              disabled={isLooking || shortcodeInput.trim().length === 0 || isConnectMode}
              className="rounded-lg bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#413797] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLooking ? "..." : "Add"}
            </button>
          </div>
          <button
            type="button"
            onClick={onBackToDetail}
            className="rounded-lg border border-[#534AB7]/30 bg-white px-4 py-2 text-sm font-semibold text-[#332C85] hover:bg-[#F8F7FF]"
          >
            Back to Detail
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          data-testid="commonplace-mindmap-feedback"
          className={`px-5 py-2.5 text-sm font-medium ${
            feedback.type === "error"
              ? "bg-[#FFF4F3] text-[#8A1F15]"
              : "bg-[#F0EFFF] text-[#332C85]"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {showLabelForm && (
        <div
          data-testid="commonplace-mindmap-connection-form"
          className="flex flex-wrap items-center justify-between gap-4 border-b border-[#534AB7]/20 bg-[#F5F4FF] px-5 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#332C85]">
              Label koneksi:
            </span>
            <span className="rounded border border-[#534AB7]/20 bg-white px-2 py-0.5 text-xs font-semibold text-[#534AB7]">
              {connectSourceShortcode} &rarr; {connectTargetShortcode}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="Contoh: sebab-akibat"
              maxLength={40}
              data-testid="commonplace-mindmap-label-input"
              className="w-56 rounded-lg border border-[#534AB7]/30 bg-white px-3 py-1.5 text-sm text-[var(--brand-ink)] placeholder:text-[var(--brand-ink-soft)] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/20"
            />
            <button
              type="button"
              onClick={handleConfirmConnection}
              data-testid="commonplace-mindmap-confirm-connection"
              className="rounded-lg bg-[#534AB7] px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#413797]"
            >
              Tambah koneksi
            </button>
            <button
              type="button"
              onClick={handleCancelConnection}
              data-testid="commonplace-mindmap-cancel-connection"
              className="rounded-lg border border-[#534AB7]/30 bg-white px-4 py-1.5 text-sm font-semibold text-[#332C85] hover:bg-[#F8F7FF]"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="h-[540px] bg-[#FBFAFF]" data-testid="commonplace-mindmap-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          nodesConnectable={false}
          nodesDraggable
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
    </div>
  );
}
