"use strict";

const {
  listEscalations,
  decideEscalation,
  deleteEscalation,
} = require("../../lib/admin-store");

module.exports = async (req, res) => {
  if (req.method === "GET") {
    return res.status(200).json({
      items: listEscalations(),
    });
  }

  if (req.method === "POST") {
    const { escalationId, submissionId, sessionId, action, agentName } = req.body || {};
    const escalationRef = { escalationId, submissionId, sessionId };

    if (!escalationId && !submissionId && !sessionId) {
      return res.status(400).json({ error: "escalation reference is required" });
    }

    if (!["approve", "reject", "delete"].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve', 'reject' or 'delete'" });
    }

    if (action === "delete") {
      const removed = deleteEscalation(escalationRef);

      if (!removed) {
        return res.status(404).json({ error: "Escalated request not found" });
      }

      return res.status(200).json({
        success: true,
        deleted: true,
        item: removed,
      });
    }

    const updated = decideEscalation(escalationRef, action, agentName);

    if (!updated) {
      return res.status(404).json({ error: "Escalated request not found" });
    }

    return res.status(200).json({
      success: true,
      item: updated,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
