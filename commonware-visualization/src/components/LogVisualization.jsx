import { useState, useCallback, useEffect } from 'react';
import {
  WIDTH,
  HEIGHT,
  PARTICIPANTS,
  BOOTSTRAPPERS,
} from '../data/log/layout';
import { LOG_MODULE_LIST, LOG_MODULES } from '../data/log/modules';
import {
  VOTE_PIPELINE,
  CERTIFICATE_PIPELINE,
  RESOLVER_PIPELINE,
} from '../data/log/pipelines';
import { useLogAnimation } from '../hooks/useLogAnimation';
import Legend from './Legend';
import LogParticipantNode from './nodes/LogParticipantNode';
import LogMesh from './connections/LogMesh';

const CHANNEL_MODES = [
  {
    key: 'votes',
    label: 'Votes',
    detail:
      'Channel 0 carries Notarize, Nullify, and Finalize votes.',
    pipeline: VOTE_PIPELINE,
    connectionModules: ['consensus', 'cryptography', 'p2p'],
  },
  {
    key: 'certs',
    label: 'Certificates',
    detail:
      'Channel 1 carries Notarization, Nullification, and Finalization certificates once quorum has been assembled.',
    pipeline: CERTIFICATE_PIPELINE,
    connectionModules: ['consensus', 'cryptography', 'p2p'],
  },
  {
    key: 'resolver',
    label: 'Resolver',
    detail:
      'Channel 2 is the consensus catch-up lane for missing certificates by view. It backfills consensus artifacts only, not the original secret messages.',
    pipeline: RESOLVER_PIPELINE,
    connectionModules: ['consensus', 'cryptography', 'p2p'],
  },
];

function LogTooltip({ info, position }) {
  if (!info) return null;

  const { type, id, moduleKey, pipelineLabel } = info;
  let title;
  let body;

  if (type === 'module' && moduleKey) {
    const mod = LOG_MODULES[moduleKey];
    title = mod?.name;
    body = pipelineLabel ? `${pipelineLabel}: ${mod?.detail}` : mod?.detail;
  } else if (type === 'participant') {
    title = id;
    body =
      id === 'P0'
        ? 'Bootstrap participant. It is only special for initial discovery; after the mesh forms, it is a normal validator running the same application actor, Simplex engine, journal, reporter, and local TUI as every other node.'
        : 'Participant node. It derives an Ed25519 identity, joins peer set 0, runs the example application actor plus Simplex voter/batcher/resolver, persists consensus state locally, and may become leader for some views.';
  }

  if (!title) return null;

  return (
    <div className="tooltip" style={{ left: position.x + 12, top: position.y - 8 }}>
      <div className="tooltip-title">{title}</div>
      <div className="tooltip-body">{body}</div>
    </div>
  );
}

function LogParticipantDetailModal({
  participant,
  highlightModule,
  onModuleClick,
  onClose,
}) {
  if (!participant) return null;

  const selectedDetails = highlightModule ? LOG_MODULES[highlightModule] : null;
  const subtitle = selectedDetails ? (
    <>
      <strong>{selectedDetails.name}:</strong> {selectedDetails.detail}
    </>
  ) : (
    <>
      Every participant runs the same binary. The example-specific application
      actor still handles Genesis, Propose, Verify, and Relay, but it is not
      rendered as a Commonware module chip. Select a chip to highlight an
      actual Commonware module across the log diagram.
    </>
  );

  return (
    <div className="node-modal-backdrop" onClick={onClose}>
      <div className="node-modal" onClick={(e) => e.stopPropagation()}>
        <div className="node-modal-header">
          <h2 className="node-modal-title">{participant.label} internals</h2>
          <button type="button" className="node-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="node-modal-subtitle">{subtitle}</p>
        <svg
          viewBox="0 0 500 360"
          className="node-modal-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x={0}
            y={0}
            width={500}
            height={360}
            fill="white"
            onClick={() => onModuleClick?.(null)}
          />
          <LogParticipantNode
            participant={{ ...participant, x: 250, y: 170 }}
            highlighted
            dimmed={false}
            isLeader={false}
            isBootstrapper={BOOTSTRAPPERS.includes(participant.id)}
            highlightModule={highlightModule}
            onModuleClick={onModuleClick}
            variant="expanded"
          />
        </svg>
      </div>
    </div>
  );
}

