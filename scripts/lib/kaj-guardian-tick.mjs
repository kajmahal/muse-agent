import {
  openAttuneGraph
} from "../../packages/attunegraph/dist/index.js";
import {
  createInMemoryAttuneGraphStore
} from "../../packages/attunegraph/dist/testing.js";
import {
  defineAttuneGraphSourceAdapter,
  projectAttuneGraphSource
} from "../../packages/attunegraph/dist/source-adapter.js";

const TIMING_DECISIONS = new Set(["silent", "digest", "offer"]);
const FRESHNESS_STATES = new Set(["fresh", "stale", "unknown"]);
const OPEN_LOOP_EPISTEMIC_CLASSES = new Set([
  "user-asserted",
  "source-observed",
  "deterministic-derived"
]);

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new TypeError(`${label} must be non-empty trimmed text`);
  }
  return value;
}

function requireInstant(value, label) {
  requireText(value, label);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical ISO instant`);
  }
  return value;
}

function sourceRef(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const namespace = requireText(value.namespace, `${label}.namespace`);
  const id = requireText(value.id, `${label}.id`);
  const version = requireText(value.version, `${label}.version`);
  return Object.freeze({ namespace, id, version });
}

function derivation(epistemicClass, version, runId) {
  if (epistemicClass === "model-hypothesis") {
    return {
      kind: "model",
      runId: requireText(runId, "modelClaim.runId"),
      version
    };
  }
  return { kind: "projection", version };
}

function assertionId(prefix, threadId, itemId) {
  return `assertion:kaj:${prefix}:${threadId}:${itemId}`;
}

function artifactId(prefix, threadId, itemId) {
  return `artifact:kaj:${prefix}:${threadId}:${itemId}`;
}

function normalizeInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("guardian tick input must be an object");
  }
  const threadId = requireText(input.threadId, "threadId");
  const observedAt = requireInstant(input.observedAt, "observedAt");
  if (!FRESHNESS_STATES.has(input.freshness)) {
    throw new TypeError("freshness must be fresh, stale, or unknown");
  }
  if (!TIMING_DECISIONS.has(input.timingDecision)) {
    throw new TypeError("timingDecision must be silent, digest, or offer");
  }

  let openLoop = null;
  if (input.openLoop != null) {
    const candidate = input.openLoop;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new TypeError("openLoop must be an object or null");
    }
    if (!OPEN_LOOP_EPISTEMIC_CLASSES.has(candidate.epistemicClass)) {
      throw new TypeError("openLoop epistemicClass cannot be model-hypothesis");
    }
    openLoop = Object.freeze({
      id: requireText(candidate.id, "openLoop.id"),
      assertedAt: requireInstant(candidate.assertedAt, "openLoop.assertedAt"),
      epistemicClass: candidate.epistemicClass,
      sourceRef: sourceRef(candidate.sourceRef, "openLoop.sourceRef")
    });
  }

  let resolution = null;
  if (input.resolution != null) {
    const candidate = input.resolution;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new TypeError("resolution must be an object or null");
    }
    if (candidate.epistemicClass !== "source-observed" && candidate.epistemicClass !== "deterministic-derived") {
      throw new TypeError("resolution requires source-observed or deterministic-derived evidence");
    }
    resolution = Object.freeze({
      id: requireText(candidate.id, "resolution.id"),
      observedAt: requireInstant(candidate.observedAt, "resolution.observedAt"),
      epistemicClass: candidate.epistemicClass,
      sourceRef: sourceRef(candidate.sourceRef, "resolution.sourceRef")
    });
    if (!openLoop) throw new TypeError("resolution requires an openLoop to resolve");
  }

  const modelClaims = Object.freeze((input.modelClaims ?? []).map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new TypeError(`modelClaims[${index}] must be an object`);
    }
    return Object.freeze({
      id: requireText(candidate.id, `modelClaims[${index}].id`),
      observedAt: requireInstant(candidate.observedAt, `modelClaims[${index}].observedAt`),
      runId: requireText(candidate.runId, `modelClaims[${index}].runId`),
      sourceRef: sourceRef(candidate.sourceRef, `modelClaims[${index}].sourceRef`)
    });
  }));

  return Object.freeze({
    freshness: input.freshness,
    modelClaims,
    observedAt,
    openLoop,
    resolution,
    threadId,
    timingDecision: input.timingDecision
  });
}

function assertionsFor(input, context) {
  const assertions = [];
  const openLoop = input.openLoop;
  if (!openLoop) return assertions;

  const loopArtifact = {
    id: artifactId("open-loop", input.threadId, openLoop.id),
    kind: "artifact"
  };
  const isResolved = input.resolution !== null;
  assertions.push({
    schemaVersion: 1,
    id: assertionId("open-loop", input.threadId, openLoop.id),
    subject: loopArtifact,
    predicate: "CONTEXT_FOR",
    object: context.threadRoot,
    epistemicClass: openLoop.epistemicClass,
    sourceRefs: [openLoop.sourceRef],
    recordedAt: openLoop.assertedAt,
    validFrom: openLoop.assertedAt,
    ...(isResolved ? { supersededAt: input.resolution.observedAt } : {}),
    derivation: derivation(openLoop.epistemicClass, "kaj-guardian-open-loop@1")
  });

  if (!isResolved) {
    for (const claim of input.modelClaims) {
      assertions.push({
        schemaVersion: 1,
        id: assertionId("model-claim", input.threadId, claim.id),
        subject: {
          id: artifactId("model-claim", input.threadId, claim.id),
          kind: "artifact"
        },
        predicate: "CORRELATES_WITH",
        object: loopArtifact,
        epistemicClass: "model-hypothesis",
        sourceRefs: [claim.sourceRef],
        recordedAt: claim.observedAt,
        validFrom: claim.observedAt,
        derivation: derivation(
          "model-hypothesis",
          "kaj-guardian-model-claim@1",
          claim.runId
        )
      });
    }
  }

  if (input.resolution) {
    const resolved = input.resolution;
    const resolutionArtifact = {
      id: artifactId("resolution", input.threadId, resolved.id),
      kind: "artifact"
    };
    const derivationValue = derivation(
      resolved.epistemicClass,
      "kaj-guardian-resolution@1"
    );
    assertions.push(
      {
        schemaVersion: 1,
        id: assertionId("resolution-context", input.threadId, resolved.id),
        subject: resolutionArtifact,
        predicate: "CONTEXT_FOR",
        object: context.threadRoot,
        epistemicClass: resolved.epistemicClass,
        sourceRefs: [resolved.sourceRef],
        recordedAt: resolved.observedAt,
        validFrom: resolved.observedAt,
        derivation: derivationValue
      },
      {
        schemaVersion: 1,
        id: assertionId("resolution-supersedes", input.threadId, resolved.id),
        subject: resolutionArtifact,
        predicate: "SUPERSEDES",
        object: loopArtifact,
        epistemicClass: resolved.epistemicClass,
        sourceRefs: [resolved.sourceRef],
        recordedAt: resolved.observedAt,
        validFrom: resolved.observedAt,
        derivation: derivationValue
      }
    );
  }

  return assertions;
}

const adapter = defineAttuneGraphSourceAdapter({
  capabilities: {
    maxAssertionsPerExtraction: 32,
    sourceKinds: ["kaj-life-state"],
    supportsIncremental: false
  },
  extract: (input, context) => ({ assertions: assertionsFor(input, context) }),
  metadata: {
    id: "kaj.guardian.life-state",
    label: "Kaj Guardian Life State",
    version: "0.1.0"
  }
});

function activeOpenLoopAssertionId(input) {
  if (!input.openLoop) return null;
  return assertionId("open-loop", input.threadId, input.openLoop.id);
}

function decide(input, evidence) {
  if (evidence.status !== "complete") {
    return Object.freeze({
      actionAuthority: false,
      decision: null,
      reason: evidence.status === "abstained"
        ? "evidence-abstained"
        : "evidence-partial",
      status: "held"
    });
  }

  const activeIds = new Set(
    evidence.workingGraph.assertions.map((assertion) => assertion.id)
  );
  const openId = activeOpenLoopAssertionId(input);
  if (!openId || !activeIds.has(openId)) {
    return Object.freeze({
      actionAuthority: false,
      decision: "silent",
      reason: openId ? "open-loop-no-longer-current" : "no-open-loop",
      status: "ready"
    });
  }

  return Object.freeze({
    actionAuthority: false,
    decision: input.timingDecision,
    reason: "current-open-loop",
    status: "ready"
  });
}

export async function runGuardianTick(rawInput) {
  const input = normalizeInput(rawInput);
  const scope = Object.freeze({
    sourceId: "kaj.guardian.life-state",
    threadId: input.threadId
  });
  const threadRoot = Object.freeze({
    id: `thread:kaj:${input.threadId}`,
    kind: "thread"
  });
  const graph = await openAttuneGraph({
    scope,
    store: createInMemoryAttuneGraphStore()
  });

  try {
    await projectAttuneGraphSource({
      adapter,
      attuneGraph: graph,
      correlationKey: `guardian-tick:${input.threadId}:${input.observedAt}`,
      input,
      observedAt: input.observedAt,
      scope,
      sourceFreshness: {
        state: input.freshness,
        observedAt: input.observedAt
      },
      sourceKind: "kaj-life-state",
      threadRoot
    });

    const evidence = await graph.query({
      operator: "decision-query@1",
      scope,
      seed: threadRoot,
      asOf: input.observedAt,
      head: { mode: "current" },
      freshness: { require: "fresh" },
      budget: { maxEstimatedTokens: 4000 }
    });
    const result = decide(input, evidence);
    return Object.freeze({
      ...result,
      evidence: Object.freeze({
        assertionIds: Object.freeze(
          evidence.workingGraph.assertions.map((assertion) => assertion.id)
        ),
        freshness: evidence.sourceFreshness.state,
        snapshotGeneration: evidence.snapshot.generation,
        status: evidence.status
      }),
      threadId: input.threadId
    });
  } finally {
    await graph.close();
  }
}

