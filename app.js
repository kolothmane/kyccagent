/**
 * KYC Onboarding - frontend controller
 *
 * Wires the existing three-panel UI to backend API endpoints.
 * All document intelligence (OCR / extraction) happens server-side via OpenAI.
 * Client-side: PDF->image rendering (PDF.js), image compression, UI state management.
 */
console.log("Build: KYC v2 - backend-powered");

const messages = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const fileInput = document.getElementById("file");
const profileForm = document.getElementById("profile");
const result = document.getElementById("result");
const elapsedEl = document.getElementById("elapsed");
const barEl = document.getElementById("bar");
const checklist = document.querySelector(".checklist");
const stepItems = document.querySelectorAll(".steps-list li");
const CHAT_REQUEST_TIMEOUT_MS = 12000;
const IDENTITY_DOCUMENTS =
  "passport, national ID card, or driving licence";
const ADDRESS_DOCUMENTS =
  "a recent utility bill, bank statement, council tax letter, insurance letter, or official government correspondence showing your full postal address";
const ACCEPTED_CHAT_FORMATS = "JPEG, PNG, WebP, GIF, or PDF";

let sessionId = sessionStorage.getItem("kycSessionId") || null;
let chatHistory = [];
let identityExtraction = null;
let addressExtraction = null;
let uploadedDocuments = [];
let validationErrors = [];
let validationWarnings = [];
let currentStep = "welcome"; // welcome | upload | review | confirm

const startedAt = Date.now();
setInterval(() => {
  const diff = Math.floor((Date.now() - startedAt) / 1000);
  const mm = String(Math.floor(diff / 60)).padStart(2, "0");
  const ss = String(diff % 60).padStart(2, "0");
  elapsedEl.textContent = `${mm}:${ss}`;
  barEl.style.width = Math.min(100, (diff / 180) * 100) + "%";
}, 500);

function say(text, who = "agent") {
  const d = document.createElement("div");
  d.className = `msg ${who}`;
  d.textContent = text;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
  const es = document.getElementById("emptyState");
  if (es) es.remove();
}

