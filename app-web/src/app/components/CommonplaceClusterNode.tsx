"use client";

import type { NodeProps } from "reactflow";

export type CommonplaceClusterNodeData = {
  subMindMapId: string;
  title: string;
  updatedAt: string;
  onOpenSubMap?: (subMap: {
    id: string;
    title: string;
    updatedAt: string;
  }) => void;
};

export function CommonplaceClusterNode({
  data,
  selected,
}: NodeProps<CommonplaceClusterNodeData>) {
  return (
    <article
      className={`relative w-[260px] overflow-hidden rounded-lg border border-[#8AAEA8] bg-[#F4FBF8] p-4 text-left shadow-sm transition-shadow ${
        selected ? "ring-2 ring-[var(--brand-teal)] ring-offset-2" : ""
      }`}
      data-testid="commonplace-map-cluster-node"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-[var(--brand-teal-soft)] px-2 py-1 text-[11px] font-semibold uppercase text-[var(--brand-teal-ink)]">
          Sub Map
        </span>
        <span className="rounded-full border border-[#8AAEA8]/70 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-[#2F5E55]">
          Cluster
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 break-words text-base font-semibold leading-6 text-[var(--brand-ink)]">
        {data.title}
      </h3>
      <p className="mt-2 text-xs font-medium text-[var(--brand-ink-soft)]">
        Theme workspace
      </p>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          data.onOpenSubMap?.({
            id: data.subMindMapId,
            title: data.title,
            updatedAt: data.updatedAt,
          });
        }}
        className="nodrag nopan mt-4 rounded-md border border-[var(--brand-teal)]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-teal-ink)] transition-colors hover:bg-[var(--brand-teal-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/30"
        data-testid="commonplace-map-cluster-open-submap"
      >
        Open Sub Map
      </button>
    </article>
  );
}