export default function LogVisualization() {
  const { view, phase, phaseProgress, leaderIndex, repairPeerIndex } =
    useLogAnimation();
  const [channelMode, setChannelMode] = useState('votes');
  const [highlightModule, setHighlightModule] = useState(null);
  const [highlightNode, setHighlightNode] = useState(null);
  const [expandedNode, setExpandedNode] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!expandedNode) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') setExpandedNode(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expandedNode]);

  const handleMouseMove = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMousePos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, []);

  const handleStageHover = useCallback((stage) => {
    if (stage?.module) {
      setTooltip({
        type: 'module',
        moduleKey: stage.module,
        pipelineLabel: stage.label,
      });
    } else {
      setTooltip(null);
    }
  }, []);

  const activeMode = CHANNEL_MODES.find((mode) => mode.key === channelMode);
  const leader = PARTICIPANTS[leaderIndex];
  const repairPeer = PARTICIPANTS[repairPeerIndex];

  return (
    <div
      className="viz-container"
      onMouseMove={handleMouseMove}
      onClick={() => setHighlightModule(null)}
    >
      <div className="viz-header">
        <h1 className="viz-title">
          <a
            href="https://github.com/commonwarexyz/monorepo/tree/main/examples/log"
            target="_blank"
            rel="noopener noreferrer"
          >
            Log
          </a>
        </h1>
        <p className="viz-subtitle">
          An example where four participants agree on an ordered log of
          SHA-256 digests for local 16-byte secrets.
        </p>
      </div>

      <Legend
        modules={LOG_MODULE_LIST}
        activeModule={highlightModule}
        onSelect={setHighlightModule}
      />

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="viz-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logRuntimeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="white" />

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
                y={HEIGHT - 40}
                width={WIDTH}
                height={40}
                fill="url(#logRuntimeGrad)"
                opacity={rtHighlighted ? 3 : 1}
              />
              {rtHighlighted && (
                <rect
                  x={0}
                  y={HEIGHT - 40}
                  width={WIDTH}
                  height={40}
                  fill="#2E7D32"
                  opacity={0.08}
                />
              )}
              <text
                x={WIDTH / 2}
                y={HEIGHT - 14}
                textAnchor="middle"
                fill="#2E7D32"
                fontSize={rtHighlighted ? 12 : 10}
                fontFamily="monospace"
                fontWeight={rtHighlighted ? 700 : 400}
                opacity={rtHighlighted ? 0.9 : 0.45}
              >
                runtime (network + simplex actors + storage + gui task)
              </text>
            </g>
          );
        })()}

        <g
          style={{
            opacity:
              highlightNode &&
              !PARTICIPANTS.find((participant) => participant.id === highlightNode)
                ? 0.3
                : 1,
            transition: 'opacity 0.3s',
          }}
        >
        </g>

        <LogMesh
          participants={PARTICIPANTS}
          modules={LOG_MODULES}
          pipeline={activeMode.pipeline}
          connectionModules={activeMode.connectionModules}
          modeKey={activeMode.key}
          phase={phase}
          leaderId={leader.id}
          repairPeerId={repairPeer.id}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
        />

        {PARTICIPANTS.map((participant) => (
          <LogParticipantNode
            key={participant.id}
            participant={participant}
            highlighted={highlightNode === participant.id}
            dimmed={highlightNode && highlightNode !== participant.id}
            isLeader={leader.id === participant.id}
            isBootstrapper={BOOTSTRAPPERS.includes(participant.id)}
            highlightModule={highlightModule}
            onModuleClick={setHighlightModule}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedNode(participant.id);
            }}
            onMouseEnter={() => {
              setHighlightNode(participant.id);
              setTooltip({ type: 'participant', id: participant.id });
            }}
            onMouseLeave={() => {
              setHighlightNode(null);
              setTooltip(null);
            }}
          />
        ))}

        <text
          x={WIDTH - 18}
          y={24}
          textAnchor="end"
          fill="gray"
          fontSize={10}
          fontFamily="monospace"
        >
          view {view} | leader {leader.label} | {phase}
        </text>
        <rect x={WIDTH - 178} y={34} width={160} height={3} rx={1} fill="#eee" />
        <rect
          x={WIDTH - 178}
          y={34}
          width={160 * phaseProgress}
          height={3}
          rx={1}
          fill="#7B1FA2"
        />
      </svg>

      <div className="channel-selectors-row" onClick={(e) => e.stopPropagation()}>
        <div className="channel-selector">
          <div className="channel-selector-label">Consensus Mesh Lanes</div>
          <div className="channel-selector-buttons">
            {CHANNEL_MODES.map((mode) => {
              const active = mode.key === channelMode;
              return (
                <button
                  key={mode.key}
                  type="button"
                  className={`channel-selector-button ${active ? 'channel-selector-button--active' : ''}`}
                  onClick={() => setChannelMode(mode.key)}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <div className="channel-selector-detail">
            {activeMode.detail}
          </div>
        </div>
      </div>

      <p className="viz-hint">
        Click a participant, module, or lane to learn more.
      </p>

      <LogTooltip info={tooltip} position={mousePos} />
      <LogParticipantDetailModal
        participant={
          PARTICIPANTS.find((participant) => participant.id === expandedNode) ??
          null
        }
        highlightModule={highlightModule}
        onModuleClick={setHighlightModule}
        onClose={() => setExpandedNode(null)}
      />
      <div className="viz-footer">
        <a href="https://github.com/DhruvPareek/monorepo/tree/feat/visualization-work/commonware-visualization">GitHub</a>
        <a href="https://commonware.xyz">commonware.xyz</a>
      </div>
    </div>
  );
}
