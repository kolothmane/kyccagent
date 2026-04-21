/**
 * Northstar onboarding controller
 *
 * Simulates a premium business-account opening flow:
 * account creation -> KYC upload -> review -> fake CRM activation logs.
 */
const BRAND = (window.BRANDING && window.BRANDING.name) || "Northstar";
const SERVICE_LINE = (window.BRANDING && window.BRANDING.serviceLine) || "Treasury OS";
console.log("Build: " + BRAND + " onboarding + KYC + CRM simulation");

const ACCOUNT_STORAGE_KEY = "northstarAccountState";
const CHAT_REQUEST_TIMEOUT_MS = 12000;
const ACCEPTED_CHAT_FORMATS = "JPEG, PNG, WebP, GIF, or PDF";
const IDENTITY_DOCUMENTS = "passport, national ID card, or driving licence";
const ADDRESS_DOCUMENTS =
  "a recent utility bill, bank statement, council tax letter, insurance letter, or official government correspondence showing your full postal address";

const messages = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const fileInput = document.getElementById("file");
const uploadButton = document.querySelector('label[for="file"]');
const fileChips = document.getElementById("fileChips");
const profileForm = document.getElementById("profile");
const result = document.getElementById("result");
const elapsedEl = document.getElementById("elapsed");
const barEl = document.getElementById("bar");
const checklist = document.querySelector(".checklist");
const pageStatus = document.getElementById("pageStatus");
const submitBtn = document.getElementById("submit");
const kycGate = document.getElementById("kycGate");

const accountForm = document.getElementById("accountForm");
const createAccountBtn = document.getElementById("createAccountBtn");
const accountFormMessage = document.getElementById("accountFormMessage");
const accountStatus = document.getElementById("accountStatus");

const crmFeed = document.getElementById("crmFeed");
const crmEmpty = document.getElementById("crmEmpty");
const crmStatus = document.getElementById("crmStatus");
const journeyItems = document.querySelectorAll("[data-journey-step]");

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

let sessionId = sessionStorage.getItem("kycSessionId") || null;
let accountState = readStoredJson(sessionStorage.getItem(ACCOUNT_STORAGE_KEY));
let journeyFinished = Boolean(accountState && accountState.kycStatus);
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
let crmTimers = [];

const startedAt = Date.now();
if (elapsedEl && barEl) {
  setInterval(() => {
    const diff = Math.floor((Date.now() - startedAt) / 1000);
    const mm = String(Math.floor(diff / 60)).padStart(2, "0");
    const ss = String(diff % 60).padStart(2, "0");
    elapsedEl.textContent = `${mm}:${ss}`;
    barEl.style.width = Math.min(100, (diff / 240) * 100) + "%";
  }, 500);
}

function readStoredJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function persistAccountState() {
  if (accountState) {
    sessionStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accountState));
  } else {
    sessionStorage.removeItem(ACCOUNT_STORAGE_KEY);
  }
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, function(match) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[match];
  });
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

function generateId(prefix) {
  const base =
    window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10);
  return prefix + "_" + base;
}

function pickOwner(country) {
  const managers = [
    "Maya Laurent",
    "Noah Carter",
    "Camille Bernard",
    "Amir Patel",
  ];
  const normalized = normaliseText(country);
  const index = normalized.length % managers.length;
  return managers[index];
}

function scrollMessages() {
  if (messages) messages.scrollTop = messages.scrollHeight;
}

function setInlineFeedback(message, tone) {
  if (!accountFormMessage) return;

  accountFormMessage.className = "inline-feedback";
  if (tone) {
    accountFormMessage.classList.add("is-" + tone);
  }
  accountFormMessage.textContent = message || "";
}

function setCrmStatus(label, tone) {
  if (!crmStatus) return;

  crmStatus.className = "status-badge " + (tone || "neutral");
  crmStatus.textContent = label || "En attente";
}

function clearCrmTimers() {
  crmTimers.forEach(function(timer) {
    window.clearTimeout(timer);
  });
  crmTimers = [];
}

