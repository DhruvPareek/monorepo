// Validator circle for the chain (network) view. Voting primaries are solid
// circles with a V# label (leader ring in purple, execute pulse in teal).
// Non-voting secondaries use the same circle but dashed and muted, with a role
// label and a small caption below - so the quorum still reads as exactly four.
export default function ConstantinopleValidatorNode({
  validator,
  isLeader,
  pulsing,
  highlighted,
  dimmed,
  secondary,
  sublabel,
  pulseColor = '#00695C',
  onClick,
  onMouseEnter,
  onMouseLeave,
}) {
  const { x, y, label } = validator;
  const opacity = dimmed ? 0.2 : 1;
  const radius = 32;
  // Secondaries carry a word (e.g. "Relayer"); primaries carry a short "V#".
  const labelSize = secondary ? 9.5 : 14;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {!secondary && isLeader && (
        <circle cx={x} cy={y} r={radius + 9} fill="none" stroke="#7B1FA2" strokeWidth={1.8}>
          <animate
            attributeName="r"
            values={`${radius + 6};${radius + 13};${radius + 6}`}
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
      {pulsing && (secondary || !isLeader) && (
        <circle cx={x} cy={y} r={radius + 6} fill="none" stroke={pulseColor} strokeWidth={1.6}>
          <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="white"
        stroke={highlighted ? 'black' : secondary ? '#9e9e9e' : '#999'}
        strokeWidth={highlighted ? 1.8 : 1.2}
        strokeDasharray={secondary ? '4,3' : undefined}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={secondary ? '#555' : 'black'}
        fontSize={labelSize}
        fontFamily="monospace"
        fontWeight={700}
      >
        {label}
      </text>
      {secondary && sublabel && (
        <text
          x={x}
          y={y + radius + 11}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#767676"
          fontSize={8}
          fontFamily="monospace"
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}
