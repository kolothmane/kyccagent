"use strict";

const { getClient } = require("./openai-client");

const MODEL = "gpt-4o";

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
Extract ALL visible text fields from the provided proof-of-address document (utility bill, bank statement, council tax letter, insurance letter, or official government correspondence).

Return ONLY a JSON object with these exact fields (use null when a field is not visible or not applicable):
{
  "documentType": "UTILITY_BILL" | "BANK_STATEMENT" | "COUNCIL_TAX" | "INSURANCE" | "GOVERNMENT_CORRESPONDENCE" | "OTHER",
  "providerName": string | null,
  "customerName": string | null,
  "serviceAddress": string | null,
  "street": string | null,
  "city": string | null,
  "state": string | null,
  "postal": string | null,
  "country": string | null,
  "billingDate": "YYYY-MM-DD" | null,
  "dueDate": "YYYY-MM-DD" | null,
  "accountNumber": string | null,
  "warnings": string[],
  "confidence": number (0.0-1.0)
}

Rules:
- Normalise all dates to YYYY-MM-DD format.
- serviceAddress must be the full postal address shown on the document.
- street must contain only the street/address line without postal code or city when possible.
- city must contain only the city name, not the postal code.
- postal must contain only the postal code.
- state must contain the region / province / department when visible. If it is not explicitly printed, infer it from the visible postal address only when highly confident. For French addresses, a department such as "Seine-Saint-Denis" is acceptable.
- country should contain the country name when visible or clearly implied by the postal address.
- warnings should list any legibility issues, cut-off text, or missing address lines.
- confidence reflects overall extraction quality (1.0 = all fields clear).
- Never invent data. Return null rather than a guess.
- Do not include extra keys beyond those listed above.`;

function asNullableString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || null;
}

function parsePostalCity(value) {
  const text = asNullableString(value);
  if (!text) return { postal: null, city: null };

  let match = text.match(/\b([A-Z]{1,3}-?\d{4,6}|\d{4,6})\b[\s,.-]+(.+)$/i);
  if (match) {
    return {
      postal: match[1].replace(/\s+/g, ""),
      city: asNullableString(match[2]),
    };
  }

  match = text.match(/^(.+?)[\s,.-]+([A-Z]{1,3}-?\d{4,6}|\d{4,6})\b$/i);
  if (match) {
    return {
      postal: match[2].replace(/\s+/g, ""),
      city: asNullableString(match[1]),
    };
  }

  return { postal: null, city: null };
}

function looksLikeCountryLine(value) {
  const text = asNullableString(value);
  if (!text) return false;
  return !/\d/.test(text) && text.length > 3;
}

function normalizeAddressExtraction(result) {
  const normalized = Object.assign({}, result);
  const rawAddress = asNullableString(normalized.serviceAddress);
  const addressLines = String(rawAddress || "")
    .split(/\n|,/)
    .map(asNullableString)
    .filter(Boolean);

  normalized.providerName = asNullableString(normalized.providerName);
  normalized.customerName = asNullableString(normalized.customerName);
  normalized.serviceAddress = rawAddress;
  normalized.street = asNullableString(normalized.street);
  normalized.city = asNullableString(normalized.city);
  normalized.state = asNullableString(
    normalized.state || normalized.region || normalized.province,
  );
  normalized.postal = asNullableString(
    normalized.postal || normalized.postalCode || normalized.zipCode || normalized.zip,
  );
  normalized.country = asNullableString(normalized.country || normalized.countryCode);

  if (normalized.city && !normalized.postal) {
    const parsedCity = parsePostalCity(normalized.city);
    if (parsedCity.postal) normalized.postal = parsedCity.postal;
    if (parsedCity.city) normalized.city = parsedCity.city;
  }

  if (
    normalized.postal &&
    !/^(?:[A-Z]{1,3}-?\d{4,6}|\d{4,6})$/i.test(normalized.postal)
  ) {
    const parsedPostal = parsePostalCity(normalized.postal);
    if (parsedPostal.postal) normalized.postal = parsedPostal.postal;
    if (!normalized.city && parsedPostal.city) normalized.city = parsedPostal.city;
  }

  addressLines.forEach((line) => {
    const parsed = parsePostalCity(line);
    if (!normalized.postal && parsed.postal) normalized.postal = parsed.postal;
    if (!normalized.city && parsed.city) normalized.city = parsed.city;
  });

  if (!normalized.street) {
    const streetLine = addressLines.find(
      (line) => /\d/.test(line) && !parsePostalCity(line).postal,
    );
    normalized.street = streetLine || null;
  }

  if (!normalized.street && addressLines[0]) {
    const headLine = addressLines[0];
    const parsedHead = parsePostalCity(headLine);
    if (parsedHead.postal && parsedHead.city) {
      normalized.street = asNullableString(
        headLine.replace(parsedHead.postal, "").replace(parsedHead.city, ""),
      );
    } else {
      normalized.street = headLine;
    }
  }

  if (!normalized.country) {
    const countryLine = [...addressLines].reverse().find(looksLikeCountryLine);
    if (countryLine && countryLine !== normalized.city && countryLine !== normalized.state) {
      normalized.country = countryLine;
    }
  }

  normalized.warnings = Array.isArray(normalized.warnings) ? normalized.warnings : [];
  normalized.confidence =
    typeof normalized.confidence === "number" ? normalized.confidence : 0;

  return normalized;
}

const SELFIE_SYSTEM_PROMPT = `You are a KYC liveness / selfie document analyst.
Analyse the provided image and return metadata ONLY - never describe the person's identity.

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
- "address": utility bill, bank statement, council tax letter, insurance letter, official government correspondence, or any document showing a postal address
- "selfie": portrait photo or face image of a person
- "unknown": anything else that does not match the above categories

