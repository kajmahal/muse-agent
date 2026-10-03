import {
  observeCommittedConversationTurn
} from "./kaj-conversation-observer.mjs";

export async function runConversationShadow({
  turn,
  proposer
}) {
  if (typeof proposer !== "function") {
    throw new TypeError("proposer must be a function");
  }
  let proposals;
  try {
    proposals = await proposer(turn);
  } catch {
    proposals = [];
  }
  const observed = observeCommittedConversationTurn(turn, proposals);
  return Object.freeze({
    schemaVersion: "kaj.conversation-shadow/v1",
    actionAuthority: false,
    memoryPromotion: "forbidden",
    mode: "shadow",
    source: observed.source,
    candidates: observed.candidates,
    candidateCount: observed.candidates.length
  });
}

