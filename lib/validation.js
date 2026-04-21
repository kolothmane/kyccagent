/**
 * Deterministic KYC rules engine.
 * All checks here are code-based — no AI involved.
 * AI extraction results are treated as untrusted input until validated here.
 */
"use strict";

// Date string YYYY-MM-DD (strict)
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Parse a date string to a Date object.
 * Accepts YYYY-MM-DD. Returns null for invalid inputs.
 */
function parseDate(s) {
  if (!s || typeof s !== "string") return null;
  if (!ISO_DATE_RE.test(s)) return null;
  const d = new Date(s + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Check whether a Date is in the past (expired).
 */
function isExpired(date) {
  if (!date) return false;
  return date.getTime() < Date.now();
}

/**
 * Check whether a Date is within N months from now.
 */
function expiresWithinMonths(date, n) {
  if (!date) return false;
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() + n);
  return date.getTime() < threshold.getTime();
}

// ─── Identity document validation ────────────────────────────────────────────

/**
 * Validate extracted identity document fields.
 * @param {object} data - Extraction result from OpenAI.
 * @returns {{ passed: boolean, errors: string[], warnings: string[] }}
 */
function validateIdentityDocument(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== "object") {
    return { passed: false, errors: ["No extraction data"], warnings: [] };
  }

  // --- Required fields ---
  const hasName = !!(data.fullName || (data.firstName && data.lastName));
  if (!hasName) {
    errors.push("Name could not be extracted from document");
  }

  if (!data.documentNumber) {
    errors.push("Document number could not be extracted");
  }

  if (!data.dateOfBirth) {
    errors.push("Date of birth could not be extracted");
  } else if (!ISO_DATE_RE.test(data.dateOfBirth)) {
    errors.push("Date of birth has an unrecognised format");
  }

  // --- Expiry ---
  if (!data.dateOfExpiry) {
    warnings.push("Document expiry date not found — manual review required");
  } else {
    const expiry = parseDate(data.dateOfExpiry);
    if (!expiry) {
      errors.push("Document expiry date could not be parsed");
    } else if (isExpired(expiry)) {
      errors.push("Document is expired");
    } else if (expiresWithinMonths(expiry, 6)) {
      warnings.push("Document expires within 6 months — some services may not accept it");
    }
  }

  // --- Date of issue ---
  if (data.dateOfIssue) {
    const issue = parseDate(data.dateOfIssue);
    if (!issue) {
      warnings.push("Date of issue could not be parsed");
    } else if (issue.getTime() > Date.now()) {
      errors.push("Date of issue is in the future — document may be fraudulent");
    }
  }

  // --- Confidence threshold ---
  if (typeof data.confidence === "number" && data.confidence < 0.5) {
    errors.push("Document image quality too low for reliable extraction — please upload a clearer image");
  } else if (typeof data.confidence === "number" && data.confidence < 0.75) {
    warnings.push("Some fields may be inaccurate due to image quality — please verify the pre-filled details");
  }

  // --- Unsupported document type ---
  if (data.documentType === "UNKNOWN") {
    errors.push("Document type not recognised — upload a passport, national ID, or driving licence");
  }

  // Pass through any AI-generated warnings
  if (Array.isArray(data.warnings)) {
    data.warnings.forEach((w) => warnings.push(`AI note: ${w}`));
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Proof of address validation ─────────────────────────────────────────────

/**
 * Validate extracted proof-of-address fields.
 * @param {object} data
 * @returns {{ passed: boolean, errors: string[], warnings: string[] }}
 */
function validateAddressDocument(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== "object") {
    return { passed: false, errors: ["No extraction data"], warnings: [] };
  }

  // --- Service address is mandatory ---
  if (!data.serviceAddress) {
    errors.push("Address could not be extracted from proof-of-address document");
  }

  // --- Customer name ---
  if (!data.customerName) {
    warnings.push("Customer name not found on proof-of-address document");
  }

  // --- Billing date — must be present and within last 90 days ---
  if (!data.billingDate) {
    warnings.push("Billing date not found — document may not be current");
  } else {
    const billing = parseDate(data.billingDate);
    if (!billing) {
      warnings.push("Billing date could not be parsed");
    } else {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      if (billing.getTime() < ninetyDaysAgo.getTime()) {
        errors.push("Proof-of-address document is older than 90 days — a more recent document is required");
      }
    }
  }

  // --- Confidence ---
  if (typeof data.confidence === "number" && data.confidence < 0.5) {
    errors.push("Document image quality too low for reliable extraction — please upload a clearer image");
  } else if (typeof data.confidence === "number" && data.confidence < 0.75) {
    warnings.push("Some fields may be inaccurate due to image quality — please verify the pre-filled details");
  }

  if (Array.isArray(data.warnings)) {
    data.warnings.forEach((w) => warnings.push(`AI note: ${w}`));
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── File-level validation ────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (base64 decoded)

/**
 * Validate an uploaded file before sending to OpenAI.
 * @param {{ mimeType: string, base64: string }} file
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUploadedFile({ mimeType, base64 }) {
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      error: "Unsupported file type. Please upload a JPEG, PNG, or WebP image.",
    };
  }

  const byteLength = Buffer.byteLength(base64, "base64");
  if (byteLength > MAX_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(byteLength / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 4 MB.`,
    };
  }

  return { valid: true };
}

module.exports = {
  validateIdentityDocument,
  validateAddressDocument,
  validateUploadedFile,
  parseDate,
};
