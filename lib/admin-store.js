"use strict";

const { randomUUID } = require("crypto");
const { Redis } = require("@upstash/redis");

const memoryStore = globalThis.__BAYBANK_ADMIN_STORE__ || {
  escalations: [],
};

globalThis.__BAYBANK_ADMIN_STORE__ = memoryStore;

const ESCALATION_INDEX_KEY = "baybank:admin:escalations:index";
const ITEM_KEY_PREFIX = "baybank:admin:escalations:item:";
const REF_KEY_PREFIX = "baybank:admin:escalations:ref:";

let redisClient = undefined;

function getRedisUrl() {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
}

function getRedisToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function plusMinutes(isoDate, minutes) {
  return new Date(new Date(isoDate).getTime() + minutes * 60000).toISOString();
}

function buildCrmLogs(record, agentName) {
  const reviewedAt = new Date().toISOString();
  const displayAgent = agentName || "Agent conformité Bay4Bank";
  const customerName =
    [
      record.client && record.client.firstName,
      record.client && record.client.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || "Titulaire principal";
  const accountId = (record.account && record.account.accountId) || "Compte Bay4Bank";

  return {
    reviewedAt,
    items: [
      {
        system: "Compliance",
        label: "Revue humaine clôturée",
        detail: displayAgent + " a validé le dossier après contrôle documentaire.",
        timestamp: reviewedAt,
      },
      {
        system: "CRM",
        label: "Fiche client mise à jour",
        detail:
          customerName + " a été confirmé sur le dossier " + accountId + " avec décision positive.",
        timestamp: plusMinutes(reviewedAt, 1),
      },
      {
        system: "Lifecycle",
        label: "Compte activé",
        detail: "Le cycle de vie du compte a été basculé en client actif.",
        timestamp: plusMinutes(reviewedAt, 2),
      },
      {
        system: "Relationship",
        label: "Suivi relationnel relancé",
        detail: "Le dossier est renvoyé dans le flux de suivi client Bay4Bank.",
        timestamp: plusMinutes(reviewedAt, 3),
      },
    ],
  };
}

function buildActivity(record) {
  return [
    {
      system: "Escalade",
      label: "Dossier escaladé",
      detail:
        (record.humanReview && record.humanReview.message) ||
        "Le dossier a été dirigé vers une revue humaine.",
      timestamp: record.submittedAt,
    },
  ];
}

function normalizeEscalation(input) {
  const now = new Date().toISOString();

  return {
    escalationId: input.escalationId || "esc_" + randomUUID().split("-")[0],
    sessionId: input.sessionId,
    submissionId: input.submissionId || "sub_" + randomUUID().split("-")[0],
    submittedAt: input.submittedAt || now,
    updatedAt: input.updatedAt || now,
    status: input.status || "pending",
    reviewedAt: input.reviewedAt || null,
    reviewedBy: input.reviewedBy || null,
    decisionNote: input.decisionNote || "",
    humanReview: input.humanReview || {},
    reconciliation: input.reconciliation || {},
    client: input.client || {},
    account: input.account || {},
    documents: Array.isArray(input.documents) ? input.documents : [],
    activity: Array.isArray(input.activity) ? input.activity : buildActivity(input),
    crmLogs: input.crmLogs || null,
  };
}

function sortEscalations(items) {
  const weight = {
    pending: 0,
    approved: 1,
    rejected: 2,
  };

  return items.sort(function(a, b) {
    const weightA = weight[a.status] ?? 9;
    const weightB = weight[b.status] ?? 9;
    if (weightA !== weightB) return weightA - weightB;
    return (
      new Date(b.updatedAt || b.submittedAt).getTime() -
      new Date(a.updatedAt || a.submittedAt).getTime()
    );
  });
}

function matchesEscalationRef(item, ref) {
  if (!item || !ref) return false;
  const normalizedRef = typeof ref === "string" ? { escalationId: ref } : ref;

  return Boolean(
    (normalizedRef.escalationId && item.escalationId === normalizedRef.escalationId) ||
      (normalizedRef.submissionId && item.submissionId === normalizedRef.submissionId) ||
      (normalizedRef.sessionId && item.sessionId === normalizedRef.sessionId),
  );
}

function mergeEscalationRecord(current, next) {
  if (!current) return next;

  return Object.assign({}, current, next, {
    escalationId: current.escalationId,
    activity:
      Array.isArray(current.activity) && current.activity.length
        ? current.activity
        : next.activity,
    crmLogs: current.crmLogs || next.crmLogs || null,
    status: current.status || next.status,
    reviewedAt: current.reviewedAt || next.reviewedAt || null,
    reviewedBy: current.reviewedBy || next.reviewedBy || null,
    decisionNote: current.decisionNote || next.decisionNote || "",
    updatedAt: new Date().toISOString(),
  });
}

function applyDecisionToRecord(record, action, agentName) {
  const next = clone(record);
  const reviewedAt = new Date().toISOString();
  const reviewer = agentName || "Agent conformité Bay4Bank";

  if (action === "approve") {
    const crmLogs = buildCrmLogs(next, reviewer);
    next.status = "approved";
    next.reviewedAt = crmLogs.reviewedAt;
    next.reviewedBy = reviewer;
    next.updatedAt = crmLogs.reviewedAt;
    next.decisionNote = "Le dossier a été validé par l'agent.";
    next.crmLogs = crmLogs;
    next.activity = next.activity.concat([
      {
        system: "Decision",
        label: "Validation agent",
        detail: reviewer + " a validé le dossier et relancé les opérations CRM.",
        timestamp: crmLogs.reviewedAt,
      },
    ]);
    return next;
  }

  if (action === "reject") {
    next.status = "rejected";
    next.reviewedAt = reviewedAt;
    next.reviewedBy = reviewer;
    next.updatedAt = reviewedAt;
    next.decisionNote = "Le dossier a été refusé après revue humaine.";
    next.crmLogs = null;
    next.activity = next.activity.concat([
      {
        system: "Decision",
        label: "Refus agent",
        detail: reviewer + " a refusé le dossier après contrôle humain.",
        timestamp: reviewedAt,
      },
    ]);
    return next;
  }

  return null;
}

function hasRedisConfig() {
  return Boolean(
    getRedisUrl() &&
      getRedisToken(),
  );
}

function getRedisClient() {
  if (redisClient !== undefined) return redisClient;

  if (!hasRedisConfig()) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({
    url: getRedisUrl(),
    token: getRedisToken(),
  });

  return redisClient;
}

function itemKey(escalationId) {
  return ITEM_KEY_PREFIX + escalationId;
}

function refKey(type, value) {
  return REF_KEY_PREFIX + type + ":" + value;
}

function parseStoredEscalation(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  return raw;
}

async function resolveEscalationId(redis, ref) {
  if (!ref) return null;

  if (ref.escalationId) {
    const existing = await redis.get(itemKey(ref.escalationId));
    if (existing) return ref.escalationId;
  }

  if (ref.submissionId) {
    const fromSubmission = await redis.get(refKey("submission", ref.submissionId));
    if (fromSubmission) return String(fromSubmission);
  }

  if (ref.sessionId) {
    const fromSession = await redis.get(refKey("session", ref.sessionId));
    if (fromSession) return String(fromSession);
  }

  return null;
}

async function persistRedisRecord(redis, record) {
  const score = new Date(record.updatedAt || record.submittedAt).getTime();
  const writes = [
    redis.set(itemKey(record.escalationId), JSON.stringify(record)),
    redis.zadd(ESCALATION_INDEX_KEY, { score, member: record.escalationId }),
    redis.set(refKey("escalation", record.escalationId), record.escalationId),
  ];

  if (record.submissionId) {
    writes.push(redis.set(refKey("submission", record.submissionId), record.escalationId));
  }
  if (record.sessionId) {
    writes.push(redis.set(refKey("session", record.sessionId), record.escalationId));
  }

  await Promise.all(writes);
}

async function removeRedisRecord(redis, record) {
  const deletes = [
    redis.del(itemKey(record.escalationId)),
    redis.del(refKey("escalation", record.escalationId)),
    redis.zrem(ESCALATION_INDEX_KEY, record.escalationId),
  ];

  if (record.submissionId) {
    deletes.push(redis.del(refKey("submission", record.submissionId)));
  }
  if (record.sessionId) {
    deletes.push(redis.del(refKey("session", record.sessionId)));
  }

  await Promise.all(deletes);
}

function listMemoryEscalations() {
  return clone(sortEscalations(memoryStore.escalations.slice()));
}

function upsertMemoryEscalation(input) {
  const next = normalizeEscalation(input);
  const index = memoryStore.escalations.findIndex(function(item) {
    return (
      (next.escalationId && item.escalationId === next.escalationId) ||
      (next.submissionId && item.submissionId === next.submissionId) ||
      (next.sessionId && item.sessionId === next.sessionId)
    );
  });

  if (index >= 0) {
    memoryStore.escalations[index] = mergeEscalationRecord(
      memoryStore.escalations[index],
      next,
    );
    return clone(memoryStore.escalations[index]);
  }

  memoryStore.escalations.push(next);
  return clone(next);
}

function getMemoryEscalation(escalationRef) {
  const record = memoryStore.escalations.find(function(item) {
    return matchesEscalationRef(item, escalationRef);
  });
  return record ? clone(record) : null;
}

function decideMemoryEscalation(escalationRef, action, agentName) {
  const index = memoryStore.escalations.findIndex(function(item) {
    return matchesEscalationRef(item, escalationRef);
  });

  if (index === -1) return null;

  const updated = applyDecisionToRecord(memoryStore.escalations[index], action, agentName);
  if (!updated) return null;
  memoryStore.escalations[index] = updated;
  return clone(updated);
}

function deleteMemoryEscalation(escalationRef) {
  const index = memoryStore.escalations.findIndex(function(item) {
    return matchesEscalationRef(item, escalationRef);
  });

  if (index === -1) return null;

  const removed = memoryStore.escalations.splice(index, 1)[0];
  return clone(removed);
}

async function listEscalations() {
  const redis = getRedisClient();
  if (!redis) return listMemoryEscalations();

  const escalationIds = await redis.zrange(ESCALATION_INDEX_KEY, 0, -1, { rev: true });
  if (!Array.isArray(escalationIds) || !escalationIds.length) return [];

  const records = await Promise.all(
    escalationIds.map(async function(escalationId) {
      const raw = await redis.get(itemKey(escalationId));
      return parseStoredEscalation(raw);
    }),
  );

  return clone(sortEscalations(records.filter(Boolean)));
}

async function upsertEscalation(input) {
  const redis = getRedisClient();
  if (!redis) return upsertMemoryEscalation(input);

  const next = normalizeEscalation(input);
  const resolvedId = await resolveEscalationId(redis, next);
  let current = null;

  if (resolvedId) {
    next.escalationId = resolvedId;
    current = parseStoredEscalation(await redis.get(itemKey(resolvedId)));
  }

  const record = mergeEscalationRecord(current, next);
  await persistRedisRecord(redis, record);
  return clone(record);
}

async function getEscalation(escalationRef) {
  const redis = getRedisClient();
  if (!redis) return getMemoryEscalation(escalationRef);

  const escalationId = await resolveEscalationId(redis, escalationRef);
  if (!escalationId) return null;

  const raw = await redis.get(itemKey(escalationId));
  const record = parseStoredEscalation(raw);
  return record ? clone(record) : null;
}

async function decideEscalation(escalationRef, action, agentName) {
  const redis = getRedisClient();
  if (!redis) return decideMemoryEscalation(escalationRef, action, agentName);

  const current = await getEscalation(escalationRef);
  if (!current) return null;

  const updated = applyDecisionToRecord(current, action, agentName);
  if (!updated) return null;

  await persistRedisRecord(redis, updated);
  return clone(updated);
}

async function deleteEscalation(escalationRef) {
  const redis = getRedisClient();
  if (!redis) return deleteMemoryEscalation(escalationRef);

  const current = await getEscalation(escalationRef);
  if (!current) return null;

  await removeRedisRecord(redis, current);
  return clone(current);
}

module.exports = {
  listEscalations,
  getEscalation,
  upsertEscalation,
  decideEscalation,
  deleteEscalation,
};
