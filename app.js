/**
 * KYC frontend controller (brandable)
 *
 * Keeps the manual KYC flow fully functional on the page while exposing the
 * same assistant through a floating widget.
 */
const BRAND = (window.BRANDING && window.BRANDING.name) || "VeriNova";
console.log("Build: " + BRAND + " KYC - Bot-Baybridge inspired UI");

const messages = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const fileInput = document.getElementById("file");
const fileChips = document.getElementById("fileChips");
const profileForm = document.getElementById("profile");
const result = document.getElementById("result");
const elapsedEl = document.getElementById("elapsed");
const barEl = document.getElementById("bar");
const checklist = document.querySelector(".checklist");
const activityFeed = document.getElementById("activityFeed");
const activityEmpty = document.getElementById("activityEmpty");
const pageStatus = document.getElementById("pageStatus");
const uploadButton = document.querySelector('label[for="file"]');
const stepItems = document.querySelectorAll(".steps-list li");
const chatLauncher = document.getElementById("chatLauncher");
const chatUnread = document.getElementById("chatUnread");
const chatShell = document.getElementById("chatShell");
const chatStatus = document.getElementById("chatStatus");
const chatMenuBtn = document.getElementById("chatMenuBtn");
const chatMenu = document.getElementById("chatMenu");
const chatOpenManualBtn = document.getElementById("chatOpenManual");
const chatCloseActionBtn = document.getElementById("chatCloseAction");
const chatAttachBtn = document.getElementById("chatAttachBtn");
const chatMinimizeBtn = document.getElementById("chatMinimize");
const chatCloseBtn = document.getElementById("chatClose");
const openChatButtons = document.querySelectorAll("[data-open-chat]");

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
let currentStep = "welcome";
let recentFiles = [];
let chatIsOpen = false;
let chatIsMinimized = false;
let chatHasWelcomed = false;

const startedAt = Date.now();
if (elapsedEl && barEl) {
  setInterval(() => {
    const diff = Math.floor((Date.now() - startedAt) / 1000);
    const mm = String(Math.floor(diff / 60)).padStart(2, "0");
    const ss = String(diff % 60).padStart(2, "0");
    elapsedEl.textContent = `${mm}:${ss}`;
    barEl.style.width = Math.min(100, (diff / 180) * 100) + "%";
  }, 500);
}

function scrollMessages() {
  if (messages) messages.scrollTop = messages.scrollHeight;
}

function ensureUploadFeedback() {
  let feedback = document.getElementById("uploadFeedback");
  if (feedback || !uploadButton) return feedback;

  feedback = document.createElement("div");
  feedback.id = "uploadFeedback";
  feedback.className = "upload-feedback";
  feedback.hidden = true;
  uploadButton.insertAdjacentElement("afterend", feedback);
  return feedback;
}

function setUploadFeedback(message, tone = "error") {
  const feedback = ensureUploadFeedback();
  if (!feedback) return;

  if (!message) {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.className = "upload-feedback";
    return;
  }

  feedback.hidden = false;
  feedback.textContent = message;
  feedback.className =
    "upload-feedback " +
    (tone === "success"
      ? "upload-feedback-success"
      : tone === "warning"
        ? "upload-feedback-warning"
        : "upload-feedback-error");
}

