"use strict";

const { registerAccount } = require("../../lib/account-store");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, phone, password, sessionId } = req.body || {};
    const result = await registerAccount({ email, phone, password, sessionId });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      account: result.account,
      sessionToken: result.session.token,
      sessionExpiresAt: result.session.expiresAt,
    });
  } catch (error) {
    if (error && error.code === "ACCOUNT_EXISTS") {
      return res.status(409).json({ error: error.message });
    }

    if (error && (error.code === "EMAIL_REQUIRED" || error.code === "PASSWORD_TOO_SHORT")) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Account registration error:", error);
    return res.status(500).json({ error: "Impossible de créer le compte" });
  }
};
