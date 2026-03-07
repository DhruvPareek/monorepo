import { useState, useCallback, useEffect } from 'react';
import {
  WIDTH,
  HEIGHT,
  CLUSTER,
  VALIDATORS,
  INDEXER,
  FOLLOWER,
  HTTP_PUSH_MODULES,
  SYNC_CONNECTION_MODULES,
} from '../data/alto/layout';
import { ALTO_MODULE_LIST, ALTO_MODULES } from '../data/alto/modules';
import {
  HTTP_PUSH_PIPELINE,
  SYNC_PIPELINE,
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
      'Validator node running Simplex BFT. Internal: consensus (simplex engine), storage (finalized chain archive), broadcast (message buffer), parallel (BLS thread pool verification), resolver (P2P block backfill). Communicates via authenticated P2P mesh.';
  } else if (type === 'indexer') {
    title = 'Indexer';
    body =
      'In-memory HTTP/WebSocket server. Receives blocks and certificates from validators via HTTP POST. Serves data to followers and clients. Internal: parallel (Sequential BLS verification), runtime (async HTTP server).';
  } else if (type === 'follower') {
    title = 'Follower';
    body =
      'Non-voting full node. Syncs finalized chain from indexer via WebSocket (real-time) and HTTP (backfill). Internal: storage (local chain archive), parallel (BLS verification), resolver (HTTP-based backfill), runtime (async executor).';
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

  const modalNodeX = 210;
  const modalNodeY = 130;

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
          viewBox="0 0 420 300"
          className="node-modal-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x={0}
            y={0}
            width={420}
            height={300}
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

  const [highlightModule, setHighlightModule] = useState(null);
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
                y={HEIGHT - 56}
                width={WIDTH}
                height={56}
                fill="url(#altoRuntimeGrad)"
                opacity={rtHighlighted ? 3 : 1}
              />
              {rtHighlighted && (
                <rect
                  x={0}
                  y={HEIGHT - 56}
                  width={WIDTH}
                  height={56}
                  fill="#2E7D32"
                  opacity={0.08}
                />
              )}
              <text
                x={WIDTH / 2}
                y={HEIGHT - 17}
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
            chipScale={1.2}
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
          chipScale={1.2}
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

      <p className="viz-hint">
        Click on a validator, indexer, follower, or colored module to learn more
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
