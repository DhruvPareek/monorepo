import { useState } from 'react';
import {
  WIDTH,
  HEIGHT,
  BOUNDARY,
  ENGINE,
  NODES,
  EDGES,
  edgePoints,
} from '../data/constantinople/validatorLayout';
import { useValidatorFlow } from '../hooks/useValidatorFlow';

// Each flow step lights up a subset of edges/nodes and explains one stage of a
// primary validator's block lifecycle.
const STEPS = [
  {
    key: 'submit',
    label: 'Submit',
    detail:
      'Clients POST signed transactions to the mempool HTTP server, whose request handlers verify each transaction and queue it in the mailbox.',
    edges: ['submit'],
    nodes: ['client', 'mempool'],
  },
  {
    key: 'propose',
    label: 'Propose',
    detail:
      'When simplex elects this validator as leader, glue asks the application to propose. The application pulls a batch from the mempool TransactionSource, executes the transfers, and produces a block plus updated QMDB state and transaction roots.',
    edges: ['elect', 'txsource', 'glue_app', 'app_qmdb'],
    nodes: ['simplex', 'glue', 'mempool', 'application', 'qmdb'],
  },
  {
    key: 'broadcast',
    label: 'Broadcast',
    detail:
      'The proposed block is erasure-coded by marshal into shards and disseminated over the p2p mesh, while simplex votes and threshold certificates flow over their own channels to the other validators.',
    edges: ['block', 'marshal_p2p', 'simplex_p2p', 'p2p_peers'],
    nodes: ['glue', 'marshal', 'simplex', 'p2p', 'peers'],
  },
  {
    key: 'verify',
    label: 'Verify',
    detail:
      'Simplex carries only a commitment (a coding digest), not the block body. The block itself is reconstructed by marshal from erasure-coded shards received over the mesh; glue then calls application.verify_child, which checks signatures, re-executes the block body against the parent state, and compares the computed roots to the header roots.',
    edges: ['p2p_peers', 'simplex_p2p', 'marshal_p2p', 'elect', 'glue_app', 'app_qmdb'],
    nodes: ['peers', 'p2p', 'simplex', 'marshal', 'glue', 'application', 'qmdb'],
  },
  {
    key: 'finalize',
    label: 'Finalize',
    detail:
      'On a marshal finalization update, glue commits the finalized QMDB batch. The finalized update also flows back to the mempool reporter so submitters waiting on those batches resolve.',
    edges: ['finalize', 'glue_commit', 'reporter'],
    nodes: ['marshal', 'glue', 'qmdb', 'mempool'],
  },
];

const NODE_TOOLTIP = {
  client:
    'External client (or the spammer) that signs transactions and submits them to the validator over HTTP.',
  peers:
    'The other validators in the fixed epoch-0 set. Votes, certificates, and erasure-coded shards are exchanged with them over the authenticated p2p mesh.',
  mempool:
    'constantinople-mempool. Transaction intake over an HTTP server; handlers verify submissions and queue them in a mailbox. The engine pulls from this mailbox (its TransactionSource) when proposing a block. When a block finalizes, marshal reports it back here so clients waiting on their submitted transactions get a finalized/dropped result.',
  p2p:
    'commonware_p2p::authenticated::discovery. Authenticated peer networking with discovery. Registers 8 rate-limited channels: votes, certificates, simplex resolver, marshal shards, marshal backfill, state-sync, transaction-sync, and the state-sync probe.',
  simplex:
    'commonware_consensus::simplex. Single-epoch BFT consensus. Votes are signed with a BLS threshold share; notarization and finalization are threshold certificates. A round-robin elector picks the leader each view.',
  marshal:
    'commonware_consensus::marshal. Makes finalized blocks available. It erasure-codes proposed blocks into shards using commonware-coding so any threshold of validators can reconstruct the body, pairs certificates with blocks, and backfills missing blocks.',
  glue:
    'commonware_glue::stateful manages the speculative QMDB lifecycle. It does not execute or verify blocks itself: it calls into constantinople-application to propose, verify, and apply, then commits the database on finalization and drives state and transaction sync for recovery.',
  application:
    'constantinople-application. On propose it pulls a mempool batch and executes transfers; on verify it re-executes a peer block against the parent state and compares roots.',
  qmdb:
    'commonware_storage::qmdb. Merkleized account-state log and transaction-hash log. Each block advances a state root and a transactions root that can be proven to light clients.',
};

