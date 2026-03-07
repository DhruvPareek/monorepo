import ConnectionPipeline from './ConnectionPipeline';
import { VALIDATOR_INDEXER_MODULES } from '../../data/layout';
import { STREAM_PIPELINE } from '../../data/pipelines';
import { MODULES } from '../../data/modules';

export default function StreamConnection({
  validator,
  indexer,
  highlightModule,
  highlightNode,
  phase,
  activeNetwork,
  showPipeline,
  onStageHover,
  onModuleClick,
}) {
  const { x: vx, y: vy, id: vid, network } = validator;
  const { x: ix, y: iy } = indexer;

  const mx = (vx + ix) / 2;
  const my = (vy + iy) / 2;
  const angle = (Math.atan2(iy - vy, ix - vx) * 180) / Math.PI;

  const nodeHighlight = highlightNode && (highlightNode === vid || highlightNode === 'indexer');
  const anyModuleHighlight =
    highlightModule && VALIDATOR_INDEXER_MODULES.includes(highlightModule);
  const dimLine =
    (highlightModule && !anyModuleHighlight) ||
    (highlightNode && !nodeHighlight);

  const isActiveNet = network === `Network ${activeNetwork}`;
  const showCertParticle = isActiveNet && phase === 'FINALIZE';
  const showBridgeParticle = !isActiveNet && phase === 'BRIDGE';

  return (
    <g>
      <line
        x1={vx}
        y1={vy}
        x2={ix}
        y2={iy}
        stroke={dimLine ? '#f0f0f0' : '#b8b8b8'}
        strokeWidth={dimLine ? 0.7 : 1}
        opacity={dimLine ? 0.45 : 0.68}
        strokeDasharray="6,4"
      />
      {/* Full pipeline on one representative connection per cluster */}
      {showPipeline && (
        <ConnectionPipeline
          x1={vx}
          y1={vy}
          x2={ix}
          y2={iy}
          pipeline={STREAM_PIPELINE}
          highlightModule={highlightModule}
          dimLine={dimLine}
          onStageHover={onStageHover}
          onModuleClick={onModuleClick}
        />
      )}
      {/* Small colored dots on other connections */}
      {!showPipeline &&
        VALIDATOR_INDEXER_MODULES.map((mod, mi) => {
          const perpAngle = (angle + 90) * (Math.PI / 180);
          const offset = (mi - 0.5) * 8;
          const ox = offset * Math.cos(perpAngle);
          const oy = offset * Math.sin(perpAngle);
          const modDimmed = highlightModule && highlightModule !== mod;
          return (
            <circle
              key={mod}
              cx={mx + ox}
              cy={my + oy}
              r={2.5}
              fill={modDimmed ? '#eee' : MODULES[mod].color}
              opacity={modDimmed ? 0.2 : 0.5}
              style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onModuleClick?.(mod); }}
            />
          );
        })}
      {showCertParticle && (
        <polygon points="0,-4 4,0 0,4 -4,0" fill="#F57C00" opacity={0.8}>
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={`M${vx},${vy} L${ix},${iy}`}
          />
        </polygon>
      )}
      {showBridgeParticle && (
        <circle r={3.5} fill="url(#bridgeGradient)" opacity={0.8}>
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={`M${ix},${iy} L${vx},${vy}`}
          />
        </circle>
      )}
    </g>
  );
}
