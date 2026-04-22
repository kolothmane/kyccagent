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
        lifecycle: "Client actif",
        closingNote: "Dossier approuvé et compte prêt pour les opérations bancaires.",
      }
    : {
        statusLabel: "Revue en cours",
        statusTone: "pending",
        lifecycle: "Revue conformité en cours",
        closingNote: "Dossier transmis à l'équipe conformité pour vérification complémentaire.",
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
  const accountId =
    (accountData && accountData.accountId) || "acct_" + randomUUID().split("-")[0];
  const customerId =
    (accountData && accountData.customerId) || "client_" + randomUUID().split("-")[0];
  const accountName =
    (accountData && accountData.accountName) ||
    [
      profileData.firstName || (accountData && accountData.firstName),
      profileData.lastName || (accountData && accountData.lastName),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Compte BayBank";
  const owner = (accountData && accountData.owner) || "Relationship Team";
  const contactName =
    [
      profileData.firstName || (accountData && accountData.firstName),
      profileData.lastName || (accountData && accountData.lastName),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || "Titulaire principal";
  const lifecycle = pickLifecycle(status);
  const suspiciousSignals = Array.isArray(reconciliation.suspiciousSignals)
    ? reconciliation.suspiciousSignals
    : [];

  const riskSummary =
    suspiciousSignals.length > 0
      ? suspiciousSignals.join(" | ")
      : "Aucun écart matériel détecté entre les documents reçus.";

  return {
    accountId,
    customerId,
    owner,
    statusLabel: lifecycle.statusLabel,
    statusTone: lifecycle.statusTone,
    lifecycle: lifecycle.lifecycle,
    events: [
      {
        system: "Account",
        label: "Compte initialisé",
        detail: accountName + " a été créé avec le contact principal " + contactName + ".",
        timestamp: submittedAt,
      },
      {
        system: "Compliance",
        label: "Dossier KYC rattaché",
        detail: "La session " + sessionId + " a été reliée au compte " + accountId + ".",
        timestamp: plusMinutes(submittedAt, 1),
      },
      {
        system: "Risk",
        label: "Contrôle documentaire terminé",
        detail: riskSummary,
        timestamp: plusMinutes(submittedAt, 2),
      },
      {
        system: "Client",
        label: "Profil client enregistré",
        detail: contactName + " a été associé au dossier client " + customerId + ".",
        timestamp: plusMinutes(submittedAt, 3),
      },
      {
        system: "Relationship",
        label: "Conseiller assigné",
        detail: owner + " prend en charge le suivi du compte.",
        timestamp: plusMinutes(submittedAt, 4),
      },
      {
        system: "Lifecycle",
        label: "Cycle de vie mis à jour",
        detail: "Le compte " + accountName + " est désormais classé comme " + lifecycle.lifecycle + ".",
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
  });
};
