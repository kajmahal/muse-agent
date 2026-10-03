import assert from "node:assert/strict";

import { openAttuneGraph } from "../packages/attunegraph/dist/index.js";
import { createInMemoryAttuneGraphStore } from "../packages/attunegraph/dist/testing.js";
import {
  defineAttuneGraphSourceAdapter,
  projectAttuneGraphSource
} from "../packages/attunegraph/dist/source-adapter.js";

const scope = { sourceId: "kaj.life-state", threadId: "shopping-milk" };
const threadRoot = { id: "thread:shopping-milk", kind: "thread" };

const NEED_ASSERTION = "assertion:kaj:need:milk";
const AGENT_CLAIM_ASSERTION = "assertion:kaj:agent-claim:milk-purchased";
const PURCHASE_ASSERTION = "assertion:kaj:purchase:milk";
const PURCHASE_SUPERSEDES_ASSERTION = "assertion:kaj:purchase-supersedes-need:milk";

const t0 = "2026-10-03T15:00:00.000Z";
const t1 = "2026-10-03T15:05:00.000Z";
const t2 = "2026-10-03T15:10:00.000Z";
const t3 = "2026-10-03T15:20:00.000Z";

function assertionsFor(input, context) {
  const assertions = [{
    schemaVersion: 1,
    id: NEED_ASSERTION,
    subject: { id: "artifact:need:milk", kind: "artifact" },
    predicate: "CONTEXT_FOR",
    object: context.threadRoot,
    epistemicClass: "user-asserted",
    sourceRefs: [{
      namespace: "kaj.messages",
      id: "message:need-milk",
      version: "msg-v1"
    }],
    recordedAt: t0,
    validFrom: t0,
    ...(input.needSupersededAt ? { supersededAt: input.needSupersededAt } : {}),
    derivation: { kind: "projection", version: "kaj-life-state@1" }
  }];

  if (input.agentClaim) {
    assertions.push({
      schemaVersion: 1,
      id: AGENT_CLAIM_ASSERTION,
      subject: { id: "artifact:agent-claim:milk-purchased", kind: "artifact" },
      predicate: "CORRELATES_WITH",
      object: { id: "artifact:need:milk", kind: "artifact" },
      epistemicClass: "model-hypothesis",
      sourceRefs: [{
        namespace: "kaj.chatgpt",
        id: "run:claim-only",
        version: "run-v1"
      }],
      recordedAt: t1,
      validFrom: t1,
      derivation: { kind: "model", runId: "run:claim-only", version: "kaj-life-state-model@1" }
    });
  }

  if (input.purchaseObserved) {
    const sourceRefs = [{
      namespace: "kaj.receipts",
      id: "receipt:tesco:milk",
      version: "receipt-v1"
    }];
    assertions.push(
      {
        schemaVersion: 1,
        id: PURCHASE_ASSERTION,
        subject: { id: "artifact:purchase:milk", kind: "artifact" },
        predicate: "CONTEXT_FOR",
        object: context.threadRoot,
        epistemicClass: "source-observed",
        sourceRefs,
        recordedAt: t2,
        validFrom: t2,
        derivation: { kind: "projection", version: "kaj-life-state@1" }
      },
      {
        schemaVersion: 1,
        id: PURCHASE_SUPERSEDES_ASSERTION,
        subject: { id: "artifact:purchase:milk", kind: "artifact" },
        predicate: "SUPERSEDES",
        object: { id: "artifact:need:milk", kind: "artifact" },
        epistemicClass: "source-observed",
        sourceRefs,
        recordedAt: t2,
        validFrom: t2,
        derivation: { kind: "projection", version: "kaj-life-state@1" }
      }
    );
  }

  return assertions;
}

const adapter = defineAttuneGraphSourceAdapter({
  capabilities: {
    maxAssertionsPerExtraction: 8,
    sourceKinds: ["kaj-life-state"],
    supportsIncremental: true
  },
  extract: (input, context) => ({ assertions: assertionsFor(input, context) }),
  metadata: {
    id: "kaj.life-state.synthetic",
    label: "Kaj Life State synthetic proof",
    version: "0.1.0"
  }
});

function queryActive(graph, asOf) {
  return graph.execute({
    operator: "working-graph@1",
    seed: threadRoot,
    now: asOf,
    maxEstimatedTokens: 4000
  });
}

function queryFresh(graph, asOf) {
  return graph.query({
    operator: "decision-query@1",
    scope,
    seed: threadRoot,
    asOf,
    head: { mode: "current" },
    freshness: { require: "fresh" },
    budget: { maxEstimatedTokens: 4000 }
  });
}

function assertionIds(result) {
  return new Set(result.workingGraph.assertions.map((assertion) => assertion.id));
}

function helpfulnessDecision(result) {
  if (result.status !== "complete") return "hold";
  return assertionIds(result).has(NEED_ASSERTION) ? "offer" : "silent";
}

async function project(graph, input, observedAt, freshnessState, correlationKey) {
  return projectAttuneGraphSource({
    adapter,
    attuneGraph: graph,
    correlationKey,
    input,
    observedAt,
    scope,
    sourceFreshness: { state: freshnessState, observedAt },
    sourceKind: "kaj-life-state",
    threadRoot
  });
}

const graph = await openAttuneGraph({
  scope,
  store: createInMemoryAttuneGraphStore()
});

try {
  await project(graph, {}, t0, "fresh", "need-milk-v1");
  const need = await queryActive(graph, t0);
  assert.equal(need.status, "complete");
  assert.equal(helpfulnessDecision(need), "offer");
  assert.ok(assertionIds(need).has(NEED_ASSERTION));

  await project(graph, { agentClaim: true }, t1, "fresh", "need-milk-agent-claim-v1");
  const claimOnly = await queryActive(graph, t1);
  assert.equal(claimOnly.status, "complete");
  assert.equal(helpfulnessDecision(claimOnly), "offer");
  assert.ok(assertionIds(claimOnly).has(NEED_ASSERTION));
  assert.ok(assertionIds(claimOnly).has(AGENT_CLAIM_ASSERTION));

  await project(graph, {
    needSupersededAt: t2,
    purchaseObserved: true
  }, t2, "fresh", "need-milk-purchased-v1");
  const purchased = await queryActive(graph, t2);
  assert.equal(purchased.status, "complete");
  assert.equal(helpfulnessDecision(purchased), "silent");
  assert.equal(assertionIds(purchased).has(NEED_ASSERTION), false);
  assert.ok(assertionIds(purchased).has(PURCHASE_ASSERTION));

  await project(graph, {
    needSupersededAt: t2,
    purchaseObserved: true
  }, t3, "stale", "need-milk-stale-v1");
  const stale = await queryFresh(graph, t3);
  assert.equal(stale.status, "abstained");
  assert.equal(helpfulnessDecision(stale), "hold");
  assert.deepEqual(stale.receipt.diagnostics.abstentionReasons, ["source-not-fresh"]);

  console.log(JSON.stringify({
    status: "PASS",
    phases: {
      needObserved: "offer",
      agentClaimOnly: "offer",
      purchaseVerified: "silent",
      sourceStale: "hold"
    },
    invariant: "model claims never close the need; verified current evidence can supersede it; stale evidence never authorizes action"
  }, null, 2));
} finally {
  await graph.close();
}
