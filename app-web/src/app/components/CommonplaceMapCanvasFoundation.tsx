"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import type {
  CommonplaceMapCanvasNode,
  CommonplaceMapNodeListResult,
  CommonplaceMapNodePositionSaveResult,
  CommonplaceMapNodePositionUpdate,
  CommonplaceMindMapSummary,
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

type CommonplaceMapCanvasFoundationProps = {
  map: CommonplaceMindMapSummary;
  noteContext: MapNoteContext | null;
  onBack: () => void;
  loadNodes: () => Promise<CommonplaceMapNodeListResult>;
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
};

const nodeTypes: NodeTypes = {
  noteNode: CommonplaceNoteNode,
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

export function CommonplaceMapCanvasFoundation({
  map,
  noteContext,
  onBack,
  loadNodes,
  saveNodePositions,
  createNoteNode,
}: CommonplaceMapCanvasFoundationProps) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CommonplaceNoteNodeData>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Saved");
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<CommonplaceNoteNodeData> | null>(null);

  const isSubMap = map.type === "sub";
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

      loadNodes()
        .then((result) => {
          if (!isCurrent) return;
          if (!result.ok) {
            setLoadError("Could not load this map canvas.");
            return;
          }
          setNodes(result.nodes.map(toReactFlowNode));
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
  }, [loadNodes, map.id, map.type, setNodes]);

  const handleNodeDragStop = useCallback(() => {
    if (isSubMap) {
      setSaveStatus("Unsaved changes");
    }
  }, [isSubMap]);

  const handleSave = useCallback(async () => {
    setSaveStatus("Saving...");
    const result = await saveNodePositions(updates);
    setSaveStatus(result.ok ? "Saved" : "Save failed");
  }, [saveNodePositions, updates]);

  const hasDraggedCommonplaceNote = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes(COMMONPLACE_NOTE_DRAG_TYPE);

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

  const handleDragOver = useCallback((event: DragEvent) => {
    if (!hasDraggedCommonplaceNote(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isSubMap ? "copy" : "none";
  }, [isSubMap]);

  const handleDrop = useCallback(
    async (event: DragEvent) => {
      if (!hasDraggedCommonplaceNote(event)) return;
      event.preventDefault();
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

      <div className="relative h-[min(68dvh,720px)] min-h-[460px] overflow-hidden bg-[#F8FAF8]">
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onInit={setFlowInstance}
          onDragOver={handleDragOver}
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
      </div>
    </section>
  );
}
