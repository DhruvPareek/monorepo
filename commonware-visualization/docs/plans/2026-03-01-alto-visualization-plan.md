# Alto Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "alto" tab to the commonware-visualization app showing the full Alto blockchain system with animated consensus rounds.

**Architecture:** Node-and-edge SVG diagram with 5 validators in a pentagon, indexer and follower on the right side. Reuses shared Legend and ConnectionPipeline components. New data files, animation hook, node components, and connection components follow the established patterns from bridge/sync.

**Tech Stack:** React, SVG, requestAnimationFrame

---

### Task 1: Data files - modules, layout, pipelines

**Files:**
- Create: `src/data/alto/modules.js`
- Create: `src/data/alto/layout.js`
- Create: `src/data/alto/pipelines.js`

**Step 1: Create `src/data/alto/modules.js`**

```js
export const ALTO_MODULES = {
  consensus: {
    name: 'consensus',
    color: '#7B1FA2',
    short: 'BFT via Simplex',
    detail:
      'simplex::Engine with VRF-based leader election. Validators propose and vote on block digests. BLS12-381 threshold signatures (3-of-5). Notarization requires 2f+1 votes, followed by finalization.',
  },
  p2p: {
    name: 'p2p',
    color: '#0097A7',
    short: 'Authenticated peer mesh',
    detail:
      'authenticated::discovery::Network with ED25519-authenticated connections. 5 channels: pending(0), recovered(1), resolver(2), broadcast(3), marshal(4), each with independent rate limits.',
  },
  cryptography: {
    name: 'cryptography',
    color: '#C62828',
    short: 'Ed25519 + BLS12-381 + SHA-256',
    detail:
      'Ed25519 for validator identity and P2P authentication. BLS12-381 MinSig for threshold consensus certificates (notarization and finalization). SHA-256 for block digest computation.',
  },
  broadcast: {
    name: 'broadcast',
    color: '#E65100',
    short: 'Message buffering',
    detail:
      "buffered::Engine buffers out-of-order consensus messages with priority. Sits between P2P transport and the consensus engine, ensuring messages aren't dropped if the node isn't ready.",
  },
  storage: {
    name: 'storage',
    color: '#795548',
    short: 'Finalized chain persistence',
    detail:
      'Two immutable archives: finalizations-by-height and finalized-blocks. zstd level 3 compression. Page cache: 4KB pages, 32MB capacity. Enables crash recovery without violating safety.',
  },
  codec: {
    name: 'codec',
    color: '#455A64',
    short: 'Binary serialization',
    detail:
      'commonware-codec Encode/Decode for all wire and storage formats. Block, Seed, Notarization, Finalization all use binary encoding with varint compression.',
  },
  parallel: {
    name: 'parallel',
    color: '#283593',
    short: 'Sig verification',
    detail:
      'BLS12-381 signature verification via commonware-parallel. Validators use thread pools for parallel verification. Indexer and follower use Sequential strategy.',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Async foundation',
    detail:
      'Tokio-based async executor. Task spawning, TCP networking, storage I/O, buffer primitives, rate limiting, and metrics. All other modules depend on this.',
  },
  resolver: {
    name: 'resolver',
    color: '#6A1B9A',
    short: 'Certificate backfill',
    detail:
      'Resolves missing certificates and blocks when a node falls behind. Validators use P2P-based resolution; follower uses HTTP fetching from indexer.',
  },
};

export const ALTO_MODULE_LIST = Object.values(ALTO_MODULES);
```

**Step 2: Create `src/data/alto/layout.js`**

```js
// SVG viewBox dimensions
export const WIDTH = 1200;
export const HEIGHT = 860;

// Validator cluster center
export const CLUSTER = {
  label: 'Validators',
  cx: 380,
  cy: 430,
  width: 420,
  height: 420,
};

// Pentagon arrangement offsets from cluster center
const PENTAGON_R = 150;
const PENTAGON = Array.from({ length: 5 }, (_, i) => {
  const angle = (-Math.PI / 2) + (2 * Math.PI * i) / 5;
  return { dx: Math.round(PENTAGON_R * Math.cos(angle)), dy: Math.round(PENTAGON_R * Math.sin(angle)) };
});

export const VALIDATORS = PENTAGON.map((d, i) => ({
  id: `V${i + 1}`,
  label: `V${i + 1}`,
  x: CLUSTER.cx + d.dx,
  y: CLUSTER.cy + d.dy,
}));

// Indexer position
export const INDEXER = { x: 900, y: 200 };

// Follower position
export const FOLLOWER = { x: 900, y: 560 };

// Modules present on each connection type (for compact dot display)
export const P2P_MESH_MODULES = ['broadcast', 'cryptography', 'p2p'];
export const HTTP_PUSH_MODULES = ['codec', 'runtime'];
export const SYNC_MODULES = ['codec', 'runtime'];

// Modules inside each node type (for highlight matching)
export const VALIDATOR_MODULES = ['consensus', 'storage', 'broadcast', 'parallel', 'resolver'];
export const INDEXER_INTERNAL_MODULES = ['parallel', 'runtime'];
export const FOLLOWER_INTERNAL_MODULES = ['storage', 'parallel', 'resolver', 'runtime'];
```

