"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  MiniMap,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  getBezierPath,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import type {
  CommonplaceMapCanvasNode,
  CommonplaceMindMapDeleteResult,
  CommonplaceMindMapEdgeType,
  CommonplaceMapNodeListResult,
  CommonplaceMapNodePositionSaveResult,
  CommonplaceMapNodePositionUpdate,
  CommonplaceMindMapSummary,
  CommonplaceSubMapEdge,
  CommonplaceSubMapEdgeListResult,
  CommonplaceSubMapEdgeResult,
} from "../lib/storage/supabase-commonplace-mindmap-adapter";
import {
  CommonplaceNoteNode,
  type CommonplaceNoteNodeData,
} from "./CommonplaceNoteNode";

type MapNoteContext = {
  shortcode: string;
  title: string;
  sourceBook: string;
};

type SaveStatus = "Saved" | "Unsaved changes" | "Saving..." | "Save failed";

type DraggedCommonplaceNote = {
  noteId: string;
};

type CommonplaceEdgeData = {
  edgeType: CommonplaceMindMapEdgeType;
  label: string | null;
  onEdit: (
    edgeId: string,
    edgeType: CommonplaceMindMapEdgeType,
    label: string | null,
    clientX: number,
    clientY: number,
  ) => void;
};

type PositionedPanel = {
  x: number;
  y: number;
};

type NodeContextMenuState = PositionedPanel & {
  nodeId: string;
};

type EdgeDraftState = PositionedPanel & {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: CommonplaceMindMapEdgeType;
  label: string;
};

type EdgeEditState = PositionedPanel & {
  edgeId: string;
  edgeType: CommonplaceMindMapEdgeType;
  label: string;
};

type CommonplaceMapCanvasFoundationProps = {
  map: CommonplaceMindMapSummary;
  noteContext: MapNoteContext | null;
  onBack: () => void;
  loadNodes: () => Promise<CommonplaceMapNodeListResult>;
  loadEdges: () => Promise<CommonplaceSubMapEdgeListResult>;
  saveNodePositions: (
    updates: CommonplaceMapNodePositionUpdate[],
  ) => Promise<CommonplaceMapNodePositionSaveResult>;
  createNoteNode: (
    noteId: string,
    position: { x: number; y: number },
  ) => Promise<
    | { ok: true; node: CommonplaceMapCanvasNode }
    | { ok: false; error: "unsupported" | "failed" }
  >;
  createEdge: (input: {
    sourceNodeId: string;
    targetNodeId: string;
    edgeType: CommonplaceMindMapEdgeType;
    label?: string | null;
  }) => Promise<CommonplaceSubMapEdgeResult>;
  updateEdge: (input: {
    edgeId: string;
    edgeType?: CommonplaceMindMapEdgeType | null;
    label?: string | null;
  }) => Promise<CommonplaceSubMapEdgeResult>;
  deleteEdge: (edgeId: string) => Promise<CommonplaceMindMapDeleteResult>;
};

const nodeTypes: NodeTypes = {
  noteNode: CommonplaceNoteNode,
};

function CommonplaceConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<CommonplaceEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const openEdit = (event: ReactMouseEvent) => {
    event.stopPropagation();
    data?.onEdit(
      id,
      data.edgeType,
      data.label,
      event.clientX,
      event.clientY,
    );
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="commonplace-map-edge-hitbox"
        onClick={openEdit}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={openEdit}
          className="nodrag nopan rounded-full border border-[var(--brand-border)] bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-ink)] shadow-sm transition-colors hover:bg-[var(--brand-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            zIndex: 20,
          }}
          data-testid={`commonplace-map-edge-label-${id}`}
        >
          {data?.label || "Connection"}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes: EdgeTypes = {
  commonplaceEdge: CommonplaceConnectionEdge,
};

const COMMONPLACE_NOTE_DRAG_TYPE = "application/commonplace-note";

function titleForNode(node: CommonplaceMapCanvasNode): string {
  return node.noteTitle?.trim() || node.noteSourceBook || "Untitled Source";
}

function toReactFlowNode(
  node: CommonplaceMapCanvasNode,
): Node<CommonplaceNoteNodeData> {
  return {
    id: node.id,
    type: "noteNode",
    position: { x: node.positionX, y: node.positionY },
    data: {
      noteId: node.noteId,
      shortcode: node.noteShortcode,
      title: titleForNode(node),
      sourceBook: node.noteSourceBook,
      tags: node.noteTags,
    },
  };
}

