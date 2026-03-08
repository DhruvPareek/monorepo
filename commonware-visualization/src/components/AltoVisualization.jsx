import { useState, useCallback, useEffect } from 'react';
import {
  WIDTH,
  HEIGHT,
  CLUSTER,
  VALIDATORS,
  INDEXER_UPLOADERS,
  INDEXER,
  FOLLOWER,
  UPLOAD_CONNECTION_MODULES,
  WS_CONNECTION_MODULES,
  HTTP_REPAIR_CONNECTION_MODULES,
} from '../data/alto/layout';
import { ALTO_MODULE_LIST, ALTO_MODULES } from '../data/alto/modules';
import {
  ARTIFACT_UPLOAD_PIPELINE,
  WS_STREAM_PIPELINE,
  HTTP_REPAIR_REQUEST_PIPELINE,
  HTTP_REPAIR_RESPONSE_PIPELINE,
  CHECKPOINT_REQUEST_PIPELINE,
  CHECKPOINT_RESPONSE_PIPELINE,
  HEALTH_PIPELINE,
  VALIDATOR_VOTE_PIPELINE,
  VALIDATOR_CERT_PIPELINE,
  VALIDATOR_CERT_REPAIR_PIPELINE,
  VALIDATOR_BLOCK_PIPELINE,
  VALIDATOR_MARSHAL_PIPELINE,
  VALIDATOR_INTERNAL,
  INDEXER_INTERNAL,
  FOLLOWER_INTERNAL,
} from '../data/alto/pipelines';
import { useAltoAnimation } from '../hooks/useAltoAnimation';
import AltoValidatorNode from './nodes/AltoValidatorNode';
import AltoIndexerNode from './nodes/AltoIndexerNode';
import FollowerNode from './nodes/FollowerNode';
import AltoP2PMesh from './connections/AltoP2PMesh';
import HttpConnection from './connections/HttpConnection';
import Legend from './Legend';

const FOLLOWER_CHANNEL_MODES = [
  {
    key: 'live',
    label: 'Live Stream',
    detail: 'Indexer pushes Seed, Notarization, and Finalization over WebSocket.',
  },
  {
    key: 'repair',
    label: 'Repair',
    detail: 'Marshal-driven repair/backfill over HTTP GET, shown as request and payload response.',
  },
  {
    key: 'checkpoint',
    label: 'Checkpoint',
    detail: 'Optional startup fetch of GET /finalization/latest before following near tip.',
  },
  {
    key: 'health',
    label: 'Health',
    detail: 'Direct GET /health probe before follower startup proceeds.',
  },
];

