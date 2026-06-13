"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import {
  getCommonplaceCardTheme,
  type CommonplaceCardTheme,
} from "../lib/commonplace-theme";

export type CommonplaceNoteNodeData = {
  noteId: string;
  shortcode: string;
  title: string;
  sourceBook: string;
  tags: string[];
  connectionRole?: "source" | "target" | null;
  cardTheme?: CommonplaceCardTheme;
};

const DEFAULT_NOTE_CARD_THEME = getCommonplaceCardTheme("default");

function themeToken(
  theme: CommonplaceCardTheme,
  token: "--commonplace-card-bg" | "--commonplace-card-border" | "--commonplace-card-accent",
): string {
  return theme.style[token];
}

export function CommonplaceNoteNode({
  data,
  selected,
}: NodeProps<CommonplaceNoteNodeData>) {
  const cardTheme = data.cardTheme ?? DEFAULT_NOTE_CARD_THEME;
  const connectionClass =
    data.connectionRole === "source"
      ? "ring-2 ring-[#0F766E] ring-offset-2 ring-offset-[#EEF3F1] shadow-md"
      : data.connectionRole === "target"
        ? "ring-2 ring-[#0F766E]/55 ring-offset-2 ring-offset-[#EEF3F1] shadow-md"
        : "";

  return (
    <article
      className={`group relative w-[220px] cursor-grab overflow-visible rounded-lg border p-3 text-left shadow-sm transition duration-150 active:cursor-grabbing hover:border-[#0F766E] hover:shadow-md ${
        selected ? "ring-2 ring-[#0F766E] ring-offset-2 ring-offset-[#EEF3F1] shadow-md" : ""
      } ${connectionClass}`}
      data-testid="commonplace-map-note-node"
      data-node-kind="note"
      data-selected={selected ? "true" : "false"}
      data-commonplace-card-surface="true"
      style={selected ? cardTheme.selectedStyle : cardTheme.style}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!-left-2 !h-4 !w-4 !border-2 !opacity-95 !shadow-md transition-transform group-hover:!scale-110"
        style={{
          backgroundColor: themeToken(cardTheme, "--commonplace-card-accent"),
          borderColor: themeToken(cardTheme, "--commonplace-card-bg"),
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!-right-2 !h-4 !w-4 !border-2 !opacity-95 !shadow-md transition-transform group-hover:!scale-110"
        style={{
          backgroundColor: themeToken(cardTheme, "--commonplace-card-accent"),
          borderColor: themeToken(cardTheme, "--commonplace-card-bg"),
        }}
      />
      <div className="flex items-start justify-between gap-2">
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase"
          style={cardTheme.tagStyle}
        >
          Library Note
        </span>
        <span className="max-w-[5.5rem] truncate text-[11px] font-semibold uppercase">
          {data.shortcode}
        </span>
      </div>
      <h3 className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-5">
        {data.title}
      </h3>
      <p className="mt-1 line-clamp-1 break-words text-xs font-medium opacity-80">
        {data.sourceBook}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide opacity-65">
        Visual idea
      </p>
      {data.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="commonplace-card-tag max-w-[9rem] truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={cardTheme.tagStyle}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