function renderCrmLog(log) {
  if (!crmFeed) return;
  if (crmEmpty) crmEmpty.hidden = true;

  const item = document.createElement("article");
  item.className = "crm-item";

  const time = new Date(log.timestamp || Date.now());
  const displayTime = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);

  item.innerHTML =
    '<div class="crm-dot"></div>' +
    "<div>" +
    '<div class="crm-meta">' +
    "<strong>" +
    escapeHtml(log.label) +
    "</strong>" +
    "<span>" +
    escapeHtml(log.system || "CRM") +
    "</span>" +
    "</div>" +
    "<p>" +
    escapeHtml(log.detail) +
    "</p>" +
    "<time>" +
    escapeHtml(displayTime) +
    "</time>" +
    "</div>";

  crmFeed.appendChild(item);
}

function runCrmSimulation(simulation) {
  clearCrmTimers();
  if (!crmFeed) return;

  crmFeed.innerHTML = "";
  if (crmEmpty) crmEmpty.hidden = true;

  const events = Array.isArray(simulation && simulation.events)
    ? simulation.events
    : [];

  if (!events.length) {
    setCrmStatus("Aucun log", "neutral");
    return;
  }

  setCrmStatus("Synchronisation", "pending");

  events.forEach(function(event, index) {
    const timer = window.setTimeout(function() {
      renderCrmLog(event);

      if (index === events.length - 1) {
        setCrmStatus(
          simulation.statusLabel || "CRM synchronise",
          simulation.statusTone || "success",
        );
      }
    }, index * 480);

    crmTimers.push(timer);
  });
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

function setUploadFeedback(message, tone) {
  const feedback = ensureUploadFeedback();
  if (!feedback) return;

  feedback.className = "upload-feedback";
  if (!message) {
    feedback.hidden = true;
    feedback.textContent = "";
    return;
  }

  feedback.hidden = false;
  feedback.textContent = message;

  if (tone === "success") feedback.classList.add("upload-feedback-success");
  if (tone === "warning") feedback.classList.add("upload-feedback-warning");
  if (tone === "error") feedback.classList.add("upload-feedback-error");
}

function clearUploadFeedback() {
  setUploadFeedback("", "error");
}

function addActivityItem() {
  // Intentionally left minimal: the premium experience uses the CRM timeline
  // instead of a second generic activity feed.
}

function say(text, who = "agent", options = {}) {
  if (!messages) return;

  const bubble = document.createElement("div");
  bubble.className = "msg " + who;
  bubble.textContent = text;
  messages.appendChild(bubble);

  const emptyState = document.getElementById("emptyState");
  if (emptyState) emptyState.remove();
  scrollMessages();

  if (options.mirrorActivity) {
    addActivityItem(text);
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

  const bubble = document.createElement("div");
  bubble.className = "msg agent processing";
  bubble.id = "processingMsg";

  if (variant === "typing") {
    const typingBubble = document.createElement("div");
    typingBubble.className = "typing-bubble";

    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement("span");
      dot.className = "typing-dot";
      dot.setAttribute("aria-hidden", "true");
      typingBubble.appendChild(dot);
    }

    bubble.appendChild(typingBubble);
  } else {
    const spin = document.createElement("span");
    spin.className = "spinner";
    spin.setAttribute("aria-hidden", "true");
    bubble.appendChild(spin);
    bubble.appendChild(document.createTextNode(" " + label));
    setPageStatus(label);
  }

  messages.appendChild(bubble);
  scrollMessages();
  return bubble;
}

function removeProcessing() {
  const element = document.getElementById("processingMsg");
  if (element) element.remove();
  setPageStatus("");
}

function setJourneyStage(stage) {
  const order = ["account", "upload", "review", "done"];
  const stepMap = {
    account: "welcome",
    upload: "upload",
    review: "review",
    done: "confirm",
  };

  const index = order.indexOf(stage);
  currentStep = stepMap[stage] || "welcome";

  journeyItems.forEach(function(item, itemIndex) {
    item.classList.toggle("is-current", itemIndex === index);
    item.classList.toggle("is-done", itemIndex < index);
  });
}

function syncJourneyStage() {
  if (journeyFinished) {
    setJourneyStage("done");
    return;
  }

  if (!accountState) {
    setJourneyStage("account");
    return;
  }

  const hasIdentity = uploadedDocuments.includes("identity");
  const hasAddress = uploadedDocuments.includes("address");

  if (hasIdentity && hasAddress) {
    setJourneyStage("review");
    return;
  }

  setJourneyStage("upload");
}

function prefillAccountForm() {
  if (!accountState || !accountForm) return;

  const map = {
    workspaceName: accountState.workspaceName,
    accountEmail: accountState.contactEmail,
    accountPhone: accountState.phone,
    accountCountry: accountState.country,
    accountFirstName: accountState.firstName,
    accountLastName: accountState.lastName,
    companyType: accountState.companyType,
  };

  Object.keys(map).forEach(function(key) {
    if (accountForm.elements[key] && map[key]) {
      accountForm.elements[key].value = map[key];
    }
  });
}

function prefillProfileFromAccount() {
  if (!accountState || !profileForm) return;

  const map = {
    firstName: accountState.firstName,
    lastName: accountState.lastName,
    email: accountState.contactEmail,
    phone: accountState.phone,
    country: accountState.country,
  };

  Object.keys(map).forEach(function(key) {
    const field = profileForm.elements[key];
    if (field && !field.value && map[key]) {
      field.value = map[key];
    }
  });
}

function renderAccountState() {
  if (!accountStatus) return;

  const hasAccount = Boolean(accountState);

  if (!hasAccount) {
    accountStatus.className = "account-status-card";
    accountStatus.innerHTML =
      '<div class="placeholder-title">Aucun compte cree</div>' +
      "<p>Le KYC se debloque des que le compte business est initialise.</p>";
    if (kycGate) {
      kycGate.className = "gate-banner";
      kycGate.textContent =
        "Creez d'abord votre compte business pour debloquer le dossier KYC.";
    }
    if (uploadButton) uploadButton.classList.add("is-disabled");
    if (fileInput) fileInput.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (createAccountBtn) createAccountBtn.textContent = "Creer le compte";
    return;
  }

  const statusText =
    accountState.kycStatus === "approved"
      ? "KYC approuve"
      : accountState.kycStatus === "pending_review"
        ? "KYC en revue"
        : "Compte cree";

  accountStatus.className = "account-status-card is-ready";
  accountStatus.innerHTML =
    '<div class="summary-grid">' +
    '<div class="summary-row"><span>Workspace</span><strong>' +
    escapeHtml(accountState.workspaceName) +
    "</strong></div>" +
    '<div class="summary-row"><span>Workspace ID</span><strong>' +
    escapeHtml(accountState.workspaceId) +
    "</strong></div>" +
    '<div class="summary-row"><span>Customer ID</span><strong>' +
    escapeHtml(accountState.customerId) +
    "</strong></div>" +
    '<div class="summary-row"><span>Owner</span><strong>' +
    escapeHtml(accountState.owner) +
    "</strong></div>" +
    '<div class="summary-row"><span>Statut</span><strong>' +
    escapeHtml(statusText) +
    "</strong></div>" +
    "</div>";

  if (kycGate) {
    kycGate.className = "gate-banner is-ready";
    kycGate.textContent =
      "Compte cree. Vous pouvez maintenant televerser les documents KYC et finaliser l'activation.";
  }

  if (uploadButton) uploadButton.classList.remove("is-disabled");
  if (fileInput) fileInput.disabled = false;
  if (submitBtn) submitBtn.disabled = false;
  if (createAccountBtn) createAccountBtn.textContent = "Mettre a jour le compte";
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

  const list = document.createElement("ul");
  list.className = "check-items";

  items.forEach(function(item) {
    const done = uploadedDocuments.includes(item.key);
    const node = document.createElement("li");

    node.innerHTML =
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

    list.appendChild(node);
  });

  checklist.innerHTML = '<div class="check-title">Checklist documentaire</div>';
  checklist.appendChild(list);
}

function fillForm(extraction) {
  if (!profileForm || !extraction) return;

  const address = extraction.address || "";
  const addressParts = address.split(",");
  const map = {
    firstName: extraction.firstName,
    lastName: extraction.lastName,
    dob: extraction.dateOfBirth,
    street: extraction.street || (addressParts[0] || "").trim(),
    city: extraction.city || (addressParts[1] || "").trim(),
    state: extraction.state || (addressParts[2] || "").trim(),
    postal: extraction.postal,
    country: extraction.country,
  };

  Object.keys(map).forEach(function(key) {
    const value = map[key];
    if (value && profileForm.elements[key]) {
      profileForm.elements[key].value = value;
    }
  });

  if (extraction.documentNumber) {
    document.getElementById("docNumber").textContent = extraction.documentNumber;
  }
  if (extraction.dateOfExpiry) {
    document.getElementById("docExpiry").textContent = extraction.dateOfExpiry;
  }
  if (extraction.nationality) {
    document.getElementById("nationality").textContent = extraction.nationality;
  }
}

function showValidationBanner(errors, warnings) {
  const existing = document.querySelectorAll(".validation-banner");
  existing.forEach(function(node) {
    node.remove();
  });

  if (!profileForm || (!errors.length && !warnings.length)) return;

  const banner = document.createElement("div");
  const isError = errors.length > 0;
  banner.className =
    "validation-banner " + (isError ? "banner-error" : "banner-warning");

  const title = document.createElement("strong");
  title.textContent = isError ? "Points a corriger" : "Informations";
  banner.appendChild(title);

  const list = document.createElement("ul");
  (isError ? errors : warnings).forEach(function(message) {
    const item = document.createElement("li");
    item.textContent = message;
    list.appendChild(item);
  });
  banner.appendChild(list);

  profileForm.parentElement.insertBefore(banner, profileForm);
}

async function initSession() {
  if (sessionId) return;

  try {
    const response = await fetch("/api/kyc/session", { method: "POST" });
    if (!response.ok) throw new Error("session init failed");
    const data = await response.json();
    sessionId = data.sessionId;
    sessionStorage.setItem("kycSessionId", sessionId);
  } catch (error) {
    sessionId =
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : generateId("session");
  }
}

function focusAccountOnboarding() {
  const section = document.getElementById("account");
  if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ensureAccountBeforeKyc(message) {
  if (accountState) return false;

  const text =
    message ||
    "Creez d'abord votre compte business avant de continuer le KYC.";
  setInlineFeedback(text, "error");
  setUploadFeedback(text, "warning");
  focusAccountOnboarding();
  return true;
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
      "accepte",
      "soumis",
    ])
  ) {
    return "success";
  }

  if (
    includesAny(normalized, [
      "warning",
      "pending",
      "review",
      "manual review",
    ])
  ) {
    return "warning";
  }

  return "info";
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
  if (chatStatus) chatStatus.textContent = "En ligne";

  if (!chatIsMinimized && input) {
    window.setTimeout(function() {
      input.focus();
    }, 120);
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
    "Bonjour, je peux vous aider a creer votre compte " +
    BRAND +
    ", televerser vos documents KYC et suivre l'activation CRM simulee.";

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
    "pourquoi",
    "compte",
    "creer",
    "activation",
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
    "justificatif de domicile",
    "preuve d adresse",
    "facture",
    "releve bancaire",
    "courrier officiel",
  ]);
}

