import { useState, useEffect, useCallback, useRef } from 'react';

const PHASES = [
  { name: 'PROPOSE', duration: 1500 },
  { name: 'NOTARIZE', duration: 2200 },
  { name: 'FINALIZE', duration: 1700 },
  { name: 'NULLIFY', duration: 1300 },
  { name: 'REPAIR', duration: 1500 },
];

const TOTAL_CYCLE = PHASES.reduce((sum, phase) => sum + phase.duration, 0);
const PARTICIPANT_COUNT = 4;

export function useLogAnimation() {
  const [elapsed, setElapsed] = useState(0);
  const [view, setView] = useState(1);
  const [leaderIndex, setLeaderIndex] = useState(0);
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const dt = timestamp - lastRef.current;
    lastRef.current = timestamp;

    setElapsed((prev) => {
      const next = prev + dt;
      if (next >= TOTAL_CYCLE) {
        setView((current) => current + 1);
        setLeaderIndex((current) => (current + 1) % PARTICIPANT_COUNT);
        return next - TOTAL_CYCLE;
      }
      return next;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    lastRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  let acc = 0;
  let phase = PHASES[0];
  let phaseProgress = 0;
  for (const candidate of PHASES) {
    if (elapsed < acc + candidate.duration) {
      phase = candidate;
      phaseProgress = (elapsed - acc) / candidate.duration;
      break;
    }
    acc += candidate.duration;
  }

  return {
    view,
    phase: phase.name,
    phaseProgress,
    leaderIndex,
    repairPeerIndex: (leaderIndex + 2) % PARTICIPANT_COUNT,
  };
}
