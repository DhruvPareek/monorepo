import { MODULES } from '../data/modules';

export default function Tooltip({ info, position }) {
  if (!info) return null;

  const { type, id, moduleKey, pipelineLabel } = info;
  let title, body;

  if (type === 'module' && moduleKey) {
    const mod = MODULES[moduleKey];
    title = mod?.name;
    body = pipelineLabel
      ? `${pipelineLabel}: ${mod?.detail}`
      : mod?.detail;
  } else if (type === 'validator') {
    title = id;
    body = 'Validator node. Internal: storage (consensus WAL), parallel (BLS sig verification), runtime (async). Communicates via p2p mesh (ed25519 auth) and encrypted stream to indexer.';
  } else if (type === 'indexer') {
    title = 'Indexer';
    body = 'Bridge indexer. Internal: parallel (BLS12-381 threshold sig verification), runtime (async). Receives blocks and finality certificates over encrypted stream.';
  }

  if (!title) return null;

  return (
    <div
      className="tooltip"
      style={{
        left: position.x + 12,
        top: position.y - 8,
      }}
    >
      <div className="tooltip-title">{title}</div>
      <div className="tooltip-body">{body}</div>
    </div>
  );
}
