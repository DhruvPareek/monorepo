# Sync Visualizer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sync example visualizer with tab-based navigation to switch between bridge and sync views.

**Architecture:** Tab bar in App.jsx swaps between BridgeVisualization and SyncVisualization. Sync visualizer reuses shared infrastructure (Legend, Tooltip, ConnectionPipeline) with its own data files, node components, and animation hook. Layout is left-right: Server on left, Client on right, connected by codec/stream pipeline.

**Tech Stack:** React 19, SVG, Vite 8

---

### Task 1: Create sync data files

**Files:**
- Create: `src/data/sync/modules.js`
- Create: `src/data/sync/layout.js`
- Create: `src/data/sync/pipelines.js`

**Step 1: Create `src/data/sync/modules.js`**

This file defines sync-specific module descriptions. It reuses the same color scheme from the bridge modules but has different short/detail text. Only 5 modules are relevant to sync (no p2p, consensus, or parallel).

```js
export const SYNC_MODULES = {
  storage: {
    name: 'storage',
    color: '#795548',
    short: 'QMDB state sync',
    detail:
      'QMDB (Qualified Merkle Database) in any/current/immutable variants. Server holds the evolving database; client rebuilds a verified copy. Merkle proofs ensure every fetched batch is consistent with the server\'s tree.',
  },
  stream: {
    name: 'stream',
    color: '#F57C00',
    short: 'Frame-based TCP',
    detail:
      'Length-prefixed frame encoding/decoding via send_frame/recv_frame. Plain TCP (no encryption). recv_frame must never be cancelled mid-read to avoid corrupting the stream.',
  },
  codec: {
    name: 'codec',
    color: '#455A64',
    short: 'Wire serialization',
    detail:
      'Encodes/decodes all sync protocol messages: GetSyncTarget, GetOperations requests and their responses (Target, operations + Merkle proof, errors).',
  },
  cryptography: {
    name: 'cryptography',
    color: '#C62828',
    short: 'SHA-256 Merkle proofs',  
    detail:
      'SHA-256 hashing for QMDB Merkle tree construction. Proofs verify that fetched operation batches are consistent with the server\'s root. Also used to deterministically generate test operations.',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Async foundation',
    detail:
      'Tokio-based executor: task spawning (recv loops, handlers, sync engine), TCP networking (bind/dial), storage I/O for QMDB partitions, timers for operation intervals and sync sleeps.',
  },
};

export const SYNC_MODULE_LIST = Object.values(SYNC_MODULES);
```

**Step 2: Create `src/data/sync/layout.js`**

Position constants for the sync visualizer. Same 1200x860 viewBox as bridge.

```js
// SVG viewBox dimensions (same as bridge)
export const WIDTH = 1200;
export const HEIGHT = 860;

// Server position - left side
export const SERVER = {
  x: 300,
  y: 400,
  width: 200,
  height: 280,
  label: 'SERVER',
};

// Client position - right side
export const CLIENT = {
  x: 900,
  y: 400,
  width: 200,
  height: 280,
  label: 'CLIENT',
};

// Modules present on the connection between server and client
export const CONNECTION_MODULES = ['stream', 'codec'];
```

**Step 3: Create `src/data/sync/pipelines.js`**

Pipeline stages for the server-client connection and internal modules.

```js
// Server -> Client: sync data over framed TCP
// Codec encodes messages, stream provides framed TCP transport, codec decodes on the other side.
// No encryption on the wire -- cryptography is used internally for Merkle proofs only.
export const SYNC_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'stream', label: 'frames', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Modules that live inside each node type
export const SERVER_INTERNAL = [
  { module: 'storage', label: 'QMDB' },
  { module: 'cryptography', label: 'sha256' },
];

export const CLIENT_INTERNAL = [
  { module: 'storage', label: 'QMDB' },
  { module: 'cryptography', label: 'sha256' },
];
```

