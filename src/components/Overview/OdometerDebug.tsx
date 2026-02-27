import { useState, type CSSProperties, type FormEvent } from 'react';
import { Odometer, OdometerTime } from './Odometer';

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

// ── Main debug component ────────────────────────────────────────────

export function OdometerDebug() {
  // Number odometer state
  const [numValue, setNumValue] = useState(0);
  const [numDigits, setNumDigits] = useState(3);

  // Time odometer state
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [timeResetKey, setTimeResetKey] = useState(0);

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
      </Section>

      {/* ─── Time Odometer ───────────────────────────── */}
      <Section title="Time Odometer (MM:SS)">
        <div style={displayStyle}>
          <OdometerTime seconds={timeSeconds} resetKey={timeResetKey} />
        </div>

        <div style={controlsStyle}>
          <ApplyInput label="Seconds" value={timeSeconds} onChange={setTimeSeconds} max={5999} />
        </div>

        <Presets
          presets={[
            { label: '0s', value: 0 },
            { label: '5s', value: 5 },
            { label: '30s', value: 30 },
            { label: '59s', value: 59 },
            { label: '60s', value: 60 },
            { label: '90s', value: 90 },
            { label: '300s', value: 300 },
            { label: '500s', value: 500 },
            { label: '599s', value: 599 },
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
