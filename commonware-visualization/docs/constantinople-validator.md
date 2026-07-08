# Constantinople — Validator Visualization Reference

A complete description of the **validator** sub-tab of the Constantinople
visualization. Every label, sub-label, tooltip, and piece of text below is
verbatim from the source.

Source files:
- `src/components/ConstantinopleVisualization.jsx` — wrapper (sub-tabs, header, footer)
- `src/components/ConstantinopleValidatorVisualization.jsx` — the validator view
- `src/data/constantinople/validatorLayout.js` — nodes, edges, geometry
- `src/hooks/useValidatorFlow.js` — auto-cycling lifecycle animation

---

## 0. How you reach it & the shared frame

The visualization lives under the **Constantinople** top-level tab, which has two
sub-tabs — `chain` and `validator` — rendered as small tabs at the top-left of the
box. The default sub-tab is **`chain`**, so you click **`validator`** to see this
view. The wrapper provides shared chrome around whichever sub-tab is active:

- **Title:** "Constantinople" (links to `https://github.com/commonwarexyz/constantinople`).
- **Subtitle:** "Constantinople is a high-throughput account-model blockchain example built on top of commonware primitives."
- **Footer:** "GitHub" (`https://github.com/DhruvPareek/monorepo/tree/feat/visualization-work/commonware-visualization`) and "commonware.xyz" (`https://commonware.xyz`).
- Mouse position is tracked here and passed to the active sub-view so tooltips follow the cursor.

## 1. The scene / layout

The SVG canvas is **1150 × 720**. It is an "exploded" internal diagram of a single
**primary** validator process. Three structural layers are drawn first:

- **Validator process boundary** — a dashed grey rounded rectangle at
  `x 235–1060, y 95–655`, labeled **"primary validator process"** in its top-left.
  Everything the validator owns is inside it; `Client` and `Peers` sit *outside* it
  on the far left.
- **Engine sub-container** — a light-grey filled rounded rectangle at
  `x 545–1050, y 135–610`, labeled **"constantinople-engine"** at its top-left. The
  five engine actors (simplex, marshal, glue, application, QMDB) live inside it.
- **Runtime foundation band** — a faint green gradient strip across the full width at
  the bottom (~`y 686–720`), centered text:
  **"runtime (tokio async + rayon workers) - storage, networking, telemetry, metrics"**.

Below the SVG: the **lifecycle selector**, then a **hint line**:
> "The validator binary is process-level glue: it loads config, starts the runtime, networking, and mempool, then constructs and starts constantinople-engine. Hover a box or pick a lifecycle stage."

## 2. The boxes (nodes)

Nine boxes. Each has a `label` (bold), a `sublabel` (small grey), a `color`, and a
position. **Visual conventions:**

