export default function FloodMonitoringNode({
  node,
  highlighted,
  dimmed,
  onMouseEnter,
  onMouseLeave,
}) {
  const services = ['Prometheus', 'Grafana', 'Loki', 'Tempo', 'Pyroscope'];

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
        rx={8}
        fill="white"
        stroke={highlighted ? 'black' : '#9E9E9E'}
        strokeWidth={highlighted ? 1.8 : 1.2}
      />
      <text
        x={node.x}
        y={node.y - 36}
        textAnchor="middle"
        fill="black"
        fontSize={13}
        fontFamily="monospace"
        fontWeight={700}
      >
        MONITORING
      </text>
      <text
        x={node.x}
        y={node.y - 20}
        textAnchor="middle"
        fill="#666"
        fontSize={8}
        fontFamily="monospace"
      >
        shared observability sink
      </text>
      {services.map((service, index) => (
        <text
          key={service}
          x={node.x}
          y={node.y + index * 13 - 2}
          textAnchor="middle"
          fill="#444"
          fontSize={9}
          fontFamily="monospace"
          fontWeight={index === 1 ? 700 : 500}
        >
          {service}
        </text>
      ))}
    </g>
  );
}
