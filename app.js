const BRAND = (window.BRANDING && window.BRANDING.name) || "BayBank";
const SERVICE_LINE =
  (window.BRANDING && window.BRANDING.serviceLine) || "Banque digitale nouvelle génération";
const ACCOUNT_STORAGE_KEY = "baybankAccountState";
const CHAT_REQUEST_TIMEOUT_MS = 12000;
const ACCEPTED_CHAT_FORMATS = "JPEG, PNG, WebP, GIF ou PDF";
const IDENTITY_DOCUMENTS = "un passeport, une carte nationale d'identité ou un permis de conduire";
const ADDRESS_DOCUMENTS =
  "une facture récente, un relevé bancaire, une lettre d'assurance, un avis de taxe ou un courrier officiel mentionnant l'adresse complète";
const FRENCH_DEPARTMENT_BY_PREFIX = {
  "01": "Ain",
  "02": "Aisne",
  "03": "Allier",
  "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes",
  "06": "Alpes-Maritimes",
  "07": "Ardèche",
  "08": "Ardennes",
  "09": "Ariège",
  "10": "Aube",
  "11": "Aude",
  "12": "Aveyron",
  "13": "Bouches-du-Rhône",
  "14": "Calvados",
  "15": "Cantal",
  "16": "Charente",
  "17": "Charente-Maritime",
  "18": "Cher",
  "19": "Corrèze",
  "20": "Corse",
  "21": "Côte-d'Or",
  "22": "Côtes-d'Armor",
  "23": "Creuse",
  "24": "Dordogne",
  "25": "Doubs",
  "26": "Drôme",
  "27": "Eure",
  "28": "Eure-et-Loir",
  "29": "Finistère",
  "30": "Gard",
  "31": "Haute-Garonne",
  "32": "Gers",
  "33": "Gironde",
  "34": "Hérault",
  "35": "Ille-et-Vilaine",
  "36": "Indre",
  "37": "Indre-et-Loire",
  "38": "Isère",
  "39": "Jura",
  "40": "Landes",
  "41": "Loir-et-Cher",
  "42": "Loire",
  "43": "Haute-Loire",
  "44": "Loire-Atlantique",
  "45": "Loiret",
  "46": "Lot",
  "47": "Lot-et-Garonne",
  "48": "Lozère",
  "49": "Maine-et-Loire",
  "50": "Manche",
  "51": "Marne",
  "52": "Haute-Marne",
  "53": "Mayenne",
  "54": "Meurthe-et-Moselle",
  "55": "Meuse",
  "56": "Morbihan",
  "57": "Moselle",
  "58": "Nièvre",
  "59": "Nord",
  "60": "Oise",
  "61": "Orne",
  "62": "Pas-de-Calais",
  "63": "Puy-de-Dôme",
  "64": "Pyrénées-Atlantiques",
  "65": "Hautes-Pyrénées",
  "66": "Pyrénées-Orientales",
  "67": "Bas-Rhin",
  "68": "Haut-Rhin",
  "69": "Rhône",
  "70": "Haute-Saône",
  "71": "Saône-et-Loire",
  "72": "Sarthe",
  "73": "Savoie",
  "74": "Haute-Savoie",
  "75": "Paris",
  "76": "Seine-Maritime",
  "77": "Seine-et-Marne",
  "78": "Yvelines",
  "79": "Deux-Sèvres",
  "80": "Somme",
  "81": "Tarn",
  "82": "Tarn-et-Garonne",
  "83": "Var",
  "84": "Vaucluse",
  "85": "Vendée",
  "86": "Vienne",
  "87": "Haute-Vienne",
  "88": "Vosges",
  "89": "Yonne",
  "90": "Territoire de Belfort",
  "91": "Essonne",
  "92": "Hauts-de-Seine",
  "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne",
  "95": "Val-d'Oise",
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

const currentPage = document.body.dataset.page || "landing";

const siteHeader = document.getElementById("siteHeader");
const navToggle = document.getElementById("navToggle");
const navbarCollapse = document.getElementById("navbarCollapse");

const messages = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const fileInput = document.getElementById("file");
const fileChips = document.getElementById("fileChips");
const profileForm = document.getElementById("profile");
const result = document.getElementById("result");
const checklist = document.querySelector(".checklist");
const pageStatus = document.getElementById("pageStatus");
const submitBtn = document.getElementById("submit");
const kycGate = document.getElementById("kycGate");
const accountPill = document.getElementById("accountPill");

const accountForm = document.getElementById("accountForm");
const createAccountBtn = document.getElementById("createAccountBtn");
const accountFormMessage = document.getElementById("accountFormMessage");
const accountStatus = document.getElementById("accountStatus");

const uploadIdentityBtn = document.getElementById("uploadIdentityBtn");
const uploadAddressBtn = document.getElementById("uploadAddressBtn");
const identityUploadStatus = document.getElementById("identityUploadStatus");
const addressUploadStatus = document.getElementById("addressUploadStatus");
const identityUploadFile = document.getElementById("identityUploadFile");
const addressUploadFile = document.getElementById("addressUploadFile");

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
let accountState = sanitizeAccountState(
  readStoredJson(sessionStorage.getItem(ACCOUNT_STORAGE_KEY)),
);
let journeyFinished = Boolean(accountState && accountState.kycStatus);
let chatHistory = [];
let identityExtraction = null;
let addressExtraction = null;
let uploadedDocuments = [];
let validationErrors = [];
let validationWarnings = [];
let recentFiles = [];
let currentStep = currentPage === "kyc" ? "upload" : "account";
let chatIsOpen = false;
let chatIsMinimized = false;
let chatHasWelcomed = false;
let timelineTimers = [];
let pendingUploadIntent = null;

const documentNames = {
  identity: "",
  address: "",
};

function readStoredJson(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function looksLikePhone(value) {
  const normalized = String(value || "").replace(/[^\d+]/g, "");
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 8 && /^[+]?[\d]+$/.test(normalized);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getFormFieldValue(form, name) {
  if (!form || !form.elements || !form.elements[name]) return "";
  return String(form.elements[name].value || "").trim();
}

function sanitizeAccountState(state) {
  if (!state || typeof state !== "object") return null;

  const next = Object.assign({}, state);

  if (next.country && (looksLikeEmail(next.country) || next.country === next.contactEmail)) {
    next.country = "";
  }
  if (next.phone && looksLikeEmail(next.phone)) {
    next.phone = "";
  }
  if (next.firstName && looksLikeEmail(next.firstName)) {
    next.firstName = "";
  }
  if (next.lastName && looksLikeEmail(next.lastName)) {
    next.lastName = "";
  }

  return next;
}

function persistAccountState() {
  if (accountState) {
    accountState = sanitizeAccountState(accountState);
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

function splitAddressChunks(address) {
  return String(address || "")
    .split(/\n|,/)
    .map(cleanText)
    .filter(Boolean);
}

function parsePostalCity(value) {
  const text = cleanText(value);
  if (!text) return { postal: "", city: "" };

  let match = text.match(/\b([A-Z]{1,3}-?\d{4,6}|\d{4,6})\b[\s,.-]+(.+)$/i);
  if (match) {
    return {
      postal: match[1].replace(/\s+/g, ""),
      city: cleanText(match[2]),
    };
  }

  match = text.match(/^(.+?)[\s,.-]+([A-Z]{1,3}-?\d{4,6}|\d{4,6})\b$/i);
  if (match) {
    return {
      postal: match[2].replace(/\s+/g, ""),
      city: cleanText(match[1]),
    };
  }

  return { postal: "", city: "" };
}

function deriveFrenchDepartment(postal, country, addressText) {
  const digits = String(postal || "").replace(/\D/g, "");
  if (!digits) return "";

  const normalizedCountry = normaliseText(country);
  const normalizedAddress = normaliseText(addressText);
  const probablyFrance =
    normalizedCountry.includes("france") ||
    normalizedAddress.includes("france") ||
    (!normalizedCountry && digits.length === 5);

  if (!probablyFrance) return "";

  if (digits.startsWith("97") || digits.startsWith("98")) {
    return FRENCH_DEPARTMENT_BY_PREFIX[digits.slice(0, 3)] || "";
  }

  return FRENCH_DEPARTMENT_BY_PREFIX[digits.slice(0, 2)] || "";
}

function normalizeExtractionAddress(extraction) {
  const rawAddress = cleanText(extraction.serviceAddress || extraction.address);
  const chunks = splitAddressChunks(rawAddress);
  let street = cleanText(extraction.street);
  let city = cleanText(extraction.city);
  let state = cleanText(extraction.state || extraction.region || extraction.province);
  let postal = cleanText(
    extraction.postal || extraction.postalCode || extraction.zipCode || extraction.zip,
  );
  let country = cleanText(extraction.country);

  if (city && !postal) {
    const parsedCity = parsePostalCity(city);
    postal = postal || parsedCity.postal;
    city = parsedCity.city || city;
  }

  if (postal && !/^[A-Z]{1,3}-?\d{4,6}$/i.test(postal) && !/^\d{4,6}$/.test(postal)) {
    const parsedPostal = parsePostalCity(postal);
    postal = parsedPostal.postal || postal;
    if (!city) city = parsedPostal.city;
  }

  chunks.forEach(function(chunk) {
    const parsed = parsePostalCity(chunk);
    if (!postal && parsed.postal) postal = parsed.postal;
    if (!city && parsed.city) city = parsed.city;
  });

  if (!street) {
    street =
      chunks.find(function(chunk) {
        return /\d/.test(chunk) && !parsePostalCity(chunk).postal;
      }) || "";
  }

  if (!street && chunks[0]) {
    const headLine = chunks[0];
    const parsedHead = parsePostalCity(headLine);
    if (parsedHead.postal && parsedHead.city) {
      street = cleanText(headLine.replace(parsedHead.postal, "").replace(parsedHead.city, ""));
    } else {
      street = headLine;
    }
  }

  if (!country) {
    const tail = chunks[chunks.length - 1] || "";
    if (tail && !/\d/.test(tail) && tail !== city && tail !== state) {
      country = tail;
    }
  }

  if (!state) {
    state = deriveFrenchDepartment(postal, country, rawAddress);
  }

  return {
    street: street,
    city: city,
    state: state,
    postal: postal,
    country: country,
  };
}

function updateBranding() {
  document.querySelectorAll("[data-brand]").forEach(function(node) {
    node.textContent = BRAND;
  });

  document.querySelectorAll("[data-service]").forEach(function(node) {
    node.textContent = SERVICE_LINE;
  });
}

function updateAccountCtas() {
  document.querySelectorAll("[data-account-cta]").forEach(function(node) {
    if (!node.dataset.defaultLabel) {
      node.dataset.defaultLabel = node.textContent.trim() || "Ouvrir un compte";
    }

    node.setAttribute("href", accountState ? "kyc.html" : "open-account.html");
    node.textContent = accountState ? "Continuer mon dossier" : node.dataset.defaultLabel;
  });
}

function initHeader() {
  if (!siteHeader) return;

  const syncHeader = function() {
    siteHeader.classList.toggle("header-scrolled", window.scrollY > 12);
  };

  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  if (navToggle && navbarCollapse) {
    navToggle.addEventListener("click", function() {
      navbarCollapse.classList.toggle("is-open");
    });

    window.addEventListener("click", function(event) {
      if (!navbarCollapse.classList.contains("is-open")) return;
      if (navbarCollapse.contains(event.target)) return;
      if (navToggle.contains(event.target)) return;
      navbarCollapse.classList.remove("is-open");
    });
  }
}

function scrollMessages() {
  if (messages) {
    messages.scrollTop = messages.scrollHeight;
  }
}

function scrollToManualTarget() {
  const target = document.querySelector("[data-chat-manual-target]");
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
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
    return;
  }

  if (crmEmpty) crmEmpty.hidden = true;
  setCrmStatus("Mise à jour", "pending");

  events.forEach(function(event, index) {
    const timer = window.setTimeout(function() {
      renderCrmLog(event);
      if (index === events.length - 1) {
        setCrmStatus(
          timeline.statusLabel || "Compte actif",
          timeline.statusTone || "success",
        );
      }
    }, index * 320);

    timelineTimers.push(timer);
  });
}

function setUploadFeedback(message, tone) {
  const feedback = document.getElementById("uploadFeedback");
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
  currentStep = stage;

  journeyItems.forEach(function(item, itemIndex) {
    item.classList.toggle("is-current", itemIndex === index);
    item.classList.toggle("is-done", itemIndex < index);
  });
}

function syncJourneyStage() {
  if (!journeyItems.length) return;

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
    accountFirstName: accountState.firstName,
    accountLastName: accountState.lastName,
    accountEmail: accountState.contactEmail,
    accountPhone: accountState.phone,
    accountCountry: accountState.country,
  };

  Object.keys(map).forEach(function(key) {
    const field = accountForm.elements[key];
    if (field && map[key]) field.value = map[key];
  });
}

function prefillProfileFromAccount() {
  if (!accountState || !profileForm) return;

  const map = {
    email: accountState.contactEmail,
    firstName: accountState.firstName,
    lastName: accountState.lastName,
    phone: accountState.phone,
    country:
      accountState.country && !looksLikeEmail(accountState.country)
        ? accountState.country
        : "",
  };

  Object.keys(map).forEach(function(key) {
    const field = profileForm.elements[key];
    if (field && !field.value && map[key]) field.value = map[key];
  });
}

function renderAccountState() {
  if (!accountStatus) return;

  if (!accountState) {
    if (accountPill) {
      accountPill.className = "status-badge neutral";
      accountPill.textContent = "À créer";
    }

    accountStatus.innerHTML =
      '<div class="placeholder-title">Aucun compte BayBank actif</div>' +
      "<p>Commencez par créer votre espace client pour débloquer la page de vérification et le journal d'ouverture.</p>";

    if (kycGate) {
      kycGate.className = "gate-banner";
      kycGate.textContent =
        "Créez d'abord votre compte BayBank depuis la page d'ouverture pour activer cette étape.";
    }

    if (fileInput) fileInput.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (createAccountBtn) createAccountBtn.textContent = "Créer mon espace BayBank";
    return;
  }

  const statusText =
    accountState.kycStatus === "approved"
      ? "Compte actif"
      : accountState.kycStatus === "pending_review"
        ? "Revue en cours"
        : "Compte créé";
  const statusTone =
    accountState.kycStatus === "approved"
      ? "success"
      : accountState.kycStatus === "pending_review"
        ? "pending"
        : "neutral";

  if (accountPill) {
    accountPill.className = "status-badge " + statusTone;
    accountPill.textContent = statusText;
  }

  const rows = [];
  const fullName = [accountState.firstName, accountState.lastName].filter(Boolean).join(" ");

  if (fullName) rows.push({ label: "Titulaire", value: fullName });
  if (accountState.contactEmail) {
    rows.push({ label: "Adresse e-mail", value: accountState.contactEmail });
  }
  if (accountState.phone) {
    rows.push({ label: "Téléphone", value: accountState.phone });
  }
  if (accountState.country && !looksLikeEmail(accountState.country)) {
    rows.push({ label: "Pays de résidence", value: accountState.country });
  }
  rows.push({ label: "Compte", value: accountState.accountId });
  rows.push({ label: "Conseiller", value: accountState.owner });

  accountStatus.innerHTML =
    '<div class="summary-grid">' +
    rows
      .map(function(row) {
        return (
          '<div class="summary-row"><span>' +
          escapeHtml(row.label) +
          "</span><strong>" +
          escapeHtml(row.value || "—") +
          "</strong></div>"
        );
      })
      .join("") +
    "</div>";

  if (kycGate) {
    kycGate.className = "gate-banner is-ready";
    kycGate.textContent =
      "Votre compte est prêt. Vous pouvez maintenant envoyer vos documents et finaliser le dossier.";
  }

  if (fileInput) fileInput.disabled = false;
  if (submitBtn) submitBtn.disabled = false;
  if (createAccountBtn) createAccountBtn.textContent = "Mettre à jour mon espace";
}

function updateFileChips(fileName) {
  if (!fileChips || !fileName) return;

  recentFiles = [fileName]
    .concat(
      recentFiles.filter(function(name) {
        return name !== fileName;
      }),
    )
    .slice(0, 3);

  fileChips.innerHTML = "";
  recentFiles.forEach(function(name) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = name;
    fileChips.appendChild(chip);
  });
}

function renderDocumentState() {
  const mapping = {
    identity: {
      statusNode: identityUploadStatus,
      fileNode: identityUploadFile,
      card: document.querySelector('[data-upload-card="identity"]'),
    },
    address: {
      statusNode: addressUploadStatus,
      fileNode: addressUploadFile,
      card: document.querySelector('[data-upload-card="address"]'),
    },
  };

  Object.keys(mapping).forEach(function(key) {
    const config = mapping[key];
    const received = uploadedDocuments.includes(key);
    if (config.statusNode) {
      config.statusNode.textContent = received ? "Reçu" : "En attente";
    }
    if (config.fileNode) {
      config.fileNode.textContent = documentNames[key] || "Aucun fichier envoyé";
    }
    if (config.card) {
      config.card.classList.toggle("is-complete", received);
    }
  });
}

function updateChecklist() {
  if (!checklist) return;

  const items = [
    {
      key: "identity",
      label: "Pièce d'identité",
      sub: "Passeport, carte nationale d'identité ou permis de conduire",
    },
    {
      key: "address",
      label: "Justificatif de domicile",
      sub: "Facture, relevé bancaire, lettre d'assurance ou courrier officiel",
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
      escapeHtml(item.label) +
      "</span>" +
      '<span class="check-state ' +
      (done ? "done" : "pending") +
      '">' +
      (done ? "Complet" : "En attente") +
      "</span>" +
      "</div>" +
      '<div class="check-sub">' +
      escapeHtml(item.sub) +
      "</div>";
    list.appendChild(row);
  });

  checklist.innerHTML = '<div class="check-title">Checklist documentaire</div>';
  checklist.appendChild(list);
}

function fillForm(extraction) {
  if (!profileForm || !extraction) return;

  const normalizedAddress = normalizeExtractionAddress(extraction);
  const map = {
    firstName: extraction.firstName,
    lastName: extraction.lastName,
    dob: extraction.dateOfBirth,
    street: normalizedAddress.street,
    city: normalizedAddress.city,
    state: normalizedAddress.state,
    postal: normalizedAddress.postal,
    country: normalizedAddress.country,
  };

  Object.keys(map).forEach(function(key) {
    const field = profileForm.elements[key];
    if (field && map[key]) field.value = map[key];
  });

  const docNumber = document.getElementById("docNumber");
  const docExpiry = document.getElementById("docExpiry");
  const nationality = document.getElementById("nationality");

  if (docNumber && extraction.documentNumber) {
    docNumber.textContent = extraction.documentNumber;
  }
  if (docExpiry && extraction.dateOfExpiry) {
    docExpiry.textContent = extraction.dateOfExpiry;
  }
  if (nationality && extraction.nationality) {
    nationality.textContent = extraction.nationality;
  }
}

function showValidationBanner(errors, warnings) {
  const slot = document.getElementById("validationFeedback");
  if (!slot) return;

  slot.innerHTML = "";

  if ((!errors.length && !warnings.length)) return;

  const banner = document.createElement("div");
  const isError = errors.length > 0;
  banner.className =
    "validation-banner " + (isError ? "banner-error" : "banner-warning");

  const title = document.createElement("strong");
  title.textContent = isError ? "Points à corriger" : "Points de vigilance";
  banner.appendChild(title);

  const list = document.createElement("ul");
  (isError ? errors : warnings).forEach(function(message) {
    const item = document.createElement("li");
    item.textContent = message;
    list.appendChild(item);
  });

  banner.appendChild(list);
  slot.appendChild(banner);
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

function ensureAccountBeforeKyc(message) {
  if (accountState) return false;

  const text =
    message || "Créez d'abord votre espace BayBank avant d'envoyer des documents.";

  if (result && currentPage === "kyc") {
    result.textContent = text;
  }

  setInlineFeedback(text, "error");
  setUploadFeedback(text, "warning");
  scrollToManualTarget();
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

  let welcome =
    "Bonjour, je peux vous aider à ouvrir votre compte BayBank et à préparer les prochaines étapes.";

  if (currentPage === "kyc") {
    welcome =
      "Bonjour, je peux vous aider à envoyer vos documents, vérifier les pièces acceptées et préremplir le formulaire KYC à partir d'un document valide.";
  }

  say(welcome, "agent");
  chatHistory.push({ role: "assistant", content: welcome });
}

function openChat() {
  if (!chatShell || !chatLauncher) return;
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
      ? "Commencez par créer votre espace BayBank."
      : "Start by creating your BayBank account.";
  }

  if (currentPage !== "kyc") {
    return french
      ? "Votre compte est prêt. Ouvrez maintenant la page de vérification pour envoyer vos documents."
      : "Your account is ready. Open the verification page to upload your documents.";
  }

  const needsIdentity = !uploadedDocuments.includes("identity");
  const needsAddress = !uploadedDocuments.includes("address");

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
    ? "Les deux documents sont reçus. Vérifiez les données puis terminez l'ouverture du compte."
    : "Both documents have been received. Review the extracted data and finish opening the account.";
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
      ? "Bonjour, je peux vous aider sur l'ouverture de compte, les documents acceptés et le remplissage automatique du dossier. " +
          nextStepHint
      : "Hello, I can help with account opening, accepted documents and auto-filling the verification form. " +
          nextStepHint;
  }

  if (wantsDocs) {
    if (french) {
      if (wantsAddress && !wantsIdentity) {
        return (
          "Comme justificatif de domicile, nous acceptons " +
          ADDRESS_DOCUMENTS +
          ". Formats acceptés : " +
          ACCEPTED_CHAT_FORMATS +
          ". " +
          nextStepHint
        );
      }
      if (wantsIdentity && !wantsAddress) {
        return (
          "Pour l'identité, nous acceptons " +
          IDENTITY_DOCUMENTS +
          ". Formats acceptés : " +
          ACCEPTED_CHAT_FORMATS +
          ". " +
          nextStepHint
        );
      }
      return (
        "Nous acceptons comme pièce d'identité " +
        IDENTITY_DOCUMENTS +
        ". Comme justificatif de domicile, nous acceptons " +
        ADDRESS_DOCUMENTS +
        ". Formats acceptés : " +
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
        "For identity, we accept " +
        IDENTITY_DOCUMENTS +
        ". Accepted upload formats: " +
        ACCEPTED_CHAT_FORMATS +
        ". " +
        nextStepHint
      );
    }
    return (
      "We accept " +
      IDENTITY_DOCUMENTS +
      " for identity and " +
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
        "Le dernier document a été refusé pour la raison suivante : " +
        validationErrors.join("; ") +
        ". Merci d'envoyer un document plus clair ou plus récent."
      );
    }
    return (
      "The last document was rejected for this reason: " +
      validationErrors.join("; ") +
      ". Please upload a clearer or more recent document."
    );
  }

  return french
    ? "Je peux vous aider sur l'ouverture de compte, les documents acceptés et l'avancement du dossier. " +
        nextStepHint
    : "I can help with account opening, accepted documents and application status. " +
        nextStepHint;
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
  showProcessing("L'assistant rédige sa réponse", "typing");

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
          accountId: accountState && accountState.accountId,
          currentPage: currentPage,
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
  if (category === "identity") return "pièce d'identité";
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
  const existing = accountState || {};
  const emailHandle = String(formData.accountEmail || "").split("@")[0] || "client";

  return {
    firstName: existing.firstName || "",
    lastName: existing.lastName || "",
    contactEmail: formData.accountEmail,
    phone: formData.accountPhone || existing.phone || "",
    country: existing.country || "",
    accountId: existing.accountId || generateId("acct"),
    customerId: existing.customerId || generateId("client"),
    owner: existing.owner || pickOwner(existing.country || ""),
    accountName: existing.accountName || "Compte " + emailHandle,
    planName: "BayBank Everyday",
    createdAt: existing.createdAt || new Date().toISOString(),
    kycStatus: existing.kycStatus || null,
  };
}