function toReactFlowEdge(
  edge: CommonplaceSubMapEdge,
  onEdit: CommonplaceEdgeData["onEdit"],
): Edge<CommonplaceEdgeData> {
  const isDashed = edge.edgeType === "dashed";

  return {
    id: edge.id,
    type: "commonplaceEdge",
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    data: { edgeType: edge.edgeType, label: edge.label, onEdit },
    className: `commonplace-map-edge ${
      isDashed ? "commonplace-map-edge--dashed" : "commonplace-map-edge--solid"
    }`,
    style: {
      stroke: isDashed ? "#7B6BB0" : "#2F6F68",
      strokeWidth: 2,
      strokeDasharray: isDashed ? "7 5" : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: isDashed ? "#7B6BB0" : "#2F6F68",
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 6,
    labelBgStyle: { fill: "#FFFFFF", fillOpacity: 0.9 },
  };
}

function panelPosition(
  clientX: number,
  clientY: number,
  container: HTMLDivElement | null,
): PositionedPanel {
  const rect = container?.getBoundingClientRect();
  if (!rect) {
    if (typeof window === "undefined") return { x: clientX, y: clientY };

    return {
      x: Math.min(Math.max(12, clientX), Math.max(12, window.innerWidth - 260)),
      y: Math.min(Math.max(12, clientY), Math.max(12, window.innerHeight - 220)),
    };
  }

  const localX = clientX - rect.left;
  const localY = clientY - rect.top;

  return {
    x: Math.min(Math.max(12, localX), Math.max(12, rect.width - 280)),
    y: Math.min(Math.max(12, localY), Math.max(12, rect.height - 240)),
  };
}

export function CommonplaceMapCanvasFoundation({
  map,
  noteContext,
  onBack,
  loadNodes,
  loadEdges,
  saveNodePositions,
  createNoteNode,
  createEdge,
  updateEdge,
  deleteEdge,
}: CommonplaceMapCanvasFoundationProps) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CommonplaceNoteNodeData>([]);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<CommonplaceEdgeData>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Saved");
  const [isCanvasDragActive, setIsCanvasDragActive] = useState(false);
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<CommonplaceNoteNodeData> | null>(null);
  const canvasPanelRef = useRef<HTMLDivElement | null>(null);
  const [nodeContextMenu, setNodeContextMenu] =
    useState<NodeContextMenuState | null>(null);
  const [connectionSourceNodeId, setConnectionSourceNodeId] =
    useState<string | null>(null);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraftState | null>(null);
  const [edgeEdit, setEdgeEdit] = useState<EdgeEditState | null>(null);

  const isSubMap = map.type === "sub";
  const isSavingMapChange = saveStatus === "Saving...";
  const connectionSourceNode = useMemo(
    () =>
      nodes.find((node) => node.id === connectionSourceNodeId) ?? null,
    [connectionSourceNodeId, nodes],
  );
  const visibleNodes = useMemo<Node<CommonplaceNoteNodeData>[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          connectionRole: connectionSourceNodeId
            ? node.id === connectionSourceNodeId
              ? "source"
              : "target"
            : null,
        },
      })),
    [connectionSourceNodeId, nodes],
  );
  const openEdgeEdit = useCallback<CommonplaceEdgeData["onEdit"]>(
    (edgeId, edgeType, label, clientX, clientY) => {
      setDropError(null);
      setNodeContextMenu(null);
      setConnectionSourceNodeId(null);
      setEdgeDraft(null);
      setEdgeEdit({
        edgeId,
        edgeType,
        label: label ?? "",
        ...panelPosition(clientX, clientY, canvasPanelRef.current),
      });
    },
    [],
  );
  const updates = useMemo<CommonplaceMapNodePositionUpdate[]>(
    () =>
      nodes.map((node) => ({
        nodeId: node.id,
        position: {
          x: node.position.x,
          y: node.position.y,
        },
      })),
    [nodes],
  );

  useEffect(() => {
    let isCurrent = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);
      setDropError(null);
      setSaveStatus("Saved");
      setNodes([]);
      setEdges([]);
      setIsCanvasDragActive(false);
      setNodeContextMenu(null);
      setConnectionSourceNodeId(null);
      setEdgeDraft(null);
      setEdgeEdit(null);

      Promise.all([
        loadNodes(),
        isSubMap ? loadEdges() : Promise.resolve({ ok: true as const, edges: [] }),
      ])
        .then(([nodeResult, edgeResult]) => {
          if (!isCurrent) return;
          if (!nodeResult.ok || !edgeResult.ok) {
            setLoadError("Could not load this map canvas.");
            return;
          }
          setNodes(nodeResult.nodes.map(toReactFlowNode));
          setEdges(edgeResult.edges.map((edge) => toReactFlowEdge(edge, openEdgeEdit)));
        })
        .catch(() => {
          if (isCurrent) {
            setLoadError("Could not load this map canvas.");
          }
        })
        .finally(() => {
          if (isCurrent) setIsLoading(false);
        });
    }, 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [isSubMap, loadEdges, loadNodes, map.id, map.type, openEdgeEdit, setEdges, setNodes]);

  const cancelConnectionMode = useCallback(() => {
    setNodeContextMenu(null);
    setConnectionSourceNodeId(null);
    setEdgeDraft(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelConnectionMode();
      setEdgeEdit(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelConnectionMode]);

  const handleNodeDragStop = useCallback(
    (
      _event: ReactMouseEvent,
      node: Node<CommonplaceNoteNodeData>,
    ) => {
      if (!isSubMap) return;
      setNodes((current) =>
        current.map((currentNode) =>
          currentNode.id === node.id
            ? { ...currentNode, position: node.position }
            : currentNode,
        ),
      );
      setSaveStatus("Unsaved changes");
    },
    [isSubMap, setNodes],
  );

  const handleSave = useCallback(async () => {
    setSaveStatus("Saving...");
    const result = await saveNodePositions(updates);
    setSaveStatus(result.ok ? "Saved" : "Save failed");
  }, [saveNodePositions, updates]);

  const hasDraggedCommonplaceNote = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).some(
      (type) => type.toLowerCase() === COMMONPLACE_NOTE_DRAG_TYPE,
    );

  const parseDraggedNote = (event: DragEvent): DraggedCommonplaceNote | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        event.dataTransfer.getData(COMMONPLACE_NOTE_DRAG_TYPE),
      );
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const payload = parsed as { noteId?: unknown };
    return typeof payload.noteId === "string" && payload.noteId.trim()
      ? { noteId: payload.noteId.trim() }
      : null;
  };

  const handleDragOver = useCallback(
    (event: DragEvent) => {
      if (!hasDraggedCommonplaceNote(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = isSubMap ? "copy" : "none";
      setIsCanvasDragActive(isSubMap);
    },
    [isSubMap],
  );

  const handleDragLeave = useCallback((event: DragEvent) => {
    if (!hasDraggedCommonplaceNote(event)) return;
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      canvasPanelRef.current?.contains(nextTarget)
    ) {
      return;
    }
    setIsCanvasDragActive(false);
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent) => {
      if (!hasDraggedCommonplaceNote(event)) return;
      event.preventDefault();
      setIsCanvasDragActive(false);
      setDropError(null);

      if (!isSubMap) {
        setDropError("Main Map note drops will be enabled in a later phase.");
        return;
      }

      const draggedNote = parseDraggedNote(event);
      if (!draggedNote || !flowInstance) {
        setSaveStatus("Save failed");
        setDropError("Could not add this note to the canvas.");
        return;
      }

      const position = flowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setSaveStatus("Saving...");
      const result = await createNoteNode(draggedNote.noteId, position);
      if (!result.ok) {
        setSaveStatus("Save failed");
        setDropError(
          result.error === "unsupported"
            ? "Main Map note drops will be enabled in a later phase."
            : "Could not add this note to the canvas.",
        );
        return;
      }

      setNodes((current) => [...current, toReactFlowNode(result.node)]);
      setSaveStatus("Saved");
    },
    [createNoteNode, flowInstance, isSubMap, setNodes],
  );

  const handleNodeContextMenu = useCallback(
    (
      event: ReactMouseEvent,
      node: Node<CommonplaceNoteNodeData>,
    ) => {
      if (!isSubMap) return;
      event.preventDefault();
      event.stopPropagation();
      setDropError(null);
      setEdgeEdit(null);
      setEdgeDraft(null);
      setConnectionSourceNodeId(null);
      setNodeContextMenu({
        nodeId: node.id,
        ...panelPosition(event.clientX, event.clientY, canvasPanelRef.current),
      });
    },
    [isSubMap],
  );

  const handleStartConnection = useCallback(() => {
    if (!nodeContextMenu) return;
    setConnectionSourceNodeId(nodeContextMenu.nodeId);
    setNodeContextMenu(null);
    setEdgeEdit(null);
    setEdgeDraft(null);
    setDropError(null);
  }, [nodeContextMenu]);

  const handleNodeClick = useCallback(
    (
      event: ReactMouseEvent,
      node: Node<CommonplaceNoteNodeData>,
    ) => {
      if (!isSubMap || !connectionSourceNodeId) return;
      event.stopPropagation();
      setDropError(null);

      if (node.id === connectionSourceNodeId) {
        setDropError("Choose a different note node to connect.");
        return;
      }

      setEdgeDraft({
        sourceNodeId: connectionSourceNodeId,
        targetNodeId: node.id,
        edgeType: "solid",
        label: "",
        ...panelPosition(event.clientX, event.clientY, canvasPanelRef.current),
      });
      setConnectionSourceNodeId(null);
      setNodeContextMenu(null);
      setEdgeEdit(null);
    },
    [connectionSourceNodeId, isSubMap],
  );

  const handlePaneClick = useCallback(() => {
    cancelConnectionMode();
    setEdgeEdit(null);
  }, [cancelConnectionMode]);

  const handleCreateEdge = useCallback(async () => {
    if (!edgeDraft) return;

    setSaveStatus("Saving...");
    setDropError(null);
    const result = await createEdge({
      sourceNodeId: edgeDraft.sourceNodeId,
      targetNodeId: edgeDraft.targetNodeId,
      edgeType: edgeDraft.edgeType,
      label: edgeDraft.label,
    });

    if (!result.ok) {
      setSaveStatus("Save failed");
      setDropError("Could not save this connection.");
      return;
    }

    setEdges((current) => [...current, toReactFlowEdge(result.edge, openEdgeEdit)]);
    setEdgeDraft(null);
    setSaveStatus("Saved");
  }, [createEdge, edgeDraft, openEdgeEdit, setEdges]);

  const handleEdgeClick = useCallback(
    (event: ReactMouseEvent, edge: Edge<CommonplaceEdgeData>) => {
      if (!isSubMap) return;
      event.stopPropagation();
      setDropError(null);
      setNodeContextMenu(null);
      setConnectionSourceNodeId(null);
      setEdgeDraft(null);
      setEdgeEdit({
        edgeId: edge.id,
        edgeType: edge.data?.edgeType ?? "solid",
        label: edge.data?.label ?? "",
        ...panelPosition(event.clientX, event.clientY, canvasPanelRef.current),
      });
    },
    [isSubMap],
  );

  const handleSelectionChange = useCallback(
    ({ edges: selectedEdges }: { edges: Edge<CommonplaceEdgeData>[] }) => {
      if (
        !isSubMap ||
        selectedEdges.length === 0 ||
        edgeDraft ||
        nodeContextMenu ||
        connectionSourceNodeId
      ) {
        return;
      }

      const selectedEdge = selectedEdges[0];
      setDropError(null);
      setEdgeEdit({
        edgeId: selectedEdge.id,
        edgeType: selectedEdge.data?.edgeType ?? "solid",
        label: selectedEdge.data?.label ?? "",
        ...panelPosition(
          window.innerWidth / 2,
          window.innerHeight / 2,
          canvasPanelRef.current,
        ),
      });
    },
    [connectionSourceNodeId, edgeDraft, isSubMap, nodeContextMenu],
  );

  const handleUpdateEdge = useCallback(async () => {
    if (!edgeEdit) return;

    setSaveStatus("Saving...");
    setDropError(null);
    const result = await updateEdge({
      edgeId: edgeEdit.edgeId,
      edgeType: edgeEdit.edgeType,
      label: edgeEdit.label,
    });

    if (!result.ok) {
      setSaveStatus("Save failed");
      setDropError("Could not update this connection.");
      return;
    }

    setEdges((current) =>
      current.map((edge) =>
        edge.id === result.edge.id ? toReactFlowEdge(result.edge, openEdgeEdit) : edge,
      ),
    );
    setEdgeEdit(null);
    setSaveStatus("Saved");
  }, [edgeEdit, openEdgeEdit, setEdges, updateEdge]);

  const handleDeleteEdge = useCallback(async () => {
    if (!edgeEdit) return;

    setSaveStatus("Saving...");
    setDropError(null);
    const result = await deleteEdge(edgeEdit.edgeId);
    if (!result.ok) {
      setSaveStatus("Save failed");
      setDropError("Could not delete this connection.");
      return;
    }

    setEdges((current) => current.filter((edge) => edge.id !== edgeEdit.edgeId));
    setEdgeEdit(null);
    setSaveStatus("Saved");
  }, [deleteEdge, edgeEdit, setEdges]);

  return (
    <section
      className="flex min-h-0 flex-col rounded-xl border border-[var(--brand-border)] bg-white"
      data-testid="commonplace-map-canvas"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--brand-border)] px-4 py-4 sm:px-5">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 rounded-lg border border-[var(--brand-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface)]"
          >
            {isSubMap ? "Back to Sub Mind Maps" : "Back to Main Maps"}
          </button>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal)]">
            {isSubMap ? "Sub Mind Map" : "Main Map"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
            {map.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
            Canvas foundation
          </p>
          {isSubMap && noteContext && (
            <p className="mt-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-ink-soft)]">
              Opened from {noteContext.shortcode}: {noteContext.title}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1 text-xs font-semibold text-[var(--brand-ink-soft)]"
            data-testid="commonplace-map-save-status"
          >
            {saveStatus}
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveStatus === "Saving..." || isLoading}
            className="rounded-lg bg-[var(--brand-teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1C8A7A] disabled:cursor-not-allowed disabled:opacity-70"
            data-testid="commonplace-map-save-button"
          >
            Save
          </button>
        </div>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mx-4 mt-4 rounded-lg border border-[#B42318]/20 bg-[#FFF4F3] px-4 py-3 text-sm text-[#8A1F15] sm:mx-5"
        >
          {loadError}
        </p>
      )}
      {dropError && (
        <p
          role="alert"
          className="mx-4 mt-4 rounded-lg border border-[#B42318]/20 bg-[#FFF4F3] px-4 py-3 text-sm text-[#8A1F15] sm:mx-5"
        >
          {dropError}
        </p>
      )}

      <div
        ref={canvasPanelRef}
        className={`relative h-[min(68dvh,720px)] min-h-[460px] overflow-hidden bg-[#F8FAF8] transition-shadow ${
          isCanvasDragActive
            ? "ring-2 ring-inset ring-[var(--brand-teal)]/45"
            : ""
        }`}
      >
        <ReactFlow
          nodes={visibleNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onSelectionChange={handleSelectionChange}
          onInit={setFlowInstance}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(event) => void handleDrop(event)}
          fitView
          nodesConnectable={false}
          nodesDraggable
          panOnDrag
          zoomOnPinch
          zoomOnScroll
          connectOnClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#D7E6E2" gap={24} size={1} />
          <MiniMap pannable zoomable nodeStrokeWidth={3} />
          <Controls showInteractive={false} />
        </ReactFlow>

        {isSubMap && isCanvasDragActive && (
          <div
            className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--brand-teal)] bg-white/60 text-sm font-semibold text-[var(--brand-teal-ink)] shadow-inner"
            data-testid="commonplace-map-drop-zone"
          >
            Drop note here
          </div>
        )}

        {!isLoading && !loadError && nodes.length === 0 && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-6"
            data-testid="commonplace-map-empty-state"
          >
            <p className="max-w-sm rounded-xl border border-[var(--brand-border)] bg-white/95 px-4 py-3 text-center text-sm font-medium leading-6 text-[var(--brand-ink-soft)] shadow-sm">
              {isSubMap
                ? "Canvas is ready. Drag notes from the sidebar to add them here."
                : "Canvas is ready. Drag notes from the sidebar will be added in the next phase."}
            </p>
          </div>
        )}

        {isSubMap && nodeContextMenu && (
          <div
            className="absolute z-50 w-48 rounded-lg border border-[var(--brand-border)] bg-white p-2 text-sm shadow-lg"
            style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
            data-testid="commonplace-map-node-context-menu"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleStartConnection}
              className="w-full rounded-md px-3 py-2 text-left font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
              data-testid="commonplace-map-connect-idea"
            >
              Connect idea
            </button>
            <button
              type="button"
              onClick={cancelConnectionMode}
              className="mt-1 w-full rounded-md px-3 py-2 text-left text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
            >
              Cancel
            </button>
          </div>
        )}

        {isSubMap && connectionSourceNode && (
          <div
            className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-[var(--brand-teal)]/25 bg-white px-3 py-2 text-sm font-medium text-[var(--brand-ink)] shadow-sm"
            data-testid="commonplace-map-connection-mode"
          >
            Connecting from {connectionSourceNode.data.shortcode}. Click a target note.
          </div>
        )}

        {isSubMap && edgeDraft && (
          <div
            className="absolute z-50 w-72 rounded-lg border border-[var(--brand-border)] bg-white p-4 text-sm shadow-lg"
            style={{ left: edgeDraft.x, top: edgeDraft.y }}
            data-testid="commonplace-map-edge-create-popover"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-semibold text-[var(--brand-ink)]">
              Create connection
            </p>
            <label className="mt-3 block text-xs font-semibold text-[var(--brand-ink)]">
              Relationship type
              <select
                value={edgeDraft.edgeType}
                onChange={(event) =>
                  setEdgeDraft((current) =>
                    current
                      ? {
                          ...current,
                          edgeType: event.target.value as CommonplaceMindMapEdgeType,
                        }
                      : current,
                  )
                }
                className="mt-1 w-full rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--brand-ink)] focus:border-[var(--brand-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/20"
                data-testid="commonplace-map-edge-type-select"
              >
                <option value="solid">Solid / direct</option>
                <option value="dashed">Dashed / speculative</option>
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold text-[var(--brand-ink)]">
              Label
              <input
                value={edgeDraft.label}
                onChange={(event) =>
                  setEdgeDraft((current) =>
                    current ? { ...current, label: event.target.value } : current,
                  )
                }
                maxLength={80}
                placeholder="Optional label"
                className="mt-1 w-full rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm font-normal text-[var(--brand-ink)] focus:border-[var(--brand-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/20"
                data-testid="commonplace-map-edge-label-input"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelConnectionMode}
                className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateEdge()}
                disabled={isSavingMapChange}
                className="rounded-lg bg-[var(--brand-teal)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-teal-ink)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {isSubMap && edgeEdit && (
          <div
            className="absolute z-50 w-72 rounded-lg border border-[var(--brand-border)] bg-white p-4 text-sm shadow-lg"
            style={{ left: edgeEdit.x, top: edgeEdit.y }}
            data-testid="commonplace-map-edge-edit-popover"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-semibold text-[var(--brand-ink)]">
              Edit connection
            </p>
            <label className="mt-3 block text-xs font-semibold text-[var(--brand-ink)]">
              Relationship type
              <select
                value={edgeEdit.edgeType}
                onChange={(event) =>
                  setEdgeEdit((current) =>
                    current
                      ? {
                          ...current,
                          edgeType: event.target.value as CommonplaceMindMapEdgeType,
                        }
                      : current,
                  )
                }
                className="mt-1 w-full rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--brand-ink)] focus:border-[var(--brand-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/20"
              >
                <option value="solid">Solid / direct</option>
                <option value="dashed">Dashed / speculative</option>
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold text-[var(--brand-ink)]">
              Label
              <input
                value={edgeEdit.label}
                onChange={(event) =>
                  setEdgeEdit((current) =>
                    current ? { ...current, label: event.target.value } : current,
                  )
                }
                maxLength={80}
                placeholder="Optional label"
                className="mt-1 w-full rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm font-normal text-[var(--brand-ink)] focus:border-[var(--brand-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/20"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEdgeEdit(null)}
                className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteEdge()}
                disabled={isSavingMapChange}
                className="rounded-lg border border-[#B42318]/30 bg-white px-3 py-2 text-xs font-semibold text-[#8A1F15] hover:bg-[#FFF4F3] disabled:cursor-not-allowed disabled:opacity-70"
                data-testid="commonplace-map-edge-delete-button"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => void handleUpdateEdge()}
                disabled={isSavingMapChange}
                className="rounded-lg bg-[var(--brand-teal)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-teal-ink)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
