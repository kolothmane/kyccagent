"use strict";

const { randomUUID } = require("crypto");
const { reconcile } = require("../../lib/reconciliation");
const { upsertEscalation } = require("../../lib/admin-store");

function plusMinutes(isoDate, minutes) {
  return new Date(new Date(isoDate).getTime() + minutes * 60000).toISOString();
}

function buildHumanReview(reconciliation) {
  const suspiciousSignals = Array.isArray(reconciliation?.suspiciousSignals)
    ? reconciliation.suspiciousSignals
    : [];
  const missingFields = Array.isArray(reconciliation?.missingFields)
    ? reconciliation.missingFields
    : [];
  const required = reconciliation?.recommendedAction === "MANUAL_REVIEW";

  if (!required) {
    return {
      required: false,
      anomalyDetected: false,
      message: "",
      detail: "",
    };
  }

  const reasons = [];

  if (
    suspiciousSignals.some(function(signal) {
      return signal.includes("Address on identity document does not match proof-of-address document");
    })
  ) {
    reasons.push("écart d'adresse entre les documents");
  }

  if (
    suspiciousSignals.some(function(signal) {
      return signal.includes("Name mismatch");
    })
  ) {
    reasons.push("écart d'identité entre les documents");
  }

  if (
    suspiciousSignals.some(function(signal) {
      return signal.includes("Identity document is expired");
    })
  ) {
    reasons.push("contrôle de validité du document à reprendre");
  }

  if (!reasons.length && missingFields.length) {
    reasons.push("vérification complémentaire des informations extraites");
  }

  if (!reasons.length) {
    reasons.push("anomalie documentaire détectée");
  }

  return {
    required: true,
    anomalyDetected: suspiciousSignals.length > 0,
    reasons,
    message:
      "Une anomalie a été détectée (" +
      reasons.join(", ") +
      "). Le dossier a été remonté à un agent humain pour revue.",
    detail:
      "Reprise manuelle requise : " +
      reasons.join(", ") +
      ". Un agent humain poursuit maintenant l'analyse du dossier.",
  };
}

function pickLifecycle(status, humanReview) {
  return status === "approved"
    ? {
        statusLabel: "Compte actif",
        statusTone: "success",
        lifecycle: "Client actif",
        closingNote: "Dossier approuvé et compte prêt pour les opérations bancaires.",
      }
    : humanReview && humanReview.required
      ? {
          statusLabel: "Agent humain saisi",
          statusTone: "alert",
          lifecycle: "Revue humaine en cours",
          closingNote: humanReview.detail,
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
  humanReview,
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
  const lifecycle = pickLifecycle(status, humanReview);
  const suspiciousSignals = Array.isArray(reconciliation.suspiciousSignals)
    ? reconciliation.suspiciousSignals
    : [];

  const riskSummary =
    suspiciousSignals.length > 0
      ? suspiciousSignals.join(" | ")
      : "Aucun écart matériel détecté entre les documents reçus.";

  const events = [];
  let minuteOffset = 0;

  function pushEvent(event) {
    events.push(
      Object.assign({}, event, {
        timestamp: plusMinutes(submittedAt, minuteOffset),
      }),
    );
    minuteOffset += 1;
  }

  pushEvent({
    system: "Account",
    label: "Compte initialisé",
    detail: accountName + " a été créé avec le contact principal " + contactName + ".",
  });

  pushEvent({
    system: "Compliance",
    label: "Dossier KYC rattaché",
    detail: "La session " + sessionId + " a été reliée au compte " + accountId + ".",
  });

  pushEvent({
    system: "Risk",
    label: "Contrôle documentaire terminé",
    detail: riskSummary,
  });

  if (humanReview && humanReview.required) {
    pushEvent({
      system: "Human review",
      kind: "human-review",
      label: "Dossier remonté à un agent humain",
      detail: humanReview.detail,
    });
  } else {
    pushEvent({
      system: "Client",
      label: "Profil client enregistré",
      detail: contactName + " a été associé au dossier client " + customerId + ".",
    });
  }

  pushEvent({
    system: "Relationship",
    label: humanReview && humanReview.required ? "Agent assigné" : "Conseiller assigné",
    detail:
      (humanReview && humanReview.required
        ? "Un agent humain BayBank a été assigné pour reprendre la revue du dossier."
        : owner + " prend en charge le suivi du compte."),
  });

  pushEvent({
    system: "Lifecycle",
    label: "Cycle de vie mis à jour",
    detail: "Le compte " + accountName + " est désormais classé comme " + lifecycle.lifecycle + ".",
  });

  return {
    accountId,
    customerId,
    owner,
    statusLabel: lifecycle.statusLabel,
    statusTone: lifecycle.statusTone,
    lifecycle: lifecycle.lifecycle,
    events,
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
    documentFiles,
    documentAssets,
  } = req.body || {};

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const reconciliation = reconcile(identityExtraction || null, addressExtraction || null);
  const humanReview = buildHumanReview(reconciliation);

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
    humanReview,
  });

  let escalationRecord = null;

  if (humanReview.required) {
    escalationRecord = upsertEscalation({
      sessionId,
      submissionId,
      submittedAt,
      updatedAt: submittedAt,
      status: "pending",
      humanReview,
      reconciliation,
      account: {
        accountId: accountTimeline.accountId,
        customerId: accountTimeline.customerId,
        owner: accountTimeline.owner,
        accountName:
          (accountData && accountData.accountName) ||
          [
            profileData && profileData.firstName,
            profileData && profileData.lastName,
          ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          "Compte BayBank",
      },
      client: {
        firstName: profileData && profileData.firstName,
        lastName: profileData && profileData.lastName,
        email: profileData && profileData.email,
        phone: profileData && profileData.phone,
        country: profileData && profileData.country,
        dob: profileData && profileData.dob,
        street: profileData && profileData.street,
        city: profileData && profileData.city,
        state: profileData && profileData.state,
        postal: profileData && profileData.postal,
      },
      documents: [
        {
          category: "identity",
          label: "Pièce d'identité",
          fileName:
            (documentFiles && documentFiles.identity) || "Document d'identité",
          previewUrl:
            documentAssets &&
            documentAssets.identity &&
            documentAssets.identity.previewUrl,
          extraction: identityExtraction || {},
        },
        {
          category: "address",
          label: "Justificatif de domicile",
          fileName:
            (documentFiles && documentFiles.address) || "Justificatif de domicile",
          previewUrl:
            documentAssets &&
            documentAssets.address &&
            documentAssets.address.previewUrl,
          extraction: addressExtraction || {},
        },
      ],
    });
  }

  return res.status(200).json({
    success: true,
    submissionId,
    sessionId,
    submittedAt,
    status,
    reconciliation,
    humanReview,
    accountTimeline,
    escalationId: escalationRecord && escalationRecord.escalationId,
  });
};
