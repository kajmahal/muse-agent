import {
  CONVERSATION_CANDIDATE_KINDS,
  exactProposalForQuote,
  normalizeCommittedConversationTurn
} from "./kaj-conversation-observer.mjs";

const KINDS = new Set(CONVERSATION_CANDIDATE_KINDS);
const ROLES = new Set(["user", "assistant"]);

const SYSTEM_PROMPT = `You are an extraction-only component for a personal guardian.

Read one committed ChatGPT turn. Identify ONLY concrete items that may affect current life state.

Allowed kinds:
- COMMITMENT: the speaker says they will/must do something.
- WAITING_ON: someone or something else is currently blocking/waited on.
- NEED: a current need or missing thing.
- DONE: something is explicitly stated as already completed.
- PURCHASED: something is explicitly stated as already bought/ordered/received.
- APPOINTMENT: a concrete appointment/booking/event that matters operationally.
- CORRECTION: an explicit correction/change of a prior fact, plan, need or commitment.

Return JSON only: one array of objects with exactly:
{"kind":"...","role":"user"|"assistant","quote":"EXACT verbatim substring","summary":"short neutral summary"}

Rules:
- quote MUST be copied verbatim from the named role text.
- Never infer a fact that is not stated.
- Prefer [] over a weak guess.
- Do not extract opinions, brainstorming, jokes, hypotheticals, generic preferences or broad ideas unless they create a concrete current obligation/need/change.
- User claims are evidence candidates. Assistant claims are only model hypotheses and cannot establish completion or authority.
- Do not decide memory, permission, urgency, notification, or action authority.
- Maximum 12 candidates.`;

function scanJsonArrays(text) {
  const out = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "[") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "[") depth += 1;
      else if (char === "]") {
        depth -= 1;
        if (depth === 0) {
          out.push(text.slice(start, index + 1));
          start = index;
          break;
        }
      }
    }
  }
  return out;
}

function normalizeModelEntry(value) {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) return null;
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== "kind,quote,role,summary") return null;
  if (!KINDS.has(value.kind) || !ROLES.has(value.role)) return null;
  if (
    typeof value.quote !== "string"
    || value.quote.length === 0
    || value.quote.length > 2_000
    || typeof value.summary !== "string"
    || value.summary.trim().length === 0
    || value.summary.length > 500
  ) return null;
  return {
    kind: value.kind,
    quote: value.quote,
    role: value.role,
    summary: value.summary.trim()
  };
}

export function parseConversationProposalOutput(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  for (const candidate of scanJsonArrays(raw)) {
    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    const normalized = parsed.map(normalizeModelEntry).filter(Boolean).slice(0, 12);
    if (parsed.length === 0 || normalized.length > 0) return normalized;
  }
  return [];
}

export async function proposeConversationCandidates({
  turn: rawTurn,
  modelProvider,
  model,
  maxOutputTokens = 700
}) {
  const turn = normalizeCommittedConversationTurn(rawTurn);
  if (!modelProvider || typeof modelProvider.generate !== "function") {
    throw new TypeError("modelProvider.generate is required");
  }
  if (typeof model !== "string" || model.trim().length === 0) {
    throw new TypeError("model is required");
  }

  let output;
  try {
    const result = await modelProvider.generate({
      maxOutputTokens,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Committed at: ${turn.committedAt}`,
            `Conversation: ${turn.conversationId}`,
            `Turn: ${turn.turnNumber}`,
            "",
            "USER TEXT:",
            turn.userMessage,
            "",
            "ASSISTANT TEXT:",
            turn.assistantMessage
          ].join("\n")
        }
      ],
      model,
      temperature: 0
    });
    output = result?.output ?? "";
  } catch {
    return Object.freeze([]);
  }

  const parsed = parseConversationProposalOutput(String(output));
  const proposals = [];
  for (const item of parsed) {
    const message = item.role === "user" ? turn.userMessage : turn.assistantMessage;
    try {
      proposals.push(exactProposalForQuote({
        kind: item.kind,
        message,
        quote: item.quote,
        role: item.role,
        summary: item.summary
      }));
    } catch {
      // A model quote that is absent or ambiguous is not evidence.
    }
  }
  return Object.freeze(proposals);
}

