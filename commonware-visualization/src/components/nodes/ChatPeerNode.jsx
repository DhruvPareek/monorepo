import { CHAT_MODULES } from '../../data/chat/modules';
import { CHAT_PEER_INTERNAL } from '../../data/chat/pipelines';

const CHIP_TEXT = {
  cryptography: 'CR',
  p2p: 'P2',
  runtime: 'RT',
};

export default function ChatPeerNode({
  peer,
  isBootstrapper,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  onClick,
  onMouseEnter,
  onMouseLeave,
  variant = 'compact',
  offline = false,
  unauthorized = false,
  pulseBootstrapper = false,
  pulseRejected = false,
}) {
  const { x, y, label } = peer;
  const expanded = variant === 'expanded';
  const radius = expanded ? 110 : 42;
  const ringRadius = expanded ? 122 : 51;
  const rejectionRingRadius = expanded ? 132 : 60;
  const titleY = y - (expanded ? 34 : 12);
  const titleSize = expanded ? 24 : 14;
  const chipRadius = expanded ? 13.5 : 5.4;
  const chipTextSize = expanded ? 8.4 : 5.1;
  const chipLabelSize = expanded ? 8 : 0;
  const topRowY = y + (expanded ? 2 : 6);
  const bottomRowY = y + (expanded ? 60 : 20);

  const fill = unauthorized ? '#FFF5F5' : offline ? '#FAFAFA' : 'white';
  const stroke = unauthorized ? '#C62828' : offline ? '#B0BEC5' : highlighted ? 'black' : '#9E9E9E';
  const statusText = unauthorized ? 'rejected' : offline ? 'offline' : isBootstrapper ? 'bootstrapper' : null;
  const statusColor = unauthorized ? '#C62828' : offline ? '#78909C' : '#FF8F00';

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
          opacity={pulseBootstrapper ? 0.85 : expanded ? 0.55 : 0.22}
        >
          {pulseBootstrapper && (
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

      {unauthorized && (
        <circle
          cx={x}
          cy={y}
          r={rejectionRingRadius}
          fill="none"
          stroke="#C62828"
          strokeWidth={1.5}
          strokeDasharray="4,5"
          opacity={pulseRejected ? 0.88 : 0.4}
        >
          {pulseRejected && (
            <>
              <animate
                attributeName="r"
                values={`${rejectionRingRadius - 2};${rejectionRingRadius + 4};${rejectionRingRadius - 2}`}
                dur="1.2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.85;0.18;0.85"
                dur="1.2s"
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
        fill={fill}
        stroke={stroke}
        strokeWidth={highlighted || unauthorized ? 1.8 : 1.2}
        strokeDasharray={offline ? '4,4' : undefined}
      />

      <text
        x={x}
        y={titleY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={unauthorized ? '#B71C1C' : 'black'}
        fontSize={titleSize}
        fontFamily="monospace"
        fontWeight={700}
      >
        {label}
      </text>

      {statusText && (
        <text
          x={x}
          y={y + radius + (expanded ? 24 : 16)}
          textAnchor="middle"
          fill={statusColor}
          fontSize={expanded ? 9 : 7}
          fontFamily="monospace"
          fontWeight={700}
          opacity={expanded || pulseBootstrapper || pulseRejected || offline ? 1 : 0.44}
        >
          {statusText}
        </text>
      )}

      {CHAT_PEER_INTERNAL.map((item, index) => {
        const mod = CHAT_MODULES[item.module];
        const topRow = index < 3;
        const col = topRow ? index : index - 3;
        const dotX = expanded ? x + (col - 1) * 46 : x + (col - 1) * 14;
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
              opacity={modHighlighted ? 1 : 0.82}
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