function clearUploadFeedback() {
  setUploadFeedback("");
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

function inferActivityTone(text) {
  const normalized = normaliseText(text);

  if (
    includesAny(normalized, [
      "rejected",
      "failed",
      "error",
      "issue",
      "refuse",
      "rejete",
      "submission failed",
      "network error",
    ])
  ) {
    return "error";
  }

  if (
    includesAny(normalized, [
      "accepted",
      "successfully",
      "submitted",
      "approved",
      "accepted as",
      "extracted",
      "accepte",
      "soumis",
    ])
  ) {
    return "success";
  }

  if (
    includesAny(normalized, [
      "warning",
      "notice",
      "pending",
      "review",
      "manual review",
      "issue",
    ])
  ) {
    return "warning";
  }

  return "info";
}

function addActivityItem(text, tone) {
  if (!activityFeed) return;
  if (activityEmpty) activityEmpty.remove();

  const item = document.createElement("div");
  item.className = "activity-item";

  if (tone === "success") item.classList.add("is-success");
  if (tone === "error") item.classList.add("is-error");
  if (tone === "warning") item.classList.add("is-warning");

  item.textContent = text;
  activityFeed.appendChild(item);
}

function say(text, who = "agent", options = {}) {
  if (!messages) return;

  const d = document.createElement("div");
  d.className = `msg ${who}`;
  d.textContent = text;
  messages.appendChild(d);

  const emptyState = document.getElementById("emptyState");
  if (emptyState) emptyState.remove();
  scrollMessages();

  if (options.mirrorActivity) {
    addActivityItem(text, options.tone || inferActivityTone(text));
  }

  if (who !== "user" && !chatIsOpen && chatUnread) {
    chatUnread.hidden = false;
  }
}

function setPageStatus(label) {
  if (!pageStatus) return;

  if (!label) {
    pageStatus.hidden = true;
    pageStatus.textContent = "";
    return;
  }

  pageStatus.hidden = false;
  pageStatus.textContent = label;
}

function showProcessing(label, variant = "spinner") {
  removeProcessing();

  if (!messages) return null;

  const d = document.createElement("div");
  d.className = "msg agent processing";
  d.id = "processingMsg";

  if (variant === "typing") {
    d.classList.add("typing");
    const bubble = document.createElement("div");
    bubble.className = "typing-bubble";

    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement("span");
      dot.className = "typing-dot";
      dot.setAttribute("aria-hidden", "true");
      bubble.appendChild(dot);
    }

    d.appendChild(bubble);
  } else {
    const spin = document.createElement("span");
    spin.className = "spinner";
    spin.setAttribute("aria-hidden", "true");
    d.appendChild(spin);
    d.appendChild(document.createTextNode(" " + label));
    setPageStatus(label);
  }

  messages.appendChild(d);
  scrollMessages();
  return d;
}

function removeProcessing() {
  const el = document.getElementById("processingMsg");
  if (el) el.remove();
  setPageStatus("");
}

function updateChatShell() {
  if (!chatShell || !chatLauncher) return;

  if (!chatIsOpen) {
    chatShell.hidden = true;
    chatShell.classList.remove("is-minimized");
    chatLauncher.hidden = false;
    if (chatMenu) chatMenu.hidden = true;
    return;
  }

  chatShell.hidden = false;
  chatLauncher.hidden = true;
  chatShell.classList.toggle("is-minimized", chatIsMinimized);

  if (chatUnread) chatUnread.hidden = true;

  if (chatStatus) {
    chatStatus.textContent = "En ligne";
  }

  if (!chatIsMinimized && input) {
    window.setTimeout(() => input.focus(), 120);
  }
}

function closeChatMenu() {
  if (chatMenu) chatMenu.hidden = true;
}

function toggleChatMenu() {
  if (!chatMenu) return;
  chatMenu.hidden = !chatMenu.hidden;
}

function ensureChatWelcome() {
  if (chatHasWelcomed) return;
  chatHasWelcomed = true;

  if (messages && messages.querySelector(".msg")) return;

  const welcome =
    "Bonjour, je suis votre assistant de verification d'identite " +
    BRAND +
    ". Je peux vous guider sur les documents acceptes, l'envoi depuis le chat et le statut de votre dossier.";

  say(welcome, "agent", { mirrorActivity: false, tone: "info" });
  chatHistory.push({ role: "assistant", content: welcome });
}

function openChat() {
  chatIsOpen = true;
  chatIsMinimized = false;
  closeChatMenu();
  updateChatShell();
  ensureChatWelcome();
}

function closeChat() {
  chatIsOpen = false;
  chatIsMinimized = false;
  closeChatMenu();
  updateChatShell();
}

function toggleChatMinimize() {
  if (!chatIsOpen) return;
  chatIsMinimized = !chatIsMinimized;
  updateChatShell();
}

function updateFileChips(fileName) {
  if (!fileChips || !fileName) return;

  recentFiles = [fileName]
    .concat(recentFiles.filter((name) => name !== fileName))
    .slice(0, 3);

  fileChips.innerHTML = "";

  recentFiles.forEach(function(name) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = name;
    fileChips.appendChild(chip);
  });
}

