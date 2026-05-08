/**
 * StagePipeline — dedicated stage pipeline editor for the Scan Settings modal.
 *
 * Visual and DnD patterns match the scan-time StageTimeline (src/components/Overview/StageTimeline.tsx)
 * so configuration and live scan use the same circular-indicator vibe. Shares StageEntry DTOs.
 *
 * Key design choice: the detail pane's wrapper animates ONLY its height — the inner
 * content is never transformed, opacity-faded, or scaled. This avoids the layout
 * squish when the parent's height grows/shrinks around content.
 */

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { STAGE_REGISTRY, getStageMeta, type StageMeta } from './stageRegistry';
import { StageDetailPane } from './StageDetailPane';
import { ContextMenu, useContextMenu } from '../ContextMenu';
import type { ContextMenuItem, ContextMenuSection } from '../ContextMenu';
import type { StageEntry, PortListSummary } from '../../types';

// ── DnD helpers ────────────────────────────────────────────────────


const SPRING = { type: 'spring' as const, stiffness: 500, damping: 30 };

const enterVariants: Variants = {
  initial: { opacity: 0, x: 20, scale: 0.8 },
  animate: { opacity: 1, x: 0, scale: 1, transition: SPRING },
  exit: { opacity: 0, x: -16, scale: 0.8, transition: { duration: 0.2 } },
};

// ── Edge types (future-ready: supports arbitrary DAGs, not just sequential) ──

interface PipelineEdge {
  /** Stage index this edge starts from */
  from: number;
  /** Stage index this edge points to */
  to: number;
}

interface EdgeGeometry {
  /** Identity for React keys — combination of from/to indices */
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** True if either endpoint stage is currently being dragged */
  isActive: boolean;
}

// ── Props ──────────────────────────────────────────────────────────

