"use strict";

const { randomUUID } = require("crypto");

const store = globalThis.__BAYBANK_ADMIN_STORE__ || {
  escalations: [],
};

globalThis.__BAYBANK_ADMIN_STORE__ = store;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function plusMinutes(isoDate, minutes) {
  return new Date(new Date(isoDate).getTime() + minutes * 60000).toISOString();
}

function buildCrmLogs(record, agentName) {
  const reviewedAt = new Date().toISOString();
  const displayAgent = agentName || "Agent conformité BayBank";
  const customerName =
    [
      record.client && record.client.firstName,
      record.client && record.client.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || "Titulaire principal";
  const accountId = (record.account && record.account.accountId) || "Compte BayBank";

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
        detail: "Le dossier est renvoyé dans le flux de suivi client BayBank.",
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
    return new Date(b.updatedAt || b.submittedAt).getTime() - new Date(a.updatedAt || a.submittedAt).getTime();
  });
}

function matchesEscalationRef(item, ref) {
  if (!item || !ref) return false;
  const normalizedRef =
    typeof ref === "string" ? { escalationId: ref } : ref;

  return Boolean(
    (normalizedRef.escalationId && item.escalationId === normalizedRef.escalationId) ||
      (normalizedRef.submissionId && item.submissionId === normalizedRef.submissionId) ||
      (normalizedRef.sessionId && item.sessionId === normalizedRef.sessionId),
  );
}

function listEscalations() {
  return clone(sortEscalations(store.escalations.slice()));
}

function upsertEscalation(input) {
  const next = normalizeEscalation(input);
  const index = store.escalations.findIndex(function(item) {
    return (
      (next.escalationId && item.escalationId === next.escalationId) ||
      (next.submissionId && item.submissionId === next.submissionId) ||
      (next.sessionId && item.sessionId === next.sessionId)
    );
  });

  if (index >= 0) {
    const current = store.escalations[index];
    store.escalations[index] = Object.assign({}, current, next, {
      escalationId: current.escalationId,
      activity: Array.isArray(current.activity) && current.activity.length ? current.activity : next.activity,
      crmLogs: current.crmLogs || next.crmLogs || null,
      status: current.status || next.status,
      reviewedAt: current.reviewedAt || next.reviewedAt || null,
      reviewedBy: current.reviewedBy || next.reviewedBy || null,
      decisionNote: current.decisionNote || next.decisionNote || "",
      updatedAt: new Date().toISOString(),
    });
    return clone(store.escalations[index]);
  }

  store.escalations.push(next);
  return clone(next);
}

function getEscalation(escalationId) {
  const record = store.escalations.find(function(item) {
    return matchesEscalationRef(item, escalationId);
  });
  return record ? clone(record) : null;
}

function decideEscalation(escalationRef, action, agentName) {
  const index = store.escalations.findIndex(function(item) {
    return matchesEscalationRef(item, escalationRef);
  });

  if (index === -1) return null;

  const record = store.escalations[index];
  const reviewedAt = new Date().toISOString();
  const reviewer = agentName || "Agent conformité BayBank";

  if (action === "approve") {
    const crmLogs = buildCrmLogs(record, reviewer);
    record.status = "approved";
    record.reviewedAt = crmLogs.reviewedAt;
    record.reviewedBy = reviewer;
    record.updatedAt = crmLogs.reviewedAt;
    record.decisionNote = "Le dossier a été validé par l'agent.";
    record.crmLogs = crmLogs;
    record.activity = record.activity.concat([
      {
        system: "Decision",
        label: "Validation agent",
        detail: reviewer + " a validé le dossier et relancé les opérations CRM.",
        timestamp: crmLogs.reviewedAt,
      },
    ]);
  } else if (action === "reject") {
    record.status = "rejected";
    record.reviewedAt = reviewedAt;
    record.reviewedBy = reviewer;
    record.updatedAt = reviewedAt;
    record.decisionNote = "Le dossier a été refusé après revue humaine.";
    record.crmLogs = null;
    record.activity = record.activity.concat([
      {
        system: "Decision",
        label: "Refus agent",
        detail: reviewer + " a refusé le dossier après contrôle humain.",
        timestamp: reviewedAt,
      },
    ]);
  } else {
    return null;
  }

  return clone(record);
}

function deleteEscalation(escalationRef) {
  const index = store.escalations.findIndex(function(item) {
    return matchesEscalationRef(item, escalationRef);
  });

  if (index === -1) return null;

  const removed = store.escalations.splice(index, 1)[0];
  return clone(removed);
}

module.exports = {
  listEscalations,
  getEscalation,
  upsertEscalation,
  decideEscalation,
  deleteEscalation,
};
