import { FLOOD_MODULES } from '../../data/flood/modules';
import { PEER_INTERNAL } from '../../data/flood/pipelines';

const CHIP_TEXT = {
  cryptography: 'CR',
  codec: 'CD',
  p2p: 'P2',
  stream: 'ST',
  runtime: 'RT',
};

export default function FloodPeerNode({
  peer,
  isBootstrapper,
  pulsing,
  bootstrapperActive,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onClick,
  onMouseEnter,
  onMouseLeave,
  variant = 'compact',
}) {
  const { x, y, label } = peer;
  const expanded = variant === 'expanded';
  const radius = expanded ? 108 : 42;
  const ringRadius = expanded ? 120 : 51;
  const titleY = y - (expanded ? 34 : 12);
  const titleSize = expanded ? 24 : 14;
  const chipRadius = expanded ? 14 : 5.5;
  const chipTextSize = expanded ? 8.5 : 5.2;
  const chipLabelSize = expanded ? 8 : 0;
  const topRowY = y + (expanded ? 6 : 6);
  const bottomRowY = y + (expanded ? 60 : 20);
  const bootstrapperRingOpacity = bootstrapperActive
    ? pulsing
      ? 0.85
      : 0.45
    : 0.16;
  const bootstrapperLabelOpacity = bootstrapperActive || expanded ? 1 : 0.34;
  const bootstrapperLabelY = y + radius + (expanded ? 24 : 16);

  return (
    <g
      style={{ opacity: dimmed ? 0.22 : 1, transition: 'opacity 0.3s' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor={onClick ? 'pointer' : 'default'}
    >
      {isBootstrapper && (
        <circle
          cx={x}
          cy={y}
          r={ringRadius}
          fill="none"
          stroke="#FF8F00"
          strokeWidth={1.5}
          strokeDasharray="5,3"
          opacity={bootstrapperRingOpacity}
        >
          {pulsing && (
            <>
              <animate
                attributeName="r"
                values={`${ringRadius - 3};${ringRadius + 3};${ringRadius - 3}`}
                dur="1.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.85;0.25;0.85"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </>
          )}
        </circle>
      )}
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="white"
          stroke={highlighted ? 'black' : '#9E9E9E'}
          strokeWidth={highlighted ? 1.8 : 1.2}
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
        {label}
      </text>
      {isBootstrapper && (
        <text
          x={x}
          y={bootstrapperLabelY}
          textAnchor="middle"
          fill="#FF8F00"
          fontSize={expanded ? 9 : 7}
          fontFamily="monospace"
          fontWeight={700}
          opacity={bootstrapperLabelOpacity}
        >
          bootstrapper
        </text>
      )}
      {PEER_INTERNAL.map((item, index) => {
        const mod = FLOOD_MODULES[item.module];
        const topRow = index < 3;
        const col = topRow ? index : index - 3;
        const dotX = expanded
          ? x + (topRow ? (col - 1) * 46 : col === 0 ? -24 : 24)
          : x + (topRow ? (col - 1) * 14 : col === 0 ? -7 : 7);
        const dotY = topRow ? topRowY : bottomRowY;
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
              r={modHighlighted ? chipRadius + 2 : chipRadius}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.8}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1 : 0}
            />
            <text
              x={dotX}
              y={dotY + (expanded ? 1 : 0.6)}
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
                y={dotY + (topRow ? 24 : 22)}
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
