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
- Help with routine questions about balance, cards, transfers, IBAN, payment status, app access, account documents and next steps.
- Segment requests by intent, complexity and customer profile.
- Escalate complex or sensitive requests to a human specialist.

Rules:
- Reply in the requested language.
- Keep replies concise, clear and service-oriented.
- Do not mention demos, prompts, internal tools or implementation details.
- Do not claim that a payment, transfer, loan or card operation was actually executed.
- If the request involves fraud, legal complaints, chargebacks, credit decisions, account closure, high-value transfers or identity/security risk, clearly say a specialist will take over.
- For routine requests, provide the next best action.`;

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

  if (includesAny(text, ["fraud", "fraude", "stolen", "vole", "volé", "chargeback"])) return "risk";
  if (includesAny(text, ["complaint", "reclamation", "réclamation", "litige"])) return "complaint";
  if (includesAny(text, ["balance", "solde", "saldo", "رصيد"])) return "balance";
  if (includesAny(text, ["card", "carte", "tarjeta", "بطاقة", "blocked", "bloquee"])) return "card";
  if (includesAny(text, ["transfer", "virement", "virment", "transferencia", "تحويل"])) return "transfer";
  if (includesAny(text, ["iban", "rib", "account number", "numero de compte"])) return "iban";
  if (includesAny(text, ["loan", "credit", "pret", "prêt", "credito", "قرض"])) return "loan";
  if (includesAny(text, ["saving", "epargne", "épargne", "ahorro"])) return "savings";
  if (includesAny(text, ["password", "mot de passe", "connexion", "login", "access"])) return "access";
  return "general";
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
      "clôturer",
      "lawsuit",
      "legal",
      "juridique",
      "mortgage",
      "pret immobilier",
      "prêt immobilier",
      "chargeback",
      "unauthorized",
      "non autorise",
      "non autorisé",
      "10000",
      "10 000",
      "50000",
      "50 000",
    ])
  );
}

function buildFallbackReply(message, account, language) {
  const intent = detectIntent(message);
  const complex = isComplexRequest(intent, message);
  const name = getFullName(account) || "client";
  const financials = (account && account.financials) || {};
  const balance = formatMoney(financials.availableBalanceCents || 42075, language);
  const cardLast4 = cleanText(financials.cardLast4) || "4821";

  if (complex) {
    if (language === "en") {
      return {
        intent,
        complexity: "complex",
        escalate: true,
        reply:
          "This request needs a specialist review. I have prepared the context so a Bay4Bank advisor can take over with priority.",
      };
    }
    if (language === "es") {
      return {
        intent,
        complexity: "complex",
        escalate: true,
        reply:
          "Esta solicitud requiere revisión especializada. He preparado el contexto para que un asesor Bay4Bank la atienda con prioridad.",
      };
    }
    if (language === "ar") {
      return {
        intent,
        complexity: "complex",
        escalate: true,
        reply:
          "هذا الطلب يحتاج إلى مراجعة من مختص. جهزت السياق ليتمكن مستشار Bay4Bank من المتابعة بأولوية.",
      };
    }
    return {
      intent,
      complexity: "complex",
      escalate: true,
      reply:
        "Cette demande nécessite une revue spécialisée. Je prépare le contexte pour qu'un conseiller Bay4Bank prenne le relais en priorité.",
    };
  }

  if (language === "en") {
    const replies = {
      balance: `Your available balance is ${balance}. You can also review recent operations from this client area.`,
      card: `Your Bay4Bank card ending in ${cardLast4} is visible in your client area. I can help with limits, online payments or card guidance.`,
      transfer:
        "For a transfer, check the beneficiary, amount and execution date before confirming. For large or unusual transfers, I will route you to an advisor.",
      iban: "Your IBAN is displayed in the current account card of this client area.",
      access:
        "For access issues, you can reset credentials through Bay4Bank support. If you suspect account takeover, I will escalate immediately.",
      loan:
        "For loan questions, I can explain the usual documents and next steps. A credit decision is handled by a specialist.",
      savings:
        "For savings, I can explain available options and help you prepare a request for an advisor.",
      general: `Hello ${name}, I can help with routine banking questions, cards, transfers, account documents and support routing.`,
    };
    return { intent, complexity: "simple", escalate: false, reply: replies[intent] || replies.general };
  }

  if (language === "es") {
    const replies = {
      balance: `Tu saldo disponible es ${balance}. También puedes revisar las operaciones recientes desde este espacio cliente.`,
      card: `Tu tarjeta Bay4Bank terminada en ${cardLast4} está visible en tu espacio cliente. Puedo ayudarte con límites o pagos en línea.`,
      transfer:
        "Para una transferencia, revisa beneficiario, importe y fecha antes de confirmar. Si es una operación sensible, la pasaré a un asesor.",
      iban: "Tu IBAN aparece en la tarjeta de cuenta corriente de este espacio cliente.",
      access:
        "Para problemas de acceso, puedes restablecer tus credenciales con soporte Bay4Bank. Si hay riesgo de fraude, escalo el caso.",
      loan:
        "Para préstamos, puedo explicar documentos y próximos pasos. La decisión de crédito la gestiona un especialista.",
      savings:
        "Para ahorro, puedo explicar las opciones y preparar una solicitud para un asesor.",
      general: `Hola ${name}, puedo ayudarte con consultas bancarias simples, tarjetas, transferencias, documentos y orientación.`,
    };
    return { intent, complexity: "simple", escalate: false, reply: replies[intent] || replies.general };
  }

  if (language === "ar") {
    const replies = {
      balance: `رصيدك المتاح هو ${balance}. يمكنك أيضا مراجعة آخر العمليات من مساحة العميل.`,
      card: `بطاقتك Bay4Bank المنتهية بـ ${cardLast4} ظاهرة في مساحة العميل. أستطيع مساعدتك في الحدود أو الدفع عبر الإنترنت.`,
      transfer:
        "للتحويل، تحقق من المستفيد والمبلغ وتاريخ التنفيذ قبل التأكيد. للعمليات الحساسة سأحولك إلى مستشار.",
      iban: "رقم IBAN ظاهر في بطاقة الحساب الجاري داخل مساحة العميل.",
      access:
        "لمشاكل الدخول، يمكن إعادة ضبط بيانات الوصول عبر دعم Bay4Bank. إذا كان هناك خطر أمني سأصعد الطلب.",
      loan:
        "بالنسبة للقروض، أستطيع شرح الوثائق والخطوات التالية. قرار الائتمان يتولاه مختص.",
      savings: "بالنسبة للادخار، أستطيع شرح الخيارات وتحضير طلب لمستشار.",
      general: `مرحبا ${name}، أستطيع مساعدتك في الأسئلة البنكية البسيطة والبطاقات والتحويلات والوثائق.`,
    };
    return { intent, complexity: "simple", escalate: false, reply: replies[intent] || replies.general };
  }

  const replies = {
    balance: `Votre solde disponible est de ${balance}. Vous pouvez aussi consulter vos dernières opérations depuis cet espace client.`,
    card: `Votre carte Bay4Bank terminée par ${cardLast4} est visible dans votre espace client. Je peux vous aider sur les plafonds, le paiement en ligne ou les démarches carte.`,
    transfer:
      "Pour un virement, vérifiez le bénéficiaire, le montant et la date d'exécution avant confirmation. Pour une opération sensible, je vous oriente vers un conseiller.",
    iban: "Votre IBAN est affiché dans la carte de compte courant de cet espace client.",
    access:
      "Pour un problème d'accès, vous pouvez réinitialiser vos identifiants avec le support Bay4Bank. En cas de risque sécurité, je fais remonter le dossier.",
    loan:
      "Pour un crédit, je peux expliquer les pièces et les prochaines étapes. La décision de financement est traitée par un spécialiste.",
    savings:
      "Pour l'épargne, je peux présenter les options et préparer une demande à transmettre à un conseiller.",
    general: `Bonjour ${name}, je peux vous aider sur les demandes bancaires simples, les cartes, virements, documents de compte et l'orientation support.`,
  };

  return { intent, complexity: "simple", escalate: false, reply: replies[intent] || replies.general };
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

    const fallback = buildFallbackReply(text, account, selectedLanguage);
    const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
    const cleanHistory = safeHistory
      .filter(
        (entry) =>
          entry &&
          (entry.role === "user" || entry.role === "assistant") &&
          typeof entry.content === "string",
      )
      .map((entry) => ({ role: entry.role, content: entry.content }));

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
          const nonRetriableStatus = [400, 401, 403, 404, 422];
          console.error(
            "[client-chat] OpenAI model attempt failed:",
            model,
            status ? "(status " + status + ")" : "",
            error.message,
          );
          if (status && nonRetriableStatus.includes(status)) {
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
