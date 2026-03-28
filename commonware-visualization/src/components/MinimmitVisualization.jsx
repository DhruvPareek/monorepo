import { useState, useEffect, useCallback, useRef } from 'react';

// Minimmit parameters: n >= 5f+1, so n=11, f=2
const N = 11;
const F = 2;
const M = 2 * F + 1; // 5 - advance quorum (~45%)
const L = N - F;      // 9 - finalization quorum (~82%)

const C = {
  proposed: '#e2e8f0',
  proposedStroke: '#94a3b8',
  notarized: '#3b82f6',
  notarizedDark: '#2563eb',
  finalized: '#111827',
  finalizedStroke: '#374151',
  nodeIdle: '#f1f5f9',
  nodeIdleStroke: '#cbd5e1',
  nodeVoted: '#1e3a5f',
  nodeVotedStroke: '#0f2744',
  leaderRing: '#3b82f6',
  barBg: '#e2e8f0',
  barM: '#3b82f6',
  barL: '#111827',
  text: '#1e293b',
  muted: '#94a3b8',
  dim: '#cbd5e1',
};

// ─── Animation hook ────────────────────────────────────────────────

const PHASE_PROPOSE = 'PROPOSE';
const PHASE_VOTING = 'VOTING';
const PHASE_NOTARIZED = 'NOTARIZED';
const PHASE_FINALIZED = 'FINALIZED';
const PHASE_SETTLE = 'SETTLE';

const T_PROPOSE_END = 1300;
const T_VOTE_INTERVAL = 340; // faster per-vote for 10 additional voters
const T_ALL_VOTES = T_PROPOSE_END + (N - 1) * T_VOTE_INTERVAL;
const T_SETTLE = 900;
const CYCLE_DURATION = T_ALL_VOTES + T_SETTLE;

