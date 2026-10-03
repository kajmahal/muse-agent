# Muse → JakOS adaptation map

## Scope and evidence boundary

Target: a persistent personal guardian on **Jimmy**, not a second agent platform. Kaj owns live computer/browser observation, execution, notifications, scheduling, Apple access, bootstrap/context, approvals, and post-action verification. This Kaj inventory is supplied by the assignment; Kaj implementations were not audited here.

Reviewed candidate: Muse `5188027103eb743ec700126dabd1fdd1d6634dce`, with the checked-out AttuneGraph submodule matching the gitlink `c9f5ce969df3dce65ca118570fb4b7e5653a430f`. The submodule is newer than the pin described in Muse's README: distinguish **engine capabilities** from **Muse product wiring**. Evidence below is repository documentation and inspected source, not an executed runtime qualification.

## Capability truth: shipped, partial, roadmap

| Area | What exists in this checkout | Boundary |
| --- | --- | --- |
| **Attunement: shipped narrow slice** | Explicit owner-chosen threads and links, user-invoked Continuity Packs, four explicit outcomes, and a deterministic thread display-policy reducer. Optional Observe O1 has consented category/time/duration collection and pause/inspect/forget controls. [A][B] | No inferred thread ownership or autonomous action. O1 collects metadata; it does not infer rhythm, friction, usefulness, or when to help. |
| **Attunement: partial signature experience** | Shadow timing ledger and factual explicit-CLI-return association; bounded task/note/reminder Capsule preparation with a restart-safe host comparison baseline; owner-taught Policy Card review and separately confirmed thread-display-policy apply. [A][C] | CLI return is not feedback or proof of benefit. Capsule citation membership is not semantic entailment, exact stop capture, or current source truth. Policy Card preview is inert; bounded display-policy apply is not general authority. |
| **AttuneGraph: shipped engine contracts** | Neutral, source-usable temporal/provenance engine; bounded Decision Query/AttuneQL; typed authority/conflict and Decision Context queries; compact model view plus detached replayable proof; source-adapter SDK; in-memory store and portable `.atgx`. [D] | No registry publication. SDK is not a ready-made parser/connector/OCR pipeline. Receipts and current-head checks do not prove external truth, producer authenticity, or permission to execute. |
| **AttuneGraph: partial Muse integration / platform limit** | Explicit Muse Continuity/Shadow projection and evidence-only resume wiring. Opt-in durable SQLite/Admin profile exists on reviewed Linux/macOS; **Windows local SQLite/Admin fails closed**. [C][D][E] | Muse's current writer records freshness as `unknown`; its documentation says authority composition is not product-wired. Do not interpret the newer core authority API as shipped Muse action authorization, or as a durable Jimmy graph. |
| **Proactivity and scheduler: implemented substrates** | Reminder/pattern/follow-up/objective loops, quiet hours, veto/budget/digest primitives; cron/on-exit jobs, admission/pause seams, execution history and optional locks. [F][G] | Product strategy labels proactive/pattern help experimental, not the closed Attunement loop. Budget wiring is optional and ledger-read failure can allow delivery; scheduler defaults include a no-op distributed lock. These are not hard guardian guarantees without host wiring. |
| **Policy, runtime-state, browser/tools: implemented foundations** | Deterministic policy primitives, bound approval receipts, checkpoints/run history, resident status helpers, opt-in real-Chrome CDP tools and optional tool effect verification/idempotency. [H][I][J] | Effect verification is conditional on a tool's `verifyEffect`; not universal. Resident health inspection is macOS-oriented, not a proven Windows supervisor. Browser package expects approval injection by its caller. |
| **Roadmap, not a shipped guardian** | Full automatic Shadow → Capsule → Policy Card loop; automatic thread/stop/return detection and delivery; rhythm/friction hypotheses; usefulness qualification; default continuous current-world ingestion; trusted trial/edit/reject/rollback controls and physical graph-journal compaction/forget. [A][C][D] | No claim of turnkey 24-hour autonomy, all-source freshness, arbitrary desktop control, or benefit from synthetic replay. |

## Four classifications

