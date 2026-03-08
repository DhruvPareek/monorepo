import { useState, useCallback, useEffect } from 'react';
import {
  WIDTH,
  HEIGHT,
  PEER_CLUSTER,
  PEERS,
  BOOTSTRAPPERS,
  SETUP,
  PROVISION_SETUP,
  PROVISION_PEER_CLUSTER,
  PROVISION_PEERS,
  SETUP_OUTPUT,
  MONITORING,
  DISCOVERY_CONNECTION_MODULES,
  FLOOD_CONNECTION_MODULES,
  PROVISIONING_CONNECTION_MODULES,
  SETUP_OUTPUT_CONNECTION_MODULES,
  TELEMETRY_CONNECTION_MODULES,
} from '../data/flood/layout';
import { FLOOD_MODULE_LIST, FLOOD_MODULES } from '../data/flood/modules';
import {
  PROVISIONING_PIPELINE,
  MONITORING_PROVISIONING_PIPELINE,
  DISCOVERY_PIPELINE,
  FLOOD_PIPELINE,
  TELEMETRY_PIPELINE,
} from '../data/flood/pipelines';
import { useFloodAnimation } from '../hooks/useFloodAnimation';
import FloodPeerMesh from './connections/FloodPeerMesh';
import HttpConnection from './connections/HttpConnection';
import FloodPeerNode from './nodes/FloodPeerNode';
import FloodSetupNode from './nodes/FloodSetupNode';
import FloodMonitoringNode from './nodes/FloodMonitoringNode';
import Legend from './Legend';

const VIEW_MODES = [
  {
    key: 'provision',
    label: 'Setup',
    detail:
      'setup.rs parses CLI input, generates peer identities, selects bootstrappers, builds per-peer Flood configs and one deployer config, then writes YAML files and copies dashboard.json locally.',
  },
  {
    key: 'discovery',
    label: 'Discovery',
    detail:
      'Peers gossip BitVec and signed Info records over authenticated discovery to find and maintain dialable peers.',
  },
  {
    key: 'flood',
    label: 'Flood',
    detail:
      'Each peer continuously sends timestamped random Data messages on channel 0 to all currently connected peers.',
  },
  {
    key: 'telemetry',
    label: 'Telemetry',
    detail:
      'Peers expose metrics and optionally export traces to the separate monitoring instance; logs and profiles reach the same sink through deployer-installed agents.',
  },
];