function useOverviewAnimation(speedRef) {
  const [state, setState] = useState({ elapsed: 0, view: 0 });
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const dt = (timestamp - lastRef.current) * speedRef.current;
    lastRef.current = timestamp;

    setState((prev) => {
      const next = prev.elapsed + dt;
      if (next >= CYCLE_DURATION) {
        return { elapsed: next - CYCLE_DURATION, view: prev.view + 1 };
      }
      return { elapsed: next, view: prev.view };
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [speedRef]);

  useEffect(() => {
    lastRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  const { elapsed, view } = state;
  const leaderIndex = view % N;

  const otherReplicas = [];
  for (let i = 1; i < N; i++) {
    otherReplicas.push((leaderIndex + i) % N);
  }

  let voteCount = 0;
  let phase = PHASE_PROPOSE;

  if (elapsed < T_PROPOSE_END) {
    voteCount = 1;
    phase = PHASE_PROPOSE;
  } else if (elapsed < T_ALL_VOTES) {
    const votingElapsed = elapsed - T_PROPOSE_END;
    const additionalVotes = Math.min(
      N - 1,
      Math.floor(votingElapsed / T_VOTE_INTERVAL) + 1
    );
    voteCount = 1 + additionalVotes;
    if (voteCount >= L) phase = PHASE_FINALIZED;
    else if (voteCount >= M) phase = PHASE_NOTARIZED;
    else phase = PHASE_VOTING;
  } else {
    voteCount = N;
    phase = PHASE_SETTLE;
  }

  const votedReplicas = new Set([leaderIndex]);
  const votedCount = Math.min(voteCount - 1, otherReplicas.length);
  for (let i = 0; i < votedCount; i++) {
    votedReplicas.add(otherReplicas[i]);
  }

  return { view, phase, voteCount, leaderIndex, votedReplicas, elapsed };
}

// ─── Layout constants ──────────────────────────────────────────────
// Order top-to-bottom: blockchain, notarize votes, validators

const SVG_W = 900;
const SVG_H = 500;

// Chain at top
const CHAIN_Y = 40;
const BLOCK_W = 62;
const BLOCK_H = 36;
const BLOCK_GAP = 16;
const STEP = BLOCK_W + BLOCK_GAP;
const TIP_RIGHT_X = SVG_W - 80;
const RENDER_COUNT = 14;
const FADE_WIDTH = 240;

// Vote bar in the middle
const BAR_Y = 210;
const BAR_X = 180;
const BAR_W = 500;
const BAR_H = 20;

// Validators at bottom - 11 nodes, tighter spacing
const VALIDATOR_ROW_Y = 390;
const VALIDATOR_SPACING = 74;
const VALIDATOR_R = 24;
const VALIDATOR_START_X = (SVG_W - (N - 1) * VALIDATOR_SPACING) / 2;

function vx(i) {
  return VALIDATOR_START_X + i * VALIDATOR_SPACING;
}

// ─── Overview SVG ──────────────────────────────────────────────────

function OverviewScene({ view, phase, voteCount, leaderIndex, votedReplicas, elapsed, speed, onSpeedChange }) {
  const groupOffsetX = TIP_RIGHT_X - BLOCK_W - view * STEP;

  const startView = Math.max(0, view - RENDER_COUNT + 1);
  const blockElements = [];

  for (let v = startView; v <= view; v++) {
    const bx = v * STEP;
    const by = CHAIN_Y;
    const isCurrent = v === view;

    let blockFill, blockStroke, blockTextFill;
    if (!isCurrent) {
      blockFill = C.finalized;
      blockStroke = C.finalizedStroke;
      blockTextFill = '#e2e8f0';
    } else if (voteCount >= L) {
      blockFill = C.finalized;
      blockStroke = C.finalizedStroke;
      blockTextFill = '#e2e8f0';
    } else if (voteCount >= M) {
      blockFill = C.notarized;
      blockStroke = C.notarizedDark;
      blockTextFill = 'white';
    } else {
      blockFill = 'white';
      blockStroke = C.proposedStroke;
      blockTextFill = C.text;
    }

    if (v > startView) {
      blockElements.push(
        <line
          key={`conn${v}`}
          x1={bx - BLOCK_GAP} y1={by + BLOCK_H / 2}
          x2={bx} y2={by + BLOCK_H / 2}
          stroke={C.dim} strokeWidth={1.5}
        />
      );
    }

    if (v === startView) {
      blockElements.push(
        <line
          key="leadingLine"
          x1={bx - 2000} y1={by + BLOCK_H / 2}
          x2={bx} y2={by + BLOCK_H / 2}
          stroke={C.dim} strokeWidth={1.5}
        />
      );
    }

    blockElements.push(
      <g key={`block${v}`}>
        <rect
          x={bx} y={by} width={BLOCK_W} height={BLOCK_H} rx={4}
          fill={blockFill} stroke={blockStroke}
          strokeWidth={isCurrent ? 2 : 1}
          strokeDasharray={isCurrent && voteCount < M ? '4,3' : 'none'}
          style={{ transition: 'fill 0.3s, stroke 0.3s' }}
        />
        <text
          x={bx + BLOCK_W / 2} y={by + BLOCK_H / 2 + 1}
          textAnchor="middle" dominantBaseline="middle"
          fill={blockTextFill} fontSize={11} fontFamily="monospace" fontWeight={700}
          style={{ transition: 'fill 0.3s' }}
        >
          v{v}
        </text>
        {isCurrent && (
          <text
            x={bx + BLOCK_W / 2} y={by + BLOCK_H + 13}
            textAnchor="middle"
            fill={voteCount >= L ? C.finalized : voteCount >= M ? C.notarized : C.muted}
            fontSize={8} fontFamily="monospace" fontWeight={600}
          >
            {voteCount >= L ? 'finalized' : voteCount >= M ? 'notarized' : 'proposed'}
          </text>
        )}
      </g>
    );
  }

  // ── Validators ──
  const validatorElements = [];
  for (let i = 0; i < N; i++) {
    const x = vx(i);
    const y = VALIDATOR_ROW_Y;
    const isLeader = i === leaderIndex;
    const hasVoted = votedReplicas.has(i);

    const fill = hasVoted ? C.nodeVoted : C.nodeIdle;
    const stroke = hasVoted ? C.nodeVotedStroke : C.nodeIdleStroke;
    const textFill = hasVoted ? '#e2e8f0' : C.muted;

    validatorElements.push(
      <g key={`v${i}`}>
        {isLeader && (
          <circle
            cx={x} cy={y} r={VALIDATOR_R + 6}
            fill="none" stroke={C.leaderRing} strokeWidth={1.5} opacity={0.6}
          >
            <animate attributeName="r" values={`${VALIDATOR_R + 4};${VALIDATOR_R + 9};${VALIDATOR_R + 4}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
        <circle
          cx={x} cy={y} r={VALIDATOR_R}
          fill={fill} stroke={stroke} strokeWidth={1.5}
          style={{ transition: 'fill 0.3s, stroke 0.3s' }}
        />
        <text
          x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
          fill={textFill} fontSize={11} fontFamily="monospace" fontWeight={700}
          style={{ transition: 'fill 0.3s' }}
        >
          R{i}
        </text>
        <text
          x={x} y={y + VALIDATOR_R + 12} textAnchor="middle"
          fill={isLeader ? C.leaderRing : hasVoted ? C.muted : 'transparent'}
          fontSize={8} fontFamily="monospace" fontWeight={isLeader ? 700 : 400}
        >
          {isLeader ? 'leader' : hasVoted ? 'voted' : ''}
        </text>
      </g>
    );
  }

  // ── Propagation particles (PROPOSE) ──
  const particles = [];
  if (phase === PHASE_PROPOSE && elapsed > 400) {
    const lx = vx(leaderIndex);
    const ly = VALIDATOR_ROW_Y;
    for (let i = 0; i < N; i++) {
      if (i === leaderIndex) continue;
      const tx = vx(i);
      const dur = 0.7 + i * 0.06;
      particles.push(
        <circle key={`prop${i}`} r={2} fill={C.notarized} opacity={0.6}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={`M${lx},${ly} L${tx},${ly}`} />
        </circle>
      );
    }
  }

  // ── Vote particles (go upward from validators to vote bar) ──
  const voteParticles = [];
  if (elapsed >= T_PROPOSE_END && elapsed < T_ALL_VOTES) {
    const votingElapsed = elapsed - T_PROPOSE_END;
    const currentVoterIdx = Math.min(N - 2, Math.floor(votingElapsed / T_VOTE_INTERVAL));
    const others = [];
    for (let i = 1; i < N; i++) {
      others.push((leaderIndex + i) % N);
    }
    const voterId = others[currentVoterIdx];
    if (voterId !== undefined) {
      const sx = vx(voterId);
      const sy = VALIDATOR_ROW_Y;
      voteParticles.push(
        <circle key="votep" r={2.5} fill={C.nodeVoted} opacity={0.7}>
          <animateMotion dur="0.4s" repeatCount="indefinite" path={`M${sx},${sy - VALIDATOR_R} L${SVG_W / 2},${BAR_Y + BAR_H}`} />
        </circle>
      );
    }
  }

  // ── Vote tally bar ──
  const mLineX = BAR_X + (M / N) * BAR_W;
  const lLineX = BAR_X + (L / N) * BAR_W;
  const fillW = (voteCount / N) * BAR_W;

  let barFill = C.proposed;
  if (voteCount >= L) barFill = C.finalized;
  else if (voteCount >= M) barFill = C.notarized;
  else if (voteCount > 0) barFill = C.nodeVoted;

  // ── Phase annotation ──
  let phaseText = '';
  let phaseColor = C.text;
  if (phase === PHASE_PROPOSE) {
    phaseText = `R${leaderIndex} proposes block for view ${view}`;
    phaseColor = C.leaderRing;
  } else if (phase === PHASE_VOTING) {
    phaseText = `collecting notarize votes... (${voteCount}/${N})`;
    phaseColor = C.text;
  } else if (phase === PHASE_NOTARIZED) {
    phaseText = `M reached: notarization formed, view advances (${voteCount}/${N})`;
    phaseColor = C.notarized;
  } else if (phase === PHASE_FINALIZED || phase === PHASE_SETTLE) {
    phaseText = `L reached: block finalized (${voteCount}/${N})`;
    phaseColor = C.finalized;
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="viz-svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="chainFadeLeft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="white" />

      {/* ── 1. Blockchain (top): scrolling group ── */}
      <g style={{
        transform: `translateX(${groupOffsetX}px)`,
        transition: 'transform 0.7s ease-out',
      }}>
        {blockElements}
      </g>

      <rect
        x={0} y={0} width={FADE_WIDTH} height={CHAIN_Y + BLOCK_H + 24}
        fill="url(#chainFadeLeft)" pointerEvents="none"
      />

      {/* ── 2. Notarize votes (middle) ── */}
      <text x={30} y={BAR_Y - 56} fill={C.muted} fontSize={10} fontFamily="monospace">
        notarize votes
      </text>
      <line x1={30} y1={BAR_Y - 51} x2={SVG_W - 30} y2={BAR_Y - 51} stroke="#eee" strokeWidth={1} />

      <text
        x={SVG_W / 2} y={BAR_Y - 24}
        textAnchor="middle" fill={phaseColor} fontSize={11} fontFamily="monospace" fontWeight={600}
      >
        {phaseText}
      </text>

      <rect x={BAR_X} y={BAR_Y} width={BAR_W} height={BAR_H} rx={3} fill={C.barBg} />
      <rect
        x={BAR_X} y={BAR_Y} width={fillW} height={BAR_H} rx={3}
        fill={barFill} opacity={0.9}
        style={{ transition: 'width 0.3s, fill 0.3s' }}
      />

      <line x1={mLineX} y1={BAR_Y - 6} x2={mLineX} y2={BAR_Y + BAR_H + 6} stroke={C.barM} strokeWidth={2} strokeDasharray="4,2" />
      <text x={mLineX} y={BAR_Y - 12} textAnchor="middle" fill={C.barM} fontSize={10} fontFamily="monospace" fontWeight={700}>
        M = {M}
      </text>
      <text x={mLineX} y={BAR_Y + BAR_H + 18} textAnchor="middle" fill={C.barM} fontSize={8} fontFamily="monospace">
        view advances
      </text>

      <line x1={lLineX} y1={BAR_Y - 6} x2={lLineX} y2={BAR_Y + BAR_H + 6} stroke={C.barL} strokeWidth={2} strokeDasharray="4,2" />
      <text x={lLineX} y={BAR_Y - 12} textAnchor="middle" fill={C.barL} fontSize={10} fontFamily="monospace" fontWeight={700}>
        L = {L}
      </text>
      <text x={lLineX} y={BAR_Y + BAR_H + 18} textAnchor="middle" fill={C.barL} fontSize={8} fontFamily="monospace">
        block finalized
      </text>

      <text
        x={BAR_X + BAR_W + 14} y={BAR_Y + BAR_H / 2 + 1}
        dominantBaseline="middle" fill={C.text} fontSize={13} fontFamily="monospace" fontWeight={700}
      >
        {voteCount}/{N}
      </text>

      {/* ── 3. Validators (bottom) ── */}
      <text x={30} y={VALIDATOR_ROW_Y - 48} fill={C.muted} fontSize={10} fontFamily="monospace">
        validators
      </text>
      <line x1={30} y1={VALIDATOR_ROW_Y - 43} x2={SVG_W - 30} y2={VALIDATOR_ROW_Y - 43} stroke="#eee" strokeWidth={1} />

      {validatorElements}
      {particles}
      {voteParticles}

      {/* Speed toggle in bottom-right corner */}
      <foreignObject x={SVG_W - 120} y={SVG_H - 30} width={110} height={26}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', gap: 3, fontFamily: 'monospace', fontSize: 10 }}>
          <button
            type="button"
            onClick={() => onSpeedChange(SPEED_SLOW)}
            style={{
              padding: '3px 10px',
              border: `1px solid ${speed === SPEED_SLOW ? C.text : '#d0d0d0'}`,
              background: speed === SPEED_SLOW ? C.text : 'white',
              color: speed === SPEED_SLOW ? 'white' : C.muted,
              fontFamily: 'monospace',
              fontSize: 10,
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            slow
          </button>
          <button
            type="button"
            onClick={() => onSpeedChange(SPEED_FAST)}
            style={{
              padding: '3px 10px',
              border: `1px solid ${speed === SPEED_FAST ? C.text : '#d0d0d0'}`,
              background: speed === SPEED_FAST ? C.text : 'white',
              color: speed === SPEED_FAST ? 'white' : C.muted,
              fontFamily: 'monospace',
              fontSize: 10,
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            fast
          </button>
        </div>
      </foreignObject>
    </svg>
  );
}

// ─── Sub-tabs ──────────────────────────────────────────────────────

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'm-notarization', label: 'M Notarization' },
  { id: 'l-notarization', label: 'L Notarization' },
];

// ─── Main component ────────────────────────────────────────────────

const SPEED_SLOW = 0.45;
const SPEED_FAST = 1.3;

export default function MinimmitVisualization() {
  const [activeTab, setActiveTab] = useState('overview');
  const [speed, setSpeed] = useState(SPEED_FAST);
  const speedRef = useRef(SPEED_FAST);
  speedRef.current = speed;
  const animation = useOverviewAnimation(speedRef);

  return (
    <div className="viz-container">
      <div className="viz-header">
        <h1 className="viz-title">
          <a
            href="https://github.com/commonwarexyz/monorepo/blob/main/pipeline/minimmit/minimmit.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Minimmit
          </a>
        </h1>
        <p className="viz-subtitle">
          A responsive, leader-based consensus protocol. Tolerates {'<'}20%
          Byzantine replicas. Finalizes in a single round of voting.
        </p>
      </div>

      <div className="legend">
        <div className="legend-header">
          <span className="legend-header-label">parameters (n={N}, f={F})</span>
        </div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: C.notarized, borderRadius: '50%' }} />
            <span className="legend-label">
              M = 2f+1 = {M} notarizations (advance view, ~{Math.round((M / N) * 100)}%)
            </span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: C.finalized, borderRadius: '50%' }} />
            <span className="legend-label">
              L = n-f = {L} notarizations (finalize block, ~{Math.round((L / N) * 100)}%)
            </span>
          </div>
        </div>
      </div>

      <div className="channel-selectors-row" style={{ marginBottom: 4, marginTop: 0 }}>
        <div className="channel-selector" style={{ padding: '6px 12px' }}>
          <div className="channel-selector-buttons">
            {SUB_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`channel-selector-button ${activeTab === tab.id ? 'channel-selector-button--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <OverviewScene
          view={animation.view}
          phase={animation.phase}
          voteCount={animation.voteCount}
          leaderIndex={animation.leaderIndex}
          votedReplicas={animation.votedReplicas}
          elapsed={animation.elapsed}
          speed={speed}
          onSpeedChange={setSpeed}
        />
      )}

      {activeTab === 'm-notarization' && (
        <div style={{ fontFamily: 'monospace', color: C.muted, padding: '40px 0', textAlign: 'center', border: '1px solid #ddd' }}>
          M Notarization property visualization (coming next)
        </div>
      )}

      {activeTab === 'l-notarization' && (
        <div style={{ fontFamily: 'monospace', color: C.muted, padding: '40px 0', textAlign: 'center', border: '1px solid #ddd' }}>
          L Notarization property visualization (coming next)
        </div>
      )}

      <p className="viz-hint">
        {activeTab === 'overview'
          ? 'Watch the consensus cycle: leader proposes, validators vote:'
          : 'Select a tab to explore Minimmit properties.'}
      </p>
      {activeTab === 'overview' && (
        <div style={{ fontFamily: 'monospace', fontSize: '0.8em', color: C.text, lineHeight: 1.5, margin: '8px 0 0' }}>
          <p style={{ margin: '0 0 4px' }}>
            Upon seeing {'>'}40% of nodes vote for a block (<strong>M notarization</strong>), a node can progress to the next view.
          </p>
          <p style={{ margin: 0 }}>
            Upon seeing {'>'}80% of nodes vote for a block (<strong>L notarization</strong>), a node can finalize the block.
          </p>
        </div>
      )}

      <div className="viz-footer">
        <a href="https://github.com/DhruvPareek/monorepo/tree/feat/visualization-work/commonware-visualization">
          GitHub
        </a>
        <a href="https://commonware.xyz">commonware.xyz</a>
      </div>
    </div>
  );
}
