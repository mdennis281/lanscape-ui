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

import { useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useScanStore } from '../../store';
import { getStageMeta } from '../Settings/stageRegistry';
import { AddStageModal } from './AddStageModal';
import { useStageManager, type ActiveStageCounter, type StageItem } from './useStageManager';
import type { StageProgress, StageEntry } from '../../types';

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
  const isTransitioning = useScanStore((s) => s.isTransitioning);

  const stageProgresses = status?.stages;
  const currentStageIndex = status?.current_stage_index;
  const isLive = stageProgresses && stageProgresses.length > 0;

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

  // Add-stage modal state
  const [showAddStage, setShowAddStage] = useState(false);

  return (
    <>
      <div className="stage-indicators" style={{ perspective: 400 }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {isLive && !isTransitioning ? (
            // Live mode: show running/completed stage progress
            manager.liveItems.map((item, i) => (
              <LiveStageIndicator
                key={item.key}
                item={item}
                stage={stageProgresses![item.index]}
                isCurrent={currentStageIndex === item.index}
                staggerIndex={i}
              />
            ))
          ) : !isTransitioning ? (
            // Preview mode: show configured stages
            manager.previewItems.map((item, i) => (
              <PreviewStageIndicator
                key={item.key}
                item={item}
                entry={pipelineConfig.stages[item.index]}
                staggerIndex={i}
              />
            ))
          ) : null}
        </AnimatePresence>

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

      {/* Modal rendered outside the flex container to avoid overflow clipping */}
      <AddStageModal
        isOpen={showAddStage}
        onClose={() => setShowAddStage(false)}
        scanId={currentScanId ?? undefined}
      />
    </>
  );
}

// ── Live stage indicator ───────────────────────────────────────────

function LiveStageIndicator({
  item,
  stage,
  isCurrent,
  staggerIndex,
}: {
  item: StageItem;
  stage: StageProgress;
  isCurrent: boolean;
  staggerIndex: number;
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
      className={`stage-indicator ${stateClass}`}
      data-tooltip-id="tooltip"
      data-tooltip-content={tooltipContent}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <svg className="stage-indicator-ring" viewBox="0 0 32 32">
        <circle
          className={`stage-indicator-bg${isSkipped ? ' stage-indicator-bg--skipped' : ''}`}
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
  item,
  entry,
  staggerIndex,
}: {
  item: StageItem;
  entry: StageEntry;
  staggerIndex: number;
}) {
  const meta = getStageMeta(entry.stage_type);
  const tooltipText = entry.auto
    ? `${meta.label} (auto: ${entry.reason})`
    : meta.label;

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
      className={`stage-indicator stage-indicator--preview${entry.auto ? ' stage-indicator--auto' : ''}`}
      data-tooltip-id="tooltip"
      data-tooltip-content={tooltipText}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <svg className="stage-indicator-ring" viewBox="0 0 32 32">
        <circle
          className={`stage-indicator-bg${entry.auto ? ' stage-indicator-bg--auto' : ''}`}
          cx="16" cy="16" r={14}
        />
      </svg>
      <i className={`${meta.icon} stage-indicator-icon`} />
    </motion.div>
  );
}
