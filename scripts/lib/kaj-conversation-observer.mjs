import { createHash } from "node:crypto";

export const CONVERSATION_CANDIDATE_KINDS = Object.freeze([
  "COMMITMENT",
  "WAITING_ON",
  "NEED",
  "DONE",
  "PURCHASED",
  "APPOINTMENT",
  "CORRECTION"
]);

export const CONVERSATION_CANDIDATE_OPERATIONS = Object.freeze({
  APPOINTMENT: "open",
  COMMITMENT: "open",
  CORRECTION: "amend",
  DONE: "resolve",
  NEED: "open",
  PURCHASED: "resolve",
  WAITING_ON: "open"
});

const HASH_RE = /^[a-f0-9]{64}$/u;
const CONVERSATION_ID_RE = /^[A-Za-z0-9._-]{8,200}$/u;
const SOURCE_RE = /^[A-Za-z0-9._-]{1,64}$/u;
const ROLES = new Set(["user", "assistant"]);
const KINDS = new Set(CONVERSATION_CANDIDATE_KINDS);

function plainObject(value, label) {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return value;
}

function exactKeys(value, allowed, required, label) {
  const object = plainObject(value, label);
  const keys = Object.keys(object);
  if (keys.some((key) => !allowed.includes(key))) {
    throw new TypeError(`${label} contains unknown fields`);
  }
  if (required.some((key) => !keys.includes(key))) {
    throw new TypeError(`${label} is missing required fields`);
  }
  return object;
}

function requiredText(value, label, max = 10_000) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.trim() !== value
    || Array.from(value).length > max
  ) {
    throw new TypeError(`${label} must be non-empty trimmed text`);
  }
  return value;
}

function canonicalInstant(value, label) {
  const text = requiredText(value, label, 64);
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== text) {
    throw new TypeError(`${label} must be a canonical ISO instant`);
  }
  return text;
}

function boundedInteger(value, label, max) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new TypeError(`${label} must be a bounded non-negative integer`);
  }
  return value;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  ).join(",")}}`;
}

function digest(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function normalizeCommittedConversationTurn(value) {
  const turn = exactKeys(
    value,
    [
      "assistantMessage",
      "committedAt",
      "contentHash",
      "conversationId",
      "source",
      "turnNumber",
      "userMessage"
    ],
    [
      "assistantMessage",
      "committedAt",
      "contentHash",
      "conversationId",
      "source",
      "turnNumber",
      "userMessage"
    ],
    "conversation turn"
  );
  const conversationId = requiredText(turn.conversationId, "conversationId", 200);
  if (!CONVERSATION_ID_RE.test(conversationId)) {
    throw new TypeError("conversationId is not canonical");
  }
  const source = requiredText(turn.source, "source", 64);
  if (!SOURCE_RE.test(source)) {
    throw new TypeError("source is not canonical");
  }
  const contentHash = requiredText(turn.contentHash, "contentHash", 64);
  if (!HASH_RE.test(contentHash)) {
    throw new TypeError("contentHash must be sha256 hex");
  }
  const turnNumber = boundedInteger(turn.turnNumber, "turnNumber", 10_000_000);
  if (turnNumber < 1) throw new TypeError("turnNumber must be >= 1");
  const userMessage = requiredText(turn.userMessage, "userMessage", 50_000);
  const assistantMessage = requiredText(turn.assistantMessage, "assistantMessage", 50_000);

  return Object.freeze({
    assistantMessage,
    committedAt: canonicalInstant(turn.committedAt, "committedAt"),
    contentHash,
    conversationId,
    source,
    turnNumber,
    userMessage
  });
}

function textForRole(turn, role) {
  return role === "user" ? turn.userMessage : turn.assistantMessage;
}

function normalizeProposal(turn, value, index) {
  const proposal = exactKeys(
    value,
    ["end", "kind", "role", "start", "summary"],
    ["end", "kind", "role", "start", "summary"],
    `proposal[${index}]`
  );
  if (!KINDS.has(proposal.kind)) {
    throw new TypeError(`proposal[${index}].kind is unsupported`);
  }
  if (!ROLES.has(proposal.role)) {
    throw new TypeError(`proposal[${index}].role must be user or assistant`);
  }
  const text = textForRole(turn, proposal.role);
  const start = boundedInteger(proposal.start, `proposal[${index}].start`, text.length);
  const end = boundedInteger(proposal.end, `proposal[${index}].end`, text.length);
  if (end <= start) {
    throw new TypeError(`proposal[${index}] span must be non-empty`);
  }
  const quote = text.slice(start, end);
  if (quote.trim().length === 0) {
    throw new TypeError(`proposal[${index}] span must contain visible text`);
  }
  const summary = requiredText(proposal.summary, `proposal[${index}].summary`, 500);

  const operation = CONVERSATION_CANDIDATE_OPERATIONS[proposal.kind];
  const epistemicClass = proposal.role === "user"
    ? "user-asserted"
    : "model-hypothesis";
  const authority = proposal.role === "user"
    ? "candidate-only"
    : "hypothesis-only";

  const sourceRef = Object.freeze({
    namespace: "kaj.context.raw",
    id: `${turn.conversationId}#turn:${turn.turnNumber}:${proposal.role}:${start}-${end}`,
    version: turn.contentHash
  });

  const candidateCore = {
    committedAt: turn.committedAt,
    contentHash: turn.contentHash,
    conversationId: turn.conversationId,
    end,
    epistemicClass,
    kind: proposal.kind,
    operation,
    quote,
    role: proposal.role,
    source: turn.source,
    sourceRef,
    start,
    summary,
    turnNumber: turn.turnNumber
  };
  const candidateId = `kaj-conversation-candidate:${digest(candidateCore)}`;

  return Object.freeze({
    schemaVersion: "kaj.conversation-observer-candidate/v1",
    candidateId,
    ...candidateCore,
    lifeStateAdmission: authority,
    memoryPromotion: "forbidden"
  });
}

export function observeCommittedConversationTurn(rawTurn, rawProposals = []) {
  const turn = normalizeCommittedConversationTurn(rawTurn);
  if (!Array.isArray(rawProposals)) {
    throw new TypeError("proposals must be an array");
  }
  if (rawProposals.length > 32) {
    throw new TypeError("proposals exceeds the per-turn bound");
  }

  const candidates = rawProposals.map((proposal, index) =>
    normalizeProposal(turn, proposal, index)
  );
  const ids = new Set();
  for (const candidate of candidates) {
    if (ids.has(candidate.candidateId)) {
      throw new TypeError("duplicate conversation candidate");
    }
    ids.add(candidate.candidateId);
  }

  return Object.freeze({
    schemaVersion: "kaj.conversation-observer/v1",
    source: Object.freeze({
      committedAt: turn.committedAt,
      contentHash: turn.contentHash,
      conversationId: turn.conversationId,
      source: turn.source,
      turnNumber: turn.turnNumber
    }),
    candidates: Object.freeze(candidates)
  });
}

export function exactProposalForQuote({
  kind,
  message,
  quote,
  role = "user",
  summary
}) {
  requiredText(message, "message", 50_000);
  requiredText(quote, "quote", 10_000);
  const start = message.indexOf(quote);
  if (start < 0) throw new TypeError("quote does not occur in message");
  if (message.indexOf(quote, start + 1) >= 0) {
    throw new TypeError("quote is ambiguous in message; provide explicit offsets");
  }
  return Object.freeze({
    end: start + quote.length,
    kind,
    role,
    start,
    summary
  });
}

