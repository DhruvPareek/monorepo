export const ALTO_MODULES = {
  consensus: {
    name: 'consensus',
    color: '#7B1FA2',
    short: 'Simplex + marshal',
    detail:
      'commonware-consensus is used through simplex::Engine for BFT votes and certificates and through marshal::Actor for pairing certificates with blocks, finalized-chain ingestion, subscriptions, and repair/backfill.',
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
    short: 'Block dissemination',
    detail:
      'buffered::Engine disseminates full block bodies over the broadcaster channel and provides the in-memory block buffer/mailbox that marshal integrates with. In follower mode, Alto still uses the broadcast buffer because marshal needs its local mailbox interface, but the network side is disabled by wiring it to no-op sender/receiver objects.',
  },
  storage: {
    name: 'storage',
    color: '#795548',
    short: 'Finalized chain persistence',
    detail:
      'Finalized blocks and certificates persist in archive storage. Validators restore immutable finalized archives; followers use immutable or prunable archives depending on pruning_depth.',
  },
  codec: {
    name: 'codec',
    color: '#455A64',
    short: 'Binary serialization',
    detail:
      'commonware-codec encodes Alto artifacts at P2P, HTTP, WebSocket, and storage boundaries. Some fields use compact encodings, but the visualization does not assume one uniform wire-format rule for everything.',
  },
  parallel: {
    name: 'parallel',
    color: '#283593',
    short: 'Sig verification',
    detail:
      'Validators verify threshold signatures in parallel. The indexer uses Sequential. The follower does some verification sequentially and uses parallel workers for heavier background sync verification.',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Async foundation',
    detail:
      'Tokio-based async executor. Task spawning, TCP networking, storage I/O, buffer primitives, rate limiting, and metrics. All modules depend on this.',
  },
  resolver: {
    name: 'resolver',
    color: '#AD1457',
    short: 'Repair and backfill',
    detail:
      'Repairs missing data. Validators use simplex resolver traffic for certificate repair by view and marshal-driven repair/backfill for missing blocks or certificate-plus-block bundles. The follower translates repair requests into HTTP fetches against the indexer.',
  },
};

export const ALTO_MODULE_LIST = Object.values(ALTO_MODULES);
