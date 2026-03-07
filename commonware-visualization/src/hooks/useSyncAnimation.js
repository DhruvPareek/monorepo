import { useState, useEffect, useCallback, useRef } from 'react';

// Sync phases with durations (ms)
const SYNC_PHASES = [
  { name: 'GET_TARGET', duration: 1000 },
  { name: 'FETCH_OPS', duration: 2500 },
  { name: 'VERIFY', duration: 1500 },
  { name: 'APPLY', duration: 1500 },
  { name: 'SYNCED', duration: 1500 },
];

const SERVER_INTERVAL = 5000; // Server adds ops every 5s
const SYNC_INTERVAL = 12000; // Sync starts every 12s
const OPS_PER_BATCH = 3; // Ops added per server tick
const INITIAL_OPS = 4; // Start with some ops

export function useSyncAnimation() {
  const [serverOps, setServerOps] = useState(INITIAL_OPS);
  const [clientOps, setClientOps] = useState(0);
  const [serverAnimatingOps, setServerAnimatingOps] = useState(new Set());
  const [clientAnimatingOps, setClientAnimatingOps] = useState(new Set());
  const [syncPhase, setSyncPhase] = useState(null);
  const [syncPhaseProgress, setSyncPhaseProgress] = useState(0);

  const syncTargetRef = useRef(0);
  const syncStartRef = useRef(null);
  const syncPhaseIdxRef = useRef(0);
  const rafRef = useRef(null);
  const serverTimerRef = useRef(null);
  const syncTimerRef = useRef(null);
  const lastServerOpsRef = useRef(INITIAL_OPS);
  const clientOpsBeforeSyncRef = useRef(0);

  // Flash new ops briefly
  const flashOps = useCallback((setter, startOp, count) => {
    const ops = new Set();
    for (let i = startOp + 1; i <= startOp + count; i++) ops.add(i);
    setter(ops);
    setTimeout(() => setter(new Set()), 600);
  }, []);

  // Server timer: add ops every 5s
  useEffect(() => {
    serverTimerRef.current = setInterval(() => {
      setServerOps((prev) => {
        const next = prev + OPS_PER_BATCH;
        flashOps(setServerAnimatingOps, prev, OPS_PER_BATCH);
        lastServerOpsRef.current = next;
        return next;
      });
    }, SERVER_INTERVAL);

    return () => clearInterval(serverTimerRef.current);
  }, [flashOps]);

  // Sync timer: start sync cycle every 12s
  useEffect(() => {
    const startSync = () => {
      syncTargetRef.current = lastServerOpsRef.current;
      syncPhaseIdxRef.current = 0;
      syncStartRef.current = performance.now();
      setSyncPhase(SYNC_PHASES[0].name);
      setSyncPhaseProgress(0);
      setClientOps((prev) => {
        clientOpsBeforeSyncRef.current = prev;
        return prev;
      });
    };

    // Start first sync after a short delay
    const initialDelay = setTimeout(startSync, 3000);
    syncTimerRef.current = setInterval(startSync, SYNC_INTERVAL);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(syncTimerRef.current);
    };
  }, []);

  // RAF loop to drive sync phase progress and client op ramping
  useEffect(() => {
    const tick = () => {
      if (syncStartRef.current !== null) {
        const elapsed = performance.now() - syncStartRef.current;
        let acc = 0;
        let found = false;

        for (let i = 0; i < SYNC_PHASES.length; i++) {
          const p = SYNC_PHASES[i];
          if (elapsed < acc + p.duration) {
            if (i !== syncPhaseIdxRef.current) {
              syncPhaseIdxRef.current = i;
              setSyncPhase(p.name);
            }
            const progress = (elapsed - acc) / p.duration;
            setSyncPhaseProgress(Math.min(progress, 1));

            // During APPLY, ramp clientOps toward syncTarget
            if (p.name === 'APPLY') {
              const target = syncTargetRef.current;
              const base = clientOpsBeforeSyncRef.current;
              const ramped = Math.round(base + (target - base) * Math.min(progress * 1.5, 1));
              setClientOps((prev) => {
                const next = Math.min(ramped, target);
                if (next > prev) {
                  flashOps(setClientAnimatingOps, prev, next - prev);
                }
                return next;
              });
            }

            found = true;
            break;
          }
          acc += p.duration;
        }

        // All phases done
        if (!found) {
          setClientOps(syncTargetRef.current);
          syncStartRef.current = null;
          setSyncPhase(null);
          setSyncPhaseProgress(0);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [flashOps]);

  return {
    serverOps,
    clientOps,
    serverAnimatingOps,
    clientAnimatingOps,
    syncPhase,
    syncPhaseProgress,
    // Backward compat
    phase: syncPhase || 'IDLE',
    phaseProgress: syncPhaseProgress,
  };
}