function wantsRejectionReason(message) {
  if (!validationErrors.length) return false;

  const normalized = normaliseText(message);
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

function buildNextStepHint(french) {
  if (!accountState) {
    return french
      ? "Commencez par creer votre compte business."
      : "Please start by creating your business account.";
  }

  const needsIdentity = !uploadedDocuments.includes("identity");
  const needsAddress = !uploadedDocuments.includes("address");

  if (needsIdentity && needsAddress) {
    return french
      ? "Le prochain document attendu est votre piece d'identite."
      : "The next document we need is your identity document.";
  }
  if (needsIdentity) {
    return french
      ? "Le document manquant est votre piece d'identite."
      : "The missing document is your identity document.";
  }
  if (needsAddress) {
    return french
      ? "Le document manquant est votre justificatif de domicile."
      : "The missing document is your proof of address.";
  }
  if (journeyFinished) {
    return french
      ? "Le dossier a deja ete soumis et le compte est en cours d'activation."
      : "The application has already been submitted and the account is being activated.";
  }
  return french
    ? "Les deux documents ont ete recus. Vous pouvez maintenant verifier les donnees puis soumettre le dossier."
    : "Both documents have been received. You can now review the extracted details and submit the application.";
}

function buildLocalChatFallback(message) {
  const french = isFrenchMessage(message);
  const nextStepHint = buildNextStepHint(french);
  const wantsIdentity = wantsIdentityDocumentDetails(message);
  const wantsAddress = wantsAddressDocumentDetails(message);

  if (wantsGreeting(message)) {
    if (french) {
      return "Bonjour, je peux vous aider a ouvrir votre compte " + BRAND + ". " + nextStepHint;
    }
    return "Hello, I can help you open your " + BRAND + " account. " + nextStepHint;
  }

  if (wantsAcceptedDocuments(message)) {
    if (french) {
      if (wantsAddress && !wantsIdentity) {
        return (
          "Comme justificatif de domicile, nous acceptons un document recent de moins de 90 jours, par exemple une facture, un releve bancaire, un avis de taxe, une lettre d'assurance ou un courrier officiel avec l'adresse complete. Formats acceptes : " +
          ACCEPTED_CHAT_FORMATS +
          ". " +
          nextStepHint
        );
      }
      if (wantsIdentity && !wantsAddress) {
        return (
          "Pour la piece d'identite, nous acceptons un passeport, une carte nationale d'identite ou un permis de conduire en cours de validite. Formats acceptes : " +
          ACCEPTED_CHAT_FORMATS +
          ". " +
          nextStepHint
        );
      }
      return (
        "Nous acceptons comme piece d'identite un passeport, une carte nationale d'identite ou un permis de conduire. Comme justificatif de domicile, nous acceptons un document recent de moins de 90 jours, par exemple une facture, un releve bancaire, un avis de taxe, une lettre d'assurance ou un courrier officiel avec votre adresse complete. Formats acceptes : " +
        ACCEPTED_CHAT_FORMATS +
        ". " +
        nextStepHint
      );
    }

    if (wantsAddress && !wantsIdentity) {
      return (
        "For proof of address, we accept " +
        ADDRESS_DOCUMENTS +
        ". Accepted upload formats: " +
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
      " for proof of address. Accepted upload formats: " +
      ACCEPTED_CHAT_FORMATS +
      ". " +
      nextStepHint
    );
  }

  if (wantsRejectionReason(message)) {
    if (french) {
      return (
        "Le dernier document a ete refuse pour la raison suivante : " +
        validationErrors.join("; ") +
        ". Merci de reteleverser un document clair et conforme."
      );
    }
    return (
      "The last document was rejected for this reason: " +
      validationErrors.join("; ") +
      ". Please upload a clearer compliant document."
    );
  }

  if (french) {
    return (
      "Je peux vous aider sur l'ouverture de compte, les documents KYC acceptes et le statut du dossier. " +
      nextStepHint
    );
  }
  return (
    "I can help with account opening, accepted KYC documents and application status. " +
    nextStepHint
  );
}

function publishAssistantReply(reply) {
  say(reply, "agent", { mirrorActivity: false, tone: inferActivityTone(reply) });
  chatHistory.push({ role: "assistant", content: reply });
}

async function sendMessage(text) {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  openChat();

  say(trimmedText, "user");
  chatHistory.push({ role: "user", content: trimmedText });
  showProcessing("L'assistant redige sa reponse", "typing");

  const fallbackReply = buildLocalChatFallback(trimmedText);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(function() {
    controller.abort();
  }, CHAT_REQUEST_TIMEOUT_MS);

  let reply = fallbackReply;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        sessionId: sessionId,
        message: trimmedText,
        history: chatHistory.slice(-20),
        context: {
          step: currentStep,
          accountCreated: Boolean(accountState),
          workspaceId: accountState && accountState.workspaceId,
          uploadedDocuments: uploadedDocuments,
          validationErrors: validationErrors,
          validationWarnings: validationWarnings,
        },
      }),
    });

    if (response.ok) {
      const data = await response.json().catch(function() {
        return {};
      });
      reply =
        (typeof data.reply === "string" && data.reply.trim()) || fallbackReply;
    }
  } catch (error) {
    console.error("Chat error:", error);
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

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const offscreen = document.createElement("canvas");
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;

    await page.render({
      canvasContext: offscreen.getContext("2d"),
      viewport: viewport,
    }).promise;

    bitmap = await createImageBitmap(offscreen);
  } else {
    bitmap = await createImageBitmap(file);
  }

  const maxDimension = 1600;
  let width = bitmap.width;
  let height = bitmap.height;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();

  const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  return { base64: base64, mimeType: "image/jpeg" };
}

