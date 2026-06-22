import { useState, useEffect, useRef } from 'react';
import './App.css';
import BridgeVisualization from './components/BridgeVisualization';
import ChatVisualization from './components/ChatVisualization';
import ConstantinopleVisualization from './components/ConstantinopleVisualization';
import SyncVisualization from './components/SyncVisualization';
import AltoVisualization from './components/AltoVisualization';
import FloodVisualization from './components/FloodVisualization';
import LogVisualization from './components/LogVisualization';
import MinimmitVisualization from './components/MinimmitVisualization';

const EXAMPLES = [
  { id: 'alto', label: 'alto' },
  { id: 'bridge', label: 'bridge' },
  { id: 'chat', label: 'chat' },
  { id: 'constantinople', label: 'constantinople' },
  { id: 'flood', label: 'flood' },
  { id: 'log', label: 'log' },
  { id: 'minimmit', label: 'minimmit' },
  { id: 'sync', label: 'sync' },
];

const DEFAULT_EXAMPLE_ID = 'alto';
const EXAMPLE_IDS = new Set(EXAMPLES.map((example) => example.id));

function getExamplePath(exampleId) {
  return `/${exampleId}`;
}

function getExampleFromPath(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/') {
    return null;
  }

  const exampleId = normalizedPath.slice(1);
  return EXAMPLE_IDS.has(exampleId) ? exampleId : null;
}

function replaceActivePath(exampleId) {
  const nextPath = getExamplePath(exampleId);

  if (window.location.pathname !== nextPath) {
    window.history.replaceState({}, '', nextPath);
  }
}

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
    return getExampleFromPath(window.location.pathname) ?? DEFAULT_EXAMPLE_ID;
  });
  const [exampleRenderKey, setExampleRenderKey] = useState(0);

  useEffect(() => {
    if (getExampleFromPath(window.location.pathname) === null) {
      replaceActivePath(DEFAULT_EXAMPLE_ID);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextExample = getExampleFromPath(window.location.pathname);

      if (nextExample === null) {
        replaceActivePath(DEFAULT_EXAMPLE_ID);
        setActiveExample(DEFAULT_EXAMPLE_ID);
        setExampleRenderKey((current) => current + 1);
        return;
      }

      setActiveExample(nextExample);
      setExampleRenderKey((current) => current + 1);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openExample = (exampleId) => {
    const nextPath = getExamplePath(exampleId);

    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }

    setActiveExample(exampleId);
    setExampleRenderKey((current) => current + 1);
  };

  const activeVisualizationKey = `${activeExample}-${exampleRenderKey}`;

  return (
    <div>
      <Logo />
      <nav className="example-tabs">
        {EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex.id}
            className={`example-tab ${activeExample === ex.id ? 'example-tab--active' : ''}`}
            aria-current={activeExample === ex.id ? 'page' : undefined}
            onClick={() => openExample(ex.id)}
          >
            {ex.label}
          </button>
        ))}
      </nav>
      {activeExample === 'bridge' && <BridgeVisualization key={activeVisualizationKey} />}
      {activeExample === 'chat' && <ChatVisualization key={activeVisualizationKey} />}
      {activeExample === 'constantinople' && <ConstantinopleVisualization key={activeVisualizationKey} />}
      {activeExample === 'sync' && <SyncVisualization key={activeVisualizationKey} />}
      {activeExample === 'alto' && <AltoVisualization key={activeVisualizationKey} />}
      {activeExample === 'flood' && <FloodVisualization key={activeVisualizationKey} />}
      {activeExample === 'log' && <LogVisualization key={activeVisualizationKey} />}
      {activeExample === 'minimmit' && <MinimmitVisualization key={activeVisualizationKey} />}
    </div>
  );
}

export default App;
