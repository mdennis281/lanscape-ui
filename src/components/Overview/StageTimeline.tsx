/**
 * StageTimeline — animated stage indicator strip.
 *
 * Renders pipeline stages as circular progress indicators with smooth
 * enter/exit/replace animations powered by framer-motion.
 *
 * Two modes:
 *  - **Preview** (pre-scan): shows configured StageEntry items with muted styling
 *  - **Live** (during/after scan): shows StageProgress items with progress rings
 *
 * The component owns the "+" add-stage button and the AddStageModal.
 * It emits the active stage's counter data upward via onActiveStageChange.
 */

import { useState, useCallback } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import { useScanStore, useUIStore } from '../../store';
import { getStageMeta } from '../Settings/stageRegistry';
import { AddStageModal } from './AddStageModal';
import { StageEditorModal } from './StageEditorModal';
import { useStageManager, type ActiveStageCounter, type StageItem } from './useStageManager';
import { ContextMenu, useContextMenu, getGlobalSection } from '../ContextMenu';
import { ExportModal } from '../ExportModal';
import { getWebSocketService } from '../../services';
import type { StageProgress, StageEntry } from '../../types';

// Snap the drag overlay's center to the cursor instead of preserving grab offset
const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (draggingNodeRect && activatorEvent) {
    const { top, left, width, height } = draggingNodeRect;
    const event = activatorEvent as MouseEvent | TouchEvent;
    const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : (event as MouseEvent).clientY;
    return {
      ...transform,
      x: transform.x + clientX - (left + width / 2),
      y: transform.y + clientY - (top + height / 2),
    };
  }
  return transform;
};

// ── Animation config ───────────────────────────────────────────────

const STAGGER_MS = 40;
const SPRING = { type: 'spring' as const, stiffness: 500, damping: 30 };

/** Slide-in from right for new stages */
const enterVariants: Variants = {
  initial: { opacity: 0, x: 20, scale: 0.8 },
  animate: { opacity: 1, x: 0, scale: 1, transition: SPRING },
  exit: { opacity: 0, x: -16, scale: 0.8, transition: { duration: 0.2 } },
};

/** Fade down for replaced stages */
const replaceVariants: Variants = {
  initial: { opacity: 0, y: -12, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1, transition: SPRING },
  exit: { opacity: 0, y: 12, scale: 0.9, transition: { duration: 0.2 } },
};

/** Default (no animation — already present) */
const idleVariants: Variants = {
  initial: { opacity: 1, x: 0, scale: 1, rotateY: 0 },
  animate: { opacity: 1, x: 0, scale: 1, rotateY: 0 },
  exit: { opacity: 0, x: -16, scale: 0.8, transition: { duration: 0.2 } },
};

