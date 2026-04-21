/**
 * Document extraction service.
 * Uses OpenAI vision (gpt-4o) to extract structured fields from document images.
 * All calls happen server-side only.
 */
"use strict";

const { getClient } = require("./openai-client");

const MODEL = "gpt-4o";

// ─── System prompts ──────────────────────────────────────────────────────────

const IDENTITY_SYSTEM_PROMPT = `You are a precise KYC document analysis specialist.
Extract ALL visible text fields from the provided identity document image (passport, national ID, or driving licence).

Return ONLY a JSON object with these exact fields (use null when a field is not visible or not applicable):
{
  "documentType": "PASSPORT" | "NATIONAL_ID" | "DRIVING_LICENSE" | "UNKNOWN",
  "issuingCountry": string | null,
  "firstName": string | null,
  "middleNames": string | null,
  "lastName": string | null,
  "fullName": string | null,
  "documentNumber": string | null,
  "nationality": string | null,
  "dateOfBirth": "YYYY-MM-DD" | null,
  "dateOfIssue": "YYYY-MM-DD" | null,
  "dateOfExpiry": "YYYY-MM-DD" | null,
  "placeOfBirth": string | null,
  "address": string | null,
  "mrz": string | null,
  "warnings": string[],
  "confidence": number (0.0-1.0)
}

Rules:
- Normalise all dates to YYYY-MM-DD format.
- If a date is partially visible or ambiguous, include a warning and attempt your best parse.
- documentNumber must be alphanumeric only, max 32 chars.
- warnings should list any legibility issues, partial obscuring, glare, or missing fields.
- confidence reflects overall extraction quality (1.0 = all fields clear).
- Never invent data. Return null rather than a guess.
- Do not include extra keys beyond those listed above.`;

const ADDRESS_SYSTEM_PROMPT = `You are a precise KYC document analysis specialist.
Extract ALL visible text fields from the provided proof-of-address document (utility bill, bank statement, etc.).

Return ONLY a JSON object with these exact fields (use null when a field is not visible or not applicable):
{
  "documentType": "UTILITY_BILL" | "BANK_STATEMENT" | "COUNCIL_TAX" | "INSURANCE" | "OTHER",
  "providerName": string | null,
  "customerName": string | null,
  "serviceAddress": string | null,
  "billingDate": "YYYY-MM-DD" | null,
  "dueDate": "YYYY-MM-DD" | null,
  "accountNumber": string | null,
  "warnings": string[],
  "confidence": number (0.0-1.0)
}

Rules:
- Normalise all dates to YYYY-MM-DD format.
- serviceAddress must be the full postal address shown on the document.
- warnings should list any legibility issues, cut-off text, or missing address lines.
- confidence reflects overall extraction quality (1.0 = all fields clear).
- Never invent data. Return null rather than a guess.
- Do not include extra keys beyond those listed above.`;

const SELFIE_SYSTEM_PROMPT = `You are a KYC liveness / selfie document analyst.
Analyse the provided image and return metadata ONLY — never describe the person's identity.

Return ONLY a JSON object:
{
  "documentType": "SELFIE",
  "faceDetected": boolean,
  "imageQuality": "GOOD" | "ACCEPTABLE" | "POOR",
  "livenessIndicators": string[],
  "warnings": string[],
  "confidence": number (0.0-1.0)
}`;

const DETECT_CATEGORY_PROMPT = `You are a document classification specialist for a KYC (Know Your Customer) system.
Analyse the provided document image and determine its category.

Return ONLY a JSON object:
{
  "category": "identity" | "address" | "selfie" | "unknown",
  "confidence": number (0.0-1.0),
  "reason": string
}

Definitions:
- "identity": passport, national ID card, driving licence, or any government-issued photo ID
- "address": utility bill, bank statement, council tax letter, insurance letter, or any document showing a postal address
- "selfie": portrait photo or face image of a person
- "unknown": anything else that does not match the above categories

Rules:
- Look at the overall layout, logos, fields, and content to determine the category.
- Never invent a category. Use "unknown" when genuinely uncertain.
- confidence reflects how certain you are (1.0 = completely certain).`;