**Step 3: Create `src/data/alto/pipelines.js`**

```js
// P2P pipeline: validator-to-validator consensus messages
export const P2P_PIPELINE = [
  { module: 'broadcast', label: 'buffer', side: 'source' },
  { module: 'cryptography', label: 'peer auth', side: 'inner' },
  { module: 'p2p', label: 'p2p', side: 'center' },
  { module: 'cryptography', label: 'peer auth', side: 'inner' },
  { module: 'broadcast', label: 'buffer', side: 'dest' },
];

// HTTP push pipeline: validator-to-indexer block/certificate upload
export const HTTP_PUSH_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'runtime', label: 'HTTP POST', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Sync pipeline: indexer-to-follower WebSocket + HTTP backfill
export const SYNC_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'runtime', label: 'HTTP/WS', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Internal modules displayed as dots inside each node
export const VALIDATOR_INTERNAL = [
  { module: 'consensus', label: 'simplex' },
  { module: 'storage', label: 'archive' },
  { module: 'broadcast', label: 'buffer' },
  { module: 'parallel', label: 'BLS verify' },
  { module: 'resolver', label: 'backfill' },
];

export const INDEXER_INTERNAL = [
  { module: 'parallel', label: 'BLS verify' },
  { module: 'runtime', label: 'async' },
];

export const FOLLOWER_INTERNAL = [
  { module: 'storage', label: 'archive' },
  { module: 'parallel', label: 'BLS verify' },
  { module: 'resolver', label: 'backfill' },
  { module: 'runtime', label: 'async' },
];
```

**Step 4: Verify build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: PASS (files are created but not yet imported)

**Step 5: Commit**

```bash
git add src/data/alto/
git commit -m "feat(alto): add data files for alto visualization - modules, layout, pipelines"
```

---

### Task 2: Animation hook - useAltoAnimation

**Files:**
- Create: `src/hooks/useAltoAnimation.js`

**Step 1: Create the animation hook**

```js
import { useState, useEffect, useCallback, useRef } from 'react';

const PHASES = [
  { name: 'IDLE', duration: 1000 },
  { name: 'PROPOSE', duration: 2000 },
  { name: 'NOTARIZE', duration: 2500 },
  { name: 'FINALIZE', duration: 2000 },
  { name: 'PUSH', duration: 1500 },
  { name: 'SYNC', duration: 1000 },
];

const TOTAL_CYCLE = PHASES.reduce((s, p) => s + p.duration, 0);

export function useAltoAnimation() {
  const [elapsed, setElapsed] = useState(0);
  const [blockHeight, setBlockHeight] = useState(1);
  const [leader, setLeader] = useState(0); // index 0-4
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const dt = timestamp - lastRef.current;
    lastRef.current = timestamp;

    setElapsed((prev) => {
      const next = prev + dt;
      if (next >= TOTAL_CYCLE) {
        setBlockHeight((h) => h + 1);
        setLeader((l) => (l + 1) % 5);
        return next - TOTAL_CYCLE;
      }
      return next;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    lastRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  // Derive current phase and progress
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

  return {
    phase: phase.name,
    phaseProgress,
    blockHeight,
    leader,
  };
}
```

**Step 2: Verify build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/useAltoAnimation.js
git commit -m "feat(alto): add consensus round animation hook"
```

---

### Task 3: Validator node component - AltoValidatorNode

**Files:**
- Create: `src/components/nodes/AltoValidatorNode.jsx`

**Step 1: Create the component**

This is a circle node with 5 internal module dots (C, S, B, P, R) based on `VALIDATOR_INTERNAL`. Follows the same pattern as `ValidatorNode.jsx` from bridge but with more dots and different letter mappings.

```jsx
import { ALTO_MODULES } from '../../data/alto/modules';
import { VALIDATOR_INTERNAL } from '../../data/alto/pipelines';

