import { useState, useCallback } from 'react';
import {
  WIDTH,
  HEIGHT,
  CLUSTER,
  VALIDATORS,
  PRIMARY_VALIDATOR,
  INDEXER_UPLOADER,
  SPAMMER,
  INDEXER,
  EXPLORER,
  SUBMIT_CONNECTION_MODULES,
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
  DB_SYNC_PIPELINE,
  SUBMIT_PIPELINE,
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
    detail: 'Simplex resolver fetching missing certificates by view on channel 2.',
    pipeline: CERT_REPAIR_PIPELINE,
    connectionModules: ['resolver', 'p2p'],
  },
  {
    key: 'shards',
    label: 'Marshal Shards',
    detail: 'Erasure-coded block shards on channel 3. Any threshold of shards reconstructs the finalized block body.',
    pipeline: SHARD_PIPELINE,
    connectionModules: ['marshal', 'p2p'],
  },
  {
    key: 'backfill',
    label: 'Marshal Backfill',
    detail: 'Marshal resolver requesting whole finalized blocks a validator is missing on channel 4.',
    pipeline: BACKFILL_PIPELINE,
    connectionModules: ['marshal', 'resolver', 'p2p'],
  },
  {
    key: 'dbSync',
    label: 'DB Sync',
    detail: 'QMDB state-sync (channel 5) and transaction-history sync (channel 6) used by recovering validators to reach a finalization floor.',
    pipeline: DB_SYNC_PIPELINE,
    connectionModules: ['glue', 'storage', 'resolver', 'p2p'],
  },
];

function ConstantinopleTooltip({ info, position }) {
  if (!info) return null;
  const { type, id, moduleKey, pipelineLabel } = info;
  let title;
  let body;

  if (type === 'module' && moduleKey) {
    const mod = CONSTANTINOPLE_MODULES[moduleKey];
    title = mod?.name;
    body = pipelineLabel ? `${pipelineLabel}: ${mod?.detail}` : mod?.detail;
  } else if (type === 'validator') {
    title = id === PRIMARY_VALIDATOR ? `${id} (primary)` : id;
    body =
      'Validator running the full Constantinople stack: simplex BFT consensus over a fixed epoch-zero set, erasure-coded marshal for block availability, QMDB state and transaction databases, stateful glue managing the speculative database lifecycle and sync, a mempool for transaction intake, authenticated p2p discovery, and resolvers for repair. The primary fronts the mempool HTTP listener; a secondary uploads finalized artifacts to the indexer.';
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

  const handleStageHover = useCallback((stage) => {
    if (stage) {
      setTooltip({ type: 'module', moduleKey: stage.module, pipelineLabel: stage.label });
    } else {
      setTooltip(null);
    }
  }, []);

  const activeLane = MESH_LANES.find((lane) => lane.key === meshLane);
  const primary = VALIDATORS.find((v) => v.id === PRIMARY_VALIDATOR);
  const uploader = VALIDATORS.find((v) => v.id === INDEXER_UPLOADER);

  const clusterDimmed =
    highlightNode &&
    highlightNode !== 'spammer' &&
    highlightNode !== 'indexer' &&
    highlightNode !== 'explorer' &&
    !VALIDATORS.find((v) => v.id === highlightNode);

  return (
    <>
      <Legend
        modules={CONSTANTINOPLE_MODULE_LIST}
        activeModule={highlightModule}
        onSelect={setHighlightModule}
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
              onMouseEnter={() => setTooltip({ type: 'module', moduleKey: 'runtime' })}
              onMouseLeave={() => setTooltip(null)}
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
              <text
                x={CLUSTER.cx}
                y={CLUSTER.cy + oh / 2 + 18}
                textAnchor="middle"
                fill={highlightModule ? '#999' : '#767676'}
                fontSize={10}
                fontFamily="monospace"
              >
                fixed epoch-0 set, BLS threshold simplex over 8 authenticated channels
              </text>
            </g>
          );
        })()}

        {/* Spammer -> primary validator (transaction submission) */}
        <HttpConnection
          x1={SPAMMER.x}
          y1={SPAMMER.y}
          x2={primary.x}
          y2={primary.y}
          pipeline={SUBMIT_PIPELINE}
          modules={CONSTANTINOPLE_MODULES}
          connectionModules={SUBMIT_CONNECTION_MODULES}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          sourceId="spammer"
          destId={PRIMARY_VALIDATOR}
          showPipeline
          showParticle={phase === 'SUBMIT'}
          particleColor="#1565C0"
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
          chipScale={1.05}
        />

        {/* Secondary validator -> indexer (finalized artifact upload) */}
        <HttpConnection
          x1={uploader.x}
          y1={uploader.y}
          x2={INDEXER.x}
          y2={INDEXER.y}
          pipeline={UPLOAD_PIPELINE}
          modules={CONSTANTINOPLE_MODULES}
          connectionModules={UPLOAD_CONNECTION_MODULES}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          sourceId={INDEXER_UPLOADER}
          destId="indexer"
          showPipeline
          showParticle={phase === 'INDEX'}
          particleColor="#546E7A"
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
          chipScale={1.05}
        />

        {/* Indexer -> explorer (SQL metadata stream) */}
        <HttpConnection
          x1={INDEXER.x}
          y1={INDEXER.y + 12}
          x2={EXPLORER.x}
          y2={EXPLORER.y - 12}
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
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
          chipScale={1.05}
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
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
          chipScale={1.05}
        />

        {/* Validator nodes */}
        {VALIDATORS.map((v, i) => (
          <ConstantinopleValidatorNode
            key={v.id}
            validator={v}
            isLeader={i === leader && (phase === 'IDLE' || phase === 'PROPOSE' || phase === 'VOTE')}
            isPrimary={v.id === PRIMARY_VALIDATOR}
            pulsing={phase === 'EXECUTE'}
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
          <div className="channel-selector-label">Validator Mesh Lanes</div>
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
