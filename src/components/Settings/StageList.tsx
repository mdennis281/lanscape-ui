/**
 * StageList — Sortable list of StageCards using @dnd-kit.
 */

import { useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { StageCard } from './StageCard';
import type { StageEntry, PortListSummary } from '../../types';

interface StageListProps {
  stages: StageEntry[];
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onConfigChange: (index: number, config: Record<string, unknown>) => void;
  portLists?: PortListSummary[];
}

export function StageList({ stages, onRemove, onReorder, onConfigChange, portLists }: StageListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Stable dnd-kit IDs (position-based, used only for collision detection)
  const ids = stages.map((_, i) => `stage-${i}`);

  // Stable React keys that survive reordering — keyed by content fingerprint + nth-occurrence index.
  // When the array is reordered the same entries get the same keys, so React keeps their DOM nodes.
  const stableKeyMapRef = useRef<Map<string, string>>(new Map());
  const fingerprints = stages.map((s) => `${s.stage_type}:${JSON.stringify(s.config)}`);
  const fingerprintCount: Record<string, number> = {};
  const stableKeys = fingerprints.map((fp) => {
    const n = fingerprintCount[fp] ?? 0;
    fingerprintCount[fp] = n + 1;
    const mapKey = `${fp}::${n}`;
    if (!stableKeyMapRef.current.has(mapKey)) {
      stableKeyMapRef.current.set(mapKey, `sk-${Math.random().toString(36).slice(2)}`);
    }
    return stableKeyMapRef.current.get(mapKey)!;
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = ids.indexOf(active.id as string);
    const toIndex = ids.indexOf(over.id as string);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorder(fromIndex, toIndex);
    }
  };

  if (stages.length === 0) {
    return (
      <div className="stage-list-empty">
        <i className="fa-solid fa-layer-group" />
        <p>No stages added yet</p>
        <p className="text-muted">Click a stage type above to add it to the pipeline</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="stage-list">
          {stages.map((stage, i) => (
            <StageCard
              key={stableKeys[i]}
              id={ids[i]}
              stage={stage}
              index={i}
              onRemove={() => onRemove(i)}
              onConfigChange={(config) => onConfigChange(i, config)}
              portLists={portLists}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
