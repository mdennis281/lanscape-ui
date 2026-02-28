// Public API for the counter module
export { CounterWheel } from './CounterWheel';
export type { CounterWheelProps } from './CounterWheel';

export {
  // Types
  type WheelSpec,
  type AnimationConfig,
  // Constants
  DIGIT_HEIGHT,
  DEFAULT_ENGAGE,
  // Animation presets
  NUMBER_ANIMATION,
  TIME_ANIMATION,
  // Pure math
  smoothstep,
  animationDuration,
  wheelPosition,
  settledPositions,
  computePositions,
  // Spec builders
  decimalSpecs,
  timeSpecs,
  // Debug helpers
  formatPositions,
  runPositionTests,
} from './geneva';
