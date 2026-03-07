import { ALTO_MODULES } from '../../data/alto/modules';
import { VALIDATOR_INTERNAL } from '../../data/alto/pipelines';

const CHIP_TEXT = {
  consensus: 'CS',
  storage: 'ST',
  broadcast: 'BF',
  parallel: 'PL',
  resolver: 'RS',
};

export default function AltoValidatorNode({
  validator,
  isLeader,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onClick,
  onMouseEnter,
  onMouseLeave,
  variant = 'compact',
}) {
  const { x, y, label } = validator;
  const opacity = dimmed ? 0.2 : 1;
  const expanded = variant === 'expanded';
  const radius = expanded ? 106 : 38;
  const moduleGap = expanded ? 54 : 14;
  const moduleY = y + (expanded ? 28 : 14);
  const moduleRadius = expanded ? 14 : 5;
  const titleY = y - (expanded ? 34 : 10);
  const labelSize = expanded ? 23 : 14;
  const chipTextSize = expanded ? 8.5 : 5.5;
  const chipLabelSize = expanded ? 8 : 0;
  const allowModuleClick = expanded;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {isLeader && (
        <circle
          cx={x}
          cy={y}
          r={radius + (expanded ? 12 : 9)}
          fill="none"
          stroke="#7B1FA2"
          strokeWidth={1.8}
        >
          <animate
            attributeName="r"
            values={`${radius + 7};${radius + 13};${radius + 7}`}
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
        y={titleY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={labelSize}
        fontFamily="monospace"
        fontWeight={700}
      >
        {label}
      </text>
      {VALIDATOR_INTERNAL.map((item, i) => {
        const mod = ALTO_MODULES[item.module];
        const n = VALIDATOR_INTERNAL.length;
        const dotX = expanded
          ? i <= 2
            ? x + (i - 1) * 56
            : x + (i === 3 ? -34 : 34)
          : x + (i - (n - 1) / 2) * moduleGap;
        const dotY = expanded ? (i <= 2 ? y + 4 : y + 58) : moduleY;
        const modHighlighted = highlightModule === item.module;
        const modDimmed = highlightModule && highlightModule !== item.module;
        return (
          <g
            key={item.module}
            opacity={modDimmed ? 0.15 : 1}
            style={{
              transition: 'opacity 0.3s',
              cursor: allowModuleClick ? 'pointer' : 'default',
            }}
            onClick={
              allowModuleClick
                ? (e) => {
                    e.stopPropagation();
                    onModuleClick?.(item.module);
                  }
                : undefined
            }
          >
            <circle
              cx={dotX}
              cy={dotY}
              r={modHighlighted ? moduleRadius + 2 : moduleRadius}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.7}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1 : 0}
            />
            <text
              x={dotX}
              y={dotY + 0.8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={modHighlighted ? chipTextSize + 1 : chipTextSize}
              fontFamily="monospace"
              fontWeight={700}
            >
              {CHIP_TEXT[item.module]}
            </text>
            {expanded && (
              <text
                x={dotX}
                y={dotY + (modHighlighted ? 20 : 18)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#444"
                fontSize={chipLabelSize}
                fontFamily="monospace"
                fontWeight={600}
              >
                {mod.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
