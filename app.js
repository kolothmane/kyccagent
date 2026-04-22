const BRAND = (window.BRANDING && window.BRANDING.name) || "BayBank";
const SERVICE_LINE = (window.BRANDING && window.BRANDING.serviceLine) || "Business Banking";
const ACCOUNT_STORAGE_KEY = "baybankAccountState";
const CHAT_REQUEST_TIMEOUT_MS = 12000;
const ACCEPTED_CHAT_FORMATS = "JPEG, PNG, WebP, GIF, or PDF";
const IDENTITY_DOCUMENTS = "passport, national ID card, or driving licence";
const ADDRESS_DOCUMENTS =
  "a recent utility bill, bank statement, tax letter, insurance letter, or official government correspondence showing the full postal address";

const messages = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const fileInput = document.getElementById("file");
const uploadButton = document.querySelector('label[for="file"]');
const fileChips = document.getElementById("fileChips");
const profileForm = document.getElementById("profile");
const result = document.getElementById("result");
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
let recentFiles = [];
let currentStep = "welcome";
let chatIsOpen = false;
let chatIsMinimized = false;
let chatHasWelcomed = false;
let timelineTimers = [];

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
  const managers = ["Amina Rahal", "Lucas Meyer", "Sarah Klein", "Noah Bernard"];
  const normalized = normaliseText(country);
  const index = normalized.length % managers.length;
  return managers[index];
}

function scrollMessages() {
  if (messages) {
    messages.scrollTop = messages.scrollHeight;
  }
}

