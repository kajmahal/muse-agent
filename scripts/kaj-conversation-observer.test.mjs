import assert from "node:assert/strict";
import test from "node:test";

import {
  exactProposalForQuote,
  observeCommittedConversationTurn
} from "./lib/kaj-conversation-observer.mjs";
import { runGuardianTick } from "./lib/kaj-guardian-tick.mjs";

const HASH = "a".repeat(64);
const COMMITTED_AT = "2026-10-03T18:21:17.605Z";

function turn(overrides = {}) {
  return {
    assistantMessage: "I can prepare that for you.",
    committedAt: COMMITTED_AT,
    contentHash: HASH,
    conversationId: "chatgpt-20261003T-example-00000001",
    source: "chatgpt",
    turnNumber: 7,
    userMessage: "I promised Grandad I'll sort the 3D model tomorrow. I already bought milk.",
    ...overrides
  };
}

test("binds user candidates to exact committed spans and forbids memory promotion", () => {
  const raw = turn();
  const commitment = exactProposalForQuote({
    kind: "COMMITMENT",
    message: raw.userMessage,
    quote: "I promised Grandad I'll sort the 3D model tomorrow.",
    summary: "Sort Grandad's 3D model tomorrow"
  });
  const purchased = exactProposalForQuote({
    kind: "PURCHASED",
    message: raw.userMessage,
    quote: "I already bought milk.",
    summary: "Milk was already bought"
  });

  const observed = observeCommittedConversationTurn(raw, [commitment, purchased]);
  assert.equal(observed.candidates.length, 2);
  assert.equal(observed.candidates[0].epistemicClass, "user-asserted");
  assert.equal(observed.candidates[0].operation, "open");
  assert.equal(observed.candidates[1].operation, "resolve");
  for (const candidate of observed.candidates) {
    assert.equal(candidate.lifeStateAdmission, "candidate-only");
    assert.equal(candidate.memoryPromotion, "forbidden");
    assert.equal(candidate.sourceRef.namespace, "kaj.context.raw");
    assert.equal(candidate.sourceRef.version, HASH);
    assert.match(candidate.sourceRef.id, /#turn:7:user:/u);
  }
});

test("assistant-only evidence is always a model hypothesis", () => {
  const raw = turn({ assistantMessage: "You already bought milk." });
  const proposal = exactProposalForQuote({
    kind: "PURCHASED",
    message: raw.assistantMessage,
    quote: "You already bought milk.",
    role: "assistant",
    summary: "Assistant says milk was bought"
  });
  const observed = observeCommittedConversationTurn(raw, [proposal]);
  assert.equal(observed.candidates[0].epistemicClass, "model-hypothesis");
  assert.equal(observed.candidates[0].lifeStateAdmission, "hypothesis-only");
  assert.equal(observed.candidates[0].memoryPromotion, "forbidden");
});

test("offsets are the evidence boundary and cannot cite outside the committed role text", () => {
  const raw = turn();
  assert.throws(
    () => observeCommittedConversationTurn(raw, [{
      end: raw.userMessage.length + 1,
      kind: "NEED",
      role: "user",
      start: 0,
      summary: "invalid"
    }]),
    /bounded non-negative integer/
  );
  assert.throws(
    () => exactProposalForQuote({
      kind: "NEED",
      message: raw.userMessage,
      quote: "I need something that was never said.",
      summary: "hallucinated"
    }),
    /quote does not occur/
  );
});

test("candidate identity is stable for the same committed evidence and changes with turn provenance", () => {
  const raw = turn();
  const proposal = exactProposalForQuote({
    kind: "NEED",
    message: raw.userMessage,
    quote: "I already bought milk.",
    summary: "Need candidate for identity test"
  });
  const first = observeCommittedConversationTurn(raw, [proposal]).candidates[0];
  const again = observeCommittedConversationTurn(raw, [proposal]).candidates[0];
  assert.equal(first.candidateId, again.candidateId);

  const changed = observeCommittedConversationTurn(
    turn({ contentHash: "b".repeat(64) }),
    [proposal]
  ).candidates[0];
  assert.notEqual(first.candidateId, changed.candidateId);
});

test("a direct user resolution can suppress an open loop; an assistant claim cannot", async () => {
  const source = {
    namespace: "kaj.context.raw",
    id: "chatgpt-example#turn:8:user:0-18",
    version: "c".repeat(64)
  };
  const openLoop = {
    id: "milk",
    assertedAt: "2026-10-03T15:00:00.000Z",
    epistemicClass: "user-asserted",
    sourceRef: {
      namespace: "kaj.context.raw",
      id: "chatgpt-example#turn:2:user:0-11",
      version: "d".repeat(64)
    }
  };

  const resolved = await runGuardianTick({
    freshness: "fresh",
    modelClaims: [],
    observedAt: "2026-10-03T18:30:00.000Z",
    openLoop,
    resolution: {
      id: "user-said-bought",
      observedAt: "2026-10-03T18:30:00.000Z",
      epistemicClass: "user-asserted",
      sourceRef: source
    },
    threadId: "shopping-milk",
    timingDecision: "offer"
  });
  assert.equal(resolved.decision, "silent");
  assert.equal(resolved.reason, "open-loop-no-longer-current");

  await assert.rejects(
    runGuardianTick({
      freshness: "fresh",
      modelClaims: [],
      observedAt: "2026-10-03T18:30:00.000Z",
      openLoop,
      resolution: {
        id: "assistant-guessed-bought",
        observedAt: "2026-10-03T18:30:00.000Z",
        epistemicClass: "model-hypothesis",
        sourceRef: source
      },
      threadId: "shopping-milk",
      timingDecision: "offer"
    }),
    /resolution requires user-asserted, source-observed, or deterministic-derived evidence/
  );
});