function FloodTooltip({ info, position }) {
  if (!info) return null;

  const { type, moduleKey, pipelineLabel } = info;
  let title;
  let body;

  if (type === 'module' && moduleKey) {
    const mod = FLOOD_MODULES[moduleKey];
    title = mod?.name;
    body = pipelineLabel ? `${pipelineLabel}: ${mod?.detail}` : mod?.detail;
  } else if (type === 'peer') {
    title = 'Peer';
    body =
      'Every flood node runs the same binary. It loads hosts.yaml and its peer config, starts the Tokio runtime, registers peer set 0 and channel 0, floods connected peers with timestamped random messages, and records one-way receive latency.';
  } else if (type === 'peer-config') {
    title = 'Peer config';
    body =
      'Per-peer YAML emitted by setup.rs. It stores the hex-encoded private key, shared port, allowed peer list, selected bootstrappers, worker thread count, message sizing, backlog, mailbox size, and instrumentation flag.';
  } else if (type === 'setup') {
    title = 'Setup';
    body =
      'setup.rs is a local artifact generator. It parses CLI inputs, generates one Ed25519 keypair per peer, selects bootstrappers, builds per-peer Flood configs, builds one top-level deployer config, copies dashboard.json, and writes YAML files to disk.';
  } else if (type === 'setup-output') {
    title = 'Setup outputs';
    body =
      'These are local files written by setup.rs: the root config.yaml consumed later by commonware-deployer and the copied dashboard.json. No cloud resources or hosts.yaml exist yet in this phase.';
  } else if (type === 'monitoring') {
    title = 'Monitoring';
    body =
      'Shared observability sink provisioned by the deployer. This view highlights the runtime-driven metrics and traces path; Loki logs and Pyroscope profiles also land here, but their client-side collection is handled by deployer-installed agents.';
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

function FloodNodeDetailModal({
  peer,
  isBootstrapper,
  highlightModule,
  onModuleClick,
  onClose,
}) {
  if (!peer) return null;

  const internalModules = ['cryptography', 'codec', 'p2p', 'stream', 'runtime'];
  const selectedModule =
    highlightModule && internalModules.includes(highlightModule)
      ? highlightModule
      : null;
  const selectedDetails = selectedModule ? FLOOD_MODULES[selectedModule] : null;
  const subtitle = selectedDetails ? (
    <>
      <strong>{selectedDetails.name}:</strong> {selectedDetails.detail}
    </>
  ) : (
    <>
      {peer.label} runs the same flood binary as every other peer. Select an
      internal module chip to view what it does in this node and highlight it
      across the Flood diagram.
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
          <FloodPeerNode
            peer={{ ...peer, x: 260, y: 180 }}
            isBootstrapper={isBootstrapper}
            pulsing={false}
            bootstrapperActive={isBootstrapper}
            highlighted
            dimmed={false}
            highlightModule={highlightModule}
            onModuleClick={onModuleClick}
            variant="expanded"
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

export default function FloodVisualization() {
  const { phase, phaseProgress, wave } = useFloodAnimation();
  const [viewMode, setViewMode] = useState('discovery');
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

  const activeMode = VIEW_MODES.find((mode) => mode.key === viewMode);
  const activePeers = viewMode === 'provision' ? PROVISION_PEERS : PEERS;
  const activeSetup = viewMode === 'provision' ? PROVISION_SETUP : SETUP;
  const activePeerCluster =
    viewMode === 'provision' ? PROVISION_PEER_CLUSTER : PEER_CLUSTER;

  return (
    <div
      className="viz-container"
      onMouseMove={handleMouseMove}
      onClick={() => setHighlightModule(null)}
    >
      <div className="viz-header">
        <h1 className="viz-title">
          <a
            href="https://github.com/commonwarexyz/monorepo/tree/main/examples/flood"
            target="_blank"
            rel="noopener noreferrer"
          >
            Flood
          </a>
        </h1>
        <p className="viz-subtitle">
          Symmetric peer-to-peer workload generator for discovery, encrypted
          transport, and one-way latency measurement.
        </p>
      </div>

      <Legend
        modules={FLOOD_MODULE_LIST}
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
            id="floodRuntimeGrad"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="white" />

        {viewMode !== 'provision' &&
          (() => {
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
                  fill="url(#floodRuntimeGrad)"
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
                  runtime (tokio execution + telemetry foundation)
                </text>
              </g>
            );
          })()}

        <g
          style={{
            opacity:
              highlightNode &&
              !activePeers.find((peer) => peer.id === highlightNode)
                ? 0.3
                : 1,
            transition: 'opacity 0.3s',
          }}
        >
          <rect
            x={activePeerCluster.cx - (activePeerCluster.width - 40) / 2}
            y={activePeerCluster.cy - (activePeerCluster.height - 40) / 2}
            width={activePeerCluster.width - 40}
            height={activePeerCluster.height - 40}
            rx={6}
            fill="none"
            stroke={highlightModule ? '#d0d0d0' : '#a5a5a5'}
            strokeWidth={1.2}
            strokeDasharray="6,3"
          />
          <text
            x={activePeerCluster.cx}
            y={
              viewMode === 'provision'
                ? activePeerCluster.cy + activePeerCluster.height / 2 - 24
                : activePeerCluster.cy - activePeerCluster.height / 2 + 10
            }
            textAnchor="middle"
            fill="black"
            fontSize={14}
            fontFamily="monospace"
            fontWeight={600}
          >
            {activePeerCluster.label}
          </text>
          <text
            x={activePeerCluster.cx}
            y={activePeerCluster.cy + activePeerCluster.height / 2 - 8}
            textAnchor="middle"
            fill={highlightModule ? '#999' : '#767676'}
            fontSize={10}
            fontFamily="monospace"
          >
            {viewMode === 'provision'
              ? 'local setup only: key generation, bootstrapper selection, peer YAMLs, deployer config, and dashboard copy'
              : 'all peers run the same binary; bootstrappers are temporary discovery seeds'}
          </text>
        </g>

        {viewMode === 'provision' && (
          <>
            {activePeers.map((peer, index) => (
              <HttpConnection
                key={`setup-${peer.id}`}
                x1={activeSetup.x}
                y1={activeSetup.y + activeSetup.height / 2 - 6}
                x2={peer.x}
                y2={peer.y - 28}
                pipeline={index === 0 ? PROVISIONING_PIPELINE : []}
                modules={FLOOD_MODULES}
                connectionModules={PROVISIONING_CONNECTION_MODULES}
                highlightModule={highlightModule}
                highlightNode={highlightNode}
                sourceId="setup"
                destId={peer.id}
                showPipeline={index === 0}
                showParticle={phase === 'PROVISION'}
                particleColor="#8D6E63"
                onStageHover={handleStageHover}
                onModuleClick={setHighlightModule}
                chipScale={1.03}
              />
            ))}
          </>
        )}

        {viewMode === 'provision' && (
            <HttpConnection
              x1={activeSetup.x + activeSetup.width / 2 - 6}
              y1={activeSetup.y}
              x2={SETUP_OUTPUT.x - SETUP_OUTPUT.width / 2}
              y2={SETUP_OUTPUT.y}
            pipeline={MONITORING_PROVISIONING_PIPELINE}
            modules={FLOOD_MODULES}
            connectionModules={SETUP_OUTPUT_CONNECTION_MODULES}
            highlightModule={highlightModule}
            highlightNode={highlightNode}
            sourceId="setup"
            destId="setup-output"
            showPipeline
            showParticle={phase === 'PROVISION'}
            particleColor="#8D6E63"
            onStageHover={handleStageHover}
            onModuleClick={setHighlightModule}
            chipScale={1.02}
          />
        )}

        {(viewMode === 'discovery' || viewMode === 'flood') && (
          <FloodPeerMesh
            peers={activePeers}
            bootstrappers={BOOTSTRAPPERS}
            pipeline={
              viewMode === 'discovery' ? DISCOVERY_PIPELINE : FLOOD_PIPELINE
            }
            connectionModules={
              viewMode === 'discovery'
                ? DISCOVERY_CONNECTION_MODULES
                : FLOOD_CONNECTION_MODULES
            }
            mode={viewMode}
            phase={phase}
            highlightModule={highlightModule}
            highlightNode={highlightNode}
            onStageHover={handleStageHover}
            onModuleClick={setHighlightModule}
            chipScale={1.08}
          />
        )}

        {viewMode === 'telemetry' &&
          PEERS.map((peer, index) => (
            <HttpConnection
              key={`telemetry-${peer.id}`}
              x1={peer.x + 8}
              y1={peer.y - 6}
              x2={MONITORING.x - MONITORING.width / 2}
              y2={MONITORING.y}
              pipeline={index === 0 ? TELEMETRY_PIPELINE : []}
              modules={FLOOD_MODULES}
              connectionModules={TELEMETRY_CONNECTION_MODULES}
              highlightModule={highlightModule}
              highlightNode={highlightNode}
              sourceId={peer.id}
              destId="monitoring"
              showPipeline={index === 0}
              showParticle={phase === 'OBSERVE'}
              particleColor="#2E7D32"
              onStageHover={handleStageHover}
              onModuleClick={setHighlightModule}
              chipScale={1.05}
            />
          ))}

        {viewMode === 'provision' && (
          <FloodSetupNode
            node={activeSetup}
            highlighted={highlightNode === 'setup'}
            dimmed={highlightNode && highlightNode !== 'setup'}
            highlightModule={highlightModule}
            onModuleClick={setHighlightModule}
            onMouseEnter={() => {
              setHighlightNode('setup');
              setTooltip({ type: 'setup' });
            }}
            onMouseLeave={() => {
              setHighlightNode(null);
              setTooltip(null);
            }}
          />
        )}

        {viewMode === 'provision'
          ? activePeers.map((peer) => (
              <g
                key={peer.id}
                style={{
                  opacity: highlightNode && highlightNode !== peer.id ? 0.22 : 1,
                  transition: 'opacity 0.3s',
                }}
                onMouseEnter={() => {
                  setHighlightNode(peer.id);
                  setTooltip({ type: 'peer-config' });
                }}
                onMouseLeave={() => {
                  setHighlightNode(null);
                  setTooltip(null);
                }}
              >
                <rect
                  x={peer.x - 34}
                  y={peer.y - 28}
                  width={68}
                  height={56}
                  rx={6}
                  fill="white"
                  stroke={highlightNode === peer.id ? 'black' : '#9E9E9E'}
                  strokeWidth={highlightNode === peer.id ? 1.8 : 1.2}
                />
                <text
                  x={peer.x}
                  y={peer.y - 8}
                  textAnchor="middle"
                  fill="black"
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight={700}
                >
                  {peer.label}.yaml
                </text>
                <text
                  x={peer.x}
                  y={peer.y + 10}
                  textAnchor="middle"
                  fill="#666"
                  fontSize={7}
                  fontFamily="monospace"
                >
                  flood::Config
                </text>
              </g>
            ))
          : activePeers.map((peer) => (
              <FloodPeerNode
                key={peer.id}
                peer={peer}
                isBootstrapper={BOOTSTRAPPERS.includes(peer.id)}
                pulsing={viewMode === 'discovery' && phase === 'DISCOVER'}
                bootstrapperActive={viewMode === 'discovery'}
                highlighted={highlightNode === peer.id}
                dimmed={highlightNode && highlightNode !== peer.id}
                highlightModule={highlightModule}
                onModuleClick={setHighlightModule}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedNode(peer.id);
                }}
                onMouseEnter={() => {
                  setHighlightNode(peer.id);
                  setTooltip({ type: 'peer' });
                }}
                onMouseLeave={() => {
                  setHighlightNode(null);
                  setTooltip(null);
                }}
              />
            ))}

        {viewMode === 'provision' ? (
          <g
            style={{
              opacity:
                highlightNode && highlightNode !== 'setup-output' ? 0.22 : 1,
              transition: 'opacity 0.3s',
            }}
            onMouseEnter={() => {
              setHighlightNode('setup-output');
              setTooltip({ type: 'setup-output' });
            }}
            onMouseLeave={() => {
              setHighlightNode(null);
              setTooltip(null);
            }}
          >
            <rect
              x={SETUP_OUTPUT.x - SETUP_OUTPUT.width / 2}
              y={SETUP_OUTPUT.y - SETUP_OUTPUT.height / 2}
              width={SETUP_OUTPUT.width}
              height={SETUP_OUTPUT.height}
              rx={8}
              fill="white"
              stroke={highlightNode === 'setup-output' ? 'black' : '#9E9E9E'}
              strokeWidth={highlightNode === 'setup-output' ? 1.8 : 1.2}
            />
            <text
              x={SETUP_OUTPUT.x}
              y={SETUP_OUTPUT.y - 20}
              textAnchor="middle"
              fill="black"
              fontSize={13}
              fontFamily="monospace"
              fontWeight={700}
            >
              LOCAL OUTPUTS
            </text>
            <text
              x={SETUP_OUTPUT.x}
              y={SETUP_OUTPUT.y}
              textAnchor="middle"
              fill="#444"
              fontSize={10}
              fontFamily="monospace"
              fontWeight={600}
            >
              config.yaml
            </text>
            <text
              x={SETUP_OUTPUT.x}
              y={SETUP_OUTPUT.y + 18}
              textAnchor="middle"
              fill="#444"
              fontSize={10}
              fontFamily="monospace"
              fontWeight={600}
            >
              dashboard.json
            </text>
          </g>
        ) : (
          <FloodMonitoringNode
            node={MONITORING}
            highlighted={highlightNode === 'monitoring'}
            dimmed={highlightNode && highlightNode !== 'monitoring'}
            onMouseEnter={() => {
              setHighlightNode('monitoring');
              setTooltip({ type: 'monitoring' });
            }}
            onMouseLeave={() => {
              setHighlightNode(null);
              setTooltip(null);
            }}
          />
        )}

        <text
          x={WIDTH - 16}
          y={24}
          textAnchor="end"
          fill="gray"
          fontSize={12}
          fontFamily="monospace"
        >
          {phase} (wave #{wave})
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
          fill="#0097A7"
        />

        <foreignObject
          x={210}
          y={700}
          width={420}
          height={96}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            className="channel-selector channel-selector--overlay"
            xmlns="http://www.w3.org/1999/xhtml"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="channel-selector-label">Flood Phases</div>
            <div className="channel-selector-buttons">
              {VIEW_MODES.map((mode) => {
                const active = mode.key === viewMode;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    className={`channel-selector-button ${active ? 'channel-selector-button--active' : ''}`}
                    onClick={() => setViewMode(mode.key)}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
            <div className="channel-selector-detail">{activeMode?.detail}</div>
          </div>
        </foreignObject>
      </svg>

      <p className="viz-hint">
        Click on a peer, module, or flood phase to learn more.
      </p>

      <FloodTooltip info={tooltip} position={mousePos} />
      <FloodNodeDetailModal
        peer={PEERS.find((peer) => peer.id === expandedNode) ?? null}
        isBootstrapper={BOOTSTRAPPERS.includes(expandedNode)}
        highlightModule={highlightModule}
        onModuleClick={setHighlightModule}
        onClose={() => setExpandedNode(null)}
      />
    </div>
  );
}