function getVariants(intent: string): Variants {
  switch (intent) {
    case 'enter': return enterVariants;
    case 'replace': return replaceVariants;
    default: return idleVariants;
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function formatStageRuntime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Props ──────────────────────────────────────────────────────────

interface StageTimelineProps {
  onActiveStageChange: (counter: ActiveStageCounter) => void;
}

// ── Component ──────────────────────────────────────────────────────

export function StageTimeline({ onActiveStageChange }: StageTimelineProps) {
  const status = useScanStore((s) => s.status);
  const currentScanId = useScanStore((s) => s.currentScanId);
  const pipelineConfig = useScanStore((s) => s.pipelineConfig);
  const setPipelineConfig = useScanStore((s) => s.setPipelineConfig);
  const removeStage = useScanStore((s) => s.removeStage);
  const reorderStages = useScanStore((s) => s.reorderStages);
  const isTransitioning = useScanStore((s) => s.isTransitioning);
  const setShowSettings = useUIStore((s) => s.setShowSettings);

  const stageProgresses = status?.stages;
  const currentStageIndex = status?.current_stage_index;
  const isLive = stageProgresses && stageProgresses.length > 0;

  // DnD sensors — only active in preview mode
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const previewIds = pipelineConfig.stages.map((_, i) => `stage-${i}`);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = previewIds.indexOf(active.id as string);
    const to = previewIds.indexOf(over.id as string);
    if (from !== -1 && to !== -1) reorderStages(from, to);
  };

  // Resolve the entry for the active drag overlay
  const activeDragEntry = activeId
    ? pipelineConfig.stages[previewIds.indexOf(activeId)]
    : null;

  const manager = useStageManager();

  // Sync active counter to parent (Overview)
  const [prevCounter, setPrevCounter] = useState<ActiveStageCounter | null>(null);
  const { activeCounter } = manager;
  if (
    !prevCounter ||
    prevCounter.completed !== activeCounter.completed ||
    prevCounter.total !== activeCounter.total ||
    prevCounter.label !== activeCounter.label
  ) {
    setPrevCounter(activeCounter);
    onActiveStageChange(activeCounter);
  }

  // Modal state
  const [showAddStage, setShowAddStage] = useState(false);
  const [editorState, setEditorState] = useState<{
    stage: StageEntry;
    index: number;
    isDuplicate?: boolean;
  } | null>(null);
  const [exportModal, setExportModal] = useState<{
    title: string; content: string; filename: string;
  } | null>(null);

  // Context menu
  const ctxMenu = useContextMenu();

  // Resolve a StageEntry for a given index (falls back to minimal entry from live data)
  const resolveEntry = (index: number): StageEntry | null => {
    if (pipelineConfig.stages[index]) return pipelineConfig.stages[index];
    if (stageProgresses?.[index]) return {
      stage_type: stageProgresses[index].stage_type,
      config: {},
      auto: stageProgresses[index].auto,
      reason: stageProgresses[index].reason,
    };
    return null;
  };

  // Pipeline-level context menu section (shown on all stage right-clicks and background)
  const getPipelineSection = () => ({
    items: [
      {
        label: 'Export config',
        icon: 'fa-solid fa-file-export',
        onClick: () => setExportModal({
          title: 'Export — Pipeline Config',
          content: JSON.stringify(pipelineConfig.stages, null, 2),
          filename: 'lanscape-pipeline.json',
        }),
      },
      {
        label: 'Clear queue',
        icon: 'fa-solid fa-trash-can',
        disabled: !!isLive,
        onClick: () => setPipelineConfig({ ...pipelineConfig, stages: [] }),
      },
      {
        label: 'Clone to new',
        icon: 'fa-regular fa-clone',
        onClick: () => {
          const cleanedStages = pipelineConfig.stages.map(
            ({ auto: _a, reason: _r, ...s }) => s,
          );
          setPipelineConfig({ ...pipelineConfig, stages: cleanedStages });
          setShowSettings(true);
        },
      },
    ],
  });

  // Per-stage context menu handler
  const handleStageContextMenu = (e: React.MouseEvent, entry: StageEntry, index: number) => {
    ctxMenu.handleContextMenu(e, () => [
      {
        items: [
          {
            label: 'Details',
            icon: 'fa-solid fa-sliders',
            onClick: () => setEditorState({ stage: entry, index }),
          },
          {
            label: 'Duplicate',
            icon: 'fa-regular fa-copy',
            onClick: () => {
              const { auto: _a, reason: _r, ...cleanEntry } = entry;
              // Index = end of current pipeline so it appends
              setEditorState({ stage: cleanEntry, index: pipelineConfig.stages.length, isDuplicate: true });
            },
          },
          {
            label: 'Delete',
            icon: 'fa-solid fa-trash',
            disabled: !!isLive,
            onClick: () => removeStage(index),
          },
        ],
      },
      getPipelineSection(),
      getGlobalSection(),
    ]);
  };

  // Background (non-stage) right-click on the timeline
  const handleTimelineContextMenu = (e: React.MouseEvent) => {
    ctxMenu.handleContextMenu(e, () => [getPipelineSection(), getGlobalSection()]);
  };

  // Single commit handler — edit in-place or insert (duplicate), always reads
  // fresh pipeline state from the store to avoid stale closure issues.
  const handleEditorSave = useCallback(async (index: number, updated: StageEntry) => {
    const { auto: _a, reason: _r, ...cleanEntry } = updated;
    const { pipelineConfig: current, setPipelineConfig: setConfig, currentScanId } = useScanStore.getState();
    if (editorState?.isDuplicate) {
      if (currentScanId) {
        // Live scan: append via WebSocket (same as AddStageModal)
        const ws = getWebSocketService();
        if (ws) await ws.appendStages(currentScanId, [{ stage_type: cleanEntry.stage_type, config: cleanEntry.config }]);
      } else {
        // Config mode: push to end of pipeline
        setConfig({ ...current, stages: [...current.stages, cleanEntry] });
      }
    } else {
      // Edit existing stage in-place
      const stages = [...current.stages];
      stages[index] = cleanEntry;
      setConfig({ ...current, stages });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorState?.isDuplicate]);

  return (
    <>
      <div className="stage-indicators" onContextMenu={handleTimelineContextMenu}>
        {isLive && !isTransitioning ? (
          <AnimatePresence mode="popLayout" initial={false}>
            {manager.liveItems.map((item, i) => {
              const entry = resolveEntry(item.index);
              // Use pipeline config as the source of truth for auto flag;
              // falls back to WS broadcast value if pipeline entry is unavailable
              const isAuto = entry?.auto ?? stageProgresses![item.index]?.auto ?? false;
              return (
                <LiveStageIndicator
                  key={item.key}
                  item={item}
                  stage={stageProgresses![item.index]}
                  isAuto={isAuto}
                  isCurrent={currentStageIndex === item.index}
                  staggerIndex={i}
                  onClick={() => entry && setEditorState({ stage: entry, index: item.index })}
                  onContextMenu={(e) => entry && handleStageContextMenu(e, entry, item.index)}
                />
              );
            })}
          </AnimatePresence>
        ) : !isTransitioning ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={previewIds} strategy={horizontalListSortingStrategy}>
              {manager.previewItems.map((item, i) => (
                <PreviewStageIndicator
                  key={item.key}
                  id={previewIds[item.index]}
                  item={item}
                  entry={pipelineConfig.stages[item.index]}
                  staggerIndex={i}
                  dragActive={!!activeId}
                  onClick={() => setEditorState({ stage: pipelineConfig.stages[item.index], index: item.index })}
                  onContextMenu={(e) => handleStageContextMenu(e, pipelineConfig.stages[item.index], item.index)}
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
              {activeDragEntry ? (
                <StageDragOverlay entry={activeDragEntry} />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : null}

        {/* Add stage button */}
        <motion.button
          className="stage-indicator-add"
          onClick={() => setShowAddStage(true)}
          data-tooltip-id="tooltip"
          data-tooltip-content="Add stage"
          layout
          transition={SPRING}
        >
          <i className="fa-solid fa-plus" />
        </motion.button>
      </div>

      {/* Modals rendered outside the flex container to avoid overflow clipping */}
      <AddStageModal
        isOpen={showAddStage}
        onClose={() => setShowAddStage(false)}
        scanId={currentScanId ?? undefined}
      />
      <StageEditorModal
        stage={editorState?.stage ?? null}
        stageIndex={editorState?.index ?? 0}
        readOnly={!!isLive && !editorState?.isDuplicate}
        saveLabel={editorState?.isDuplicate ? 'Add Stage' : 'Save'}
        onSave={handleEditorSave}
        onClose={() => setEditorState(null)}
      />
      {exportModal && (
        <ExportModal
          isOpen
          onClose={() => setExportModal(null)}
          title={exportModal.title}
          content={exportModal.content}
          filename={exportModal.filename}
        />
      )}
      {ctxMenu.visible && (
        <ContextMenu
          sections={ctxMenu.sections}
          position={ctxMenu.position}
          onClose={ctxMenu.close}
        />
      )}
    </>
  );
}

// ── Live stage indicator ───────────────────────────────────────────

function LiveStageIndicator({
  item,
  stage,
  isAuto,
  isCurrent,
  staggerIndex,
  onClick,
  onContextMenu,
}: {
  item: StageItem;
  stage: StageProgress;
  isAuto: boolean;
  isCurrent: boolean;
  staggerIndex: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const pct = stage.total > 0 ? (stage.completed / stage.total) * 100 : 0;
  const isSkipped = stage.skipped === true;
  const isDone = stage.finished;
  const offset = circumference - (pct / 100) * circumference;
  const meta = getStageMeta(stage.stage_type);

  let tooltipContent: string;
  if (isSkipped) {
    tooltipContent = `${meta.label}: Skipped — ${stage.skip_reason ?? 'incompatible'}`;
  } else if (isDone) {
    tooltipContent = `${meta.label}: ${formatStageRuntime(stage.runtime)}`;
  } else if (isCurrent) {
    tooltipContent = `${meta.label}: ${Math.round(pct)}%`;
  } else {
    tooltipContent = meta.label;
  }

  let stateClass = 'stage-indicator--pending';
  if (isSkipped) stateClass = 'stage-indicator--skipped';
  else if (isDone) stateClass = 'stage-indicator--done';
  else if (isCurrent) stateClass = 'stage-indicator--active';

  const variants = getVariants(item.intent);

  return (
    <motion.div
      layout
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        ...SPRING,
        delay: staggerIndex * (STAGGER_MS / 1000),
      }}
      className={`stage-indicator ${stateClass}${isAuto ? ' stage-indicator--auto' : ''}`}
      data-tooltip-id="tooltip"
      data-tooltip-content={tooltipContent}
      style={{ transformStyle: 'preserve-3d', cursor: 'pointer' }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <svg className="stage-indicator-ring" viewBox="0 0 32 32">
        <circle
          className={`stage-indicator-bg${isSkipped ? ' stage-indicator-bg--skipped' : ''}${isAuto ? ' stage-indicator-bg--auto' : ''}`}
          cx="16" cy="16" r={radius}
        />
        {!isSkipped && isDone ? (
          <circle
            className="stage-indicator-fill stage-indicator-fill--done"
            cx="16" cy="16" r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={0}
          />
        ) : !isSkipped ? (
          <circle
            className="stage-indicator-fill"
            cx="16" cy="16" r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        ) : null}
      </svg>
      <i className={`${meta.icon} stage-indicator-icon`} />
    </motion.div>
  );
}

// ── Preview stage indicator ────────────────────────────────────────

function PreviewStageIndicator({
  id,
  item,
  entry,
  staggerIndex,
  dragActive,
  onClick,
  onContextMenu,
}: {
  id: string;
  item: StageItem;
  entry: StageEntry;
  staggerIndex: number;
  dragActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const meta = getStageMeta(entry.stage_type);
  const tooltipText = entry.auto
    ? `${meta.label} (auto: ${entry.reason})`
    : meta.label;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition: dndTransition,
    isDragging,
  } = useSortable({ id });

  const variants = getVariants(item.intent);
  const showTooltip = !dragActive;

  // Outer plain div: owns dnd-kit transform so framer-motion never intercepts it
  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'inline-flex',
        transform: CSS.Transform.toString(transform),
        transition: dndTransition ?? undefined,
        opacity: isDragging ? 0 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      {/* Inner motion.div: only framer-motion enter/exit — no transform conflict */}
      <motion.div
        variants={variants}
        initial={item.intent === 'enter' ? 'initial' : false}
        animate="animate"
        exit="exit"
        transition={{
          ...SPRING,
          delay: staggerIndex * (STAGGER_MS / 1000),
        }}
        className={`stage-indicator stage-indicator--preview${entry.auto ? ' stage-indicator--auto' : ''}`}
        data-tooltip-id={showTooltip ? 'tooltip' : undefined}
        data-tooltip-content={showTooltip ? tooltipText : undefined}
        style={{ transformStyle: 'preserve-3d' }}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <svg className="stage-indicator-ring" viewBox="0 0 32 32">
          <circle
            className={`stage-indicator-bg${entry.auto ? ' stage-indicator-bg--auto' : ''}`}
            cx="16" cy="16" r={14}
          />
        </svg>
        <i className={`${meta.icon} stage-indicator-icon`} />
      </motion.div>
    </div>
  );
}

// ── Drag overlay (floating cursor ghost) ──────────────────────────

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
