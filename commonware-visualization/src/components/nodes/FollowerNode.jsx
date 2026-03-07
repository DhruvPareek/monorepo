import { ALTO_MODULES } from '../../data/alto/modules';
import { FOLLOWER_INTERNAL } from '../../data/alto/pipelines';

const LETTERS = {
  storage: 'S',
  parallel: 'P',
  resolver: 'R',
  runtime: 'RT',
};

export default function FollowerNode({
  x,
  y,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onClick,
  onMouseEnter,
  onMouseLeave,
  pulsing,
  variant = 'compact',
}) {
  const expanded = variant === 'expanded';
  const w = expanded ? 260 : 124;
  const h = expanded ? 150 : 70;
  const opacity = dimmed ? 0.2 : 1;
  const moduleGap = expanded ? 58 : 22;
  const moduleY = y + (expanded ? 25 : 11);
  const moduleRadius = expanded ? 16 : 4.5;
  const titleY = y - (expanded ? 38 : 16);
  const titleSize = expanded ? 24 : 12;
  const chipTextSize = expanded ? 10 : 5;
  const chipLabelSize = expanded ? 10 : 0;
  const allowModuleClick = expanded;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {pulsing && (
        <rect
          x={x - w / 2 - 4}
          y={y - h / 2 - 4}
          width={w + 8}
          height={h + 8}
          rx={8}
          fill="none"
          stroke="#2E7D32"
          strokeWidth={1.8}
        >
          <animate
            attributeName="opacity"
            values="0.7;0.15;0.7"
            dur="1s"
            repeatCount="indefinite"
          />
        </rect>
      )}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={6}
        fill="white"
        stroke={highlighted ? 'black' : '#999'}
        strokeWidth={highlighted ? 1.8 : 1.2}
        strokeDasharray="4,2"
      />
      <text
        x={x}
        y={titleY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={titleSize}
        fontFamily="monospace"
        fontWeight={700}
      >
        FOLLOWER
      </text>
      {FOLLOWER_INTERNAL.map((item, i) => {
        const mod = ALTO_MODULES[item.module];
        const n = FOLLOWER_INTERNAL.length;
        const dotX = x + (i - (n - 1) / 2) * moduleGap;
        const dotY = moduleY;
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
              {LETTERS[item.module]}
            </text>
            {expanded && (
              <text
                x={dotX}
                y={dotY + 30}
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