function initAccountPage() {
  if (!accountForm) return;

  accountForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    await initSession();

    const formData = {
      accountEmail: getFormFieldValue(accountForm, "accountEmail"),
      accountPhone: getFormFieldValue(accountForm, "accountPhone"),
      accountPassword: getFormFieldValue(accountForm, "accountPassword"),
    };

    const missing = [];
    if (!formData.accountEmail) missing.push("adresse e-mail");
    if (!formData.accountPhone) missing.push("numéro de téléphone");
    if (!formData.accountPassword || formData.accountPassword.length < 8) {
      missing.push("mot de passe (8 caractères minimum)");
    }

    if (missing.length) {
      setInlineFeedback("Merci de compléter : " + missing.join(", ") + ".", "error");
      return;
    }

    if (!looksLikePhone(formData.accountPhone)) {
      setInlineFeedback("Merci de saisir un numéro de téléphone valide.", "error");
      return;
    }

    journeyFinished = false;
    accountState = createAccountPreview(formData);
    persistAccountState();
    updateAccountCtas();
    prefillAccountForm();
    renderAccountState();
    setInlineFeedback(
      "Compte créé. Redirection vers la page de vérification BayBank…",
      "success",
    );

    window.setTimeout(function() {
      window.location.href = "kyc.html";
    }, 500);
  });
}

