"use client";

import { Handle, Position, type NodeProps } from "reactflow";

export type CommonplaceNoteNodeData = {
  noteId: string;
  shortcode: string;
  title: string;
  sourceBook: string;
  tags: string[];
};

const tagPalette = [
  { background: "#EEF7F4", border: "#8AC6B6", text: "#194E42" },
  { background: "#F4F1FA", border: "#B7A4D9", text: "#3F2F68" },
  { background: "#F7F5EA", border: "#D0C47B", text: "#4D4616" },
  { background: "#EEF4FB", border: "#91B7DC", text: "#234966" },
  { background: "#FAF0F0", border: "#DBA2A0", text: "#6D2B29" },
];

function paletteForTag(tag: string | undefined) {
  if (!tag) return tagPalette[0];

  const hash = tag
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return tagPalette[hash % tagPalette.length];
}

export function CommonplaceNoteNode({
  data,
  selected,
}: NodeProps<CommonplaceNoteNodeData>) {
  const palette = paletteForTag(data.tags[0]);

  return (
    <article
      className={`relative w-[220px] rounded-lg border p-3 text-left shadow-sm transition-shadow ${
        selected ? "ring-2 ring-[var(--brand-teal)] ring-offset-2" : ""
      }`}
      data-testid="commonplace-map-note-node"
      style={{
        backgroundColor: palette.background,
        borderColor: palette.border,
        color: palette.text,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-2.5 !w-2.5 !border !border-white !bg-[var(--brand-teal)]"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-2.5 !w-2.5 !border !border-white !bg-[var(--brand-teal)]"
      />
      <p className="text-[11px] font-semibold uppercase">{data.shortcode}</p>
      <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">
        {data.title}
      </h3>
      <p className="mt-1 line-clamp-1 text-xs font-medium opacity-80">
        {data.sourceBook}
      </p>
      {data.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
