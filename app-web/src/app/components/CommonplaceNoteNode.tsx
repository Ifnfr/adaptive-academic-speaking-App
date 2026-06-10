"use client";

import { Handle, Position, type NodeProps } from "reactflow";

export type CommonplaceNoteNodeData = {
  noteId: string;
  shortcode: string;
  title: string;
  sourceBook: string;
  tags: string[];
  connectionRole?: "source" | "target" | null;
};

const tagPalette = [
  { background: "#FFF8EA", border: "#C9D8D1", text: "#254238" },
  { background: "#FFF8EA", border: "#B7D4C8", text: "#194E42" },
  { background: "#FFF8EA", border: "#D6CFA8", text: "#4D4616" },
  { background: "#FFF8EA", border: "#B5C9D6", text: "#234966" },
  { background: "#FFF8EA", border: "#D9BBB1", text: "#6D2B29" },
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
  const connectionClass =
    data.connectionRole === "source"
      ? "ring-2 ring-[#0F766E] ring-offset-2 ring-offset-[#EEF3F1] shadow-md"
      : data.connectionRole === "target"
        ? "ring-2 ring-[#0F766E]/55 ring-offset-2 ring-offset-[#EEF3F1] shadow-md"
        : "";

  return (
    <article
      className={`group relative w-[220px] overflow-visible rounded-lg border p-3 text-left shadow-sm transition duration-150 hover:border-[#0F766E] hover:shadow-md ${
        selected ? "ring-2 ring-[#0F766E] ring-offset-2 ring-offset-[#EEF3F1]" : ""
      } ${connectionClass}`}
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
        className="!-left-2 !h-4 !w-4 !border-2 !border-white !bg-[#0F766E] !opacity-95 !shadow-md transition-transform group-hover:!scale-110"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!-right-2 !h-4 !w-4 !border-2 !border-white !bg-[#0F766E] !opacity-95 !shadow-md transition-transform group-hover:!scale-110"
      />
      <p className="text-[11px] font-semibold uppercase">{data.shortcode}</p>
      <h3 className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-5">
        {data.title}
      </h3>
      <p className="mt-1 line-clamp-1 break-words text-xs font-medium opacity-80">
        {data.sourceBook}
      </p>
      {data.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="max-w-[9rem] truncate rounded-full border border-[#C9D8D1] bg-white/80 px-2 py-0.5 text-[11px] font-semibold"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
