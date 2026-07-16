import { useState } from 'react';
import {
  WIDTH,
  HEIGHT,
  CLUSTER,
  VALIDATORS,
  SPAMMER,
  RELAYER,
  INDEXER_SECONDARY,
  INDEXER,
  EXPLORER,
  SUBMIT_CONNECTION_MODULES,
  RELAY_CONNECTION_MODULES,
  FOLLOW_CONNECTION_MODULES,
  UPLOAD_CONNECTION_MODULES,
  STREAM_CONNECTION_MODULES,
} from '../data/constantinople/layout';
import {
  CONSTANTINOPLE_MODULE_LIST,
  CONSTANTINOPLE_MODULES,
} from '../data/constantinople/modules';
import {
  VOTE_PIPELINE,
  CERT_PIPELINE,
  CERT_REPAIR_PIPELINE,
  SHARD_PIPELINE,
  BACKFILL_PIPELINE,
  STATE_SYNC_PIPELINE,
  TX_SYNC_PIPELINE,
  PROBE_PIPELINE,
  SUBMIT_PIPELINE,
  RELAY_PIPELINE,
  UPLOAD_PIPELINE,
  STREAM_PIPELINE,
  SPAMMER_INTERNAL,
  INDEXER_INTERNAL,
  EXPLORER_INTERNAL,
} from '../data/constantinople/pipelines';
import { useConstantinopleAnimation } from '../hooks/useConstantinopleAnimation';
import ConstantinopleValidatorNode from './nodes/ConstantinopleValidatorNode';
import ConstantinopleServiceNode from './nodes/ConstantinopleServiceNode';
import ConstantinopleP2PMesh from './connections/ConstantinopleP2PMesh';
import HttpConnection from './connections/HttpConnection';
import Legend from './Legend';

const MESH_LANES = [
  {
    key: 'votes',
    label: 'Votes',
    detail: 'Simplex vote traffic on channel 0. Each validator signs its vote with its BLS share.',
    pipeline: VOTE_PIPELINE,
    connectionModules: ['consensus', 'cryptography', 'p2p'],
  },
  {
    key: 'certs',
    label: 'Certs',
    detail: 'Notarization and finalization threshold certificates on channel 1. One BLS12-381 signature certifies the whole set.',
    pipeline: CERT_PIPELINE,
    connectionModules: ['consensus', 'cryptography', 'p2p'],
  },
  {
    key: 'certRepair',
    label: 'Cert Repair',
    detail: 'Simplex backfiller fetching missing notarization/nullification certificates by view on channel 2, so a validator that fell behind can re-enter consensus.',
    pipeline: CERT_REPAIR_PIPELINE,
    connectionModules: ['consensus', 'cryptography', 'resolver', 'p2p'],
  },
  {
    key: 'shards',
    label: 'Marshal Shards',
    detail: 'Erasure-coded block shards on channel 3 (the only channel that carries block bodies during consensus). A threshold of shards reconstructs the full block.',
    pipeline: SHARD_PIPELINE,
    connectionModules: ['marshal', 'p2p'],
  },
  {
    key: 'backfill',
    label: 'Marshal Backfill',
    detail: 'A lagging validator uses channel 4 (marshal\'s resolver) to request whole finalized blocks (or their finalizations) that are missing.',
    pipeline: BACKFILL_PIPELINE,
    connectionModules: ['marshal', 'resolver', 'p2p'],
  },
  {
    key: 'stateSync',
    label: 'State Sync',
    detail: 'QMDB state-sync on channel 5: ranges of state operations, each with a Merkle proof, let a syncing validator rebuild account state without replaying the whole chain.',
    pipeline: STATE_SYNC_PIPELINE,
    connectionModules: ['glue', 'resolver', 'storage', 'p2p'],
  },
  {
    key: 'txSync',
    label: 'Tx Sync',
    detail: 'Transaction-hash sync on channel 6. The transaction DB is compact (it keeps only a verifiable summary of its current contents, not the full operation history), so a syncing validator receives that single authenticated snapshot instead of a replayable stream of operations.',
    pipeline: TX_SYNC_PIPELINE,
    connectionModules: ['glue', 'resolver', 'storage', 'p2p'],
  },
  {
    key: 'probe',
    label: 'Probe',
    detail: 'State-sync probe on channel 7: a validator fans out "send me your latest finalization" and verifies the threshold certificates that come back to pick its state-sync floor at startup (invalid ones get the sender blocked).',
    pipeline: PROBE_PIPELINE,
    connectionModules: ['glue', 'consensus', 'cryptography', 'p2p'],
  },
];

