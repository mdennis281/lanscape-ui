// ============================================================================
// GENEVA MECHANISM — Pure math for realistic odometer digit positioning
// ============================================================================
//
// Named after the Geneva drive mechanism used in real mechanical odometers,
// this module computes continuous display positions for counter wheels.
//
// Architecture (designed with future npm-package extraction in mind):
//   - WheelSpec: describes one wheel's base and place value
//   - wheelPosition(): pure function → continuous position for one wheel
//   - computePositions(): maps a value across an array of WheelSpecs
//   - Preset builders: decimalSpecs(), timeSpecs()
//   - Animation configs: separate from the math
//
// The Geneva mechanism works as follows:
//   - The lowest-order wheel (ones) scrolls continuously with the value.
//   - Higher-order wheels sit at integer positions and only roll through a
//     transition zone near the carry boundary — just like a real mechanical
//     odometer's gear coupling.
//   - Transition zone spans [1−engage, 1.0) ∪ [0, engage) of the sub-rotation,
//     meaning "starts when the right-hand digit reaches ~8, finishes when ~2"
//     (for engage = 0.2 with base 10).
//
// ============================================================================

// ── Types ───────────────────────────────────────────────────────────

/** Describes one wheel in a counter: its numeric base and place value. */
export interface WheelSpec {
  /** Number of positions on this wheel (10 for decimal, 6 for sec-tens, 16 for hex) */
  base: number;
  /** Positional value: 1 for ones, 10 for tens, 60 for minutes, etc. */
  placeValue: number;
}

/** Animation timing configuration (used by orchestrator components, not the math). */
export interface AnimationConfig {
  baseDuration: number;
  maxDuration: number;
  durationScale: number;
  easing: (t: number) => number;
}

// ── Constants ───────────────────────────────────────────────────────

/**
 * DIGIT_HEIGHT: Height of each digit in em units.
 * Controls the scroll distance per digit position.
 * Must match the CSS `.odometer-digit` height.
 */
export const DIGIT_HEIGHT = 1.2;

/**
 * DEFAULT_ENGAGE: Number of positions before a carry where the next digit starts rolling.
 * 3 means when lowest digit is at 7, 8, or 9, the next digit starts its bias.
 */
export const DEFAULT_ENGAGE = 3;

// ── Animation presets ───────────────────────────────────────────────

/** Animation config for number counters (IP counts, port counts, etc.) */
export const NUMBER_ANIMATION: AnimationConfig = {
  baseDuration: 200,
  maxDuration: 800,
  durationScale: 120,
  easing: (t) => 1 - Math.pow(1 - t, 3), // ease-out cubic
};

/** Animation config for time display (MM:SS) — slightly slower, larger range */
export const TIME_ANIMATION: AnimationConfig = {
  baseDuration: 300,
  maxDuration: 1500,
  durationScale: 200,
  easing: (t) => 1 - Math.pow(1 - t, 3),
};

// ── Pure math ───────────────────────────────────────────────────────

/** Hermite smoothstep: smooth ease-in-out on [0, 1] */
export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Compute the animation duration for a given value change.
 * Scales logarithmically so large jumps don't take forever.
 */
export function animationDuration(diff: number, config: AnimationConfig): number {
  return Math.min(
    config.maxDuration,
    config.baseDuration + Math.log1p(Math.abs(diff)) * config.durationScale
  );
}

/**
 * Compute the continuous display position of a single wheel.
 *
 * Cascading bias: each digit starts rolling when the combined value of all
 * lower digits is within `engage` steps of causing a carry.
 *
 * @param V           - Current (possibly fractional) counter value
 * @param placeValue  - This wheel's place value (1, 10, 100, 60, 600…)
 * @param base        - Number of positions on this wheel (10, 6, 16…)
 * @param continuous  - If true, wheel scrolls continuously (for the lowest-order digit)
 * @param engage      - Number of steps before carry where bias starts (default 3)
 * @returns           - Continuous position in [0, base), possibly with fractional part
 *
 * Examples with base=10, engage=3:
 *   wheelPosition(96, 100, 10, false)  → 0.0   (hundreds settled)
 *   wheelPosition(97, 100, 10, false)  → 0.25  (hundreds starting)
 *   wheelPosition(98, 100, 10, false)  → 0.5   (hundreds mid-roll)
 *   wheelPosition(99, 100, 10, false)  → 0.75  (hundreds almost there)
 *   wheelPosition(100, 100, 10, false) → 1.0   (hundreds settled at 1)
 *   wheelPosition(105, 100, 10, false) → 1.0   (hundreds settled at 1)
 */
export function wheelPosition(
  V: number,
  placeValue: number,
  base: number,
  continuous: boolean,
  engage: number = DEFAULT_ENGAGE,
): number {
  if (continuous) {
    // Lowest-order wheel: fully continuous — always scrolling
    const exactPos = V / placeValue;
    return ((exactPos % base) + base) % base;
  }

  // Integer digit at this place value
  const digit = Math.floor(V / placeValue) % base;

  // Value of all digits below this place (0 to placeValue-1)
  const subValue = V % placeValue;

  // How far through the engage zone are we? (0 = just entered, 1 = about to carry)
  // engageStart is where bias begins, placeValue is where carry happens
  const engageStart = placeValue - engage;
  
  if (subValue >= engageStart) {
    // In the engage zone: linear bias from 0 to 1
    const bias = (subValue - engageStart) / engage;
    return digit + bias;
  }

  // Otherwise, digit is settled at its integer position
  return digit;
}