| Classification | Muse contribution | JakOS disposition |
| --- | --- | --- |
| **REUSE** | Exact linked-source Continuity Pack preparation; explicit `used / adjusted / ignored / rejected`; narrow display-policy reducer. [B] | Borrow the unfinished-thread/receipt contract and deterministic functions. Keep source bytes authoritative in Kaj; opening a pack or completing a task must never silently become feedback or approval. |
| **REUSE** | AttuneGraph bounded provenance/temporal evidence and explicit `complete / partial / abstained` results. [D] | Candidate for a later rebuildable context projection over Kaj-owned observations, not a replacement memory database. Start with supported in-memory/portable contracts; do not enable unsupported Windows durability. |
| **ADAPT** | Muse-local artifact/provider grammar and snapshot/receipt composition. [B][C] | Add a narrow Kaj resolver with exact IDs, roles, timestamps, versions and source scope. Muse is not plug-compatible with arbitrary Kaj sources: task/note references require `local`, calendar and MCP resources have distinct provider rules. Do not relabel remote data as local or mint Muse production evidence through its host-only seam. |
| **ADAPT** | Quiet/silence reasons, interruption budget, veto, digest and trigger admission. [F][G] | Use them as guardian decision inputs under Kaj Loop and Kaj Notify. Require host-enforced caps, deduplication and fail-closed handling of unknown permission/budget/state; do not inherit Muse's optional or fail-open delivery defaults. |
| **ADAPT** | Runtime checkpoint/run-evidence and approval-receipt shapes. [H][I] | Map useful provenance fields into existing Kaj context and audit records. Re-read live state before effects; checkpoints describe history, not the current desktop. Do not install another state store, supervisor or approval authority. |
| **ALREADY HAVE** | Chrome CDP control, Windows/macOS actuators and tool execution surface. [J] | **Kaj Computer/Browser** owns sensing and actions; **Kaj Apple** owns Apple access. Do not launch Muse's browser, runner or actuator stack alongside them. |
| **ALREADY HAVE** | Messaging delivery, scheduled daemons and model/runtime assembly. [F][G][K] | **Kaj Notify**, **Kaj Loop**, and **Kaj Bootstrap/Context** remain the owners. No second notifier, cron system, boot process, conversation runtime or personal-store authority. |
| **ALREADY HAVE** | Approval and effect verification infrastructure. [H][J] | Existing **Kaj approval/verification model** remains mandatory. A graph receipt, scoped display preference, scheduler event or standing objective cannot replace approval or exact-target read-back. |
| **REJECT** | Wholesale Muse runtime adoption, duplicate services, hidden authority upgrades or unconsented observation. [A][K] | Reject autonomous third-party sends, financial-account/payment actions, raw-keystroke/continuous-screen persistence by default, graph proximity as permission, and roadmap claims presented as shipped Jimmy capabilities. Preserve explicit source scope, pause and forget controls. |

## Smallest first integration seam — AttuneGraph Life-State source adapter

**Validated correction:** start below Muse Continuity, at AttuneGraph's provider-neutral source-adapter boundary. Muse Continuity is still useful later for owner-visible unfinished-thread presentation, but its current provider grammar treats non-calendar/non-resource artifacts such as tasks and reminders as Muse-local. Kaj Apple/Context data must not be mislabeled as Muse-local merely to fit that contract. [B][D]

V0 is deliberately synthetic and read-only. `scripts/kaj-life-state-v0.mjs` proves the base state transition, and `scripts/lib/kaj-guardian-tick.mjs` turns that proof into a reusable per-thread reconciliation tick. The tick rebuilds current evidence in-memory on every call, accepts Muse-compatible `silent / digest / offer` timing, fails closed on stale or unknown source state, and always returns `actionAuthority: false`. Synthetic success is mechanical evidence only; it must not be promoted into learned personal helpfulness without real source observations and explicit outcomes.

1. A user-asserted need remains current -> helpfulness result `offer`.
2. A model hypothesis that the need was handled does **not** close it -> still `offer`.
3. Fresh source-observed purchase evidence supersedes the old need -> `silent`.
4. The same source marked stale -> the decision query abstains and the guardian returns `hold`.

The current-head projection deliberately contains only decision-relevant current assertions. Historical hypotheses remain in their authoritative/audit source rather than being kept live until they push the bounded Working Graph beyond its two-hop decision slice. This preserves provenance without confusing history with present state.

