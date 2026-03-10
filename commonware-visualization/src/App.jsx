import { useState, useEffect, useRef } from 'react';
import './App.css';
import BridgeVisualization from './components/BridgeVisualization';
import ChatVisualization from './components/ChatVisualization';
import SyncVisualization from './components/SyncVisualization';
import AltoVisualization from './components/AltoVisualization';
import FloodVisualization from './components/FloodVisualization';

const EXAMPLES = [
  { id: 'alto', label: 'alto' },
  { id: 'bridge', label: 'bridge' },
  { id: 'chat', label: 'chat' },
  { id: 'flood', label: 'flood' },
  { id: 'sync', label: 'sync' },
];

// Animated ASCII logo matching commonware.xyz
function Logo() {
  const topRow = useAnimatedSymbols(
    ['+', '~', ' ', '-', '+', '-', '+', ' ', '-', '+', '-', '~', '~', '*'],
    ['edge', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'edge']
  );
  const midRow = useAnimatedSymbols(
    ['|', null, ' '],
    ['v', null, 'v']
  );
  const botRow = useAnimatedSymbols(
    ['*', '~', '+', '+', '-', ' ', '~', '-', '+', ' ', '-', '*', '-', '+'],
    ['edge', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'edge']
  );

  return (
    <div>
      <div className="logo-line">{topRow}</div>
      <div className="logo-line">
        {midRow[0]}
        <span> commonware </span>
        {midRow[2]}
      </div>
      <div className="logo-line">{botRow}</div>
    </div>
  );
}

function useAnimatedSymbols(initial, types) {
  const horizontalSymbols = [' ', '*', '+', '-', '~'];
  const verticalSymbols = [' ', '*', '+', '|'];
  const edgeSymbols = [' ', '*', '+'];

  const [symbols, setSymbols] = useState(initial);
  const timeouts = useRef([]);

  useEffect(() => {
    function pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function schedule(idx, type) {
      const delay = Math.random() * 9500 + 500;
      const t = setTimeout(() => {
        setSymbols((prev) => {
          const next = [...prev];
          if (type === 'h') next[idx] = pick(horizontalSymbols);
          else if (type === 'v') next[idx] = pick(verticalSymbols);
          else if (type === 'edge') next[idx] = pick(edgeSymbols);
          return next;
        });
        schedule(idx, type);
      }, delay);
      timeouts.current.push(t);
    }

    types.forEach((type, idx) => {
      if (type) schedule(idx, type);
    });

    return () => timeouts.current.forEach(clearTimeout);
  }, []);

  return symbols.map((s, i) =>
    s === null ? null : <span key={i}>{s}</span>
  );
}

function App() {
  const [activeExample, setActiveExample] = useState(() => {
    const saved = localStorage.getItem('commonware-viz-example');
    return EXAMPLES.some((ex) => ex.id === saved) ? saved : 'alto';
  });

  useEffect(() => {
    localStorage.setItem('commonware-viz-example', activeExample);
  }, [activeExample]);

  return (
    <div>
      <Logo />
      <nav className="example-tabs">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            className={`example-tab ${activeExample === ex.id ? 'example-tab--active' : ''}`}
            onClick={() => setActiveExample(ex.id)}
          >
            {ex.label}
          </button>
        ))}
      </nav>
      {activeExample === 'bridge' && <BridgeVisualization />}
      {activeExample === 'chat' && <ChatVisualization />}
      {activeExample === 'sync' && <SyncVisualization />}
      {activeExample === 'alto' && <AltoVisualization />}
      {activeExample === 'flood' && <FloodVisualization />}
    </div>
  );
}

export default App;
