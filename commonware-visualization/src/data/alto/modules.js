export const ALTO_MODULES = {
  consensus: {
    name: 'consensus',
    color: '#7B1FA2',
    short: 'BFT via Simplex',
    detail:
      'simplex::Engine with VRF-based leader election. Validators propose and vote on block digests. BLS12-381 threshold signatures (3-of-5). Notarization requires 2f+1 votes, followed by finalization.',
  },
  p2p: {
    name: 'p2p',
    color: '#0097A7',
    short: 'Authenticated peer mesh',
    detail:
      'authenticated::discovery::Network with ED25519-authenticated connections. 5 channels: pending(0), recovered(1), resolver(2), broadcast(3), marshal(4), each with independent rate limits.',
  },
  cryptography: {
    name: 'cryptography',
    color: '#C62828',
    short: 'Ed25519 + BLS12-381 + SHA-256',
    detail:
      'Ed25519 for validator identity and P2P authentication. BLS12-381 MinSig for threshold consensus certificates (notarization and finalization). SHA-256 for block digest computation.',
  },
  broadcast: {
    name: 'broadcast',
    color: '#E65100',
    short: 'Message buffering',
    detail:
      "buffered::Engine buffers out-of-order consensus messages with priority. Sits between P2P transport and the consensus engine, ensuring messages aren't dropped if the node isn't ready.",
  },
  storage: {
    name: 'storage',
    color: '#795548',
    short: 'Finalized chain persistence',
    detail:
      'Two immutable archives: finalizations-by-height and finalized-blocks. zstd level 3 compression. Page cache: 4KB pages, 32MB capacity. Enables crash recovery without violating safety.',
  },
  codec: {
    name: 'codec',
    color: '#455A64',
    short: 'Binary serialization',
    detail:
      'commonware-codec Encode/Decode for all wire and storage formats. Block, Seed, Notarization, Finalization all use binary encoding with varint compression.',
  },
  parallel: {
    name: 'parallel',
    color: '#283593',
    short: 'Sig verification',
    detail:
      'BLS12-381 signature verification via commonware-parallel. Validators use thread pools for parallel verification. Indexer and follower use Sequential strategy.',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Async foundation',
    detail:
      'Tokio-based async executor. Task spawning, TCP networking, storage I/O, buffer primitives, rate limiting, and metrics. All other modules depend on this.',
  },
  resolver: {
    name: 'resolver',
    color: '#6A1B9A',
    short: 'Certificate backfill',
    detail:
      'Resolves missing certificates and blocks when a node falls behind. Validators use P2P-based resolution; follower uses HTTP fetching from indexer.',
  },
};

export const ALTO_MODULE_LIST = Object.values(ALTO_MODULES);
