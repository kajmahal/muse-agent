import assert from "node:assert/strict";
import test from "node:test";

import { runGuardianTick } from "./lib/kaj-guardian-tick.mjs";

const t0 = "2026-10-03T15:00:00.000Z";
const t1 = "2026-10-03T15:05:00.000Z";
const t2 = "2026-10-03T15:10:00.000Z";

function openLoop() {
  return {
    id: "milk",
    assertedAt: t0,
    epistemicClass: "user-asserted",
    sourceRef: {
      namespace: "kaj.messages",
      id: "message:need-milk",
      version: "msg-v1"
    }
  };
}

function base(overrides = {}) {
  return {
    freshness: "fresh",
    modelClaims: [],
    observedAt: t1,
    openLoop: openLoop(),
    resolution: null,
    threadId: "shopping-milk",
    timingDecision: "offer",
    ...overrides
  };
}

test("current open loop follows the timing decision but never grants action authority", async () => {
  for (const timingDecision of ["silent", "digest", "offer"]) {
    const result = await runGuardianTick(base({ timingDecision }));
    assert.equal(result.status, "ready");
    assert.equal(result.decision, timingDecision);
    assert.equal(result.reason, "current-open-loop");
    assert.equal(result.actionAuthority, false);
    assert.equal(result.evidence.status, "complete");
  }
});

test("a model claim cannot close a current open loop", async () => {
  const result = await runGuardianTick(base({
    modelClaims: [{
      id: "claim-handled",
      observedAt: t1,
      runId: "run:claim-only",
      sourceRef: {
        namespace: "kaj.chatgpt",
        id: "run:claim-only",
        version: "run-v1"
      }
    }]
  }));
  assert.equal(result.status, "ready");
  assert.equal(result.decision, "offer");
  assert.equal(result.reason, "current-open-loop");
  assert.equal(result.actionAuthority, false);
});

test("verified resolution suppresses the old loop and historical model claims leave the current head", async () => {
  const result = await runGuardianTick(base({
    modelClaims: [{
      id: "claim-handled",
      observedAt: t1,
      runId: "run:claim-only",
      sourceRef: {
        namespace: "kaj.chatgpt",
        id: "run:claim-only",
        version: "run-v1"
      }
    }],
    observedAt: t2,
    resolution: {
      id: "tesco-milk",
      observedAt: t2,
      epistemicClass: "source-observed",
      sourceRef: {
        namespace: "kaj.receipts",
        id: "receipt:tesco:milk",
        version: "receipt-v1"
      }
    }
  }));
  assert.equal(result.status, "ready");
  assert.equal(result.decision, "silent");
  assert.equal(result.reason, "open-loop-no-longer-current");
  assert.equal(result.actionAuthority, false);
  assert.equal(
    result.evidence.assertionIds.some((id) => id.includes("model-claim")),
    false
  );
});

test("stale and unknown source state fail closed", async () => {
  for (const freshness of ["stale", "unknown"]) {
    const result = await runGuardianTick(base({ freshness }));
    assert.equal(result.status, "held");
    assert.equal(result.decision, null);
    assert.equal(result.actionAuthority, false);
    assert.equal(result.evidence.status, "abstained");
  }
});

test("a model hypothesis cannot be supplied as an authoritative open loop or resolution", async () => {
  await assert.rejects(
    runGuardianTick(base({
      openLoop: {
        ...openLoop(),
        epistemicClass: "model-hypothesis"
      }
    })),
    /openLoop epistemicClass cannot be model-hypothesis/
  );
  await assert.rejects(
    runGuardianTick(base({
      observedAt: t2,
      resolution: {
        id: "guessed",
        observedAt: t2,
        epistemicClass: "model-hypothesis",
        sourceRef: {
          namespace: "kaj.chatgpt",
          id: "guess",
          version: "v1"
        }
      }
    })),
    /resolution requires source-observed or deterministic-derived evidence/
  );
});

