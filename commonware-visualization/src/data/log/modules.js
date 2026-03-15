export const LOG_MODULES = {
  consensus: {
    name: 'consensus',
    color: '#7B1FA2',
    short: 'Simplex on digests',
    detail:
      'simplex::Engine runs round-robin leader selection, proposal handling, notarize/finalize/nullify voting, certificate tracking, crash-safe replay, and the resolver lane for missing certificates by view. The network orders SHA-256 digests, not the full secret messages.',
  },
  p2p: {
    name: 'p2p',
    color: '#0097A7',
    short: 'Authenticated discovery',
    detail:
      'authenticated::discovery::Network maintains peer set 0, bootstraps from known addresses, and carries three registered channels: votes(0), certificates(1), and resolver(2).',
  },
  cryptography: {
    name: 'cryptography',
    color: '#C62828',
    short: 'Ed25519 + SHA-256',
    detail:
      'Ed25519 identities authenticate peers and sign votes/certificates. SHA-256 hashes the fixed genesis string and every local 16-byte secret before the digest enters consensus.',
  },
  storage: {
    name: 'storage',
    color: '#795548',
    short: 'Journal persistence',
    detail:
      'Consensus artifacts persist in the local log partition so a restarted node can replay prior votes, certificates, and certification decisions without violating safety.',
  },
  parallel: {
    name: 'parallel',
    color: '#283593',
    short: 'Verification strategy',
    detail:
      'The example wires `commonware_parallel::Sequential` into Simplex, so vote and certificate verification still follow the common parallelism abstraction even though the demo uses the simplest strategy.',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Async foundation',
    detail:
      'commonware-runtime::tokio hosts the network, consensus actors, storage, quotas, RNG-backed secret generation, metrics, and the local GUI task. Every moving part in the example runs on this foundation.',
  },
};

export const LOG_MODULE_LIST = Object.values(LOG_MODULES);
