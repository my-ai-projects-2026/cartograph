"use client";

import { ReactFlow, ReactFlowProvider, getViewportForBounds, useReactFlow, useStoreApi } from "@xyflow/react";
import type { Edge as FlowEdge, NodeMouseHandler, NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { useMemo, useState } from "react";
import type { Edge, FileNode } from "@/parser/types";
import { foldDirectories } from "./fold";
import { layoutView } from "./layout";
import type { Box } from "./layout";
import { FolderNode, MapContext, PanelNode, handleId } from "./nodes";
import type { FolderFlowNode, MapActions, PanelFlowNode } from "./nodes";
import { lightUp } from "./selection";
import type { Selection } from "./selection";
import { deriveView } from "./view";

const nodeTypes: NodeTypes = { folder: FolderNode, panel: PanelNode };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
const FIT_PADDING = 0.06;

export function MapCanvas(props: { files: FileNode[]; edges: Edge[] }) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({ files, edges }: { files: FileNode[]; edges: Edge[] }) {
  const flow = useReactFlow();
  const store = useStoreApi();
  const folding = useMemo(() => foldDirectories(files), [files]);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [selection, setSelection] = useState<Selection>(null);

  const view = useMemo(() => deriveView(files, edges, folding, open), [files, edges, folding, open]);
  const layout = useMemo(() => layoutView(view), [view]);
  const lit = useMemo(() => lightUp(view, selection), [view, selection]);

  // Fits the layout the click is about to produce, not the one on screen, and
  // never past the current zoom: fitting a fresh panel would otherwise zoom
  // into it and lose the rest of the map.
  const refit = (bounds: Box) => {
    const { width, height } = store.getState();
    const current = flow.getViewport().zoom;
    flow.setViewport(getViewportForBounds(bounds, width, height, MIN_ZOOM, current, FIT_PADDING));
  };

  const openGroup = (id: string) => {
    const next = new Set(open).add(id);
    setOpen(next);
    setSelection({ kind: "group", id });
    refit(layoutView(deriveView(files, edges, folding, next)).bounds);
  };

  const actions: MapActions = {
    selection,
    lit,
    select: setSelection,
    close: (id) => {
      const next = new Set(open);
      next.delete(id);
      setOpen(next);
      // A selection inside the panel would point at a row that's no longer drawn.
      if (selection !== null && (selection.kind === "group" ? selection.id : selection.node) === id) setSelection(null);
    },
  };

  const flowNodes = view.nodes.map((n): FolderFlowNode | PanelFlowNode => {
    const box = layout.boxes.get(n.id);
    if (box === undefined) throw new Error(`No layout for ${n.id}`);
    const placed = { id: n.id, position: { x: box.x, y: box.y }, width: box.width, height: box.height };
    return n.kind === "folder" ? { ...placed, type: "folder", data: { view: n } } : { ...placed, type: "panel", data: { view: n } };
  });

  const flowEdges = view.edges.map((e): FlowEdge => {
    const dir = lit?.edges.get(e.id);
    const stroke = dir === "in" ? "var(--incoming)" : dir === "out" ? "var(--outgoing)" : "var(--canvas-edge)";
    return {
      id: e.id,
      source: e.source.node,
      sourceHandle: handleId("out", e.source.row),
      target: e.target.node,
      targetHandle: handleId("in", e.target.row),
      style: {
        stroke,
        strokeWidth: 1 + Math.min(2, Math.log2(e.count) / 2),
        opacity: lit === null || dir !== undefined ? 1 : 0.12,
      },
      // Lit edges draw over the dimmed ones they cross.
      zIndex: dir === undefined ? 0 : 1,
      focusable: false,
    };
  });

  const onNodeClick: NodeMouseHandler = (_, node) => {
    if (node.type === "folder") openGroup(node.id);
  };

  return (
    <MapContext value={actions}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelection(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: FIT_PADDING, maxZoom: 1.25 }}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
      />
    </MapContext>
  );
}
