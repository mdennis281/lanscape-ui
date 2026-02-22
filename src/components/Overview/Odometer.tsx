import { useEffect, useRef, useState, memo } from 'react';

// ============================================================================
// ODOMETER CONFIGURATION - Adjust these to fine-tune animation behavior
// ============================================================================

/**
 * DIGIT_HEIGHT: Height of each digit in em units.
 * This controls the scroll distance per digit.
 * Match this to your CSS .odometer-digit height.
 */
const DIGIT_HEIGHT = 1.2;

/**
 * Main Odometer Animation Settings (for number counters)
 */
const ODOMETER_CONFIG = {
  /**
   * BASE_DURATION: Base animation duration in ms for 1 step
   */
  BASE_DURATION: 150,

  /**
   * MAX_DURATION: Maximum animation duration regardless of steps
   */
  MAX_DURATION: 800,

  /**
   * DURATION_PER_STEP: Additional ms per step of movement
   */
  DURATION_PER_STEP: 50,

  /**
   * EASING: Easing function for smooth animation
   */
  easing: (t: number) => {
    // Ease-out cubic for smooth deceleration
    return 1 - Math.pow(1 - t, 3);
  },
};

/**
 * Time Wheel Animation Settings (for MM:SS display - 0-9 range)
 */
const TIME_WHEEL_CONFIG = {
  BASE_SPEED: 0.05,
  MAX_SPEED: 0.18,
  ACCEL_FACTOR: 0.015,
  SNAP_THRESHOLD: 0.01,
};

// ============================================================================
// ODOMETER WHEEL COMPONENT - Individual digit wheel with self-contained animation
// ============================================================================

interface OdometerWheelProps {
  startDigit: number;       // The digit to animate FROM (0-9)
  targetDigit: number;      // The digit to animate TO (0-9)
  direction: 1 | -1 | 0;    // 1 = forward, -1 = backward, 0 = no change
  duration: number;         // Animation duration in ms
}

/**
 * Individual odometer wheel that manages its own animation.
 * Renders a 3-digit window and scrolls to show the target.
 */
const OdometerWheel = memo(function OdometerWheel({ 
  startDigit,
  targetDigit, 
  direction, 
  duration 
}: OdometerWheelProps) {
  // Current position (0-9, can temporarily exceed during animation)
  const [position, setPosition] = useState(startDigit);
  
  // Animation refs
  const frameRef = useRef<number | null>(null);
  const animationStartRef = useRef<number | null>(null);

  useEffect(() => {
    // No animation needed — position is already correct from useState(startDigit)
    if (direction === 0 || startDigit === targetDigit) {
      return;
    }

    // Calculate how many steps to move
    let steps: number;
    if (direction > 0) {
      // Forward: if target < start, wrap through 9->0
      steps = targetDigit >= startDigit 
        ? targetDigit - startDigit 
        : (10 - startDigit) + targetDigit;
    } else {
      // Backward: if target > start, wrap through 0->9
      steps = targetDigit <= startDigit 
        ? startDigit - targetDigit 
        : startDigit + (10 - targetDigit);
    }

    // Total distance to travel (in position units)
    const totalDelta = direction > 0 ? steps : -steps;
    
    animationStartRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - animationStartRef.current!;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = ODOMETER_CONFIG.easing(progress);

      // Calculate current position
      const currentPos = startDigit + totalDelta * easedProgress;
      
      // Normalize to 0-9 range for display
      const normalizedPos = ((currentPos % 10) + 10) % 10;
      setPosition(normalizedPos);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - snap to exact target
        setPosition(targetDigit);
        frameRef.current = null;
      }
    };

    // Start animation
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [startDigit, targetDigit, direction, duration]);

  // Calculate display: which digit to show and the offset
  const displayDigit = Math.floor(position);
  const fraction = position - displayDigit;
  const offset = -fraction * DIGIT_HEIGHT;

  // Get prev/next digits for the 3-digit window
  const prevDigit = (displayDigit - 1 + 10) % 10;
  const nextDigit = (displayDigit + 1) % 10;

  return (
    <span className="odometer-wheel">
      <span
        className="odometer-wheel-inner"
        style={{ transform: `translateY(${offset}em)` }}
      >
        <span className="odometer-digit">{prevDigit}</span>
        <span className="odometer-digit">{displayDigit}</span>
        <span className="odometer-digit">{nextDigit}</span>
      </span>
    </span>
  );
});

