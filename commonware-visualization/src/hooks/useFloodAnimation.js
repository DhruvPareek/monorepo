import { useState, useEffect, useCallback, useRef } from 'react';

const PHASES = [
  { name: 'PROVISION', duration: 1500 },
  { name: 'DISCOVER', duration: 2500 },
  { name: 'FLOOD', duration: 3200 },
  { name: 'OBSERVE', duration: 1800 },
];

const TOTAL_CYCLE = PHASES.reduce((sum, phase) => sum + phase.duration, 0);

export function useFloodAnimation() {
  const [elapsed, setElapsed] = useState(0);
  const [wave, setWave] = useState(1);
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const dt = timestamp - lastRef.current;
    lastRef.current = timestamp;

    setElapsed((prev) => {
      const next = prev + dt;
      if (next >= TOTAL_CYCLE) {
        setWave((current) => current + 1);
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
    phase: phase.name,
    phaseProgress,
    wave,
  };
}
