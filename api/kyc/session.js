/**
 * POST /api/kyc/session
 * Creates a new KYC session and returns a session ID.
 * The session ID is client-managed — no server-side state is stored.
 */
"use strict";

const { randomUUID } = require("crypto");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionId = randomUUID();
  return res.status(200).json({
    sessionId,
    createdAt: new Date().toISOString(),
  });
};
