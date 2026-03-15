# commonware-visualization

Interactive SVG explainers for [Commonware](https://commonware.xyz) examples. Built with React + Vite.

**Live demo:** https://monorepo-three-khaki.vercel.app/

## Visualizations

- **Alto** -- 5-validator blockchain with consensus rounds, indexer, and follower sync.
- **Bridge** -- Two validator networks exchanging finalization certificates through a shared indexer.
- **Chat** -- Encrypted group messaging with an authorized peer set and an unauthorized outsider.
- **Flood** -- Peers deployed to AWS EC2 spamming random messages to stress-test broadcast.
- **Log** -- Four participants committing to a secret log and agreeing on its hash via Simplex consensus.
- **Sync** -- Server-client state synchronization via QMDB with Merkle proofs.

Each visualization has its own component (`src/components/*Visualization.jsx`), data files (`src/data/<example>/`), and animation hook (`src/hooks/`).

## Running

```bash
npm install
npm run dev    # dev server with HMR
npm run build  # production build
```
