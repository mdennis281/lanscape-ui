import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * dnd-kit sensors for the stage pipelines (overview timeline + settings).
 *
 * Mouse and touch get separate activation rules, so a single PointerSensor
 * isn't used:
 *  - Mouse: a 5px drag starts it, so a click stays a click.
 *  - Touch: a short still hold starts it. A distance rule on touch would steal
 *    every horizontal swipe meant to scroll the stage strip. The hold is
 *    shorter than the long-press menu (src/platform/longPress.ts), so holding
 *    a stage lifts it first and then opens its menu. Moving the finger
 *    dismisses the menu (ContextMenu, sheet mode) and carries on dragging,
 *    the same as an iOS home-screen icon.
 */
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
