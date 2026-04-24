"use strict";

const {
  listEscalations,
  decideEscalation,
  deleteEscalation,
} = require("../../lib/admin-store");
const { applyAccountReviewDecision } = require("../../lib/account-store");

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        items: await listEscalations(),
      });
    }

    if (req.method === "POST") {
      const { escalationId, submissionId, sessionId, action, agentName } = req.body || {};
      const escalationRef = { escalationId, submissionId, sessionId };

      if (!escalationId && !submissionId && !sessionId) {
        return res.status(400).json({ error: "escalation reference is required" });
      }

      if (!["approve", "reject", "delete"].includes(action)) {
        return res
          .status(400)
          .json({ error: "action must be 'approve', 'reject' or 'delete'" });
      }

      if (action === "delete") {
        const removed = await deleteEscalation(escalationRef);

        if (!removed) {
          return res.status(404).json({ error: "Escalated request not found" });
        }

        return res.status(200).json({
          success: true,
          deleted: true,
          item: removed,
        });
      }

      const updated = await decideEscalation(escalationRef, action, agentName);

      if (!updated) {
        return res.status(404).json({ error: "Escalated request not found" });
      }

      await applyAccountReviewDecision({
        accountId: updated.account && updated.account.accountId,
        contactEmail: updated.client && updated.client.email,
        kycStatus: action === "approve" ? "approved" : "rejected",
        humanReviewReason:
          action === "reject"
            ? updated.decisionNote ||
              (updated.humanReview && updated.humanReview.message) ||
              "Le dossier a été refusé après revue humaine."
            : "",
        decisionAt: updated.reviewedAt,
        decisionBy: updated.reviewedBy,
        crmLogs: action === "approve" ? updated.crmLogs : null,
        activity: updated.activity,
      });

      return res.status(200).json({
        success: true,
        item: updated,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Admin escalations storage error:", error);
    return res.status(500).json({ error: "Admin storage unavailable" });
  }
};
