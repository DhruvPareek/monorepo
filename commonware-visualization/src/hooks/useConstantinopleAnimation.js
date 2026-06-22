import { useState, useEffect, useCallback, useRef } from 'react';

// One block's lifecycle, from transaction intake to the live explorer.
const PHASES = [
  { name: 'IDLE', duration: 900 },
  { name: 'SUBMIT', duration: 1600 },
  { name: 'PROPOSE', duration: 2000 },
  { name: 'VOTE', duration: 1500 },
  { name: 'NOTARIZE', duration: 1700 },
  { name: 'FINALIZE', duration: 1700 },
  { name: 'EXECUTE', duration: 1500 },
  { name: 'INDEX', duration: 1500 },
  { name: 'STREAM', duration: 1500 },
];

const TOTAL_CYCLE = PHASES.reduce((s, p) => s + p.duration, 0);
const VALIDATOR_COUNT = 4;

export function useConstantinopleAnimation() {
  const [elapsed, setElapsed] = useState(0);
  const [blockHeight, setBlockHeight] = useState(1);
  const [leader, setLeader] = useState(0);
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const dt = timestamp - lastRef.current;
    lastRef.current = timestamp;

    setElapsed((prev) => {
      const next = prev + dt;
      if (next >= TOTAL_CYCLE) {
        setBlockHeight((h) => h + 1);
        setLeader((l) => (l + 1) % VALIDATOR_COUNT);
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
  for (const p of PHASES) {
    if (elapsed < acc + p.duration) {
      phase = p;
      phaseProgress = (elapsed - acc) / p.duration;
      break;
    }
    acc += p.duration;
  }

  return {
    phase: phase.name,
    phaseProgress,
    blockHeight,
    leader,
  };
}
