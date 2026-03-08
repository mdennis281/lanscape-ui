import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CounterWheel,
  decimalSpecs,
  timeSpecs,
  hexSpecs,
  computePositions,
  settledPositions,
  animationDuration,
  NUMBER_ANIMATION,
  TIME_ANIMATION,
} from './counter';

// ============================================================================
// JIGGLE ANIMATION — Damped oscillation for lock-in effect
// ============================================================================

/** Duration of the jiggle animation in ms */
const JIGGLE_DURATION = 400;
/** Number of oscillations during jiggle */
const JIGGLE_FREQUENCY = 3;
/** Initial amplitude of jiggle (in digit units) */
const JIGGLE_AMPLITUDE = 0.08;

/**
 * Compute jiggle offset for a single wheel.
 * Uses damped sine wave: amplitude * sin(freq * t) * e^(-decay * t)
 * Only jiggles if the wheel was off-center (had fractional position).
 */
function jiggleOffset(progress: number, wasFractional: boolean): number {
  if (!wasFractional) return 0;
  const decay = 4; // How quickly oscillation dies down
  const t = progress * JIGGLE_DURATION / 1000;
  const envelope = Math.exp(-decay * t);
  const wave = Math.sin(2 * Math.PI * JIGGLE_FREQUENCY * progress);
  return JIGGLE_AMPLITUDE * wave * envelope;
}

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

  // Reset positions immediately when digits changes (specs array changed)
  useEffect(() => {
    setPositions(computePositions(targetValue, specs)); // eslint-disable-line react-hooks/set-state-in-effect -- sync to spec change
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {specs.map((spec, i) => (
        <CounterWheel key={i} position={positions[i] ?? 0} base={spec.base} />
      ))}
    </span>
  );
}

// ============================================================================
// HEX ODOMETER — Base-16 counter with Geneva mechanism animation
// ============================================================================

interface HexOdometerProps {
  value: number;
  digits: number;  // How many hex digits to display (pads with zeros)
  className?: string;
}

/**
 * Hexadecimal odometer with realistic mechanical animation.
 * Displays values 0-F per digit, using the same Geneva mechanism as decimal.
 */
export function HexOdometer({ value, digits, className = '' }: HexOdometerProps) {
  const specs = useMemo(() => hexSpecs(digits), [digits]);
  const targetValue = Math.max(0, Math.floor(value));

  const prevValueRef = useRef(targetValue);
  const frameRef = useRef<number | null>(null);
  const [positions, setPositions] = useState<number[]>(() =>
    computePositions(targetValue, specs)
  );

  // Reset positions when digits changes
  useEffect(() => {
    setPositions(computePositions(targetValue, specs)); // eslint-disable-line react-hooks/set-state-in-effect -- sync to spec change
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const startValue = prevValueRef.current;
    if (targetValue === startValue) return;

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

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <span className={`odometer ${className}`}>
      <span style={{ color: '#888', marginRight: '0.1em' }}>0x</span>
      {specs.map((spec, i) => (
        <CounterWheel key={i} position={positions[i] ?? 0} base={spec.base} />
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
  /** When true, snap wheels to settled positions with jiggle effect */
  locked?: boolean;
}

/**
 * Time display (MM:SS) with realistic mechanical animation.
 *
 * Uses mixed-base wheels: 10 for most digits, 6 for seconds tens (0-5).
 * Animates via Geneva mechanism with appropriate carry boundaries.
 */
export function OdometerTime({ seconds, className = '', resetKey, locked = false }: OdometerTimeProps) {
  // Memoize specs to prevent animation cancellation on re-renders
  const specs = useMemo(() => timeSpecs(), []);
  // Keep fractional seconds for smooth animation - only floor for position computation
  const targetSecs = Math.max(0, seconds);

  const currentRef = useRef(targetSecs);
  const frameRef = useRef<number | null>(null);
  const jiggleFrameRef = useRef<number | null>(null);
  const [positions, setPositions] = useState<number[]>(() =>
    computePositions(targetSecs, specs)
  );

  // Track locked state for jiggle animation
  const [prevLocked, setPrevLocked] = useState(locked);

  // Track resetKey for instant reset
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  const resetKeyInitialized = useRef(false);

  // Handle instant reset when resetKey changes (during render)
  if (resetKey !== undefined && resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPositions(computePositions(0, specs));
    currentRef.current = 0; // eslint-disable-line react-hooks/refs -- intentional reset during derived-state render
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

  // Jiggle animation when locked becomes true
  useEffect(() => {
    if (locked && !prevLocked) {
      // Just became locked - start jiggle animation
      setPrevLocked(true);

      // Cancel any running value animation
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      // Capture current positions and compute which wheels were fractional
      const currentPositions = positions;
      const targetPositions = settledPositions(Math.floor(targetSecs), specs);
      const wasFractional = currentPositions.map((pos) => {
        const frac = Math.abs(pos - Math.round(pos));
        return frac > 0.01; // Consider fractional if > 1% off integer
      });

      const startTime = performance.now();

      const animateJiggle = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / JIGGLE_DURATION);

        // Ease towards target with jiggle overlay
        const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const jiggled = targetPositions.map((target, i) => {
          const start = currentPositions[i];
          const current = start + (target - start) * easeProgress;
          return current + jiggleOffset(progress, wasFractional[i]);
        });

        setPositions(jiggled);

        if (progress < 1) {
          jiggleFrameRef.current = requestAnimationFrame(animateJiggle);
        } else {
          // Snap to exact settled positions
          setPositions(targetPositions);
          currentRef.current = Math.floor(targetSecs);
          jiggleFrameRef.current = null;
        }
      };

      jiggleFrameRef.current = requestAnimationFrame(animateJiggle);
    } else if (!locked && prevLocked) {
      // Unlocked - just update state
      setPrevLocked(false);
    }
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Main animation effect (skip if locked)
  useEffect(() => {
    if (locked) return; // Don't animate while locked

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
  }, [targetSecs, specs, locked]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (jiggleFrameRef.current) cancelAnimationFrame(jiggleFrameRef.current);
    };
  }, []);

  return (
    <span className={`odometer ${className}`}>
      <CounterWheel position={positions[0] ?? 0} base={specs[0]?.base ?? 10} />
      <CounterWheel position={positions[1] ?? 0} base={specs[1]?.base ?? 10} />
      <span className="odometer-colon">:</span>
      <CounterWheel position={positions[2] ?? 0} base={specs[2]?.base ?? 6} />
      <CounterWheel position={positions[3] ?? 0} base={specs[3]?.base ?? 10} />
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
