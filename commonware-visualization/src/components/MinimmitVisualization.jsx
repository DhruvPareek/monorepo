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

// ─── Shared timing ─────────────────────────────────────────────────

const PHASE_PROPOSE = 'PROPOSE';
const PHASE_VOTING = 'VOTING';
const PHASE_NOTARIZED = 'NOTARIZED';
const PHASE_FINALIZED = 'FINALIZED';
const PHASE_SETTLE = 'SETTLE';

const T_PROPOSE_END = 1300;
const T_VOTE_INTERVAL = 340;

// ─── Simple animation (full cycle: propose -> all votes -> L -> settle) ──

const SIMPLE_T_ALL_VOTES = T_PROPOSE_END + (N - 1) * T_VOTE_INTERVAL;
const SIMPLE_T_SETTLE = 900;
const SIMPLE_CYCLE = SIMPLE_T_ALL_VOTES + SIMPLE_T_SETTLE;

function useSimpleAnimation(speedRef) {
  const [state, setState] = useState({ elapsed: 0, view: 0 });
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const dt = (timestamp - lastRef.current) * speedRef.current;
    lastRef.current = timestamp;
    setState((prev) => {
      const next = prev.elapsed + dt;
      if (next >= SIMPLE_CYCLE) {
        return { elapsed: next - SIMPLE_CYCLE, view: prev.view + 1 };
      }
      return { elapsed: next, view: prev.view };
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [speedRef]);

  useEffect(() => {
    lastRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [tick]);

  const { elapsed, view } = state;
  const leaderIndex = view % N;
  const otherReplicas = [];
  for (let i = 1; i < N; i++) otherReplicas.push((leaderIndex + i) % N);

  let voteCount = 0;
  let phase = PHASE_PROPOSE;
  if (elapsed < T_PROPOSE_END) {
    voteCount = 1; phase = PHASE_PROPOSE;
  } else if (elapsed < SIMPLE_T_ALL_VOTES) {
    const votingElapsed = elapsed - T_PROPOSE_END;
    voteCount = 1 + Math.min(N - 1, Math.floor(votingElapsed / T_VOTE_INTERVAL) + 1);
    if (voteCount >= L) phase = PHASE_FINALIZED;
    else if (voteCount >= M) phase = PHASE_NOTARIZED;
    else phase = PHASE_VOTING;
  } else {
    voteCount = N; phase = PHASE_SETTLE;
  }

  const votedReplicas = new Set([leaderIndex]);
  for (let i = 0; i < Math.min(voteCount - 1, otherReplicas.length); i++) {
    votedReplicas.add(otherReplicas[i]);
  }

  return { view, phase, voteCount, leaderIndex, votedReplicas, elapsed };
}

// ─── Pipelined animation (cycle ends at M, prev block finalizes in bg) ──

const PIPE_T_M_REACHED = T_PROPOSE_END + (M - 1) * T_VOTE_INTERVAL;
const PIPE_T_M_SETTLE = 500;
const PIPE_CYCLE = PIPE_T_M_REACHED + PIPE_T_M_SETTLE;
const PREV_FINALIZE_DELAY = 1800;
const PREV_VOTE_INTERVAL = PREV_FINALIZE_DELAY / (L - M);

function usePipelinedAnimation(speedRef) {
  const [state, setState] = useState({ elapsed: 0, view: 0 });
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const dt = (timestamp - lastRef.current) * speedRef.current;
    lastRef.current = timestamp;
    setState((prev) => {
      const next = prev.elapsed + dt;
      if (next >= PIPE_CYCLE) {
        return { elapsed: next - PIPE_CYCLE, view: prev.view + 1 };
      }
      return { elapsed: next, view: prev.view };
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [speedRef]);

  useEffect(() => {
    lastRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [tick]);

  const { elapsed, view } = state;
  const leaderIndex = view % N;
  const otherReplicas = [];
  for (let i = 1; i < N; i++) otherReplicas.push((leaderIndex + i) % N);

  let voteCount = 0;
  let phase = PHASE_PROPOSE;
  if (elapsed < T_PROPOSE_END) {
    voteCount = 1; phase = PHASE_PROPOSE;
  } else if (elapsed < PIPE_T_M_REACHED) {
    const votingElapsed = elapsed - T_PROPOSE_END;
    voteCount = 1 + Math.min(M - 1, Math.floor(votingElapsed / T_VOTE_INTERVAL) + 1);
    phase = voteCount >= M ? PHASE_NOTARIZED : PHASE_VOTING;
  } else {
    voteCount = M; phase = PHASE_NOTARIZED;
  }

  const votedReplicas = new Set([leaderIndex]);
  for (let i = 0; i < Math.min(voteCount - 1, otherReplicas.length); i++) {
    votedReplicas.add(otherReplicas[i]);
  }

  // Previous block L finalization
  const prevLeaderIndex = (view - 1 + N) % N;
  const prevVoteOrder = [prevLeaderIndex];
  for (let i = 1; i < N; i++) prevVoteOrder.push((prevLeaderIndex + i) % N);

  let prevVoteCount = M;
  if (elapsed < PREV_FINALIZE_DELAY) {
    prevVoteCount = M + Math.min(L - M, Math.floor(elapsed / PREV_VOTE_INTERVAL));
  } else {
    prevVoteCount = L;
  }
  const prevFinalized = prevVoteCount >= L;

  const prevVotedReplicas = new Set();
  for (let i = 0; i < Math.min(prevVoteCount, prevVoteOrder.length); i++) {
    prevVotedReplicas.add(prevVoteOrder[i]);
  }

  return { view, phase, voteCount, leaderIndex, votedReplicas, elapsed, prevVoteCount, prevVotedReplicas, prevFinalized };
}

// ─── Layout constants ──────────────────────────────────────────────

const SVG_W = 900;
const SVG_H = 500;

const CHAIN_Y = 40;
const BLOCK_W = 62;
const BLOCK_H = 36;
const BLOCK_GAP = 16;
const STEP = BLOCK_W + BLOCK_GAP;
const TIP_RIGHT_X = SVG_W - 80;
const RENDER_COUNT = 14;
const FADE_WIDTH = 240;

// Simple mode layout
const S_BAR_Y = 210;
const S_BAR_X = 180;
const S_BAR_W = 500;
const S_BAR_H = 20;
const S_VALIDATOR_ROW_Y = 390;

// Pipelined mode layout
const P_BAR_Y = 190;
const P_PREV_BAR_Y = 264;
const P_BAR_X = 200;
const P_BAR_W = 470;
const P_BAR_H = 18;
const P_BAR_LABEL_X = 40;
const P_VALIDATOR_ROW_Y = 405;

const VALIDATOR_SPACING = 74;
const VALIDATOR_R = 24;
const VALIDATOR_START_X = (SVG_W - (N - 1) * VALIDATOR_SPACING) / 2;

function vx(i) {
  return VALIDATOR_START_X + i * VALIDATOR_SPACING;
}

// ─── Shared SVG shell ──────────────────────────────────────────────

function ChainBlocks({ view, startView, blockColorFn }) {
  const groupOffsetX = TIP_RIGHT_X - BLOCK_W - view * STEP;
  const blockElements = [];
  const start = Math.max(0, startView);

  for (let v = start; v <= view; v++) {
    const bx = v * STEP;
    const by = CHAIN_Y;
    const { fill, stroke, textFill, label, strokeW, dashed } = blockColorFn(v);

    if (v > start) {
      blockElements.push(
        <line key={`conn${v}`} x1={bx - BLOCK_GAP} y1={by + BLOCK_H / 2} x2={bx} y2={by + BLOCK_H / 2} stroke={C.dim} strokeWidth={1.5} />
      );
    }
    if (v === start) {
      blockElements.push(
        <line key="leadingLine" x1={bx - 2000} y1={by + BLOCK_H / 2} x2={bx} y2={by + BLOCK_H / 2} stroke={C.dim} strokeWidth={1.5} />
      );
    }
    blockElements.push(
      <g key={`block${v}`}>
        <rect x={bx} y={by} width={BLOCK_W} height={BLOCK_H} rx={4}
          fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dashed ? '4,3' : 'none'}
          style={{ transition: 'fill 0.5s, stroke 0.5s' }}
        />
        <text x={bx + BLOCK_W / 2} y={by + BLOCK_H / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          fill={textFill} fontSize={11} fontFamily="monospace" fontWeight={700} style={{ transition: 'fill 0.5s' }}
        >v{v}</text>
        {label && (
          <text x={bx + BLOCK_W / 2} y={by + BLOCK_H + 13} textAnchor="middle"
            fill={label === 'proposed' ? C.muted : label === 'finalizing...' ? C.notarizedDark : label === 'notarized' ? C.notarized : C.finalized}
            fontSize={7} fontFamily="monospace" fontWeight={600}
          >{label}</text>
        )}
      </g>
    );
  }

  return (
    <>
      <g style={{ transform: `translateX(${groupOffsetX}px)`, transition: 'transform 0.7s ease-out' }}>
        {blockElements}
      </g>
      <rect x={0} y={0} width={FADE_WIDTH} height={CHAIN_Y + BLOCK_H + 24} fill="url(#chainFadeLeft)" pointerEvents="none" />
    </>
  );
}

function Validators({ leaderIndex, votedReplicas, voteCount, y, prevVotedReplicas, prevFinalized }) {
  // Validator fill matches the bar color for the current block's stage
  let votedFill, votedStroke;
  if (voteCount >= L) {
    votedFill = C.finalized;
    votedStroke = C.finalizedStroke;
  } else if (voteCount >= M) {
    votedFill = C.notarized;
    votedStroke = C.notarizedDark;
  } else {
    votedFill = C.proposedStroke; // gray, matching bar before M
    votedStroke = '#7b8ca3';
  }

  const elements = [];
  for (let i = 0; i < N; i++) {
    const x = vx(i);
    const isLeader = i === leaderIndex;
    const hasVoted = votedReplicas.has(i);
    const hasPrevVoted = prevVotedReplicas && prevVotedReplicas.has(i);
    const fill = hasVoted ? votedFill : C.nodeIdle;
    const stroke = hasVoted ? votedStroke : C.nodeIdleStroke;
    const textFill = hasVoted ? 'white' : C.muted;
    const prevRingColor = prevFinalized ? C.finalized : C.notarized;

    elements.push(
      <g key={`v${i}`}>
        {hasPrevVoted && (
          <circle cx={x} cy={y} r={VALIDATOR_R + 4} fill="none" stroke={prevRingColor} strokeWidth={2.5}
            opacity={prevFinalized ? 0.6 : 0.55} style={{ transition: 'stroke 0.5s, opacity 0.5s' }}
          />
        )}
        {isLeader && (
          <circle cx={x} cy={y} r={VALIDATOR_R + (hasPrevVoted ? 10 : 6)} fill="none" stroke={C.leaderRing} strokeWidth={1.5} opacity={0.6}>
            <animate attributeName="r" values={`${VALIDATOR_R + (hasPrevVoted ? 8 : 4)};${VALIDATOR_R + (hasPrevVoted ? 13 : 9)};${VALIDATOR_R + (hasPrevVoted ? 8 : 4)}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
        <circle cx={x} cy={y} r={VALIDATOR_R} fill={fill} stroke={stroke} strokeWidth={1.5} style={{ transition: 'fill 0.3s, stroke 0.3s' }} />
        <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={textFill} fontSize={11} fontFamily="monospace" fontWeight={700} style={{ transition: 'fill 0.3s' }}>
          R{i}
        </text>
        <text x={x} y={y + VALIDATOR_R + 12} textAnchor="middle" fill={isLeader ? C.leaderRing : hasVoted ? C.muted : 'transparent'} fontSize={8} fontFamily="monospace" fontWeight={isLeader ? 700 : 400}>
          {isLeader ? 'leader' : hasVoted ? 'voted' : ''}
        </text>
      </g>
    );
  }
  return <>{elements}</>;
}

function Particles({ phase, elapsed, leaderIndex, votedReplicas, y, barY, barH, tVoteEnd }) {
  const particles = [];
  if (phase === PHASE_PROPOSE && elapsed > 400) {
    for (let i = 0; i < N; i++) {
      if (i === leaderIndex) continue;
      particles.push(
        <circle key={`prop${i}`} r={2} fill={C.notarized} opacity={0.6}>
          <animateMotion dur={`${0.7 + i * 0.06}s`} repeatCount="indefinite" path={`M${vx(leaderIndex)},${y} L${vx(i)},${y}`} />
        </circle>
      );
    }
  }
  if (elapsed >= T_PROPOSE_END && elapsed < tVoteEnd) {
    const votingElapsed = elapsed - T_PROPOSE_END;
    const idx = Math.floor(votingElapsed / T_VOTE_INTERVAL);
    const others = [];
    for (let i = 1; i < N; i++) others.push((leaderIndex + i) % N);
    const voterId = others[Math.min(idx, others.length - 1)];
    if (voterId !== undefined && !votedReplicas.has(voterId)) {
      // only show particle for not-yet-counted voter
    }
    if (voterId !== undefined) {
      particles.push(
        <circle key="votep" r={2.5} fill={C.nodeVoted} opacity={0.7}>
          <animateMotion dur="0.4s" repeatCount="indefinite" path={`M${vx(voterId)},${y - VALIDATOR_R} L${SVG_W / 2},${barY + barH}`} />
        </circle>
      );
    }
  }
  return <>{particles}</>;
}

function SpeedToggle({ speed, onSpeedChange }) {
  const btnStyle = (active) => ({
    padding: '3px 10px',
    border: `1px solid ${active ? C.text : '#d0d0d0'}`,
    background: active ? C.text : 'white',
    color: active ? 'white' : C.muted,
    fontFamily: 'monospace', fontSize: 10, cursor: 'pointer', borderRadius: 3,
  });
  return (
    <foreignObject x={SVG_W - 120} y={SVG_H - 30} width={110} height={26}>
      <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', gap: 3, fontFamily: 'monospace', fontSize: 10 }}>
        <button type="button" onClick={() => onSpeedChange(SPEED_SLOW)} style={btnStyle(speed === SPEED_SLOW)}>slow</button>
        <button type="button" onClick={() => onSpeedChange(SPEED_FAST)} style={btnStyle(speed === SPEED_FAST)}>fast</button>
      </div>
    </foreignObject>
  );
}

function ModeToggle({ mode, onModeChange }) {
  const btnStyle = (active) => ({
    padding: '3px 10px',
    border: `1px solid ${active ? C.text : '#d0d0d0'}`,
    background: active ? C.text : 'white',
    color: active ? 'white' : C.muted,
    fontFamily: 'monospace', fontSize: 10, cursor: 'pointer', borderRadius: 3,
  });
  return (
    <foreignObject x={10} y={SVG_H - 30} width={140} height={26}>
      <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', gap: 3, fontFamily: 'monospace', fontSize: 10 }}>
        <button type="button" onClick={() => onModeChange('simple')} style={btnStyle(mode === 'simple')}>simple</button>
        <button type="button" onClick={() => onModeChange('pipelined')} style={btnStyle(mode === 'pipelined')}>pipelined</button>
      </div>
    </foreignObject>
  );
}

// ─── Simple overview scene ─────────────────────────────────────────

function SimpleScene({ view, phase, voteCount, leaderIndex, votedReplicas, elapsed, speed, onSpeedChange, mode, onModeChange }) {
  const blockColorFn = (v) => {
    const isCurrent = v === view;
    if (!isCurrent) return { fill: C.finalized, stroke: C.finalizedStroke, textFill: '#e2e8f0', label: null, strokeW: 1, dashed: false };
    if (voteCount >= L) return { fill: C.finalized, stroke: C.finalizedStroke, textFill: '#e2e8f0', label: 'finalized', strokeW: 2, dashed: false };
    if (voteCount >= M) return { fill: C.notarized, stroke: C.notarizedDark, textFill: 'white', label: 'notarized', strokeW: 2, dashed: false };
    return { fill: 'white', stroke: C.proposedStroke, textFill: C.text, label: 'proposed', strokeW: 2, dashed: true };
  };

  const mLineX = S_BAR_X + (M / N) * S_BAR_W;
  const lLineX = S_BAR_X + (L / N) * S_BAR_W;
  const fillW = (voteCount / N) * S_BAR_W;
  let barFill = C.proposedStroke; // gray before M
  if (voteCount >= L) barFill = C.finalized;
  else if (voteCount >= M) barFill = C.notarized;

  let phaseText = '', phaseColor = C.text;
  if (phase === PHASE_PROPOSE) { phaseText = `R${leaderIndex} proposes block for view ${view}`; phaseColor = C.leaderRing; }
  else if (phase === PHASE_VOTING) { phaseText = `collecting notarize votes... (${voteCount}/${N})`; phaseColor = C.text; }
  else if (phase === PHASE_NOTARIZED) { phaseText = `M reached: notarization formed, view advances (${voteCount}/${N})`; phaseColor = C.notarized; }
  else if (phase === PHASE_FINALIZED || phase === PHASE_SETTLE) { phaseText = `L reached: block finalized (${voteCount}/${N})`; phaseColor = C.finalized; }

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="viz-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chainFadeLeft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="white" />

      <ChainBlocks view={view} startView={view - RENDER_COUNT + 1} blockColorFn={blockColorFn} />

      {/* Vote bar */}
      <text x={30} y={S_BAR_Y - 56} fill={C.muted} fontSize={10} fontFamily="monospace">notarize votes</text>
      <line x1={30} y1={S_BAR_Y - 51} x2={SVG_W - 30} y2={S_BAR_Y - 51} stroke="#eee" strokeWidth={1} />
      <text x={SVG_W / 2} y={S_BAR_Y - 24} textAnchor="middle" fill={phaseColor} fontSize={11} fontFamily="monospace" fontWeight={600}>{phaseText}</text>

      <rect x={S_BAR_X} y={S_BAR_Y} width={S_BAR_W} height={S_BAR_H} rx={3} fill={C.barBg} />
      <rect x={S_BAR_X} y={S_BAR_Y} width={fillW} height={S_BAR_H} rx={3} fill={barFill} opacity={0.9} style={{ transition: 'width 0.3s, fill 0.3s' }} />

      <line x1={mLineX} y1={S_BAR_Y - 6} x2={mLineX} y2={S_BAR_Y + S_BAR_H + 6} stroke={C.barM} strokeWidth={2} strokeDasharray="4,2" />
      <text x={mLineX} y={S_BAR_Y - 12} textAnchor="middle" fill={C.barM} fontSize={10} fontFamily="monospace" fontWeight={700}>M = {M}</text>
      <text x={mLineX} y={S_BAR_Y + S_BAR_H + 18} textAnchor="middle" fill={C.barM} fontSize={8} fontFamily="monospace">view advances</text>

      <line x1={lLineX} y1={S_BAR_Y - 6} x2={lLineX} y2={S_BAR_Y + S_BAR_H + 6} stroke={C.barL} strokeWidth={2} strokeDasharray="4,2" />
      <text x={lLineX} y={S_BAR_Y - 12} textAnchor="middle" fill={C.barL} fontSize={10} fontFamily="monospace" fontWeight={700}>L = {L}</text>
      <text x={lLineX} y={S_BAR_Y + S_BAR_H + 18} textAnchor="middle" fill={C.barL} fontSize={8} fontFamily="monospace">block finalized</text>

      <text x={S_BAR_X + S_BAR_W + 14} y={S_BAR_Y + S_BAR_H / 2 + 1} dominantBaseline="middle" fill={C.text} fontSize={13} fontFamily="monospace" fontWeight={700}>{voteCount}/{N}</text>

      {/* Validators */}
      <text x={30} y={S_VALIDATOR_ROW_Y - 48} fill={C.muted} fontSize={10} fontFamily="monospace">validators</text>
      <line x1={30} y1={S_VALIDATOR_ROW_Y - 43} x2={SVG_W - 30} y2={S_VALIDATOR_ROW_Y - 43} stroke="#eee" strokeWidth={1} />
      <Validators leaderIndex={leaderIndex} votedReplicas={votedReplicas} voteCount={voteCount} y={S_VALIDATOR_ROW_Y} />
      <Particles phase={phase} elapsed={elapsed} leaderIndex={leaderIndex} votedReplicas={votedReplicas} y={S_VALIDATOR_ROW_Y} barY={S_BAR_Y} barH={S_BAR_H} tVoteEnd={SIMPLE_T_ALL_VOTES} />

      <ModeToggle mode={mode} onModeChange={onModeChange} />
      <SpeedToggle speed={speed} onSpeedChange={onSpeedChange} />
    </svg>
  );
}

// ─── Pipelined overview scene ──────────────────────────────────────

function PipelinedScene({ view, phase, voteCount, leaderIndex, votedReplicas, elapsed, prevVoteCount, prevVotedReplicas, prevFinalized, speed, onSpeedChange, mode, onModeChange }) {
  const blockColorFn = (v) => {
    const isCurrent = v === view;
    const isPrev = v === view - 1;
    if (isCurrent) {
      if (voteCount >= M) return { fill: C.notarized, stroke: C.notarizedDark, textFill: 'white', label: 'notarized', strokeW: 2, dashed: false };
      return { fill: 'white', stroke: C.proposedStroke, textFill: C.text, label: 'proposed', strokeW: 2, dashed: true };
    }
    if (isPrev && !prevFinalized) return { fill: C.notarized, stroke: C.notarizedDark, textFill: 'white', label: 'finalizing...', strokeW: 2, dashed: false };
    return { fill: C.finalized, stroke: C.finalizedStroke, textFill: '#e2e8f0', label: null, strokeW: 1, dashed: false };
  };

  const mLineX = P_BAR_X + (M / N) * P_BAR_W;
  const lLineX = P_BAR_X + (L / N) * P_BAR_W;
  const fillW = (voteCount / N) * P_BAR_W;
  let barFill = C.proposedStroke; // gray before M
  if (voteCount >= M) barFill = C.notarized;

  const prevFillW = (prevVoteCount / N) * P_BAR_W;
  const prevBarFill = prevVoteCount >= L ? C.finalized : C.notarized;

  let phaseText = '', phaseColor = C.text;
  if (phase === PHASE_PROPOSE) { phaseText = `R${leaderIndex} proposes block for view ${view}`; phaseColor = C.leaderRing; }
  else if (phase === PHASE_VOTING) { phaseText = `collecting notarize votes... (${voteCount}/${M} for M)`; phaseColor = C.text; }
  else if (phase === PHASE_NOTARIZED) { phaseText = `M reached (${M}/${N}): building next block`; phaseColor = C.notarized; }

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="viz-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chainFadeLeft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="white" />

      <ChainBlocks view={view} startView={view - RENDER_COUNT + 1} blockColorFn={blockColorFn} />

      {/* Current block vote bar */}
      <text x={30} y={P_BAR_Y - 56} fill={C.muted} fontSize={10} fontFamily="monospace">notarize votes</text>
      <line x1={30} y1={P_BAR_Y - 51} x2={SVG_W - 30} y2={P_BAR_Y - 51} stroke="#eee" strokeWidth={1} />
      <text x={SVG_W / 2} y={P_BAR_Y - 24} textAnchor="middle" fill={phaseColor} fontSize={11} fontFamily="monospace" fontWeight={600}>{phaseText}</text>

      <text x={P_BAR_LABEL_X} y={P_BAR_Y + P_BAR_H / 2 + 1} dominantBaseline="middle" fill={C.notarized} fontSize={9} fontFamily="monospace" fontWeight={600}>v{view}</text>
      <rect x={P_BAR_X} y={P_BAR_Y} width={P_BAR_W} height={P_BAR_H} rx={3} fill={C.barBg} />
      <rect x={P_BAR_X} y={P_BAR_Y} width={fillW} height={P_BAR_H} rx={3} fill={barFill} opacity={0.9} style={{ transition: 'width 0.3s, fill 0.3s' }} />

      <line x1={mLineX} y1={P_BAR_Y - 6} x2={mLineX} y2={P_BAR_Y + P_BAR_H + 6} stroke={C.barM} strokeWidth={2} strokeDasharray="4,2" />
      <text x={mLineX} y={P_BAR_Y - 12} textAnchor="middle" fill={C.barM} fontSize={10} fontFamily="monospace" fontWeight={700}>M = {M}</text>
      <text x={mLineX} y={P_BAR_Y + P_BAR_H + 16} textAnchor="middle" fill={C.barM} fontSize={7} fontFamily="monospace">view advances</text>
      <text x={P_BAR_X + P_BAR_W + 14} y={P_BAR_Y + P_BAR_H / 2 + 1} dominantBaseline="middle" fill={C.text} fontSize={12} fontFamily="monospace" fontWeight={700}>{voteCount}/{N}</text>

      {/* Previous block finalization bar */}
      {view > 0 && (
        <g>
          <text x={P_BAR_LABEL_X} y={P_PREV_BAR_Y + P_BAR_H / 2 + 1} dominantBaseline="middle" fill={prevFinalized ? C.finalized : C.notarizedDark} fontSize={9} fontFamily="monospace" fontWeight={600}>v{view - 1}</text>
          <rect x={P_BAR_X} y={P_PREV_BAR_Y} width={P_BAR_W} height={P_BAR_H} rx={3} fill={C.barBg} />
          <rect x={P_BAR_X} y={P_PREV_BAR_Y} width={prevFillW} height={P_BAR_H} rx={3} fill={prevBarFill} opacity={0.9} style={{ transition: 'width 0.35s, fill 0.5s' }} />
          <line x1={lLineX} y1={P_PREV_BAR_Y - 6} x2={lLineX} y2={P_PREV_BAR_Y + P_BAR_H + 6} stroke={C.barL} strokeWidth={2} strokeDasharray="4,2" />
          <text x={lLineX} y={P_PREV_BAR_Y - 12} textAnchor="middle" fill={C.barL} fontSize={10} fontFamily="monospace" fontWeight={700}>L = {L}</text>
          <text x={lLineX} y={P_PREV_BAR_Y + P_BAR_H + 16} textAnchor="middle" fill={C.barL} fontSize={7} fontFamily="monospace">block finalized</text>
          <line x1={mLineX} y1={P_PREV_BAR_Y - 4} x2={mLineX} y2={P_PREV_BAR_Y + P_BAR_H + 4} stroke={C.barM} strokeWidth={1} strokeDasharray="3,2" opacity={0.4} />
          <text x={P_BAR_X + P_BAR_W + 14} y={P_PREV_BAR_Y + P_BAR_H / 2 + 1} dominantBaseline="middle" fill={C.text} fontSize={12} fontFamily="monospace" fontWeight={700}>{prevVoteCount}/{N}</text>
          {prevFinalized && (
            <text x={P_BAR_X + P_BAR_W + 62} y={P_PREV_BAR_Y + P_BAR_H / 2 + 1} dominantBaseline="middle" fill={C.finalized} fontSize={9} fontFamily="monospace" fontWeight={600}>finalized</text>
          )}
        </g>
      )}

      {/* Validators */}
      <text x={30} y={P_VALIDATOR_ROW_Y - 48} fill={C.muted} fontSize={10} fontFamily="monospace">validators</text>
      <line x1={30} y1={P_VALIDATOR_ROW_Y - 43} x2={SVG_W - 30} y2={P_VALIDATOR_ROW_Y - 43} stroke="#eee" strokeWidth={1} />
      <Validators leaderIndex={leaderIndex} votedReplicas={votedReplicas} voteCount={voteCount} y={P_VALIDATOR_ROW_Y} prevVotedReplicas={prevVotedReplicas} prevFinalized={prevFinalized} />
      <Particles phase={phase} elapsed={elapsed} leaderIndex={leaderIndex} votedReplicas={votedReplicas} y={P_VALIDATOR_ROW_Y} barY={P_BAR_Y} barH={P_BAR_H} tVoteEnd={PIPE_T_M_REACHED} />

      <ModeToggle mode={mode} onModeChange={onModeChange} />
      <SpeedToggle speed={speed} onSpeedChange={onSpeedChange} />
    </svg>
  );
}

// ─── M Notarization property scene ─────────────────────────────────

const M_STEPS = [
  { id: 1, label: '1. Block A reaches M' },
  { id: 2, label: '2. Honest vs Byzantine' },
  { id: 3, label: '3. Equivocate' },
  { id: 4, label: '4. Advance to Next View' },
];

function MNotarizationScene() {
  const [step, setStep] = useState(1);

  // Use the same N, F, M, L as the rest of the visualization
  const honestInM = M - F; // 3
  const honestNotInA = (N - F) - honestInM; // 6
  const maxB = honestNotInA + F; // 8

  const W = 900;
  const H = 530;
  const BAR_X = 200;
  const BAR_W = 440;
  const BAR_H = 16;
  const ROW_Y = 140;
  const byzantineSet = new Set([3, 4]);
  const showByzantine = step >= 2;
  const showBlockB = step === 3;
  const showAdvance = step === 4;

  const stepSubtitle = ['', '', '', '', ''][step];

  return (
    <div>
      <div className="viz-header" style={{ marginBottom: 6 }}>
        <h1 className="viz-title">Why are M notarized blocks safe to build on?</h1>
        <p className="viz-subtitle">Because no other block can be finalized in the same view.</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" xmlns="http://www.w3.org/2000/svg">
        <rect x={0} y={0} width={W} height={H} fill="white" />

        {/* Step subtitle */}
        <text x={W / 2} y={28} textAnchor="middle" fill={C.muted} fontSize={10} fontFamily="monospace">
          {stepSubtitle}
        </text>

        {/* Legend */}
        <g>
          <circle cx={140} cy={72} r={6} fill={C.notarized} />
          <text x={150} y={75} fill={C.text} fontSize={9} fontFamily="monospace">voted A{showByzantine && !showAdvance ? ' (honest, locked)' : ''}</text>
          {showByzantine && !showAdvance && (
            <>
              <circle cx={320} cy={72} r={6} fill={C.nodeIdle} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3,2" />
              <text x={330} y={75} fill={C.text} fontSize={9} fontFamily="monospace">Byzantine</text>
            </>
          )}
          {showBlockB && (
            <>
              <circle cx={440} cy={72} r={6} fill="#0d9488" />
              <text x={450} y={75} fill={C.text} fontSize={9} fontFamily="monospace">votes B (max possible)</text>
            </>
          )}
          {showAdvance && (
            <>
              <circle cx={280} cy={72} r={6} fill={C.finalized} />
              <text x={290} y={75} fill={C.text} fontSize={9} fontFamily="monospace">finalized</text>
              <rect x={374} y={66} width={12} height={12} rx={2} fill="white" stroke={C.proposedStroke} strokeWidth={1.5} strokeDasharray="3,2" />
              <text x={394} y={75} fill={C.text} fontSize={9} fontFamily="monospace">new proposal</text>
            </>
          )}
        </g>

        {/* Validator row (steps 1-3) */}
        {!showAdvance && (
          <>
            <text x={30} y={ROW_Y - 34} fill={C.muted} fontSize={10} fontFamily="monospace">validators (view v)</text>
            <line x1={30} y1={ROW_Y - 29} x2={W - 30} y2={ROW_Y - 29} stroke="#eee" strokeWidth={1} />
          </>
        )}
        {!showAdvance && Array.from({ length: N }, (_, i) => {
          const x = vx(i);
          const isByz = byzantineSet.has(i);
          const votedA = i < M;

          let fill, stroke, textFill;
          if (votedA) {
            fill = C.notarized; stroke = C.notarizedDark; textFill = 'white';
            if (showByzantine && isByz) stroke = '#dc2626';
          } else if (showBlockB) {
            fill = '#0d9488'; stroke = '#0f766e'; textFill = 'white';
          } else {
            fill = C.nodeIdle; stroke = C.nodeIdleStroke; textFill = C.muted;
          }

          return (
            <g key={i}>
              {showByzantine && isByz && (
                <circle cx={x} cy={ROW_Y} r={VALIDATOR_R + 5} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="5,3" opacity={0.7} />
              )}
              <circle cx={x} cy={ROW_Y} r={VALIDATOR_R} fill={fill}
                stroke={showByzantine && isByz ? '#dc2626' : stroke}
                strokeWidth={showByzantine && isByz ? 2 : 1.5}
                strokeDasharray={showByzantine && isByz ? '4,2' : 'none'}
                style={{ transition: 'fill 0.4s, stroke 0.4s' }}
              />
              {showBlockB && isByz && votedA && (
                <path d={`M${x},${ROW_Y - VALIDATOR_R} A${VALIDATOR_R},${VALIDATOR_R} 0 0,1 ${x},${ROW_Y + VALIDATOR_R}`}
                  fill="#0d9488" opacity={0.6} />
              )}
              <text x={x} y={ROW_Y + 1} textAnchor="middle" dominantBaseline="middle" fill={textFill} fontSize={10} fontFamily="monospace" fontWeight={700}>
                R{i}
              </text>
              {showByzantine && isByz && (
                <text x={x} y={ROW_Y - VALIDATOR_R - 10} textAnchor="middle" fill="#dc2626" fontSize={7} fontFamily="monospace" fontWeight={700}>
                  Byzantine
                </text>
              )}
              {step === 1 && votedA && (
                <text x={x} y={ROW_Y + VALIDATOR_R + 12} textAnchor="middle" fontSize={7} fontFamily="monospace" fontWeight={600} fill={C.notarized}>
                  vote A
                </text>
              )}
              {step >= 2 && votedA && !isByz && (
                <>
                  <text x={x} y={ROW_Y + VALIDATOR_R + 12} textAnchor="middle" fontSize={6} fontFamily="monospace" fontWeight={600} fill={C.notarized}>
                    voted A
                  </text>
                  <text x={x} y={ROW_Y + VALIDATOR_R + 22} textAnchor="middle" fontSize={6} fontFamily="monospace" fill={C.muted}>
                    (locked)
                  </text>
                </>
              )}
              {step >= 2 && votedA && isByz && (
                <text x={x} y={ROW_Y + VALIDATOR_R + 12} textAnchor="middle" fontSize={6} fontFamily="monospace" fontWeight={600} fill="#dc2626">
                  {showBlockB ? 'A + B' : 'voted A'}
                </text>
              )}
              {showBlockB && !votedA && (
                <text x={x} y={ROW_Y + VALIDATOR_R + 12} textAnchor="middle" fontSize={6} fontFamily="monospace" fontWeight={600} fill="#0d9488">
                  votes B
                </text>
              )}
            </g>
          );
        })}

        {/* Step 4: Chain diagram showing view advance */}
        {showAdvance && (() => {
          const chainY = 130;
          const bw = 100;
          const bh = 50;
          const gap = 40;
          const startX = (W - 3 * bw - 2 * gap) / 2;
          const blocks = [
            { label: 'view v-1', sublabel: 'finalized', fill: C.finalized, stroke: C.finalizedStroke, textFill: '#e2e8f0' },
            { label: 'view v', sublabel: 'M notarized (A)', fill: C.notarized, stroke: C.notarizedDark, textFill: 'white' },
            { label: 'view v+1', sublabel: 'new proposal', fill: 'white', stroke: C.proposedStroke, textFill: C.text, dashed: true },
          ];
          return (
            <g>
              <text x={30} y={chainY - 24} fill={C.muted} fontSize={10} fontFamily="monospace">select_parent:</text>
              <line x1={30} y1={chainY - 19} x2={W - 30} y2={chainY - 19} stroke="#eee" strokeWidth={1} />
              {blocks.map((b, idx) => {
                const bx = startX + idx * (bw + gap);
                return (
                  <g key={idx}>
                    {idx > 0 && (
                      <line x1={bx - gap} y1={chainY + bh / 2} x2={bx} y2={chainY + bh / 2} stroke={C.dim} strokeWidth={2} />
                    )}
                    {idx > 0 && (
                      <polygon points={`${bx - 4},${chainY + bh / 2 - 4} ${bx},${chainY + bh / 2} ${bx - 4},${chainY + bh / 2 + 4}`} fill={C.dim} />
                    )}
                    <rect x={bx} y={chainY} width={bw} height={bh} rx={6} fill={b.fill} stroke={b.stroke} strokeWidth={2} strokeDasharray={b.dashed ? '6,4' : 'none'} />
                    <text x={bx + bw / 2} y={chainY + bh / 2 - 6} textAnchor="middle" dominantBaseline="middle" fill={b.textFill} fontSize={12} fontFamily="monospace" fontWeight={700}>
                      {b.label}
                    </text>
                    <text x={bx + bw / 2} y={chainY + bh / 2 + 10} textAnchor="middle" dominantBaseline="middle" fill={b.textFill} fontSize={9} fontFamily="monospace" opacity={0.8}>
                      {b.sublabel}
                    </text>
                  </g>
                );
              })}
              {/* Curved arrow from v+1 back to v showing select_parent */}
              <path d={`M${startX + 2 * (bw + gap) + bw / 2},${chainY + bh + 8} Q${startX + 1.5 * (bw + gap)},${chainY + bh + 40} ${startX + bw + gap + bw / 2},${chainY + bh + 8}`}
                fill="none" stroke={C.notarized} strokeWidth={1.5} strokeDasharray="4,3" />
              <polygon points={`${startX + bw + gap + bw / 2 - 4},${chainY + bh + 4} ${startX + bw + gap + bw / 2},${chainY + bh + 8} ${startX + bw + gap + bw / 2 + 4},${chainY + bh + 4}`} fill={C.notarized} />
              <text x={startX + 1.5 * (bw + gap) + bw / 2} y={chainY + bh + 42} textAnchor="middle" fill={C.notarized} fontSize={9} fontFamily="monospace" fontWeight={600}>
                select_parent(v+1) = A
              </text>
            </g>
          );
        })()}


        {/* Insight text */}
        {step === 1 && (
          <text x={W / 2} y={ROW_Y + VALIDATOR_R + 68} textAnchor="middle" fill={C.text} fontSize={10} fontFamily="monospace" fontWeight={600}>
            Block A is M-notarized. It is safe to build the next block on A.
          </text>
        )}
        {step === 2 && (
          <text x={W / 2} y={ROW_Y + VALIDATOR_R + 68} textAnchor="middle" fill={C.text} fontSize={10} fontFamily="monospace" fontWeight={600}>
            Of the {M} voters, at most f={F} can be Byzantine. The remaining {honestInM} are honest and are locked to block A.
          </text>
        )}
        {step === 3 && (
          <text x={W / 2} y={ROW_Y + VALIDATOR_R + 68} textAnchor="middle" fill={C.text} fontSize={10} fontFamily="monospace" fontWeight={600}>
            R3 and R4 (Byzantine) equivocate and vote for block B, convincing R5-R10 to also vote B.
          </text>
        )}
        {/* Vote tally section (steps 1-3) */}
        {!showAdvance && (
          <g>
            <text x={30} y={300} fill={C.muted} fontSize={10} fontFamily="monospace">
              {showBlockB ? 'can block B be finalized?' : 'vote tallies'}
            </text>
            <line x1={30} y1={305} x2={W - 30} y2={305} stroke="#eee" strokeWidth={1} />

            {/* Block A bar */}
            <text x={BAR_X - 6} y={325 + BAR_H / 2} textAnchor="end" dominantBaseline="middle" fill={C.text} fontSize={10} fontFamily="monospace" fontWeight={600}>block A:</text>
            <rect x={BAR_X} y={325} width={BAR_W} height={BAR_H} rx={3} fill={C.barBg} />
            <rect x={BAR_X} y={325} width={(M / N) * BAR_W} height={BAR_H} rx={3} fill={C.notarized} opacity={0.85} />
            <line x1={BAR_X + (M / N) * BAR_W} y1={319} x2={BAR_X + (M / N) * BAR_W} y2={345} stroke={C.barM} strokeWidth={2} strokeDasharray="3,2" />
            <text x={BAR_X + (M / N) * BAR_W} y={315} textAnchor="middle" fill={C.barM} fontSize={9} fontFamily="monospace" fontWeight={700}>M={M}</text>
            <line x1={BAR_X + (L / N) * BAR_W} y1={319} x2={BAR_X + (L / N) * BAR_W} y2={345} stroke={C.barL} strokeWidth={2} strokeDasharray="3,2" />
            <text x={BAR_X + (L / N) * BAR_W} y={315} textAnchor="middle" fill={C.barL} fontSize={9} fontFamily="monospace" fontWeight={700}>L={L}</text>
            <text x={BAR_X + BAR_W + 10} y={325 + BAR_H / 2} dominantBaseline="middle" fill={C.text} fontSize={11} fontFamily="monospace" fontWeight={700}>
              {M}/{N}{step === 1 ? ' (M notarized)' : ''}
            </text>

            {/* Block B bar - step 3 */}
            {showBlockB && (
              <g>
                <text x={BAR_X - 6} y={370 + BAR_H / 2} textAnchor="end" dominantBaseline="middle" fill={C.text} fontSize={10} fontFamily="monospace" fontWeight={600}>block B:</text>
                <rect x={BAR_X} y={370} width={BAR_W} height={BAR_H} rx={3} fill={C.barBg} />
                <rect x={BAR_X} y={370} width={(maxB / N) * BAR_W} height={BAR_H} rx={3} fill="#0d9488" opacity={0.85} />
                <line x1={BAR_X + (M / N) * BAR_W} y1={364} x2={BAR_X + (M / N) * BAR_W} y2={390} stroke={C.barM} strokeWidth={2} strokeDasharray="3,2" />
                <text x={BAR_X + (M / N) * BAR_W} y={360} textAnchor="middle" fill={C.barM} fontSize={9} fontFamily="monospace" fontWeight={700}>M={M}</text>
                <line x1={BAR_X + (L / N) * BAR_W} y1={364} x2={BAR_X + (L / N) * BAR_W} y2={390} stroke={C.barL} strokeWidth={2} strokeDasharray="3,2" />
                <text x={BAR_X + (L / N) * BAR_W} y={360} textAnchor="middle" fill={C.barL} fontSize={9} fontFamily="monospace" fontWeight={700}>L={L}</text>
                <text x={BAR_X + BAR_W + 10} y={370 + BAR_H / 2} dominantBaseline="middle" fill="#dc2626" fontSize={11} fontFamily="monospace" fontWeight={700}>{maxB}/{N}</text>
              </g>
            )}

            {/* Proof text - step 3 */}
            {showBlockB && (
              <g>
                <text x={W / 2} y={415} textAnchor="middle" fill={C.text} fontSize={10} fontFamily="monospace">
                  B max votes = {honestNotInA} remaining honest + {F} Byzantine equivocators = {maxB}
                </text>
                <text x={W / 2} y={438} textAnchor="middle" fill="#dc2626" fontSize={12} fontFamily="monospace" fontWeight={700}>
                  {maxB} {'<'} L={L}: block B cannot be finalized.
                </text>
              </g>
            )}
          </g>
        )}

        {/* Step 4: Advance to next view - text */}
        {showAdvance && (
          <g>
            <text x={W / 2} y={270} textAnchor="middle" fill={C.text} fontSize={10} fontFamily="monospace">
              Block A reached M = {M}, so a notarization for A exists.
            </text>
            <text x={W / 2} y={288} textAnchor="middle" fill={C.text} fontSize={10} fontFamily="monospace">
              No conflicting block can reach the finalization quorum of {L} in the same view.
            </text>
            <text x={W / 2} y={320} textAnchor="middle" fill={C.notarized} fontSize={11} fontFamily="monospace" fontWeight={700}>
              The next leader safely proposes a new block on top of A.
            </text>
            <line x1={200} y1={340} x2={W - 200} y2={340} stroke="#eee" strokeWidth={1} />
            <text x={W / 2} y={366} textAnchor="middle" fill={C.muted} fontSize={9} fontFamily="monospace">
              select_parent(v+1) scans backward for the latest notarized block and finds A in view v.
            </text>
            <text x={W / 2} y={384} textAnchor="middle" fill={C.muted} fontSize={9} fontFamily="monospace">
              The leader of v+1 builds on A. If multiple notarizations exist in a view, the leader may pick any.
            </text>
          </g>
        )}

        {/* Step selector */}
        <foreignObject x={10} y={H - 34} width={500} height={28}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', gap: 4, fontFamily: 'monospace', fontSize: 10 }}>
            {M_STEPS.map((s) => (
              <button key={s.id} type="button" onClick={() => setStep(s.id)} style={{
                padding: '3px 12px',
                border: `1px solid ${step === s.id ? C.text : '#d0d0d0'}`,
                background: step === s.id ? C.text : 'white',
                color: step === s.id ? 'white' : C.muted,
                fontFamily: 'monospace', fontSize: 10, cursor: 'pointer', borderRadius: 3,
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}

// ─── Sub-tabs ──────────────────────────────────────────────────────

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'm-notarization', label: 'M Notarization' },
];

// ─── Main component ────────────────────────────────────────────────

const SPEED_SLOW = 0.45;
const SPEED_FAST = 1.3;

export default function MinimmitVisualization() {
  const [activeTab, setActiveTab] = useState('overview');
  const [speed, setSpeed] = useState(SPEED_FAST);
  const [mode, setMode] = useState('simple');
  const speedRef = useRef(SPEED_FAST);
  speedRef.current = speed;

  const simpleAnim = useSimpleAnimation(speedRef);
  const pipelinedAnim = usePipelinedAnimation(speedRef);

  return (
    <div className="viz-container">
      <div className="viz-header">
        <h1 className="viz-title">
          <a href="https://github.com/commonwarexyz/monorepo/blob/main/pipeline/minimmit/minimmit.md" target="_blank" rel="noopener noreferrer">
            Minimmit
          </a>
        </h1>
        <p className="viz-subtitle">
          Byzantine-fault-tolerant SMR protocol. Tolerates {'<'}20% Byzantine replicas. Finalizes in a single round of voting.
        </p>
      </div>

      <div className="legend">
        <div className="legend-header">
          <span className="legend-header-label">parameters (n={N}, f={F})</span>
        </div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: C.notarized, borderRadius: '50%' }} />
            <span className="legend-label">M notarization</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: C.finalized, borderRadius: '50%' }} />
            <span className="legend-label">finalization threshold</span>
          </div>
        </div>
      </div>

      <div className="channel-selectors-row" style={{ marginBottom: 4, marginTop: 0 }}>
        <div className="channel-selector" style={{ padding: '6px 12px' }}>
          <div className="channel-selector-buttons">
            {SUB_TABS.map((tab) => (
              <button key={tab.id} type="button"
                className={`channel-selector-button ${activeTab === tab.id ? 'channel-selector-button--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >{tab.label}</button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'overview' && mode === 'simple' && (
        <SimpleScene {...simpleAnim} speed={speed} onSpeedChange={setSpeed} mode={mode} onModeChange={setMode} />
      )}

      {activeTab === 'overview' && mode === 'pipelined' && (
        <PipelinedScene {...pipelinedAnim} speed={speed} onSpeedChange={setSpeed} mode={mode} onModeChange={setMode} />
      )}

      {activeTab === 'm-notarization' && (
        <MNotarizationScene />
      )}


      {(activeTab === 'overview' || activeTab === 'm-notarization') && (
        <div style={{ fontFamily: 'monospace', fontSize: '0.78em', color: C.text, lineHeight: 1.4, margin: '6px 0 0', display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 2px' }}>
              <strong>M notarization</strong> (2f+1, {'>'}40%): advance to next view.
              <span style={{ color: C.muted }}> = {M} votes (~{Math.round((M / N) * 100)}%)</span>
            </p>
            <p style={{ margin: 0 }}>
              <strong>finalization threshold</strong> (4f+1, {'>'}80%): finalize block.
              <span style={{ color: C.muted }}> = {L} votes (~{Math.round((L / N) * 100)}%)</span>
            </p>
          </div>
          {activeTab === 'overview' && mode === 'pipelined' && (
            <p style={{ margin: 0, flex: 1, color: C.muted, fontSize: '0.95em' }}>
              Minimmit allows block proposals to be pipelined: once a block reaches M notarization, the next leader can immediately build on top of it without waiting for finalization. Validators vote on block n+1 (dark fill) while still accumulating L votes to finalize block n (outer ring).
            </p>
          )}
        </div>
      )}

      <div className="viz-footer">
        <a href="https://github.com/DhruvPareek/monorepo/tree/feat/visualization-work/commonware-visualization">GitHub</a>
        <a href="https://commonware.xyz">commonware.xyz</a>
      </div>
    </div>
  );
}
