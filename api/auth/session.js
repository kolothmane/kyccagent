"use strict";

const { getAccountBySessionToken } = require("../../lib/account-store");

function readBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Session absente" });
    }

    const account = await getAccountBySessionToken(token);
    if (!account) {
      return res.status(401).json({ error: "Session invalide ou expirée" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      authenticated: true,
      account,
    });
  } catch (error) {
    console.error("Account session error:", error);
    return res.status(500).json({ error: "Lecture de session indisponible" });
  }
};
