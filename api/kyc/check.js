/**
 * POST /api/kyc/check
 * Quick document validity check — runs before full extraction.
 * Makes a single OpenAI vision call that simultaneously:
 *   - Detects the document category (identity / address / selfie / unknown)
 *   - Assesses whether the document is acceptable for KYC
 *
 * The client should call this endpoint first and notify the user immediately
 * if the document is invalid, before proceeding to /api/kyc/upload.
 *
 * Request body (JSON):
 * {
 *   sessionId: string,
 *   fileName:  string,
 *   mimeType:  string,
 *   data:      string  // raw base64 (no "data:..." prefix)
 * }
 *
 * Response (JSON):
 * {
 *   valid:             boolean,
 *   detectedCategory:  "identity" | "address" | "selfie" | "unknown",
 *   issues:            string[],   // reasons document is unacceptable (empty if valid)
 *   warnings:          string[],   // quality concerns that don't block acceptance
 *   confidence:        number      // 0.0–1.0
 * }
 */
"use strict";

const { checkDocumentValidity } = require("../../lib/extraction");
const { validateUploadedFile }  = require("../../lib/validation");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId, fileName, mimeType, data } = req.body || {};

  // ─── Input validation ──────────────────────────────────────────────────────
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }
  if (!data || typeof data !== "string") {
    return res.status(400).json({ error: "File data (base64) is required" });
  }

  const fileCheck = validateUploadedFile({ mimeType, base64: data });
  if (!fileCheck.valid) {
    return res.status(400).json({ error: fileCheck.error });
  }

  // ─── Validity + category detection (single AI call) ───────────────────────
  try {
    const result = await checkDocumentValidity(data, mimeType);
    return res.status(200).json({
      valid:            result.valid,
      detectedCategory: result.documentCategory,
      issues:           result.issues,
      warnings:         result.warnings,
      confidence:       result.confidence,
      sessionId,
      fileName: fileName || "document",
    });
  } catch (err) {
    console.error("[check] Validity check error:", err.message);
    return res.status(500).json({
      error: "Document check failed. Please retry with a clearer image.",
    });
  }
};
