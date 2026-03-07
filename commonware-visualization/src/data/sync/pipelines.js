// Server -> Client: sync data over framed TCP
// Codec serializes, stream frames with varint length prefixes, runtime provides the TCP channel,
// stream deframes on the other side, codec deserializes. No encryption on the wire.
export const SYNC_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'stream', label: 'send_frame', side: 'inner' },
  { module: 'runtime', label: 'TCP', side: 'center' },
  { module: 'stream', label: 'recv_frame', side: 'inner' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Modules that live inside each node type
export const SERVER_INTERNAL = [
  { module: 'storage', label: 'QMDB' },
  { module: 'cryptography', label: 'sha256' },
];

export const CLIENT_INTERNAL = [
  { module: 'storage', label: 'QMDB' },
  { module: 'cryptography', label: 'sha256' },
];
