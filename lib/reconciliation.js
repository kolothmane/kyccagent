/**
 * Cross-document reconciliation engine.
 * Deterministically compares fields across identity and address documents
 * to flag mismatches, assess overall risk, and recommend an action.
 */
"use strict";

const { parseDate } = require("./validation");

// ─── Name comparison helpers ──────────────────────────────────────────────────

function normaliseName(s) {
  if (!s || typeof s !== "string") return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Return true when two name strings are likely the same person.
 * Handles common abbreviations (e.g. "J. Smith" vs "John Smith").
 */
function namesMatch(a, b) {
  if (!a || !b) return null; // not enough data to decide
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (na === nb) return true;

  // Tokenise and check that all significant tokens from the shorter name
  // appear in the longer one (covers "John Smith" vs "John A. Smith")
  const tokA = na.split(" ").filter((t) => t.length > 1);
  const tokB = nb.split(" ").filter((t) => t.length > 1);
  const shorter = tokA.length <= tokB.length ? tokA : tokB;
  const longer = tokA.length <= tokB.length ? tokB : tokA;
  return shorter.every((tok) => longer.some((t) => t.startsWith(tok) || tok.startsWith(t)));
}

// ─── Address comparison helpers ───────────────────────────────────────────────

function normaliseAddress(s) {
  if (!s || typeof s !== "string") return "";
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addressesMatch(a, b) {
  if (!a || !b) return null;
  const na = normaliseAddress(a);
  const nb = normaliseAddress(b);
  if (na === nb) return true;

  // Check if the identity address is a substring of (or contains) the address doc address
  return na.includes(nb) || nb.includes(na);
}

// ─── Main reconciliation ──────────────────────────────────────────────────────

/**
 * Reconcile an identity document extraction with a proof-of-address extraction.
 * @param {object|null} identity - Extraction result from identity document.
 * @param {object|null} address  - Extraction result from proof-of-address document.
 * @returns {object} Reconciliation report.
 */
function reconcile(identity, address) {
  const missingFields = [];
  const suspiciousSignals = [];
  let riskScore = 0; // 0 = low risk, higher = more risk

  // ─── Name match ───
  const identityFullName =
    identity?.fullName ||
    [identity?.firstName, identity?.middleNames, identity?.lastName]
      .filter(Boolean)
      .join(" ") ||
    null;

  const nameMatchResult = namesMatch(identityFullName, address?.customerName);
  if (nameMatchResult === null) {
    missingFields.push("Name comparison not possible — name missing from one or both documents");
    riskScore += 1;
  } else if (!nameMatchResult) {
    suspiciousSignals.push(
      `Name mismatch: identity shows "${identityFullName}", address document shows "${address?.customerName}"`
    );
    riskScore += 3;
  }

  // ─── DOB ───
  const dobParsed = parseDate(identity?.dateOfBirth);
  const dobMatch = !!dobParsed; // we just check it exists and is valid
  if (!dobMatch) {
    missingFields.push("Date of birth missing or invalid");
    riskScore += 1;
  }

  // ─── Address match ───
  const addressMatchResult = addressesMatch(identity?.address, address?.serviceAddress);
  // Only flag mismatch if both addresses are present — not all ID docs have addresses
  if (identity?.address && address?.serviceAddress && addressMatchResult === false) {
    suspiciousSignals.push("Address on identity document does not match proof-of-address document");
    riskScore += 2;
  }
  if (!address?.serviceAddress) {
    missingFields.push("Service address not found on proof-of-address document");
    riskScore += 2;
  }

  // ─── Expiry valid ───
  const expiryDate = parseDate(identity?.dateOfExpiry);
  const expiryValid = expiryDate ? expiryDate.getTime() > Date.now() : false;
  if (!expiryValid) {
    suspiciousSignals.push("Identity document is expired or expiry could not be verified");
    riskScore += 3;
  }

  // ─── Overall risk ───
  let overallRisk;
  let recommendedAction;

  if (riskScore === 0 && missingFields.length === 0 && suspiciousSignals.length === 0) {
    overallRisk = "LOW";
    recommendedAction = "AUTO_APPROVE";
  } else if (riskScore <= 2 && suspiciousSignals.length === 0) {
    overallRisk = "LOW";
    recommendedAction = "APPROVE_WITH_NOTE";
  } else if (riskScore <= 4) {
    overallRisk = "MEDIUM";
    recommendedAction = "MANUAL_REVIEW";
  } else {
    overallRisk = "HIGH";
    recommendedAction = "MANUAL_REVIEW";
  }

  return {
    nameMatch: nameMatchResult,
    dobMatch,
    addressMatch: addressMatchResult,
    expiryValid,
    missingFields,
    suspiciousSignals,
    overallRisk,
    recommendedAction,
    riskScore,
  };
}

module.exports = { reconcile };