function createAccountPreview(formData) {
  return {
    workspaceName: formData.workspaceName,
    contactEmail: formData.accountEmail,
    phone: formData.accountPhone,
    country: formData.accountCountry,
    firstName: formData.accountFirstName,
    lastName: formData.accountLastName,
    companyType: formData.companyType,
    workspaceId: generateId("ws"),
    customerId: generateId("crm"),
    owner: pickOwner(formData.accountCountry),
    createdAt: new Date().toISOString(),
  };
}

if (createAccountBtn && accountForm) {
  createAccountBtn.addEventListener("click", async function() {
    await initSession();

    const formData = {
      workspaceName: accountForm.elements.workspaceName.value.trim(),
      accountEmail: accountForm.elements.accountEmail.value.trim(),
      accountPhone: accountForm.elements.accountPhone.value.trim(),
      accountCountry: accountForm.elements.accountCountry.value.trim(),
      accountFirstName: accountForm.elements.accountFirstName.value.trim(),
      accountLastName: accountForm.elements.accountLastName.value.trim(),
      companyType: accountForm.elements.companyType.value.trim(),
      accountPassword: accountForm.elements.accountPassword.value.trim(),
    };

    const missing = [];
    if (!formData.workspaceName) missing.push("nom de l'espace");
    if (!formData.accountEmail) missing.push("email professionnel");
    if (!formData.accountCountry) missing.push("pays de residence");
    if (!formData.accountFirstName) missing.push("prenom administrateur");
    if (!formData.accountLastName) missing.push("nom administrateur");
    if (!formData.accountPassword || formData.accountPassword.length < 8) {
      missing.push("mot de passe (8 caracteres minimum)");
    }

    if (missing.length) {
      setInlineFeedback(
        "Merci de completer : " + missing.join(", ") + ".",
        "error",
      );
      return;
    }

    journeyFinished = false;
    accountState = createAccountPreview(formData);
    persistAccountState();
    prefillProfileFromAccount();
    prefillAccountForm();
    renderAccountState();
    syncJourneyStage();
    setInlineFeedback(
      "Compte cree. Le dossier KYC est maintenant pret.",
      "success",
    );

    if (crmFeed) crmFeed.innerHTML = "";
    if (crmEmpty) crmEmpty.hidden = false;
    setCrmStatus("En attente", "neutral");

    const section = document.getElementById("manual-kyc");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
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
    if (ensureAccountBeforeKyc("Commencez par creer votre compte avant d'envoyer un document depuis le chat.")) {
      say(
        "Commencez par creer votre compte business. Ensuite, je pourrai televerser le document dans le dossier KYC.",
        "agent",
      );
      return;
    }
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
  sendBtn.addEventListener("click", function(event) {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    input.value = "";
    sendMessage(value);
  });
}

if (input) {
  input.addEventListener("keydown", function(event) {
    if ((event.key === "Enter" || event.keyCode === 13) && !event.shiftKey) {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      input.value = "";
      sendMessage(value);
    }
  });
}

if (fileInput) {
  fileInput.addEventListener("change", async function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (ensureAccountBeforeKyc()) {
      event.target.value = "";
      return;
    }

    clearUploadFeedback();
    await initSession();
    syncJourneyStage();
    updateFileChips(file.name);

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];

    if (!allowed.includes(file.type)) {
      const formatMessage =
        "Format non pris en charge. Merci d'envoyer un document JPEG, PNG, WebP ou PDF.";
      setUploadFeedback(formatMessage, "error");
      say(formatMessage, "agent");
      return;
    }

    const documentCategory = guessCategory(file.name);
    showProcessing("Verification de " + file.name + "...");

    try {
      const prepared = await prepareImageForUpload(file);
      const base64 = prepared.base64;
      const mimeType = prepared.mimeType;

      const approxBytes = Math.ceil((base64.length * 3) / 4);
      if (approxBytes > 4 * 1024 * 1024) {
        removeProcessing();
        const tooLargeMessage =
          "Le document est trop volumineux. Merci d'utiliser un fichier plus leger ou une image moins lourde.";
        setUploadFeedback(tooLargeMessage, "error");
        say(tooLargeMessage, "agent");
        return;
      }

      const checkResponse = await fetch("/api/kyc/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          fileName: file.name,
          mimeType: mimeType,
          data: base64,
        }),
      });

      removeProcessing();

      if (!checkResponse.ok) {
        const error = await checkResponse.json().catch(function() {
          return {};
        });
        const message =
          error.error || "La verification du document a echoue. Merci de reessayer.";
        setUploadFeedback(message, "error");
        say(message, "agent");
        return;
      }

      const checkResult = await checkResponse.json();

      if (!checkResult.valid) {
        const issues =
          checkResult.issues && checkResult.issues.length
            ? checkResult.issues.join(" ")
            : "Le document ne peut pas etre accepte.";
        const rejectionMessage =
          "Document refuse : " +
          issues +
          " Merci d'envoyer un document clair et conforme.";
        setUploadFeedback(rejectionMessage, "error");
        say(
          "Document refuse :\n" + issues + "\nMerci d'envoyer un document clair et conforme.",
          "agent",
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
        );
      }

      showProcessing("Extraction des informations depuis " + file.name + "...");

      const uploadResponse = await fetch("/api/kyc/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          documentCategory: documentCategory,
          detectedCategory: detectedCategory,
          fileName: file.name,
          mimeType: mimeType,
          data: base64,
        }),
      });

      removeProcessing();

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json().catch(function() {
          return {};
        });
        const message =
          error.error || "Le televersement a echoue. Merci de reessayer.";
        setUploadFeedback(message, "error");
        say(message, "agent");
        return;
      }

      const uploadResult = await uploadResponse.json();
      const extraction = uploadResult.extraction;
      const validation = uploadResult.validation;
      const effectiveCategory =
        uploadResult.documentCategory || detectedCategory;

      if (!uploadedDocuments.includes(effectiveCategory)) {
        uploadedDocuments.push(effectiveCategory);
      }
      if (effectiveCategory === "identity") identityExtraction = extraction;
      if (effectiveCategory === "address") addressExtraction = extraction;

      validationErrors = validation.errors || [];
      validationWarnings = validation.warnings || [];

      updateChecklist();
      showValidationBanner(validationErrors, validationWarnings);

      if (effectiveCategory === "identity" || effectiveCategory === "address") {
        fillForm(extraction);
        prefillProfileFromAccount();
      }

      syncJourneyStage();

      if (validation.passed) {
        setUploadFeedback(
          "Informations extraites avec succes. Le formulaire a ete rempli automatiquement.",
          "success",
        );
        say(
          "Informations extraites avec succes. Le formulaire a ete rempli automatiquement. Verifiez les champs puis soumettez le dossier quand vous etes pret.",
          "agent",
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
        );
      }
    } catch (error) {
      removeProcessing();
      console.error("Upload error:", error);
      const message =
        "Une erreur est survenue pendant le traitement du document. Merci de reessayer.";
      setUploadFeedback(message, "error");
      say(message, "agent");
    } finally {
      event.target.value = "";
    }
  });
}

