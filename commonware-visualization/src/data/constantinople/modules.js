// Commonware primitives that Constantinople composes, with the colors and
// descriptions surfaced in the legend and tooltips. Sourced from the
// constantinople README primitive table, the engine channel wiring, and the
// indexer publisher layout.
export const CONSTANTINOPLE_MODULES = {
  consensus: {
    name: 'consensus',
    color: '#7B1FA2',
    short: 'Single-epoch simplex BFT',
    detail:
      'commonware_consensus::simplex runs forever in epoch zero with a fixed validator set. Votes (channel 0) and certificates (channel 1) are signed with a BLS12-381 threshold scheme, so notarization and finalization are single threshold signatures. A round-robin elector picks the leader; there is no DKG actor or epoch orchestrator.',
  },
  marshal: {
    name: 'marshal',
    color: '#E65100',
    short: 'Erasure-coded block availability',
    detail:
      'commonware_consensus::marshal makes finalized blocks available. Proposed blocks are erasure-coded (using commonware-coding) into shards (channel 3) so any threshold of validators can reconstruct the body, and marshal pairs certificates with blocks, ingests the finalized chain, and backfills missing blocks over its resolver (channel 4).',
  },
  storage: {
    name: 'storage',
    color: '#795548',
    short: 'QMDB merkleized state',
    detail:
      'commonware_storage::qmdb is a Merkleized key-value database holding the account state log and the transaction-hash log. Each finalized block advances a state root and a transactions root over append-only operation logs that can be proven to light clients and the explorer.',
  },
  glue: {
    name: 'glue',
    color: '#00695C',
    short: 'Stateful speculative execution',
    detail:
      'commonware_glue::stateful manages the speculative QMDB lifecycle. Rather than executing blocks itself, it calls into constantinople-application to propose, verify, and apply, commits the database on finalization, and drives state sync. New validators recover by syncing the state and transaction databases (channels 5 and 6) to a probed finalization floor before following near the tip.',
  },
  mempool: {
    name: 'mempool',
    color: '#1565C0',
    short: 'Transaction intake + proposals',
    detail:
      'constantinople-mempool admits signed transactions over HTTP through its webserver, deduplicates them by transaction digest, and supplies batches for the next block proposal. Primary validators expose the HTTP listener; a relayer can front it. Batches outside a finalized-block grace window are dropped so clients can retry.',
  },
  p2p: {
    name: 'p2p',
    color: '#0097A7',
    short: 'Authenticated discovery mesh',
    detail:
      'commonware_p2p::authenticated::discovery connects ED25519-authenticated peers and discovers new ones. Eight rate-limited channels carry votes, certificates, the simplex resolver, marshal shards, marshal backfill, state-sync, transaction-sync, and the state-sync probe. Underneath, the discovery layer also gossips its own peer-address records and runs a commonware-stream handshake on every connection; those are not drawn as lanes. On each lane the chips show the codec serialization boundary, the channel owning module, and this transport; commonware-resolver appears where it is the request/response mechanism, while coding and parallel are folded into their owners.',
  },
  resolver: {
    name: 'resolver',
    color: '#AD1457',
    short: 'Repair + backfill',
    detail:
      'commonware_resolver::p2p is the shared request/response mechanism the repair and sync stacks build on. It fetches data a validator is missing: simplex certificates by view (channel 2), finalized blocks for marshal backfill (channel 4), and QMDB state and transaction operations during sync (channels 5 and 6).',
  },
  cryptography: {
    name: 'cryptography',
    color: '#C62828',
    short: 'Ed25519 + BLS12-381 + SHA-256',
    detail:
      'commonware_cryptography::{ed25519, bls12381, sha256}. ed25519 authenticates peers and validator identity and signs transactions; bls12381 (MinSig) backs the simplex threshold certificates (notarization and finalization); sha256 hashes blocks, transactions, and QMDB nodes.',
  },
  codec: {
    name: 'codec',
    color: '#455A64',
    short: 'Binary serialization',
    detail:
      'commonware-codec encodes every artifact at the P2P, HTTP, storage, and indexer-upload boundaries: transactions, votes, certificates, marshal shards, QMDB operations, and the SQL metadata rows the explorer consumes.',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Async foundation',
    detail:
      'commonware_runtime::tokio is the async executor, paired with a commonware-parallel Rayon worker strategy for parallel signature verification. It provides task spawning, TCP networking, storage I/O, buffer pools, rate limiting, and metrics. Every other module runs on top of it.',
  },
};

export const CONSTANTINOPLE_MODULE_LIST = Object.values(CONSTANTINOPLE_MODULES);
