export const MODULES = {
  p2p: {
    name: 'p2p',
    color: '#0097A7',
    short: 'Authenticated peer mesh',
    detail:
      'authenticated::discovery::Network handles peer discovery (via bootstrappers), ED25519-authenticated connections, and peer availability tracking. Provides 3 channels for validator-to-validator consensus messaging: votes(0), certificates(1), resolver(2).',
  },
  consensus: {
    name: 'consensus',
    color: '#7B1FA2',
    short: 'BFT via Simplex',
    detail:
      'simplex::Engine with RoundRobin<Sha256> election. Validators propose and vote on block digests, not full blocks (blocks fetched separately from indexer). BLS12-381 threshold sigs (3-of-4). Finalization certificates enable the cross-network bridge.',
  },
  stream: {
    name: 'stream',
    color: '#F57C00',
    short: 'Encrypted point-to-point',
    detail:
      'Authenticated, encrypted TCP connections between each validator and the indexer via encrypted::dial/listen. Simpler than p2p — no discovery or channels, just a direct framed pipe. Ed25519 authentication happens once at connection setup (handshake), not per-message.',
  },
  cryptography: {
    name: 'cryptography',
    color: '#C62828',
    short: 'Ed25519 + BLS12-381 + SHA-256',
    detail:
      'Ed25519 for validator/indexer identity and authentication (p2p handshakes, stream handshakes). BLS12-381 MinSig for threshold consensus certificates that power the cross-network bridge. SHA-256 for block digests that consensus votes on.',
  },
  codec: {
    name: 'codec',
    color: '#455A64',
    short: 'Binary serialization',
    detail:
      'Encode/Decode for Inbound/Outbound message types (PutBlock, GetBlock, PutFinalization, etc).',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Async foundation',
    detail:
      'Tokio-based async executor providing all OS abstractions: task spawning (Spawner), TCP networking (dial/bind), storage I/O (page cache for consensus WAL), buffer primitives (Buf/BufMut for codec), rate limiting (Quota for P2P channels), and metrics. All other modules depend on this — nothing in the example touches the OS directly.',
  },
  storage: {
    name: 'storage',
    color: '#795548',
    short: 'Consensus state persistence',
    detail:
      'Validators persist consensus protocol state (votes, notarizations, view progression) to a log partition. Enables crash recovery without violating safety (e.g. double-voting). Does not store blocks.',
  },
  parallel: {
    name: 'parallel',
    color: '#283593',
    short: 'Sig verification',
    detail:
      'Parallel strategy for simplex vote/certificate verification and assembly; also used to verify external-network BLS finalization certificates in bridge blocks.',
  },
};

export const MODULE_LIST = Object.values(MODULES);
