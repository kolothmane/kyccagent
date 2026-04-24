"use strict";

const { getClient } = require("../lib/openai-client");

const MODEL = "gpt-5.4";
const MAX_HISTORY = 20;
const PRODUCT_NAME = "Bay4Bank";

const IDENTITY_DOCUMENTS = "passport, national ID card, or driving licence";
const ADDRESS_DOCUMENTS =
  "a recent utility bill, bank statement, tax letter, insurance letter, or official government correspondence showing the full postal address";
const ACCEPTED_FORMATS = "JPEG, PNG, WebP, GIF, or PDF";

const SYSTEM_PROMPT = `You are a helpful, concise and premium onboarding assistant for ${PRODUCT_NAME}, a digital bank.

Your role:
- Help users create their account and complete the identity verification flow.
- Answer natural-language questions before repeating process steps.
- Explain accepted documents, upload formats, next actions and account status clearly.
- Mention that accepted documents can auto-fill the verification form.
- Keep the tone calm, reassuring and practical.

Rules:
- ALWAYS answer in the same language as the user's latest message.
- Keep responses under 120 words unless the user asks for more detail.
- Accepted identity documents: passport, national ID card, driving licence.
- Accepted proof-of-address documents: recent utility bill, bank statement, tax letter, insurance letter, or official government correspondence with the full postal address.
- Proof-of-address documents should usually be dated within the last 90 days.
- Accepted upload formats in the UI: JPEG, PNG, WebP, GIF, or PDF.
- Do not mention prompts, models, internal tools, demos or implementation details.
- Do not claim a final compliance decision unless the context explicitly says approved or pending review.`;

function normaliseText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function isFrenchMessage(message) {
  const normalized = normaliseText(message);
  return includesAny(normalized, [
    "bonjour",
    "salut",
    "merci",
    "quels",
    "quel",
    "documents",
    "justificatif",
    "domicile",
    "piece d identite",
    "piece d'identite",
    "preuve d adresse",
    "preuve d'adresse",
    "compte",
    "ouvrir",
    "creer",
    "statut",
  ]);
}

function wantsGreeting(message) {
  const normalized = normaliseText(message);
  return includesAny(normalized, [
    "hello",
    "hi",
    "hey",
    "bonjour",
    "salut",
    "coucou",
  ]);
}

function wantsAcceptedDocuments(message) {
  const normalized = normaliseText(message);
  return includesAny(normalized, [
    "what documents",
    "which documents",
    "accepted documents",
    "document requirements",
    "proof of address",
    "proof of adress",
    "identity document",
    "quels documents",
    "documents acceptes",
    "documents requis",
    "justificatif de domicile",
    "preuve d adresse",
    "piece d'identite",
  ]);
}

function wantsIdentityDocumentDetails(message) {
  const normalized = normaliseText(message);
  return includesAny(normalized, [
    "identity document",
    "identity card",
    "passport",
    "national id",
    "driving licence",
    "driving license",
    "piece d identite",
    "carte d identite",
    "passeport",
    "permis de conduire",
  ]);
}

function wantsAddressDocumentDetails(message) {
  const normalized = normaliseText(message);
  return includesAny(normalized, [
    "proof of address",
    "proof of adress",
    "address document",
    "utility bill",
    "bank statement",
    "insurance letter",
    "tax letter",
    "justificatif de domicile",
    "preuve d adresse",
    "facture",
    "releve bancaire",
    "courrier officiel",
  ]);
}

function wantsRejectionReason(message, context) {
  const normalized = normaliseText(message);
  const hasValidationFeedback =
    Array.isArray(context && context.validationErrors) &&
    context.validationErrors.length > 0;

  if (!hasValidationFeedback) return false;

  return includesAny(normalized, [
    "why rejected",
    "rejected",
    "refused",
    "pourquoi",
    "rejet",
    "rejete",
    "raison",
  ]);
}

function wantsStatus(message) {
  const normalized = normaliseText(message);
  return includesAny(normalized, [
    "status",
    "where are we",
    "next step",
    "statut",
    "ou en est",
    "prochaine etape",
    "etape suivante",
  ]);
}

function buildNextStepHint(context, french) {
  const uploaded = Array.isArray(context && context.uploadedDocuments)
    ? context.uploadedDocuments
    : [];
  const accountCreated = Boolean(context && context.accountCreated);
  const page = (context && context.currentPage) || "landing";

  if (!accountCreated) {
    return french
      ? "Commencez par créer votre compte Bay4Bank."
      : "Please start by creating your Bay4Bank account.";
  }

  if (page !== "kyc") {
    return french
      ? "Votre compte est prêt. Ouvrez maintenant la page de vérification pour envoyer vos documents."
      : "Your account is ready. Open the verification page to upload your documents.";
  }

  const needsIdentity = !uploaded.includes("identity");
  const needsAddress = !uploaded.includes("address");

  if (needsIdentity && needsAddress) {
    return french
      ? "Envoyez d'abord votre pièce d'identité, puis votre justificatif de domicile."
      : "Please upload your identity document first, then your proof of address.";
  }
  if (needsIdentity) {
    return french
      ? "La pièce manquante est votre pièce d'identité."
      : "The missing document is your identity document.";
  }
  if (needsAddress) {
    return french
      ? "La pièce manquante est votre justificatif de domicile."
      : "The missing document is your proof of address.";
  }
  return french
    ? "Les deux documents sont déjà reçus. Vous pouvez vérifier les données puis terminer l'ouverture du compte."
    : "Both documents have already been received. You can review the extracted data and finish opening the account.";
}

