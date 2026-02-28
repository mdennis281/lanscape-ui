import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CounterWheel,
  decimalSpecs,
  timeSpecs,
  computePositions,
  animationDuration,
  NUMBER_ANIMATION,
  TIME_ANIMATION,
} from './counter';

// ============================================================================
// ODOMETER COMPONENT — Decimal counter with Geneva mechanism animation
// ============================================================================

interface OdometerProps {
  value: number;
  digits: number;  // How many digits to display (pads with zeros)
  className?: string;
}

/**
 * Decimal number odometer with realistic mechanical animation.
 *
 * Animates a single floating-point value from previous to target, deriving
 * each wheel's position via the Geneva mechanism. Higher digits only roll
 * when the digit to their right passes through the carry transition zone.
 */
export function Odometer({ value, digits, className = '' }: OdometerProps) {
  // Memoize specs so we don't cancel animations on every render
  const specs = useMemo(() => decimalSpecs(digits), [digits]);
  const targetValue = Math.max(0, Math.floor(value));

  const prevValueRef = useRef(targetValue);
  const frameRef = useRef<number | null>(null);
  const [positions, setPositions] = useState<number[]>(() =>
    computePositions(targetValue, specs)
  );

  useEffect(() => {
    const startValue = prevValueRef.current;
    if (targetValue === startValue) return;

    // Cancel any running animation
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const diff = targetValue - startValue;
    const duration = animationDuration(diff, NUMBER_ANIMATION);
    const { easing } = NUMBER_ANIMATION;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const currentV = startValue + diff * easing(progress);
      setPositions(computePositions(currentV, specs));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        // Final frame: compute positions at exact target
        setPositions(computePositions(targetValue, specs));
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    prevValueRef.current = targetValue;

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [targetValue, specs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <span className={`odometer ${className}`}>
      {positions.map((pos, i) => (
        <CounterWheel key={i} position={pos} base={specs[i].base} />
      ))}
    </span>
  );
}

// ============================================================================
// ODOMETER TIME — MM:SS display with Geneva mechanism animation
// ============================================================================

interface OdometerTimeProps {
  seconds: number;
  className?: string;
  /** When this value changes, instantly reset to 0 instead of animating */
  resetKey?: string | number;
}

/**
 * Time display (MM:SS) with realistic mechanical animation.
 *
 * Uses mixed-base wheels: 10 for most digits, 6 for seconds tens (0-5).
 * Animates via Geneva mechanism with appropriate carry boundaries.
 */
export function OdometerTime({ seconds, className = '', resetKey }: OdometerTimeProps) {
  // Memoize specs to prevent animation cancellation on re-renders
  const specs = useMemo(() => timeSpecs(), []);
  const targetSecs = Math.floor(Math.max(0, seconds));

  const currentRef = useRef(targetSecs);
  const frameRef = useRef<number | null>(null);
  const [positions, setPositions] = useState<number[]>(() =>
    computePositions(targetSecs, specs)
  );

  // Track resetKey for instant reset
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  const resetKeyInitialized = useRef(false);

  // Handle instant reset when resetKey changes (during render)
  if (resetKey !== undefined && resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPositions(computePositions(0, specs));
    currentRef.current = 0;
  }

  // Cancel animation when resetKey changes
  useEffect(() => {
    if (!resetKeyInitialized.current) {
      resetKeyInitialized.current = true;
      return;
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    currentRef.current = 0;
  }, [resetKey]);

  // Main animation effect
  useEffect(() => {
    const startValue = currentRef.current;
    const diff = targetSecs - startValue;

    if (Math.abs(diff) < 0.001) {
      currentRef.current = targetSecs;
      setPositions(computePositions(targetSecs, specs));
      return;
    }

    // Cancel any running animation
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const duration = animationDuration(diff, TIME_ANIMATION);
    const { easing } = TIME_ANIMATION;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const currentV = startValue + diff * easing(progress);
      currentRef.current = currentV;
      setPositions(computePositions(currentV, specs));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        currentRef.current = targetSecs;
        setPositions(computePositions(targetSecs, specs));
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  }, [targetSecs, specs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <span className={`odometer ${className}`}>
      <CounterWheel position={positions[0]} base={specs[0].base} />
      <CounterWheel position={positions[1]} base={specs[1].base} />
      <span className="odometer-colon">:</span>
      <CounterWheel position={positions[2]} base={specs[2].base} />
      <CounterWheel position={positions[3]} base={specs[3].base} />
    </span>
  );
}

// ============================================================================
// PLACEHOLDER — For loading states
// ============================================================================

export function OdometerTimePlaceholder({ className = '' }: { className?: string }) {
  return (
    <span className={`odometer muted ${className}`}>
      <span className="odometer-wheel"><span className="odometer-wheel-inner"><span className="odometer-digit">?</span></span></span>
      <span className="odometer-wheel"><span className="odometer-wheel-inner"><span className="odometer-digit">?</span></span></span>
      <span className="odometer-colon">:</span>
      <span className="odometer-wheel"><span className="odometer-wheel-inner"><span className="odometer-digit">?</span></span></span>
      <span className="odometer-wheel"><span className="odometer-wheel-inner"><span className="odometer-digit">?</span></span></span>
    </span>
  );
}
