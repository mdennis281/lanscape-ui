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

/**
 * DEFAULT_INTENSITY: Multiplier for how far the next digit rolls during the engage phase.
 * 1 means with engage=2 and base=10, the next digit rolls a full position 
 * (e.g. from 4.00 to 5.00) as the lower digit goes from 8 to 0.
 */
export const DEFAULT_INTENSITY = .25;

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
 * Calculates the rotational position of a single wheel in a Geneva-drive–style
 * odometer mechanism.
 *
 * @param V - The current numeric value driving the entire counter.
 * @param placeValue - The place value this wheel represents (e.g. 1, 10, 100).
 * @param base - The numeric base / number of positions per wheel (e.g. 10 for decimal).
 * @param continuous - If `true`, the wheel scrolls smoothly and linearly (used for the
 *   lowest-order digit). If `false`, the wheel snaps between digits and only
 *   animates during the engage zone near a carry.
 * @param engage - The size of the engage zone (in sub-value units) before a carry occurs.
 *   Within this zone the wheel begins transitioning toward the next digit.
 *   Defaults to {@link DEFAULT_ENGAGE}.
 * @param intensity_base - Controls how much of the full transition the wheel completes
 *   during the engage zone under normal conditions. A value of `1` means the wheel
 *   travels the entire distance to the next digit; values less than `1` produce a
 *   subtler partial rotation. As the wheel approaches a full-base rollover
 *   (e.g. 9 → 0 in base 10), intensity is dynamically ramped up toward `1` so the
 *   final "flop" always completes cleanly regardless of the base intensity.
 *   Defaults to {@link DEFAULT_INTENSITY}.
 * @returns The fractional wheel position in the range `[0, base)`, where integer
 *   values represent fully settled digit positions.
 */
export function wheelPosition(
  V: number,
  placeValue: number,
  base: number,
  continuous: boolean,
  engage: number = DEFAULT_ENGAGE,
  intensity_base: number = DEFAULT_INTENSITY,
): number {
  if (continuous) {
    // Lowest-order wheel: fully continuous — always scrolling
    const exactPos = V / placeValue;
    return ((exactPos % base) + base) % base;
  }

  let intensity = intensity_base;

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
    
    // Clean yet dramatic flop between 9 and 10 (placeValue==10)
    const leftTillFlop = placeValue - ( subValue % placeValue );
    if (leftTillFlop < 1) {
      intensity = Math.min(1, intensity_base + (1-leftTillFlop))
    }

    return digit + ( bias * intensity );
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
  intensity: number = DEFAULT_INTENSITY,
): number[] {
  const lastIdx = specs.length - 1;
  return specs.map((spec, i) =>
    wheelPosition(V, spec.placeValue, spec.base, i === lastIdx, engage, intensity)
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

/**
 * Build wheel specs for an N-digit hexadecimal counter.
 * Each wheel has base 16, place values are powers of 16.
 * e.g. 3 → [256, 16, 1] for values 0x000–0xFFF
 */
export function hexSpecs(numDigits: number): WheelSpec[] {
  const specs: WheelSpec[] = [];
  for (let i = 0; i < numDigits; i++) {
    specs.push({ base: 16, placeValue: Math.pow(16, numDigits - 1 - i) });
  }
  return specs;
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