// ============================================================================
// MAIN ODOMETER COMPONENT - Orchestrates multiple wheels
// ============================================================================

interface OdometerProps {
  value: number;
  digits: number;  // Required: how many digits to display (pads with zeros)
  className?: string;
}

// Helper to extract digits from a number with padding
function getDigits(value: number, numDigits: number): number[] {
  const digits: number[] = [];
  let remaining = Math.max(0, Math.floor(value));
  for (let i = 0; i < numDigits; i++) {
    digits.unshift(remaining % 10);
    remaining = Math.floor(remaining / 10);
  }
  return digits;
}

/**
 * Main Odometer component - orchestrates individual wheel animations
 */
export function Odometer({ value, digits, className = '' }: OdometerProps) {
  const prevValueRef = useRef(Math.max(0, Math.floor(value)));
  const prevDigitsRef = useRef<number[]>(getDigits(value, digits));
  
  // Animation key to force re-render of wheels when value changes
  const [animationKey, setAnimationKey] = useState(0);
  const [wheelConfigs, setWheelConfigs] = useState<Array<{
    startDigit: number;
    targetDigit: number;
    direction: 1 | -1 | 0;
    duration: number;
  }>>(() => getDigits(value, digits).map(d => ({
    startDigit: d,
    targetDigit: d,
    direction: 0 as const,
    duration: 0,
  })));

  useEffect(() => {
    const targetValue = Math.max(0, Math.floor(value));
    const prevValue = prevValueRef.current;
    const newTargetDigits = getDigits(targetValue, digits);
    const prevDigits = prevDigitsRef.current;

    // Check if value actually changed
    if (targetValue === prevValue) {
      return;
    }

    // Determine overall direction
    const overallDirection: 1 | -1 = targetValue > prevValue ? 1 : -1;

    // Calculate config for each wheel
    const { BASE_DURATION, MAX_DURATION, DURATION_PER_STEP } = ODOMETER_CONFIG;
    

    // Calculate how many times each digit should spin (carry spin)
    // For each digit, count how many times it "rolls over" due to higher digit changes
    // Example: 45 -> 75, tens changes by 3, so ones should spin 3 full cycles
    // We'll work from left (most significant) to right (least significant)
    let carrySteps = 0;
    const newConfigs = newTargetDigits.map((targetDigit, i) => {
      const fromDigit = prevDigits[i];
      let steps = 0;
      let direction: 1 | -1 | 0 = 0;

      if (i === 0) {
        // Most significant digit: just normal odometer logic
        if (fromDigit === targetDigit) {
          steps = 0;
          direction = 0;
        } else if (overallDirection > 0) {
          steps = targetDigit >= fromDigit
            ? targetDigit - fromDigit
            : (10 - fromDigit) + targetDigit;
          direction = 1;
        } else {
          steps = targetDigit <= fromDigit
            ? fromDigit - targetDigit
            : fromDigit + (10 - targetDigit);
          direction = -1;
        }
        carrySteps = steps;
      } else {
        // Lower digits: spin full cycles for each step of higher digit
        if (overallDirection > 0) {
          steps = carrySteps * 10;
          direction = carrySteps > 0 ? 1 : 0;
        } else {
          steps = carrySteps * 10;
          direction = carrySteps > 0 ? -1 : 0;
        }
        // If the digit itself changes, add the direct step
        if (fromDigit !== targetDigit) {
          let digitStep = 0;
          if (overallDirection > 0) {
            digitStep = targetDigit >= fromDigit
              ? targetDigit - fromDigit
              : (10 - fromDigit) + targetDigit;
            direction = 1;
          } else {
            digitStep = targetDigit <= fromDigit
              ? fromDigit - targetDigit
              : fromDigit + (10 - targetDigit);
            direction = -1;
          }
          steps += digitStep;
        }
        // For next lower digit, carry how many times this digit rolled over
        carrySteps = overallDirection > 0
          ? (targetDigit >= fromDigit
              ? targetDigit - fromDigit
              : (10 - fromDigit) + targetDigit)
          : (targetDigit <= fromDigit
              ? fromDigit - targetDigit
              : fromDigit + (10 - targetDigit));
      }

      // Duration scales with number of steps
      const duration = Math.min(
        MAX_DURATION,
        BASE_DURATION + steps * DURATION_PER_STEP
      );

      return {
        startDigit: fromDigit,
        targetDigit,
        direction,
        duration,
      };
    });

    // Update state BEFORE updating refs so wheels get correct start positions
    setWheelConfigs(newConfigs);
    setAnimationKey(k => k + 1);
    
    // Now update refs for next animation
    prevValueRef.current = targetValue;
    prevDigitsRef.current = newTargetDigits;
  }, [value, digits]);

  return (
    <span className={`odometer ${className}`}>
      {wheelConfigs.map((config, i) => (
        <OdometerWheel
          key={`${i}-${animationKey}`}
          startDigit={config.startDigit}
          targetDigit={config.targetDigit}
          direction={config.direction}
          duration={config.duration}
        />
      ))}
    </span>
  );
}

