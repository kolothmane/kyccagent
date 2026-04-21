"use strict";

const { randomUUID } = require("crypto");
const { reconcile } = require("../../lib/reconciliation");

function plusMinutes(isoDate, minutes) {
  return new Date(new Date(isoDate).getTime() + minutes * 60000).toISOString();
}

function pickLifecycle(status) {
  return status === "approved"
    ? {
        statusLabel: "CRM synchronise",
        statusTone: "success",
        lifecycle: "Active customer",
        closingNote: "Compte active et transmis a l'equipe customer success.",
      }
    : {
        statusLabel: "CRM en attente",
        statusTone: "warning",
        lifecycle: "Pending compliance review",
        closingNote: "Compte cree mais garde en file de revue conformite.",
      };
}

function buildCrmSimulation({
  status,
  submittedAt,
  sessionId,
  profileData,
  accountData,
  reconciliation,
}) {
  const workspaceId =
    (accountData && accountData.workspaceId) || "ws_" + randomUUID().split("-")[0];
  const customerId =
    (accountData && accountData.customerId) || "crm_" + randomUUID().split("-")[0];
  const workspaceName =
    (accountData && accountData.workspaceName) ||
    profileData.companyName ||
    "Northstar Workspace";
  const owner =
    (accountData && accountData.owner) || "Compliance Pod";
  const contactName = [
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
        label: "Compte business initialise",
        detail:
          workspaceName +
          " a ete provisionne avec l'administrateur principal " +
          contactName +
          ".",
        timestamp: submittedAt,
      },
      {
        system: "Compliance",
        label: "Dossier KYC relie au compte",
        detail:
          "La session " +
          sessionId +
          " a ete associee au workspace " +
          workspaceId +
          ".",
        timestamp: plusMinutes(submittedAt, 1),
      },
      {
        system: "Risk",
        label: "Reconciliation documentaire finalisee",
        detail: riskSummary,
        timestamp: plusMinutes(submittedAt, 2),
      },
      {
        system: "CRM",
        label: "Contact CRM synchronise",
        detail:
          contactName +
          " a ete rattache au customer ID " +
          customerId +
          " avec le proprietaire " +
          owner +
          ".",
        timestamp: plusMinutes(submittedAt, 3),
      },
      {
        system: "Sales Ops",
        label: "Note interne generee",
        detail: lifecycle.closingNote,
        timestamp: plusMinutes(submittedAt, 4),
      },
      {
        system: "CRM",
        label: "Cycle de vie client mis a jour",
        detail:
          "Le statut CRM est passe a " +
          lifecycle.lifecycle +
          " pour le compte " +
          workspaceName +
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

  const crmSimulation = buildCrmSimulation({
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
    crmSimulation,
  });
};
