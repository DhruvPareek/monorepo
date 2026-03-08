import ConnectionPipeline from './ConnectionPipeline';
import { FLOOD_MODULES } from '../../data/flood/modules';

function pairs(peers) {
  const result = [];
  for (let i = 0; i < peers.length; i++) {
    for (let j = i + 1; j < peers.length; j++) {
      result.push([peers[i], peers[j]]);
    }
  }
  return result;
}

export default function FloodPeerMesh({
  peers,
  bootstrappers,
  pipeline,
  connectionModules,
  mode,
  phase,
  highlightModule,
  highlightNode,
  onStageHover,
  onModuleClick,
  chipScale = 1,
}) {
  const meshPairs = pairs(peers);
  const representativeEdgeIndex = 0;

  return (
    <g>
      {meshPairs.map(([a, b], index) => {
        const midpointX = (a.x + b.x) / 2;
        const midpointY = (a.y + b.y) / 2;
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const nodeHighlight =
          highlightNode && (highlightNode === a.id || highlightNode === b.id);
        const anyModuleHighlight =
          highlightModule &&
          connectionModules.includes(highlightModule);
        const dimLine =
          (highlightModule && !anyModuleHighlight) ||
          (highlightNode && !nodeHighlight);
        const showPipeline = index === representativeEdgeIndex;
        const compactModules = connectionModules;
        const bootstrapEdge =
          bootstrappers.includes(a.id) || bootstrappers.includes(b.id);
        const showDiscoveryParticle =
          mode === 'discovery' && phase === 'DISCOVER' && bootstrapEdge;
        const showFloodParticles = mode === 'flood' && phase === 'FLOOD';

        return (
          <g key={`${a.id}-${b.id}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={dimLine ? '#f0f0f0' : '#b0b0b0'}
              strokeWidth={dimLine ? 0.7 : 1}
              strokeDasharray="4,4"
              opacity={dimLine ? 0.45 : 0.66}
            >
              {!dimLine && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-8"
                  dur="1s"
                  repeatCount="indefinite"
                />
              )}
            </line>
            {showPipeline && (
              <ConnectionPipeline
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                pipeline={pipeline}
                modules={FLOOD_MODULES}
                highlightModule={highlightModule}
                dimLine={dimLine}
                onStageHover={onStageHover}
                onModuleClick={onModuleClick}
                startT={0.24}
                endT={0.76}
                chipScale={chipScale}
              />
            )}
            {!showPipeline &&
              compactModules.map((mod, moduleIndex) => {
                const perpendicular = ((angle + 90) * Math.PI) / 180;
                const offset =
                  (moduleIndex - (compactModules.length - 1) / 2) * 8;
                const offsetX = offset * Math.cos(perpendicular);
                const offsetY = offset * Math.sin(perpendicular);
                const modDimmed = highlightModule && highlightModule !== mod;
                return (
                  <circle
                    key={mod}
                    cx={midpointX + offsetX}
                    cy={midpointY + offsetY}
                    r={3.4}
                    fill={modDimmed ? '#eee' : FLOOD_MODULES[mod].color}
                    opacity={modDimmed ? 0.2 : 0.6}
                    style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onModuleClick?.(mod);
                    }}
                  />
                );
              })}
            {showDiscoveryParticle && (
              <circle r={3} fill="#7B1FA2" opacity={0.74}>
                <animateMotion
                  dur={`${0.9 + index * 0.08}s`}
                  repeatCount="indefinite"
                  path={`M${a.x},${a.y} L${b.x},${b.y}`}
                />
              </circle>
            )}
            {showFloodParticles && (
              <>
                <circle r={2.8} fill="#E65100" opacity={0.78}>
                  <animateMotion
                    dur={`${0.65 + (index % 3) * 0.15}s`}
                    repeatCount="indefinite"
                    path={`M${a.x},${a.y} L${b.x},${b.y}`}
                  />
                </circle>
                <circle r={2.6} fill="#0097A7" opacity={0.72}>
                  <animateMotion
                    dur={`${0.72 + (index % 4) * 0.12}s`}
                    repeatCount="indefinite"
                    path={`M${b.x},${b.y} L${a.x},${a.y}`}
                  />
                </circle>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
