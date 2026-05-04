"use strict";

const { toFile } = require("openai");
const { getClient } = require("../lib/openai-client");
const { getAccountBySessionToken } = require("../lib/account-store");

const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const MAX_AUDIO_BYTES = 7 * 1024 * 1024;
const SUPPORTED_LANGUAGES = new Set(["fr", "en", "ar", "es"]);

function readBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sanitizeMimeType(value) {
  const mimeType = cleanText(value).toLowerCase();

  if (mimeType.includes("mp4")) return "audio/mp4";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "audio/mpeg";
  if (mimeType.includes("ogg")) return "audio/ogg";
  if (mimeType.includes("wav")) return "audio/wav";
  return "audio/webm";
}

function extensionForMimeType(mimeType) {
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/ogg") return "ogg";
  if (mimeType === "audio/wav") return "wav";
  return "webm";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    res.setHeader("Cache-Control", "no-store");

    const token = readBearerToken(req);
    if (!token) return res.status(401).json({ error: "Session absente" });

    const account = await getAccountBySessionToken(token);
    if (!account) return res.status(401).json({ error: "Session invalide ou expirée" });
    if (account.kycStatus !== "approved") {
      return res.status(403).json({ error: "Compte non activé" });
    }

    const { audio, mimeType, language } = req.body || {};
    const base64Audio = cleanText(audio);
    if (!base64Audio) return res.status(400).json({ error: "audio is required" });

    const buffer = Buffer.from(base64Audio, "base64");
    if (!buffer.length) return res.status(400).json({ error: "audio is empty" });
    if (buffer.length > MAX_AUDIO_BYTES) {
      return res.status(413).json({ error: "Audio trop volumineux" });
    }

    const safeMimeType = sanitizeMimeType(mimeType);
    const file = await toFile(
      buffer,
      "bay4bank-voice." + extensionForMimeType(safeMimeType),
      { type: safeMimeType },
    );

    const client = getClient();
    const transcription = await client.audio.transcriptions.create({
      file,
      model: TRANSCRIPTION_MODEL,
      language: SUPPORTED_LANGUAGES.has(language) ? language : "fr",
    });

    return res.status(200).json({
      text: cleanText(transcription && transcription.text),
    });
  } catch (error) {
    console.error("[client-voice] error:", error.message || error);
    return res.status(500).json({
      error: "Transcription vocale indisponible",
    });
  }
};
