import { useState, type CSSProperties, type FormEvent } from 'react';
import { Odometer, OdometerTime } from './Odometer';
import {
  decimalSpecs,
  timeSpecs,
  computePositions,
  formatPositions,
  runPositionTests,
  DEFAULT_ENGAGE,
} from './counter';

// ── Reusable "type a number, hit Apply" input ───────────────────────

interface ApplyInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  width?: string;
}

function ApplyInput({ label, value, onChange, min = 0, max, width = '120px' }: ApplyInputProps) {
  const [draft, setDraft] = useState(String(value));

  // Keep draft in sync when the *applied* value changes externally (presets, etc.)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  const apply = (e?: FormEvent) => {
    e?.preventDefault();
    const n = Math.max(min, Math.min(max ?? Infinity, parseInt(draft) || 0));
    onChange(n);
    setDraft(String(n));
  };

  return (
    <form onSubmit={apply} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label style={{ color: '#888', fontSize: '0.85rem', minWidth: '70px' }}>{label}</label>
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        style={{ ...inputStyle, width }}
      />
      <button type="submit" style={applyBtnStyle}>Apply</button>
    </form>
  );
}

// ── Presets row ─────────────────────────────────────────────────────

interface PresetProps {
  presets: { label: string; value: number }[];
  onSelect: (v: number) => void;
}