function updateChecklist() {
  if (!checklist) return;

  const items = [
    {
      key: "identity",
      label: "Piece d'identite",
      sub: "Passeport, carte nationale d'identite ou permis de conduire",
    },
    {
      key: "address",
      label: "Justificatif de domicile",
      sub: "Facture, releve bancaire, courrier fiscal ou lettre d'assurance",
    },
  ];

  const ul = document.createElement("ul");
  ul.className = "check-items";

  items.forEach(function(item) {
    const done = uploadedDocuments.includes(item.key);
    const li = document.createElement("li");

    li.innerHTML =
      '<div class="check-row">' +
      '<span class="check-label">' +
      item.label +
      "</span>" +
      '<span class="check-state ' +
      (done ? "done" : "pending") +
      '">' +
      (done ? "Complet" : "En attente") +
      "</span>" +
      "</div>" +
      '<div class="check-sub">' +
      item.sub +
      "</div>";

    ul.appendChild(li);
  });

  checklist.innerHTML = '<div class="check-title">Checklist documentaire</div>';
  checklist.appendChild(ul);
}

function setStep(step) {
  currentStep = step;
  const steps = ["welcome", "upload", "review", "confirm"];
  const idx = steps.indexOf(step);

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

  if (r.documentNumber) {
    document.getElementById("docNumber").textContent = r.documentNumber;
  }
  if (r.dateOfExpiry) {
    document.getElementById("docExpiry").textContent = r.dateOfExpiry;
  }
  if (r.nationality) {
    document.getElementById("nationality").textContent = r.nationality;
  }
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
  strong.textContent = isError ? "Points a corriger" : "Informations";
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
    return "Les deux types de documents ont deja ete recus.";
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
      return (
        "Bonjour, je peux vous aider avec la verification d'identite " + BRAND + ". " +
        nextStepHint
      );
    }
    return (
      "Hello, I can help you with the " + BRAND + " identity verification. " +
      nextStepHint
    );
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
    return (
      "Je peux vous aider pour les documents KYC, les formats acceptes et les raisons de rejet. " +
      nextStepHint
    );
  }
  return (
    "I can help with KYC documents, accepted formats and rejection reasons. " +
    nextStepHint
  );
}

function publishAssistantReply(reply) {
  say(reply, "agent", { mirrorActivity: false, tone: "info" });
  chatHistory.push({ role: "assistant", content: reply });
}

