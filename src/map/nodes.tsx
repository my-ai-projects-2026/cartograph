"use client";

import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { createContext, use } from "react";
import { HEADER_H, ROW_H, ROW_NUMBERS_W, folderMeta } from "./layout";
import type { Lit, Selection } from "./selection";
import { MORE, endpointKey } from "./view";
import type { ViewNode } from "./view";

export interface MapActions {
  selection: Selection;
  lit: Lit | null;
  select: (sel: Selection) => void;
  close: (id: string) => void;
}

export const MapContext = createContext<MapActions | null>(null);

function useMap(): MapActions {
  const map = use(MapContext);
  if (map === null) throw new Error("Map nodes render only inside the map canvas");
  return map;
}

export type FolderFlowNode = Node<{ view: Extract<ViewNode, { kind: "folder" }> }, "folder">;
export type PanelFlowNode = Node<{ view: Extract<ViewNode, { kind: "panel" }> }, "panel">;

export const handleId = (side: "in" | "out", row: string | null) => (row === null ? side : `${side}:${row}`);

// Handles are where edges attach; they aren't for dragging new edges, so they stay invisible.
const HIDDEN_HANDLE = "!size-px !min-w-0 !min-h-0 !border-0 !bg-transparent";

const DIM = "opacity-25";

export function FolderNode({ data: { view } }: NodeProps<FolderFlowNode>) {
  const { lit, selection } = useMap();
  const selected = selection?.kind === "group" && selection.id === view.id;
  const dim = lit !== null && !lit.nodes.has(view.id);
  return (
    <div
      title={view.id}
      className={`h-full w-full cursor-pointer rounded-[3px] border bg-surface px-2.5 py-1.5 hover:border-muted ${
        selected ? "border-accent" : "border-canvas-border"
      } ${dim ? DIM : ""}`}
    >
      <Handle type="target" position={Position.Left} id="in" className={HIDDEN_HANDLE} isConnectable={false} />
      <div className="truncate font-mono text-xs leading-4 font-semibold text-fg">{view.label}</div>
      <div className="truncate text-[11px] leading-4 text-canvas-meta tabular-nums">{folderMeta(view)}</div>
      <Handle type="source" position={Position.Right} id="out" className={HIDDEN_HANDLE} isConnectable={false} />
    </div>
  );
}

function RowHandles({ row }: { row: string }) {
  return (
    <>
      <Handle type="target" position={Position.Left} id={handleId("in", row)} className={HIDDEN_HANDLE} isConnectable={false} />
      <Handle type="source" position={Position.Right} id={handleId("out", row)} className={HIDDEN_HANDLE} isConnectable={false} />
    </>
  );
}

export function PanelNode({ data: { view } }: NodeProps<PanelFlowNode>) {
  const { lit, selection, select, close } = useMap();
  const groupSelected = selection?.kind === "group" && selection.id === view.id;
  const panelDim = lit !== null && !lit.nodes.has(view.id);
  // A dimmed panel dims as one object; rows only dim individually inside a lit panel.
  const rowLit = (row: string) =>
    lit === null || panelDim || groupSelected || lit.endpoints.has(endpointKey({ node: view.id, row }));

  return (
    <div
      className={`flex h-full w-full cursor-default flex-col rounded-[3px] border bg-surface ${
        groupSelected ? "border-accent" : "border-muted"
      } ${panelDim ? DIM : ""}`}
    >
      <button
        type="button"
        title={`${view.id}: click to fold`}
        onClick={() => close(view.id)}
        className="flex shrink-0 cursor-pointer flex-col justify-center border-b border-canvas-border bg-raised px-2.5 text-left hover:bg-rule"
        style={{ height: HEADER_H }}
      >
        <span className="truncate font-mono text-xs leading-4 font-semibold text-fg">{view.label}</span>
        <span className="truncate text-[11px] leading-4 text-canvas-meta tabular-nums">{folderMeta(view)}</span>
      </button>
      {view.rows.map((r) => {
        const selected = selection?.kind === "row" && selection.node === view.id && selection.row === r.path;
        return (
          <button
            key={r.path}
            type="button"
            title={r.path}
            onClick={() => select({ kind: "row", node: view.id, row: r.path })}
            className={`relative flex shrink-0 cursor-pointer items-center px-2.5 text-left text-xs ${
              selected ? "bg-accent/15" : "hover:bg-raised"
            } ${rowLit(r.path) ? "" : DIM}`}
            style={{ height: ROW_H }}
          >
            <span className={`min-w-0 flex-1 truncate font-mono ${selected ? "text-accent" : "text-fg"}`}>{r.label}</span>
            <span className="shrink-0 text-right text-[11px] text-canvas-meta tabular-nums" style={{ width: ROW_NUMBERS_W }}>
              ↓{r.fanIn} ↑{r.fanOut}
            </span>
            <RowHandles row={r.path} />
          </button>
        );
      })}
      {view.hidden > 0 && (
        <div
          className={`relative flex shrink-0 items-center px-2.5 text-[11px] text-canvas-meta ${rowLit(MORE) ? "" : DIM}`}
          style={{ height: ROW_H }}
        >
          {view.hidden} more
          <RowHandles row={MORE} />
        </div>
      )}
    </div>
  );
}
