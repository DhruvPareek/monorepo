import { ALTO_MODULES } from '../../data/alto/modules';
import { INDEXER_INTERNAL } from '../../data/alto/pipelines';

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

export default function AltoIndexerNode({
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
  const r = expanded ? 110 : 40;
  const opacity = dimmed ? 0.2 : 1;
  const rowY = y + (expanded ? 28 : 11);
  const xStep = expanded ? 96 : 24;
  const rectWidth = expanded ? 72 : 18;
  const rectHeight = expanded ? 34 : 12;
  const chipTextSize = expanded ? 11 : 6;
  const chipLabelSize = expanded ? 10 : 0;
  const titleSize = expanded ? 26 : 12;
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
        <polygon
          points={hexPoints(x, y, r + 8)}
          fill="none"
          stroke="#E65100"
          strokeWidth={1.8}
        >
          <animate
            attributeName="opacity"
            values="0.7;0.15;0.7"
            dur="1s"
            repeatCount="indefinite"
          />
        </polygon>
      )}
      <polygon
        points={hexPoints(x, y, r + 5)}
        fill="none"
        stroke="#E65100"
        strokeWidth={0.5}
        opacity={0.3}
      >
        <animate
          attributeName="opacity"
          values="0.3;0.1;0.3"
          dur="3s"
          repeatCount="indefinite"
        />
      </polygon>
      <polygon
        points={hexPoints(x, y, r)}
        fill="white"
        stroke={highlighted ? 'black' : '#999'}
        strokeWidth={highlighted ? 1.8 : 1.2}
      />
      <text
        x={x}
        y={y - (expanded ? 22 : 8)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={titleSize}
        fontFamily="monospace"
        fontWeight={700}
      >
        INDEXER
      </text>
      {INDEXER_INTERNAL.map((item, i) => {
        const mod = ALTO_MODULES[item.module];
        const dotX = x - xStep / 2 + i * xStep;
        const dotY = rowY;
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
            <rect
              x={dotX - rectWidth / 2}
              y={dotY - rectHeight / 2}
              width={rectWidth}
              height={rectHeight}
              rx={expanded ? 6 : 2}
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
              fontWeight={600}
            >
              {item.label === 'BLS verify' ? 'BLS' : 'RT'}
            </text>
            {expanded && (
              <text
                x={dotX}
                y={dotY + 33}
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
