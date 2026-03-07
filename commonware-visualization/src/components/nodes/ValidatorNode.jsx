import { MODULES } from '../../data/modules';
import { VALIDATOR_INTERNAL } from '../../data/pipelines';

const CHIP_TEXT = {
  storage: 'ST',
  parallel: 'PL',
  runtime: 'RT',
};

export default function ValidatorNode({
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
  const radius = expanded ? 90 : 26;
  const moduleGap = expanded ? 62 : 14;
  const moduleY = y + (expanded ? 22 : 9);
  const moduleRadius = expanded ? 18 : 3.5;
  const labelSize = expanded ? 20 : 11;
  const moduleTextSize = expanded ? 10 : 4;
  const moduleLabelSize = expanded ? 9 : 0;
  const titleY = y - (expanded ? 28 : 6);
  const allowModuleClick = expanded;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      cursor="pointer"
    >
      {isLeader && (
        <circle cx={x} cy={y} r={radius + 8} fill="none" stroke="#7B1FA2" strokeWidth={1.5}>
          <animate
            attributeName="r"
            values={`${radius + 6};${radius + 12};${radius + 6}`}
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
        strokeWidth={highlighted ? 1.5 : 1}
      />
      {/* Validator label */}
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
      {/* Internal module indicators (small colored dots) */}
      {VALIDATOR_INTERNAL.map((item, i) => {
        const mod = MODULES[item.module];
        const n = VALIDATOR_INTERNAL.length;
        const dotX = x + (i - (n - 1) / 2) * moduleGap;
        const middleIdx = Math.floor(n / 2);
        const dotY = expanded
          ? i === middleIdx
            ? moduleY + 16
            : moduleY - 8
          : moduleY;
        const modHighlighted = highlightModule === item.module;
        const modDimmed = highlightModule && highlightModule !== item.module;
        return (
          <g
            key={item.module}
            opacity={modDimmed ? 0.15 : 1}
            style={{ transition: 'opacity 0.3s', cursor: allowModuleClick ? 'pointer' : 'default' }}
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
              y={dotY + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={modHighlighted ? moduleTextSize + 1 : moduleTextSize}
              fontFamily="monospace"
              fontWeight={700}
            >
              {CHIP_TEXT[item.module] ?? item.module.slice(0, 2).toUpperCase()}
            </text>
            {expanded && (
              <text
                x={dotX}
                y={dotY + 31}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#444"
                fontSize={moduleLabelSize}
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
