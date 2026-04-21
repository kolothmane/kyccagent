/**
 * POST /api/kyc/upload
 * Accepts a base64-encoded document image, calls OpenAI for extraction,
 * runs deterministic validation, and returns structured results.
 *
 * Request body (JSON):
 * {
 *   sessionId: string,
 *   documentCategory: "identity" | "address" | "selfie",
 *   fileName: string,
 *   mimeType: string,
 *   data: string   // raw base64 (no "data:..." prefix)
 * }
 */
"use strict";

const {
  extractIdentityDocument,
  extractAddressDocument,
  extractSelfieDocument,
} = require("../../lib/extraction");
const {
  validateIdentityDocument,
  validateAddressDocument,
  validateUploadedFile,
} = require("../../lib/validation");

const ALLOWED_CATEGORIES = new Set(["identity", "address", "selfie"]);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId, documentCategory, fileName, mimeType, data } = req.body || {};

  // ─── Input validation ──────────────────────────────────────────────────────
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }
  if (!ALLOWED_CATEGORIES.has(documentCategory)) {
    return res
      .status(400)
      .json({ error: "documentCategory must be 'identity', 'address', or 'selfie'" });
  }
  if (!data || typeof data !== "string") {
    return res.status(400).json({ error: "File data (base64) is required" });
  }

  const fileCheck = validateUploadedFile({ mimeType, base64: data });
  if (!fileCheck.valid) {
    return res.status(400).json({ error: fileCheck.error });
  }

  // ─── Extraction ────────────────────────────────────────────────────────────
  let extraction;
  try {
    if (documentCategory === "identity") {
      extraction = await extractIdentityDocument(data, mimeType);
    } else if (documentCategory === "address") {
      extraction = await extractAddressDocument(data, mimeType);
    } else {
      extraction = await extractSelfieDocument(data, mimeType);
    }
  } catch (err) {
    // Do not leak internal error details to the client
    console.error("[upload] Extraction error:", err.message);
    return res.status(500).json({
      error: "Document extraction failed. Please retry with a clearer image.",
    });
  }

  // ─── Deterministic validation ──────────────────────────────────────────────
  let validation;
  if (documentCategory === "identity") {
    validation = validateIdentityDocument(extraction);
  } else if (documentCategory === "address") {
    validation = validateAddressDocument(extraction);
  } else {
    // Selfie: no strict validation rules — just pass through AI output
    validation = { passed: true, errors: [], warnings: extraction.warnings || [] };
  }

  return res.status(200).json({
    success: true,
    sessionId,
    documentCategory,
    fileName: fileName || "document",
    extraction,
    validation,
  });
};