function ensureTypingIndicatorStyles() {
  if (document.getElementById("typingIndicatorStyles")) return;

  const style = document.createElement("style");
  style.id = "typingIndicatorStyles";
  style.textContent = `
    .msg.processing.typing{
      display:inline-flex;
      align-items:center;
      gap:6px;
      min-width:64px;
      padding:14px 16px;
    }
    .typing-dot{
      width:8px;
      height:8px;
      border-radius:50%;
      background: rgba(59, 130, 246, .85);
      display:inline-block;
      animation: typingBounce 1.1s infinite ease-in-out;
    }
    .typing-dot:nth-child(2){ animation-delay: .16s; }
    .typing-dot:nth-child(3){ animation-delay: .32s; }
    @keyframes typingBounce {
      0%, 80%, 100%{
        transform: translateY(0);
        opacity: .35;
      }
      40%{
        transform: translateY(-5px);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}

function showProcessing(label, variant = "spinner") {
  const d = document.createElement("div");
  d.className = "msg agent processing";
  d.id = "processingMsg";

  if (variant === "typing") {
    ensureTypingIndicatorStyles();
    d.classList.add("typing");
    d.setAttribute("aria-label", label || "Assistant is typing");
    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement("span");
      dot.className = "typing-dot";
      dot.setAttribute("aria-hidden", "true");
      d.appendChild(dot);
    }
  } else {
    const spin = document.createElement("span");
    spin.className = "spinner";
    spin.setAttribute("aria-hidden", "true");
    d.appendChild(spin);
    d.appendChild(document.createTextNode(" " + label));
  }

  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
  const es = document.getElementById("emptyState");
  if (es) es.remove();
  return d;
}

function removeProcessing() {
  const el = document.getElementById("processingMsg");
  if (el) el.remove();
}

function updateChecklist() {
  if (!checklist) return;
  const items = [
    {
      key: "identity",
      label: "Photo ID / Passport",
      sub: "Passport, national ID or driving licence",
    },
    {
      key: "address",
      label: "Proof of address",
      sub: "Utility bill, bank statement, tax or insurance letter (< 90 days)",
    },
  ];
  const ul = document.createElement("ul");
  ul.className = "check-items";
  items.forEach(function(item) {
    const done = uploadedDocuments.includes(item.key);
    const li = document.createElement("li");
    li.innerHTML =
      '<div class="cm">' +
      (done ? "✅" : "⬜") +
      " " +
      item.label +
      '</div><div class="cs">' +
      item.sub +
      "</div>";
    ul.appendChild(li);
  });
  checklist.innerHTML = '<div class="check-title">Document checklist</div>';
  checklist.appendChild(ul);
}

const STEPS = ["welcome", "upload", "review", "confirm"];
function setStep(step) {
  currentStep = step;
  const idx = STEPS.indexOf(step);
  stepItems.forEach(function(li, i) {
    li.classList.toggle("active", i === idx);
    li.classList.toggle("done", i < idx);
  });
}

function fillForm(r) {
  const addr = r.address || "";
  const addrParts = addr.split(",");
  const map = {
    firstName: r.firstName,
    lastName: r.lastName,
    dob: r.dateOfBirth,
    street: r.street || (addrParts[0] || "").trim(),
    city: r.city || (addrParts[1] || "").trim(),
    state: r.state || (addrParts[2] || "").trim(),
    postal: r.postal,
  };
  Object.keys(map).forEach(function(k) {
    const v = map[k];
    if (v && profileForm.elements[k]) profileForm.elements[k].value = v;
  });
  if (r.documentNumber) document.getElementById("docNumber").textContent = r.documentNumber;
  if (r.dateOfExpiry) document.getElementById("docExpiry").textContent = r.dateOfExpiry;
  if (r.nationality) document.getElementById("nationality").textContent = r.nationality;
}

function showValidationBanner(errors, warnings) {
  const existing = document.querySelectorAll(".validation-banner");
  existing.forEach(function(el) {
    el.remove();
  });
  if (errors.length === 0 && warnings.length === 0) return;
  const banner = document.createElement("div");
  const isError = errors.length > 0;
  banner.className =
    "validation-banner " + (isError ? "banner-error" : "banner-warning");
  const items = isError ? errors : warnings;
  const strong = document.createElement("strong");
  strong.textContent = isError ? "⚠ Issues found" : "ℹ Notices";
  banner.appendChild(strong);
  const ul = document.createElement("ul");
  items.forEach(function(m) {
    const li = document.createElement("li");
    li.textContent = m;
    ul.appendChild(li);
  });
  banner.appendChild(ul);
  profileForm.parentElement.insertBefore(banner, profileForm);
}

async function initSession() {
  if (sessionId) return;
  try {
    const resp = await fetch("/api/kyc/session", { method: "POST" });
    if (!resp.ok) throw new Error("session init failed");
    const data = await resp.json();
    sessionId = data.sessionId;
    sessionStorage.setItem("kycSessionId", sessionId);
  } catch (e) {
    sessionId = crypto.randomUUID();
  }
}

function normaliseText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesAny(text, patterns) {
  return patterns.some(function(pattern) {
    return text.includes(pattern);
  });
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
    "accept",
    "justificatif",
    "domicile",
    "piece d identite",
    "piece d'identite",
    "preuve d adresse",
    "preuve d'adresse",
    "pourquoi",
    "rejete",
    "refuse",
    "facture",
    "releve",
    "avis d impot",
    "courrier officiel",
  ]);
}

function wantsGreeting(message) {
  const normalized = normaliseText(message);
  return includesAny(normalized, [
    "hello",
    "hi",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
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
    "documents accepted",
    "what can i upload",
    "what do you accept",
    "document requirements",
    "proof of address",
    "proof of adress",
    "address document",
    "photo id",
    "identity document",
    "quels documents",
    "quel document",
    "quels sont les documents",
    "documents acceptes",
    "document accepte",
    "documents requis",
    "document requis",
    "justificatif de domicile",
    "preuve d adresse",
    "preuve d'adresse",
    "piece d identite",
    "piece d'identite",
    "qu est ce qui est accepte",
    "qu'est ce qui est accepte",
    "qu acceptez vous",
    "qu'acceptez vous",
  ]);
}

function wantsIdentityDocumentDetails(message) {
  const normalized = normaliseText(message);
  return includesAny(normalized, [
    "photo id",
    "identity document",
    "identity card",
    "passport",
    "national id",
    "driving licence",
    "driving license",
    "piece d identite",
    "piece d'identite",
    "carte d identite",
    "carte d'identite",
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
    "council tax",
    "insurance letter",
    "justificatif de domicile",
    "preuve d adresse",
    "preuve d'adresse",
    "facture",
    "releve bancaire",
    "avis d impot",
    "avis d'impot",
    "courrier officiel",
  ]);
}

function wantsRejectionReason(message) {
  if (!validationErrors.length) return false;
  const normalized = normaliseText(message);
  return includesAny(normalized, [
    "why was",
    "why did",
    "why rejected",
    "rejected",
    "refused",
    "refusal",
    "pourquoi",
    "rejet",
    "rejete",
    "rejetee",
    "refuse",
    "refusee",
    "raison",
  ]);
}

function buildNextStepHint(french) {
  const needsIdentity = !uploadedDocuments.includes("identity");
  const needsAddress = !uploadedDocuments.includes("address");

  if (french) {
    if (needsIdentity && needsAddress) {
      return "Le prochain document a envoyer est votre piece d'identite.";
    }
    if (needsIdentity) {
      return "Le document manquant est votre piece d'identite.";
    }
    if (needsAddress) {
      return "Le document manquant est votre justificatif de domicile.";
    }
    return "Nous avons bien recu les deux types de documents.";
  }

  if (needsIdentity && needsAddress) {
    return "Please start by uploading your identity document.";
  }
  if (needsIdentity) {
    return "The missing document is your identity document.";
  }
  if (needsAddress) {
    return "The missing document is your proof of address.";
  }
  return "Both document types have already been received.";
}

function buildLocalChatFallback(message) {
  const french = isFrenchMessage(message);
  const nextStepHint = buildNextStepHint(french);
  const wantsIdentity = wantsIdentityDocumentDetails(message);
  const wantsAddress = wantsAddressDocumentDetails(message);

  if (wantsGreeting(message)) {
    if (french) {
      return "Bonjour, je peux vous aider avec la verification KYC. " + nextStepHint;
    }
    return "Hello, I can help you with the KYC verification. " + nextStepHint;
  }

  if (wantsAcceptedDocuments(message)) {
    if (french) {
      if (wantsAddress && !wantsIdentity) {
        return (
          "Comme justificatif de domicile, nous acceptons un document recent de moins de 90 jours, par exemple une facture, un releve bancaire, un avis de taxe, une lettre d'assurance ou un courrier officiel affichant votre adresse complete. Formats acceptes: " +
          ACCEPTED_CHAT_FORMATS +
          ". " +
          nextStepHint
        );
      }
      if (wantsIdentity && !wantsAddress) {
        return (
          "Pour la piece d'identite, nous acceptons un passeport, une carte nationale d'identite ou un permis de conduire en cours de validite. Formats acceptes: " +
          ACCEPTED_CHAT_FORMATS +
          ". " +
          nextStepHint
        );
      }
      return (
        "Nous acceptons comme piece d'identite un passeport, une carte nationale d'identite ou un permis de conduire. Comme justificatif de domicile, nous acceptons un document recent de moins de 90 jours, par exemple une facture, un releve bancaire, un avis de taxe, une lettre d'assurance ou un courrier officiel avec votre adresse complete. Formats acceptes: " +
        ACCEPTED_CHAT_FORMATS +
        ". " +
        nextStepHint
      );
    }

    if (wantsAddress && !wantsIdentity) {
      return (
        "For proof of address, we accept " +
        ADDRESS_DOCUMENTS +
        ". The document should usually be dated within the last 90 days. Accepted upload formats: " +
        ACCEPTED_CHAT_FORMATS +
        ". " +
        nextStepHint
      );
    }
    if (wantsIdentity && !wantsAddress) {
      return (
        "For identity, we accept a " +
        IDENTITY_DOCUMENTS +
        ". Accepted upload formats: " +
        ACCEPTED_CHAT_FORMATS +
        ". " +
        nextStepHint
      );
    }
    return (
      "We accept a " +
      IDENTITY_DOCUMENTS +
      " for identity, plus " +
      ADDRESS_DOCUMENTS +
      " for proof of address. Proof-of-address documents should usually be dated within the last 90 days. Accepted upload formats: " +
      ACCEPTED_CHAT_FORMATS +
      ". " +
      nextStepHint
    );
  }

  if (wantsRejectionReason(message)) {
    if (french) {
      return (
        "Le dernier document a ete refuse pour la raison suivante: " +
        validationErrors.join("; ") +
        ". Merci de reenvoyer un document clair et conforme."
      );
    }
    return (
      "The last document was rejected for this reason: " +
      validationErrors.join("; ") +
      ". Please upload a clear, compliant document and try again."
    );
  }

  if (french) {
    return "Je peux vous aider pour les documents KYC, les formats acceptes et les raisons de rejet. " + nextStepHint;
  }
  return "I can help with KYC documents, accepted formats, and rejection reasons. " + nextStepHint;
}

function publishAssistantReply(reply) {
  say(reply);
  chatHistory.push({ role: "assistant", content: reply });
}

async function sendMessage(text) {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  await initSession();
  say(trimmedText, "user");
  chatHistory.push({ role: "user", content: trimmedText });
  showProcessing("Assistant is typing", "typing");

  const fallbackReply = buildLocalChatFallback(trimmedText);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(function() {
    controller.abort();
  }, CHAT_REQUEST_TIMEOUT_MS);

  let reply = fallbackReply;
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        sessionId: sessionId,
        message: trimmedText,
        history: chatHistory.slice(-20),
        context: {
          step: currentStep,
          uploadedDocuments: uploadedDocuments,
          validationErrors: validationErrors,
          validationWarnings: validationWarnings,
        },
      }),
    });
    if (!resp.ok) {
      reply = fallbackReply;
    } else {
      const data = await resp.json().catch(function() {
        return {};
      });
      reply =
        (typeof data.reply === "string" && data.reply.trim()) || fallbackReply;
    }
  } catch (e) {
    console.error("Chat error:", e);
  } finally {
    window.clearTimeout(timeoutId);
    removeProcessing();
  }

  publishAssistantReply(reply);
}

sendBtn.addEventListener("click", function(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
  const t = input.value.trim();
  if (!t) return;
  input.value = "";
  sendMessage(t);
}, true);
input.addEventListener("keydown", function(e) {
  if ((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const t = input.value.trim();
    if (!t) return;
    input.value = "";
    sendMessage(t);
  }
}, true);

async function prepareImageForUpload(file) {
  let bitmap;

  if (file.type === "application/pdf") {
    const pdfjsLib = await import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs"
    );
    if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 2.0 });
    const offscreen = document.createElement("canvas");
    offscreen.width = vp.width;
    offscreen.height = vp.height;
    await page.render({
      canvasContext: offscreen.getContext("2d"),
      viewport: vp,
    }).promise;
    bitmap = await createImageBitmap(offscreen);
  } else {
    bitmap = await createImageBitmap(file);
  }

  const MAX_DIM = 1600;
  let w = bitmap.width;
  let h = bitmap.height;
  if (w > MAX_DIM || h > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  return { base64: base64, mimeType: "image/jpeg" };
}

function guessCategory(fileName) {
  const lower = (fileName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/selfie|liveness/.test(lower)) return "selfie";
  if (
    /bill|address|utility|council|bank|statement|invoice|facture|domicile|quittance|releve|tax|taxe|impot|assurance|insurance|edf|engie|sfr|orange|free/.test(
      lower,
    )
  ) {
    return "address";
  }
  return "identity";
}

function getCategoryLabel(category) {
  if (category === "identity") return "identity document";
  if (category === "address") return "proof of address";
  return "document";
}

fileInput.addEventListener("change", async function(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;

  await initSession();
  setStep("upload");

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];
  if (!allowed.includes(f.type)) {
    say(
      "⚠️ Unsupported file type. Please upload a JPEG, PNG, WebP, or PDF document.",
    );
    return;
  }

  const documentCategory = guessCategory(f.name);
  showProcessing("Checking " + f.name + "...");

  try {
    const prepared = await prepareImageForUpload(f);
    const base64 = prepared.base64;
    const mimeType = prepared.mimeType;

    const approxBytes = Math.ceil((base64.length * 3) / 4);
    if (approxBytes > 4 * 1024 * 1024) {
      removeProcessing();
      say(
        "⚠️ The document image is too large. Please use a smaller or lower-resolution file.",
      );
      return;
    }

    const checkResp = await fetch("/api/kyc/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        fileName: f.name,
        mimeType: mimeType,
        data: base64,
      }),
    });

    removeProcessing();

    if (!checkResp.ok) {
      const err = await checkResp.json().catch(function() {
        return {};
      });
      say("⚠️ " + (err.error || "Document check failed. Please try again."));
      return;
    }

    const checkResult = await checkResp.json();

    if (!checkResult.valid) {
      const issueList =
        checkResult.issues && checkResult.issues.length
          ? checkResult.issues.join("\n• ")
          : "The document could not be accepted.";
      say(
        "❌ " +
          f.name +
          " was rejected:\n• " +
          issueList +
          "\nPlease upload a valid, clear document and try again.",
      );
      return;
    }

    const detectedCategory = checkResult.detectedCategory || documentCategory;
    if (!checkResult.detectedCategory) {
      console.warn(
        "[upload] No detectedCategory from check; falling back to filename guess:",
        documentCategory,
      );
    }
    const categoryLabel = getCategoryLabel(detectedCategory);

    if (checkResult.warnings && checkResult.warnings.length) {
      say(
        "✅ " +
          f.name +
          " looks valid (" +
          categoryLabel +
          "). Note: " +
          checkResult.warnings.join("; ") +
          ". Extracting details...",
      );
    } else {
      say(
        "✅ " +
          f.name +
          " looks valid (" +
          categoryLabel +
          "). Extracting your details...",
      );
    }

    showProcessing("Extracting details from " + f.name + "...");

    const resp = await fetch("/api/kyc/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        documentCategory: documentCategory,
        detectedCategory: detectedCategory,
        fileName: f.name,
        mimeType: mimeType,
        data: base64,
      }),
    });

    removeProcessing();

    if (!resp.ok) {
      const err = await resp.json().catch(function() {
        return {};
      });
      say("⚠️ " + (err.error || "Upload failed. Please try again."));
      return;
    }

    const uploadResult = await resp.json();
    const extraction = uploadResult.extraction;
    const validation = uploadResult.validation;
    const effectiveCategory = uploadResult.documentCategory || detectedCategory;

    if (!uploadedDocuments.includes(effectiveCategory)) uploadedDocuments.push(effectiveCategory);
    if (effectiveCategory === "identity") identityExtraction = extraction;
    if (effectiveCategory === "address") addressExtraction = extraction;

    validationErrors = validation.errors || [];
    validationWarnings = validation.warnings || [];

    updateChecklist();
    showValidationBanner(validationErrors, validationWarnings);

    if (effectiveCategory === "identity" || effectiveCategory === "address") {
      fillForm(extraction);
      setStep("review");
    }

    if (validation.passed) {
      say(
        "✅ Details extracted successfully. Please review and confirm the pre-filled details on the right.",
      );
    } else {
      say(
        "⚠️ Document processed with issues:\n" +
          validationErrors.join("\n") +
          "\nPlease re-upload a valid document or correct the details manually.",
      );
    }
  } catch (err) {
    removeProcessing();
    console.error("Upload error:", err);
    say("⚠️ An error occurred while processing your document. Please try again.");
  }
});

document.getElementById("submit").addEventListener("click", async function(e) {
  e.preventDefault();
  await initSession();
  setStep("confirm");

  const profileData = {};
  [
    "firstName",
    "lastName",
    "email",
    "phone",
    "country",
    "dob",
    "street",
    "city",
    "state",
    "postal",
  ].forEach(function(name) {
    const el = profileForm.elements[name];
    if (el) profileData[name] = el.value;
  });

  showProcessing("Submitting your application...");

  try {
    const resp = await fetch("/api/kyc/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        profileData: profileData,
        identityExtraction: identityExtraction,
        addressExtraction: addressExtraction,
      }),
    });

    removeProcessing();

    if (!resp.ok) {
      const err = await resp.json().catch(function() {
        return {};
      });
      say("⚠️ Submission failed: " + (err.error || "please try again."));
      return;
    }

    const subResult = await resp.json();
    const recon = subResult.reconciliation || {};

    if (subResult.status === "approved") {
      result.textContent =
        "✅ Application submitted and pre-approved. You'll receive confirmation by email shortly.";
      say("Your identity has been verified and your application submitted. Welcome aboard!");
    } else {
      result.textContent =
        "📋 Application submitted - pending manual review. Our team will contact you within 1-2 business days.";
      say(
        "Your application has been submitted for review. Our compliance team will be in touch within 1-2 business days.",
      );
    }

    if (recon.suspiciousSignals && recon.suspiciousSignals.length > 0) {
      say("Note: " + recon.suspiciousSignals.join(". "));
    }
  } catch (err) {
    removeProcessing();
    console.error("Submit error:", err);
    say("⚠️ Submission failed due to a network error. Please try again.");
  }
});

(async function() {
  updateChecklist();
  await initSession();
  say(
    "👋 Welcome to DEMO! I'll guide you through verifying your identity. Please upload your photo ID and a recent proof of address - I'll extract your details automatically. Ready to begin?",
  );
})();
