import { memo } from 'react';
import { DIGIT_HEIGHT } from './geneva';

// ============================================================================
// COUNTER WHEEL — Generic display component for a single odometer wheel
// ============================================================================
//
// A pure display component. Receives a continuous position and renders
// a 3-digit scrolling window. Supports arbitrary numeric bases via the
// `base` param and optional custom symbols (e.g. hex digits).
//
// Designed for eventual extraction into an npm package alongside geneva.ts.
// ============================================================================

export interface CounterWheelProps {
  /** Continuous position value (e.g. 5.3 = between 5 and 6) */
  position: number;
  /** Number of positions on this wheel (default 10) */
  base?: number;
  /** Optional custom symbols. Default: ['0','1',…,'base-1'] */
  symbols?: string[];
}

/**
 * A single counter wheel — renders a prev/current/next digit window
 * and uses CSS transform to scroll to the fractional position.
 *
 * Requires the parent to provide `.odometer-wheel` / `.odometer-digit` styles.
 */
export const CounterWheel = memo(function CounterWheel({
  position,
  base = 10,
  symbols,
}: CounterWheelProps) {
  // Normalize position into [0, base)
  const norm = ((position % base) + base) % base;
  const displayIdx = Math.floor(norm);
  const fraction = norm - displayIdx;
  const offset = -fraction * DIGIT_HEIGHT;

  const prevIdx = (displayIdx - 1 + base) % base;
  const nextIdx = (displayIdx + 1) % base;

  // Default symbols: 0-9 for base 10, 0-5 for base 6, 0-F for base 16, etc.
  const sym = symbols ?? defaultSymbols(base);

  return (
    <span className="odometer-wheel">
      <span
        className="odometer-wheel-inner"
        style={{ transform: `translateY(${offset}em)` }}
      >
        <span className="odometer-digit">{sym[prevIdx]}</span>
        <span className="odometer-digit">{sym[displayIdx]}</span>
        <span className="odometer-digit">{sym[nextIdx]}</span>
      </span>
    </span>
  );
});

/** Generate default symbol array for a given base */
function defaultSymbols(base: number): string[] {
  return Array.from({ length: base }, (_, i) => {
    if (i < 10) return String(i);
    // For bases > 10, use uppercase hex-style letters
    return String.fromCharCode(65 + i - 10); // A=10, B=11, etc.
  });
}
