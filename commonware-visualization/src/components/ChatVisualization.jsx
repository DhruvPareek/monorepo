import { useCallback, useEffect, useState } from 'react';
import {
  WIDTH,
  HEIGHT,
  FRIEND_CLUSTER,
  FRIENDS,
  BOOTSTRAPPERS,
  OUTSIDER,
  MESH_CONNECTION_MODULES,
} from '../data/chat/layout';
import { CHAT_MODULE_LIST, CHAT_MODULES } from '../data/chat/modules';
import { CHAT_PEER_INTERNAL, P2P_PIPELINE } from '../data/chat/pipelines';
import ChatPeerMesh from './connections/ChatPeerMesh';
import ChatPeerNode from './nodes/ChatPeerNode';
import Legend from './Legend';

function ChatTooltip({ info, position }) {
  if (!info) return null;

  const { type, id, moduleKey, pipelineLabel } = info;
  let title;
  let body;

  if (type === 'module' && moduleKey) {
    const mod = CHAT_MODULES[moduleKey];
    title = mod?.name;
    body = pipelineLabel ? `${pipelineLabel}: ${mod?.detail}` : mod?.detail;
  } else if (type === 'friend') {
    title = id;
    body =
      'Authorized chat participant. Each friend derives an Ed25519 identity, tracks peer set 0, joins the authenticated discovery mesh, and sends or receives channel 0 chat payloads.';
  } else if (type === 'outsider') {
    title = 'F5';
    body =
      'Unauthorized participant. It runs the same chat binary and attempts the same Recipients::All send, but the authorized group does not admit it into their shared mesh.';
  } else if (type === 'peer-set') {
    title = 'Shared friend set';
    body =
      'Discovery only works correctly when all real participants agree on the ordered contents of peer set 0. In chat, that shared set is the out-of-band friend list.';
  } else if (type === 'delivery') {
    title = 'Live delivery only';
    body =
      'Recipients::All resolves to connected authorized peers. Offline friends are skipped, and there is no persistence, retry queue, or global ordering layer above p2p.';
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

function ChatNodeDetailModal({
  peer,
  isBootstrapper,
  highlightModule,
  onModuleClick,
  onClose,
  unauthorized,
}) {
  if (!peer) return null;

  const internalModules = CHAT_PEER_INTERNAL.map((item) => item.module);
  const selectedModule =
    highlightModule && internalModules.includes(highlightModule)
      ? highlightModule
      : null;
  const selectedDetails = selectedModule ? CHAT_MODULES[selectedModule] : null;
  const subtitle = selectedDetails ? (
    <>
      <strong>{selectedDetails.name}:</strong> {selectedDetails.detail}
    </>
  ) : unauthorized ? (
    <>
      {peer.label} still runs the same chat binary and internal modules as the
      authorized friends. It attempts the same broadcast-style chat send as the
      others, but it is rejected because its peer-set membership does not match
      the shared set tracked by the rest of the group.
    </>
  ) : (
    <>
      {peer.label} runs the full chat stack. Select an internal module chip to
      view what it does in this node and highlight it across the diagram.
    </>
  );

  return (
    <div className="node-modal-backdrop" onClick={onClose}>
      <div className="node-modal" onClick={(e) => e.stopPropagation()}>
        <div className="node-modal-header">
          <h2 className="node-modal-title">{peer.label} internals</h2>
          <button type="button" className="node-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="node-modal-subtitle">{subtitle}</p>
        <svg
          viewBox="0 0 520 400"
          className="node-modal-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x={0}
            y={0}
            width={520}
            height={400}
            fill="white"
            onClick={() => onModuleClick?.(null)}
          />
          <ChatPeerNode
            peer={{ ...peer, x: 260, y: 178 }}
            isBootstrapper={isBootstrapper}
            highlighted
            dimmed={false}
            highlightModule={highlightModule}
            onModuleClick={onModuleClick}
            variant="expanded"
            unauthorized={unauthorized}
            pulseBootstrapper={isBootstrapper}
            pulseRejected={unauthorized}
            onClick={(e) => {
              e.stopPropagation();
              onModuleClick?.(null);
            }}
          />
        </svg>
      </div>
    </div>
  );
}

export default function ChatVisualization() {
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

  const meshPipeline = P2P_PIPELINE;
  const meshConnectionModules = MESH_CONNECTION_MODULES;
  const expandedPeer = expandedNode
    ? expandedNode === OUTSIDER.id
      ? OUTSIDER
      : FRIENDS.find((peer) => peer.id === expandedNode)
    : null;

  return (
    <div
      className="viz-container"
      onMouseMove={handleMouseMove}
      onClick={() => setHighlightModule(null)}
    >
      <div className="viz-header">
        <h1 className="viz-title">
          <a
            href="https://github.com/commonwarexyz/monorepo/tree/main/examples/chat"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chat
          </a>
        </h1>
        <p className="viz-subtitle">
          Fixed-friend encrypted group chat example over authenticated peer discovery.
        </p>
      </div>

      <Legend
        modules={CHAT_MODULE_LIST}
        activeModule={highlightModule}
        onSelect={setHighlightModule}
      />

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="viz-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="chatRuntimeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
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
                y={HEIGHT - 42}
                width={WIDTH}
                height={42}
                fill="url(#chatRuntimeGrad)"
                opacity={rtHighlighted ? 3 : 1}
              />
              {rtHighlighted && (
                <rect
                  x={0}
                  y={HEIGHT - 42}
                  width={WIDTH}
                  height={42}
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
                runtime (tokio tasks + metrics + keyboard loop)
              </text>
            </g>
          );
        })()}

        <g
          opacity={1}
          style={{ transition: 'opacity 0.3s' }}
        >
          <rect
            x={FRIEND_CLUSTER.cx - FRIEND_CLUSTER.width / 2}
            y={FRIEND_CLUSTER.cy - FRIEND_CLUSTER.height / 2}
            width={FRIEND_CLUSTER.width}
            height={FRIEND_CLUSTER.height}
            rx={8}
            ry={8}
            fill="none"
            stroke={highlightModule ? '#d0d0d0' : '#a5a5a5'}
            strokeWidth={1}
            strokeDasharray="6,3"
          />
          <text
            x={FRIEND_CLUSTER.cx}
            y={FRIEND_CLUSTER.cy - FRIEND_CLUSTER.height / 2 - 12}
            textAnchor="middle"
            fill="black"
            fontSize={12}
            fontFamily="monospace"
            fontWeight={700}
          >
            {FRIEND_CLUSTER.label}
          </text>
        </g>

        <ChatPeerMesh
          peers={FRIENDS}
          bootstrappers={BOOTSTRAPPERS}
          pipeline={meshPipeline}
          connectionModules={meshConnectionModules}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
        />

        {FRIENDS.map((peer, index) => {
          const active =
            !highlightNode || highlightNode === OUTSIDER.id || highlightNode === peer.id;
          const midX = (OUTSIDER.x + peer.x) / 2;
          const midY = (OUTSIDER.y + peer.y) / 2;
          return (
            <g key={`blocked-${peer.id}`}>
              <line
                x1={OUTSIDER.x}
                y1={OUTSIDER.y}
                x2={peer.x}
                y2={peer.y}
                stroke={active ? '#D36D6D' : '#f0f0f0'}
                strokeWidth={1.1}
                strokeDasharray="3,6"
                opacity={active ? 0.82 : 0.28}
              >
                {active && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-9"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                )}
              </line>

              {active && (
                <circle r={3.1} fill="#C62828" opacity={0.82}>
                  <animateMotion
                    dur={`${1.05 + index * 0.08}s`}
                    repeatCount="indefinite"
                    path={`M${OUTSIDER.x},${OUTSIDER.y} L${peer.x},${peer.y}`}
                  />
                </circle>
              )}

              <g opacity={active ? 0.95 : 0.28}>
                <line
                  x1={midX - 8}
                  y1={midY - 8}
                  x2={midX + 8}
                  y2={midY + 8}
                  stroke="#B71C1C"
                  strokeWidth={1.6}
                />
                <line
                  x1={midX + 8}
                  y1={midY - 8}
                  x2={midX - 8}
                  y2={midY + 8}
                  stroke="#B71C1C"
                  strokeWidth={1.6}
                />
              </g>
            </g>
          );
        })}

        {FRIENDS.map((peer) => {
          return (
            <ChatPeerNode
              key={peer.id}
              peer={peer}
              isBootstrapper={BOOTSTRAPPERS.includes(peer.id)}
              highlighted={highlightNode === peer.id}
              dimmed={highlightNode && highlightNode !== peer.id}
              highlightModule={highlightModule}
              onModuleClick={setHighlightModule}
              pulseBootstrapper={BOOTSTRAPPERS.includes(peer.id)}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedNode(peer.id);
              }}
              onMouseEnter={() => {
                setHighlightNode(peer.id);
                setTooltip({ type: 'friend', id: peer.id });
              }}
              onMouseLeave={() => {
                setHighlightNode(null);
                setTooltip(null);
              }}
            />
          );
        })}

        <ChatPeerNode
          peer={OUTSIDER}
          highlighted={highlightNode === OUTSIDER.id}
          dimmed={highlightNode && highlightNode !== OUTSIDER.id}
          highlightModule={highlightModule}
          onModuleClick={setHighlightModule}
          unauthorized
          pulseRejected
          onClick={(e) => {
            e.stopPropagation();
            setExpandedNode(OUTSIDER.id);
          }}
          onMouseEnter={() => {
            setHighlightNode(OUTSIDER.id);
            setTooltip({ type: 'outsider' });
          }}
          onMouseLeave={() => {
            setHighlightNode(null);
            setTooltip(null);
          }}
        />

        <text
          x={WIDTH - 22}
          y={28}
          textAnchor="end"
          fill="#666"
          fontSize={10}
          fontFamily="monospace"
        >
          steady-state view
        </text>
      </svg>

      <p className="viz-hint">
        Click a peer or module chip to inspect it.
      </p>

      <ChatTooltip info={tooltip} position={mousePos} />

      <ChatNodeDetailModal
        peer={expandedPeer}
        isBootstrapper={expandedPeer ? BOOTSTRAPPERS.includes(expandedPeer.id) : false}
        unauthorized={expandedPeer?.id === OUTSIDER.id}
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
