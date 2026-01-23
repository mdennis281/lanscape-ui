import { useState } from 'react';
import { Odometer } from './Odometer';

export function OdometerDebug() {
  const [value, setValue] = useState(0);
  const [digits, setDigits] = useState(3);

  return (
    <div style={{ 
      padding: '2rem', 
      background: '#1a1a2e', 
      minHeight: '100vh',
      color: '#fff',
      fontFamily: 'monospace'
    }}>
      <h1>Odometer Debug</h1>
      
      <div style={{ 
        fontSize: '3rem', 
        margin: '2rem 0',
        padding: '1rem',
        background: '#0f0f1a',
        borderRadius: '8px',
        display: 'inline-block'
      }}>
        <Odometer value={value} digits={digits} />
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Value: {value}
        </label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Math.max(0, parseInt(e.target.value) || 0))}
          style={{
            fontSize: '1.5rem',
            padding: '0.5rem 1rem',
            width: '200px',
            background: '#2a2a4a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#fff'
          }}
        />
        
        <input
          type="range"
          min="0"
          max="999"
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value))}
          style={{ 
            width: '300px', 
            marginLeft: '1rem',
            verticalAlign: 'middle'
          }}
        />
      </div>
      
      <div style={{ marginTop: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Digits: {digits}
        </label>
        <input
          type="range"
          min="1"
          max="6"
          value={digits}
          onChange={(e) => setDigits(parseInt(e.target.value))}
          style={{ width: '200px' }}
        />
      </div>
      
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setValue(0)} style={buttonStyle}>0</button>
        <button onClick={() => setValue(9)} style={buttonStyle}>9</button>
        <button onClick={() => setValue(10)} style={buttonStyle}>10</button>
        <button onClick={() => setValue(99)} style={buttonStyle}>99</button>
        <button onClick={() => setValue(100)} style={buttonStyle}>100</button>
        <button onClick={() => setValue(199)} style={buttonStyle}>199</button>
        <button onClick={() => setValue(254)} style={buttonStyle}>254</button>
        <button onClick={() => setValue(999)} style={buttonStyle}>999</button>
      </div>
      
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
        <button onClick={() => setValue(v => Math.max(0, v - 1))} style={buttonStyle}>-1</button>
        <button onClick={() => setValue(v => v + 1)} style={buttonStyle}>+1</button>
        <button onClick={() => setValue(v => Math.max(0, v - 10))} style={buttonStyle}>-10</button>
        <button onClick={() => setValue(v => v + 10)} style={buttonStyle}>+10</button>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '1rem',
  background: '#3a3a6a',
  border: 'none',
  borderRadius: '4px',
  color: '#fff',
  cursor: 'pointer'
};
