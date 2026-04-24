"use strict";

const { logoutSession } = require("../../lib/account-store");

function readBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(400).json({ error: "Session absente" });
    }

    await logoutSession(token);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Account logout error:", error);
    return res.status(500).json({ error: "Déconnexion indisponible" });
  }
};