const VALIDATOR_CHANNEL_MODES = [
  {
    key: 'votes',
    label: 'Votes',
    detail: 'Simplex vote traffic over validator channel 0 on the shared authenticated mesh.',
    pipeline: VALIDATOR_VOTE_PIPELINE,
    connectionModules: ['consensus', 'cryptography', 'p2p'],
  },
  {
    key: 'certs',
    label: 'Certs',
    detail: 'Simplex certificate traffic over validator channel 1 on the shared authenticated mesh.',
    pipeline: VALIDATOR_CERT_PIPELINE,
    connectionModules: ['consensus', 'cryptography', 'p2p'],
  },
  {
    key: 'certRepair',
    label: 'Cert Repair',
    detail: 'Simplex resolver traffic for missing certificates by view over validator channel 2.',
    pipeline: VALIDATOR_CERT_REPAIR_PIPELINE,
    connectionModules: ['resolver', 'cryptography', 'p2p'],
  },
  {
    key: 'blocks',
    label: 'Blocks',
    detail: 'Full block dissemination over the broadcast lane on validator channel 3.',
    pipeline: VALIDATOR_BLOCK_PIPELINE,
    connectionModules: ['broadcast', 'cryptography', 'p2p'],
  },
  {
    key: 'marshal',
    label: 'Marshal',
    detail: 'Marshal ingestion and block-oriented backfill over validator channel 4.',
    pipeline: VALIDATOR_MARSHAL_PIPELINE,
    connectionModules: ['consensus', 'resolver', 'cryptography', 'p2p'],
  },
];

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
    body =
      'Validator node running Simplex BFT. Internal: consensus (simplex plus marshal submodules), storage (finalized archives), broadcast (full block dissemination), p2p (authenticated mesh), resolver (certificate and block repair), and runtime (executor, I/O, and task orchestration). Communicates over five authenticated validator lanes and may publish artifacts to the indexer when configured.';
  } else if (type === 'indexer') {
    title = 'Indexer';
    body =
      'In-memory artifact bridge. Accepts Seed, Notarized, and Finalized uploads from configured validators, verifies them against the network identity, stores them in memory, serves HTTP lookups, and re-broadcasts accepted artifacts over /consensus/ws. Internal: codec, cryptography, parallel.';
  } else if (type === 'follower') {
    title = 'Follower';
    body =
      'Non-voting finalized-chain replica centered on commonware-consensus marshal. Consumes Seed, Notarization, and Finalization events over WebSocket, verifies chain artifacts with cryptography, performs HTTP repair/checkpoint fetches via resolver, persists finalized archives, keeps a noop broadcast buffer for marshal compatibility, and uses runtime for executor, storage, and task orchestration.';
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

function AltoNodeDetailModal({
  kind,
  label,
  highlightModule,
  onModuleClick,
  onClose,
}) {
  if (!kind) return null;

  const internalModules = (
    kind === 'validator'
      ? VALIDATOR_INTERNAL
      : kind === 'indexer'
        ? INDEXER_INTERNAL
        : FOLLOWER_INTERNAL
  ).map((item) => item.module);

  const selectedModule =
    highlightModule && internalModules.includes(highlightModule)
      ? highlightModule
      : null;
  const selectedDetails = selectedModule ? ALTO_MODULES[selectedModule] : null;

  const subtitle = selectedDetails ? (
    <>
      <strong>{selectedDetails.name}:</strong> {selectedDetails.detail}
    </>
  ) : (
    'Select an internal module chip to view what it does in this node and highlight it across the Alto diagram.'
  );

  const modalNodeX = 230;
  const modalNodeY = 165;

  return (
    <div className="node-modal-backdrop" onClick={onClose}>
      <div className="node-modal" onClick={(e) => e.stopPropagation()}>
        <div className="node-modal-header">
          <h2 className="node-modal-title">
            {kind === 'validator'
              ? `${label} internals`
              : kind === 'indexer'
                ? 'INDEXER internals'
                : 'FOLLOWER internals'}
          </h2>
          <button type="button" className="node-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="node-modal-subtitle">{subtitle}</p>
        <svg
          viewBox="0 0 460 330"
          className="node-modal-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x={0}
            y={0}
            width={460}
            height={330}
            fill="white"
            onClick={() => onModuleClick?.(null)}
          />
          {kind === 'validator' && (
            <AltoValidatorNode
              validator={{
                id: 'modal-validator',
                x: modalNodeX,
                y: modalNodeY,
                label,
              }}
              isLeader={false}
              highlighted
              dimmed={false}
              highlightModule={highlightModule}
              onModuleClick={onModuleClick}
              onClick={() => onModuleClick?.(null)}
              variant="expanded"
            />
          )}
          {kind === 'indexer' && (
            <AltoIndexerNode
              x={modalNodeX}
              y={modalNodeY}
              highlighted
              dimmed={false}
              highlightModule={highlightModule}
              onModuleClick={onModuleClick}
              pulsing={false}
              variant="expanded"
            />
          )}
          {kind === 'follower' && (
            <FollowerNode
              x={modalNodeX}
              y={modalNodeY}
              highlighted
              dimmed={false}
              highlightModule={highlightModule}
              onModuleClick={onModuleClick}
              pulsing={false}
              variant="expanded"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export default function AltoVisualization() {
  const { phase, phaseProgress, blockHeight, leader } = useAltoAnimation();
  const uploaderValidators = VALIDATORS.filter((v) =>
    INDEXER_UPLOADERS.includes(v.id)
  );

  const [highlightModule, setHighlightModule] = useState(null);
  const [validatorChannelMode, setValidatorChannelMode] = useState('votes');
  const [followerChannelMode, setFollowerChannelMode] = useState('live');
  const [highlightNode, setHighlightNode] = useState(null);
  const [expandedNode, setExpandedNode] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!expandedNode) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') setExpandedNode(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expandedNode]);

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleStageHover = useCallback((stage) => {
    if (stage) {
      setTooltip({
        type: 'module',
        moduleKey: stage.module,
        pipelineLabel: stage.label,
      });
    } else {
      setTooltip(null);
    }
  }, []);

  const activeFollowerMode = FOLLOWER_CHANNEL_MODES.find(
    (mode) => mode.key === followerChannelMode
  );
  const activeValidatorMode = VALIDATOR_CHANNEL_MODES.find(
    (mode) => mode.key === validatorChannelMode
  );

  return (
    <div
      className="viz-container"
      onMouseMove={handleMouseMove}
      onClick={() => setHighlightModule(null)}
    >
      <div className="viz-header">
        <h1 className="viz-title">
          <a
            href="https://github.com/commonwarexyz/alto"
            target="_blank"
            rel="noopener noreferrer"
          >
            Alto
          </a>
        </h1>
        <p className="viz-subtitle">
          A minimal, high-performance blockchain built on the Commonware
          Library.
        </p>
      </div>

      <Legend
        modules={ALTO_MODULE_LIST}
        activeModule={highlightModule}
        onSelect={setHighlightModule}
      />

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="viz-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="altoRuntimeGrad"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
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
            <g
              opacity={rtDimmed ? 0.15 : 1}
              style={{ transition: 'opacity 0.3s' }}
              cursor="pointer"
              onClick={(e) => {
                e.stopPropagation();
                setHighlightModule('runtime');
              }}
              onMouseEnter={() =>
                setTooltip({
                  type: 'module',
                  moduleKey: 'runtime',
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <rect
                x={0}
                y={HEIGHT - 36}
                width={WIDTH}
                height={36}
                fill="url(#altoRuntimeGrad)"
                opacity={rtHighlighted ? 3 : 1}
              />
              {rtHighlighted && (
                <rect
                  x={0}
                  y={HEIGHT - 36}
                  width={WIDTH}
                  height={36}
                  fill="#2E7D32"
                  opacity={0.08}
                />
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
                runtime (async foundation)
              </text>
            </g>
          );
        })()}

        {/* Validator cluster */}
        {(() => {
          const clusterOutlineInset = 70;
          const clusterOutlineWidth = CLUSTER.width - clusterOutlineInset;
          const clusterOutlineHeight = CLUSTER.height - clusterOutlineInset;
          const dimmed =
            highlightNode &&
            highlightNode !== 'indexer' &&
            highlightNode !== 'follower' &&
            !VALIDATORS.find((v) => v.id === highlightNode);
          return (
            <g
              style={{
                opacity: dimmed ? 0.3 : 1,
                transition: 'opacity 0.3s',
              }}
            >
              <rect
                x={CLUSTER.cx - clusterOutlineWidth / 2}
                y={CLUSTER.cy - clusterOutlineHeight / 2}
                width={clusterOutlineWidth}
                height={clusterOutlineHeight}
                rx={4}
                fill="none"
                stroke={highlightModule ? '#d0d0d0' : '#a5a5a5'}
                strokeWidth={1.3}
                strokeDasharray="6,3"
              />
              <text
                x={CLUSTER.cx}
                y={CLUSTER.cy - clusterOutlineHeight / 2 - 8}
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
                y={CLUSTER.cy + clusterOutlineHeight / 2 + 18}
                textAnchor="middle"
                fill={highlightModule ? '#999' : '#767676'}
                fontSize={10}
                fontFamily="monospace"
              >
                5 lanes over shared mesh: votes, certs, cert repair, blocks, marshal
              </text>
            </g>
          );
        })()}

        {/* Artifact publication from configured validators to indexer */}
        {uploaderValidators.map((v, i) => (
          <HttpConnection
            key={`http-${v.id}`}
            x1={v.x}
            y1={v.y}
            x2={INDEXER.x}
            y2={INDEXER.y}
            pipeline={ARTIFACT_UPLOAD_PIPELINE}
            connectionModules={UPLOAD_CONNECTION_MODULES}
            highlightModule={highlightModule}
            highlightNode={highlightNode}
            sourceId={v.id}
            destId="indexer"
            showPipeline={true}
            showParticle={phase === 'PUSH'}
            particleColor="#546E7A"
            onStageHover={handleStageHover}
            onModuleClick={setHighlightModule}
            chipScale={1.1}
          />
        ))}

        {followerChannelMode === 'live' && (
          <HttpConnection
            x1={INDEXER.x}
            y1={INDEXER.y + 10}
            x2={FOLLOWER.x}
            y2={FOLLOWER.y - 10}
            pipeline={WS_STREAM_PIPELINE}
            connectionModules={WS_CONNECTION_MODULES}
            highlightModule={highlightModule}
            highlightNode={highlightNode}
            sourceId="indexer"
            destId="follower"
            showPipeline={true}
            showParticle={true}
            particleColor="#2E7D32"
            onStageHover={handleStageHover}
            onModuleClick={setHighlightModule}
            chipScale={1.1}
          />
        )}

        {followerChannelMode === 'repair' && (
          <>
            <HttpConnection
              x1={FOLLOWER.x - 25}
              y1={FOLLOWER.y - 28}
              x2={INDEXER.x - 25}
              y2={INDEXER.y - 4}
              pipeline={HTTP_REPAIR_REQUEST_PIPELINE}
              connectionModules={HTTP_REPAIR_CONNECTION_MODULES}
              highlightModule={highlightModule}
              highlightNode={highlightNode}
              sourceId="follower"
              destId="indexer"
              showPipeline={true}
              showParticle={true}
              particleColor="#6A1B9A"
              onStageHover={handleStageHover}
              onModuleClick={setHighlightModule}
              chipScale={1.1}
            />
            <HttpConnection
              x1={INDEXER.x + 25}
              y1={INDEXER.y + 24}
              x2={FOLLOWER.x + 25}
              y2={FOLLOWER.y}
              pipeline={HTTP_REPAIR_RESPONSE_PIPELINE}
              connectionModules={HTTP_REPAIR_CONNECTION_MODULES}
              highlightModule={highlightModule}
              highlightNode={highlightNode}
              sourceId="indexer"
              destId="follower"
              showPipeline={true}
              showParticle={true}
              particleColor="#455A64"
              onStageHover={handleStageHover}
              onModuleClick={setHighlightModule}
              chipScale={1.1}
            />
          </>
        )}

        {followerChannelMode === 'checkpoint' && (
          <>
            <HttpConnection
              x1={FOLLOWER.x - 25}
              y1={FOLLOWER.y - 26}
              x2={INDEXER.x - 25}
              y2={INDEXER.y - 8}
              pipeline={CHECKPOINT_REQUEST_PIPELINE}
              connectionModules={[]}
              highlightModule={highlightModule}
              highlightNode={highlightNode}
              sourceId="follower"
              destId="indexer"
              showPipeline={true}
              showParticle={true}
              particleColor="#546E7A"
              onStageHover={handleStageHover}
              onModuleClick={setHighlightModule}
              chipScale={1.02}
            />
            <HttpConnection
              x1={INDEXER.x + 25}
              y1={INDEXER.y + 22}
              x2={FOLLOWER.x + 25}
              y2={FOLLOWER.y + 4}
              pipeline={CHECKPOINT_RESPONSE_PIPELINE}
              connectionModules={WS_CONNECTION_MODULES}
              highlightModule={highlightModule}
              highlightNode={highlightNode}
              sourceId="indexer"
              destId="follower"
              showPipeline={true}
              showParticle={true}
              particleColor="#455A64"
              onStageHover={handleStageHover}
              onModuleClick={setHighlightModule}
              chipScale={1.02}
            />
          </>
        )}

        {followerChannelMode === 'health' && (
          <HttpConnection
            x1={FOLLOWER.x + 6}
            y1={FOLLOWER.y - 6}
            x2={INDEXER.x + 6}
            y2={INDEXER.y + 6}
            pipeline={HEALTH_PIPELINE}
            connectionModules={[]}
            highlightModule={highlightModule}
            highlightNode={highlightNode}
            sourceId="follower"
            destId="indexer"
            showPipeline={true}
            showParticle={true}
            particleColor="#90A4AE"
            onStageHover={handleStageHover}
            onModuleClick={setHighlightModule}
            chipScale={1.08}
          />
        )}

        {/* P2P mesh */}
        <AltoP2PMesh
          validators={VALIDATORS}
          pipeline={activeValidatorMode?.pipeline}
          connectionModules={activeValidatorMode?.connectionModules}
          channelKey={activeValidatorMode?.key}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          phase={phase}
          leader={leader}
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
          chipScale={1.2}
        />

        {/* Validator nodes */}
        {VALIDATORS.map((v, i) => (
          <AltoValidatorNode
            key={v.id}
            validator={v}
            isLeader={
              i === leader && (phase === 'IDLE' || phase === 'PROPOSE')
            }
            highlighted={highlightNode === v.id}
            dimmed={highlightNode && highlightNode !== v.id}
            highlightModule={highlightModule}
            onModuleClick={setHighlightModule}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedNode({ kind: 'validator', label: v.label });
            }}
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
          onClick={(e) => {
            e.stopPropagation();
            setExpandedNode({ kind: 'indexer', label: 'INDEXER' });
          }}
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
          onClick={(e) => {
            e.stopPropagation();
            setExpandedNode({ kind: 'follower', label: 'FOLLOWER' });
          }}
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
          fontSize={12}
          fontFamily="monospace"
        >
          {phase} (block #{blockHeight})
        </text>
        <rect
          x={WIDTH - 176}
          y={34}
          width={160}
          height={3}
          rx={1}
          fill="#eee"
        />
        <rect
          x={WIDTH - 176}
          y={34}
          width={160 * phaseProgress}
          height={3}
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

      <div className="channel-selectors-row" onClick={(e) => e.stopPropagation()}>
        <div className="channel-selector">
          <div className="channel-selector-label">Validator Mesh Lanes</div>
          <div className="channel-selector-buttons">
            {VALIDATOR_CHANNEL_MODES.map((mode) => {
              const active = mode.key === validatorChannelMode;
              return (
                <button
                  key={mode.key}
                  type="button"
                  className={`channel-selector-button ${active ? 'channel-selector-button--active' : ''}`}
                  onClick={() => setValidatorChannelMode(mode.key)}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <div className="channel-selector-detail">
            {activeValidatorMode?.detail}
          </div>
        </div>
        <div className="channel-selector">
          <div className="channel-selector-label">
            Follower / Indexer Channels
          </div>
          <div className="channel-selector-buttons">
            {FOLLOWER_CHANNEL_MODES.map((mode) => {
              const active = mode.key === followerChannelMode;
              return (
                <button
                  key={mode.key}
                  type="button"
                  className={`channel-selector-button ${active ? 'channel-selector-button--active' : ''}`}
                  onClick={() => setFollowerChannelMode(mode.key)}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <div className="channel-selector-detail">
            {activeFollowerMode?.detail}
          </div>
        </div>
      </div>

      <p className="viz-hint">
        Click a node, module, or channel mode to learn more.
      </p>

      <AltoTooltip info={tooltip} position={mousePos} />
      <AltoNodeDetailModal
        kind={expandedNode?.kind}
        label={expandedNode?.label}
        highlightModule={highlightModule}
        onModuleClick={setHighlightModule}
        onClose={() => setExpandedNode(null)}
      />

      <div className="viz-footer">
        <a href="https://github.com/commonwarexyz/alto">GitHub</a>
        <a href="https://commonware.xyz">commonware.xyz</a>
      </div>
    </div>
  );
}
