"use strict";

const { loginAccount } = require("../../lib/account-store");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};
    const result = await loginAccount({ email, password });

    if (!result) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      account: result.account,
      sessionToken: result.session.token,
      sessionExpiresAt: result.session.expiresAt,
    });
  } catch (error) {
    console.error("Account login error:", error);
    return res.status(500).json({ error: "Connexion indisponible" });
  }
};