async function sendMessage(text) {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  openChat();

  say(trimmedText, "user", { mirrorActivity: false });
  chatHistory.push({ role: "user", content: trimmedText });
  showProcessing("L'assistant redige sa reponse", "typing");

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

    if (resp.ok) {
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
  if (category === "identity") return "piece d'identite";
  if (category === "address") return "justificatif de domicile";
  return "document";
}

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

if (chatLauncher) {
  chatLauncher.addEventListener("click", openChat);
}

openChatButtons.forEach(function(button) {
  button.addEventListener("click", openChat);
});

if (chatMenuBtn) {
  chatMenuBtn.addEventListener("click", function(event) {
    event.stopPropagation();
    toggleChatMenu();
  });
}

if (chatOpenManualBtn) {
  chatOpenManualBtn.addEventListener("click", function() {
    closeChatMenu();
    const section = document.getElementById("manual-kyc");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (chatCloseActionBtn) {
  chatCloseActionBtn.addEventListener("click", function() {
    closeChatMenu();
    closeChat();
  });
}

if (chatAttachBtn && fileInput) {
  chatAttachBtn.addEventListener("click", function() {
    openChat();
    fileInput.click();
  });
}

window.addEventListener("click", function(event) {
  if (!chatMenu || chatMenu.hidden) return;
  if (chatMenu.contains(event.target)) return;
  if (chatMenuBtn && chatMenuBtn.contains(event.target)) return;
  closeChatMenu();
});

if (chatMinimizeBtn) {
  chatMinimizeBtn.addEventListener("click", toggleChatMinimize);
}

if (chatCloseBtn) {
  chatCloseBtn.addEventListener("click", closeChat);
}

if (sendBtn) {
  sendBtn.addEventListener("click", function(e) {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    input.value = "";
    sendMessage(t);
  });
}

if (input) {
  input.addEventListener("keydown", function(e) {
    if ((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey) {
      e.preventDefault();
      const t = input.value.trim();
      if (!t) return;
      input.value = "";
      sendMessage(t);
    }
  });
}

if (fileInput) {
  fileInput.addEventListener("change", async function(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    clearUploadFeedback();
    await initSession();
    setStep("upload");
    updateFileChips(f.name);

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];

    if (!allowed.includes(f.type)) {
      const formatMessage =
        "Format non pris en charge. Merci d'envoyer un document JPEG, PNG, WebP ou PDF.";
      setUploadFeedback(formatMessage, "error");
      say(formatMessage, "agent", {
        mirrorActivity: true,
        tone: "error",
      });
      return;
    }

    const documentCategory = guessCategory(f.name);
    showProcessing("Verification de " + f.name + "...");

    try {
      const prepared = await prepareImageForUpload(f);
      const base64 = prepared.base64;
      const mimeType = prepared.mimeType;

      const approxBytes = Math.ceil((base64.length * 3) / 4);
      if (approxBytes > 4 * 1024 * 1024) {
        removeProcessing();
        const tooLargeMessage =
          "Le document est trop volumineux. Merci d'utiliser un fichier plus leger ou une image moins lourde.";
        setUploadFeedback(tooLargeMessage, "error");
        say(tooLargeMessage, "agent", {
          mirrorActivity: true,
          tone: "error",
        });
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
        const checkErrorMessage =
          err.error || "La verification du document a echoue. Merci de reessayer.";
        setUploadFeedback(checkErrorMessage, "error");
        say(checkErrorMessage, "agent", {
          mirrorActivity: true,
          tone: "error",
        });
        return;
      }

      const checkResult = await checkResp.json();

      if (!checkResult.valid) {
        const issueList =
          checkResult.issues && checkResult.issues.length
            ? checkResult.issues.join(" ")
            : "The document could not be accepted.";

        const rejectionMessage =
          "Document refuse : " +
          issueList +
          " Merci d'envoyer un document clair et conforme.";

        setUploadFeedback(rejectionMessage, "error");
        say(
          "Document refuse :\n" +
            issueList +
            "\nMerci d'envoyer un document clair et conforme.",
          "agent",
          { mirrorActivity: true, tone: "error" },
        );
        return;
      }

      const detectedCategory = checkResult.detectedCategory || documentCategory;
      const categoryLabel = getCategoryLabel(detectedCategory);

      if (checkResult.warnings && checkResult.warnings.length) {
        setUploadFeedback(
          "Document accepte comme " +
            categoryLabel +
            ". Verification terminee avec remarques.",
          "warning",
        );
        say(
          "Document accepte comme " +
            categoryLabel +
            ". Notes : " +
            checkResult.warnings.join("; ") +
            ". Extraction des informations en cours.",
          "agent",
          { mirrorActivity: true, tone: "warning" },
        );
      } else {
        setUploadFeedback(
          "Document accepte comme " + categoryLabel + ".",
          "success",
        );
        say(
          "Document accepte comme " +
            categoryLabel +
            ". Extraction des informations en cours.",
          "agent",
          { mirrorActivity: true, tone: "success" },
        );
      }

      showProcessing("Extraction des informations depuis " + f.name + "...");

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
        const uploadErrorMessage =
          err.error || "Le televersement a echoue. Merci de reessayer.";
        setUploadFeedback(uploadErrorMessage, "error");
        say(uploadErrorMessage, "agent", {
          mirrorActivity: true,
          tone: "error",
        });
        return;
      }

      const uploadResult = await resp.json();
      const extraction = uploadResult.extraction;
      const validation = uploadResult.validation;
      const effectiveCategory = uploadResult.documentCategory || detectedCategory;

      if (!uploadedDocuments.includes(effectiveCategory)) {
        uploadedDocuments.push(effectiveCategory);
      }
      if (effectiveCategory === "identity") identityExtraction = extraction;
      if (effectiveCategory === "address") addressExtraction = extraction;

      validationErrors = validation.errors || [];
      validationWarnings = validation.warnings || [];

      updateChecklist();
      showValidationBanner(validationErrors, validationWarnings);

      if (
        effectiveCategory === "identity" ||
        effectiveCategory === "address"
      ) {
        fillForm(extraction);
        setStep("review");
      }

      if (validation.passed) {
        setUploadFeedback(
          "Informations extraites avec succes. Le formulaire a ete rempli automatiquement.",
          "success",
        );
        say(
          "Informations extraites avec succes. Le formulaire a ete rempli automatiquement. Verifiez les champs puis soumettez le dossier quand vous etes pret.",
          "agent",
          { mirrorActivity: true, tone: "success" },
        );
      } else {
        const validationMessage =
          "Le document a ete traite avec des points de vigilance : " +
          validationErrors.join(" ") +
          " Merci de renvoyer un document valide ou de corriger manuellement les informations.";
        setUploadFeedback(validationMessage, "warning");
        say(
          "Le document a ete traite avec des points de vigilance :\n" +
            validationErrors.join("\n") +
            "\nMerci de renvoyer un document valide ou de corriger manuellement les informations.",
          "agent",
          { mirrorActivity: true, tone: "warning" },
        );
      }
    } catch (err) {
      removeProcessing();
      console.error("Upload error:", err);
      const genericErrorMessage =
        "Une erreur est survenue pendant le traitement du document. Merci de reessayer.";
      setUploadFeedback(genericErrorMessage, "error");
      say(genericErrorMessage, "agent", {
        mirrorActivity: true,
        tone: "error",
      });
    }
  });
}

const submitBtn = document.getElementById("submit");
if (submitBtn) {
  submitBtn.addEventListener("click", async function(e) {
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

    showProcessing("Soumission du dossier en cours...");

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
        say("La soumission a echoue : " + (err.error || "merci de reessayer."), "agent", {
          mirrorActivity: true,
          tone: "error",
        });
        return;
      }

      const subResult = await resp.json();
      const recon = subResult.reconciliation || {};

      if (subResult.status === "approved") {
        result.textContent =
          "Dossier soumis et pre-approuve. Une confirmation vous sera envoyee par email.";
        say(
          "Votre identite a ete verifiee et votre dossier a bien ete soumis.",
          "agent",
          { mirrorActivity: true, tone: "success" },
        );
      } else {
        result.textContent =
          "Dossier soumis et en attente de revue manuelle. Notre equipe reviendra vers vous sous 1 a 2 jours ouvrables.";
        say(
          "Votre dossier a ete transmis pour revue. Notre equipe conformite vous contactera sous 1 a 2 jours ouvrables.",
          "agent",
          { mirrorActivity: true, tone: "warning" },
        );
      }

      if (recon.suspiciousSignals && recon.suspiciousSignals.length > 0) {
        say("Notes de revue :\n" + recon.suspiciousSignals.join("\n"), "agent", {
          mirrorActivity: true,
          tone: "warning",
        });
      }
    } catch (err) {
      removeProcessing();
      console.error("Submit error:", err);
      say(
        "La soumission a echoue a cause d'une erreur reseau. Merci de reessayer.",
        "agent",
        { mirrorActivity: true, tone: "error" },
      );
    }
  });
}

(async function init() {
  updateChecklist();
  setStep("welcome");
  updateChatShell();
  ensureUploadFeedback();
  await initSession();
})();

// Demo animation for the visual KYC process section
function startDemoProcess() {
  const steps = Array.from(document.querySelectorAll('.process-step'));
  if (!steps.length) return;

  // reset state
  steps.forEach(function(s){ s.classList.remove('is-active', 'is-done'); });
  setStep('welcome');

  const map = {
    0: 'welcome',
    1: 'upload',
    2: 'review',
    3: 'review',
    4: 'confirm'
  };

  let i = 0;
  const tick = function() {
    steps.forEach(function(s, idx){
      s.classList.toggle('is-active', idx === i);
      s.classList.toggle('is-done', idx < i);
    });
    const stepKey = map[i] || 'confirm';
    setStep(stepKey);
    i += 1;
    if (i < steps.length) {
      window.setTimeout(tick, 1100);
    } else {
      // finish state
      window.setTimeout(function(){
        steps.forEach(function(s){ s.classList.remove('is-active'); s.classList.add('is-done'); });
      }, 800);
    }
  };

  tick();
}

const demoBtn = document.getElementById('startDemo');
if (demoBtn) {
  demoBtn.addEventListener('click', function(){
    const sec = document.getElementById('kyc-process');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(startDemoProcess, 400);
  });
}
