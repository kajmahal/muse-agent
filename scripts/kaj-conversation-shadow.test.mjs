import assert from "node:assert/strict";
import test from "node:test";

import {
  parseConversationProposalOutput,
  proposeConversationCandidates
} from "./lib/kaj-conversation-proposer.mjs";
import { runConversationShadow } from "./lib/kaj-conversation-shadow.mjs";

const turn = {
  assistantMessage: "I can remind you later, and you already bought milk.",
  committedAt: "2026-10-03T18:21:17.605Z",
  contentHash: "f".repeat(64),
  conversationId: "chatgpt-20261003T-shadow-00000001",
  source: "chatgpt",
  turnNumber: 8,
  userMessage: "I promised Grandad I'd sort his model tomorrow. I already bought milk."
};

test("parses a strict proposal array even with harmless wrapper text", () => {
  const parsed = parseConversationProposalOutput(`result:\n[
    {"kind":"COMMITMENT","role":"user","quote":"I promised Grandad I'd sort his model tomorrow.","summary":"Sort Grandad's model tomorrow"}
  ]\nend`);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].kind, "COMMITMENT");
});

test("drops malformed or unsupported proposal shapes", () => {
  assert.deepEqual(parseConversationProposalOutput('[{"kind":"MEMORY","role":"user","quote":"x","summary":"x"}]'), []);
  assert.deepEqual(parseConversationProposalOutput('[{"kind":"NEED","role":"user","quote":"x","summary":"x","authority":true}]'), []);
});

test("model quotes must resolve uniquely against the committed role text", async () => {
  const provider = {
    async generate() {
      return {
        output: JSON.stringify([
          {
            kind: "COMMITMENT",
            role: "user",
            quote: "I promised Grandad I'd sort his model tomorrow.",
            summary: "Sort Grandad's model tomorrow"
          },
          {
            kind: "PURCHASED",
            role: "user",
            quote: "I already bought milk.",
            summary: "Milk was bought"
          },
          {
            kind: "DONE",
            role: "user",
            quote: "this quote was never said",
            summary: "Hallucinated completion"
          }
        ])
      };
    }
  };
  const proposals = await proposeConversationCandidates({
    turn,
    modelProvider: provider,
    model: "fake"
  });
  assert.equal(proposals.length, 2);
  assert.deepEqual(proposals.map((item) => item.kind), ["COMMITMENT", "PURCHASED"]);
});

test("provider failure degrades to no proposals, never invented state", async () => {
  const proposals = await proposeConversationCandidates({
    turn,
    modelProvider: {
      async generate() {
        throw new Error("provider offline");
      }
    },
    model: "fake"
  });
  assert.deepEqual(proposals, []);
});

test("shadow worker can discover candidates but cannot grant action or memory authority", async () => {
  const result = await runConversationShadow({
    turn,
    proposer: async (input) => proposeConversationCandidates({
      turn: input,
      model: "fake",
      modelProvider: {
        async generate() {
          return {
            output: JSON.stringify([
              {
                kind: "COMMITMENT",
                role: "user",
                quote: "I promised Grandad I'd sort his model tomorrow.",
                summary: "Sort Grandad's model tomorrow"
              },
              {
                kind: "DONE",
                role: "assistant",
                quote: "you already bought milk.",
                summary: "Assistant says milk was already bought"
              }
            ])
          };
        }
      }
    })
  });

  assert.equal(result.mode, "shadow");
  assert.equal(result.actionAuthority, false);
  assert.equal(result.memoryPromotion, "forbidden");
  assert.equal(result.candidateCount, 2);
  assert.equal(result.candidates[0].lifeStateAdmission, "candidate-only");
  assert.equal(result.candidates[1].lifeStateAdmission, "hypothesis-only");
  assert.equal(result.candidates[1].epistemicClass, "model-hypothesis");
});

