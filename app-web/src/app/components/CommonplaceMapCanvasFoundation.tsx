"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
  CommonplaceMapCanvasClusterNode,
  CommonplaceMapCanvasNode,
  CommonplaceMapCanvasNoteNode,
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
  CommonplaceClusterNode,
  type CommonplaceClusterNodeData,
} from "./CommonplaceClusterNode";
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

type CommonplaceCanvasNodeData =
  | CommonplaceNoteNodeData
  | CommonplaceClusterNodeData;

type PositionedPanel = {
  x: number;
  y: number;
};

type NodeContextMenuState = PositionedPanel & {
  nodeId: string;
  nodeType: "note" | "cluster";
  label: string;
};

type NodeDeleteConfirmState = PositionedPanel & {
  nodeId: string;
  nodeType: "note" | "cluster";
  label: string;
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
  backLabel?: string;
  subMaps?: CommonplaceMindMapSummary[];
  isSubMapLoading?: boolean;
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
  createClusterNode?: (
    subMindmapId: string,
    position: { x: number; y: number },
  ) => Promise<
    | { ok: true; node: CommonplaceMapCanvasClusterNode }
    | { ok: false; error: "unsupported" | "failed" }
  >;
  onOpenSubMap?: (subMap: {
    id: string;
    title: string;
    updatedAt: string;
  }) => void;
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
  deleteNode?: (nodeId: string) => Promise<CommonplaceMindMapDeleteResult>;
};

const COMMONPLACE_NODE_TYPES: NodeTypes = {
  noteNode: CommonplaceNoteNode,
  clusterNode: CommonplaceClusterNode,
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
  if (
    !isFiniteCoordinate(sourceX) ||
    !isFiniteCoordinate(sourceY) ||
    !isFiniteCoordinate(targetX) ||
    !isFiniteCoordinate(targetY)
  ) {
    return null;
  }

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const hasValidLabelPosition =
    isFiniteCoordinate(labelX) && isFiniteCoordinate(labelY);

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
      {hasValidLabelPosition && (
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
      )}
    </>
  );
}

const COMMONPLACE_EDGE_TYPES: EdgeTypes = {
  commonplaceEdge: CommonplaceConnectionEdge,
};

const COMMONPLACE_REACT_FLOW_PRO_OPTIONS = { hideAttribution: true };

const COMMONPLACE_NOTE_DRAG_TYPE = "application/commonplace-note";

const subMapBubbleBackgroundStyle: CSSProperties = {
  backgroundImage: [
    "radial-gradient(circle at 24% 28%, rgba(15,118,110,0.16) 0 2px, transparent 3px)",
    "radial-gradient(circle at 24% 28%, transparent 0 82px, rgba(183,212,200,0.72) 83px 85px, transparent 86px)",
    "radial-gradient(circle at 68% 34%, transparent 0 118px, rgba(183,212,200,0.58) 119px 121px, transparent 122px)",
    "radial-gradient(circle at 52% 72%, transparent 0 96px, rgba(183,212,200,0.52) 97px 99px, transparent 100px)",
    "radial-gradient(circle at 15% 82%, rgba(221,235,229,0.7) 0 34px, transparent 35px)",
    "linear-gradient(180deg, rgba(221,235,229,0.82), rgba(238,243,241,0.52))",
  ].join(", "),
};

const mainMapBackgroundStyle: CSSProperties = {
  backgroundImage: [
    "radial-gradient(circle at 18% 18%, rgba(221,235,229,0.82) 0 120px, transparent 121px)",
    "radial-gradient(circle at 82% 76%, rgba(221,235,229,0.65) 0 150px, transparent 151px)",
    "linear-gradient(180deg, #EEF3F1, #E8F0ED)",
  ].join(", "),
};

function titleForNode(node: CommonplaceMapCanvasNoteNode): string {
  return node.noteTitle?.trim() || node.noteSourceBook || "Untitled Source";
}

function isFiniteCoordinate(value: number): boolean {
  return Number.isFinite(value);
}

function safeFlowPosition(
  x: number,
  y: number,
  fallback: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  return {
    x: isFiniteCoordinate(x) ? x : fallback.x,
    y: isFiniteCoordinate(y) ? y : fallback.y,
  };
}