First real-source integration should therefore be one **read-only Kaj source adapter** that emits bounded assertions with exact source refs, valid/recorded time, epistemic class, freshness and supersession. Kaj Computer/Browser, Kaj Apple, Kaj Context, Kaj Notify/Loop and the existing approval/verification model remain the owners around it.

Windows constraint remains explicit: the reviewed AttuneGraph durable local SQLite/Admin profile fails closed on Windows today, so this V0 uses the supported in-memory engine only. Durable persistence on Jimmy is a separate qualification problem, not something to bypass. [D][E]

Acceptance boundary for this seam: no external sends, purchases, bookings, daemon, scheduler replacement, automatic policy promotion or production cutover. The graph supplies bounded current evidence; it never becomes permission to act.

### Conversation Observer

ChatGPT raw conversation files are evidence/history, never the guardian's memory store. `scripts/lib/kaj-conversation-observer.mjs` accepts the exact committed-turn envelope (`conversationId`, turn number, content hash, timestamp, user text, assistant text) and admits only source-linked candidates with exact role-local text offsets. User spans become `user-asserted` candidates; assistant-only spans remain `model-hypothesis`. Every observer candidate is explicitly `memoryPromotion: forbidden`; memory curation remains a separate authority.

QMD remains retrieval/backfill over the raw archive. It may locate historical evidence, but retrieval results do not themselves become current Life State. The reconciler must rebind evidence to exact committed-turn provenance before admission.


## Evidence pointers

- **[A]** [Attunement product contract](../strategy/attunement.md), “Current, experimental, roadmap” and “Evidence provenance trust boundary”; [Observe O1](../design/attunement/observe-o1.md), “Honest limitation”.
- **[B]** [Continuity preparation](../../packages/attunement/src/continuity-pack.ts), lines 28–39, 49–111, 118–126; [file preview/open split](../../packages/attunement/src/continuity-preparation.ts), lines 32–69; [artifact/provider grammar](../../packages/attunement/src/types.ts), lines 22–58; [display-policy reducer](../../packages/attunement/src/policy-reducer.ts), lines 9–25.
- **[C]** [Muse AttuneGraph integration](../../packages/muse-attunegraph/README.md), Policy Card / durable projection / Shadow returns; [AttuneGraph implementation status](../design/attunement/attunegraph.md); [Muse status](../../README.md#status--whats-real-today).
- **[D]** [Checked-out neutral engine](../../packages/attunegraph/README.md), “What ships today”, “Typed API”, “Ownership boundary”, and “Revocation Impact and transition”; [source-adapter SDK](../../packages/attunegraph/SOURCE-ADAPTERS.md), lines 3–11 and 77–96.
- **[E]** [Engine platform contract](../../packages/attunegraph/CONTRIBUTING.md), lines 14–18: reviewed Linux/macOS local profile; Windows fails closed.
- **[F]** [Proactivity package](../../packages/proactivity/README.md); [interruption gate](../../packages/proactivity/src/interruption-gate.ts), lines 29–36, 53–67, 171–188; [proactive loop](../../packages/proactivity/src/proactive-notice-loop.ts), lines 340–359, 460–466, 530–540.
- **[G]** [Scheduler package](../../packages/scheduler/README.md); [scheduler implementation](../../packages/scheduler/src/dynamic-scheduler.ts), lines 76–82 and 287–369: caller admission, lock and settlement seams.
- **[H]** [Policy package](../../packages/policy/README.md); [approval binding/store](../../packages/policy/src/approval-receipt.ts), lines 13–69.
- **[I]** [Runtime-state package](../../packages/runtime-state/README.md); [resident status implementation](../../packages/runtime-state/src/resident-daemon-status.ts), lines 333–339, 937, 1254–1260: non-macOS verification limit.
- **[J]** [Browser package](../../packages/browser/README.md), lines 27–34; [tools package](../../packages/tools/README.md); [conditional effect verification](../../packages/tools/src/executor.ts), lines 85–147.
- **[K]** [Architecture](../architecture/README.md), “One runtime, every surface”; [repository trust floor](../../AGENTS.md), lines 48–69 and 133–145.

Verification for this documentation task: clean starting worktree and matching submodule gitlink checked; cited files/source inspected. No installation, runtime test, integration, commit or push is claimed. Final file-scope verification is the worker's Git status check.
