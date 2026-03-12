import ConnectionPipeline from './ConnectionPipeline';
import { ALTO_MODULES } from '../../data/alto/modules';

export default function HttpConnection({
  x1,
  y1,
  x2,
  y2,
  pipeline,
  modules,
  connectionModules,
  highlightModule,
  highlightNode,
  sourceId,
  destId,
  showPipeline,
  showParticle,
  particleColor,
  particleReverse,
  onStageHover,
  onModuleClick,
  chipScale = 1,
}) {
  const moduleMap = modules || ALTO_MODULES;
  const activeConnectionModules = connectionModules || [];
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

  const nodeHighlight =
    highlightNode && (highlightNode === sourceId || highlightNode === destId);
  const hasConnectionModules = activeConnectionModules.length > 0;
  const anyModuleHighlight =
    hasConnectionModules && highlightModule && activeConnectionModules.includes(highlightModule);
  const dimLine =
    (hasConnectionModules && highlightModule && !anyModuleHighlight) ||
    (highlightNode && !nodeHighlight);

  const px1 = particleReverse ? x2 : x1;
  const py1 = particleReverse ? y2 : y1;
  const px2 = particleReverse ? x1 : x2;
  const py2 = particleReverse ? y1 : y2;

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={dimLine ? '#f0f0f0' : '#b8b8b8'}
        strokeWidth={dimLine ? 0.7 : 1}
        opacity={dimLine ? 0.45 : 0.68}
        strokeDasharray="6,4"
      />
      {showPipeline && (
        <ConnectionPipeline
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          pipeline={pipeline}
          modules={moduleMap}
          highlightModule={highlightModule}
          dimLine={dimLine}
          onStageHover={onStageHover}
          onModuleClick={onModuleClick}
          chipScale={chipScale}
        />
      )}
      {!showPipeline &&
        activeConnectionModules.map((mod, mi) => {
          const perpAngle = ((angle + 90) * Math.PI) / 180;
          const n = activeConnectionModules.length;
          const offset = (mi - (n - 1) / 2) * 10;
          const ox = offset * Math.cos(perpAngle);
          const oy = offset * Math.sin(perpAngle);
          const modDimmed = highlightModule && highlightModule !== mod;
          return (
            <circle
              key={mod}
              cx={mx + ox}
              cy={my + oy}
              r={3}
              fill={modDimmed ? '#eee' : moduleMap[mod].color}
              opacity={modDimmed ? 0.2 : 0.5}
              style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onModuleClick?.(mod);
              }}
            />
          );
        })}
      {showParticle && (
        <circle r={3.4} fill={particleColor || '#455A64'} opacity={0.8}>
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={`M${px1},${py1} L${px2},${py2}`}
          />
        </circle>
      )}
    </g>
  );
}
