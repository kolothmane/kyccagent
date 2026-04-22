"use strict";

const { randomUUID } = require("crypto");
const { reconcile } = require("../../lib/reconciliation");

function plusMinutes(isoDate, minutes) {
  return new Date(new Date(isoDate).getTime() + minutes * 60000).toISOString();
}

function pickLifecycle(status) {
  return status === "approved"
    ? {
        statusLabel: "Compte actif",
        statusTone: "success",
        lifecycle: "Active customer",
        closingNote: "Dossier approuve et compte pret pour l'activation bancaire.",
      }
    : {
        statusLabel: "Revue en cours",
        statusTone: "warning",
        lifecycle: "Pending compliance review",
        closingNote: "Dossier transmis a l'equipe conformite pour verification complementaire.",
      };
}

function buildAccountTimeline({
  status,
  submittedAt,
  sessionId,
  profileData,
  accountData,
  reconciliation,
}) {
  const workspaceId =
    (accountData && accountData.workspaceId) || "org_" + randomUUID().split("-")[0];
  const customerId =
    (accountData && accountData.customerId) ||
    "client_" + randomUUID().split("-")[0];
  const workspaceName =
    (accountData && accountData.workspaceName) ||
    profileData.companyName ||
    "BayBank Workspace";
  const owner = (accountData && accountData.owner) || "Relationship Team";
  const contactName =
    [
      profileData.firstName || (accountData && accountData.firstName),
      profileData.lastName || (accountData && accountData.lastName),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || "Primary contact";
  const lifecycle = pickLifecycle(status);
  const suspiciousSignals = Array.isArray(reconciliation.suspiciousSignals)
    ? reconciliation.suspiciousSignals
    : [];

  const riskSummary =
    suspiciousSignals.length > 0
      ? suspiciousSignals.join(" | ")
      : "No material mismatch detected across uploaded documents.";

  return {
    workspaceId,
    customerId,
    owner,
    statusLabel: lifecycle.statusLabel,
    statusTone: lifecycle.statusTone,
    lifecycle: lifecycle.lifecycle,
    events: [
      {
        system: "Product",
        label: "Compte cree",
        detail:
          workspaceName +
          " a ete initialise avec le contact principal " +
          contactName +
          ".",
        timestamp: submittedAt,
      },
      {
        system: "Compliance",
        label: "Dossier KYC rattache",
        detail:
          "La session " +
          sessionId +
          " a ete reliee a l'organisation " +
          workspaceId +
          ".",
        timestamp: plusMinutes(submittedAt, 1),
      },
      {
        system: "Risk",
        label: "Controle documentaire termine",
        detail: riskSummary,
        timestamp: plusMinutes(submittedAt, 2),
      },
      {
        system: "Operations",
        label: "Profil client enregistre",
        detail:
          contactName +
          " a ete associe au dossier client " +
          customerId +
          ".",
        timestamp: plusMinutes(submittedAt, 3),
      },
      {
        system: "Relationship",
        label: "Responsable assigne",
        detail: owner + " prend le relais sur le suivi du compte.",
        timestamp: plusMinutes(submittedAt, 4),
      },
      {
        system: "Banking",
        label: "Cycle de vie mis a jour",
        detail:
          "Le compte " +
          workspaceName +
          " est maintenant classe comme " +
          lifecycle.lifecycle +
          ".",
        timestamp: plusMinutes(submittedAt, 5),
      },
    ],
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    sessionId,
    profileData,
    identityExtraction,
    addressExtraction,
    accountData,
  } = req.body || {};

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const reconciliation = reconcile(identityExtraction || null, addressExtraction || null);

  const submissionId = randomUUID();
  const submittedAt = new Date().toISOString();

  const statusMap = {
    AUTO_APPROVE: "approved",
    APPROVE_WITH_NOTE: "approved",
    MANUAL_REVIEW: "pending_review",
  };
  const status = statusMap[reconciliation.recommendedAction] || "pending_review";

  const accountTimeline = buildAccountTimeline({
    status,
    submittedAt,
    sessionId,
    profileData: profileData || {},
    accountData: accountData || {},
    reconciliation,
  });

  return res.status(200).json({
    success: true,
    submissionId,
    sessionId,
    submittedAt,
    status,
    reconciliation,
    accountTimeline,
    crmSimulation: accountTimeline,
  });
};
