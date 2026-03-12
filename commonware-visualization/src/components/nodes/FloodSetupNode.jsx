import { FLOOD_MODULES } from '../../data/flood/modules';

export default function FloodSetupNode({
  node,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onMouseEnter,
  onMouseLeave,
}) {
  const setupModules = ['cryptography', 'codec', 'deployer'].map((key) => ({
    key,
    ...FLOOD_MODULES[key],
  }));

  return (
    <g
      style={{ opacity: dimmed ? 0.22 : 1, transition: 'opacity 0.3s' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <rect
        x={node.x - node.width / 2}
        y={node.y - node.height / 2}
        width={node.width}
        height={node.height}
        rx={6}
        fill="white"
        stroke={highlighted ? 'black' : '#9E9E9E'}
        strokeWidth={highlighted ? 1.8 : 1.2}
      />
      <text
        x={node.x}
        y={node.y - 16}
        textAnchor="middle"
        fill="black"
        fontSize={13}
        fontFamily="monospace"
        fontWeight={700}
      >
        SETUP
      </text>
      <text
        x={node.x}
        y={node.y + 2}
        textAnchor="middle"
        fill="#666"
        fontSize={8}
        fontFamily="monospace"
      >
        local artifact generation
      </text>
      {setupModules.map((mod, index) => {
        const chipWidth = mod.key === 'cryptography' ? 68 : 56;
        const gap = 8;
        const totalWidth =
          setupModules.reduce(
            (sum, item) => sum + (item.key === 'cryptography' ? 68 : 56),
            0
          ) +
          gap * (setupModules.length - 1);
        const x =
          node.x -
          totalWidth / 2 +
          setupModules
            .slice(0, index)
            .reduce(
              (sum, item) => sum + (item.key === 'cryptography' ? 68 : 56) + gap,
              0
            );
        const modHighlighted = highlightModule === mod.key;
        const modDimmed = highlightModule && highlightModule !== mod.key;
        return (
          <g
            key={mod.key}
            opacity={modDimmed ? 0.15 : 1}
            style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onModuleClick?.(mod.key);
            }}
          >
            <rect
              x={x}
              y={node.y + 12}
              width={chipWidth}
              height={20}
              rx={4}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.84}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1.2 : 0}
            />
            <text
              x={x + chipWidth / 2}
              y={node.y + 22}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={8}
              fontFamily="monospace"
              fontWeight={700}
            >
              {mod.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