Rules:
- Look at the overall layout, logos, fields, and content to determine the category.
- Never invent a category. Use "unknown" when genuinely uncertain.
- confidence reflects how certain you are (1.0 = completely certain).`;

const VALIDITY_CHECK_PROMPT = `You are a document validity checker for a KYC (Know Your Customer) onboarding system.
Analyse the provided image and determine whether it is a valid, acceptable document for a KYC onboarding package.

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
- "address": utility bill, bank statement, council tax letter, insurance letter, official government correspondence, or any document with a postal address
- "selfie": portrait photo or face image of a person
- "unknown": anything else

A document is VALID (valid: true, possibly with warnings) if:
- It is a recognisable identity document, proof-of-address document, or selfie used in KYC
- Key fields are legible
- It appears to be a physical original or a clear scan/PDF rendering, not a low-quality screen capture

A document is INVALID (valid: false) if ANY of the following are true:
- It is not a recognisable KYC document (for example a random image, meme, blank page, or unrelated photo)
- The image is too blurry, dark, or low-resolution to read key fields
- The document is clearly expired and it is an identity document with a visible expiry date in the past
- The document is visibly damaged, torn, or has key areas obscured or cut off
- It is a low-quality photo of a phone or computer screen showing a document rather than the document itself

Important:
- Do NOT reject a clear proof-of-address document just because it is not a photo ID.
- A recent utility bill, bank statement, council tax letter, insurance letter, or official government correspondence can be valid as proof of address when it shows a full postal address.

Rules:
- issues: list specific, user-readable problems that make the document unacceptable (empty array if valid: true)
- warnings: list concerns that do not prevent acceptance but may affect extraction quality
- confidence: how certain you are in this assessment (1.0 = completely certain)
- Never invent issues. Be strict but fair.`;

function imageContent(base64, mimeType) {
  const safe = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)
    ? mimeType
    : "image/jpeg";
  return {
    type: "image_url",
    image_url: { url: `data:${safe};base64,${base64}`, detail: "high" },
  };
}

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

async function extractIdentityDocument(base64, mimeType) {
  const result = await callVision(IDENTITY_SYSTEM_PROMPT, base64, mimeType);
  result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
  result.confidence = typeof result.confidence === "number" ? result.confidence : 0;
  return result;
}

async function extractAddressDocument(base64, mimeType) {
  const result = await callVision(ADDRESS_SYSTEM_PROMPT, base64, mimeType);
  return normalizeAddressExtraction(result);
}

async function extractSelfieDocument(base64, mimeType) {
  const result = await callVision(SELFIE_SYSTEM_PROMPT, base64, mimeType);
  result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
  result.confidence = typeof result.confidence === "number" ? result.confidence : 0;
  return result;
}

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