if (submitBtn) {
  submitBtn.addEventListener("click", async function(event) {
    event.preventDefault();
    await initSession();

    if (ensureAccountBeforeKyc()) return;

    const missingDocuments = [];
    if (!uploadedDocuments.includes("identity")) {
      missingDocuments.push("piece d'identite");
    }
    if (!uploadedDocuments.includes("address")) {
      missingDocuments.push("justificatif de domicile");
    }

    if (missingDocuments.length) {
      const message =
        "Merci d'ajouter encore : " + missingDocuments.join(" et ") + ".";
      result.textContent = message;
      setUploadFeedback(message, "warning");
      syncJourneyStage();
      return;
    }

    showProcessing("Activation du compte en cours...");

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
      const field = profileForm.elements[name];
      if (field) profileData[name] = field.value;
    });

    try {
      const response = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          profileData: profileData,
          identityExtraction: identityExtraction,
          addressExtraction: addressExtraction,
          accountData: accountState,
        }),
      });

      removeProcessing();

      if (!response.ok) {
        const error = await response.json().catch(function() {
          return {};
        });
        const message =
          "La soumission a echoue : " + (error.error || "merci de reessayer.");
        result.textContent = message;
        say(message, "agent");
        return;
      }

      const submission = await response.json();
      journeyFinished = true;

      accountState = Object.assign({}, accountState, {
        kycStatus: submission.status,
        submissionId: submission.submissionId,
        submittedAt: submission.submittedAt,
      });
      persistAccountState();
      renderAccountState();
      syncJourneyStage();

      const crmSimulation = submission.crmSimulation || null;
      const workspaceId =
        (crmSimulation && crmSimulation.workspaceId) || accountState.workspaceId;
      const customerId =
        (crmSimulation && crmSimulation.customerId) || accountState.customerId;

      if (submission.status === "approved") {
        result.textContent =
          "Compte active. Workspace " +
          workspaceId +
          " et contact " +
          customerId +
          " ont ete synchronises dans la demo CRM.";
        say(
          "Le KYC est valide. Le compte business est active et la synchronisation CRM est en cours.",
          "agent",
        );
      } else {
        result.textContent =
          "Dossier soumis. Le compte reste en attente de revue manuelle, mais les logs CRM de pre-onboarding sont quand meme simules.";
        say(
          "Le dossier a ete transmis pour revue manuelle. Les logs CRM de pre-onboarding sont maintenant generes.",
          "agent",
        );
      }

      runCrmSimulation(crmSimulation || {});

      if (
        submission.reconciliation &&
        submission.reconciliation.suspiciousSignals &&
        submission.reconciliation.suspiciousSignals.length
      ) {
        say(
          "Notes de revue :\n" +
            submission.reconciliation.suspiciousSignals.join("\n"),
          "agent",
        );
      }
    } catch (error) {
      removeProcessing();
      console.error("Submit error:", error);
      const message =
        "La soumission a echoue a cause d'une erreur reseau. Merci de reessayer.";
      result.textContent = message;
      say(message, "agent");
    }
  });
}

(async function init() {
  ensureUploadFeedback();
  prefillAccountForm();
  prefillProfileFromAccount();
  updateChecklist();
  renderAccountState();
  syncJourneyStage();
  updateChatShell();
  setCrmStatus("En attente", "neutral");
  await initSession();
})();
