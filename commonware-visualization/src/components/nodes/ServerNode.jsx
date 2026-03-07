import { SYNC_MODULES } from '../../data/sync/modules';
import QMDBDiagram from './QMDBDiagram';

export default function ServerNode({
  x,
  y,
  width,
  height,
  highlighted,
  dimmed,
  highlightModule,
  onModuleClick,
  phase,
  opCount,
  animatingOps,
  onMouseEnter,
  onMouseLeave,
}) {
  const opacity = dimmed ? 0.2 : 1;
  const rx = x - width / 2;
  const ry = y - height / 2;

  // Server pulses when it has animating ops (new ops just added)
  const isAdding = animatingOps && animatingOps.size > 0;

  const storageMod = SYNC_MODULES.storage;
  const cryptoMod = SYNC_MODULES.cryptography;
  const storageHighlighted = highlightModule === 'storage';
  const storageDimmed = highlightModule && highlightModule !== 'storage';
  const cryptoHighlighted = highlightModule === 'cryptography';
  const cryptoDimmed = highlightModule && highlightModule !== 'cryptography';

  // QMDB diagram area
  const diagramW = width - 20;
  const diagramH = 180;
  const diagramY = ry + 48 + diagramH / 2;

  // Crypto chip below diagram
  const chipW = 120;
  const chipH = 36;
  const chipY = diagramY + diagramH / 2 + 28;

  return (
    <g
      style={{ opacity, transition: 'opacity 0.3s' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor="pointer"
    >
      {/* Pulse ring when adding ops */}
      {isAdding && (
        <rect
          x={rx - 4}
          y={ry - 4}
          width={width + 8}
          height={height + 8}
          rx={8}
          ry={8}
          fill="none"
          stroke="#795548"
          strokeWidth={1.5}
        >
          <animate
            attributeName="opacity"
            values="0.6;0.15;0.6"
            dur="1s"
            repeatCount="1"
          />
        </rect>
      )}
      {/* Main body */}
      <rect
        x={rx}
        y={ry}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill="white"
        stroke={highlighted ? 'black' : '#999'}
        strokeWidth={highlighted ? 1.5 : 1}
      />
      {/* Label */}
      <text
        x={x}
        y={ry + 24}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="black"
        fontSize={12}
        fontFamily="monospace"
        fontWeight={700}
      >
        SERVER
      </text>

      {/* QMDB Diagram (replaces storage chip) */}
      <g onClick={(e) => { e.stopPropagation(); onModuleClick?.('storage'); }} cursor="pointer">
        <QMDBDiagram
          x={x}
          y={diagramY}
          width={diagramW}
          height={diagramH}
          opCount={opCount}
          animatingOps={animatingOps}
          highlighted={storageHighlighted}
          dimmed={storageDimmed}
          color={storageMod.color}
        />
      </g>

      {/* Cryptography chip */}
      <g opacity={cryptoDimmed ? 0.15 : 1} style={{ transition: 'opacity 0.3s', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onModuleClick?.('cryptography'); }}>
        <rect
          x={x - chipW / 2}
          y={chipY - chipH / 2}
          width={chipW}
          height={chipH}
          rx={4}
          fill={cryptoMod.color}
          opacity={cryptoHighlighted ? 1 : 0.7}
          stroke={cryptoHighlighted ? 'black' : 'none'}
          strokeWidth={cryptoHighlighted ? 1.5 : 0}
        />
        <text
          x={x}
          y={chipY - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={9}
          fontFamily="monospace"
          fontWeight={700}
        >
          sha256
        </text>
        <text
          x={x}
          y={chipY + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={7}
          fontFamily="monospace"
          opacity={0.8}
        >
          {cryptoMod.short}
        </text>
      </g>
    </g>
  );
}
