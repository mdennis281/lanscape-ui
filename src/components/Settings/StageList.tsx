/**
 * StageList — Sortable list of StageCards using @dnd-kit.
 */

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

  // Generate stable IDs for each stage entry
  const ids = stages.map((_, i) => `stage-${i}`);

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
              key={ids[i]}
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