// Pull a connection's endpoints in toward the middle by the given amounts so
// the line runs border-to-border and its pipeline chips sit in the clear gap
// between nodes instead of on top of them.
function insetLine(x1, y1, x2, y2, startInset, endInset) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * startInset,
    y1: y1 + uy * startInset,
    x2: x2 - ux * endInset,
    y2: y2 - uy * endInset,
  };
}

function ConstantinopleTooltip({ info, position }) {
  if (!info) return null;
  const { type, id } = info;
  let title;
  let body;

  if (type === 'validator') {
    title = id;
    body =
      'Validator running the full Constantinople stack: simplex BFT consensus over a fixed epoch-zero set, erasure-coded marshal for block availability, QMDB state and transaction databases, stateful glue managing the speculative database lifecycle and sync, a mempool for transaction intake, authenticated p2p discovery, and resolvers for repair. Each primary fronts its own mempool HTTP listener; a non-voting secondary uploads finalized artifacts to the indexer.';
  } else if (type === 'spammer') {
    title = 'Spammer';
    body =
      'Load generator. Pre-signs deterministic ring-transfer transaction batches with ed25519 and submits them over HTTP (through the relayer/primary mempool), keeping one batch in flight while signing the next to hide latency.';
  } else if (type === 'indexer') {
    title = 'Indexer';
    body =
      'Publishes finalized artifacts to the exoware Store: certified headers, full blocks and certificates (simplex), block/tx/account SQL metadata, and the QMDB account-state and transaction-hash operation logs. A single owning secondary uploads; the explorer reads from here.';
  } else if (type === 'explorer') {
    title = 'Explorer';
    body =
      'Live React block explorer. Subscribes to the indexer SQL block_meta stream (one frame per finalized block), renders a throughput histogram, and verifies submitted-transaction proofs browser-side against QMDB and simplex certificates.';
  } else if (type === 'relayer') {
    title = 'Relayer';
    body =
      'Non-voting secondary validator. Follows consensus to track the current view, forwards each submitted batch to the upcoming leaders\' mempools, retries across views, and serves account reads.';
  } else if (type === 'secondary') {
    title = 'Secondary';
    body =
      'Non-voting secondary validator. Reconstructs and applies every finalized block to its own QMDB, then uploads blocks, certificates, SQL metadata, and QMDB operation logs from its finalized hook via a durable queue.';
  }

  if (!title) return null;

  return (
    <div className="tooltip" style={{ left: position.x + 12, top: position.y - 8 }}>
      <div className="tooltip-title">{title}</div>
      <div className="tooltip-body">{body}</div>
    </div>
  );
}