// True if a point lands inside (or right at the edge of) any node box. Used to
// keep edge labels from being placed on top of boxes.
function labelInsideBox(px, py) {
  return Object.values(NODES).some(
    (n) =>
      px >= n.x - n.w / 2 - 2 &&
      px <= n.x + n.w / 2 + 2 &&
      py >= n.y - n.h / 2 - 2 &&
      py <= n.y + n.h / 2 + 2
  );
}

function ValidatorTooltip({ nodeId, position }) {
  if (!nodeId) return null;
  const node = NODES[nodeId];
  const body = NODE_TOOLTIP[nodeId];
  if (!node || !body) return null;
  return (
    <div className="tooltip" style={{ left: position.x + 12, top: position.y - 8 }}>
      <div className="tooltip-title">{node.label}</div>
      <div className="tooltip-body">{body}</div>
    </div>
  );
}

function ValidatorBox({ node, emphasized, dimmed, onHover }) {
  const left = node.x - node.w / 2;
  const top = node.y - node.h / 2;
  const opacity = dimmed ? 0.28 : 1;
  // External processes (Client, Peers) are not commonware/constantinople
  // modules or crates, so they get a distinct look: dashed grey outline, grey
  // fill, and no colored primitive stripe.
  const external = node.kind === 'external';
  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      cursor="pointer"
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      {emphasized && (
        <rect
          x={left - 4}
          y={top - 4}
          width={node.w + 8}
          height={node.h + 8}
          rx={9}
          fill="none"
          stroke={node.color}
          strokeWidth={1.6}
        >
          <animate attributeName="opacity" values="0.8;0.25;0.8" dur="1.4s" repeatCount="indefinite" />
        </rect>
      )}
      <rect
        x={left}
        y={top}
        width={node.w}
        height={node.h}
        rx={7}
        fill={external ? '#f2f2f2' : 'white'}
        stroke={emphasized ? node.color : external ? '#9e9e9e' : '#bbb'}
        strokeWidth={emphasized ? 1.8 : 1.1}
        strokeDasharray={external ? '5,4' : undefined}
      />
      {/* Colored primitive stripe (modules/crates only, not external processes) */}
      {!external && (
        <rect x={left} y={top} width={5} height={node.h} rx={2} fill={node.color} />
      )}
      <text
        x={node.x + 3}
        y={node.y - (node.sublabel ? 7 : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={external ? '#555' : 'black'}
        fontSize={12.5}
        fontFamily="monospace"
        fontWeight={700}
      >
        {node.label}
      </text>
      {node.sublabel && (
        <text
          x={node.x + 3}
          y={node.y + 9}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#767676"
          fontSize={8}
          fontFamily="monospace"
        >
          {node.sublabel}
        </text>
      )}
    </g>
  );
}

export default function ConstantinopleValidatorVisualization({ mousePos }) {
  const { index: autoIndex, progress } = useValidatorFlow(STEPS.length);
  const [pinned, setPinned] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);

  const activeIndex = pinned ?? autoIndex;
  const activeStep = STEPS[activeIndex];
  const activeEdges = new Set(activeStep.edges);
  const activeNodes = new Set(activeStep.nodes);

  // Place each edge label on whichever perpendicular side of its line is clear
  // of boxes (falling back to the upper side). Rendered in a layer above the
  // boxes so a label is never occluded by a box its line passes under.
  const LABEL_OFFSET = 12;
  const edgeLabels = EDGES.map((edge) => {
    const { x1, y1, x2, y2 } = edgePoints(edge);
    // Anchor the label at edge.labelPos along the line (default midpoint) so a
    // specific label can be nudged toward an end to clear a nearby box.
    const t = edge.labelPos ?? 0.5;
    const mx = x1 + (x2 - x1) * t;
    const my = y1 + (y2 - y1) * t;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const plen = Math.hypot(dx, dy) || 1;
    const px = -dy / plen;
    const py = dx / plen;
    const candidates = [
      { x: mx + px * LABEL_OFFSET, y: my + py * LABEL_OFFSET },
      { x: mx - px * LABEL_OFFSET, y: my - py * LABEL_OFFSET },
    ];
    const clear = candidates.filter((c) => !labelInsideBox(c.x, c.y));
    const pick = (clear.length ? clear : candidates).sort((a, b) => a.y - b.y)[0];
    return { edge, active: activeEdges.has(edge.id), lx: pick.x, ly: pick.y };
  });

  return (
    <>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="viz-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="valRuntimeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="white" />

        {/* Runtime foundation band */}
        <rect x={0} y={HEIGHT - 34} width={WIDTH} height={34} fill="url(#valRuntimeGrad)" />
        <text
          x={WIDTH / 2}
          y={HEIGHT - 12}
          textAnchor="middle"
          fill="#2E7D32"
          fontSize={11}
          fontFamily="monospace"
          opacity={0.5}
        >
          runtime (tokio async + rayon workers) - storage, networking, telemetry, metrics
        </text>

        {/* Validator process boundary */}
        <rect
          x={BOUNDARY.x}
          y={BOUNDARY.y}
          width={BOUNDARY.w}
          height={BOUNDARY.h}
          rx={6}
          fill="none"
          stroke="#a5a5a5"
          strokeWidth={1.3}
          strokeDasharray="6,3"
        />
        <text
          x={BOUNDARY.x + 12}
          y={BOUNDARY.y + 18}
          fill="black"
          fontSize={13}
          fontFamily="monospace"
          fontWeight={600}
        >
          primary validator process
        </text>

        {/* Engine sub-container */}
        <rect
          x={ENGINE.x}
          y={ENGINE.y}
          width={ENGINE.w}
          height={ENGINE.h}
          rx={5}
          fill="#fafafa"
          stroke="#cfcfcf"
          strokeWidth={1.1}
        />
        <text
          x={ENGINE.x + 10}
          y={ENGINE.y + 16}
          fill="#555"
          fontSize={11}
          fontFamily="monospace"
          fontWeight={600}
        >
          constantinople-engine
        </text>

        {/* Edges */}
        {EDGES.map((edge) => {
          const { x1, y1, x2, y2 } = edgePoints(edge);
          const active = activeEdges.has(edge.id);
          const stroke = edge.context
            ? '#dcdcdc'
            : active
              ? edge.color
              : '#ececec';
          const strokeWidth = active ? 2 : 1;
          const opacity = edge.context ? 0.7 : active ? 0.95 : 0.4;
          return (
            <g key={edge.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeDasharray={edge.dashed ? '5,4' : undefined}
              />
              {active && (
                <circle r={3.6} fill={edge.color} opacity={0.9}>
                  <animateMotion dur="1.3s" repeatCount="indefinite" path={`M${x1},${y1} L${x2},${y2}`} />
                </circle>
              )}
            </g>
          );
        })}

        {/* Boxes */}
        {Object.values(NODES).map((node) => (
          <ValidatorBox
            key={node.id}
            node={node}
            emphasized={activeNodes.has(node.id)}
            dimmed={!activeNodes.has(node.id) && node.kind !== 'context'}
            onHover={setHoverNode}
          />
        ))}

        {/* Active edge labels, drawn above the boxes so they are never hidden */}
        {edgeLabels
          .filter((d) => d.active)
          .map((d) => (
            <text
              key={`label-${d.edge.id}`}
              x={d.lx}
              y={d.ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={d.edge.color}
              fontSize={8.5}
              fontFamily="monospace"
              fontWeight={600}
              stroke="white"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {d.edge.label}
            </text>
          ))}

        {/* Step indicator */}
        <text
          x={WIDTH - 16}
          y={24}
          textAnchor="end"
          fill="gray"
          fontSize={12}
          fontFamily="monospace"
        >
          {activeStep.label.toUpperCase()}
          {pinned !== null ? ' (pinned)' : ''}
        </text>
        <rect x={WIDTH - 176} y={34} width={160} height={3} rx={1} fill="#eee" />
        <rect
          x={WIDTH - 176}
          y={34}
          width={160 * (pinned !== null ? 1 : progress)}
          height={3}
          rx={1}
          fill="#7B1FA2"
        />
      </svg>

      <div className="channel-selectors-row">
        <div className="channel-selector">
          <div className="channel-selector-label">Block Lifecycle</div>
          <div className="channel-selector-buttons">
            {STEPS.map((step, i) => {
              const active = pinned === i;
              return (
                <button
                  key={step.key}
                  type="button"
                  className={`channel-selector-button ${active ? 'channel-selector-button--active' : ''}`}
                  onClick={() => setPinned(pinned === i ? null : i)}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
          <div className="channel-selector-detail">{activeStep.detail}</div>
        </div>
      </div>

      <p className="viz-hint">
        The validator binary is process-level glue: it loads config, starts the runtime, networking, and mempool, then constructs and starts constantinople-engine. Hover a box or pick a lifecycle stage.
      </p>

      <ValidatorTooltip nodeId={hoverNode} position={mousePos} />
    </>
  );
}
