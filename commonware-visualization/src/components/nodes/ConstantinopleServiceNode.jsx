import { CONSTANTINOPLE_MODULES } from '../../data/constantinople/modules';

const CHIP_TEXT = {
  consensus: 'CS',
  marshal: 'MA',
  storage: 'ST',
  glue: 'GL',
  mempool: 'MP',
  p2p: 'P2',
  resolver: 'RS',
  cryptography: 'CR',
  codec: 'CD',
  runtime: 'RT',
};

// Off-cluster service node (spammer, indexer, explorer). The `shape` controls
// the outline: a rounded rect for clients/services, a hexagon for the indexer,
// and a dashed rect for the non-validating explorer.
export default function ConstantinopleServiceNode({
  x,
  y,
  label,
  sublabel,
  internal,
  shape = 'rect',
  pulsing,
  pulseColor = '#1565C0',
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) {
  const opacity = dimmed ? 0.2 : 1;
  const w = 132;
  const h = 84;
  const left = x - w / 2;
  const top = y - h / 2;

  const stroke = highlighted ? 'black' : '#999';
  const strokeWidth = highlighted ? 1.8 : 1.2;

  let outline;
  if (shape === 'hex') {
    const hx = w / 2;
    const hy = h / 2;
    const inset = 22;
    const pts = [
      [x - hx + inset, y - hy],
      [x + hx - inset, y - hy],
      [x + hx, y],
      [x + hx - inset, y + hy],
      [x - hx + inset, y + hy],
      [x - hx, y],
    ]
      .map((p) => p.join(','))
      .join(' ');
    outline = (
      <polygon points={pts} fill="white" stroke={stroke} strokeWidth={strokeWidth} />
    );
  } else {
    outline = (
      <rect
        x={left}
        y={top}
        width={w}
        height={h}
        rx={8}
        fill="white"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={shape === 'dashed' ? '6,4' : undefined}
      />
    );
  }

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
          x={left - 5}
          y={top - 5}
          width={w + 10}
          height={h + 10}
          rx={11}
          fill="none"
          stroke={pulseColor}
          strokeWidth={1.6}
        >
          <animate attributeName="opacity" values="0.7;0.15;0.7" dur="1s" repeatCount="indefinite" />
        </rect>
      )}
      {outline}
      <text
        x={x}
        y={top + 16}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={13}
        fontFamily="monospace"
        fontWeight={700}
      >
        {label}
      </text>
      {sublabel && (
        <text
          x={x}
          y={top + 28}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#767676"
          fontSize={7.5}
          fontFamily="monospace"
        >
          {sublabel}
        </text>
      )}
      {internal.map((item, i) => {
        const mod = CONSTANTINOPLE_MODULES[item.module];
        const n = internal.length;
        const step = 34;
        const dotX = x + (i - (n - 1) / 2) * step;
        const dotY = y + 20;
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
              r={modHighlighted ? 9 : 7.5}
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
              fontSize={modHighlighted ? 6.5 : 5.6}
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
