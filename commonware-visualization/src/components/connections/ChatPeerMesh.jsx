import ConnectionPipeline from './ConnectionPipeline';
import { CHAT_MODULES } from '../../data/chat/modules';

function pairs(peers) {
  const result = [];
  for (let i = 0; i < peers.length; i++) {
    for (let j = i + 1; j < peers.length; j++) {
      result.push([peers[i], peers[j]]);
    }
  }
  return result;
}

export default function ChatPeerMesh({
  peers,
  bootstrappers,
  pipeline,
  connectionModules,
  highlightModule,
  highlightNode,
  onStageHover,
  onModuleClick,
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
          highlightModule && connectionModules.includes(highlightModule);
        const dimLine =
          (highlightModule && !anyModuleHighlight) ||
          (highlightNode && !nodeHighlight);
        const showPipeline = index === representativeEdgeIndex;
        const compactModules = connectionModules;
        const bootstrapEdge =
          bootstrappers.includes(a.id) || bootstrappers.includes(b.id);
        const stroke = dimLine ? '#f0f0f0' : '#b0b0b0';
        const dash = '4,4';
        const opacity = dimLine ? 0.45 : 0.66;

        return (
          <g key={`${a.id}-${b.id}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeWidth={dimLine ? 0.7 : 1}
              strokeDasharray={dash}
              opacity={opacity}
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
                modules={CHAT_MODULES}
                highlightModule={highlightModule}
                dimLine={dimLine}
                onStageHover={onStageHover}
                onModuleClick={onModuleClick}
                startT={0.24}
                endT={0.76}
                chipScale={0.95}
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
                    fill={modDimmed ? '#eee' : CHAT_MODULES[mod].color}
                    opacity={modDimmed ? 0.2 : 0.6}
                    style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onModuleClick?.(mod);
                    }}
                  />
                );
              })}

            {bootstrapEdge && (
              <>
                <circle r={3} fill="#FF8F00" opacity={0.76}>
                  <animateMotion
                    dur={`${1 + index * 0.08}s`}
                    repeatCount="indefinite"
                    path={`M${a.x},${a.y} L${b.x},${b.y}`}
                  />
                </circle>
                <circle r={2.6} fill="#0097A7" opacity={0.7}>
                  <animateMotion
                    dur={`${1.2 + index * 0.08}s`}
                    repeatCount="indefinite"
                    path={`M${b.x},${b.y} L${a.x},${a.y}`}
                  />
                </circle>
              </>
            )}

            <>
              <circle r={2.8} fill="#E65100" opacity={0.78}>
                <animateMotion
                  dur={`${0.72 + (index % 3) * 0.12}s`}
                  repeatCount="indefinite"
                  path={`M${a.x},${a.y} L${b.x},${b.y}`}
                />
              </circle>
              <circle r={2.6} fill="#0097A7" opacity={0.72}>
                <animateMotion
                  dur={`${0.82 + (index % 4) * 0.12}s`}
                  repeatCount="indefinite"
                  path={`M${b.x},${b.y} L${a.x},${a.y}`}
                />
              </circle>
            </>
          </g>
        );
      })}
    </g>
  );
}
