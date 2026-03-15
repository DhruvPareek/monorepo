import { useState, useCallback } from 'react';
import { WIDTH, HEIGHT, SERVER, CLIENT, CONNECTION_MODULES } from '../data/sync/layout';
import { SYNC_MODULE_LIST, SYNC_MODULES } from '../data/sync/modules';
import { SYNC_PIPELINE } from '../data/sync/pipelines';
import { useSyncAnimation } from '../hooks/useSyncAnimation';
import ConnectionPipeline from './connections/ConnectionPipeline';
import ServerNode from './nodes/ServerNode';
import ClientNode from './nodes/ClientNode';
import Legend from './Legend';

export default function SyncVisualization() {
  const {
    serverOps,
    clientOps,
    serverAnimatingOps,
    clientAnimatingOps,
    syncPhase,
    syncPhaseProgress,
    phase,
    phaseProgress,
  } = useSyncAnimation();

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

  // Particles based on sync phase
  const showRequest = syncPhase === 'GET_TARGET' || syncPhase === 'FETCH_OPS';
  const showResponse = syncPhase === 'FETCH_OPS';

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
            <g
              opacity={rtDimmed ? 0.15 : 1}
              style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                setHighlightModule('runtime');
              }}
            >
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
          stroke={dimLine ? '#f0f0f0' : '#b8b8b8'}
          strokeWidth={dimLine ? 0.7 : 1}
          opacity={dimLine ? 0.45 : 0.68}
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
          onModuleClick={setHighlightModule}
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
        {syncPhase === 'VERIFY' && (
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
          onModuleClick={setHighlightModule}
          phase={phase}
          opCount={serverOps}
          animatingOps={serverAnimatingOps}
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
          onModuleClick={setHighlightModule}
          phase={phase}
          opCount={clientOps}
          animatingOps={clientAnimatingOps}
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

      <p className="viz-hint">Click on the server, client, or a colored module to learn more</p>

      <SyncTooltip info={tooltip} position={mousePos} />

      <div className="viz-footer">
        <a href="https://github.com/DhruvPareek/monorepo/tree/feat/visualization-work/commonware-visualization">GitHub</a>
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
