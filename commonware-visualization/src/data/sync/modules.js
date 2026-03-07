export const SYNC_MODULES = {
  storage: {
    name: 'storage',
    color: '#795548',
    short: 'QMDB state sync',
    detail:
      'QMDB (Qualified Merkle Database) in any/current/immutable variants. Stores an append-only log of operations, each committed under a Merkle root. Server holds the evolving log; client rebuilds a verified copy. Merkle proofs ensure every fetched batch is consistent with the server\'s tree.',
  },
  stream: {
    name: 'stream',
    color: '#F57C00',
    short: 'Frame-based TCP',
    detail:
      'Provides length-prefixed framing for messages exchanged over plain TCP (no encryption). The send_frame/recv_frame codec handles varint length prefixes and size validation.',
  },
  codec: {
    name: 'codec',
    color: '#455A64',
    short: 'Wire serialization',
    detail:
      'Encodes/decodes all sync protocol messages: GetSyncTarget, GetOperations requests and their responses (Target, operations + Merkle proof, errors).',
  },
  cryptography: {
    name: 'cryptography',
    color: '#C62828',
    short: 'SHA-256 Merkle proofs',
    detail:
      'SHA-256 hashing for QMDB Merkle tree construction. Proofs verify that fetched operation batches are consistent with the server\'s root.',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Server, client, and network foundation',
    detail:
      'The only layer that touches the OS. Provides task spawning, TCP networking (bind/dial), disk storage for QMDB, and timers. Server, client, and all communication go through the runtime context.',
  },
};

export const SYNC_MODULE_LIST = Object.values(SYNC_MODULES);
