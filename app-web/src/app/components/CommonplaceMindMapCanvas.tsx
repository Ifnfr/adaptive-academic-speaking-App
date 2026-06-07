"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { CommonplaceStorage } from "./CommonplaceView";
import type { CommonplaceMindMapSummary } from "../lib/storage/supabase-commonplace-mindmap-adapter";

type CommonplaceMindMapCanvasProps = {
  note: CommonplaceNote;
  onBackToDetail: () => void;
  onLookupByShortcode: (shortcode: string) => Promise<
    | { ok: true; note: CommonplaceNote }
    | { ok: false; error: string }
  >;
  ownerId?: string | null;
  storage?: CommonplaceStorage | null;
  initialMindMapId?: string | null;
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
  ownerId,
  storage,
  initialMindMapId,
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

  const [isLaciOpen, setIsLaciOpen] = useState(false);
  const [savedMaps, setSavedMaps] = useState<CommonplaceMindMapSummary[]>([]);
  const [currentMindMapId, setCurrentMindMapId] = useState<string | null>(null);
  const [isSavingGraph, setIsSavingGraph] = useState(false);

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

  const loadSavedMaps = useCallback(async () => {
    if (!storage || !ownerId) return;
    const result = await storage.listCommonplaceSubMindMaps(ownerId);
    if (result.ok) {
      setSavedMaps(result.mindMaps);
    }
  }, [storage, ownerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSavedMaps();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSavedMaps]);

  const handleSaveGraph = useCallback(async () => {
    if (!storage || !ownerId) {
      showFeedback("Storage unavailable.", "error");
      return;
    }

    setIsSavingGraph(true);
    showFeedback("Saving mind map...", "info");

    try {
      let mapId = currentMindMapId;

      if (!mapId) {
        // Create new sub map
        const title = note.title?.trim() || note.sourceBook || "Untitled Mind Map";
        const createResult = await storage.createCommonplaceSubMindMap({
          ownerId,
          title,
        });

        if (!createResult.ok) {
          showFeedback("Could not save mind map. Please try again.", "error");
          setIsSavingGraph(false);
          return;
        }

        mapId = createResult.mindMap.id;
        setCurrentMindMapId(mapId);
      }

      // Map nodes and edges
      const nodesInput = nodes.map((n) => ({
        localId: n.id,
        noteId: n.id.replace("commonplace-note-", ""),
        positionX: n.position.x,
        positionY: n.position.y,
      }));

      const edgesInput = edges.map((e) => ({
        sourceLocalId: e.source,
        targetLocalId: e.target,
        label: e.label ? String(e.label) : null,
      }));

      const saveResult = await storage.saveCommonplaceMindMapGraph({
        ownerId,
        mindMapId: mapId,
        nodes: nodesInput,
        edges: edgesInput,
      });

      if (!saveResult.ok) {
        showFeedback("Could not save mind map. Please try again.", "error");
      } else {
        showFeedback("Mind map saved successfully.", "info");
        void loadSavedMaps(); // Refresh list in Laci
      }
    } catch {
      showFeedback("Could not save mind map. Please try again.", "error");
    } finally {
      setIsSavingGraph(false);
    }
  }, [storage, ownerId, currentMindMapId, note, nodes, edges, loadSavedMaps, showFeedback]);

  const handleLoadGraph = useCallback(async (mapId: string) => {
    if (!storage || !ownerId) return;

    showFeedback("Loading mind map...", "info");
    const result = await storage.getCommonplaceMindMapGraph(ownerId, mapId);

    if (!result.ok) {
      showFeedback("Could not load mind map. Please try again.", "error");
      return;
    }

    const { graph } = result;
    setCurrentMindMapId(graph.summary.id);

    // Map nodes
    const mappedNodes = graph.nodes.map((n) => ({
      id: `commonplace-note-${n.noteId}`,
      type: "commonplaceNote",
      position: { x: n.positionX, y: n.positionY },
      data: {
        shortcode: n.noteShortcode,
        title: n.noteTitle || "Untitled Source",
        insight: n.noteInsight,
        tags: n.noteTags,
      },
    }));

    // Map edges
    const dbNodeIdToNoteIdMap = new Map<string, string>();
    for (const n of graph.nodes) {
      dbNodeIdToNoteIdMap.set(n.id, n.noteId);
    }

    const mappedEdges = graph.edges.map((e) => {
      const sourceNoteId = dbNodeIdToNoteIdMap.get(e.sourceNodeId);
      const targetNoteId = dbNodeIdToNoteIdMap.get(e.targetNodeId);

      return {
        id: e.id,
        source: `commonplace-note-${sourceNoteId}`,
        target: `commonplace-note-${targetNoteId}`,
        type: "commonplaceEdge",
        label: e.label || "",
      };
    });

    setNodes(mappedNodes);
    setEdges(mappedEdges);
    setIsLaciOpen(false); // Close drawer after load
    showFeedback(`Loaded mind map: "${graph.summary.title}"`, "info");
  }, [storage, ownerId, setNodes, setEdges, showFeedback]);

  useEffect(() => {
    if (!initialMindMapId) return;

    const timer = window.setTimeout(() => {
      void handleLoadGraph(initialMindMapId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [handleLoadGraph, initialMindMapId]);

  const handleDeleteGraph = useCallback(async (e: React.MouseEvent, mapId: string) => {
    e.stopPropagation(); // Avoid loading the graph when delete is clicked
    if (!storage || !ownerId) return;

    const result = await storage.deleteCommonplaceMindMap(ownerId, mapId);
    if (!result.ok) {
      showFeedback("Could not delete mind map. Please try again.", "error");
      return;
    }

    showFeedback("Mind map deleted.", "info");
    if (currentMindMapId === mapId) {
      setCurrentMindMapId(null);
    }
    void loadSavedMaps();
  }, [storage, ownerId, currentMindMapId, loadSavedMaps, showFeedback]);

  const handleNewGraph = useCallback(() => {
    setCurrentMindMapId(null);
    setNodes([
      {
        id: `commonplace-note-${note.id}`,
        type: "commonplaceNote",
        position: { x: 120, y: 120 },
        data: noteToNodeData(note),
      },
    ]);
    setEdges([]);
    setIsLaciOpen(false);
    showFeedback("Started a new mind map.", "info");
  }, [note, setNodes, setEdges, showFeedback]);

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
            onClick={handleSaveGraph}
            disabled={isSavingGraph}
            className="rounded-lg bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#413797] disabled:opacity-75"
            data-testid="commonplace-mindmap-save-btn"
          >
            {isSavingGraph ? "Saving..." : "Save"}
          </button>
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

      <div className="relative h-[540px] bg-[#FBFAFF]" data-testid="commonplace-mindmap-canvas">
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

        {/* Laci Drawer */}
        <div
          data-testid="commonplace-mindmap-laci-drawer"
          className={`absolute bottom-0 left-0 right-0 bg-white border-t border-[#534AB7]/25 shadow-lg transition-all duration-300 z-50 flex flex-col ${
            isLaciOpen ? "h-72" : "h-12"
          }`}
        >
          {/* Drawer Header */}
          <div
            onClick={() => setIsLaciOpen(!isLaciOpen)}
            data-testid="commonplace-mindmap-laci-header"
            className="flex items-center justify-between px-5 py-2.5 bg-[#F8F7FF] cursor-pointer hover:bg-[#EEEDFE] transition-colors border-b border-[#534AB7]/10"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#332C85]">Laci Drawer</span>
              <span className="rounded-full bg-[#EEEDFE] px-2 py-0.5 text-xs font-semibold text-[#534AB7]">
                {savedMaps.length} saved
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewGraph();
                }}
                data-testid="commonplace-mindmap-new-btn"
                className="rounded bg-[#534AB7] px-3 py-1 text-xs font-semibold text-white hover:bg-[#413797]"
              >
                Mind map baru
              </button>
              <span className="text-sm text-[#534AB7] font-semibold">
                {isLaciOpen ? "▼ Tutup" : "▲ Buka"}
              </span>
            </div>
          </div>

          {/* Drawer Body */}
          {isLaciOpen && (
            <div
              data-testid="commonplace-mindmap-laci-body"
              className="p-5 overflow-y-auto flex-1 bg-white"
            >
              {savedMaps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-sm text-[var(--brand-ink-soft)]">
                  <p>Belum ada mind map yang disimpan.</p>
                  <p className="text-xs mt-1">Buat koneksi dan klik Save untuk menyimpan.</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                  {savedMaps.map((map) => (
                    <div
                      key={map.id}
                      onClick={() => void handleLoadGraph(map.id)}
                      data-testid={`commonplace-mindmap-laci-item-${map.id}`}
                      className={`flex flex-col justify-between rounded-lg border p-4 hover:bg-[#F8F7FF] cursor-pointer transition-colors shadow-sm relative group ${
                        currentMindMapId === map.id
                          ? "border-2 border-[#534AB7] bg-[#F8F7FF]"
                          : "border-[#534AB7]/20 bg-white"
                      }`}
                    >
                      <div>
                        <h4 className="text-sm font-bold text-[var(--brand-ink)] truncate pr-6">
                          {map.title}
                        </h4>
                        <p className="text-[11px] text-[var(--brand-ink-soft)] mt-1.5">
                          Updated: {formatDate(map.updatedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => void handleDeleteGraph(e, map.id)}
                        data-testid={`commonplace-mindmap-laci-delete-${map.id}`}
                        className="absolute right-3 top-3 rounded p-1 text-[var(--brand-ink-soft)] hover:bg-[#FFF4F3] hover:text-[#8A1F15] transition-colors"
                        title="Delete Mind Map"
                      >
                        <svg
                          aria-hidden="true"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
