/**
 * POST /api/kyc/submit
 * Finalises a KYC submission.
 * Runs cross-document reconciliation and returns a risk recommendation.
 *
 * Request body (JSON):
 * {
 *   sessionId: string,
 *   profileData: {
 *     firstName, lastName, email, phone, country,
 *     dob, street, city, state, postal
 *   },
 *   identityExtraction: object | null,
 *   addressExtraction:  object | null
 * }
 */
"use strict";

const { reconcile } = require("../../lib/reconciliation");
const { randomUUID } = require("crypto");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId, profileData, identityExtraction, addressExtraction } =
    req.body || {};

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }

  // Run reconciliation even when one document is missing (produces partial report)
  const reconciliation = reconcile(identityExtraction || null, addressExtraction || null);

  const submissionId = randomUUID();
  const submittedAt = new Date().toISOString();

  // Map risk to a human-readable status
  const statusMap = {
    AUTO_APPROVE: "approved",
    APPROVE_WITH_NOTE: "approved",
    MANUAL_REVIEW: "pending_review",
  };
  const status = statusMap[reconciliation.recommendedAction] || "pending_review";

  return res.status(200).json({
    success: true,
    submissionId,
    sessionId,
    submittedAt,
    status,
    reconciliation,
  });
};
