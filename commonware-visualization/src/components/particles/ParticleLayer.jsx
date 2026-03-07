export default function ParticleLayer() {
  return (
    <defs>
      {/* Bridge gradient: teal -> amber */}
      <linearGradient id="bridgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#0097A7" />
        <stop offset="100%" stopColor="#F57C00" />
      </linearGradient>
      {/* Runtime band: subtle green at bottom */}
      <linearGradient id="runtimeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.06" />
        <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.01" />
      </linearGradient>
    </defs>
  );
}