interface StagePipelineProps {
  stages: StageEntry[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onAdd: (stage: StageEntry) => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onConfigChange: (index: number, config: Record<string, unknown>) => void;
  onDuplicate: (index: number) => void;
  portLists?: PortListSummary[];
}

// ── Main component ─────────────────────────────────────────────────

export function StagePipeline({
  stages,
  selectedIndex,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
  onConfigChange,
  onDuplicate,
  portLists,
}: StagePipelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const ctxMenu = useContextMenu();

  // Per-stage right-click handler — same shape as the scan-time StageTimeline:
  // Details / Duplicate / Delete.
  const handleStageContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      ctxMenu.handleContextMenu(e, () => [
        {
          items: [
            {
              label: 'Details',
              icon: 'fa-solid fa-sliders',
              onClick: () => onSelect(index),
            },
            {
              label: 'Duplicate',
              icon: 'fa-regular fa-copy',
              onClick: () => onDuplicate(index),
            },
            {
              label: 'Delete',
              icon: 'fa-solid fa-trash',
              onClick: () => onRemove(index),
            },
          ],
        },
      ]);
    },
    [ctxMenu, onSelect, onDuplicate, onRemove],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => stages.map((_, i) => `stage-${i}`), [stages]);

  // Tracked overlay center (viewport coords). Refs not state — we only need it
  // synchronously inside measureEdges, and don't want every drag tick to
  // re-render the parent.
  const overlayCenterRef = useRef<{ x: number; y: number } | null>(null);

  const computeOverlayCenter = (event: DragStartEvent | DragMoveEvent | DragEndEvent) => {
    // event.active.rect.current.translated already reflects modifiers
    // (restrictToPane / snap), so it's the truest read of where the overlay
    // visually sits.
    const translated = event.active.rect.current.translated;
    if (!translated) return null;
    return {
      x: translated.left + translated.width / 2,
      y: translated.top + translated.height / 2,
    };
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    overlayCenterRef.current = computeOverlayCenter(event);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    overlayCenterRef.current = computeOverlayCenter(event);
    measureEdges();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    overlayCenterRef.current = null;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from !== -1 && to !== -1) onReorder(from, to);
  };

  const activeDragEntry = activeId ? stages[ids.indexOf(activeId)] : null;
  const selectedStage = selectedIndex !== null ? stages[selectedIndex] : null;

  // ── Pane ref + indicator refs for SVG edge measurement ──────────
  const paneRef = useRef<HTMLDivElement>(null);
  // indicator (circle) elements keyed by stage index
  const indicatorRefs = useRef<Map<number, HTMLElement>>(new Map());
  const setIndicatorRef = (i: number) => (el: HTMLElement | null) => {
    if (el) indicatorRefs.current.set(i, el);
    else indicatorRefs.current.delete(i);
  };

  // Build edge list from stages — sequential for now, but the array structure
  // supports arbitrary DAGs later (parallel branches, fan-in/fan-out).
  const edges: PipelineEdge[] = useMemo(
    () => (stages.length > 1
      ? stages.slice(0, -1).map((_, i) => ({ from: i, to: i + 1 }))
      : []),
    [stages],
  );

  const [edgeGeometry, setEdgeGeometry] = useState<EdgeGeometry[]>([]);

  // Re-measure edge endpoints from current DOM. Called from:
  //  - useLayoutEffect: every parent commit (handles add/remove/reorder/select)
  //  - DndContext.onDragMove: every drag tick (handles live bending during drag,
  //    since dnd-kit only re-renders the dragged child, not this parent)
  const measureEdges = useCallback(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const paneRect = pane.getBoundingClientRect();
    const draggingIdx = activeId ? ids.indexOf(activeId) : -1;
    const overlay = overlayCenterRef.current;

    const next: EdgeGeometry[] = [];
    for (const edge of edges) {
      const fromEl = indicatorRefs.current.get(edge.from);
      const toEl = indicatorRefs.current.get(edge.to);
      if (!fromEl || !toEl) continue;
      const a = fromEl.getBoundingClientRect();
      const b = toEl.getBoundingClientRect();

      // For the dragging stage, replace the original (stationary) endpoint
      // with the live overlay center so the line bends with the cursor.
      const fromIsDragging = edge.from === draggingIdx && overlay;
      const toIsDragging = edge.to === draggingIdx && overlay;

      const fromX = fromIsDragging
        ? overlay.x + a.width / 2 - paneRect.left
        : a.right - paneRect.left;
      const fromY = fromIsDragging
        ? overlay.y - paneRect.top
        : a.top + a.height / 2 - paneRect.top;
      const toX = toIsDragging
        ? overlay.x - b.width / 2 - paneRect.left
        : b.left - paneRect.left;
      const toY = toIsDragging
        ? overlay.y - paneRect.top
        : b.top + b.height / 2 - paneRect.top;

      next.push({
        id: `${edge.from}->${edge.to}`,
        fromX,
        fromY,
        toX,
        toY,
        isActive: draggingIdx === edge.from || draggingIdx === edge.to,
      });
    }

    setEdgeGeometry((prev) => {
      if (prev.length !== next.length) return next;
      for (let i = 0; i < prev.length; i++) {
        const p = prev[i], n = next[i];
        if (
          p.fromX !== n.fromX || p.fromY !== n.fromY ||
          p.toX !== n.toX || p.toY !== n.toY ||
          p.isActive !== n.isActive
        ) {
          return next;
        }
      }
      return prev;
    });
  }, [activeId, ids, edges]);

  // Measure-after-commit: read DOM rects post-layout and store derived edge
  // geometry. setEdgeGeometry has a value-equality bail-out, so this does not
  // cascade.
  useLayoutEffect(() => { measureEdges(); });

  // While dragging, also re-measure on every animation frame as a safety net —
  // some pointer-move bursts can collapse multiple ticks into a single dnd-kit
  // re-render, which would otherwise leave the line a frame behind.
  useEffect(() => {
    if (!activeId) return;
    let raf = 0;
    const tick = () => {
      measureEdges();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeId, measureEdges]);

  // Suppress global tooltips while dragging — react-tooltip's single-instance
  // anchor can otherwise show a stale tooltip from elsewhere on the page.
  useEffect(() => {
    if (!activeId) return;
    document.body.classList.add('stage-dragging');
    return () => document.body.classList.remove('stage-dragging');
  }, [activeId]);

  // Drag-constrain modifier — clamp the dragged element's transform so its
  // bounding rect stays inside the pane. The modifier function is invoked by
  // dnd-kit during drag (not during render), so reading paneRef.current
  // inside it is safe.
  const restrictToPane = useMemo<Modifier>(
    () => ({ transform, draggingNodeRect }) => {
      const pane = paneRef.current?.getBoundingClientRect();
      if (!pane || !draggingNodeRect) return transform;
      const minX = pane.left - draggingNodeRect.left;
      const maxX = pane.right - draggingNodeRect.right;
      const minY = pane.top - draggingNodeRect.top;
      const maxY = pane.bottom - draggingNodeRect.bottom;
      return {
        ...transform,
        x: Math.max(minX, Math.min(maxX, transform.x)),
        y: Math.max(minY, Math.min(maxY, transform.y)),
      };
    },
    [],
  );

  return (
    <div className="stage-pipeline-wrapper">
      <div className="stage-pipeline-pane" ref={paneRef}>
        {/* SVG connector layer — behind stages, doesn't intercept clicks */}
        <svg className="stage-pipeline-edges" aria-hidden="true">
          {edgeGeometry.map((g) => (
            <ConnectorPath key={g.id} geom={g} />
          ))}
        </svg>

        <div className="stage-pipeline-strip">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToPane]}
          >
            <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
              {stages.map((stage, i) => (
                <StageIndicator
                  key={ids[i]}
                  id={ids[i]}
                  entry={stage}
                  index={i}
                  selected={selectedIndex === i}
                  dragActive={!!activeId}
                  onSelect={() => onSelect(selectedIndex === i ? null : i)}
                  onContextMenu={(e) => handleStageContextMenu(e, i)}
                  indicatorRef={setIndicatorRef(i)}
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeDragEntry ? <StageDragOverlay entry={activeDragEntry} /> : null}
            </DragOverlay>
          </DndContext>

          <AddStageButton
            open={addMenuOpen}
            setOpen={setAddMenuOpen}
            onAdd={(meta) => {
              setAddMenuOpen(false);
              onAdd({ stage_type: meta.type, config: { ...meta.defaultConfig } });
            }}
          />
        </div>
      </div>

      {ctxMenu.visible && (
        <ContextMenu
          sections={ctxMenu.sections}
          position={ctxMenu.position}
          onClose={ctxMenu.close}
        />
      )}

      {/* Detail pane — ONLY height animates on the wrapper, content is untouched */}
      <AnimatePresence mode="wait" initial={false}>
        {selectedIndex !== null && selectedStage && (
          <motion.section
            key={selectedIndex}
            className="stage-detail-wrapper"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <StageDetailPane
              stage={selectedStage}
              index={selectedIndex}
              portLists={portLists}
              onChange={(config) => onConfigChange(selectedIndex, config)}
              onClose={() => onSelect(null)}
            />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Connector path SVG component ──────────────────────────────────

function ConnectorPath({ geom }: { geom: EdgeGeometry }) {
  const dx = geom.toX - geom.fromX;
  const cx1 = geom.fromX + dx * 0.5;
  const cx2 = geom.toX - dx * 0.5;
  // Bezier with horizontal control points → straight when aligned, smooth S-curve when offset.
  const d = `M ${geom.fromX},${geom.fromY} C ${cx1},${geom.fromY} ${cx2},${geom.toY} ${geom.toX},${geom.toY}`;
  return (
    <path
      d={d}
      className={`stage-pipeline-edge${geom.isActive ? ' stage-pipeline-edge--active' : ''}`}
    />
  );
}

// ── Stage indicator (circular, draggable, selectable) ──────────────

function StageIndicator({
  id,
  entry,
  index,
  selected,
  dragActive,
  onSelect,
  onContextMenu,
  indicatorRef,
}: {
  id: string;
  entry: StageEntry;
  index: number;
  selected: boolean;
  dragActive: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  indicatorRef: (el: HTMLElement | null) => void;
}) {
  const meta = getStageMeta(entry.stage_type);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition: dndTransition,
    isDragging,
  } = useSortable({
    id,
    // Disable FLIP. Without this, dnd-kit applies an inverse transform after
    // drop that visually puts the just-dropped item back at its original DOM
    // slot, then animates transform→0 — i.e. the "snap to start, then flip
    // to new" the user reported. Strategy-driven shifts during drag are
    // unaffected (default animateLayoutChanges also returns false during
    // active sorting).
    animateLayoutChanges: () => false,
  });

  const tooltipText = entry.auto
    ? `${meta.label} (auto: ${entry.reason ?? 'recommended'})`
    : meta.label;

  return (
    <div
      ref={setNodeRef}
      className={`stage-pipeline-stage${isDragging ? ' stage-pipeline-stage--dragging' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: dndTransition ?? undefined,
        // Hide the original while the DragOverlay is the visible drag target.
        // We still need the element in the DOM (and its rect) for stationary
        // edges connecting INTO this stage to remain accurate.
        opacity: isDragging ? 0 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      <motion.div
        ref={(el: HTMLDivElement | null) => indicatorRef(el)}
        variants={enterVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={SPRING}
        className={[
          'stage-indicator',
          'stage-indicator--preview',
          entry.auto ? 'stage-indicator--auto' : '',
          selected ? 'stage-indicator--selected' : '',
        ].filter(Boolean).join(' ')}
        data-tooltip-id={dragActive ? undefined : 'tooltip'}
        data-tooltip-content={dragActive ? undefined : tooltipText}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onContextMenu={onContextMenu}
      >
        <svg className="stage-indicator-ring" viewBox="0 0 32 32">
          <circle
            className={`stage-indicator-bg${entry.auto ? ' stage-indicator-bg--auto' : ''}`}
            cx="16" cy="16" r={14}
          />
        </svg>
        <i className={`${meta.icon} stage-indicator-icon`} />
        <span className="stage-indicator-index">{index + 1}</span>
      </motion.div>

      <span className={`stage-pipeline-label${selected ? ' stage-pipeline-label--selected' : ''}`}>
        {meta.label}
      </span>
    </div>
  );
}

// ── Drag overlay (rendered via portal by dnd-kit at cursor position) ──

function StageDragOverlay({ entry }: { entry: StageEntry }) {
  const meta = getStageMeta(entry.stage_type);
  return (
    <div className="stage-indicator stage-indicator--drag-overlay">
      <svg className="stage-indicator-ring" viewBox="0 0 32 32">
        <circle
          className={`stage-indicator-bg${entry.auto ? ' stage-indicator-bg--auto' : ''}`}
          cx="16" cy="16" r={14}
        />
      </svg>
      <i className={`${meta.icon} stage-indicator-icon`} />
    </div>
  );
}

// ── Add-stage button + dropdown ───────────────────────────────────

function AddStageButton({
  open,
  setOpen,
  onAdd,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onAdd: (meta: StageMeta) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Re-snapshot the trigger rect each time the menu opens so it survives
  // layout shifts that may have occurred since the previous open.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    setAnchorRect(buttonRef.current.getBoundingClientRect());
  }, [open]);

  const sections: ContextMenuSection[] = useMemo(() => {
    const buildItems = (category: 'discovery' | 'scanning'): ContextMenuItem[] =>
      STAGE_REGISTRY.filter((s) => s.category === category).map((meta) => ({
        label: meta.label,
        description: meta.description,
        icon: meta.icon,
        onClick: () => onAdd(meta),
      }));

    return [{
      items: [
        {
          label: 'Discovery',
          description: 'Find hosts on the network',
          icon: 'fa-solid fa-radar',
          items: buildItems('discovery'),
        },
        {
          label: 'Scanning',
          description: 'Probe hosts for ports & services',
          icon: 'fa-solid fa-magnifying-glass',
          items: buildItems('scanning'),
        },
      ],
    }];
  }, [onAdd]);

  return (
    <div className="stage-pipeline-add-wrapper">
      <button
        ref={buttonRef}
        className="stage-indicator-add"
        onClick={() => setOpen(!open)}
        data-tooltip-id={open ? undefined : 'tooltip'}
        data-tooltip-content="Add stage"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <i className="fa-solid fa-plus" />
      </button>
      {open && anchorRect && (
        <ContextMenu
          sections={sections}
          anchor={{ rect: anchorRect }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
