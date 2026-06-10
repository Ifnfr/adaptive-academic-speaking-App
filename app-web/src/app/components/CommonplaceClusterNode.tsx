"use client";

import { Handle, Position, type NodeProps } from "reactflow";

export type CommonplaceClusterNodeData = {
  subMindMapId: string;
  title: string;
  updatedAt: string;
  connectionRole?: "source" | "target" | null;
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
  const connectionClass =
    data.connectionRole === "source"
      ? "ring-2 ring-[#0F766E] ring-offset-2 ring-offset-[#EEF3F1] shadow-md"
      : data.connectionRole === "target"
        ? "ring-2 ring-[#0F766E]/55 ring-offset-2 ring-offset-[#EEF3F1] shadow-md"
        : "";

  return (
    <article
      className={`group relative w-[260px] overflow-visible rounded-lg border border-[#C9D8D1] bg-[#E4F3EC] p-4 text-left shadow-sm transition duration-150 hover:border-[#0F766E] hover:shadow-md ${
        selected ? "ring-2 ring-[#0F766E] ring-offset-2 ring-offset-[#EEF3F1]" : ""
      } ${connectionClass}`}
      data-testid="commonplace-map-cluster-node"
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
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-white/75 px-2 py-1 text-[11px] font-semibold uppercase text-[#134E44]">
          Sub Map
        </span>
        <span className="rounded-full border border-[#B7D4C8] bg-white/75 px-2 py-0.5 text-[10px] font-semibold text-[#2F5E55]">
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
        className="nodrag nopan mt-4 rounded-md border border-[#0F766E]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#134E44] transition-colors hover:bg-[#DDEBE5] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30"
        data-testid="commonplace-map-cluster-open-submap"
      >
        Open Sub Map
      </button>
    </article>
  );
}
