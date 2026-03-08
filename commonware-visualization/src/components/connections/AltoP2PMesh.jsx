import ConnectionPipeline from './ConnectionPipeline';
import { P2P_MESH_MODULES } from '../../data/alto/layout';
import { ALTO_MODULES } from '../../data/alto/modules';

function pairs(validators) {
  const result = [];
  for (let i = 0; i < validators.length; i++) {
    for (let j = i + 1; j < validators.length; j++) {
      result.push([validators[i], validators[j]]);
    }
  }
  return result;
}

export default function AltoP2PMesh({
  validators,
  pipeline,
  connectionModules,
  channelKey,
  highlightModule,
  highlightNode,
  phase,
  leader,
  onStageHover,
  onModuleClick,
  chipScale = 1,
}) {
  const meshPairs = pairs(validators);
  const leaderV = validators[leader];

  return (
    <g>
      {meshPairs.map(([a, b], idx) => {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

        const nodeHighlight =
          highlightNode && (highlightNode === a.id || highlightNode === b.id);
        const anyModuleHighlight =
          highlightModule && P2P_MESH_MODULES.includes(highlightModule);
        const dimLine =
          (highlightModule && !anyModuleHighlight) ||
          (highlightNode && !nodeHighlight);

        const showPipeline = idx === 0;

        const isLeaderEdge = a.id === leaderV.id || b.id === leaderV.id;
        const showBlockParticle =
          channelKey === 'blocks' && phase === 'PROPOSE' && isLeaderEdge;
        const showVoteParticle =
          (channelKey === 'votes' || channelKey === 'certs') &&
          (phase === 'NOTARIZE' || phase === 'FINALIZE') &&
          idx < 5;
        const showMarshalParticle =
          channelKey === 'marshal' && phase === 'FINALIZE' && idx < 5;
        const compactModules =
          connectionModules?.length ? connectionModules : P2P_MESH_MODULES;

        return (
          <g key={`mesh-${a.id}-${b.id}`}>
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
                modules={ALTO_MODULES}
                highlightModule={highlightModule}
                dimLine={dimLine}
                onStageHover={onStageHover}
                onModuleClick={onModuleClick}
                startT={0.25}
                endT={0.75}
                chipScale={chipScale}
              />
            )}
            {!showPipeline &&
              compactModules.map((mod, mi) => {
                const perpAngle = ((angle + 90) * Math.PI) / 180;
                const offset = (mi - (compactModules.length - 1) / 2) * 8;
                const ox = offset * Math.cos(perpAngle);
                const oy = offset * Math.sin(perpAngle);
                const modDimmed = highlightModule && highlightModule !== mod;
                return (
                  <circle
                    key={mod}
                    cx={mx + ox}
                    cy={my + oy}
                    r={3.4}
                    fill={modDimmed ? '#eee' : ALTO_MODULES[mod].color}
                    opacity={modDimmed ? 0.2 : 0.6}
                    style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onModuleClick?.(mod);
                    }}
                  />
                );
              })}
            {showBlockParticle && (
              <circle r={3.8} fill="#E65100" opacity={0.82}>
                <animateMotion
                  dur={`${0.8 + (idx % 3) * 0.2}s`}
                  repeatCount="indefinite"
                  path={
                    a.id === leaderV.id
                      ? `M${a.x},${a.y} L${b.x},${b.y}`
                      : `M${b.x},${b.y} L${a.x},${a.y}`
                  }
                />
              </circle>
            )}
            {showVoteParticle && (
              <circle r={2.9} fill="#7B1FA2" opacity={0.68}>
                <animateMotion
                  dur={`${0.7 + idx * 0.15}s`}
                  repeatCount="indefinite"
                  path={`M${a.x},${a.y} L${b.x},${b.y}`}
                />
              </circle>
            )}
            {showMarshalParticle && (
              <circle r={3.1} fill="#546E7A" opacity={0.72}>
                <animateMotion
                  dur={`${0.9 + idx * 0.12}s`}
                  repeatCount="indefinite"
                  path={`M${b.x},${b.y} L${a.x},${a.y}`}
                />
              </circle>
            )}
          </g>
        );
      })}
    </g>
  );
}
