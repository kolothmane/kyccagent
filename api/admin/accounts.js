"use strict";

const {
  listAccounts,
  resetAccountPassword,
  updateAccount,
} = require("../../lib/account-store");

module.exports = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "GET") {
      return res.status(200).json({
        items: await listAccounts(),
      });
    }

    if (req.method === "POST") {
      const { accountId, email, action, password, financials } = req.body || {};

      if (!["reset_password", "update_financials"].includes(action)) {
        return res.status(400).json({ error: "action must be 'reset_password' or 'update_financials'" });
      }

      if (!accountId && !email) {
        return res.status(400).json({ error: "accountId or email is required" });
      }

      const account =
        action === "reset_password"
          ? await resetAccountPassword({ accountId, email }, password)
          : await updateAccount({ accountId, email }, { financials });

      if (!account) {
        return res.status(404).json({ error: "Compte introuvable" });
      }

      return res.status(200).json({
        success: true,
        account,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error && error.code === "PASSWORD_TOO_SHORT") {
      return res.status(400).json({ error: error.message });
    }

    console.error("Admin accounts error:", error);
    return res.status(500).json({ error: "Gestion des comptes indisponible" });
  }
};
