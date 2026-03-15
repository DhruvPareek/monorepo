import { LOG_MODULES } from '../../data/log/modules';
import { PARTICIPANT_INTERNAL_MODULES } from '../../data/log/layout';

const CHIP_TEXT = {
  consensus: 'CS',
  p2p: 'P2',
  cryptography: 'CR',
  storage: 'ST',
  parallel: 'PL',
  runtime: 'RT',
};

export default function LogParticipantNode({
  participant,
  highlighted,
  dimmed,
  isLeader,
  isBootstrapper,
  highlightModule,
  onModuleClick,
  onClick,
  onMouseEnter,
  onMouseLeave,
  variant = 'compact',
}) {
  const { x, y, label } = participant;
  const expanded = variant === 'expanded';
  const radius = expanded ? 114 : 58;
  const chipRadius = expanded ? 13 : 7.5;
  const titleY = y - (expanded ? 48 : 28);
  const titleSize = expanded ? 24 : 17;
  const chipTextSize = expanded ? 8.2 : 7;
  const chipLabelSize = expanded ? 8 : 0;
  const xStep = expanded ? 52 : 18;
  const yStep = expanded ? 56 : 22;
  const startY = y - (expanded ? 24 : 8);
  const allowModuleClick = expanded;

  return (
    <g
      style={{ opacity: dimmed ? 0.22 : 1, transition: 'opacity 0.3s' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {isLeader && (
        <circle
          cx={x}
          cy={y}
          r={radius + (expanded ? 13 : 10)}
          fill="none"
          stroke="#7B1FA2"
          strokeWidth={1.7}
        >
          <animate
            attributeName="r"
            values={`${radius + 8};${radius + 14};${radius + 8}`}
            dur="1.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.75;0.2;0.75"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {isBootstrapper && (
        <circle
          cx={x}
          cy={y}
          r={radius + (expanded ? 25 : 20)}
          fill="none"
          stroke="#FF8F00"
          strokeWidth={1.4}
          strokeDasharray="5,4"
          opacity={expanded ? 0.55 : 0.32}
        />
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
        fontSize={titleSize}
        fontFamily="monospace"
        fontWeight={700}
      >
        {label}
      </text>

      {PARTICIPANT_INTERNAL_MODULES.map((moduleName, index) => {
        const mod = LOG_MODULES[moduleName];
        const col = index % 3;
        const row = Math.floor(index / 3);
        const chipX = x + (col - 1) * xStep;
        const chipY = startY + row * yStep;
        const modHighlighted = highlightModule === moduleName;
        const modDimmed = highlightModule && highlightModule !== moduleName;

        return (
          <g
            key={moduleName}
            opacity={modDimmed ? 0.15 : 1}
            style={{
              transition: 'opacity 0.3s',
              cursor: allowModuleClick ? 'pointer' : 'default',
            }}
            onClick={
              allowModuleClick
                ? (e) => {
                    e.stopPropagation();
                    onModuleClick?.(moduleName);
                  }
                : undefined
            }
          >
            <circle
              cx={chipX}
              cy={chipY}
              r={modHighlighted ? chipRadius + 2 : chipRadius}
              fill={mod.color}
              opacity={modHighlighted ? 1 : 0.82}
              stroke={modHighlighted ? 'black' : 'none'}
              strokeWidth={modHighlighted ? 1 : 0}
            />
            <text
              x={chipX}
              y={chipY + 0.7}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={modHighlighted ? chipTextSize + 1 : chipTextSize}
              fontFamily="monospace"
              fontWeight={700}
            >
              {CHIP_TEXT[moduleName]}
            </text>
            {expanded && (
              <text
                x={chipX}
                y={chipY + 18}
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
