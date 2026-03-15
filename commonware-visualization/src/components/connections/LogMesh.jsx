import ConnectionPipeline from './ConnectionPipeline';

function pairs(participants) {
  const result = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      result.push([participants[i], participants[j]]);
    }
  }
  return result;
}

export default function LogMesh({
  participants,
  modules,
  pipeline,
  connectionModules,
  modeKey,
  phase,
  leaderId,
  repairPeerId,
  highlightModule,
  highlightNode,
  onStageHover,
  onModuleClick,
}) {
  const meshPairs = pairs(participants);

  return (
    <g>
      {meshPairs.map(([a, b], index) => {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const showPipeline = index === 0;
        const nodeHighlight =
          highlightNode && (highlightNode === a.id || highlightNode === b.id);
        const anyModuleHighlight =
          highlightModule &&
          connectionModules &&
          connectionModules.includes(highlightModule);
        const dimLine =
          (highlightModule && !anyModuleHighlight) ||
          (highlightNode && !nodeHighlight);

        const proposalFromA = a.id === leaderId ? a : b.id === leaderId ? b : null;
        const proposalToA = proposalFromA === a ? b : a;
        const repairFrom = a.id === repairPeerId ? a : b.id === repairPeerId ? b : null;
        const repairTo = repairFrom === a ? b : a;

        return (
          <g key={`${a.id}-${b.id}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={dimLine ? '#f0f0f0' : '#b8b8b8'}
              strokeWidth={dimLine ? 0.7 : 1}
              strokeDasharray="5,4"
              opacity={dimLine ? 0.45 : 0.68}
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

            {showPipeline ? (
              <ConnectionPipeline
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                pipeline={pipeline}
                modules={modules}
                highlightModule={highlightModule}
                dimLine={dimLine}
                onStageHover={onStageHover}
                onModuleClick={onModuleClick}
                chipScale={1.25}
                startT={0.24}
                endT={0.76}
              />
            ) : (
              connectionModules.map((moduleName, moduleIndex) => {
                const modDimmed =
                  highlightModule && highlightModule !== moduleName;
                const perpAngle = ((angle + 90) * Math.PI) / 180;
                const offset =
                  (moduleIndex - (connectionModules.length - 1) / 2) * 11;
                return (
                  <circle
                    key={moduleName}
                    cx={mx + offset * Math.cos(perpAngle)}
                    cy={my + offset * Math.sin(perpAngle)}
                    r={3.8}
                    fill={modDimmed ? '#eee' : modules[moduleName].color}
                    opacity={modDimmed ? 0.2 : 0.52}
                    style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onModuleClick?.(moduleName);
                    }}
                  />
                );
              })
            )}

            {modeKey === 'votes' && phase === 'PROPOSE' && proposalFromA && (
              <circle r={3.1} fill="#546E7A" opacity={0.84}>
                <animateMotion
                  dur={`${1 + index * 0.12}s`}
                  repeatCount="indefinite"
                  path={`M${proposalFromA.x},${proposalFromA.y} L${proposalToA.x},${proposalToA.y}`}
                />
              </circle>
            )}

            {modeKey === 'votes' && phase === 'NOTARIZE' && index < 3 && (
              <circle r={3.3} fill="#7B1FA2" opacity={0.82}>
                <animateMotion
                  dur={`${0.9 + index * 0.18}s`}
                  repeatCount="indefinite"
                  path={`M${a.x},${a.y} L${b.x},${b.y}`}
                />
              </circle>
            )}

            {modeKey === 'votes' && phase === 'NULLIFY' && index < 2 && (
              <circle r={3.2} fill="#757575" opacity={0.8}>
                <animateMotion
                  dur={`${1 + index * 0.2}s`}
                  repeatCount="indefinite"
                  path={`M${b.x},${b.y} L${a.x},${a.y}`}
                />
              </circle>
            )}

            {modeKey === 'certs' && phase === 'FINALIZE' && index < 3 && (
              <polygon points="0,-4 4,0 0,4 -4,0" fill="#F57C00" opacity={0.84}>
                <animateMotion
                  dur={`${1.1 + index * 0.15}s`}
                  repeatCount="indefinite"
                  path={`M${a.x},${a.y} L${b.x},${b.y}`}
                />
              </polygon>
            )}

            {modeKey === 'resolver' && phase === 'REPAIR' && repairFrom && (
              <circle r={3.2} fill="#AD1457" opacity={0.84}>
                <animateMotion
                  dur={`${1.1 + index * 0.12}s`}
                  repeatCount="indefinite"
                  path={`M${repairFrom.x},${repairFrom.y} L${repairTo.x},${repairTo.y}`}
                />
              </circle>
            )}
          </g>
        );
      })}
    </g>
  );
}
