import { useState, useEffect, useCallback, useRef } from 'react';

// Animation phases and durations (ms)
const PHASES = [
  { name: 'IDLE', duration: 1000 },
  { name: 'PROPOSE', duration: 1500 },
  { name: 'VOTE', duration: 2000 },
  { name: 'FINALIZE', duration: 1500 },
  { name: 'BRIDGE', duration: 2000 },
];

const TOTAL_CYCLE = PHASES.reduce((s, p) => s + p.duration, 0);

export function useAnimation() {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [activeNetwork, setActiveNetwork] = useState(1);
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const dt = timestamp - lastRef.current;
    lastRef.current = timestamp;

    setElapsed((prev) => {
      const next = prev + dt;
      if (next >= TOTAL_CYCLE) {
        setActiveNetwork((n) => (n === 1 ? 2 : 1));
        return next - TOTAL_CYCLE;
      }
      return next;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) {
      lastRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, tick]);

  // Derive current phase and progress within phase
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

  const toggle = useCallback(() => setPlaying((p) => !p), []);

  return {
    playing,
    toggle,
    phase: phase.name,
    phaseProgress,
    activeNetwork,
    elapsed,
  };
}
