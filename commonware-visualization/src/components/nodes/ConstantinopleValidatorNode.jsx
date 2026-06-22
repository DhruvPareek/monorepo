import { CONSTANTINOPLE_MODULES } from '../../data/constantinople/modules';
import { VALIDATOR_INTERNAL } from '../../data/constantinople/pipelines';

const CHIP_TEXT = {
  consensus: 'CS',
  marshal: 'MA',
  storage: 'ST',
  glue: 'GL',
  mempool: 'MP',
  p2p: 'P2',
  resolver: 'RS',
  cryptography: 'CR',
  runtime: 'RT',
};

// Validator circle with a 3x3 grid of internal module dots. The primary fronts
// the mempool; the leader for the current round gets a pulsing ring.
export default function ConstantinopleValidatorNode({
  validator,
  isLeader,
  isPrimary,
  pulsing,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) {
  const { x, y, label } = validator;
  const opacity = dimmed ? 0.2 : 1;
  const radius = 46;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {isLeader && (
        <circle cx={x} cy={y} r={radius + 9} fill="none" stroke="#7B1FA2" strokeWidth={1.8}>
          <animate
            attributeName="r"
            values={`${radius + 6};${radius + 13};${radius + 6}`}
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0.2;0.7"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {pulsing && !isLeader && (
        <circle cx={x} cy={y} r={radius + 6} fill="none" stroke="#00695C" strokeWidth={1.6}>
          <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="white"
        stroke={highlighted ? 'black' : '#999'}
        strokeWidth={highlighted ? 1.8 : 1.2}
      />
      <text
        x={x}
        y={y - radius + 13}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={13}
        fontFamily="monospace"
        fontWeight={700}
      >
        {label}
      </text>
      {isPrimary && (
        <text
          x={x}
          y={y - radius + 24}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#1565C0"
          fontSize={6.5}
          fontFamily="monospace"
          fontWeight={700}
        >
          primary
        </text>
      )}
      {VALIDATOR_INTERNAL.map((item, i) => {
        const mod = CONSTANTINOPLE_MODULES[item.module];
        const cols = 3;
        const row = Math.floor(i / cols);
        const col = i % cols;
        const dotX = x + (col - 1) * 18;
        const dotY = y - 2 + row * 16;
        const modHighlighted = highlightModule === item.module;
        const modDimmed = highlightModule && highlightModule !== item.module;
        return (
          <g
            key={item.module}
            opacity={modDimmed ? 0.15 : 1}
            style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onModuleClick?.(item.module);
            }}
          >
            <circle
              cx={dotX}
              cy={dotY}
              r={modHighlighted ? 8 : 6.5}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.78}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1 : 0}
            />
            <text
              x={dotX}
              y={dotY + 0.8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={modHighlighted ? 6 : 5.2}
              fontFamily="monospace"
              fontWeight={700}
            >
              {CHIP_TEXT[item.module]}
            </text>
          </g>
        );
      })}
    </g>
  );
}