function setInlineFeedback(message, tone) {
  if (!accountFormMessage) return;

  accountFormMessage.className = "inline-feedback";
  if (tone) accountFormMessage.classList.add("is-" + tone);
  accountFormMessage.textContent = message || "";
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

function setCrmStatus(label, tone) {
  if (!crmStatus) return;

  crmStatus.className = "status-badge " + (tone || "neutral");
  crmStatus.textContent = label || "En attente";
}

function clearTimelineTimers() {
  timelineTimers.forEach(function(timer) {
    window.clearTimeout(timer);
  });
  timelineTimers = [];
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
    escapeHtml(log.system || "Operations") +
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

function runAccountTimeline(timeline) {
  clearTimelineTimers();
  if (!crmFeed) return;

  crmFeed.innerHTML = "";
  if (crmEmpty) crmEmpty.hidden = false;

  const events = Array.isArray(timeline && timeline.events) ? timeline.events : [];
  if (!events.length) {
    setCrmStatus("En attente", "neutral");
    return;
  }

  if (crmEmpty) crmEmpty.hidden = true;
  setCrmStatus("Mise a jour", "pending");

  events.forEach(function(event, index) {
    const timer = window.setTimeout(function() {
      renderCrmLog(event);
      if (index === events.length - 1) {
        setCrmStatus(
          timeline.statusLabel || "Compte actif",
          timeline.statusTone || "success",
        );
      }
    }, index * 360);

    timelineTimers.push(timer);
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
  setUploadFeedback("", "");
}

function say(text, who) {
  if (!messages) return;

  const bubble = document.createElement("div");
  bubble.className = "msg " + (who || "agent");
  bubble.textContent = text;
  messages.appendChild(bubble);

  const emptyState = document.getElementById("emptyState");
  if (emptyState) emptyState.remove();

  scrollMessages();

  if (who !== "user" && !chatIsOpen && chatUnread) {
    chatUnread.hidden = false;
  }
}

function showProcessing(label, variant) {
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
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    bubble.appendChild(spinner);
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
  const index = order.indexOf(stage);
  currentStep = stage === "done" ? "confirm" : stage;

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
    const field = accountForm.elements[key];
    if (field && map[key]) field.value = map[key];
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
    if (field && !field.value && map[key]) field.value = map[key];
  });
}

function renderAccountState() {
  if (!accountStatus) return;

  if (!accountState) {
    accountStatus.className = "account-status-card";
    accountStatus.innerHTML =
      '<div class="placeholder-title">Aucun compte cree</div>' +
      "<p>Le dossier KYC sera disponible des que l'espace BayBank sera cree.</p>";
    if (kycGate) {
      kycGate.className = "gate-banner";
      kycGate.textContent = "Creez d'abord votre compte BayBank pour debloquer le dossier KYC.";
    }
    if (uploadButton) uploadButton.classList.add("is-disabled");
    if (fileInput) fileInput.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (createAccountBtn) createAccountBtn.textContent = "Creer le compte";
    return;
  }

  const statusText =
    accountState.kycStatus === "approved"
      ? "Compte actif"
      : accountState.kycStatus === "pending_review"
        ? "Revue en cours"
        : "Compte cree";

  accountStatus.className = "account-status-card is-ready";
  accountStatus.innerHTML =
    '<div class="summary-grid">' +
    '<div class="summary-row"><span>Organisation</span><strong>' +
    escapeHtml(accountState.workspaceName) +
    "</strong></div>" +
    '<div class="summary-row"><span>Organisation ID</span><strong>' +
    escapeHtml(accountState.workspaceId) +
    "</strong></div>" +
    '<div class="summary-row"><span>Client ID</span><strong>' +
    escapeHtml(accountState.customerId) +
    "</strong></div>" +
    '<div class="summary-row"><span>Responsable</span><strong>' +
    escapeHtml(accountState.owner) +
    "</strong></div>" +
    '<div class="summary-row"><span>Statut</span><strong>' +
    escapeHtml(statusText) +
    "</strong></div>" +
    "</div>";

  if (kycGate) {
    kycGate.className = "gate-banner is-ready";
    kycGate.textContent =
      "Compte cree. Vous pouvez maintenant televerser vos documents KYC et finaliser le dossier.";
  }

  if (uploadButton) uploadButton.classList.remove("is-disabled");
  if (fileInput) fileInput.disabled = false;
  if (submitBtn) submitBtn.disabled = false;
  if (createAccountBtn) createAccountBtn.textContent = "Mettre a jour le compte";
}

function updateFileChips(fileName) {
  if (!fileChips || !fileName) return;

  recentFiles = [fileName]
    .concat(recentFiles.filter(function(name) {
      return name !== fileName;
    }))
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
      sub: "Passeport, carte d'identite ou permis de conduire",
    },
    {
      key: "address",
      label: "Justificatif de domicile",
      sub: "Facture, releve bancaire, lettre d'assurance ou courrier officiel",
    },
  ];

  const list = document.createElement("ul");
  list.className = "check-items";

  items.forEach(function(item) {
    const done = uploadedDocuments.includes(item.key);
    const row = document.createElement("li");
    row.innerHTML =
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
    list.appendChild(row);
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
    const field = profileForm.elements[key];
    if (field && map[key]) field.value = map[key];
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
  document.querySelectorAll(".validation-banner").forEach(function(node) {
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
    sessionStorage.setItem("kycSessionId", sessionId);
  }
}

function focusAccountOnboarding() {
  const section = document.getElementById("account");
  if (section) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function ensureAccountBeforeKyc(message) {
  if (accountState) return false;

  const text =
    message || "Creez d'abord votre compte BayBank avant de continuer le KYC.";
  setInlineFeedback(text, "error");
  setUploadFeedback(text, "warning");
  focusAccountOnboarding();
  return true;
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

  const welcome =
    "Bonjour, je peux vous aider a ouvrir votre compte " +
    BRAND +
    ", verifier les documents acceptes et pre-remplir le KYC a partir d'un document valide.";
  say(welcome, "agent");
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
  chatIsMinimized = !chatIsMinimized;
  closeChatMenu();
  updateChatShell();
}

function buildNextStepHint(french) {
  if (!accountState) {
    return french
      ? "Commencez par creer votre compte BayBank."
      : "Start by creating your BayBank account first.";
  }

  const needsIdentity = !uploadedDocuments.includes("identity");
  const needsAddress = !uploadedDocuments.includes("address");

  if (needsIdentity && needsAddress) {
    return french
      ? "Envoyez d'abord votre piece d'identite, puis votre justificatif de domicile."
      : "Please upload your identity document first, then your proof of address.";
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
  return french
    ? "Les deux documents sont deja recus. Verifiez les donnees puis soumettez le dossier."
    : "Both documents have already been received. Review the extracted data and submit the application.";
}

function buildLocalChatFallback(message) {
  const normalized = normaliseText(message);
  const french = includesAny(normalized, [
    "bonjour",
    "salut",
    "merci",
    "documents",
    "justificatif",
    "preuve",
    "compte",
    "statut",
    "k y c",
    "kyc",
  ]);
  const nextStepHint = buildNextStepHint(french);
  const wantsGreeting = includesAny(normalized, [
    "hello",
    "hi",
    "hey",
    "bonjour",
    "salut",
    "coucou",
  ]);
  const wantsDocs = includesAny(normalized, [
    "what documents",
    "which documents",
    "accepted documents",
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
  const wantsAddress = includesAny(normalized, [
    "proof of address",
    "proof of adress",
    "address",
    "justificatif",
    "domicile",
    "facture",
    "releve bancaire",
  ]);
  const wantsIdentity = includesAny(normalized, [
    "identity",
    "passport",
    "national id",
    "driving licence",
    "piece d'identite",
    "passeport",
    "carte d'identite",
    "permis",
  ]);
  const wantsStatus = includesAny(normalized, [
    "status",
    "where are we",
    "next step",
    "statut",
    "ou en est",
    "etape",
  ]);
  const wantsRejection =
    validationErrors.length > 0 &&
    includesAny(normalized, ["why rejected", "rejected", "pourquoi", "rejet", "raison"]);

  if (wantsGreeting) {
    return french
      ? "Bonjour, je peux vous aider a ouvrir votre compte, verifier les documents acceptes et pre-remplir le KYC. " +
          nextStepHint
      : "Hello, I can help you open your account, explain accepted documents and auto-fill the KYC form. " +
          nextStepHint;
  }

  if (wantsDocs) {
    if (french) {
      if (wantsAddress && !wantsIdentity) {
        return (
          "Comme justificatif de domicile, nous acceptons une facture, un releve bancaire, une lettre d'assurance, un avis de taxe ou un courrier officiel recent avec l'adresse complete. Formats acceptes : " +
          ACCEPTED_CHAT_FORMATS +
          ". " +
          nextStepHint
        );
      }
      if (wantsIdentity && !wantsAddress) {
        return (
          "Pour l'identite, nous acceptons un passeport, une carte nationale d'identite ou un permis de conduire. Formats acceptes : " +
          ACCEPTED_CHAT_FORMATS +
          ". " +
          nextStepHint
        );
      }
      return (
        "Nous acceptons comme piece d'identite un passeport, une carte nationale d'identite ou un permis de conduire, puis comme justificatif de domicile un document recent de moins de 90 jours avec l'adresse complete. Formats acceptes : " +
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

  if (wantsStatus) {
    return nextStepHint;
  }

  if (wantsRejection) {
    if (french) {
      return (
        "Le dernier document a ete refuse pour la raison suivante : " +
        validationErrors.join("; ") +
        ". Merci de reteleverser un document plus clair ou conforme."
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
  say(reply, "agent");
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
      reply = (typeof data.reply === "string" && data.reply.trim()) || fallbackReply;
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
  const lower = normaliseText(fileName);

  if (/selfie|liveness/.test(lower)) return "selfie";
  if (
    /bill|address|utility|bank|statement|invoice|facture|domicile|quittance|releve|tax|taxe|impot|assurance|insurance|edf|engie|sfr|orange|free/.test(
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
    const viewport = page.getViewport({ scale: 2 });
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
    workspaceId: generateId("org"),
    customerId: generateId("client"),
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
    if (!formData.workspaceName) missing.push("nom de l'organisation");
    if (!formData.accountEmail) missing.push("email professionnel");
    if (!formData.accountCountry) missing.push("pays de residence");
    if (!formData.accountFirstName) missing.push("prenom administrateur");
    if (!formData.accountLastName) missing.push("nom administrateur");
    if (!formData.accountPassword || formData.accountPassword.length < 8) {
      missing.push("mot de passe (8 caracteres minimum)");
    }

    if (missing.length) {
      setInlineFeedback("Merci de completer : " + missing.join(", ") + ".", "error");
      return;
    }

    journeyFinished = false;
    accountState = createAccountPreview(formData);
    persistAccountState();
    prefillProfileFromAccount();
    prefillAccountForm();
    renderAccountState();
    syncJourneyStage();
    setInlineFeedback("Compte cree. Le dossier KYC est maintenant disponible.", "success");

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
    if (
      ensureAccountBeforeKyc(
        "Commencez par creer votre compte avant d'envoyer un document depuis le chat.",
      )
    ) {
      say(
        "Commencez par creer votre compte BayBank. Ensuite, je pourrai televerser le document et pre-remplir votre KYC.",
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
      event.target.value = "";
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
          "Le document est trop volumineux. Merci d'utiliser un fichier plus leger.";
        setUploadFeedback(tooLargeMessage, "error");
        say(tooLargeMessage, "agent");
        event.target.value = "";
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
        event.target.value = "";
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
        validationErrors = checkResult.issues || [];
        setUploadFeedback(rejectionMessage, "error");
        say("Document refuse :\n" + issues, "agent");
        event.target.value = "";
        return;
      }

      const detectedCategory = checkResult.detectedCategory || documentCategory;
      const categoryLabel = getCategoryLabel(detectedCategory);

      if (checkResult.warnings && checkResult.warnings.length) {
        setUploadFeedback(
          "Document accepte comme " + categoryLabel + " avec remarques.",
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
        setUploadFeedback("Document accepte comme " + categoryLabel + ".", "success");
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
        const message = error.error || "Le televersement a echoue. Merci de reessayer.";
        setUploadFeedback(message, "error");
        say(message, "agent");
        event.target.value = "";
        return;
      }

      const uploadResult = await uploadResponse.json();
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
          "Informations extraites avec succes. Le formulaire KYC a ete pre-rempli. Verifiez les champs puis soumettez le dossier.",
          "agent",
        );
      } else {
        const validationMessage =
          "Le document a ete traite avec des points de vigilance : " +
          validationErrors.join(" ") +
          " Merci de corriger les informations ou de renvoyer un document valide.";
        setUploadFeedback(validationMessage, "warning");
        say(
          "Le document a ete traite avec des points de vigilance :\n" +
            validationErrors.join("\n"),
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

    showProcessing("Verification finale du dossier...");

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

      const timeline = submission.accountTimeline || submission.crmSimulation || null;

      if (submission.status === "approved") {
        result.textContent =
          "Compte active. Votre dossier est valide et votre espace BayBank est pret.";
        say(
          "Le KYC est valide. Votre compte BayBank est active et le dossier client a ete enregistre.",
          "agent",
        );
      } else {
        result.textContent =
          "Dossier soumis. Notre equipe poursuit la verification avant activation finale.";
        say(
          "Le dossier a bien ete soumis. Il est maintenant en cours de revue par l'equipe conformite.",
          "agent",
        );
      }

      runAccountTimeline(timeline || {});

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
