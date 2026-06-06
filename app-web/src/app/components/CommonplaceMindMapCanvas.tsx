"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type NodeProps,
  type NodeTypes,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import type { CommonplaceNote } from "../lib/storage/supabase-commonplace-adapter";

type CommonplaceMindMapCanvasProps = {
  note: CommonplaceNote;
  onBackToDetail: () => void;
};

type CommonplaceMindMapNodeData = {
  shortcode: string;
  title: string;
  insight: string;
  tags: string[];
};

function displayTitle(note: CommonplaceNote): string {
  return note.title?.trim() || note.sourceBook || "Untitled Source";
}

function insightPreview(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 220) return trimmed;
  return `${trimmed.slice(0, 220)}...`;
}

function CommonplaceNoteNode({
  data,
}: NodeProps<CommonplaceMindMapNodeData>) {
  return (
    <article
      className="w-[280px] rounded-lg border border-[#534AB7]/25 bg-white p-4 text-left shadow-sm"
      data-testid="commonplace-mindmap-note-node"
    >
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

export function CommonplaceMindMapCanvas({
  note,
  onBackToDetail,
}: CommonplaceMindMapCanvasProps) {
  const initialNodes = useMemo<Node<CommonplaceMindMapNodeData>[]>(
    () => [
      {
        id: `commonplace-note-${note.id}`,
        type: "commonplaceNote",
        position: { x: 120, y: 120 },
        data: {
          shortcode: note.shortcode,
          title: displayTitle(note),
          insight: insightPreview(note.insight),
          tags: note.tags,
        },
      },
    ],
    [note],
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);

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
            Early canvas shell
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--brand-ink-soft)]">
            This first shell starts from the selected Commonplace note. Shortcode
            linking and saved map layouts are coming next.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToDetail}
          className="rounded-lg border border-[#534AB7]/30 bg-white px-4 py-2 text-sm font-semibold text-[#332C85] hover:bg-[#F8F7FF]"
        >
          Back to Detail
        </button>
      </div>

      <div className="h-[540px] bg-[#FBFAFF]" data-testid="commonplace-mindmap-canvas">
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
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
