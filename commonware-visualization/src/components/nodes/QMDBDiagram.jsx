// Derive a fake root hash from the op count
function rootHash(opCount) {
  const h = ((opCount * 2654435761) >>> 0).toString(16).padStart(8, '0');
  return `0x${h.slice(0, 2)}..${h.slice(6)}`;
}

export default function QMDBDiagram({
  x,
  y,
  width,
  height,
  opCount,
  animatingOps,
  highlighted,
  dimmed,
  color,
}) {
  const rx = x - width / 2;
  const ry = y - height / 2;
  const modOpacity = dimmed ? 0.15 : 1;

  // Last 4 ops as leaf labels
  const leaves = [];
  for (let i = Math.max(1, opCount - 3); i <= Math.max(opCount, 1); i++) {
    leaves.push(i);
  }
  // Pad to 4 if not enough ops
  while (leaves.length < 4) leaves.unshift(0);

  const ellipsisPad = opCount > 4 ? 16 : 0;
  const leafW = (width - 40 - ellipsisPad) / 4;
  const leafH = 22;
  const leafY = ry + height - 42;
  const leafStartX = rx + 12 + ellipsisPad;

  // Label
  const labelY = ry + 14;

  // Root box
  const rootW = width - 24;
  const rootH = 26;
  const rootX = rx + 12;
  const rootY = ry + 26;

  // Dots row (tree middle)
  const dotsY = ry + rootH + 30;

  // Connecting lines from root to dots
  const rootCenterX = rootX + rootW / 2;
  const rootBottom = rootY + rootH;

  // Connecting lines from dots to leaves
  const dotSpacing = 20;
  const dotsCenterX = rootCenterX;

  return (
    <g opacity={modOpacity} style={{ transition: 'opacity 0.3s' }}>
      {/* Background */}
      <rect
        x={rx}
        y={ry}
        width={width}
        height={height}
        rx={6}
        fill={color}
        opacity={highlighted ? 0.18 : 0.12}
        stroke={color}
        strokeOpacity={highlighted ? 0.6 : 0.4}
        strokeWidth={highlighted ? 1.5 : 1}
      />

      {/* QMDB label */}
      <text
        x={rx + width / 2}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={9}
        fontFamily="monospace"
        fontWeight={700}
        opacity={0.7}
      >
        QMDB
      </text>

      {/* Root hash box */}
      <rect
        x={rootX}
        y={rootY}
        width={rootW}
        height={rootH}
        rx={4}
        fill={color}
        opacity={0.15}
        stroke={color}
        strokeOpacity={0.4}
        strokeWidth={0.5}
      />
      <text
        x={rootX + rootW / 2}
        y={rootY + rootH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={9}
        fontFamily="monospace"
        fontWeight={700}
      >
        ROOT: {rootHash(opCount)}
      </text>

      {/* Connecting lines: root -> dots */}
      <line
        x1={rootCenterX}
        y1={rootBottom}
        x2={rootCenterX}
        y2={dotsY - 4}
        stroke={color}
        strokeOpacity={0.2}
        strokeWidth={0.8}
      />

      {/* Tree dots (elided levels) */}
      {[-1, 0, 1].map((offset) => (
        <circle
          key={offset}
          cx={dotsCenterX + offset * dotSpacing}
          cy={dotsY}
          r={2}
          fill={color}
          opacity={0.3}
        />
      ))}

      {/* Connecting lines: dots -> leaf area */}
      {opCount > 4 && (
        <line
          x1={dotsCenterX - dotSpacing}
          y1={dotsY + 4}
          x2={leafStartX - 10}
          y2={leafY + leafH / 2}
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth={0.5}
        />
      )}
      <line
        x1={dotsCenterX - dotSpacing}
        y1={dotsY + 4}
        x2={leafStartX + leafW / 2}
        y2={leafY - 4}
        stroke={color}
        strokeOpacity={0.15}
        strokeWidth={0.5}
      />
      <line
        x1={dotsCenterX + dotSpacing}
        y1={dotsY + 4}
        x2={leafStartX + 3.5 * leafW + 12}
        y2={leafY - 4}
        stroke={color}
        strokeOpacity={0.15}
        strokeWidth={0.5}
      />

      {/* Ellipsis before first leaf when there are earlier ops */}
      {opCount > 4 && (
        <text
          x={leafStartX - 2}
          y={leafY + leafH / 2}
          textAnchor="end"
          dominantBaseline="central"
          fill={color}
          fontSize={10}
          fontFamily="monospace"
          fontWeight={700}
          opacity={0.4}
        >
          ...
        </text>
      )}

      {/* Leaf ops */}
      {leaves.map((op, i) => {
        const lx = leafStartX + i * (leafW + 4);
        const isAnimating = animatingOps && animatingOps.has(op);
        const label = op > 0 ? `OP ..${op}` : '';
        return (
          <g key={i}>
            <rect
              x={lx}
              y={leafY}
              width={leafW}
              height={leafH}
              rx={3}
              fill={color}
              opacity={isAnimating ? 0.5 : 0.12}
              stroke={color}
              strokeOpacity={isAnimating ? 0.8 : 0.3}
              strokeWidth={isAnimating ? 1.5 : 0.5}
            >
              {isAnimating && (
                <animate
                  attributeName="opacity"
                  values="0.5;0.2;0.5"
                  dur="0.6s"
                  repeatCount="1"
                />
              )}
            </rect>
            <text
              x={lx + leafW / 2}
              y={leafY + leafH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={color}
              fontSize={7}
              fontFamily="monospace"
              fontWeight={600}
              opacity={op > 0 ? 0.8 : 0.2}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Op counter */}
      <text
        x={rx + width / 2}
        y={leafY + leafH + 14}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={8}
        fontFamily="monospace"
        opacity={0.5}
      >
        ops: {opCount}
      </text>
    </g>
  );
}