/**
 * Compute settled (integer) display positions — used for final snap after animation.
 * Bypasses Geneva mechanism to ensure clean digit display at rest.
 */
export function settledPositions(V: number, specs: WheelSpec[]): number[] {
  return specs.map(({ placeValue, base }) =>
    Math.floor(V / placeValue) % base
  );
}

/**
 * Compute continuous display positions for every wheel, using the Geneva mechanism.
 * The last wheel in the array is treated as continuous (lowest-order digit).
 *
 * @param V       - Current (possibly fractional) counter value
 * @param specs   - Array of WheelSpecs, left-to-right (most significant first)
 * @param engage  - Geneva engage fraction (default 0.2)
 */
export function computePositions(
  V: number,
  specs: WheelSpec[],
  engage: number = DEFAULT_ENGAGE,
): number[] {
  const lastIdx = specs.length - 1;
  return specs.map((spec, i) =>
    wheelPosition(V, spec.placeValue, spec.base, i === lastIdx, engage)
  );
}

// ── Spec builders ───────────────────────────────────────────────────

/** Build wheel specs for an N-digit decimal counter (e.g. 3 → [100, 10, 1]) */
export function decimalSpecs(numDigits: number): WheelSpec[] {
  const specs: WheelSpec[] = [];
  for (let i = 0; i < numDigits; i++) {
    specs.push({ base: 10, placeValue: Math.pow(10, numDigits - 1 - i) });
  }
  return specs;
}

/**
 * Build wheel specs for MM:SS time display.
 * Digit order: [m10, m1, s10, s1]
 * Bases:       [ 10, 10,   6, 10]
 * Place values: [600, 60,  10,  1]
 */
export function timeSpecs(): WheelSpec[] {
  return [
    { base: 10, placeValue: 600 },  // minutes tens
    { base: 10, placeValue: 60 },   // minutes ones
    { base: 6,  placeValue: 10 },   // seconds tens
    { base: 10, placeValue: 1 },    // seconds ones
  ];
}

// ── Debug helpers ───────────────────────────────────────────────────

/** Format a position array as a readable string: "[2.00, 5.00, 4.00]" */
export function formatPositions(positions: number[]): string {
  return '[' + positions.map(p => p.toFixed(2)).join(', ') + ']';
}

/**
 * Run a suite of position checks and return results.
 * Useful for the debug component to display a live verification table.
 */
export function runPositionTests(engage: number = DEFAULT_ENGAGE): Array<{
  label: string;
  value: number;
  specs: WheelSpec[];
  positions: number[];
  settled: number[];
}> {
  const d3 = decimalSpecs(3);
  const ts = timeSpecs();

  const cases: Array<{ label: string; value: number; specs: WheelSpec[] }> = [
    // Decimal — settled values
    { label: '000',          value: 0,     specs: d3 },
    { label: '042',          value: 42,    specs: d3 },
    { label: '254',          value: 254,   specs: d3 },
    { label: '999',          value: 999,   specs: d3 },
    // Decimal — carry boundaries
    { label: '098 (pre-carry)', value: 98,  specs: d3 },
    { label: '099 (boundary)',  value: 99,  specs: d3 },
    { label: '100 (post-carry)', value: 100, specs: d3 },
    { label: '102 (settled)',   value: 102, specs: d3 },
    // Decimal — mid-transition
    { label: '258 (tens starts)',  value: 258,  specs: d3 },
    { label: '259 (tens mid)',     value: 259,  specs: d3 },
    { label: '260 (tens settling)',value: 260,  specs: d3 },
    { label: '262 (tens settled)', value: 262,  specs: d3 },
    // Decimal — hundreds transition
    { label: '580 (100s starts)',  value: 580,  specs: d3 },
    { label: '590 (100s early)',   value: 590,  specs: d3 },
    { label: '600 (100s mid)',     value: 600,  specs: d3 },
    { label: '620 (100s settled)', value: 620,  specs: d3 },
    // Time — boundaries
    { label: '00:00',        value: 0,     specs: ts },
    { label: '00:58 (s10 starts)', value: 58, specs: ts },
    { label: '00:59 (s10 mid)',    value: 59, specs: ts },
    { label: '01:00 (m1 post)',    value: 60, specs: ts },
    { label: '01:02 (m1 settled)', value: 62, specs: ts },
    { label: '09:58 (m10 starts)', value: 598, specs: ts },
    { label: '10:00 (m10 post)',   value: 600, specs: ts },
    { label: '10:02 (m10 settled)',value: 602, specs: ts },
  ];

  return cases.map(c => ({
    ...c,
    positions: computePositions(c.value, c.specs, engage),
    settled: settledPositions(c.value, c.specs),
  }));
}
