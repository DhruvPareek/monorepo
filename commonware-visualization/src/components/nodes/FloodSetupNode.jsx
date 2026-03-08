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
  const deployer = FLOOD_MODULES.deployer;
  const modHighlighted = highlightModule === 'deployer';
  const modDimmed = highlightModule && highlightModule !== 'deployer';

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
      <g
        opacity={modDimmed ? 0.15 : 1}
        style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onModuleClick?.('deployer');
        }}
      >
        <rect
          x={node.x - 28}
          y={node.y + 12}
          width={56}
          height={20}
          rx={4}
          fill={deployer.color}
          opacity={modHighlighted ? 1 : 0.84}
          stroke={modHighlighted ? 'black' : 'none'}
          strokeWidth={modHighlighted ? 1.2 : 0}
        />
        <text
          x={node.x}
          y={node.y + 22}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={8}
          fontFamily="monospace"
          fontWeight={700}
        >
          deployer
        </text>
      </g>
    </g>
  );
}