const LETTERS = {
  consensus: 'C',
  storage: 'S',
  broadcast: 'B',
  parallel: 'P',
  resolver: 'R',
};

export default function AltoValidatorNode({
  validator,
  isLeader,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onMouseEnter,
  onMouseLeave,
}) {
  const { x, y, label } = validator;
  const opacity = dimmed ? 0.2 : 1;
  const radius = 26;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {isLeader && (
        <circle cx={x} cy={y} r={radius + 8} fill="none" stroke="#7B1FA2" strokeWidth={1.5}>
          <animate
            attributeName="r"
            values={`${radius + 6};${radius + 12};${radius + 6}`}
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0.2;0.7"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="white"
        stroke={highlighted ? 'black' : '#999'}
        strokeWidth={highlighted ? 1.5 : 1}
      />
      <text
        x={x}
        y={y - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={11}
        fontFamily="monospace"
        fontWeight={700}
      >
        {label}
      </text>
      {VALIDATOR_INTERNAL.map((item, i) => {
        const mod = ALTO_MODULES[item.module];
        const n = VALIDATOR_INTERNAL.length;
        const dotX = x + (i - (n - 1) / 2) * 10;
        const dotY = y + 9;
        const modHighlighted = highlightModule === item.module;
        const modDimmed = highlightModule && highlightModule !== item.module;
        return (
          <g
            key={item.module}
            opacity={modDimmed ? 0.15 : 1}
            style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onModuleClick?.(item.module); }}
          >
            <circle
              cx={dotX}
              cy={dotY}
              r={modHighlighted ? 5 : 3.5}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.7}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1 : 0}
            />
            <text
              x={dotX}
              y={dotY + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={modHighlighted ? 5 : 4}
              fontFamily="monospace"
              fontWeight={700}
            >
              {LETTERS[item.module]}
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

Note: 5 dots at 10px spacing (vs bridge's 14px for 3 dots) to fit within radius 26 circle. `(5-1)/2 * 10 = 20px` half-span, fits in r=26.

**Step 2: Verify build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/nodes/AltoValidatorNode.jsx
git commit -m "feat(alto): add AltoValidatorNode component with 5 internal module dots"
```

---

### Task 4: Indexer and Follower node components

**Files:**
- Create: `src/components/nodes/AltoIndexerNode.jsx`
- Create: `src/components/nodes/FollowerNode.jsx`

**Step 1: Create `AltoIndexerNode.jsx`**

Hexagonal node like bridge indexer, but imports from alto data. Internal dots: parallel, runtime.

```jsx
import { ALTO_MODULES } from '../../data/alto/modules';
import { INDEXER_INTERNAL } from '../../data/alto/pipelines';

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

export default function AltoIndexerNode({
  x,
  y,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onMouseEnter,
  onMouseLeave,
  pulsing,
}) {
  const r = 34;
  const opacity = dimmed ? 0.2 : 1;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {pulsing && (
        <polygon
          points={hexPoints(x, y, r + 8)}
          fill="none"
          stroke="#E65100"
          strokeWidth={1.5}
        >
          <animate attributeName="opacity" values="0.7;0.15;0.7" dur="1s" repeatCount="indefinite" />
        </polygon>
      )}
      <polygon
        points={hexPoints(x, y, r + 5)}
        fill="none"
        stroke="#E65100"
        strokeWidth={0.5}
        opacity={0.3}
      >
        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="3s" repeatCount="indefinite" />
      </polygon>
      <polygon
        points={hexPoints(x, y, r)}
        fill="white"
        stroke={highlighted ? 'black' : '#999'}
        strokeWidth={highlighted ? 1.5 : 1}
      />
      <text
        x={x}
        y={y - 7}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={10}
        fontFamily="monospace"
        fontWeight={700}
      >
        INDEXER
      </text>
      {INDEXER_INTERNAL.map((item, i) => {
        const mod = ALTO_MODULES[item.module];
        const dotX = x - 10 + i * 20;
        const dotY = y + 9;
        const modHighlighted = highlightModule === item.module;
        const modDimmed = highlightModule && highlightModule !== item.module;
        return (
          <g key={item.module} opacity={modDimmed ? 0.15 : 1} style={{ transition: 'opacity 0.3s', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onModuleClick?.(item.module); }}>
            <rect
              x={dotX - 8}
              y={dotY - 5}
              width={16}
              height={10}
              rx={2}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.7}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1 : 0}
            />
            <text
              x={dotX}
              y={dotY + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={5}
              fontFamily="monospace"
              fontWeight={600}
            >
              {item.label === 'BLS verify' ? 'BLS' : 'RT'}
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

**Step 2: Create `FollowerNode.jsx`**

Rounded rectangle with dashed border to indicate passive/non-voting. Internal dots: storage, parallel, resolver, runtime.

```jsx
import { ALTO_MODULES } from '../../data/alto/modules';
import { FOLLOWER_INTERNAL } from '../../data/alto/pipelines';

const LETTERS = {
  storage: 'S',
  parallel: 'P',
  resolver: 'R',
  runtime: 'RT',
};

export default function FollowerNode({
  x,
  y,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onMouseEnter,
  onMouseLeave,
  pulsing,
}) {
  const w = 100;
  const h = 56;
  const opacity = dimmed ? 0.2 : 1;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {pulsing && (
        <rect
          x={x - w / 2 - 4}
          y={y - h / 2 - 4}
          width={w + 8}
          height={h + 8}
          rx={8}
          fill="none"
          stroke="#2E7D32"
          strokeWidth={1.5}
        >
          <animate attributeName="opacity" values="0.7;0.15;0.7" dur="1s" repeatCount="indefinite" />
        </rect>
      )}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={6}
        fill="white"
        stroke={highlighted ? 'black' : '#999'}
        strokeWidth={highlighted ? 1.5 : 1}
        strokeDasharray="4,2"
      />
      <text
        x={x}
        y={y - 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={10}
        fontFamily="monospace"
        fontWeight={700}
      >
        FOLLOWER
      </text>
      {FOLLOWER_INTERNAL.map((item, i) => {
        const mod = ALTO_MODULES[item.module];
        const n = FOLLOWER_INTERNAL.length;
        const dotX = x + (i - (n - 1) / 2) * 18;
        const dotY = y + 8;
        const modHighlighted = highlightModule === item.module;
        const modDimmed = highlightModule && highlightModule !== item.module;
        return (
          <g key={item.module} opacity={modDimmed ? 0.15 : 1} style={{ transition: 'opacity 0.3s', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onModuleClick?.(item.module); }}>
            <circle
              cx={dotX}
              cy={dotY}
              r={modHighlighted ? 5 : 3.5}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.7}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1 : 0}
            />
            <text
              x={dotX}
              y={dotY + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={modHighlighted ? 5 : 4}
              fontFamily="monospace"
              fontWeight={700}
            >
              {LETTERS[item.module]}
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

**Step 3: Verify build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/nodes/AltoIndexerNode.jsx src/components/nodes/FollowerNode.jsx
git commit -m "feat(alto): add AltoIndexerNode and FollowerNode components"
```

---

### Task 5: Connection components - AltoP2PMesh and HttpConnection

**Files:**
- Create: `src/components/connections/AltoP2PMesh.jsx`
- Create: `src/components/connections/HttpConnection.jsx`

**Step 1: Create `AltoP2PMesh.jsx`**

P2P mesh between 5 validators. One representative edge (idx 0) gets full pipeline; others get compact dots. Particles during PROPOSE (leader broadcasts), NOTARIZE (all vote), and FINALIZE (all vote).

```jsx
import ConnectionPipeline from './ConnectionPipeline';
import { P2P_MESH_MODULES } from '../../data/alto/layout';
import { P2P_PIPELINE } from '../../data/alto/pipelines';
import { ALTO_MODULES } from '../../data/alto/modules';

function pairs(validators) {
  const result = [];
  for (let i = 0; i < validators.length; i++) {
    for (let j = i + 1; j < validators.length; j++) {
      result.push([validators[i], validators[j]]);
    }
  }
  return result;
}

export default function AltoP2PMesh({
  validators,
  highlightModule,
  highlightNode,
  phase,
  leader,
  onStageHover,
  onModuleClick,
}) {
  const meshPairs = pairs(validators);

  return (
    <g>
      {meshPairs.map(([a, b], idx) => {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

        const nodeHighlight =
          highlightNode && (highlightNode === a.id || highlightNode === b.id);
        const anyModuleHighlight =
          highlightModule && P2P_MESH_MODULES.includes(highlightModule);
        const dimLine =
          (highlightModule && !anyModuleHighlight) ||
          (highlightNode && !nodeHighlight);

        const showPipeline = idx === 0;

        // Particle logic: during PROPOSE, leader sends to all others
        // during NOTARIZE/FINALIZE, all pairs exchange
        const leaderV = validators[leader];
        const isLeaderEdge = a.id === leaderV.id || b.id === leaderV.id;
        const showProposeParticle = phase === 'PROPOSE' && isLeaderEdge;
        const showVoteParticle = (phase === 'NOTARIZE' || phase === 'FINALIZE') && idx < 5;

        return (
          <g key={`mesh-${a.id}-${b.id}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={dimLine ? '#eee' : '#ccc'}
              strokeWidth={dimLine ? 0.5 : 0.8}
              strokeDasharray="4,4"
              opacity={dimLine ? 0.4 : 0.4}
            >
              {!dimLine && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-8"
                  dur="1s"
                  repeatCount="indefinite"
                />
              )}
            </line>
            {showPipeline && (
              <ConnectionPipeline
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                pipeline={P2P_PIPELINE}
                highlightModule={highlightModule}
                dimLine={dimLine}
                onStageHover={onStageHover}
                onModuleClick={onModuleClick}
              />
            )}
            {!showPipeline &&
              P2P_MESH_MODULES.map((mod, mi) => {
                const perpAngle = (angle + 90) * (Math.PI / 180);
                const offset = (mi - 1) * 8;
                const ox = offset * Math.cos(perpAngle);
                const oy = offset * Math.sin(perpAngle);
                const modDimmed = highlightModule && highlightModule !== mod;
                return (
                  <circle
                    key={mod}
                    cx={mx + ox}
                    cy={my + oy}
                    r={3}
                    fill={modDimmed ? '#eee' : ALTO_MODULES[mod].color}
                    opacity={modDimmed ? 0.2 : 0.6}
                    style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); onModuleClick?.(mod); }}
                  />
                );
              })}
            {showProposeParticle && (
              <circle r={3} fill="#7B1FA2" opacity={0.8}>
                <animateMotion
                  dur={`${0.8 + (idx % 3) * 0.2}s`}
                  repeatCount="indefinite"
                  path={
                    a.id === leaderV.id
                      ? `M${a.x},${a.y} L${b.x},${b.y}`
                      : `M${b.x},${b.y} L${a.x},${a.y}`
                  }
                />
              </circle>
            )}
            {showVoteParticle && (
              <circle r={2.5} fill="#7B1FA2" opacity={0.6}>
                <animateMotion
                  dur={`${0.7 + idx * 0.15}s`}
                  repeatCount="indefinite"
                  path={`M${a.x},${a.y} L${b.x},${b.y}`}
                />
              </circle>
            )}
          </g>
        );
      })}
      {/* Threshold flash during NOTARIZE/FINALIZE at ~70% progress */}
    </g>
  );
}
```

**Step 2: Create `HttpConnection.jsx`**

Generic HTTP connection line with pipeline chips. Used for both validator-to-indexer and indexer-to-follower.

```jsx
import ConnectionPipeline from './ConnectionPipeline';
import { ALTO_MODULES } from '../../data/alto/modules';