function toReactFlowNode(
  node: CommonplaceMapCanvasNode,
  onOpenSubMap?: CommonplaceMapCanvasFoundationProps["onOpenSubMap"],
): Node<CommonplaceCanvasNodeData> {
  const position = safeFlowPosition(node.positionX, node.positionY);

  if (node.nodeKind === "cluster") {
    return {
      id: node.id,
      type: "clusterNode",
      position,
      data: {
        subMindMapId: node.subMindMapId,
        title: node.subMindMapTitle,
        updatedAt: node.subMindMapUpdatedAt,
        onOpenSubMap,
      },
    };
  }

  return {
    id: node.id,
    type: "noteNode",
    position,
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
      stroke: isDashed ? "#5F7D74" : "#2F6B61",
      strokeWidth: 2.5,
      strokeDasharray: isDashed ? "7 5" : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: isDashed ? "#5F7D74" : "#2F6B61",
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 6,
    labelBgStyle: { fill: "#FFFFFF", fillOpacity: 0.9 },
  };
}

function labelForFlowNode(node: Node<CommonplaceCanvasNodeData>): string {
  if (node.type === "clusterNode") {
    return (node.data as CommonplaceClusterNodeData).title;
  }

  const noteData = node.data as CommonplaceNoteNodeData;
  return noteData.title || noteData.shortcode;
}

function panelPosition(
  clientX: number,
  clientY: number,
  container: HTMLDivElement | null,
): PositionedPanel | null {
  if (!isFiniteCoordinate(clientX) || !isFiniteCoordinate(clientY)) {
    return null;
  }

  const rect = container?.getBoundingClientRect();
  if (!rect) {
    if (typeof window === "undefined") return { x: clientX, y: clientY };

    return {
      x: Math.min(Math.max(12, clientX), Math.max(12, window.innerWidth - 260)),
      y: Math.min(Math.max(12, clientY), Math.max(12, window.innerHeight - 220)),
    };
  }

  if (
    !isFiniteCoordinate(rect.left) ||
    !isFiniteCoordinate(rect.top) ||
    !isFiniteCoordinate(rect.width) ||
    !isFiniteCoordinate(rect.height)
  ) {
    return null;
  }

  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  if (!isFiniteCoordinate(localX) || !isFiniteCoordinate(localY)) {
    return null;
  }

  return {
    x: Math.min(Math.max(12, localX), Math.max(12, rect.width - 280)),
    y: Math.min(Math.max(12, localY), Math.max(12, rect.height - 240)),
  };
}