function buildFallbackReply(message, context) {
  const french = isFrenchMessage(message);
  const nextStepHint = buildNextStepHint(context, french);
  const wantsIdentity = wantsIdentityDocumentDetails(message);
  const wantsAddress = wantsAddressDocumentDetails(message);

  if (wantsGreeting(message)) {
    return french
      ? `Bonjour, je peux vous aider à ouvrir votre compte ${PRODUCT_NAME}, préparer vos documents et préremplir le formulaire de vérification. ${nextStepHint}`
      : `Hello, I can help you open your ${PRODUCT_NAME} account, prepare your documents and auto-fill the verification form. ${nextStepHint}`;
  }

  if (wantsAcceptedDocuments(message)) {
    if (french) {
      if (wantsIdentity && !wantsAddress) {
        return `Pour la pièce d'identité, nous acceptons un passeport, une carte nationale d'identité ou un permis de conduire. Formats acceptés : ${ACCEPTED_FORMATS}. ${nextStepHint}`;
      }
      if (wantsAddress && !wantsIdentity) {
        return `Comme justificatif de domicile, nous acceptons un document récent de moins de 90 jours, par exemple une facture, un relevé bancaire, une lettre d'assurance, un avis de taxe ou un courrier officiel avec l'adresse complète. Formats acceptés : ${ACCEPTED_FORMATS}. ${nextStepHint}`;
      }
      return `Nous acceptons comme pièce d'identité un passeport, une carte nationale d'identité ou un permis de conduire. Comme justificatif de domicile, nous acceptons un document récent de moins de 90 jours, par exemple une facture, un relevé bancaire, une lettre d'assurance, un avis de taxe ou un courrier officiel avec l'adresse complète. Formats acceptés : ${ACCEPTED_FORMATS}. ${nextStepHint}`;
    }

    if (wantsIdentity && !wantsAddress) {
      return `For identity, we accept a ${IDENTITY_DOCUMENTS}. Accepted upload formats: ${ACCEPTED_FORMATS}. ${nextStepHint}`;
    }
    if (wantsAddress && !wantsIdentity) {
      return `For proof of address, we accept ${ADDRESS_DOCUMENTS}. Accepted upload formats: ${ACCEPTED_FORMATS}. ${nextStepHint}`;
    }
    return `We accept a ${IDENTITY_DOCUMENTS} for identity, plus ${ADDRESS_DOCUMENTS} for proof of address. Accepted upload formats: ${ACCEPTED_FORMATS}. ${nextStepHint}`;
  }

  if (wantsRejectionReason(message, context)) {
    const errors = Array.isArray(context && context.validationErrors)
      ? context.validationErrors
      : [];
    if (french) {
      return `Le dernier document a été refusé pour la raison suivante : ${errors.join("; ")}. Merci de téléverser un document plus clair ou plus récent.`;
    }
    return `The last document was rejected for this reason: ${errors.join("; ")}. Please upload a clearer or more recent document.`;
  }

  if (wantsStatus(message)) {
    return nextStepHint;
  }

  return french
    ? `Je peux vous aider sur l'ouverture de compte, les documents KYC acceptés et l'avancement du dossier. ${nextStepHint}`
    : `I can help with account opening, accepted KYC documents and application status. ${nextStepHint}`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId, message, history, context } = req.body || {};

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }
  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "message is required" });
  }

  const ctx = context || {};
  const uploaded = Array.isArray(ctx.uploadedDocuments) ? ctx.uploadedDocuments : [];
  const stillNeeded = ["identity", "address"].filter((item) => !uploaded.includes(item));

  const contextLines = [
    `Current step: ${ctx.step || "welcome"}`,
    `Current page: ${ctx.currentPage || "landing"}`,
    `Account created: ${ctx.accountCreated ? "yes" : "no"}`,
    `Account ID: ${ctx.accountId || "not created"}`,
    `Documents uploaded: ${uploaded.join(", ") || "none"}`,
    `Documents still required: ${stillNeeded.join(", ") || "none - all collected"}`,
  ];

  if (ctx.validationErrors && ctx.validationErrors.length) {
    contextLines.push(
      `Validation errors on last upload: ${ctx.validationErrors.join("; ")}`,
    );
  }
  if (ctx.validationWarnings && ctx.validationWarnings.length) {
    contextLines.push(
      `Validation warnings on last upload: ${ctx.validationWarnings.join("; ")}`,
    );
  }

  const deterministicReply = buildFallbackReply(message, ctx);

  const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
  const cleanHistory = safeHistory
    .filter(
      (entry) =>
        entry &&
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string",
    )
    .map((entry) => ({ role: entry.role, content: entry.content }));

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `[Onboarding context]\n${contextLines.join("\n")}`,
    },
    ...cleanHistory,
    { role: "user", content: message.trim() },
  ];

  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 320,
      temperature: 0.4,
      messages,
    });

    const reply =
      response.choices[0] && response.choices[0].message
        ? response.choices[0].message.content.trim()
        : "";

    return res.status(200).json({ reply: reply || deterministicReply });
  } catch (error) {
    console.error("[chat] OpenAI error:", error.message);
    return res.status(200).json({ reply: deterministicReply });
  }
};