export default function HttpConnection({
  x1,
  y1,
  x2,
  y2,
  pipeline,
  connectionModules,
  highlightModule,
  highlightNode,
  sourceId,
  destId,
  showPipeline,
  showParticle,
  particleColor,
  particleReverse,
  onStageHover,
  onModuleClick,
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

  const nodeHighlight =
    highlightNode && (highlightNode === sourceId || highlightNode === destId);
  const anyModuleHighlight =
    highlightModule && connectionModules.includes(highlightModule);
  const dimLine =
    (highlightModule && !anyModuleHighlight) ||
    (highlightNode && !nodeHighlight);

  const px1 = particleReverse ? x2 : x1;
  const py1 = particleReverse ? y2 : y1;
  const px2 = particleReverse ? x1 : x2;
  const py2 = particleReverse ? y1 : y2;

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={dimLine ? '#eee' : '#ccc'}
        strokeWidth={dimLine ? 0.5 : 0.6}
        opacity={dimLine ? 0.3 : 0.35}
        strokeDasharray="6,4"
      />
      {showPipeline && (
        <ConnectionPipeline
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          pipeline={pipeline}
          highlightModule={highlightModule}
          dimLine={dimLine}
          onStageHover={onStageHover}
          onModuleClick={onModuleClick}
        />
      )}
      {!showPipeline &&
        connectionModules.map((mod, mi) => {
          const perpAngle = (angle + 90) * (Math.PI / 180);
          const n = connectionModules.length;
          const offset = (mi - (n - 1) / 2) * 8;
          const ox = offset * Math.cos(perpAngle);
          const oy = offset * Math.sin(perpAngle);
          const modDimmed = highlightModule && highlightModule !== mod;
          return (
            <circle
              key={mod}
              cx={mx + ox}
              cy={my + oy}
              r={2.5}
              fill={modDimmed ? '#eee' : ALTO_MODULES[mod].color}
              opacity={modDimmed ? 0.2 : 0.5}
              style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onModuleClick?.(mod); }}
            />
          );
        })}
      {showParticle && (
        <circle r={3} fill={particleColor || '#455A64'} opacity={0.8}>
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={`M${px1},${py1} L${px2},${py2}`}
          />
        </circle>
      )}
    </g>
  );
}
```

**Step 3: Verify build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/connections/AltoP2PMesh.jsx src/components/connections/HttpConnection.jsx
git commit -m "feat(alto): add AltoP2PMesh and HttpConnection components"
```