export function CommonplaceMapCanvasFoundation({
  map,
  noteContext,
  onBack,
  backLabel,
  subMaps = [],
  isSubMapLoading = false,
  loadNodes,
  loadEdges,
  saveNodePositions,
  createNoteNode,
  createClusterNode,
  onOpenSubMap,
  createEdge,
  updateEdge,
  deleteEdge,
  deleteNode,
}: CommonplaceMapCanvasFoundationProps) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CommonplaceCanvasNodeData>([]);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<CommonplaceEdgeData>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Saved");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isCanvasDragActive, setIsCanvasDragActive] = useState(false);
  const [isClusterChooserOpen, setIsClusterChooserOpen] = useState(false);
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<CommonplaceCanvasNodeData> | null>(null);
  const canvasPanelRef = useRef<HTMLDivElement | null>(null);
  const [reactFlowNodeTypes] = useState(() => COMMONPLACE_NODE_TYPES);
  const [reactFlowEdgeTypes] = useState(() => COMMONPLACE_EDGE_TYPES);
  const [reactFlowProOptions] = useState(() => COMMONPLACE_REACT_FLOW_PRO_OPTIONS);
  const [nodeContextMenu, setNodeContextMenu] =
    useState<NodeContextMenuState | null>(null);
  const [nodeDeleteConfirm, setNodeDeleteConfirm] =
    useState<NodeDeleteConfirmState | null>(null);
  const [connectionSourceNodeId, setConnectionSourceNodeId] =
    useState<string | null>(null);
  const [connectionSourcePoint, setConnectionSourcePoint] =
    useState<PositionedPanel | null>(null);
  const [connectionPointer, setConnectionPointer] =
    useState<PositionedPanel | null>(null);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraftState | null>(null);
  const [edgeEdit, setEdgeEdit] = useState<EdgeEditState | null>(null);
  const savedNodePositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  const isSubMap = map.type === "sub";
  const isMainMap = map.type === "main";
  const supportsEdges = isSubMap || isMainMap;
  const isSavingMapChange = saveStatus === "Saving...";
  const displayedSaveStatus: SaveStatus =
    saveStatus === "Saving..." || saveStatus === "Save failed"
      ? saveStatus
      : hasUnsavedChanges
        ? "Unsaved changes"
        : "Saved";
  const hasSaveFailure = saveStatus === "Save failed";
  const canSaveMap =
    !isLoading &&
    !isSavingMapChange &&
    (hasUnsavedChanges || hasSaveFailure);
  const connectionSourceNode = useMemo(
    () =>
      nodes.find((node) => node.id === connectionSourceNodeId) ?? null,
    [connectionSourceNodeId, nodes],
  );
  const connectionSourceLabel =
    connectionSourceNode?.type === "noteNode"
      ? (connectionSourceNode.data as CommonplaceNoteNodeData).shortcode
      : connectionSourceNode?.type === "clusterNode"
        ? (connectionSourceNode.data as CommonplaceClusterNodeData).title
        : "";
  const visibleNodes = useMemo<Node<CommonplaceCanvasNodeData>[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        data:
          node.type === "noteNode"
            ? {
                ...(node.data as CommonplaceNoteNodeData),
                connectionRole: connectionSourceNodeId
                  ? node.id === connectionSourceNodeId
                    ? "source"
                    : "target"
              : null,
              }
            : node.type === "clusterNode"
              ? {
                  ...(node.data as CommonplaceClusterNodeData),
                  connectionRole: connectionSourceNodeId
                    ? node.id === connectionSourceNodeId
                      ? "source"
                      : "target"
                    : null,
                }
              : node.data,
      })),
    [connectionSourceNodeId, nodes],
  );
  const connectionPreview =
    connectionSourcePoint && connectionPointer
      ? {
          x1: connectionSourcePoint.x,
          y1: connectionSourcePoint.y,
          x2: connectionPointer.x,
          y2: connectionPointer.y,
        }
      : null;
  const rememberSavedNodePositions = useCallback(
    (nextNodes: Node<CommonplaceCanvasNodeData>[]) => {
      savedNodePositionsRef.current = new Map(
        nextNodes.map((node) => [
          node.id,
          { x: node.position.x, y: node.position.y },
        ]),
      );
    },
    [],
  );
  const nodesHavePositionChanges = useCallback(
    (nextNodes: Node<CommonplaceCanvasNodeData>[]) =>
      nextNodes.some((node) => {
        const savedPosition = savedNodePositionsRef.current.get(node.id);
        return (
          !savedPosition ||
          savedPosition.x !== node.position.x ||
          savedPosition.y !== node.position.y
        );
      }),
    [],
  );
  const openEdgeEdit = useCallback<CommonplaceEdgeData["onEdit"]>(
    (edgeId, edgeType, label, clientX, clientY) => {
      const position = panelPosition(clientX, clientY, canvasPanelRef.current);
      if (!position) return;

      setDropError(null);
      setNodeContextMenu(null);
      setNodeDeleteConfirm(null);
      setConnectionSourceNodeId(null);
      setEdgeDraft(null);
      setEdgeEdit({
        edgeId,
        edgeType,
        label: label ?? "",
        ...position,
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
      setHasUnsavedChanges(false);
      savedNodePositionsRef.current = new Map();
      setNodes([]);
      setEdges([]);
      setIsCanvasDragActive(false);
      setIsClusterChooserOpen(false);
      setNodeContextMenu(null);
      setNodeDeleteConfirm(null);
      setConnectionSourceNodeId(null);
      setConnectionSourcePoint(null);
      setConnectionPointer(null);
      setEdgeDraft(null);
      setEdgeEdit(null);

      Promise.all([
        loadNodes(),
        loadEdges(),
      ])
        .then(([nodeResult, edgeResult]) => {
          if (!isCurrent) return;
          if (!nodeResult.ok || !edgeResult.ok) {
            setLoadError("Could not load this map canvas.");
            return;
          }
          const nextNodes = nodeResult.nodes.map((node) =>
            toReactFlowNode(node, onOpenSubMap),
          );
          rememberSavedNodePositions(nextNodes);
          setNodes(nextNodes);
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
  }, [
    loadEdges,
    loadNodes,
    map.id,
    map.type,
    onOpenSubMap,
    openEdgeEdit,
    rememberSavedNodePositions,
    setEdges,
    setNodes,
  ]);

  const cancelConnectionMode = useCallback(() => {
    setNodeContextMenu(null);
    setNodeDeleteConfirm(null);
    setConnectionSourceNodeId(null);
    setConnectionSourcePoint(null);
    setConnectionPointer(null);
    setEdgeDraft(null);
  }, [
    setConnectionPointer,
    setConnectionSourceNodeId,
    setConnectionSourcePoint,
    setEdgeDraft,
    setNodeContextMenu,
  ]);

  const getNodeCenterPoint = useCallback((nodeId: string) => {
    const panel = canvasPanelRef.current;
    if (!panel) return null;

    const sourceElement = panel.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`,
    );
    const sourceRect = sourceElement?.getBoundingClientRect();
    if (!sourceRect) return null;

    const panelRect = panel.getBoundingClientRect();
    const point = {
      x: sourceRect.left - panelRect.left + sourceRect.width / 2,
      y: sourceRect.top - panelRect.top + sourceRect.height / 2,
    };
    return isFiniteCoordinate(point.x) && isFiniteCoordinate(point.y)
      ? point
      : null;
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
      node: Node<CommonplaceCanvasNodeData>,
    ) => {
      const nextNodes = nodes.map((currentNode) =>
        currentNode.id === node.id
          ? { ...currentNode, position: node.position }
          : currentNode,
      );
      const hasPositionChanges = nodesHavePositionChanges(nextNodes);
      if (!hasPositionChanges && !hasUnsavedChanges) return;

      setNodes(nextNodes);
      setDropError(null);
      setHasUnsavedChanges(hasPositionChanges);
      setSaveStatus(hasPositionChanges ? "Unsaved changes" : "Saved");
    },
    [hasUnsavedChanges, nodes, nodesHavePositionChanges, setNodes],
  );

  const handleSave = useCallback(async () => {
    if (isSavingMapChange) return;
    setSaveStatus("Saving...");
    setDropError(null);
    const result = await saveNodePositions(updates);
    if (!result.ok) {
      setSaveStatus("Save failed");
      setDropError("Could not save map. Please try again. Your local changes are still visible.");
      return;
    }

    setHasUnsavedChanges(false);
    rememberSavedNodePositions(nodes);
    setSaveStatus("Saved");
  }, [
    isSavingMapChange,
    nodes,
    rememberSavedNodePositions,
    saveNodePositions,
    updates,
  ]);

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
      event.dataTransfer.dropEffect = "copy";
      setIsCanvasDragActive(true);
    },
    [],
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
      const safePosition = safeFlowPosition(position.x, position.y, {
        x: 140 + nodes.length * 32,
        y: 120 + nodes.length * 24,
      });

      setSaveStatus("Saving...");
      const result = await createNoteNode(draggedNote.noteId, safePosition);
      if (!result.ok) {
        setSaveStatus("Save failed");
        setDropError(
          result.error === "unsupported"
            ? "Note drops are not available for this map."
            : "Could not add this note to the canvas.",
        );
        return;
      }

      const nextNode = toReactFlowNode(result.node, onOpenSubMap);
      setNodes((current) => {
        const nextNodes = [...current, nextNode];
        if (!isMainMap) {
          rememberSavedNodePositions(nextNodes);
        }
        return nextNodes;
      });
      setIsClusterChooserOpen(false);
      if (isMainMap) {
        setHasUnsavedChanges(true);
        setSaveStatus("Unsaved changes");
      } else {
        setSaveStatus("Saved");
      }
    },
    [
      createNoteNode,
      flowInstance,
      isMainMap,
      nodes.length,
      onOpenSubMap,
      rememberSavedNodePositions,
      setNodes,
    ],
  );

  const defaultClusterPosition = useCallback(() => {
    const rect = canvasPanelRef.current?.getBoundingClientRect();
    if (flowInstance && rect) {
      const position = flowInstance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + Math.min(rect.height / 2, 280),
      });
      return safeFlowPosition(position.x, position.y, {
        x: 140 + nodes.length * 32,
        y: 120 + nodes.length * 24,
      });
    }

    return {
      x: 140 + nodes.length * 32,
      y: 120 + nodes.length * 24,
    };
  }, [flowInstance, nodes.length]);

  const handleCreateClusterNode = useCallback(
    async (subMap: CommonplaceMindMapSummary) => {
      if (!isMainMap || !createClusterNode) return;

      setSaveStatus("Saving...");
      setDropError(null);
      const result = await createClusterNode(subMap.id, defaultClusterPosition());
      if (!result.ok) {
        setSaveStatus("Save failed");
        setDropError(
          result.error === "unsupported"
            ? "Main Map note nodes will be enabled in a later phase."
            : "Could not add this Sub Mind Map cluster.",
        );
        return;
      }

      setNodes((current) => [
        ...current,
        toReactFlowNode(result.node, onOpenSubMap),
      ]);
      setIsClusterChooserOpen(false);
      setHasUnsavedChanges(true);
      setSaveStatus("Unsaved changes");
    },
    [
      createClusterNode,
      defaultClusterPosition,
      isMainMap,
      onOpenSubMap,
      setNodes,
    ],
  );

  const handleNodeContextMenu = useCallback(
    (
      event: ReactMouseEvent,
      node: Node<CommonplaceCanvasNodeData>,
    ) => {
      const isConnectableNode =
        (isSubMap && node.type === "noteNode") ||
        (isMainMap && (node.type === "clusterNode" || node.type === "noteNode"));
      const isMainMapVisualNode =
        isMainMap && (node.type === "noteNode" || node.type === "clusterNode");
      if (!isConnectableNode && !isMainMapVisualNode) return;
      event.preventDefault();
      event.stopPropagation();
      const position =
        panelPosition(event.clientX, event.clientY, canvasPanelRef.current) ??
        getNodeCenterPoint(node.id);
      if (!position) return;

      setDropError(null);
      setEdgeEdit(null);
      setEdgeDraft(null);
      setNodeDeleteConfirm(null);
      setConnectionSourceNodeId(null);
      setNodeContextMenu({
        nodeId: node.id,
        nodeType: node.type === "clusterNode" ? "cluster" : "note",
        label: labelForFlowNode(node),
        ...position,
      });
    },
    [getNodeCenterPoint, isMainMap, isSubMap],
  );

  const handleStartConnection = useCallback(() => {
    if (!nodeContextMenu) return;
    setConnectionSourceNodeId(nodeContextMenu.nodeId);
    const sourcePoint = getNodeCenterPoint(nodeContextMenu.nodeId);
    setConnectionSourcePoint(sourcePoint);
    setConnectionPointer(sourcePoint);
    setNodeContextMenu(null);
    setNodeDeleteConfirm(null);
    setEdgeEdit(null);
    setEdgeDraft(null);
    setDropError(null);
  }, [
    getNodeCenterPoint,
    nodeContextMenu,
    setConnectionPointer,
    setConnectionSourceNodeId,
    setConnectionSourcePoint,
    setDropError,
    setEdgeDraft,
    setEdgeEdit,
    setNodeContextMenu,
  ]);

  const handleNodeClick = useCallback(
    (
      event: ReactMouseEvent,
      node: Node<CommonplaceCanvasNodeData>,
    ) => {
      if (!supportsEdges || !connectionSourceNodeId) return;
      const isConnectableNode =
        (isSubMap && node.type === "noteNode") ||
        (isMainMap && (node.type === "clusterNode" || node.type === "noteNode"));
      if (!isConnectableNode) return;
      event.stopPropagation();
      setDropError(null);

      if (node.id === connectionSourceNodeId) {
        setDropError(
          isMainMap
            ? "Choose a different visual node to connect."
            : "Choose a different note node to connect.",
        );
        return;
      }

      const position =
        panelPosition(event.clientX, event.clientY, canvasPanelRef.current) ??
        getNodeCenterPoint(node.id);
      if (!position) return;

      setEdgeDraft({
        sourceNodeId: connectionSourceNodeId,
        targetNodeId: node.id,
        edgeType: "solid",
        label: "",
        ...position,
      });
      setConnectionSourceNodeId(null);
      setConnectionSourcePoint(null);
      setConnectionPointer(null);
      setNodeContextMenu(null);
      setEdgeEdit(null);
    },
    [
      connectionSourceNodeId,
      getNodeCenterPoint,
      isMainMap,
      isSubMap,
      setConnectionPointer,
      setConnectionSourceNodeId,
      setConnectionSourcePoint,
      setDropError,
      setEdgeDraft,
      setEdgeEdit,
      setNodeContextMenu,
      supportsEdges,
    ],
  );

  const handlePaneClick = useCallback(() => {
    cancelConnectionMode();
    setEdgeEdit(null);
    setNodeDeleteConfirm(null);
  }, [cancelConnectionMode, setEdgeEdit]);

  const handleCanvasMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!connectionSourceNodeId || !canvasPanelRef.current) return;
      const rect = canvasPanelRef.current.getBoundingClientRect();
      if (!connectionSourcePoint) {
        setConnectionSourcePoint(getNodeCenterPoint(connectionSourceNodeId));
      }
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (!isFiniteCoordinate(x) || !isFiniteCoordinate(y)) return;

      setConnectionPointer({
        x,
        y,
      });
    },
    [
      connectionSourceNodeId,
      connectionSourcePoint,
      getNodeCenterPoint,
      setConnectionPointer,
      setConnectionSourcePoint,
    ],
  );

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
    setConnectionSourcePoint(null);
    setConnectionPointer(null);
    setSaveStatus("Saved");
  }, [
    createEdge,
    edgeDraft,
    openEdgeEdit,
    setConnectionPointer,
    setConnectionSourcePoint,
    setEdgeDraft,
    setEdges,
    setSaveStatus,
  ]);

  const handleEdgeClick = useCallback(
    (event: ReactMouseEvent, edge: Edge<CommonplaceEdgeData>) => {
      if (!supportsEdges) return;
      event.stopPropagation();
      const position = panelPosition(event.clientX, event.clientY, canvasPanelRef.current);
      if (!position) return;

      setDropError(null);
      setNodeContextMenu(null);
      setNodeDeleteConfirm(null);
      setConnectionSourceNodeId(null);
      setConnectionSourcePoint(null);
      setConnectionPointer(null);
      setEdgeDraft(null);
      setEdgeEdit({
        edgeId: edge.id,
        edgeType: edge.data?.edgeType ?? "solid",
        label: edge.data?.label ?? "",
        ...position,
      });
    },
    [
      setConnectionPointer,
      setConnectionSourceNodeId,
      setConnectionSourcePoint,
      setDropError,
      setEdgeDraft,
      setEdgeEdit,
      setNodeContextMenu,
      supportsEdges,
    ],
  );

  const handleSelectionChange = useCallback(
    ({ edges: selectedEdges }: { edges: Edge<CommonplaceEdgeData>[] }) => {
      if (
        !supportsEdges ||
        selectedEdges.length === 0 ||
        edgeDraft ||
        nodeContextMenu ||
        connectionSourceNodeId
      ) {
        return;
      }

      const selectedEdge = selectedEdges[0];
      const position = panelPosition(
        window.innerWidth / 2,
        window.innerHeight / 2,
        canvasPanelRef.current,
      );
      if (!position) return;

      setDropError(null);
      setEdgeEdit({
        edgeId: selectedEdge.id,
        edgeType: selectedEdge.data?.edgeType ?? "solid",
        label: selectedEdge.data?.label ?? "",
        ...position,
      });
    },
    [connectionSourceNodeId, edgeDraft, nodeContextMenu, supportsEdges],
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

  const handleAskDeleteVisualNode = useCallback(() => {
    if (!nodeContextMenu || !isMainMap) return;

    setNodeDeleteConfirm({
      nodeId: nodeContextMenu.nodeId,
      nodeType: nodeContextMenu.nodeType,
      label: nodeContextMenu.label,
      x: nodeContextMenu.x,
      y: nodeContextMenu.y,
    });
    setNodeContextMenu(null);
    setConnectionSourceNodeId(null);
    setConnectionSourcePoint(null);
    setConnectionPointer(null);
    setEdgeDraft(null);
    setEdgeEdit(null);
    setDropError(null);
  }, [
    isMainMap,
    nodeContextMenu,
    setConnectionPointer,
    setConnectionSourceNodeId,
    setConnectionSourcePoint,
    setDropError,
    setEdgeDraft,
    setEdgeEdit,
    setNodeContextMenu,
  ]);

  const handleDeleteVisualNode = useCallback(async () => {
    if (!nodeDeleteConfirm || !isMainMap || !deleteNode) return;

    setSaveStatus("Saving...");
    setDropError(null);
    const result = await deleteNode(nodeDeleteConfirm.nodeId);
    if (!result.ok) {
      setSaveStatus("Save failed");
      setDropError("Could not delete this visual node.");
      return;
    }

    const deletedNodeId = nodeDeleteConfirm.nodeId;
    savedNodePositionsRef.current.delete(deletedNodeId);
    setNodes((current) => {
      const nextNodes = current.filter((node) => node.id !== deletedNodeId);
      setHasUnsavedChanges(nodesHavePositionChanges(nextNodes));
      return nextNodes;
    });
    setEdges((current) =>
      current.filter(
        (edge) => edge.source !== deletedNodeId && edge.target !== deletedNodeId,
      ),
    );
    setNodeDeleteConfirm(null);
    setConnectionSourceNodeId(null);
    setConnectionSourcePoint(null);
    setConnectionPointer(null);
    setEdgeDraft(null);
    setEdgeEdit(null);
    setSaveStatus("Saved");
  }, [
    deleteNode,
    isMainMap,
    nodeDeleteConfirm,
    nodesHavePositionChanges,
    setConnectionPointer,
    setConnectionSourceNodeId,
    setConnectionSourcePoint,
    setEdgeDraft,
    setEdgeEdit,
    setEdges,
    setNodes,
  ]);

  return (
    <section
      className="flex min-h-0 flex-col rounded-xl border border-[#C9D8D1] bg-[#FAF8F2]"
      data-testid="commonplace-map-canvas"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#C9D8D1] px-4 py-4 sm:px-5">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 rounded-lg border border-[var(--brand-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface)]"
          >
            {backLabel ?? (isSubMap ? "Back to Sub Mind Maps" : "Back to Main Maps")}
          </button>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal)]">
            {isSubMap ? "Sub Mind Map" : "Main Map"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
            {map.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
            {isMainMap
              ? "Clusters organize saved sub maps. Notes are individual ideas."
              : "Drag notes, move ideas, and connect relationships."}
          </p>
          {isSubMap && noteContext && (
            <p className="mt-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-ink-soft)]">
              Opened from {noteContext.shortcode}: {noteContext.title}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isMainMap && (
            <>
              <span
                className="rounded-full border border-[#C9D8D1] bg-white px-3 py-1 text-xs font-semibold text-[#36564C]"
                data-testid="commonplace-map-note-drag-guidance"
              >
                Drag notes from the sidebar
              </span>
              <button
                type="button"
                onClick={() => setIsClusterChooserOpen((current) => !current)}
                className="rounded-lg border border-[var(--brand-teal)]/25 bg-[var(--brand-teal-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand-teal-ink)] transition-colors hover:bg-[#BFEDE5]"
                data-testid="commonplace-map-add-cluster-button"
              >
                + Add cluster
              </button>
            </>
          )}
          <span
            aria-live="polite"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              displayedSaveStatus === "Unsaved changes"
                ? "border-[#D99A25]/35 bg-[#FFF4D8] text-[#7A4A00]"
                : displayedSaveStatus === "Saving..."
                  ? "border-[#0F766E]/25 bg-[#DDEBE5] text-[#134E44]"
                  : displayedSaveStatus === "Save failed"
                    ? "border-[#B42318]/25 bg-[#FFF4F3] text-[#8A1F15]"
                    : "border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-ink-soft)]"
            }`}
            data-testid="commonplace-map-save-status"
          >
            {displayedSaveStatus}
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSaveMap}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
              displayedSaveStatus === "Unsaved changes" ||
              displayedSaveStatus === "Save failed"
                ? "bg-[var(--brand-teal)] text-white hover:bg-[#1C8A7A]"
                : displayedSaveStatus === "Saving..."
                  ? "bg-[#0F766E]/80 text-white"
                  : "border border-[var(--brand-border)] bg-white text-[var(--brand-ink-soft)]"
            }`}
            data-testid="commonplace-map-save-button"
          >
            {displayedSaveStatus === "Saving..."
              ? "Saving..."
              : displayedSaveStatus === "Saved"
                ? "Saved"
                : "Save"}
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
        onMouseMove={handleCanvasMouseMove}
        className={`relative h-[min(68dvh,720px)] min-h-[460px] overflow-hidden transition-shadow ${
          isSubMap ? "bg-[#EEF3F1]" : "bg-[#EEF3F1]"
        } ${
          isCanvasDragActive
            ? "ring-2 ring-inset ring-[var(--brand-teal)]/45"
            : ""
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={isSubMap ? subMapBubbleBackgroundStyle : mainMapBackgroundStyle}
          data-testid={isSubMap ? "commonplace-map-bubble-background" : "commonplace-map-main-background"}
        />
        {isSubMap && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-0"
            data-testid="commonplace-map-bubble-background-legacy"
          />
        )}
        {isMainMap && isClusterChooserOpen && (
          <div
            className="absolute left-4 top-4 z-30 w-[min(22rem,calc(100%-2rem))] rounded-xl border border-[var(--brand-border)] bg-white p-3 text-sm shadow-lg"
            data-testid="commonplace-map-cluster-chooser"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--brand-ink)]">
                  Add cluster
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--brand-ink-soft)]">
                  Choose a saved Sub Mind Map to place as a cluster.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsClusterChooserOpen(false)}
                className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface)]"
              >
                Close
              </button>
            </div>
            <div className="mt-3 max-h-64 overflow-y-auto pr-1">
              {isSubMapLoading ? (
                <p className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-xs text-[var(--brand-ink-soft)]">
                  Loading Sub Mind Maps...
                </p>
              ) : subMaps.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-3 py-2 text-xs text-[var(--brand-ink-soft)]">
                  No Sub Mind Maps available.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {subMaps.map((subMap) => (
                    <button
                      key={subMap.id}
                      type="button"
                      onClick={() => void handleCreateClusterNode(subMap)}
                      disabled={isSavingMapChange}
                      className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-left transition-colors hover:border-[var(--brand-teal)]/35 hover:bg-[var(--brand-teal-soft)] disabled:cursor-not-allowed disabled:opacity-70"
                      data-testid="commonplace-map-cluster-option"
                    >
                      <span className="block text-sm font-semibold text-[var(--brand-ink)]">
                        {subMap.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium text-[var(--brand-ink-soft)]">
                        Sub Map
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <ReactFlow
          className="relative z-10 bg-transparent [&_.react-flow__connection-path]:!stroke-[#0F766E] [&_.react-flow__connection-path]:!stroke-[3px] [&_.react-flow__controls]:!z-40 [&_.react-flow__controls]:!pointer-events-auto [&_.react-flow__controls-button]:!pointer-events-auto [&_.react-flow__controls-button]:!border-[#C9D8D1] [&_.react-flow__controls-button]:!bg-white [&_.react-flow__controls-button]:!text-[#0F766E] [&_.react-flow__minimap]:!z-30 [&_.react-flow__pane]:!cursor-grab"
          nodes={visibleNodes}
          edges={edges}
          nodeTypes={reactFlowNodeTypes}
          edgeTypes={reactFlowEdgeTypes}
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
          proOptions={reactFlowProOptions}
        >
          <Background color="#B7D4C8" gap={24} size={1.2} />
          <MiniMap pannable zoomable nodeStrokeWidth={3} maskColor="rgba(238,243,241,0.72)" />
          <Controls showInteractive={false} />
        </ReactFlow>

        {connectionPreview && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20"
            data-testid="commonplace-map-connection-preview"
          >
            <line
              x1={connectionPreview.x1}
              y1={connectionPreview.y1}
              x2={connectionPreview.x2}
              y2={connectionPreview.y2}
              stroke="#0F766E"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 7"
            />
            <circle
              cx={connectionPreview.x2}
              cy={connectionPreview.y2}
              r="5"
              fill="#0F766E"
            />
          </svg>
        )}

        {isCanvasDragActive && (
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
                : "Add a saved Sub Mind Map as a cluster, or drag notes from the sidebar."}
            </p>
          </div>
        )}

        {supportsEdges && nodeContextMenu && (
          <div
            className="absolute z-50 w-56 rounded-lg border border-[var(--brand-border)] bg-white p-2 text-sm shadow-lg"
            style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
            data-testid="commonplace-map-node-context-menu"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {(isSubMap || isMainMap) && (
              <button
                type="button"
                onClick={handleStartConnection}
                className="w-full rounded-md px-3 py-2 text-left font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
                data-testid={
                  isMainMap
                    ? "commonplace-map-connect-visual-node"
                    : "commonplace-map-connect-idea"
                }
              >
                {isMainMap ? "Connect visual nodes" : "Connect idea"}
              </button>
            )}
            {isMainMap && (
              <button
                type="button"
                onClick={handleAskDeleteVisualNode}
                className="mt-1 w-full rounded-md px-3 py-2 text-left font-semibold text-[#8A1F15] hover:bg-[#FFF4F3] focus:outline-none focus:ring-2 focus:ring-[#B42318]/30"
                data-testid="commonplace-map-delete-visual-node"
              >
                Delete visual {nodeContextMenu.nodeType === "cluster" ? "cluster" : "note"}
              </button>
            )}
            <button
              type="button"
              onClick={cancelConnectionMode}
              className="mt-1 w-full rounded-md px-3 py-2 text-left text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
            >
              Cancel
            </button>
          </div>
        )}

        {isMainMap && nodeDeleteConfirm && (
          <div
            className="absolute z-50 w-80 rounded-lg border border-[var(--brand-border)] bg-white p-4 text-sm shadow-lg"
            style={{ left: nodeDeleteConfirm.x, top: nodeDeleteConfirm.y }}
            data-testid="commonplace-map-node-delete-confirm"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-semibold text-[var(--brand-ink)]">
              {nodeDeleteConfirm.nodeType === "cluster"
                ? "Delete visual cluster?"
                : "Delete visual note?"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--brand-ink-soft)]">
              {nodeDeleteConfirm.nodeType === "cluster"
                ? "Only this cluster node will be removed from this Main Map. The referenced Sub Mind Map will remain."
                : "Only this visual note node will be removed from this Main Map. The original Library note will remain."}
            </p>
            <p className="mt-2 rounded-md bg-[var(--brand-surface)] px-3 py-2 text-xs font-semibold text-[var(--brand-ink-soft)]">
              {nodeDeleteConfirm.label}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--brand-ink-soft)]">
              Connected Main Map edges for this visual node will also disappear.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNodeDeleteConfirm(null)}
                className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteVisualNode()}
                disabled={isSavingMapChange}
                className="rounded-lg border border-[#B42318]/30 bg-[#B42318] px-3 py-2 text-xs font-semibold text-white hover:bg-[#8A1F15] disabled:cursor-not-allowed disabled:opacity-70"
                data-testid="commonplace-map-node-delete-confirm-button"
              >
                Delete visual node
              </button>
            </div>
          </div>
        )}

        {supportsEdges && connectionSourceNode && (
          <div
            className="pointer-events-none absolute left-4 top-4 z-30 rounded-lg border border-[#0F766E]/35 bg-white px-3 py-2 text-sm font-semibold text-[#134E44] shadow-sm"
            data-testid="commonplace-map-connection-mode"
          >
            {isMainMap
              ? `Connecting visual node ${connectionSourceLabel}. Click a target visual node.`
              : `Connecting from ${connectionSourceLabel}. Click a target note.`}
          </div>
        )}

        {supportsEdges && edgeDraft && (
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

        {supportsEdges && edgeEdit && (
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