function openUploadPicker(intent) {
  if (!fileInput) return;

  if (currentPage !== "kyc") {
    openChat();
    publishAssistantReply(
      "Les documents s'envoient sur la page de vérification. Créez votre compte puis poursuivez sur l'étape KYC pour activer l'auto-remplissage.",
    );
    return;
  }

  if (
    ensureAccountBeforeKyc(
      "Créez votre compte BayBank avant d'envoyer un document depuis cette page.",
    )
  ) {
    return;
  }

  pendingUploadIntent = intent || null;
  fileInput.click();
}

function initUploadFlow() {
  if (uploadIdentityBtn) {
    uploadIdentityBtn.addEventListener("click", function() {
      openUploadPicker("identity");
    });
  }

  if (uploadAddressBtn) {
    uploadAddressBtn.addEventListener("click", function() {
      openUploadPicker("address");
    });
  }

  if (!fileInput) return;

  fileInput.addEventListener("change", async function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const requestedCategory = pendingUploadIntent;
    pendingUploadIntent = null;

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

    const documentCategory = requestedCategory || guessCategory(file.name);
    showProcessing("Vérification de " + file.name + "…");

    try {
      const prepared = await prepareImageForUpload(file);
      const base64 = prepared.base64;
      const mimeType = prepared.mimeType;
      const approxBytes = Math.ceil((base64.length * 3) / 4);

      if (approxBytes > 4 * 1024 * 1024) {
        removeProcessing();
        const tooLargeMessage =
          "Le document est trop volumineux. Merci d'utiliser un fichier plus léger.";
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
          error.error || "La vérification du document a échoué. Merci de réessayer.";
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
            : "Le document ne peut pas être accepté.";
        const rejectionMessage =
          "Document refusé : " +
          issues +
          " Merci d'envoyer un document clair, complet et conforme.";
        validationErrors = checkResult.issues || [];
        setUploadFeedback(rejectionMessage, "error");
        say("Document refusé :\n" + issues, "agent");
        event.target.value = "";
        return;
      }

      const detectedCategory = checkResult.detectedCategory || documentCategory;
      const categoryLabel = getCategoryLabel(detectedCategory);

      if (checkResult.warnings && checkResult.warnings.length) {
        setUploadFeedback(
          "Document accepté comme " + categoryLabel + " avec remarques.",
          "warning",
        );
        say(
          "Document accepté comme " +
            categoryLabel +
            ". Notes : " +
            checkResult.warnings.join("; ") +
            ". Extraction des informations en cours.",
          "agent",
        );
      } else {
        setUploadFeedback("Document accepté comme " + categoryLabel + ".", "success");
        say(
          "Document accepté comme " +
            categoryLabel +
            ". Extraction des informations en cours.",
          "agent",
        );
      }

      showProcessing("Extraction des informations depuis " + file.name + "…");

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
          error.error || "Le téléversement a échoué. Merci de réessayer.";
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
      if (effectiveCategory === "identity" || effectiveCategory === "address") {
        documentNames[effectiveCategory] = file.name;
      }

      validationErrors = validation.errors || [];
      validationWarnings = validation.warnings || [];

      renderDocumentState();
      updateChecklist();
      showValidationBanner(validationErrors, validationWarnings);

      if (effectiveCategory === "identity" || effectiveCategory === "address") {
        fillForm(extraction);
        prefillProfileFromAccount();
      }

      syncJourneyStage();

      if (validation.passed) {
        setUploadFeedback(
          "Informations extraites avec succès. Le formulaire a été rempli automatiquement.",
          "success",
        );
        say(
          "Les informations ont été extraites avec succès. Le formulaire KYC a été prérempli. Vérifiez les champs puis terminez l'ouverture du compte.",
          "agent",
        );
      } else {
        const validationMessage =
          "Le document a été traité avec des points de vigilance : " +
          validationErrors.join(" ") +
          " Merci de corriger les informations ou d'envoyer un document plus précis.";
        setUploadFeedback(validationMessage, "warning");
        say(
          "Le document a été traité avec des points de vigilance :\n" +
            validationErrors.join("\n"),
          "agent",
        );
      }
    } catch (error) {
      removeProcessing();
      console.error("Upload error:", error);
      const message =
        "Une erreur est survenue pendant le traitement du document. Merci de réessayer.";
      setUploadFeedback(message, "error");
      say(message, "agent");
    } finally {
      event.target.value = "";
    }
  });
}