---

### Task 6: Main visualization component - AltoVisualization

**Files:**
- Create: `src/components/AltoVisualization.jsx`

**Step 1: Create the component**

Top-level composition for the alto tab. Follows the same pattern as `BridgeVisualization.jsx`: manages highlight/tooltip state, renders background, cluster, connections, nodes, phase indicator.

```jsx
import { useState, useCallback } from 'react';
import {
  WIDTH,
  HEIGHT,
  CLUSTER,
  VALIDATORS,
  INDEXER,
  FOLLOWER,
  HTTP_PUSH_MODULES,
  SYNC_MODULES as SYNC_CONNECTION_MODULES,
  VALIDATOR_MODULES,
  INDEXER_INTERNAL_MODULES,
  FOLLOWER_INTERNAL_MODULES,
} from '../data/alto/layout';
import { ALTO_MODULE_LIST, ALTO_MODULES } from '../data/alto/modules';
import { HTTP_PUSH_PIPELINE, SYNC_PIPELINE } from '../data/alto/pipelines';
import { useAltoAnimation } from '../hooks/useAltoAnimation';
import AltoValidatorNode from './nodes/AltoValidatorNode';
import AltoIndexerNode from './nodes/AltoIndexerNode';
import FollowerNode from './nodes/FollowerNode';
import AltoP2PMesh from './connections/AltoP2PMesh';
import HttpConnection from './connections/HttpConnection';
import Legend from './Legend';

function AltoTooltip({ info, position }) {
  if (!info) return null;
  const { type, id, moduleKey, pipelineLabel } = info;
  let title, body;

  if (type === 'module' && moduleKey) {
    const mod = ALTO_MODULES[moduleKey];
    title = mod?.name;
    body = pipelineLabel ? `${pipelineLabel}: ${mod?.detail}` : mod?.detail;
  } else if (type === 'validator') {
    title = id;
    body = 'Validator node running Simplex BFT. Internal: consensus (simplex engine), storage (finalized chain archive), broadcast (message buffer), parallel (BLS thread pool verification), resolver (P2P block backfill). Communicates via authenticated P2P mesh.';
  } else if (type === 'indexer') {
    title = 'Indexer';
    body = 'In-memory HTTP/WebSocket server. Receives blocks and certificates from validators via HTTP POST. Serves data to followers and clients. Internal: parallel (Sequential BLS verification), runtime (async HTTP server).';
  } else if (type === 'follower') {
    title = 'Follower';
    body = 'Non-voting full node. Syncs finalized chain from indexer via WebSocket (real-time) and HTTP (backfill). Internal: storage (local chain archive), parallel (BLS verification), resolver (HTTP-based backfill), runtime (async executor).';
  }

  if (!title) return null;

  return (
    <div
      className="tooltip"
      style={{ left: position.x + 12, top: position.y - 8 }}
    >
      <div className="tooltip-title">{title}</div>
      <div className="tooltip-body">{body}</div>
    </div>
  );
}

export default function AltoVisualization() {
  const { phase, phaseProgress, blockHeight, leader } = useAltoAnimation();

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

  // Representative validator for HTTP push pipeline display (V1)
  const repValidator = VALIDATORS[0];

  return (
    <div className="viz-container" onMouseMove={handleMouseMove} onClick={() => setHighlightModule(null)}>
      <div className="viz-header">
        <h1 className="viz-title"><a href="https://github.com/commonwarexyz/alto" target="_blank" rel="noopener noreferrer">Alto</a></h1>
        <p className="viz-subtitle">
          A minimal, high-performance blockchain built on the Commonware Library.
        </p>
      </div>

      <Legend modules={ALTO_MODULE_LIST} activeModule={highlightModule} onSelect={setHighlightModule} />

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="viz-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* SVG defs for runtime gradient */}
        <defs>
          <linearGradient id="altoRuntimeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
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
                fill="url(#altoRuntimeGrad)"
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

        {/* Validator cluster */}
        {(() => {
          const dimmed = highlightNode && highlightNode !== 'indexer' && highlightNode !== 'follower' && !VALIDATORS.find((v) => v.id === highlightNode);
          return (
            <g style={{ opacity: dimmed ? 0.3 : 1, transition: 'opacity 0.3s' }}>
              <rect
                x={CLUSTER.cx - CLUSTER.width / 2}
                y={CLUSTER.cy - CLUSTER.height / 2}
                width={CLUSTER.width}
                height={CLUSTER.height}
                rx={4}
                fill="none"
                stroke={highlightModule ? '#eee' : '#ccc'}
                strokeWidth={1}
                strokeDasharray="6,3"
              />
              <text
                x={CLUSTER.cx}
                y={CLUSTER.cy - CLUSTER.height / 2 - 8}
                textAnchor="middle"
                fill="black"
                fontSize={12}
                fontFamily="monospace"
                fontWeight={600}
              >
                {CLUSTER.label}
              </text>
            </g>
          );
        })()}

        {/* HTTP connections from validators to indexer (behind mesh) */}
        {VALIDATORS.map((v, i) => (
          <HttpConnection
            key={`http-${v.id}`}
            x1={v.x}
            y1={v.y}
            x2={INDEXER.x}
            y2={INDEXER.y}
            pipeline={HTTP_PUSH_PIPELINE}
            connectionModules={HTTP_PUSH_MODULES}
            highlightModule={highlightModule}
            highlightNode={highlightNode}
            sourceId={v.id}
            destId="indexer"
            showPipeline={i === 0}
            showParticle={
              (phase === 'PROPOSE' && v.id === VALIDATORS[leader].id) ||
              phase === 'PUSH'
            }
            particleColor="#455A64"
            onStageHover={handleStageHover}
            onModuleClick={setHighlightModule}
          />
        ))}

        {/* Sync connection from indexer to follower */}
        <HttpConnection
          x1={INDEXER.x}
          y1={INDEXER.y}
          x2={FOLLOWER.x}
          y2={FOLLOWER.y}
          pipeline={SYNC_PIPELINE}
          connectionModules={SYNC_CONNECTION_MODULES}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          sourceId="indexer"
          destId="follower"
          showPipeline={true}
          showParticle={phase === 'SYNC'}
          particleColor="#2E7D32"
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
        />

        {/* P2P mesh */}
        <AltoP2PMesh
          validators={VALIDATORS}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          phase={phase}
          leader={leader}
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
        />

        {/* Validator nodes */}
        {VALIDATORS.map((v, i) => (
          <AltoValidatorNode
            key={v.id}
            validator={v}
            isLeader={i === leader && (phase === 'IDLE' || phase === 'PROPOSE')}
            highlighted={highlightNode === v.id}
            dimmed={highlightNode && highlightNode !== v.id}
            highlightModule={highlightModule}
            onModuleClick={setHighlightModule}
            onMouseEnter={() => {
              setHighlightNode(v.id);
              setTooltip({ type: 'validator', id: v.id });
            }}
            onMouseLeave={() => {
              setHighlightNode(null);
              setTooltip(null);
            }}
          />
        ))}

        {/* Indexer node */}
        <AltoIndexerNode
          x={INDEXER.x}
          y={INDEXER.y}
          highlighted={highlightNode === 'indexer'}
          dimmed={highlightNode && highlightNode !== 'indexer'}
          highlightModule={highlightModule}
          onModuleClick={setHighlightModule}
          pulsing={phase === 'PUSH'}
          onMouseEnter={() => {
            setHighlightNode('indexer');
            setTooltip({ type: 'indexer' });
          }}
          onMouseLeave={() => {
            setHighlightNode(null);
            setTooltip(null);
          }}
        />

        {/* Follower node */}
        <FollowerNode
          x={FOLLOWER.x}
          y={FOLLOWER.y}
          highlighted={highlightNode === 'follower'}
          dimmed={highlightNode && highlightNode !== 'follower'}
          highlightModule={highlightModule}
          onModuleClick={setHighlightModule}
          pulsing={phase === 'SYNC'}
          onMouseEnter={() => {
            setHighlightNode('follower');
            setTooltip({ type: 'follower' });
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
          {phase} (block #{blockHeight})
        </text>
        <rect x={WIDTH - 156} y={32} width={140} height={2} rx={1} fill="#eee" />
        <rect
          x={WIDTH - 156}
          y={32}
          width={140 * phaseProgress}
          height={2}
          rx={1}
          fill="#7B1FA2"
        />

        {/* Notarization/finalization threshold flash */}
        {((phase === 'NOTARIZE' && phaseProgress > 0.7) ||
          (phase === 'FINALIZE' && phaseProgress > 0.7)) && (
          <rect
            x={CLUSTER.cx - CLUSTER.width / 2}
            y={CLUSTER.cy - CLUSTER.height / 2}
            width={CLUSTER.width}
            height={CLUSTER.height}
            rx={4}
            fill="#7B1FA2"
            opacity={0}
          >
            <animate
              attributeName="opacity"
              values="0;0.08;0"
              dur="0.6s"
              repeatCount="1"
            />
          </rect>
        )}
      </svg>

      <AltoTooltip info={tooltip} position={mousePos} />

      <div className="viz-footer">
        <a href="https://github.com/commonwarexyz/alto">GitHub</a>
        <a href="https://commonware.xyz">commonware.xyz</a>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: PASS (component exists but isn't mounted yet)

**Step 3: Commit**

```bash
git add src/components/AltoVisualization.jsx
git commit -m "feat(alto): add AltoVisualization main component"
```

---

### Task 7: Wire into App.jsx

**Files:**
- Modify: `src/App.jsx:1-9`

**Step 1: Add alto to EXAMPLES and import**

In `src/App.jsx`, add the import at line 4:
```js
import AltoVisualization from './components/AltoVisualization';
```

Add to the EXAMPLES array:
```js
const EXAMPLES = [
  { id: 'bridge', label: 'bridge' },
  { id: 'sync', label: 'sync' },
  { id: 'alto', label: 'alto' },
];
```

Add conditional render after the sync line (after line 97):
```jsx
{activeExample === 'alto' && <AltoVisualization />}
```

**Step 2: Verify build**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: PASS with no errors

**Step 3: Verify in browser**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run dev`
Expected: Three tabs visible (bridge, sync, alto). Clicking "alto" shows:
- 5 validators in pentagon with P2P mesh
- Indexer hexagon upper-right
- Follower rectangle lower-right
- Pipeline chips on representative edges
- Animated consensus rounds cycling through IDLE -> PROPOSE -> NOTARIZE -> FINALIZE -> PUSH -> SYNC
- Module legend with 9 modules, click to highlight
- Block height counter incrementing

**Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(alto): wire alto tab into App.jsx"
```

---

### Task 8: Visual polish and review

**Files:**
- Potentially adjust: any of the above files

**Step 1: Review layout**

Open in browser and check:
- Pentagon validators don't overlap cluster border
- HTTP push lines from all 5 validators to indexer aren't too cluttered
- Pipeline chips are readable and don't overlap
- Follower node is positioned with enough space

**Step 2: Review animation**

Watch full cycle:
- Leader indicator appears on correct validator
- Proposal particles flow from leader outward
- Vote particles flow during NOTARIZE/FINALIZE
- Push particles reach indexer
- Sync particle reaches follower
- Threshold flash fires at ~70%

**Step 3: Review highlighting**

Click each module in legend:
- Related pipelines/dots highlight, others dim
- Module dots inside nodes respond correctly
- Runtime band responds

**Step 4: Fix any issues found**

Adjust positions, spacing, timing as needed.

**Step 5: Final build check**

Run: `cd /Users/dhruv/Documents/monorepo/commonware-visualization && npm run build`
Expected: PASS

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(alto): visual polish adjustments"
```
