import { useState, useCallback, useEffect } from 'react';
import {
  WIDTH,
  HEIGHT,
  INDEXER,
  NETWORK_1,
  NETWORK_2,
  VALIDATORS_1,
  VALIDATORS_2,
  ALL_VALIDATORS,
} from '../data/layout';
import { MODULE_LIST, MODULES } from '../data/modules';
import { VALIDATOR_INTERNAL, INDEXER_INTERNAL } from '../data/pipelines';
import { useAnimation } from '../hooks/useAnimation';
import ParticleLayer from './particles/ParticleLayer';
import ValidatorNode from './nodes/ValidatorNode';
import IndexerNode from './nodes/IndexerNode';
import P2PMesh from './connections/P2PMesh';
import StreamConnection from './connections/StreamConnection';
import Legend from './Legend';
import Tooltip from './Tooltip';


function NetworkCluster({ network, highlightModule, highlightNode }) {
  const dimmed =
    highlightNode &&
    highlightNode !== 'indexer' &&
    !network.label.includes(
      ALL_VALIDATORS.find((v) => v.id === highlightNode)?.network ?? ''
    );

  return (
    <g style={{ opacity: dimmed ? 0.3 : 1, transition: 'opacity 0.3s' }}>
      <rect
        x={network.cx - network.width / 2}
        y={network.cy - network.height / 2}
        width={network.width}
        height={network.height}
        rx={4}
        ry={4}
        fill="none"
        stroke={highlightModule ? '#d0d0d0' : '#a5a5a5'}
        strokeWidth={1}
        strokeDasharray="6,3"
      />
      <text
        x={network.cx}
        y={network.cy - network.height / 2 - 8}
        textAnchor="middle"
        fill="black"
        fontSize={12}
        fontFamily="monospace"
        fontWeight={600}
      >
        {network.label}
      </text>
    </g>
  );
}