function initSubmitFlow() {
  if (!submitBtn) return;

  submitBtn.addEventListener("click", async function(event) {
    event.preventDefault();
    await initSession();

    if (ensureAccountBeforeKyc()) return;

    const missingDocuments = [];
    if (!uploadedDocuments.includes("identity")) {
      missingDocuments.push("pièce d'identité");
    }
    if (!uploadedDocuments.includes("address")) {
      missingDocuments.push("justificatif de domicile");
    }

    if (missingDocuments.length) {
      const message =
        "Merci d'ajouter encore : " + missingDocuments.join(" et ") + ".";
      if (result) result.textContent = message;
      setUploadFeedback(message, "warning");
      syncJourneyStage();
      return;
    }

    showProcessing("Vérification finale du dossier…");

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
          "La soumission a échoué : " + (error.error || "merci de réessayer.");
        if (result) result.textContent = message;
        say(message, "agent");
        return;
      }

      const submission = await response.json();
      journeyFinished = true;

      accountState = Object.assign({}, accountState, {
        firstName: profileData.firstName || accountState.firstName,
        lastName: profileData.lastName || accountState.lastName,
        phone: profileData.phone || accountState.phone,
        country: profileData.country || accountState.country,
        kycStatus: submission.status,
        submissionId: submission.submissionId,
        submittedAt: submission.submittedAt,
        accountId:
          (submission.accountTimeline && submission.accountTimeline.accountId) ||
          accountState.accountId,
        customerId:
          (submission.accountTimeline && submission.accountTimeline.customerId) ||
          accountState.customerId,
      });
      persistAccountState();
      updateAccountCtas();
      renderAccountState();
      syncJourneyStage();

      const timeline = submission.accountTimeline || null;

      if (submission.status === "approved") {
        if (result) {
          result.textContent =
            "Compte activé. Votre dossier a été validé et votre espace BayBank est prêt.";
        }
        say(
          "Le dossier est validé. Votre compte BayBank est activé et le profil client a bien été enregistré.",
          "agent",
        );
      } else {
        if (result) {
          result.textContent =
            "Dossier transmis. L'ouverture de compte se poursuit pendant la revue du dossier.";
        }
        say(
          "Le dossier a bien été transmis. La revue est en cours et le journal d'ouverture continue à se mettre à jour.",
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
          "Points signalés pour la revue :\n" +
            submission.reconciliation.suspiciousSignals.join("\n"),
          "agent",
        );
      }
    } catch (error) {
      removeProcessing();
      console.error("Submit error:", error);
      const message =
        "La soumission a échoué à cause d'une erreur réseau. Merci de réessayer.";
      if (result) result.textContent = message;
      say(message, "agent");
    }
  });
}

function initChat() {
  if (!chatShell || !chatLauncher) return;

  if (chatAttachBtn && currentPage !== "kyc") {
    chatAttachBtn.hidden = true;
  }

  chatLauncher.addEventListener("click", openChat);

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
      scrollToManualTarget();
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
      openUploadPicker(null);
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
      if (!input) return;
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
}

(async function init() {
  updateBranding();
  updateAccountCtas();
  initHeader();
  if (accountState) persistAccountState();
  prefillAccountForm();
  prefillProfileFromAccount();
  renderAccountState();
  renderDocumentState();
  updateChecklist();
  syncJourneyStage();
  initAccountPage();
  initUploadFlow();
  initSubmitFlow();
  initChat();
  updateChatShell();

  if (accountState && accountState.kycStatus) {
    setCrmStatus(
      accountState.kycStatus === "approved" ? "Compte actif" : "Revue en cours",
      accountState.kycStatus === "approved" ? "success" : "pending",
    );
  } else {
    setCrmStatus("En attente", "neutral");
  }

  await initSession();
})();