const VALIDITY_CHECK_PROMPT = `You are a document validity checker for a KYC (Know Your Customer) onboarding system.
Analyse the provided image and determine whether it is a valid, acceptable document for identity verification.

Return ONLY a JSON object:
{
  "valid": boolean,
  "documentCategory": "identity" | "address" | "selfie" | "unknown",
  "issues": string[],
  "warnings": string[],
  "confidence": number (0.0-1.0)
}

Definitions for documentCategory:
- "identity": passport, national ID card, driving licence, or any government-issued photo ID
- "address": utility bill, bank statement, council tax letter, insurance letter, or any document with a postal address
- "selfie": portrait photo or face image of a person
- "unknown": anything else

A document is INVALID (valid: false) if ANY of the following are true:
- It is not a recognisable KYC document (e.g. random image, meme, blank page, unrelated photo)
- The image is too blurry, dark, or low-resolution to read key fields
- The document is clearly expired (a visible expiry date is in the past)
- The document is visibly damaged, torn, or has key areas obscured or cut off
- It is a digital/screen capture — a photo of a phone or computer screen showing a document

A document is VALID (valid: true, possibly with warnings) if:
- It is a recognisable identity document, proof-of-address document, or selfie
- Key fields are legible
- It appears to be a physical original (not a screen capture)

Rules:
- issues: list specific, user-readable problems that make the document unacceptable (empty array if valid: true)
- warnings: list concerns that do not prevent acceptance but may affect extraction quality
- confidence: how certain you are in this assessment (1.0 = completely certain)
- Never invent issues. Be strict but fair.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the OpenAI image_url content part from base64 data.
 */
function imageContent(base64, mimeType) {
  // Normalise mimeType — OpenAI accepts image/jpeg, image/png, image/gif, image/webp
  const safe = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)
    ? mimeType
    : "image/jpeg";
  return {
    type: "image_url",
    image_url: { url: `data:${safe};base64,${base64}`, detail: "high" },
  };
}

/**
 * Call OpenAI chat completions with vision and parse the JSON response.
 */
async function callVision(systemPrompt, base64, mimeType) {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    max_tokens: 1024,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          imageContent(base64, mimeType),
          { type: "text", text: "Extract the document fields as instructed." },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract fields from an identity document (passport / national ID / licence).
 * @param {string} base64 - Raw base64 image data (no data: prefix).
 * @param {string} mimeType - MIME type of the image.
 * @returns {Promise<object>} Structured extraction result.
 */
async function extractIdentityDocument(base64, mimeType) {
  const result = await callVision(IDENTITY_SYSTEM_PROMPT, base64, mimeType);
  // Ensure required arrays are present even if the model skipped them
  result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
  result.confidence = typeof result.confidence === "number" ? result.confidence : 0;
  return result;
}

/**
 * Extract fields from a proof-of-address document.
 * @param {string} base64
 * @param {string} mimeType
 * @returns {Promise<object>}
 */
async function extractAddressDocument(base64, mimeType) {
  const result = await callVision(ADDRESS_SYSTEM_PROMPT, base64, mimeType);
  result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
  result.confidence = typeof result.confidence === "number" ? result.confidence : 0;
  return result;
}

/**
 * Extract metadata from a selfie / liveness image.
 * @param {string} base64
 * @param {string} mimeType
 * @returns {Promise<object>}
 */
async function extractSelfieDocument(base64, mimeType) {
  const result = await callVision(SELFIE_SYSTEM_PROMPT, base64, mimeType);
  result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
  result.confidence = typeof result.confidence === "number" ? result.confidence : 0;
  return result;
}

/**
 * Detect the category of an uploaded document using OpenAI vision.
 * Returns one of: "identity" | "address" | "selfie" | "unknown"
 * Falls back to "unknown" on any error so callers can use the client-provided hint.
 *
 * NOTE: When performing a full document check flow, prefer `checkDocumentValidity`
 * instead — it combines category detection AND validity assessment in a single AI
 * call. Use this function only when you need category detection in isolation
 * (e.g. without a validity gate).
 *
 * @param {string} base64
 * @param {string} mimeType
 * @returns {Promise<"identity"|"address"|"selfie"|"unknown">}
 */
async function detectDocumentCategory(base64, mimeType) {
  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      max_tokens: 150,
      temperature: 0,
      messages: [
        { role: "system", content: DETECT_CATEGORY_PROMPT },
        {
          role: "user",
          content: [
            imageContent(base64, mimeType),
            { type: "text", text: "What type of document is this?" },
          ],
        },
      ],
    });
    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const valid = ["identity", "address", "selfie", "unknown"];
    return valid.includes(parsed.category) ? parsed.category : "unknown";
  } catch (err) {
    console.error("[extraction] detectDocumentCategory error:", err.message);
    return "unknown";
  }
}

/**
 * Check whether an uploaded document is valid and acceptable for KYC.
 * Combines category detection and validity assessment in a single AI call.
 * @param {string} base64
 * @param {string} mimeType
 * @returns {Promise<{
 *   valid: boolean,
 *   documentCategory: "identity"|"address"|"selfie"|"unknown",
 *   issues: string[],
 *   warnings: string[],
 *   confidence: number
 * }>}
 */
async function checkDocumentValidity(base64, mimeType) {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    max_tokens: 400,
    temperature: 0,
    messages: [
      { role: "system", content: VALIDITY_CHECK_PROMPT },
      {
        role: "user",
        content: [
          imageContent(base64, mimeType),
          { type: "text", text: "Is this a valid KYC document? What type is it?" },
        ],
      },
    ],
  });
  const raw = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  const validCategories = ["identity", "address", "selfie", "unknown"];
  return {
    valid: parsed.valid === true,
    documentCategory: validCategories.includes(parsed.documentCategory)
      ? parsed.documentCategory
      : "unknown",
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
  };
}

module.exports = {
  extractIdentityDocument,
  extractAddressDocument,
  extractSelfieDocument,
  detectDocumentCategory,
  checkDocumentValidity,
};