function NodeDetailModal({ kind, label, highlightModule, onModuleClick, onClose }) {
  if (!kind) return null;

  const internalModules = (kind === 'validator' ? VALIDATOR_INTERNAL : INDEXER_INTERNAL).map(
    (item) => item.module
  );
  const selectedModule = highlightModule && internalModules.includes(highlightModule)
    ? highlightModule
    : null;
  const selectedModuleName = selectedModule ? MODULES[selectedModule]?.name : null;
  const selectedModuleDescription = {
    validator: {
      storage:
        'Persists consensus protocol state to disk so validators can restart safely without double-voting.',
      parallel:
        'Parallel strategy for simplex vote/certificate verification and assembly; also used to verify external-network BLS finalization certificates in bridge blocks.',
      runtime:
        'Runs async tasks, network I/O, and scheduling for consensus, p2p, and indexer stream communication.',
    },
    indexer: {
      parallel:
        'Verifies uploaded finalization certificates (sequentially) before accepting them into the in-memory index used by later bridge proposals.',
      runtime:
        'Hosts the encrypted stream server, connection handlers, and in-memory block/finalization maps.',
    },
  }[kind]?.[selectedModule];

  const subtitle = selectedModuleName && selectedModuleDescription
    ? (
      <>
        <strong>{selectedModuleName}:</strong> {selectedModuleDescription}
      </>
    )
    : 'Select an internal module chip to view what it does in this node and highlight it across the bridge diagram.';

  return (
    <div className="node-modal-backdrop" onClick={onClose}>
      <div className="node-modal" onClick={(e) => e.stopPropagation()}>
        <div className="node-modal-header">
          <h2 className="node-modal-title">
            {kind === 'validator' ? `${label} internals` : 'INDEXER internals'}
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
          {kind === 'validator' ? (
            <ValidatorNode
              validator={{ id: 'modal-validator', x: 210, y: 130, label }}
              highlighted
              dimmed={false}
              isLeader={false}
              variant="expanded"
              highlightModule={highlightModule}
              onModuleClick={onModuleClick}
            />
          ) : (
            <IndexerNode
              x={210}
              y={130}
              highlighted
              dimmed={false}
              variant="expanded"
              highlightModule={highlightModule}
              onModuleClick={onModuleClick}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export default function BridgeVisualization() {
  const { phase, phaseProgress, activeNetwork } =
    useAnimation();

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
      setTooltip({ type: 'module', moduleKey: stage.module, pipelineLabel: stage.label });
    } else {
      setTooltip(null);
    }
  }, []);

  const leaderIdx = activeNetwork === 1 ? (phase === 'PROPOSE' ? 0 : -1) : -1;
  const leaderIdx2 = activeNetwork === 2 ? (phase === 'PROPOSE' ? 0 : -1) : -1;

  return (
    <div className="viz-container" onMouseMove={handleMouseMove} onClick={() => setHighlightModule(null)}>
      <div className="viz-header">
        <h1 className="viz-title"><a href="https://github.com/commonwarexyz/monorepo/tree/main/examples/bridge" target="_blank" rel="noopener noreferrer">Bridge</a></h1>
        <p className="viz-subtitle">
          Send succinct consensus certificates between two networks.
        </p>
      </div>

      <Legend modules={MODULE_LIST} activeModule={highlightModule} onSelect={setHighlightModule} />

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="viz-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ParticleLayer />

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
                fill="url(#runtimeGrad)"
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

        {/* Network clusters */}
        <NetworkCluster
          network={NETWORK_1}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
        />
        <NetworkCluster
          network={NETWORK_2}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
        />

        {/* Stream connections to indexer (drawn first, behind mesh) */}
        {ALL_VALIDATORS.map((v, i) => (
          <StreamConnection
            key={`stream-${v.id}`}
            validator={v}
            indexer={INDEXER}
            highlightModule={highlightModule}
            highlightNode={highlightNode}
            phase={phase}
            activeNetwork={activeNetwork}
            showPipeline={i === 0 || i === 4}
            onStageHover={handleStageHover}
            onModuleClick={setHighlightModule}
          />
        ))}

        {/* P2P mesh connections */}
        <P2PMesh
          validators={VALIDATORS_1}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          phase={phase}
          activeNetwork={activeNetwork}
          networkLabel="Network 1"
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
        />
        <P2PMesh
          validators={VALIDATORS_2}
          highlightModule={highlightModule}
          highlightNode={highlightNode}
          phase={phase}
          activeNetwork={activeNetwork}
          networkLabel="Network 2"
          onStageHover={handleStageHover}
          onModuleClick={setHighlightModule}
        />

        {/* Validator nodes */}
        {VALIDATORS_1.map((v, i) => (
          <ValidatorNode
            key={v.id}
            validator={v}
            isLeader={i === leaderIdx}
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
        {VALIDATORS_2.map((v, i) => (
          <ValidatorNode
            key={v.id}
            validator={v}
            isLeader={i === leaderIdx2}
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
        <IndexerNode
          x={INDEXER.x}
          y={INDEXER.y}
          highlighted={highlightNode === 'indexer'}
          dimmed={highlightNode && highlightNode !== 'indexer'}
          highlightModule={highlightModule}
          onModuleClick={setHighlightModule}
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

        {/* Phase indicator */}
        <text
          x={WIDTH - 16}
          y={24}
          textAnchor="end"
          fill="gray"
          fontSize={10}
          fontFamily="monospace"
        >
          {phase} (Network {activeNetwork})
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
      </svg>

      <p className="viz-hint">Click on a validator, indexer, or colored module to learn more</p>

      <Tooltip info={tooltip} position={mousePos} />
      <NodeDetailModal
        kind={expandedNode?.kind}
        label={expandedNode?.label}
        highlightModule={highlightModule}
        onModuleClick={setHighlightModule}
        onClose={() => setExpandedNode(null)}
      />

      <div className="viz-footer">
        <a href="https://github.com/commonwarexyz/monorepo">GitHub</a>
        <a href="https://commonware.xyz">commonware.xyz</a>
      </div>
    </div>
  );
}