export default function ConstantinopleChainVisualization({ mousePos }) {
  const { phase, phaseProgress, blockHeight, leader } = useConstantinopleAnimation();

  const [highlightModule, setHighlightModule] = useState(null);
  const [highlightNode, setHighlightNode] = useState(null);
  const [meshLane, setMeshLane] = useState('votes');
  const [tooltip, setTooltip] = useState(null);

  const activeLane = MESH_LANES.find((lane) => lane.key === meshLane);
  // The relayer forwards each batch to the validator about to lead this block.
  const leaderNode = VALIDATORS[leader];
  // The indexer secondary follows the chain; draw its follow link from the
  // nearest diamond vertex (the right one).
  const followSource = VALIDATORS[1];

  // Border-to-border routing so pipeline chips sit in the clear gaps (service
  // boxes 132x84, validators radius ~32). Submit, upload, and stream run
  // vertically inside the flanking columns, so their insets clear the service
  // boxes' half-heights (~42) rather than half-widths.
  const submitLine = insetLine(SPAMMER.x, SPAMMER.y, RELAYER.x, RELAYER.y, 48, 40);
  const relayLine = insetLine(RELAYER.x, RELAYER.y, leaderNode.x, leaderNode.y, 40, 40);
  const followLine = insetLine(followSource.x, followSource.y, INDEXER_SECONDARY.x, INDEXER_SECONDARY.y, 40, 40);
  const uploadLine = insetLine(INDEXER_SECONDARY.x, INDEXER_SECONDARY.y, INDEXER.x, INDEXER.y, 40, 48);
  const streamLine = insetLine(INDEXER.x, INDEXER.y, EXPLORER.x, EXPLORER.y, 48, 48);

  const clusterDimmed =
    highlightNode &&
    highlightNode !== 'spammer' &&
    highlightNode !== 'relayer' &&
    highlightNode !== 'secondary' &&
    highlightNode !== 'indexer' &&
    highlightNode !== 'explorer' &&
    !VALIDATORS.find((v) => v.id === highlightNode);

  return (
    <>
      <Legend
        modules={CONSTANTINOPLE_MODULE_LIST}
        activeModule={highlightModule}
        onSelect={setHighlightModule}
        headerLabel="commonware/constantinople modules"
      />

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="viz-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="constRuntimeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="white"
          onClick={() => setHighlightModule(null)}
        />

        {/* Runtime foundation band */}
        {(() => {
          const rtHighlighted = highlightModule === 'runtime';
          const rtDimmed = highlightModule && highlightModule !== 'runtime';
          return (
            <g
              opacity={rtDimmed ? 0.15 : 1}
              style={{ transition: 'opacity 0.3s' }}
              cursor="pointer"
              onClick={(e) => {
                e.stopPropagation();
                setHighlightModule('runtime');
              }}
            >
              <rect
                x={0}
                y={HEIGHT - 36}
                width={WIDTH}
                height={36}
                fill="url(#constRuntimeGrad)"
              />
              {rtHighlighted && (
                <rect x={0} y={HEIGHT - 36} width={WIDTH} height={36} fill="#2E7D32" opacity={0.08} />
              )}
              <text
                x={WIDTH / 2}
                y={HEIGHT - 13}
                textAnchor="middle"
                fill="#2E7D32"
                fontSize={rtHighlighted ? 13 : 11}
                fontFamily="monospace"
                fontWeight={rtHighlighted ? 700 : 400}
                opacity={rtHighlighted ? 0.9 : 0.45}
              >
                runtime (tokio async foundation + rayon workers)
              </text>
            </g>
          );
        })()}

        {/* Validator cluster outline */}
        {(() => {
          const ow = CLUSTER.width;
          const oh = CLUSTER.height;
          return (
            <g style={{ opacity: clusterDimmed ? 0.3 : 1, transition: 'opacity 0.3s' }}>
              <rect
                x={CLUSTER.cx - ow / 2}
                y={CLUSTER.cy - oh / 2}
                width={ow}
                height={oh}
                rx={4}
                fill="none"
                stroke={highlightModule ? '#d0d0d0' : '#a5a5a5'}
                strokeWidth={1.3}
                strokeDasharray="6,3"
              />
              <text
                x={CLUSTER.cx}
                y={CLUSTER.cy - oh / 2 - 8}
                textAnchor="middle"
                fill="black"
                fontSize={14}
                fontFamily="monospace"
                fontWeight={600}
              >
                {CLUSTER.label}
              </text>
            </g>
          );
        })()}

        {/* Spammer -> relayer (submit a signed batch) */}
        <HttpConnection
          x1={submitLine.x1}
          y1={submitLine.y1}
          x2={submitLine.x2}
          y2={submitLine.y2}
          pipeline={SUBMIT_PIPELINE}
          modules={CONSTANTINOPLE_MODULES}
          connectionModules={SUBMIT_CONNECTION_MODULES}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          sourceId="spammer"
          destId="relayer"
          showPipeline
          showParticle={phase === 'SUBMIT'}
          particleColor="#1565C0"
          onModuleClick={setHighlightModule}
          chipScale={0.95}
        />

        {/* Relayer -> upcoming leader's mempool (forward) */}
        <HttpConnection
          x1={relayLine.x1}
          y1={relayLine.y1}
          x2={relayLine.x2}
          y2={relayLine.y2}
          pipeline={RELAY_PIPELINE}
          modules={CONSTANTINOPLE_MODULES}
          connectionModules={RELAY_CONNECTION_MODULES}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          sourceId="relayer"
          destId={leaderNode.id}
          showPipeline
          showParticle={phase === 'SUBMIT'}
          particleColor="#1565C0"
          onModuleClick={setHighlightModule}
          chipScale={0.95}
        />

        {/* Indexer secondary follows the finalized chain over the mesh */}
        <HttpConnection
          x1={followLine.x1}
          y1={followLine.y1}
          x2={followLine.x2}
          y2={followLine.y2}
          modules={CONSTANTINOPLE_MODULES}
          connectionModules={FOLLOW_CONNECTION_MODULES}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          sourceId={followSource.id}
          destId="secondary"
          showPipeline={false}
          showParticle={phase === 'FINALIZE'}
          particleColor="#E65100"
          onModuleClick={setHighlightModule}
        />

        {/* Indexer secondary -> indexer (finalized artifact upload) */}
        <HttpConnection
          x1={uploadLine.x1}
          y1={uploadLine.y1}
          x2={uploadLine.x2}
          y2={uploadLine.y2}
          pipeline={UPLOAD_PIPELINE}
          modules={CONSTANTINOPLE_MODULES}
          connectionModules={UPLOAD_CONNECTION_MODULES}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          sourceId="secondary"
          destId="indexer"
          showPipeline
          showParticle={phase === 'INDEX'}
          particleColor="#546E7A"
          onModuleClick={setHighlightModule}
          chipScale={0.95}
        />

        {/* Indexer -> explorer (SQL metadata stream) */}
        <HttpConnection
          x1={streamLine.x1}
          y1={streamLine.y1}
          x2={streamLine.x2}
          y2={streamLine.y2}
          pipeline={STREAM_PIPELINE}
          modules={CONSTANTINOPLE_MODULES}
          connectionModules={STREAM_CONNECTION_MODULES}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          sourceId="indexer"
          destId="explorer"
          showPipeline
          showParticle={phase === 'STREAM'}
          particleColor="#2E7D32"
          onModuleClick={setHighlightModule}
          chipScale={0.95}
        />

        {/* Validator P2P mesh */}
        <ConstantinopleP2PMesh
          validators={VALIDATORS}
          pipeline={activeLane?.pipeline}
          connectionModules={activeLane?.connectionModules}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          phase={phase}
          leader={leader}
          onModuleClick={setHighlightModule}
          chipScale={1.05}
        />

        {/* Validator nodes */}
        {VALIDATORS.map((v, i) => (
          <ConstantinopleValidatorNode
            key={v.id}
            validator={v}
            isLeader={i === leader && (phase === 'IDLE' || phase === 'SUBMIT' || phase === 'PROPOSE')}
            pulsing={phase === 'COMMIT' || (phase === 'VALIDATE' && i !== leader)}
            highlighted={highlightNode === v.id}
            dimmed={highlightNode && highlightNode !== v.id}
            highlightModule={highlightModule}
            onModuleClick={setHighlightModule}
            onClick={(e) => e.stopPropagation()}
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

        {/* Spammer */}
        <ConstantinopleServiceNode
          x={SPAMMER.x}
          y={SPAMMER.y}
          label="Spammer"
          sublabel="load generator"
          internal={SPAMMER_INTERNAL}
          shape="rect"
          pulsing={phase === 'SUBMIT'}
          pulseColor="#1565C0"
          highlighted={highlightNode === 'spammer'}
          dimmed={highlightNode && highlightNode !== 'spammer'}
          highlightModule={highlightModule}
          onModuleClick={setHighlightModule}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            setHighlightNode('spammer');
            setTooltip({ type: 'spammer' });
          }}
          onMouseLeave={() => {
            setHighlightNode(null);
            setTooltip(null);
          }}
        />

        {/* Relayer (non-voting secondary validator) */}
        <ConstantinopleValidatorNode
          validator={{ x: RELAYER.x, y: RELAYER.y, label: 'Relayer' }}
          secondary
          pulsing={phase === 'SUBMIT'}
          pulseColor="#1565C0"
          highlighted={highlightNode === 'relayer'}
          dimmed={highlightNode && highlightNode !== 'relayer'}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            setHighlightNode('relayer');
            setTooltip({ type: 'relayer' });
          }}
          onMouseLeave={() => {
            setHighlightNode(null);
            setTooltip(null);
          }}
        />

        {/* Indexer secondary (non-voting secondary validator) */}
        <ConstantinopleValidatorNode
          validator={{ x: INDEXER_SECONDARY.x, y: INDEXER_SECONDARY.y, label: 'Secondary' }}
          secondary
          pulsing={phase === 'FINALIZE' || phase === 'INDEX'}
          pulseColor="#546E7A"
          highlighted={highlightNode === 'secondary'}
          dimmed={highlightNode && highlightNode !== 'secondary'}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            setHighlightNode('secondary');
            setTooltip({ type: 'secondary' });
          }}
          onMouseLeave={() => {
            setHighlightNode(null);
            setTooltip(null);
          }}
        />

        {/* Indexer */}
        <ConstantinopleServiceNode
          x={INDEXER.x}
          y={INDEXER.y}
          label="Indexer"
          sublabel="exoware store"
          internal={INDEXER_INTERNAL}
          shape="hex"
          pulsing={phase === 'INDEX'}
          pulseColor="#546E7A"
          highlighted={highlightNode === 'indexer'}
          dimmed={highlightNode && highlightNode !== 'indexer'}
          highlightModule={highlightModule}
          onModuleClick={setHighlightModule}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            setHighlightNode('indexer');
            setTooltip({ type: 'indexer' });
          }}
          onMouseLeave={() => {
            setHighlightNode(null);
            setTooltip(null);
          }}
        />

        {/* Explorer */}
        <ConstantinopleServiceNode
          x={EXPLORER.x}
          y={EXPLORER.y}
          label="Explorer"
          sublabel="live block UI"
          internal={EXPLORER_INTERNAL}
          shape="dashed"
          pulsing={phase === 'STREAM'}
          pulseColor="#2E7D32"
          highlighted={highlightNode === 'explorer'}
          dimmed={highlightNode && highlightNode !== 'explorer'}
          highlightModule={highlightModule}
          onModuleClick={setHighlightModule}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            setHighlightNode('explorer');
            setTooltip({ type: 'explorer' });
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
          fontSize={12}
          fontFamily="monospace"
        >
          {phase} (block #{blockHeight})
        </text>
        <rect x={WIDTH - 176} y={34} width={160} height={3} rx={1} fill="#eee" />
        <rect
          x={WIDTH - 176}
          y={34}
          width={160 * phaseProgress}
          height={3}
          rx={1}
          fill="#7B1FA2"
        />

        {/* Threshold flash on notarization / finalization */}
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
            <animate attributeName="opacity" values="0;0.08;0" dur="0.6s" repeatCount="1" />
          </rect>
        )}
      </svg>

      <div className="channel-selectors-row">
        <div className="channel-selector">
          <div className="channel-selector-label">Validator P2P Channels</div>
          <div className="channel-selector-buttons">
            {MESH_LANES.map((lane) => {
              const active = lane.key === meshLane;
              return (
                <button
                  key={lane.key}
                  type="button"
                  className={`channel-selector-button ${active ? 'channel-selector-button--active' : ''}`}
                  onClick={() => setMeshLane(lane.key)}
                >
                  {lane.label}
                </button>
              );
            })}
          </div>
          <div className="channel-selector-detail">{activeLane?.detail}</div>
        </div>
      </div>

      <p className="viz-hint">
        Watch one block flow from transaction submission to the live explorer. Click a node, module, or mesh lane to learn more.
      </p>

      <ConstantinopleTooltip info={tooltip} position={mousePos} />
    </>
  );
}