- **Subsystem boxes** (the 7 internal ones): white fill, solid grey border, a
  **colored left stripe** (the primitive's color), black label, grey sub-label. When
  part of the active lifecycle step they get a **colored border + a pulsing colored
  ring**; when not, they dim to ~28% opacity.
- **External boxes** (`Client`, `Peers`): visually distinct — **dashed grey outline,
  light-grey fill (`#f2f2f2`), no colored stripe, muted grey label** — because they
  aren't commonware/constantinople modules. They still get a colored emphasis ring
  when their step is active.
- Hovering any box shows a tooltip (title = the box label; body = the string below),
  positioned at the cursor.

### Client — external
- **Position:** far left, upper (`115, 250`). Outside the process boundary.
- **Sub-label:** "submits txs"
- **Color (ring):** `#607D8B` (blue-grey)
- **Connected to:** `mempool` (edge `POST txs`).
- **Tooltip:** "External client (or the spammer) that signs transactions and submits them to the validator over HTTP."

### Peers — external
- **Position:** far left, lower (`115, 505`). Outside the boundary.
- **Sub-label:** "other validators"
- **Color (ring):** `#607D8B` (blue-grey)
- **Connected to:** `p2p` (edge `mesh`).
- **Tooltip:** "The other validators in the fixed epoch-0 set. Votes, certificates, and erasure-coded shards are exchanged with them over the authenticated p2p mesh."

### mempool — subsystem
- **Position:** left-center, inside the boundary, left of the engine (`350, 300`).
- **Sub-label:** "transaction mailbox"
- **Color:** `#1565C0` (blue)
- **Connected to:** `client` (in, `POST txs`), `application` (out, `tx batch`), `marshal` (in, `resolve`).
- **Tooltip:** "constantinople-mempool. Transaction intake over an HTTP server; handlers verify submissions and queue them in a mailbox. The engine pulls from this mailbox (its TransactionSource) when proposing a block. When a block finalizes, marshal reports it back here so clients waiting on their submitted transactions get a finalized/dropped result."

### p2p discovery — subsystem
- **Position:** left-center, lower, inside boundary, left of engine (`350, 485`).
- **Sub-label:** "8 channels"
- **Color:** `#0097A7` (cyan)
- **Connected to:** `marshal` (in, `shards`), `simplex` (in, `votes / certs`), `peers` (out, `mesh`).
- **Tooltip:** "commonware_p2p::authenticated::discovery. Authenticated peer networking with discovery. Registers 8 rate-limited channels: votes, certificates, simplex resolver, marshal shards, marshal backfill, state-sync, transaction-sync, and the state-sync probe."

### simplex — subsystem (inside engine)
- **Position:** engine, upper-left (`630, 235`).
- **Sub-label:** "BFT votes + certs"
- **Color:** `#7B1FA2` (purple)
- **Connected to:** `glue` (out, `propose / verify`), `p2p` (out, `votes / certs`).
- **Tooltip:** "commonware_consensus::simplex. Single-epoch BFT consensus. Votes are signed with a BLS threshold share; notarization and finalization are threshold certificates. A round-robin elector picks the leader each view."

### marshal — subsystem (inside engine)
- **Position:** engine, lower-left (`630, 500`).
- **Sub-label:** "erasure shards"
- **Color:** `#E65100` (deep orange)
- **Connected to:** `glue` (in, `block`), `p2p` (out, `shards`), `glue` (out, `finalization`), `mempool` (out, `resolve`).
- **Tooltip:** "commonware_consensus::marshal. Makes finalized blocks available. It erasure-codes proposed blocks into shards using commonware-coding so any threshold of validators can reconstruct the body, pairs certificates with blocks, and backfills missing blocks."

### glue stateful — subsystem (inside engine, center)
- **Position:** engine, center (`805, 368`).
- **Sub-label:** "drives app + state"
- **Color:** `#00695C` (teal)
- **Connected to:** `simplex` (in, `propose / verify`), `application` (out, `execute`), `marshal` (out, `block`), `marshal` (in, `finalization`), `qmdb` (out, `commit`).
- **Tooltip:** "commonware_glue::stateful manages the speculative QMDB lifecycle. It does not execute or verify blocks itself: it calls into constantinople-application to propose, verify, and apply, then commits the database on finalization and drives state and transaction sync for recovery."

### application — subsystem (inside engine)
- **Position:** engine, upper-right (`975, 235`).
- **Sub-label:** "transaction execution"
- **Color:** `#37474F` (slate — Constantinople's own crate, not a commonware primitive)
- **Connected to:** `mempool` (in, `tx batch`), `glue` (in, `execute`), `qmdb` (out, `roots`).
- **Tooltip:** "constantinople-application. On propose it pulls a mempool batch and executes transfers; on verify it re-executes a peer block against the parent state and compares roots."

### QMDB — subsystem (inside engine)
- **Position:** engine, lower-right (`975, 500`).
- **Sub-label:** "state + tx DBs"
- **Color:** `#795548` (brown)
- **Connected to:** `application` (in, `roots`), `glue` (in, `commit`).
- **Tooltip:** "commonware_storage::qmdb. Merkleized account-state log and transaction-hash log. Each block advances a state root and a transactions root that can be proven to light clients."

## 3. The connectors (edges)

Twelve directed edges, drawn as lines clipped to the two box borders. **Inactive**
edges are faint grey (`#ececec`, ~40% opacity, no label, no particle). **Active**
edges (those in the current step) are drawn in the edge's color at full strength,
with an **animated particle** (a colored dot traveling `from → to` on a 1.3s loop)
and a **label** rendered in a layer on top of the boxes (with a white halo), placed
on whichever perpendicular side of the line is clear of boxes.

| id | from → to | label | color |
|----|-----------|-------|-------|
| submit | client → mempool | `POST txs` | blue `#1565C0` |
| txsource | mempool → application | `tx batch` | blue `#1565C0` |
| elect | simplex → glue | `propose / verify` | purple `#7B1FA2` |
| glue_app | glue → application | `execute` | teal `#00695C` |
| app_qmdb | application → qmdb | `roots` | slate `#37474F` |
| block | glue → marshal | `block` | orange `#E65100` |
| marshal_p2p | marshal → p2p | `shards` | orange `#E65100` |
| simplex_p2p | simplex → p2p | `votes / certs` | purple `#7B1FA2` |
| p2p_peers | p2p → peers | `mesh` | cyan `#0097A7` |
| finalize | marshal → glue | `finalization` | orange `#E65100` |
| glue_commit | glue → qmdb | `commit` | teal `#00695C` |
| reporter | marshal → mempool | `resolve` | green `#2E7D32` |

Label placement: each label anchors at a fraction `labelPos` along its line (default
0.5 = midpoint) and is offset perpendicular to whichever side is clear of boxes.
`txsource` overrides this with `labelPos: 0.68` to push `tx batch` right of the
simplex box into the open gap before the application box.

## 4. The lifecycle stepper (the animated core)

Below the diagram is a selector titled **"Block Lifecycle"** with five stage buttons.
The current stage **auto-cycles** (~3.4s dwell each, via `useValidatorFlow`); clicking
a stage **pins** it (freezes on it), and clicking the same pinned stage again
**un-pins** and resumes cycling.

For the active stage: its **edges** light up (color + particle + label), its **nodes**
are emphasized (colored border + pulsing ring), and every other subsystem box dims to
~28%. The active stage's `detail` text shows beneath the buttons. The **top-right step
indicator** shows the stage name in caps (e.g. `PROPOSE`), appends `(pinned)` when
pinned, with a purple progress bar underneath (fills with `progress` while cycling;
full when pinned).

### 1. Submit
- **Detail:** "Clients POST signed transactions to the mempool HTTP server, whose request handlers verify each transaction and queue it in the mailbox."
- **Edges lit:** `submit` (client → mempool).
- **Nodes emphasized:** `client`, `mempool`.
- **Looks like:** a blue particle travels from the Client box into the mempool box, `POST txs` beside the line; Client and mempool glow, everything else dims.

### 2. Propose
- **Detail:** "When simplex elects this validator as leader, glue asks the application to propose. The application pulls a batch from the mempool TransactionSource, executes the transfers, and produces a block plus updated QMDB state and transaction roots."
- **Edges lit:** `elect` (simplex → glue), `txsource` (mempool → application), `glue_app` (glue → application), `app_qmdb` (application → qmdb).
- **Nodes emphasized:** `simplex`, `glue`, `mempool`, `application`, `qmdb`.
- **Looks like:** particles flow simplex → glue (`propose / verify`), mempool → application (`tx batch`), glue → application (`execute`), application → qmdb (`roots`) — leader pulls a batch, executes, writes roots.

### 3. Broadcast
- **Detail:** "The proposed block is erasure-coded by marshal into shards and disseminated over the p2p mesh, while simplex votes and threshold certificates flow over their own channels to the other validators."
- **Edges lit:** `block` (glue → marshal), `marshal_p2p` (marshal → p2p), `simplex_p2p` (simplex → p2p), `p2p_peers` (p2p → peers).
- **Nodes emphasized:** `glue`, `marshal`, `simplex`, `p2p`, `peers`.
- **Looks like:** block goes glue → marshal (`block`), out marshal → p2p (`shards`) and simplex → p2p (`votes / certs`), then p2p → Peers (`mesh`).

### 4. Verify
- **Detail:** "Simplex carries only a commitment (a coding digest), not the block body. The block itself is reconstructed by marshal from erasure-coded shards received over the mesh; glue then calls application.verify_child, which checks signatures, re-executes the block body against the parent state, and compares the computed roots to the header roots."
- **Edges lit:** `p2p_peers` (p2p → peers), `simplex_p2p` (simplex → p2p), `marshal_p2p` (marshal → p2p, the shards path), `elect` (simplex → glue), `glue_app` (glue → application), `app_qmdb` (application → qmdb).
- **Nodes emphasized:** `peers`, `p2p`, `simplex`, `marshal`, `glue`, `application`, `qmdb`.
- **Looks like:** the inbound path — shards arrive via marshal over the mesh (the block body is *not* carried by simplex, which conveys only the commitment), simplex delivers votes/certs, then glue re-executes the block via application and compares roots against QMDB. Verifying a peer block calls `marshal.subscribe_by_commitment(...)` to reconstruct it from shards (`consensus/src/marshal/coding/marshaled.rs`, `deferred_verify`).

### 5. Finalize
- **Detail:** "On a marshal finalization update, glue commits the finalized QMDB batch. The finalized update also flows back to the mempool reporter so submitters waiting on those batches resolve."
- **Edges lit:** `finalize` (marshal → glue), `glue_commit` (glue → qmdb), `reporter` (marshal → mempool).
- **Nodes emphasized:** `marshal`, `glue`, `qmdb`, `mempool`.
- **Looks like:** marshal → glue (`finalization`), glue → qmdb (`commit`), marshal → mempool (`resolve`). The **application is deliberately not in this step** — on a primary its finalized hook is a no-op; committing is glue's job.

## 5. Interaction & rendering mechanics

- **Auto-cycle vs. pin:** `useValidatorFlow(5)` advances the active index every ~3.4s;
  `pinned` overrides it (`activeIndex = pinned ?? autoIndex`); the toggle is per-button.
- **Emphasis / dim:** active-step nodes get colored border + pulsing ring; non-active
  subsystem nodes drop to 0.28 opacity; external nodes keep their dashed grey look.
- **Edges:** lines + particles are drawn *under* the boxes; **labels are drawn in a
  separate layer above the boxes** (with a white halo) and positioned on the box-clear
  side of each line, so no label is ever hidden.
- **Tooltips:** hover any box → title (its label) + body (the strings in §2), following
  the cursor.
- **Color legend:** blue = mempool, cyan = p2p, purple = simplex/consensus, orange =
  marshal, teal = glue, slate = application, brown = QMDB/storage, green =
  reporter/runtime, blue-grey = external.

## 6. Scope note

This view models the **primary** validator only. Secondary-only paths — the relayer
and the indexer upload path (the application's finalized hook) — are intentionally
omitted, as is the account-read path. The whole process is labeled "primary validator
process", so the boxes and tooltips do not repeat the word "primary".