**Step 4: Run build to verify no syntax errors**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: SUCCESS (these files aren't imported yet, but validates no stray issues)

**Step 5: Commit**

```bash
git add src/data/sync/
git commit -m "feat: add sync visualizer data files (modules, layout, pipelines)"
```

---

### Task 2: Create sync animation hook

**Files:**
- Create: `src/hooks/useSyncAnimation.js`

**Step 1: Create `src/hooks/useSyncAnimation.js`**

This is modeled after `src/hooks/useAnimation.js` (bridge). The key difference: sync has 6 phases representing the sync lifecycle, and no `activeNetwork` toggling (there's only one server-client pair).

```js
import { useState, useEffect, useCallback, useRef } from 'react';

// Animation phases for the sync lifecycle
const PHASES = [
  { name: 'ADD_OPS', duration: 1000 },
  { name: 'GET_TARGET', duration: 1000 },
  { name: 'FETCH_OPS', duration: 2000 },
  { name: 'VERIFY', duration: 1500 },
  { name: 'APPLY', duration: 1500 },
  { name: 'SYNCED', duration: 1000 },
];

const TOTAL_CYCLE = PHASES.reduce((s, p) => s + p.duration, 0);

export function useSyncAnimation() {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const dt = timestamp - lastRef.current;
    lastRef.current = timestamp;

    setElapsed((prev) => {
      const next = prev + dt;
      if (next >= TOTAL_CYCLE) {
        return next - TOTAL_CYCLE;
      }
      return next;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) {
      lastRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, tick]);

  // Derive current phase and progress within phase
  let acc = 0;
  let phase = PHASES[0];
  let phaseProgress = 0;
  for (const p of PHASES) {
    if (elapsed < acc + p.duration) {
      phase = p;
      phaseProgress = (elapsed - acc) / p.duration;
      break;
    }
    acc += p.duration;
  }

  const toggle = useCallback(() => setPlaying((p) => !p), []);

  return {
    playing,
    toggle,
    phase: phase.name,
    phaseProgress,
    elapsed,
  };
}
```

**Step 2: Run build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/hooks/useSyncAnimation.js
git commit -m "feat: add useSyncAnimation hook with sync lifecycle phases"
```

---

### Task 3: Create ServerNode and ClientNode components

**Files:**
- Create: `src/components/nodes/ServerNode.jsx`
- Create: `src/components/nodes/ClientNode.jsx`

**Step 1: Create `src/components/nodes/ServerNode.jsx`**

Large rounded rectangle showing the server with internal module indicators. Modeled after IndexerNode.jsx but as a rect instead of hexagon. The node shows internal modules (storage/QMDB and cryptography/sha256) as colored rectangles inside.

```js
import { SYNC_MODULES } from '../../data/sync/modules';
import { SERVER_INTERNAL } from '../../data/sync/pipelines';

export default function ServerNode({
  x,
  y,
  width,
  height,
  highlighted,
  dimmed,
  highlightModule,
  phase,
  onMouseEnter,
  onMouseLeave,
}) {
  const opacity = dimmed ? 0.2 : 1;
  const rx = x - width / 2;
  const ry = y - height / 2;

  // Server pulses during ADD_OPS phase
  const isAdding = phase === 'ADD_OPS';

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {/* Pulse ring when adding ops */}
      {isAdding && (
        <rect
          x={rx - 4}
          y={ry - 4}
          width={width + 8}
          height={height + 8}
          rx={8}
          ry={8}
          fill="none"
          stroke="#795548"
          strokeWidth={1.5}
        >
          <animate
            attributeName="opacity"
            values="0.6;0.15;0.6"
            dur="1s"
            repeatCount="indefinite"
          />
        </rect>
      )}
      {/* Main body */}
      <rect
        x={rx}
        y={ry}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill="white"
        stroke={highlighted ? 'black' : '#999'}
        strokeWidth={highlighted ? 1.5 : 1}
      />
      {/* Label */}
      <text
        x={x}
        y={ry + 24}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={12}
        fontFamily="monospace"
        fontWeight={700}
      >
        SERVER
      </text>
      {/* Internal module indicators */}
      {SERVER_INTERNAL.map((item, i) => {
        const mod = SYNC_MODULES[item.module];
        if (!mod) return null;
        const modHighlighted = highlightModule === item.module;
        const modDimmed = highlightModule && highlightModule !== item.module;
        const chipY = y - 20 + i * 50;
        const chipW = 120;
        const chipH = 36;
        return (
          <g key={item.module} opacity={modDimmed ? 0.15 : 1} style={{ transition: 'opacity 0.3s' }}>
            <rect
              x={x - chipW / 2}
              y={chipY - chipH / 2}
              width={chipW}
              height={chipH}
              rx={4}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.7}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1.5 : 0}
            />
            <text
              x={x}
              y={chipY - 4}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={9}
              fontFamily="monospace"
              fontWeight={700}
            >
              {item.label}
            </text>
            <text
              x={x}
              y={chipY + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={7}
              fontFamily="monospace"
              opacity={0.8}
            >
              {mod.short}
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

**Step 2: Create `src/components/nodes/ClientNode.jsx`**

Nearly identical to ServerNode but labeled "CLIENT" and pulses during SYNCED phase instead.

```js
import { SYNC_MODULES } from '../../data/sync/modules';
import { CLIENT_INTERNAL } from '../../data/sync/pipelines';

export default function ClientNode({
  x,
  y,
  width,
  height,
  highlighted,
  dimmed,
  highlightModule,
  phase,
  onMouseEnter,
  onMouseLeave,
}) {
  const opacity = dimmed ? 0.2 : 1;
  const rx = x - width / 2;
  const ry = y - height / 2;

  // Client pulses during SYNCED phase
  const isSynced = phase === 'SYNCED';

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {/* Pulse ring when synced */}
      {isSynced && (
        <rect
          x={rx - 4}
          y={ry - 4}
          width={width + 8}
          height={height + 8}
          rx={8}
          ry={8}
          fill="none"
          stroke="#2E7D32"
          strokeWidth={1.5}
        >
          <animate
            attributeName="opacity"
            values="0.6;0.15;0.6"
            dur="1s"
            repeatCount="indefinite"
          />
        </rect>
      )}
      {/* Main body */}
      <rect
        x={rx}
        y={ry}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill="white"
        stroke={highlighted ? 'black' : '#999'}
        strokeWidth={highlighted ? 1.5 : 1}
      />
      {/* Label */}
      <text
        x={x}
        y={ry + 24}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={12}
        fontFamily="monospace"
        fontWeight={700}
      >
        CLIENT
      </text>
      {/* Internal module indicators */}
      {CLIENT_INTERNAL.map((item, i) => {
        const mod = SYNC_MODULES[item.module];
        if (!mod) return null;
        const modHighlighted = highlightModule === item.module;
        const modDimmed = highlightModule && highlightModule !== item.module;
        const chipY = y - 20 + i * 50;
        const chipW = 120;
        const chipH = 36;
        return (
          <g key={item.module} opacity={modDimmed ? 0.15 : 1} style={{ transition: 'opacity 0.3s' }}>
            <rect
              x={x - chipW / 2}
              y={chipY - chipH / 2}
              width={chipW}
              height={chipH}
              rx={4}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.7}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1.5 : 0}
            />
            <text
              x={x}
              y={chipY - 4}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={9}
              fontFamily="monospace"
              fontWeight={700}
            >
              {item.label}
            </text>
            <text
              x={x}
              y={chipY + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={7}
              fontFamily="monospace"
              opacity={0.8}
            >
              {mod.short}
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

**Step 3: Run build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/components/nodes/ServerNode.jsx src/components/nodes/ClientNode.jsx
git commit -m "feat: add ServerNode and ClientNode components for sync visualizer"
```

---

### Task 4: Parameterize Legend to accept module list as prop

**Files:**
- Modify: `src/components/Legend.jsx`
- Modify: `src/components/BridgeVisualization.jsx` (pass module list to Legend)

**Step 1: Modify Legend.jsx**

Currently Legend imports `MODULE_LIST` directly from `../data/modules`. Change it to accept a `modules` prop so both bridge and sync can pass their own module lists.

In `src/components/Legend.jsx`, change:
- Remove the import of `MODULE_LIST`
- Add `modules` to the props
- Replace all `MODULE_LIST` references with `modules`

The full updated file:

```js
export default function Legend({ modules, activeModule, onSelect }) {
  const activeMod = modules.find((m) => m.name === activeModule);

  return (
    <div className="legend" onClick={(e) => e.stopPropagation()}>
      <div className="legend-items">
        {modules.map((mod) => {
          const isActive = activeModule === mod.name;
          return (
            <div
              key={mod.name}
              className={`legend-item ${isActive ? 'legend-item--active' : ''}`}
              onClick={() => onSelect(isActive ? null : mod.name)}
            >
              <span
                className="legend-swatch"
                style={{ backgroundColor: mod.color }}
              />
              <span className="legend-label">{mod.name}</span>
            </div>
          );
        })}
      </div>
      {activeMod && (
        <div className="legend-detail">
          <span className="legend-detail-title">{activeMod.short}</span>
          {' -- '}
          <span className="legend-detail-body">{activeMod.detail}</span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update BridgeVisualization.jsx to pass modules prop**

In `src/components/BridgeVisualization.jsx`:
- Add import: `import { MODULE_LIST } from '../data/modules';`
- Change the Legend usage from `<Legend activeModule={highlightModule} onSelect={setHighlightModule} />` to `<Legend modules={MODULE_LIST} activeModule={highlightModule} onSelect={setHighlightModule} />`

**Step 3: Run build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: SUCCESS

**Step 4: Verify in browser**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run dev`
Verify: Bridge visualization legend still works exactly as before.

**Step 5: Commit**

```bash
git add src/components/Legend.jsx src/components/BridgeVisualization.jsx
git commit -m "refactor: parameterize Legend to accept modules list as prop"
```

---

### Task 5: Create SyncVisualization component

**Files:**
- Create: `src/components/SyncVisualization.jsx`

**Step 1: Create `src/components/SyncVisualization.jsx`**

This is the main sync visualizer component. It follows the same structure as BridgeVisualization.jsx but with sync-specific layout: two large node rects (server/client), one connection between them, and sync animation phases.

Key differences from BridgeVisualization:
- No network clusters, no P2P mesh, no indexer
- Uses left-right layout with Server and Client nodes
- Single connection between server and client with SYNC_PIPELINE
- Uses useSyncAnimation instead of useAnimation
- Uses SYNC_MODULES/SYNC_MODULE_LIST for legend
- Tooltip content is sync-specific

```js
import { useState, useCallback } from 'react';
import { WIDTH, HEIGHT, SERVER, CLIENT, CONNECTION_MODULES } from '../data/sync/layout';
import { SYNC_MODULE_LIST, SYNC_MODULES } from '../data/sync/modules';
import { SYNC_PIPELINE } from '../data/sync/pipelines';
import { useSyncAnimation } from '../hooks/useSyncAnimation';
import ConnectionPipeline from './connections/ConnectionPipeline';
import ServerNode from './nodes/ServerNode';
import ClientNode from './nodes/ClientNode';
import Legend from './Legend';
import Tooltip from './Tooltip';

export default function SyncVisualization() {
  const { phase, phaseProgress } = useSyncAnimation();

  const [highlightModule, setHighlightModule] = useState(null);
  const [highlightNode, setHighlightNode] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleStageHover = useCallback((stage) => {
    if (stage) {
      setTooltip({ type: 'module', moduleKey: stage.module, pipelineLabel: stage.label });
    } else {
      setTooltip(null);
    }
  }, []);

  // Connection line dimming
  const anyModuleHighlight =
    highlightModule && CONNECTION_MODULES.includes(highlightModule);
  const dimLine =
    (highlightModule && !anyModuleHighlight) ||
    (highlightNode !== null);

  // Particles based on phase
  const showRequest = phase === 'GET_TARGET' || phase === 'FETCH_OPS';
  const showResponse = phase === 'FETCH_OPS';

  return (
    <div className="viz-container" onMouseMove={handleMouseMove} onClick={() => setHighlightModule(null)}>
      <div className="viz-header">
        <h1 className="viz-title">
          <a href="https://github.com/commonwarexyz/monorepo/tree/main/examples/sync" target="_blank" rel="noopener noreferrer">Sync</a>
        </h1>
        <p className="viz-subtitle">
          Synchronize state between a server and client.
        </p>
      </div>

      <Legend modules={SYNC_MODULE_LIST} activeModule={highlightModule} onSelect={setHighlightModule} />

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="viz-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Defs for gradients */}
        <defs>
          <linearGradient id="syncRuntimeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* White background */}
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="white" />

        {/* Runtime foundation band */}
        {(() => {
          const rtHighlighted = highlightModule === 'runtime';
          const rtDimmed = highlightModule && highlightModule !== 'runtime';
          return (
            <g opacity={rtDimmed ? 0.15 : 1} style={{ transition: 'opacity 0.3s' }}>
              <rect
                x={0}
                y={HEIGHT - 50}
                width={WIDTH}
                height={50}
                fill="url(#syncRuntimeGrad)"
                opacity={rtHighlighted ? 3 : 1}
              />
              {rtHighlighted && (
                <rect
                  x={0}
                  y={HEIGHT - 50}
                  width={WIDTH}
                  height={50}
                  fill="#2E7D32"
                  opacity={0.08}
                />
              )}
              <text
                x={WIDTH / 2}
                y={HEIGHT - 14}
                textAnchor="middle"
                fill="#2E7D32"
                fontSize={rtHighlighted ? 11 : 9}
                fontFamily="monospace"
                fontWeight={rtHighlighted ? 700 : 400}
                opacity={rtHighlighted ? 0.9 : 0.45}
              >
                runtime (async foundation)
              </text>
            </g>
          );
        })()}

        {/* Connection line between server and client */}
        <line
          x1={SERVER.x}
          y1={SERVER.y}
          x2={CLIENT.x}
          y2={CLIENT.y}
          stroke={dimLine ? '#eee' : '#ccc'}
          strokeWidth={dimLine ? 0.5 : 0.8}
          opacity={dimLine ? 0.3 : 0.4}
          strokeDasharray="6,4"
        >
          {!dimLine && (
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-10"
              dur="1s"
              repeatCount="indefinite"
            />
          )}
        </line>

        {/* Pipeline chips on connection */}
        <ConnectionPipeline
          x1={SERVER.x}
          y1={SERVER.y}
          x2={CLIENT.x}
          y2={CLIENT.y}
          pipeline={SYNC_PIPELINE}
          highlightModule={highlightModule}
          dimLine={dimLine}
          onStageHover={handleStageHover}
        />

        {/* Request particles (client -> server) */}
        {showRequest && (
          <circle r={3} fill="#455A64" opacity={0.8}>
            <animateMotion
              dur="1s"
              repeatCount="indefinite"
              path={`M${CLIENT.x},${CLIENT.y} L${SERVER.x},${SERVER.y}`}
            />
          </circle>
        )}

        {/* Response particles (server -> client) */}
        {showResponse && (
          <circle r={3.5} fill="#795548" opacity={0.8}>
            <animateMotion
              dur="1.5s"
              repeatCount="indefinite"
              path={`M${SERVER.x},${SERVER.y} L${CLIENT.x},${CLIENT.y}`}
            />
          </circle>
        )}

        {/* Verify particle (inside client) */}
        {phase === 'VERIFY' && (
          <circle
            cx={CLIENT.x}
            cy={CLIENT.y}
            r={6}
            fill="none"
            stroke="#C62828"
            strokeWidth={1.5}
          >
            <animate
              attributeName="r"
              values="6;20;6"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.8;0.1;0.8"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        )}

        {/* Server node */}
        <ServerNode
          x={SERVER.x}
          y={SERVER.y}
          width={SERVER.width}
          height={SERVER.height}
          highlighted={highlightNode === 'server'}
          dimmed={highlightNode && highlightNode !== 'server'}
          highlightModule={highlightModule}
          phase={phase}
          onMouseEnter={() => {
            setHighlightNode('server');
            setTooltip({ type: 'server' });
          }}
          onMouseLeave={() => {
            setHighlightNode(null);
            setTooltip(null);
          }}
        />

        {/* Client node */}
        <ClientNode
          x={CLIENT.x}
          y={CLIENT.y}
          width={CLIENT.width}
          height={CLIENT.height}
          highlighted={highlightNode === 'client'}
          dimmed={highlightNode && highlightNode !== 'client'}
          highlightModule={highlightModule}
          phase={phase}
          onMouseEnter={() => {
            setHighlightNode('client');
            setTooltip({ type: 'client' });
          }}
          onMouseLeave={() => {
            setHighlightNode(null);
            setTooltip(null);
          }}
        />

        {/* Phase indicator */}
        <text
          x={WIDTH - 16}
          y={24}
          textAnchor="end"
          fill="gray"
          fontSize={10}
          fontFamily="monospace"
        >
          {phase}
        </text>
        <rect x={WIDTH - 156} y={32} width={140} height={2} rx={1} fill="#eee" />
        <rect
          x={WIDTH - 156}
          y={32}
          width={140 * phaseProgress}
          height={2}
          rx={1}
          fill="#795548"
        />
      </svg>

      <SyncTooltip info={tooltip} position={mousePos} />

      <div className="viz-footer">
        <a href="https://github.com/commonwarexyz/monorepo">GitHub</a>
        <a href="https://commonware.xyz">commonware.xyz</a>
      </div>
    </div>
  );
}

// Sync-specific tooltip that knows about server/client node types
function SyncTooltip({ info, position }) {
  if (!info) return null;

  const { type, moduleKey, pipelineLabel } = info;
  let title, body;

  if (type === 'module' && moduleKey) {
    const mod = SYNC_MODULES[moduleKey];
    title = mod?.name;
    body = pipelineLabel
      ? `${pipelineLabel}: ${mod?.detail}`
      : mod?.detail;
  } else if (type === 'server') {
    title = 'Server';
    body = 'Holds an evolving QMDB database, continuously adding new operations. Serves historical operations with Merkle proofs to connected clients.';
  } else if (type === 'client') {
    title = 'Client';
    body = 'Connects to server, fetches operation batches with Merkle proofs, verifies them, and rebuilds an identical local copy of the database.';
  }

  if (!title) return null;

  return (
    <div
      className="tooltip"
      style={{
        left: position.x + 12,
        top: position.y - 8,
      }}
    >
      <div className="tooltip-title">{title}</div>
      <div className="tooltip-body">{body}</div>
    </div>
  );
}
```

**Step 2: Run build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: SUCCESS (SyncVisualization not yet mounted in App, but should compile)

**Step 3: Commit**

```bash
git add src/components/SyncVisualization.jsx
git commit -m "feat: add SyncVisualization main component"
```

---

### Task 6: Add tab navigation to App.jsx

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Step 1: Update App.jsx with tab state and conditional rendering**

Replace the entire `src/App.jsx` with:

```js
import { useState } from 'react';
import './App.css';
import BridgeVisualization from './components/BridgeVisualization';
import SyncVisualization from './components/SyncVisualization';

const EXAMPLES = [
  { id: 'bridge', label: 'bridge', subtitle: 'Send succinct consensus certificates between two networks.' },
  { id: 'sync', label: 'sync', subtitle: 'Synchronize state between a server and client.' },
];

function App() {
  const [activeExample, setActiveExample] = useState('bridge');

  return (
    <div>
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
      {activeExample === 'sync' && <SyncVisualization />}
    </div>
  );
}

export default App;
```

**Step 2: Add tab styles to App.css**

Add to the top of `src/App.css` (before `.viz-container`):

```css
/* Example tab navigation */
.example-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 8px;
  font-family: monospace;
}

.example-tab {
  padding: 4px 12px;
  background: none;
  border: 1px solid #ddd;
  border-bottom: none;
  cursor: pointer;
  font-family: monospace;
  font-size: 0.85em;
  color: gray;
}

.example-tab:hover {
  background: #f9f9f9;
  color: black;
}

.example-tab--active {
  color: black;
  font-weight: bold;
  border-bottom: 2px solid black;
}
```

**Step 3: Run build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: SUCCESS

**Step 4: Verify in browser**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run dev`
Verify:
- Tab bar shows "bridge" and "sync" tabs
- Clicking "bridge" shows the bridge visualization (unchanged)
- Clicking "sync" shows the sync visualization with server and client nodes
- Animation cycles through ADD_OPS -> GET_TARGET -> FETCH_OPS -> VERIFY -> APPLY -> SYNCED
- Legend shows only the 5 sync-relevant modules
- Hovering server/client nodes shows tooltips
- Hovering pipeline chips shows module tooltips
- Module highlight/dimming works via legend clicks

**Step 5: Commit**

```bash
git add src/App.jsx src/App.css
git commit -m "feat: add tab navigation to switch between bridge and sync visualizers"
```

---

### Task 7: Polish and iterate

**Files:**
- Potentially adjust: `src/data/sync/layout.js` (positions may need tuning)
- Potentially adjust: `src/components/SyncVisualization.jsx` (visual refinements)
- Potentially adjust: `src/components/nodes/ServerNode.jsx`, `src/components/nodes/ClientNode.jsx`

**Step 1: Visual review in browser**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run dev`

Check and adjust:
- Server and client node positions look balanced in the 1200x860 viewBox
- Internal module chips inside nodes are readable and well-spaced
- Connection pipeline chips are centered between nodes
- Particle animations flow in the right directions at the right phases
- Phase indicator and progress bar are visible
- Tab switching is instant with no layout shift

**Step 2: Run final build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: SUCCESS with no warnings

**Step 3: Commit any polish changes**

```bash
git add -A
git commit -m "polish: tune sync visualizer layout and styling"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `commonware-visualization/CLAUDE.md`

**Step 1: Update CLAUDE.md to document the multi-example structure**

Add a section documenting the new navigation and sync visualizer, including:
- The tab-based navigation in App.jsx
- The sync visualizer component structure
- The sync data model (sync/layout.js, sync/pipelines.js, sync/modules.js)
- How Legend.jsx is now parameterized

This keeps the project documentation accurate for future sessions.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with sync visualizer and tab navigation"
```
