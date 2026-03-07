import { MODULES as BRIDGE_MODULES } from '../../data/modules';

// A single pipeline stage chip: colored rounded rect with label
function PipelineChip({
  x,
  y,
  stage,
  modules,
  highlighted,
  dimmed,
  onMouseEnter,
  onMouseLeave,
  onClick,
  chipScale,
}) {
  const mod = modules[stage.module];
  if (!mod) return null;

  const isCenter = stage.side === 'center';
  const isInner = stage.side === 'inner';
  const w = (isCenter ? 56 : isInner ? 54 : 44) * chipScale;
  const h = 18 * chipScale;
  const opacity = dimmed ? 0.1 : 1;

  // Tab/socket connectors on left and right edges
  const tabSize = 3 * chipScale;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      cursor="pointer"
    >
      {/* Main chip body */}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={3}
        ry={3}
        fill={mod.color}
        opacity={highlighted ? 1 : 0.8}
        stroke={highlighted ? 'black' : 'none'}
        strokeWidth={highlighted ? 1.5 : 0}
      />
      {/* Right tab (protruding nub) */}
      {stage.side !== 'dest' && (
        <circle
          cx={x + w / 2}
          cy={y}
          r={tabSize}
          fill={mod.color}
          opacity={highlighted ? 1 : 0.8}
        />
      )}
      {/* Left socket (indentation shown as white circle) */}
      {stage.side !== 'source' && (
        <circle
          cx={x - w / 2}
          cy={y}
          r={tabSize}
          fill="white"
          stroke={mod.color}
          strokeWidth={1}
          opacity={highlighted ? 1 : 0.8}
        />
      )}
      {/* Module label */}
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={((isCenter || isInner) ? 8 : 7) * chipScale}
        fontFamily="monospace"
        fontWeight={600}
      >
        {stage.label}
      </text>
    </g>
  );
}

// Renders a full pipeline of module chips along a line from (x1,y1) to (x2,y2).
// The pipeline stages are evenly distributed along the connection.
export default function ConnectionPipeline({
  x1,
  y1,
  x2,
  y2,
  pipeline,
  modules: modulesProp,
  highlightModule,
  dimLine,
  onStageHover,
  onModuleClick,
  startT: startTProp,
  endT: endTProp,
  chipScale = 1,
}) {
  const modules = modulesProp || BRIDGE_MODULES;
  const n = pipeline.length;
  // Place chips along the middle portion of the line to leave room near nodes
  const startT = startTProp ?? 0.2;
  const endT = endTProp ?? 0.8;

  return (
    <g>
      {pipeline.map((stage, i) => {
        const t = n === 1 ? 0.5 : startT + (endT - startT) * (i / (n - 1));
        const cx = x1 + (x2 - x1) * t;
        const cy = y1 + (y2 - y1) * t;

        const isHighlighted = highlightModule === stage.module;
        const isDimmed = highlightModule && highlightModule !== stage.module;

        return (
          <PipelineChip
            key={`${stage.module}-${stage.side}-${i}`}
            x={cx}
            y={cy}
            stage={stage}
            modules={modules}
            highlighted={isHighlighted}
            dimmed={isDimmed}
            onMouseEnter={() => onStageHover?.(stage)}
            onMouseLeave={() => onStageHover?.(null)}
            onClick={(e) => { e.stopPropagation(); onModuleClick?.(stage.module); }}
            chipScale={chipScale}
          />
        );
      })}
    </g>
  );
}
