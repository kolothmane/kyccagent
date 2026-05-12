"use strict";

const { toFile } = require("openai");
const { getClient } = require("../lib/openai-client");
const { getAccountBySessionToken } = require("../lib/account-store");

const MODELS = ["gpt-5.4", "gpt-4.1-mini", "gpt-4o-mini"];
const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const TRANSCRIPTION_FALLBACK_MODEL = "whisper-1";
const MAX_HISTORY = 16;
const MAX_AUDIO_BYTES = 7 * 1024 * 1024;
const PRODUCT_NAME = "Bay4Bank";

const LANGUAGE_LABELS = {
  fr: "French",
  en: "English",
  ar: "Arabic",
  es: "Spanish",
};

const SYSTEM_PROMPT = `You are Sophie, the multilingual virtual banking assistant for ${PRODUCT_NAME}.

You support already-verified retail banking clients after account activation.

Mission:
- Resolve simple, low-value support requests automatically, 24/7.
- Analyse the user's request precisely before answering.
- When the request is operational, either prepare the action or clearly simulate it.
- Help with routine questions about balance, cards, transfers, beneficiaries, IBAN, payment status, app access, account documents and next steps.
- Segment requests by intent, complexity and customer profile.
- Escalate complex or sensitive requests to a human specialist.

Rules:
- Reply in the requested language.
- Keep replies concise, clear and service-oriented.
- Do not mention demos, prompts, internal tools or implementation details.
- Never pretend a banking operation was truly executed in production.
- If you simulate or prepare an action, say so explicitly.
- If the request involves fraud, legal complaints, chargebacks, credit decisions, account closure, high-value transfers or identity/security risk, clearly say a specialist will take over.
- For routine requests, provide the next best action and mention any missing information needed to continue.`;

function readBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normaliseText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function formatMoney(cents, language) {
  const locale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "fr-FR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);
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

function extractAssistantText(content) {
  if (typeof content === "string") return cleanText(content);
  if (!Array.isArray(content)) return "";

  return cleanText(
    content
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item;
        if (typeof item.text === "string") return item.text;
        if (typeof item.content === "string") return item.content;
        if (typeof item.text?.value === "string") return item.text.value;
        return "";
      })
      .filter(Boolean)
      .join(" "),
  );
}

function readOpenAiErrorStatus(error) {
  return Number(
    (error && error.status) ||
      (error && error.response && error.response.status) ||
      (error && error.cause && error.cause.status) ||
      0,
  );
}