// Time display with MM:SS format - animates total seconds, extracts digits inline
// resetKey: when this value changes, instantly reset to 0 instead of animating
export function OdometerTime({ seconds, className = '', resetKey }: { seconds: number; className?: string; resetKey?: string | number }) {
  const [displaySeconds, setDisplaySeconds] = useState(Math.floor(Math.max(0, seconds)));
  const [digitOffsets, setDigitOffsets] = useState([0, 0, 0, 0]); // m10, m1, s10, s1
  const targetRef = useRef(Math.floor(Math.max(0, seconds)));
  const currentRef = useRef(Math.floor(Math.max(0, seconds)));
  const animatingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  const resetKeyInitialized = useRef(false);

  // Handle instant reset when resetKey changes:
  // State resets happen during render (React's recommended pattern for
  // "adjusting state when a prop changes"), ref cleanup in an effect.
  if (resetKey !== undefined && resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setDisplaySeconds(0);
    setDigitOffsets([0, 0, 0, 0]);
  }

  // Cancel ongoing animation and reset position refs when resetKey changes
  useEffect(() => {
    // Skip initial mount — refs are already initialized correctly
    if (!resetKeyInitialized.current) {
      resetKeyInitialized.current = true;
      return;
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    animatingRef.current = false;
    currentRef.current = 0;
    targetRef.current = 0;
  }, [resetKey]);

  useEffect(() => {
    const targetSecs = Math.floor(Math.max(0, seconds));
    targetRef.current = targetSecs;

    // Start animation if not already running and we need to move
    if (!animatingRef.current && currentRef.current !== targetSecs) {
      animatingRef.current = true;

      const animate = () => {
        const target = targetRef.current;
        const current = currentRef.current;

        // Distance to target
        const diff = target - current;

        // Are we close enough? Snap to target
        if (Math.abs(diff) < TIME_WHEEL_CONFIG.SNAP_THRESHOLD) {
          currentRef.current = target;
          setDisplaySeconds(target);
          setDigitOffsets([0, 0, 0, 0]);
          animatingRef.current = false;
          frameRef.current = null;
          return;
        }

        // Speed based on distance
        const speed = Math.min(TIME_WHEEL_CONFIG.MAX_SPEED, TIME_WHEEL_CONFIG.BASE_SPEED + Math.abs(diff) * TIME_WHEEL_CONFIG.ACCEL_FACTOR);

        // Move toward target
        const step = diff > 0 ? speed : -speed;
        let newCurrent = current + step;

        // Don't overshoot
        newCurrent = diff > 0
          ? Math.min(newCurrent, target)
          : Math.max(newCurrent, target);

        currentRef.current = newCurrent;

        // Extract whole seconds and fractional part
        const wholeSecs = Math.floor(newCurrent);
        const frac = newCurrent - wholeSecs;

        setDisplaySeconds(wholeSecs);

        // Calculate per-digit offsets
        // Time format: MM:SS, digits are [m10, m1, s10, s1]
        const m = Math.floor(wholeSecs / 60);
        const s = wholeSecs % 60;
        const digits = [
          Math.floor(m / 10) % 10,  // m10
          m % 10,                    // m1
          Math.floor(s / 10),        // s10
          s % 10                     // s1
        ];

        // Only the rightmost digit (s1) gets the fractional offset
        // Higher digits only scroll when lower ones are about to wrap
        const offsets = [0, 0, 0, 0];
        let carry = frac;

        // Process right to left
        for (let i = 3; i >= 0; i--) {
          offsets[i] = -carry * DIGIT_HEIGHT;

          // Determine wrap point for this digit
          const wrapAt = (i === 2) ? 5 : 9; // s10 wraps at 5, others at 9

          if (digits[i] === wrapAt && diff > 0) {
            // This digit will wrap, propagate carry
          } else {
            carry = 0;
          }
        }

        setDigitOffsets(offsets);

        frameRef.current = requestAnimationFrame(animate);
      };

      frameRef.current = requestAnimationFrame(animate);
    }
  }, [seconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  // Extract current digits for display
  const m = Math.floor(displaySeconds / 60);
  const s = displaySeconds % 60;
  const digits = [
    Math.floor(m / 10) % 10,  // m10
    m % 10,                    // m1
    Math.floor(s / 10),        // s10
    s % 10                     // s1
  ];

  // Prev/next digits for each position
  const getPrevNext = (digit: number, max: number) => ({
    prev: (digit - 1 + max + 1) % (max + 1),
    next: (digit + 1) % (max + 1)
  });

  return (
    <span className={`odometer ${className}`}>
      {/* Minutes tens (0-9) */}
      <span className="odometer-wheel">
        <span className="odometer-wheel-inner" style={{ transform: `translateY(${digitOffsets[0]}em)` }}>
          <span className="odometer-digit">{getPrevNext(digits[0], 9).prev}</span>
          <span className="odometer-digit">{digits[0]}</span>
          <span className="odometer-digit">{getPrevNext(digits[0], 9).next}</span>
        </span>
      </span>
      {/* Minutes ones (0-9) */}
      <span className="odometer-wheel">
        <span className="odometer-wheel-inner" style={{ transform: `translateY(${digitOffsets[1]}em)` }}>
          <span className="odometer-digit">{getPrevNext(digits[1], 9).prev}</span>
          <span className="odometer-digit">{digits[1]}</span>
          <span className="odometer-digit">{getPrevNext(digits[1], 9).next}</span>
        </span>
      </span>
      <span className="odometer-colon">:</span>
      {/* Seconds tens (0-5) */}
      <span className="odometer-wheel">
        <span className="odometer-wheel-inner" style={{ transform: `translateY(${digitOffsets[2]}em)` }}>
          <span className="odometer-digit">{getPrevNext(digits[2], 5).prev}</span>
          <span className="odometer-digit">{digits[2]}</span>
          <span className="odometer-digit">{getPrevNext(digits[2], 5).next}</span>
        </span>
      </span>
      {/* Seconds ones (0-9) */}
      <span className="odometer-wheel">
        <span className="odometer-wheel-inner" style={{ transform: `translateY(${digitOffsets[3]}em)` }}>
          <span className="odometer-digit">{getPrevNext(digits[3], 9).prev}</span>
          <span className="odometer-digit">{digits[3]}</span>
          <span className="odometer-digit">{getPrevNext(digits[3], 9).next}</span>
        </span>
      </span>
    </span>
  );
}

// Placeholder time display (??:??)
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
