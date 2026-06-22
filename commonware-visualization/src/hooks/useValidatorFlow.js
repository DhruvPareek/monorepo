import { useState, useEffect, useCallback, useRef } from 'react';

// Auto-advances through the validator flow steps, returning the active index
// and how far through the current step's dwell we are. Callers can override the
// index by pinning a step in the selector.
export function useValidatorFlow(stepCount, dwell = 3400) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef(null);
  const lastRef = useRef(null);
  const cycle = dwell * stepCount;

  const tick = useCallback(
    (timestamp) => {
      if (lastRef.current === null) lastRef.current = timestamp;
      const dt = timestamp - lastRef.current;
      lastRef.current = timestamp;
      setElapsed((prev) => (prev + dt) % cycle);
      rafRef.current = requestAnimationFrame(tick);
    },
    [cycle]
  );

  useEffect(() => {
    lastRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  const index = Math.floor(elapsed / dwell) % stepCount;
  const progress = (elapsed % dwell) / dwell;
  return { index, progress };
}