async function transcribeAudioBuffer(buffer, mimeType, language) {
  const client = getClient();
  const extension = extensionForMimeType(mimeType);
  const attempts = [TRANSCRIPTION_MODEL, TRANSCRIPTION_FALLBACK_MODEL];
  let lastError = null;

  for (const model of attempts) {
    try {
      const file = await toFile(buffer, "bay4bank-voice." + extension, { type: mimeType });
      const transcription = await client.audio.transcriptions.create({
        file,
        model,
        language,
        prompt:
          "The speaker is a Bay4Bank banking client talking to Sophie, a virtual banking assistant. Transcribe the request clearly.",
      });
      const text = cleanText(transcription && transcription.text);

      if (text) {
        return { text, model };
      }
    } catch (error) {
      lastError = error;
      console.error("[client-chat] transcription attempt failed:", model, error.message);
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { text: "", model: "" };
}

function getFullName(account) {
  return [account && account.firstName, account && account.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function detectIntent(message) {
  const text = normaliseText(message);

  if (!text) return "general";
  if (
    includesAny(text, [
      "que peux tu faire",
      "que peut tu faire",
      "que peux-tu faire",
      "tu peux faire quoi",
      "comment peux tu m aider",
      "comment peux-tu m aider",
      "help",
      "aide",
      "what can you do",
      "how can you help",
    ])
  ) {
    return "capabilities";
  }
  if (includesAny(text, ["fraud", "fraude", "stolen", "vole", "chargeback"])) return "risk";
  if (includesAny(text, ["complaint", "reclamation", "litige"])) return "complaint";
  if (includesAny(text, ["beneficiaire", "beneficiary", "destinataire"])) return "beneficiary";
  if (includesAny(text, ["balance", "solde", "saldo", "رصيد"])) return "balance";
  if (
    includesAny(text, [
      "card",
      "carte",
      "tarjeta",
      "بطاقة",
      "blocked",
      "bloquee",
      "plafond",
      "paiement en ligne",
      "online payment",
      "opposition",
      "debloquer",
      "debloquer",
    ])
  ) {
    return "card";
  }
  if (includesAny(text, ["transfer", "virement", "virment", "transferencia", "تحويل"])) return "transfer";
  if (includesAny(text, ["iban", "rib", "account number", "numero de compte"])) return "iban";
  if (includesAny(text, ["document", "releve", "statement", "attestation", "justificatif"])) return "document";
  if (includesAny(text, ["conseiller", "advisor", "adviser", "specialiste", "support humain"])) return "advisor";
  if (includesAny(text, ["loan", "credit", "pret", "credito", "قرض"])) return "loan";
  if (includesAny(text, ["saving", "epargne", "ahorro"])) return "savings";
  if (includesAny(text, ["password", "mot de passe", "connexion", "login", "access"])) return "access";
  return "general";
}

function getLastUserMessage(history) {
  if (!Array.isArray(history)) return "";

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry && entry.role === "user" && typeof entry.content === "string") {
      return entry.content;
    }
  }

  return "";
}

function resolveIntent(message, history) {
  const currentIntent = detectIntent(message);
  if (currentIntent !== "general") return currentIntent;

  const previousUserMessage = getLastUserMessage(history);
  const previousIntent = detectIntent(previousUserMessage);
  const hasStructuredInput = Boolean(extractIban(message) || extractAmount(message));

  if (hasStructuredInput && ["beneficiary", "transfer", "card", "document"].includes(previousIntent)) {
    return previousIntent;
  }

  return currentIntent;
}

function extractIban(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/[A-Z]{2}\d{2}[A-Z0-9]{11,30}/);
  return match ? match[0] : "";
}

function formatIban(value) {
  const compact = extractIban(value);
  if (!compact) return "";
  return compact.replace(/(.{4})(?=.)/g, "$1 ").trim();
}

function extractAmount(value) {
  const text = cleanText(value);
  const directMatch = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(€|eur|euros?)/i);
  const contextualMatch = text.match(/(?:de|pour|montant|amount|transfer of)\s+(\d+(?:[.,]\d{1,2})?)/i);
  const match = directMatch || contextualMatch;

  if (!match) return null;

  const amount = Number(String(match[1] || "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function formatAmount(amount, language) {
  const locale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "fr-FR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function sanitiseBeneficiaryName(value) {
  return cleanText(value)
    .replace(/^(ajouter|rajouter|create|add|simuler|prepare|préparer|beneficiaire|bénéficiaire|beneficiary|pour|to|au nom de|nom)\s+/i, "")
    .replace(/\b(?:iban|rib|virement|transfer|montant|amount|eur|euros?|€)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isLikelyBeneficiaryName(value) {
  const text = normaliseText(value);
  return Boolean(text) && !includesAny(text, [
    "je veux",
    "virement",
    "transfer",
    "montant",
    "solde",
    "carte",
    "ajouter",
    "rajouter",
    "prepare",
    "simule",
  ]);
}

function extractBeneficiaryName(value) {
  const raw = cleanText(value);
  const withoutIban = raw
    .replace(formatIban(raw), " ")
    .replace(extractIban(raw), " ")
    .replace(/(\d+(?:[.,]\d{1,2})?)\s*(€|eur|euros?)/gi, " ");
  const transferMatch = withoutIban.match(
    /(?:vers|to|au nom de|beneficiaire|bénéficiaire|beneficiary|destinataire|a|à)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{2,60})$/i,
  );

  if (transferMatch && transferMatch[1]) {
    const candidate = sanitiseBeneficiaryName(transferMatch[1]);
    if (isLikelyBeneficiaryName(candidate)) return candidate;
  }

  const namedMatch = withoutIban.match(
    /(?:beneficiaire|bénéficiaire|beneficiary|pour|to|au nom de|nom)\s*:?\s*([A-Za-zÀ-ÿ' -]{3,60})/i,
  );

  if (namedMatch && namedMatch[1]) {
    const candidate = sanitiseBeneficiaryName(namedMatch[1]);
    if (isLikelyBeneficiaryName(candidate)) return candidate;
  }

  const leadingMatch = withoutIban.match(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{2,60})/);
  if (!leadingMatch) return "";

  const candidate = sanitiseBeneficiaryName(leadingMatch[1]);
  return /[A-Za-zÀ-ÿ]{2,}/.test(candidate) && isLikelyBeneficiaryName(candidate) ? candidate : "";
}

function buildCapabilityReply(name, language) {
  if (language === "en") {
    return `Hello ${name}, I can analyse your request and either prepare or simulate common actions: show balance, share IBAN details, prepare a transfer, simulate adding a beneficiary, explain card settings, toggle online payments, locate account documents and route you to an advisor when needed.`;
  }
  if (language === "es") {
    return `Hola ${name}, puedo analizar tu solicitud y preparar o simular acciones habituales: mostrar saldo, compartir el IBAN, preparar una transferencia, simular el alta de un beneficiario, explicar opciones de la tarjeta, activar o desactivar pagos en línea, encontrar documentos y derivarte a un asesor si hace falta.`;
  }
  if (language === "ar") {
    return `مرحبا ${name}، أستطيع تحليل طلبك وتجهيز أو محاكاة الإجراءات المعتادة: عرض الرصيد، مشاركة IBAN، تجهيز تحويل، محاكاة إضافة مستفيد، شرح إعدادات البطاقة، تفعيل أو إيقاف الدفع عبر الإنترنت، العثور على مستندات الحساب وتحويلك إلى مستشار عند الحاجة.`;
  }
  return `Bonjour ${name}, je peux analyser votre demande et préparer ou simuler des actions courantes : afficher votre solde, partager l'IBAN, préparer un virement, simuler l'ajout d'un bénéficiaire, expliquer les réglages carte, activer ou désactiver le paiement en ligne, retrouver des documents de compte et vous orienter vers un conseiller si nécessaire.`;
}

function buildDocumentReply(message, language) {
  const text = normaliseText(message);

  if (includesAny(text, ["rib", "iban"])) {
    if (language === "en") return "I can help you retrieve your IBAN/RIB from the current account card in this client area.";
    if (language === "es") return "Puedo ayudarte a recuperar tu IBAN/RIB desde la tarjeta de cuenta corriente de este espacio cliente.";
    if (language === "ar") return "أستطيع مساعدتك في العثور على IBAN أو RIB من بطاقة الحساب الجاري في مساحة العميل.";
    return "Je peux vous aider à retrouver votre IBAN ou votre RIB depuis la carte de compte courant dans cet espace client.";
  }

  if (includesAny(text, ["releve", "statement"])) {
    if (language === "en") return "For an account statement, tell me the period you need and I will guide you to the right document.";
    if (language === "es") return "Para un extracto, indícame el período que necesitas y te guiaré al documento adecuado.";
    if (language === "ar") return "بالنسبة لكشف الحساب، أخبرني بالفترة المطلوبة وسأوجهك إلى المستند المناسب.";
    return "Pour un relevé, indiquez-moi la période souhaitée et je vous guiderai vers le bon document.";
  }

  if (language === "en") return "I can help you find an IBAN/RIB, statement or account certificate. Tell me which document you need.";
  if (language === "es") return "Puedo ayudarte a encontrar un IBAN/RIB, extracto o attestation de compte. Dime qué documento necesitas.";
  if (language === "ar") return "أستطيع مساعدتك في العثور على IBAN أو RIB أو كشف حساب أو شهادة حساب. أخبرني بالمستند المطلوب.";
  return "Je peux vous aider à retrouver un RIB, un relevé ou une attestation de compte. Dites-moi simplement lequel il vous faut.";
}

function buildBeneficiaryReply(message, language) {
  const beneficiaryName = extractBeneficiaryName(message);
  const iban = formatIban(message);

  if (beneficiaryName && iban) {
    if (language === "en") {
      return `Done. I am simulating the addition of beneficiary ${beneficiaryName} with IBAN ${iban}. The beneficiary is now prepared for a future transfer in your Bay4Bank space.`;
    }
    if (language === "es") {
      return `Perfecto. Estoy simulando el alta del beneficiario ${beneficiaryName} con el IBAN ${iban}. El beneficiario queda preparado para una próxima transferencia en tu espacio Bay4Bank.`;
    }
    if (language === "ar") {
      return `تم. أقوم بمحاكاة إضافة المستفيد ${beneficiaryName} مع رقم IBAN ${iban}. المستفيد أصبح جاهزا لتحويل لاحق داخل مساحة Bay4Bank الخاصة بك.`;
    }
    return `C'est noté. Je simule l'ajout du bénéficiaire ${beneficiaryName} avec l'IBAN ${iban}. Le bénéficiaire est maintenant prêt pour un prochain virement dans votre espace Bay4Bank.`;
  }

  if (language === "en") {
    return "I can prepare a beneficiary addition. Send me at least the full name and IBAN, and I will simulate the registration for your next transfer.";
  }
  if (language === "es") {
    return "Puedo preparar el alta de un beneficiario. Envíame al menos el nombre completo y el IBAN y simularé el registro para tu próxima transferencia.";
  }
  if (language === "ar") {
    return "أستطيع تجهيز إضافة مستفيد. أرسل لي على الأقل الاسم الكامل ورقم IBAN وسأحاكي التسجيل من أجل التحويل القادم.";
  }
  return "Je peux préparer l'ajout d'un bénéficiaire. Envoyez-moi au minimum son nom complet et son IBAN, et je simulerai l'enregistrement pour votre prochain virement.";
}

function buildTransferReply(message, language) {
  const amount = extractAmount(message);
  const beneficiaryName = extractBeneficiaryName(message);

  if (amount && beneficiaryName) {
    const amountLabel = formatAmount(amount, language);
    if (language === "en") {
      return `I am preparing a transfer of ${amountLabel} to ${beneficiaryName}. Simulation ready: the transfer remains pending final confirmation.`;
    }
    if (language === "es") {
      return `Estoy preparando una transferencia de ${amountLabel} para ${beneficiaryName}. Simulación lista: la operación queda pendiente de confirmación final.`;
    }
    if (language === "ar") {
      return `أجهز تحويلا بقيمة ${amountLabel} إلى ${beneficiaryName}. المحاكاة جاهزة والعملية ما زالت بانتظار التأكيد النهائي.`;
    }
    return `Je prépare un virement de ${amountLabel} vers ${beneficiaryName}. Simulation prête : l'opération reste en attente de votre confirmation finale.`;
  }

  if (language === "en") return "I can prepare a transfer simulation. Tell me the beneficiary and the amount to simulate, and I will summarise the operation before confirmation.";
  if (language === "es") return "Puedo preparar una simulación de transferencia. Indícame el beneficiario y el importe, y te resumiré la operación antes de confirmar.";
  if (language === "ar") return "أستطيع تجهيز محاكاة تحويل. أخبرني باسم المستفيد والمبلغ وسألخص لك العملية قبل التأكيد.";
  return "Je peux préparer une simulation de virement. Indiquez-moi le bénéficiaire et le montant à simuler, et je vous résumerai l'opération avant confirmation.";
}

function buildCardReply(message, language, cardLast4, monthlyLimit) {
  const text = normaliseText(message);

  if (includesAny(text, ["opposition", "bloquer", "block", "freeze"])) {
    if (language === "en") return `I am simulating a temporary block on your card ending in ${cardLast4}. A specialist can take over if this is linked to fraud.`;
    if (language === "es") return `Estoy simulando un bloqueo temporal de tu tarjeta terminada en ${cardLast4}. Un asesor puede intervenir si está relacionado con fraude.`;
    if (language === "ar") return `أقوم بمحاكاة إيقاف مؤقت لبطاقتك المنتهية بـ ${cardLast4}. يمكن لمستشار المتابعة إذا كان الأمر مرتبطا باحتيال.`;
    return `Je simule une mise en opposition temporaire de votre carte terminée par ${cardLast4}. Un conseiller peut prendre le relais si cela concerne une fraude.`;
  }

  if (includesAny(text, ["debloquer", "debloquer", "reactiver", "réactiver", "unblock"])) {
    if (language === "en") return `I am simulating the reactivation of your card ending in ${cardLast4}. Check your payments again in a few moments.`;
    if (language === "es") return `Estoy simulando la reactivación de tu tarjeta terminada en ${cardLast4}. Vuelve a comprobar tus pagos en unos instantes.`;
    if (language === "ar") return `أقوم بمحاكاة إعادة تفعيل بطاقتك المنتهية بـ ${cardLast4}. أعد التحقق من المدفوعات بعد لحظات.`;
    return `Je simule la réactivation de votre carte terminée par ${cardLast4}. Vous pouvez revérifier vos paiements d'ici quelques instants.`;
  }

  if (includesAny(text, ["paiement en ligne", "online payment", "desactiver", "désactiver", "activer", "enable", "disable"])) {
    const enable = includesAny(text, ["activer", "enable", "reactiver", "réactiver"]);
    if (language === "en") return enable ? `I am simulating online payments being enabled for your card ending in ${cardLast4}.` : `I am simulating online payments being disabled for your card ending in ${cardLast4}.`;
    if (language === "es") return enable ? `Estoy simulando la activación de los pagos en línea para tu tarjeta terminada en ${cardLast4}.` : `Estoy simulando la desactivación de los pagos en línea para tu tarjeta terminada en ${cardLast4}.`;
    if (language === "ar") return enable ? `أقوم بمحاكاة تفعيل الدفع عبر الإنترنت لبطاقتك المنتهية بـ ${cardLast4}.` : `أقوم بمحاكاة إيقاف الدفع عبر الإنترنت لبطاقتك المنتهية بـ ${cardLast4}.`;
    return enable ? `Je simule l'activation du paiement en ligne pour votre carte terminée par ${cardLast4}.` : `Je simule la désactivation du paiement en ligne pour votre carte terminée par ${cardLast4}.`;
  }

  if (includesAny(text, ["plafond", "limit"])) {
    if (language === "en") return `Your current monthly card limit is ${monthlyLimit}. I can also simulate a temporary block or an online payment change.`;
    if (language === "es") return `Tu límite mensual actuel de tarjeta es ${monthlyLimit}. También puedo simular un bloqueo temporal o un cambio en pagos en línea.`;
    if (language === "ar") return `الحد الشهري الحالي لبطاقتك هو ${monthlyLimit}. كما أستطيع محاكاة إيقاف مؤقت أو تغيير الدفع عبر الإنترنت.`;
    return `Votre plafond mensuel actuel sur la carte est de ${monthlyLimit}. Je peux aussi simuler un blocage temporaire ou un changement sur le paiement en ligne.`;
  }

  if (language === "en") return `Your Bay4Bank card ending in ${cardLast4} is available in your client area. I can explain limits, online payments and card actions.`;
  if (language === "es") return `Tu tarjeta Bay4Bank terminada en ${cardLast4} está disponible en tu espacio cliente. Puedo explicar límites, pagos en línea y acciones sobre la tarjeta.`;
  if (language === "ar") return `بطاقة Bay4Bank المنتهية بـ ${cardLast4} ظاهرة في مساحة العميل. أستطيع شرح الحدود والإعدادات وإجراءات البطاقة.`;
  return `Votre carte Bay4Bank terminée par ${cardLast4} est visible dans votre espace client. Je peux expliquer les plafonds, le paiement en ligne et les actions carte.`;
}

function isComplexRequest(intent, message) {
  const text = normaliseText(message);

  return (
    intent === "risk" ||
    intent === "complaint" ||
    includesAny(text, [
      "close account",
      "fermer mon compte",
      "cloturer",
      "lawsuit",
      "legal",
      "juridique",
      "mortgage",
      "pret immobilier",
      "chargeback",
      "unauthorized",
      "non autorise",
      "10000",
      "10 000",
      "50000",
      "50 000",
    ])
  );
}

function buildFallbackReply(message, history, account, language) {
  const intent = resolveIntent(message, history);
  const complex = isComplexRequest(intent, message);
  const name = getFullName(account) || "client";
  const financials = (account && account.financials) || {};
  const balance = formatMoney(financials.availableBalanceCents || 42075, language);
  const cardLast4 = cleanText(financials.cardLast4) || "4821";
  const monthlyLimit = formatMoney(financials.monthlyLimitCents || 150000, language);

  if (complex) {
    if (language === "en") {
      return {
        intent,
        complexity: "complex",
        escalate: true,
        useModel: false,
        reply:
          "This request needs a specialist review. I have prepared the context so a Bay4Bank advisor can take over with priority.",
      };
    }
    if (language === "es") {
      return {
        intent,
        complexity: "complex",
        escalate: true,
        useModel: false,
        reply:
          "Esta solicitud requiere revisión especializada. He preparado el contexto para que un asesor Bay4Bank la atienda con prioridad.",
      };
    }
    if (language === "ar") {
      return {
        intent,
        complexity: "complex",
        escalate: true,
        useModel: false,
        reply:
          "هذا الطلب يحتاج إلى مراجعة من مختص. جهزت السياق ليتمكن مستشار Bay4Bank من المتابعة بأولوية.",
      };
    }
    return {
      intent,
      complexity: "complex",
      escalate: true,
      useModel: false,
      reply:
        "Cette demande nécessite une revue spécialisée. Je prépare le contexte pour qu'un conseiller Bay4Bank prenne le relais en priorité.",
    };
  }

  if (language === "en") {
    const replies = {
      capabilities: buildCapabilityReply(name, language),
      beneficiary: buildBeneficiaryReply(message, language),
      balance: `Your available balance is ${balance}. You can also review recent operations from this client area.`,
      card: buildCardReply(message, language, cardLast4, monthlyLimit),
      transfer: buildTransferReply(message, language),
      iban: "Your IBAN is displayed in the current account card of this client area.",
      document: buildDocumentReply(message, language),
      advisor: "I can route you to a Bay4Bank advisor and send the context of your request.",
      access:
        "For access issues, you can reset credentials through Bay4Bank support. If you suspect account takeover, I will escalate immediately.",
      loan:
        "For loan questions, I can explain the usual documents and next steps. A credit decision is handled by a specialist.",
      savings:
        "For savings, I can explain available options and help you prepare a request for an advisor.",
      general: buildCapabilityReply(name, language),
    };
    return {
      intent,
      complexity: "simple",
      escalate: false,
      useModel: intent === "general",
      reply: replies[intent] || replies.general,
    };
  }

  if (language === "es") {
    const replies = {
      capabilities: buildCapabilityReply(name, language),
      beneficiary: buildBeneficiaryReply(message, language),
      balance: `Tu saldo disponible es ${balance}. También puedes revisar las operaciones recientes desde este espacio cliente.`,
      card: buildCardReply(message, language, cardLast4, monthlyLimit),
      transfer: buildTransferReply(message, language),
      iban: "Tu IBAN aparece en la tarjeta de cuenta corriente de este espacio cliente.",
      document: buildDocumentReply(message, language),
      advisor: "Puedo derivarte a un asesor Bay4Bank y enviar el contexto de tu solicitud.",
      access:
        "Para problemas de acceso, puedes restablecer tus credenciales con soporte Bay4Bank. Si hay riesgo de fraude, escalo el caso.",
      loan:
        "Para préstamos, puedo explicar documentos y próximos pasos. La decisión de crédito la gestiona un especialista.",
      savings:
        "Para ahorro, puedo explicar las opciones y preparar una solicitud para un asesor.",
      general: buildCapabilityReply(name, language),
    };
    return {
      intent,
      complexity: "simple",
      escalate: false,
      useModel: intent === "general",
      reply: replies[intent] || replies.general,
    };
  }

  if (language === "ar") {
    const replies = {
      capabilities: buildCapabilityReply(name, language),
      beneficiary: buildBeneficiaryReply(message, language),
      balance: `رصيدك المتاح هو ${balance}. يمكنك أيضا مراجعة آخر العمليات من مساحة العميل.`,
      card: buildCardReply(message, language, cardLast4, monthlyLimit),
      transfer: buildTransferReply(message, language),
      iban: "رقم IBAN ظاهر في بطاقة الحساب الجاري داخل مساحة العميل.",
      document: buildDocumentReply(message, language),
      advisor: "أستطيع تحويلك إلى مستشار Bay4Bank مع إرسال سياق الطلب.",
      access:
        "لمشاكل الدخول، يمكن إعادة ضبط بيانات الوصول عبر دعم Bay4Bank. إذا كان هناك خطر أمني سأصعد الطلب.",
      loan:
        "بالنسبة للقروض، أستطيع شرح الوثائق والخطوات التالية. قرار الائتمان يتولاه مختص.",
      savings: "بالنسبة للادخار، أستطيع شرح الخيارات وتحضير طلب لمستشار.",
      general: buildCapabilityReply(name, language),
    };
    return {
      intent,
      complexity: "simple",
      escalate: false,
      useModel: intent === "general",
      reply: replies[intent] || replies.general,
    };
  }

  const replies = {
    capabilities: buildCapabilityReply(name, language),
    beneficiary: buildBeneficiaryReply(message, language),
    balance: `Votre solde disponible est de ${balance}. Vous pouvez aussi consulter vos dernières opérations depuis cet espace client.`,
    card: buildCardReply(message, language, cardLast4, monthlyLimit),
    transfer: buildTransferReply(message, language),
    iban: "Votre IBAN est affiché dans la carte de compte courant de cet espace client.",
    document: buildDocumentReply(message, language),
    advisor: "Je peux vous orienter vers un conseiller Bay4Bank en transmettant le contexte de votre demande.",
    access:
      "Pour un problème d'accès, vous pouvez réinitialiser vos identifiants avec le support Bay4Bank. En cas de risque sécurité, je fais remonter le dossier.",
    loan:
      "Pour un crédit, je peux expliquer les pièces et les prochaines étapes. La décision de financement est traitée par un spécialiste.",
    savings:
      "Pour l'épargne, je peux présenter les options et préparer une demande à transmettre à un conseiller.",
    general: buildCapabilityReply(name, language),
  };

  return {
    intent,
    complexity: "simple",
    escalate: false,
    useModel: intent === "general",
    reply: replies[intent] || replies.general,
  };
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

    const { action, message, history, language, audio, mimeType } = req.body || {};
    const selectedLanguage = LANGUAGE_LABELS[language] ? language : "fr";

    if (action === "transcribe_voice") {
      const base64Audio = cleanText(audio);
      if (!base64Audio) return res.status(400).json({ error: "audio is required" });

      const buffer = Buffer.from(base64Audio, "base64");
      if (!buffer.length) return res.status(400).json({ error: "audio is empty" });
      if (buffer.length > MAX_AUDIO_BYTES) {
        return res.status(413).json({ error: "Audio trop volumineux" });
      }

      const safeMimeType = sanitizeMimeType(mimeType);
      const transcription = await transcribeAudioBuffer(buffer, safeMimeType, selectedLanguage);

      if (!transcription.text) {
        return res.status(422).json({
          error:
            "Je n'ai pas entendu de voix claire. Cliquez sur le micro, parlez deux à trois secondes, puis cliquez à nouveau pour envoyer.",
        });
      }

      return res.status(200).json({
        text: transcription.text,
        model: transcription.model,
      });
    }

    const text = cleanText(message);

    if (!text) return res.status(400).json({ error: "message is required" });

    const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
    const cleanHistory = safeHistory
      .filter(
        (entry) =>
          entry &&
          (entry.role === "user" || entry.role === "assistant") &&
          typeof entry.content === "string",
      )
      .map((entry) => ({ role: entry.role, content: entry.content }));
    const fallback = buildFallbackReply(text, cleanHistory, account, selectedLanguage);

    const profileLines = [
      `Client name: ${getFullName(account) || "not provided"}`,
      `Account ID: ${account.accountId}`,
      `Plan: ${account.planName || "Bay4Bank Everyday"}`,
      `KYC status: ${account.kycStatus}`,
      `Available balance: ${formatMoney(
        (account.financials && account.financials.availableBalanceCents) || 42075,
        selectedLanguage,
      )}`,
      `Card last 4: ${(account.financials && account.financials.cardLast4) || "4821"}`,
      `Predicted intent: ${fallback.intent}`,
      `Complexity: ${fallback.complexity}`,
      `Escalation required: ${fallback.escalate ? "yes" : "no"}`,
    ];

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Requested language: ${LANGUAGE_LABELS[selectedLanguage]}\n[Client context]\n${profileLines.join("\n")}`,
      },
      ...cleanHistory,
      { role: "user", content: text },
    ];

    if (fallback.useModel === false) {
      return res.status(200).json({
        reply: fallback.reply,
        intent: fallback.intent,
        complexity: fallback.complexity,
        escalate: fallback.escalate,
      });
    }

    try {
      const client = getClient();
      let reply = "";
      let requestSucceeded = false;

      for (const model of MODELS) {
        try {
          const response = await client.chat.completions.create({
            model,
            max_tokens: 360,
            temperature: 0.35,
            messages,
          });

          reply =
            response.choices[0] && response.choices[0].message
              ? extractAssistantText(response.choices[0].message.content)
              : "";
          requestSucceeded = true;
          break;
        } catch (error) {
          const status = readOpenAiErrorStatus(error);
          const nonRetriableStatuses = [400, 401, 403, 404, 422];
          console.error(
            "[client-chat] OpenAI model attempt failed:",
            model,
            status ? "(status " + status + ")" : "",
            error.message,
          );
          if (status && nonRetriableStatuses.includes(status)) {
            break;
          }
        }
      }

      if (!requestSucceeded) {
        throw new Error("All model attempts failed");
      }

      return res.status(200).json({
        reply: reply || fallback.reply,
        intent: fallback.intent,
        complexity: fallback.complexity,
        escalate: fallback.escalate,
      });
    } catch (error) {
      console.error("[client-chat] OpenAI error:", error.message);
      return res.status(200).json(fallback);
    }
  } catch (error) {
    console.error("[client-chat] error:", error);
    return res.status(500).json({ error: "Assistant client indisponible" });
  }
};