function Presets({ presets, onSelect }: PresetProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {presets.map((p) => (
        <button key={p.label} onClick={() => onSelect(p.value)} style={buttonStyle}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Position readout display ────────────────────────────────────────

interface PositionReadoutProps {
  value: number;
  specs: ReturnType<typeof decimalSpecs>;
  label: string;
}

function PositionReadout({ value, specs, label }: PositionReadoutProps) {
  const positions = computePositions(value, specs);
  return (
    <div style={readoutStyle}>
      <span style={{ color: '#888', minWidth: '80px' }}>{label}:</span>
      <span style={{ color: '#6f6', fontFamily: 'monospace' }}>
        {formatPositions(positions)}
      </span>
    </div>
  );
}

// ── Main debug component ────────────────────────────────────────────

export function OdometerDebug() {
  // Number odometer state
  const [numValue, setNumValue] = useState(0);
  const [numDigits, setNumDigits] = useState(3);
  const [showTests, setShowTests] = useState(false);

  // Time odometer state
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [timeResetKey, setTimeResetKey] = useState(0);

  // Custom test value for position readout
  const [testValue, setTestValue] = useState(258);

  const decSpecs = decimalSpecs(numDigits);
  const tSpecs = timeSpecs();

  return (
    <div style={containerStyle}>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', color: '#ccc' }}>
        Odometer Debug
        <span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '12px' }}>
          ?debug=odometer
        </span>
      </h1>

      {/* ─── Number Odometer ─────────────────────────── */}
      <Section title="Number Odometer">
        <div style={displayStyle}>
          <Odometer value={numValue} digits={numDigits} />
        </div>

        <PositionReadout value={numValue} specs={decSpecs} label="Positions" />

        <div style={controlsStyle}>
          <ApplyInput label="Value" value={numValue} onChange={setNumValue} max={999999} />
          <ApplyInput label="Digits" value={numDigits} onChange={setNumDigits} min={1} max={6} width="60px" />
        </div>

        <Presets
          presets={[
            { label: '0', value: 0 },
            { label: '9', value: 9 },
            { label: '42', value: 42 },
            { label: '99', value: 99 },
            { label: '100', value: 100 },
            { label: '254', value: 254 },
            { label: '500', value: 500 },
            { label: '999', value: 999 },
          ]}
          onSelect={setNumValue}
        />

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={() => setNumValue((v) => Math.max(0, v - 1))} style={buttonStyle}>−1</button>
          <button onClick={() => setNumValue((v) => v + 1)} style={buttonStyle}>+1</button>
          <button onClick={() => setNumValue((v) => Math.max(0, v - 10))} style={buttonStyle}>−10</button>
          <button onClick={() => setNumValue((v) => v + 10)} style={buttonStyle}>+10</button>
          <button onClick={() => setNumValue((v) => Math.max(0, v - 100))} style={buttonStyle}>−100</button>
          <button onClick={() => setNumValue((v) => v + 100)} style={buttonStyle}>+100</button>
        </div>

        <div style={{ marginTop: '12px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#888' }}>Carry boundary presets:</h3>
          <Presets
            presets={[
              { label: '258 (tens starts)', value: 258 },
              { label: '259 (tens mid)', value: 259 },
              { label: '260 (tens settling)', value: 260 },
              { label: '262 (tens settled)', value: 262 },
            ]}
            onSelect={setNumValue}
          />
        </div>
      </Section>

      {/* ─── Time Odometer ───────────────────────────── */}
      <Section title="Time Odometer (MM:SS)">
        <div style={displayStyle}>
          <OdometerTime seconds={timeSeconds} resetKey={timeResetKey} />
        </div>

        <PositionReadout value={timeSeconds} specs={tSpecs} label="Positions" />

        <div style={controlsStyle}>
          <ApplyInput label="Seconds" value={timeSeconds} onChange={setTimeSeconds} max={5999} />
        </div>

        <Presets
          presets={[
            { label: '0s', value: 0 },
            { label: '5s', value: 5 },
            { label: '30s', value: 30 },
            { label: '58s', value: 58 },
            { label: '59s', value: 59 },
            { label: '60s', value: 60 },
            { label: '62s', value: 62 },
            { label: '598s', value: 598 },
            { label: '600s', value: 600 },
          ]}
          onSelect={setTimeSeconds}
        />

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setTimeSeconds((v) => Math.max(0, v - 1))} style={buttonStyle}>−1s</button>
          <button onClick={() => setTimeSeconds((v) => v + 1)} style={buttonStyle}>+1s</button>
          <button onClick={() => setTimeSeconds((v) => Math.max(0, v - 10))} style={buttonStyle}>−10s</button>
          <button onClick={() => setTimeSeconds((v) => v + 10)} style={buttonStyle}>+10s</button>
          <button onClick={() => setTimeSeconds((v) => Math.max(0, v - 60))} style={buttonStyle}>−60s</button>
          <button onClick={() => setTimeSeconds((v) => v + 60)} style={buttonStyle}>+60s</button>
          <button
            onClick={() => { setTimeResetKey((k) => k + 1); setTimeSeconds(0); }}
            style={{ ...buttonStyle, background: '#6a3a3a' }}
          >
            Reset (instant)
          </button>
        </div>

        <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '12px' }}>
          Try jumping 60→500 to test speed scaling on large diffs.
        </p>
      </Section>

      {/* ─── Position Calculator ───────────────────────── */}
      <Section title="Position Calculator">
        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '12px' }}>
          Compute Geneva mechanism positions for any value (no animation).
        </p>

        <ApplyInput label="Value" value={testValue} onChange={setTestValue} max={999999} />

        <div style={{ marginTop: '12px' }}>
          <PositionReadout value={testValue} specs={decimalSpecs(3)} label="3-digit" />
          <PositionReadout value={testValue} specs={timeSpecs()} label="MM:SS" />
        </div>

        <p style={{ color: '#555', fontSize: '0.75rem', marginTop: '8px' }}>
          engage={DEFAULT_ENGAGE} → transition zone at {(1 - DEFAULT_ENGAGE) * 10}→0→{DEFAULT_ENGAGE * 10}
        </p>
      </Section>

      {/* ─── Test Suite ───────────────────────────────── */}
      <Section title="Position Test Suite">
        <button
          onClick={() => setShowTests(!showTests)}
          style={{ ...buttonStyle, marginBottom: '12px' }}
        >
          {showTests ? 'Hide Tests' : 'Show Tests'}
        </button>

        {showTests && (
          <div style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <th style={thStyle}>Label</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Positions</th>
                  <th style={thStyle}>Settled</th>
                </tr>
              </thead>
              <tbody>
                {runPositionTests().map((test, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                    <td style={tdStyle}>{test.label}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{test.value}</td>
                    <td style={{ ...tdStyle, color: '#6f6' }}>{formatPositions(test.positions)}</td>
                    <td style={{ ...tdStyle, color: '#ff6' }}>{formatPositions(test.settled)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Layout helper ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sectionStyle}>
      <h2 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#aaa' }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  padding: '2rem',
  background: '#1a1a2e',
  minHeight: '100vh',
  color: '#fff',
  fontFamily: 'monospace',
  maxWidth: '700px',
};

const sectionStyle: CSSProperties = {
  background: '#0f0f1a',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '24px',
};

const displayStyle: CSSProperties = {
  fontSize: '3rem',
  margin: '0 0 16px',
  padding: '12px 16px',
  background: '#16162a',
  borderRadius: '6px',
  display: 'inline-block',
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginBottom: '12px',
};

const inputStyle: CSSProperties = {
  fontSize: '1rem',
  padding: '6px 10px',
  background: '#2a2a4a',
  border: '1px solid #444',
  borderRadius: '4px',
  color: '#fff',
};

const buttonStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: '0.9rem',
  background: '#3a3a6a',
  border: 'none',
  borderRadius: '4px',
  color: '#fff',
  cursor: 'pointer',
};

const applyBtnStyle: CSSProperties = {
  ...buttonStyle,
  background: '#2a6a4a',
  fontWeight: 600,
};

const readoutStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '8px',
  fontSize: '0.85rem',
  fontFamily: 'monospace',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px',
  color: '#888',
};

const tdStyle: CSSProperties = {
  padding: '4px 8px',
  color: '#ccc',
};
