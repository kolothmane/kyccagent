const BRAND = (window.BRANDING && window.BRANDING.name) || "Bay4Bank";
const SERVICE_LINE =
  (window.BRANDING && window.BRANDING.serviceLine) || "Banque digitale nouvelle génération";
const ACCOUNT_STORAGE_KEY = "baybankAccountState";
const AUTH_TOKEN_STORAGE_KEY = "baybankAuthToken";
const ADMIN_ESCALATIONS_STORAGE_KEY = "baybankAdminEscalations";
const ADMIN_DOCUMENT_PREVIEWS_KEY = "baybankAdminDocumentPreviews";
const ADMIN_DELETED_ESCALATIONS_KEY = "baybankDeletedEscalations";
const CHAT_REQUEST_TIMEOUT_MS = 12000;
const CRM_BLOCK_READ_MS = 2600;
const CRM_LOADING_MS = 1000;
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
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginFormMessage = document.getElementById("loginFormMessage");
const logoutBtn = document.getElementById("logoutBtn");
const accountSessionActions = document.getElementById("accountSessionActions");
const accountStatus = document.getElementById("accountStatus");
const clientStatusBadge = document.getElementById("clientStatusBadge");
const clientGreeting = document.getElementById("clientGreeting");
const clientIntro = document.getElementById("clientIntro");
const clientIdentitySummary = document.getElementById("clientIdentitySummary");
const clientLockedState = document.getElementById("clientLockedState");
const clientDashboard = document.getElementById("clientDashboard");
const clientIban = document.getElementById("clientIban");
const clientCardHolder = document.getElementById("clientCardHolder");
const clientProfileGrid = document.getElementById("clientProfileGrid");
const clientAvailableBalance = document.getElementById("clientAvailableBalance");
const clientMonthlyLimit = document.getElementById("clientMonthlyLimit");
const clientCardLast4 = document.getElementById("clientCardLast4");
const clientOnlinePayments = document.getElementById("clientOnlinePayments");
const clientRecentCardPayment = document.getElementById("clientRecentCardPayment");
const clientRecentIncomingTransfer = document.getElementById("clientRecentIncomingTransfer");

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
const chatInfoBtn = document.getElementById("chatInfoBtn");
const chatMenuBtn = document.getElementById("chatMenuBtn");
const chatMenu = document.getElementById("chatMenu");
const chatAttachActionBtn = document.getElementById("chatAttachAction");
const chatOpenManualBtn = document.getElementById("chatOpenManual");
const chatCloseActionBtn = document.getElementById("chatCloseAction");
const chatAttachBtn = document.getElementById("chatAttachBtn");
const chatExpandBtn = document.getElementById("chatExpand");
const chatMinimizeBtn = document.getElementById("chatMinimize");
const chatCloseBtn = document.getElementById("chatClose");
const chatQuickActionButtons = document.querySelectorAll(".chat-quick-action");
const openChatButtons = document.querySelectorAll("[data-open-chat]");
const CHAT_AGENT_ICON_SVG =
  '<span class="chat-agent-mark"><svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M19.3786 16.9969H19.3909C18.8863 17.04 18.437 17.1262 18.0493 17.2492C18.0493 17.2492 17.4832 17.4277 16.6155 17.5508C16.4124 17.5816 16.154 17.5816 16.0124 17.5816H15.9078C15.7663 17.5816 15.5017 17.5692 15.3047 17.5385C14.437 17.3969 13.877 17.2 13.877 17.2C13.4893 17.0769 13.0401 16.9846 12.5355 16.9292C9.77243 16.6462 8.57858 17.6985 8.51089 17.8954C8.4432 18.0923 8.74473 20.6523 8.96627 21.0585C9.18166 21.4585 9.51396 21.6923 9.8155 21.8216C10.1232 21.9508 12.6524 22.2031 13.4955 22.0862C14.3386 21.9692 14.4678 21.6862 14.6955 21.2554C14.8555 20.9477 15.2678 19.5569 15.4955 18.7385C15.5509 18.5785 15.557 18.2585 15.9447 18.2339C16.3324 18.2646 16.3386 18.5908 16.3878 18.7508C16.6093 19.5692 16.997 20.9723 17.1509 21.28C17.3663 21.7169 17.4955 22 18.3386 22.1354C19.1755 22.2646 21.7109 22.0616 22.0186 21.9385C22.3263 21.8154 22.6586 21.5877 22.8801 21.1877C23.1017 20.7877 23.4463 18.2339 23.3847 18.0369C23.3232 17.8339 22.1478 16.7631 19.3786 16.9969Z"></path><path d="M28.0124 8.95386H28.0186C27.2494 7.9754 26.3386 7.10771 25.3294 6.36309C26.3755 6.17848 27.1694 5.26771 27.1694 4.17232C27.1694 2.94155 26.1724 1.93848 24.9355 1.93848C23.6986 1.93848 22.7017 2.9354 22.7017 4.17232C22.7017 4.41848 22.7509 4.65232 22.8247 4.87386C21.237 4.12309 19.5017 3.63078 17.6863 3.44002C14.6463 3.12002 11.7109 3.66155 9.18166 4.8554C9.24935 4.64001 9.29858 4.41232 9.29858 4.17232C9.29858 2.94155 8.30166 1.93848 7.06473 1.93848C5.82781 1.93848 4.83089 2.9354 4.83089 4.17232C4.83089 5.26771 5.61858 6.17232 6.65243 6.36309C3.78473 8.48001 1.78473 11.5631 1.32935 15.1385C0.904735 18.4431 1.84627 21.7539 3.98781 24.4616C6.41243 27.5262 10.1786 29.5385 14.314 29.9754C14.8924 30.0369 15.4647 30.0677 16.0309 30.0677C23.4094 30.0677 29.797 25.0585 30.6709 18.2769C31.0955 14.9723 30.154 11.6616 28.0124 8.95386ZM16.0124 26.2523H16.0063C10.4555 26.2462 5.93858 22.5416 5.93858 17.9877C5.93858 16.6154 6.35704 15.2985 7.11397 14.1292C7.18166 14.5477 7.30473 14.9108 7.44012 15.1816C7.62473 15.5508 7.99397 15.7662 8.38166 15.7662C8.5355 15.7662 8.6955 15.7354 8.8432 15.6616C9.36627 15.4092 9.58166 14.7816 9.34166 14.2585C9.21243 13.9816 8.88012 13.0646 9.68627 12.3631C10.4678 13.0708 11.5878 13.9016 12.8493 14.3077C15.2001 15.0523 16.9786 14.6154 17.0524 14.5969C17.4093 14.5046 17.6863 14.24 17.797 13.8892C17.9078 13.5385 17.8278 13.1569 17.5878 12.8862C16.4001 11.52 15.834 10.5231 15.5878 9.92002C20.4001 10.5723 21.3232 14.4062 21.3601 14.5785C21.4647 15.0708 21.9017 15.4092 22.3878 15.4092C22.4617 15.4092 22.5294 15.4031 22.6032 15.3846C23.1755 15.2677 23.5386 14.7077 23.4217 14.1354C23.274 13.4216 22.8863 12.4554 22.197 11.4892C24.554 13.0031 26.0801 15.3539 26.0801 17.9939C26.0801 22.5477 21.5632 26.2523 16.0124 26.2523Z"></path></svg></span>';

let sessionId = sessionStorage.getItem("kycSessionId") || null;
let authSessionToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
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
let chatIsExpanded = false;
let chatHasWelcomed = false;
let chatIntroPlayed = false;
let chatIntroTimers = [];
let timelineTimers = [];
let pendingUploadIntent = null;

const documentNames = {
  identity: "",
  address: "",
};

const documentAssets = {
  identity: null,
  address: null,
};

function readStoredJson(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function readAuthToken() {
  return String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
}

function persistAuthToken(token) {
  authSessionToken = String(token || "").trim();

  if (authSessionToken) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authSessionToken);
  } else {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
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

  if (!next.contactEmail && next.email) {
    next.contactEmail = cleanText(next.email).toLowerCase();
  }
  if (!next.email && next.contactEmail) {
    next.email = next.contactEmail;
  }

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

function applyAccountState(nextState) {
  accountState = sanitizeAccountState(nextState);
  persistAccountState();

  if (
    accountState &&
    accountState.kycSessionId &&
    (!sessionId || sessionId !== accountState.kycSessionId)
  ) {
    sessionId = accountState.kycSessionId;
    sessionStorage.setItem("kycSessionId", sessionId);
  }
}

function clearAccountSessionState() {
  persistAuthToken("");
  accountState = null;
  sessionId = null;
  sessionStorage.removeItem(ACCOUNT_STORAGE_KEY);
  sessionStorage.removeItem("kycSessionId");
}

function persistAccountState() {
  if (accountState) {
    accountState = sanitizeAccountState(accountState);
    sessionStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accountState));
  } else {
    sessionStorage.removeItem(ACCOUNT_STORAGE_KEY);
  }
}

function readAdminEscalations() {
  return readStoredJson(localStorage.getItem(ADMIN_ESCALATIONS_STORAGE_KEY)) || [];
}

function writeAdminEscalations(items) {
  localStorage.setItem(ADMIN_ESCALATIONS_STORAGE_KEY, JSON.stringify(items || []));
}

function readDeletedAdminEscalations() {
  return readStoredJson(localStorage.getItem(ADMIN_DELETED_ESCALATIONS_KEY)) || [];
}

function isDeletedAdminEscalation(ref) {
  const deletedItems = readDeletedAdminEscalations();
  if (!Array.isArray(deletedItems) || !deletedItems.length) return false;

  return deletedItems.some(function(item) {
    return Boolean(
      (ref.escalationId && item.escalationId === ref.escalationId) ||
        (ref.submissionId && item.submissionId === ref.submissionId) ||
        (ref.sessionId && item.sessionId === ref.sessionId) ||
        (ref.fingerprint && item.fingerprint === ref.fingerprint),
    );
  });
}

function buildAdminEscalationFingerprint(submission, profileData) {
  const fullName = [profileData && profileData.firstName, profileData && profileData.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const reason =
    (submission &&
      submission.humanReview &&
      (submission.humanReview.message ||
        ((submission.humanReview.reasons || []).join(" | ")))) ||
    "";
  const accountId =
    (submission &&
      submission.accountTimeline &&
      submission.accountTimeline.accountId) ||
    (accountState && accountState.accountId) ||
    "";
  const submittedAt = (submission && submission.submittedAt) || "";

  return [accountId, submittedAt, fullName, reason].join("::");
}

function readAdminDocumentPreviews() {
  return readStoredJson(localStorage.getItem(ADMIN_DOCUMENT_PREVIEWS_KEY)) || {};
}

function writeAdminDocumentPreviews(previews) {
  try {
    localStorage.setItem(ADMIN_DOCUMENT_PREVIEWS_KEY, JSON.stringify(previews || {}));
  } catch (error) {
    console.error("Document preview storage error:", error);
  }
}

function persistDocumentPreview(category, asset) {
  if (!sessionId || !category || !asset || !asset.previewUrl) return;

  const previews = readAdminDocumentPreviews();
  const current = previews[sessionId] || {};
  current[category] = {
    fileName: asset.fileName || "",
    previewUrl: asset.previewUrl,
    mimeType: asset.mimeType || "image/jpeg",
  };
  previews[sessionId] = current;
  writeAdminDocumentPreviews(previews);
}

function getStoredDocumentPreview(category) {
  if (!sessionId || !category) return null;
  const previews = readAdminDocumentPreviews();
  return previews[sessionId] && previews[sessionId][category]
    ? previews[sessionId][category]
    : null;
}

function upsertAdminEscalation(item) {
  const items = readAdminEscalations();
  const index = items.findIndex(function(existing) {
    return (
      (item.escalationId && existing.escalationId === item.escalationId) ||
      (item.submissionId && existing.submissionId === item.submissionId) ||
      (item.sessionId && existing.sessionId === item.sessionId)
    );
  });

  if (index >= 0) {
    items[index] = Object.assign({}, items[index], item);
  } else {
    items.unshift(item);
  }

  writeAdminEscalations(items);
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

function persistAdminHumanReviewCase(submission, profileData) {
  if (!submission || !submission.humanReview || !submission.humanReview.required) return;

  const ref = {
    escalationId: submission.escalationId || "",
    submissionId: submission.submissionId || "",
    fingerprint: buildAdminEscalationFingerprint(submission, profileData),
  };

  if (isDeletedAdminEscalation(ref)) return;

  upsertAdminEscalation({
    escalationId: submission.escalationId || "esc_" + generateId("local"),
    sessionId: sessionId,
    submissionId: submission.submissionId,
    submittedAt: submission.submittedAt,
    updatedAt: submission.submittedAt,
    status: "pending",
    humanReview: submission.humanReview,
    reconciliation: submission.reconciliation || {},
    account: {
      accountId:
        (submission.accountTimeline && submission.accountTimeline.accountId) ||
        (accountState && accountState.accountId),
      customerId:
        (submission.accountTimeline && submission.accountTimeline.customerId) ||
        (accountState && accountState.customerId),
      owner:
        (submission.accountTimeline && submission.accountTimeline.owner) ||
        (accountState && accountState.owner),
      accountName: accountState && accountState.accountName,
    },
    client: {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: profileData.email,
      phone: profileData.phone,
      country: profileData.country,
      dob: profileData.dob,
      street: profileData.street,
      city: profileData.city,
      state: profileData.state,
      postal: profileData.postal,
    },
    documents: [
      {
        category: "identity",
        label: "Pièce d'identité",
        fileName: documentNames.identity || "Document d'identité",
        extraction: identityExtraction || {},
        previewUrl:
          (documentAssets.identity && documentAssets.identity.previewUrl) ||
          (getStoredDocumentPreview("identity") &&
            getStoredDocumentPreview("identity").previewUrl),
      },
      {
        category: "address",
        label: "Justificatif de domicile",
        fileName: documentNames.address || "Justificatif de domicile",
        extraction: addressExtraction || {},
        previewUrl:
          (documentAssets.address && documentAssets.address.previewUrl) ||
          (getStoredDocumentPreview("address") &&
            getStoredDocumentPreview("address").previewUrl),
      },
    ],
    crmLogs: null,
  });
}

function scrollMessages() {
  if (messages) messages.scrollTop = messages.scrollHeight;
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

function isAccountApproved(account) {
  return Boolean(account && account.kycStatus === "approved");
}

function getAccountDestination(account) {
  if (!account) return "open-account.html";
  return isAccountApproved(account) ? "client.html" : "kyc.html";
}

function getAccountDestinationLabel(account) {
  if (!account) return "Ouvrir un compte";
  return isAccountApproved(account) ? "Accéder à mon espace" : "Continuer mon dossier";
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

    node.setAttribute("href", getAccountDestination(accountState));
    node.textContent = accountState
      ? getAccountDestinationLabel(accountState)
      : node.dataset.defaultLabel;
  });

  document.querySelectorAll("[data-client-destination]").forEach(function(node) {
    const approved = isAccountApproved(accountState);
    const label = approved
      ? node.dataset.approvedLabel || "Mon espace"
      : node.dataset.pendingLabel || "Mon dossier";

    node.setAttribute("href", approved ? "client.html" : "kyc.html");
    node.textContent = label;
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

function setLoginFeedback(message, tone) {
  if (!loginFormMessage) return;

  loginFormMessage.className = "inline-feedback";
  if (tone) loginFormMessage.classList.add("is-" + tone);
  loginFormMessage.textContent = message || "";
}

function syncAccountAuthControls() {
  const authenticated = Boolean(authSessionToken && accountState);

  if (accountSessionActions) {
    accountSessionActions.hidden = !authenticated;
  }

  if (logoutBtn) {
    logoutBtn.hidden = !authenticated;
  }

  if (loginForm) {
    Array.from(loginForm.elements || []).forEach(function(field) {
      field.disabled = authenticated;
    });
  }

  if (accountForm) {
    Array.from(accountForm.elements || []).forEach(function(field) {
      if (field === createAccountBtn) return;
      field.disabled = authenticated;
    });
  }

  if (createAccountBtn) {
    createAccountBtn.textContent = authenticated
      ? getAccountDestinationLabel(accountState)
      : "Créer mon espace Bay4Bank";
  }

  if (authenticated) {
    setLoginFeedback("Session active. Vous pouvez reprendre votre dossier.", "success");
  } else if (loginFormMessage && !loginFormMessage.textContent) {
    setLoginFeedback("", "");
  }
}

async function hydrateAuthenticatedAccount() {
  authSessionToken = readAuthToken();
  if (!authSessionToken) return;

  try {
    const response = await fetch("/api/auth/session", {
      headers: {
        Authorization: "Bearer " + authSessionToken,
      },
    });

    if (!response.ok) {
      clearAccountSessionState();
      return;
    }

    const payload = await response.json();
    applyAccountState(payload.account);
  } catch (error) {
    console.error("Account hydration error:", error);
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

function setResultMessage(message, tone) {
  if (!result) return;

  result.className = "result-card";
  if (tone) result.classList.add("is-" + tone);
  result.textContent = message || "";
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

function renderCrmLoading(message) {
  if (!crmFeed) return;
  if (crmEmpty) crmEmpty.hidden = true;

  crmFeed.innerHTML =
    '<div class="crm-loader">' +
    '<div class="crm-loader-copy">' +
    escapeHtml(message || "Chargement de l'étape suivante…") +
    "</div>" +
    '<div class="crm-loader-bars">' +
    "<span></span>" +
    "<span></span>" +
    "<span></span>" +
    "</div>" +
    "</div>";
}

function renderCrmLog(log, index, total) {
  if (!crmFeed) return;
  if (crmEmpty) crmEmpty.hidden = true;

  const item = document.createElement("article");
  item.className = "crm-item";
  if (log && log.kind === "human-review") {
    item.classList.add("is-human-review");
  }

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
    '<div class="crm-footer">' +
    "<time>" +
    escapeHtml(displayTime) +
    "</time>" +
    '<span class="crm-step">Bloc ' +
    escapeHtml(String(index + 1)) +
    " / " +
    escapeHtml(String(total)) +
    "</span>" +
    "</div>" +
    "</div>";

  crmFeed.innerHTML = "";
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
  setCrmStatus("Traitement en cours", "pending");
  renderCrmLoading("Préparation du journal d'ouverture…");

  let delay = CRM_LOADING_MS;

  events.forEach(function(event, index) {
    timelineTimers.push(
      window.setTimeout(function() {
        renderCrmLog(event, index, events.length);

        if (index === events.length - 1) {
          setCrmStatus(
            timeline.statusLabel || "Compte actif",
            timeline.statusTone || "success",
          );
        }
      }, delay),
    );

    delay += CRM_BLOCK_READ_MS;

    if (index < events.length - 1) {
      timelineTimers.push(
        window.setTimeout(function() {
          renderCrmLoading("Chargement du prochain bloc d'ouverture…");
        }, delay),
      );
      delay += CRM_LOADING_MS;
    }
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

function createAgentAvatar() {
  const avatar = document.createElement("div");
  avatar.className = "chat-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.innerHTML = CHAT_AGENT_ICON_SVG;
  return avatar;
}

function syncChatComposerState() {
  if (!sendBtn || !input) return;
  sendBtn.disabled = !input.value.trim();
}

function clearChatIntroTimers() {
  if (!chatIntroTimers.length) return;
  chatIntroTimers.forEach(function(timer) {
    window.clearTimeout(timer);
  });
  chatIntroTimers = [];
}

function createChatIntroLoader() {
  const loader = document.createElement("span");
  loader.className = "chat-ellipsis-loader";
  loader.setAttribute("aria-hidden", "true");

  for (let index = 0; index < 3; index += 1) {
    const dot = document.createElement("span");
    loader.appendChild(dot);
  }

  return loader;
}

function showChatIntroLoader(item) {
  if (!item) return;

  if (!item.dataset.chatIntroHtml) {
    item.dataset.chatIntroHtml = item.innerHTML;
  }

  item.classList.remove("is-visible");
  item.classList.add("is-loading");
  item.innerHTML = "";
  item.appendChild(createChatIntroLoader());
}

function revealChatIntroItem(item) {
  if (!item) return;

  if (item.dataset.chatIntroHtml) {
    item.innerHTML = item.dataset.chatIntroHtml;
  }

  item.classList.remove("is-loading");
  item.classList.add("is-visible");
}

function revealChatIntro() {
  const emptyState = document.getElementById("emptyState");
  if (!emptyState) return;

  const introItems = emptyState.querySelectorAll("[data-chat-intro]");
  if (!introItems.length) return;

  clearChatIntroTimers();

  if (chatIntroPlayed) {
    introItems.forEach(function(item) {
      item.classList.add("is-visible");
    });
    return;
  }

  introItems.forEach(function(item) {
    item.classList.remove("is-visible", "is-loading");
  });

  showChatIntroLoader(introItems[0]);
  showChatIntroLoader(introItems[1]);

  const delays = [760, 1460, 1740];
  introItems.forEach(function(item, index) {
    const delay = delays[index] || 220 + index * 320;
    const timer = window.setTimeout(function() {
      if (!document.body.contains(item)) return;
      revealChatIntroItem(item);
      scrollMessages();
    }, delay);
    chatIntroTimers.push(timer);
  });

  chatIntroPlayed = true;
}

function appendChatRow(who, bubble) {
  if (!messages || !bubble) return null;

  const row = document.createElement("div");
  row.className = "chat-message-row " + (who === "user" ? "user" : "agent");

  if (who !== "user") {
    row.appendChild(createAgentAvatar());
  }

  row.appendChild(bubble);
  messages.appendChild(row);

  const emptyState = document.getElementById("emptyState");
  if (emptyState) {
    clearChatIntroTimers();
    emptyState.remove();
  }

  scrollMessages();

  if (who !== "user" && !chatIsOpen && chatUnread) {
    chatUnread.hidden = false;
  }

  return row;
}

function say(text, who) {
  if (!messages) return;

  const bubble = document.createElement("div");
  bubble.className = "msg " + (who || "agent");
  bubble.textContent = text;
  appendChatRow(who || "agent", bubble);
}

function showProcessing(label, variant) {
  removeProcessing();
  if (!messages) return null;

  const bubble = document.createElement("div");
  bubble.className = "msg agent processing";
  bubble.id = "processingMsg";

  if (variant === "typing") {
    bubble.classList.add("processing-skeleton");
    for (let i = 0; i < 3; i += 1) {
      const line = document.createElement("span");
      line.className = "typing-line";
      bubble.appendChild(line);
    }
  } else {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    bubble.appendChild(spinner);
    bubble.appendChild(document.createTextNode(" " + label));
    setPageStatus(label);
  }

  const row = appendChatRow("agent", bubble);
  if (row) row.id = "processingMsgRow";
  return bubble;
}

function removeProcessing() {
  const row = document.getElementById("processingMsgRow");
  if (row) {
    row.remove();
    setPageStatus("");
    return;
  }

  const element = document.getElementById("processingMsg");
  if (element) {
    const rowParent =
      element.parentElement && element.parentElement.classList.contains("chat-message-row")
        ? element.parentElement
        : null;
    if (rowParent) rowParent.remove();
    else element.remove();
  }
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
    accountEmail: accountState.contactEmail,
    accountPhone: accountState.phone,
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
    dob: accountState.dob,
    street: accountState.street,
    city: accountState.city,
    state: accountState.state,
    postal: accountState.postal,
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

    setCrmStatus("En attente", "neutral");
    accountStatus.innerHTML =
      '<div class="placeholder-title">Aucun compte Bay4Bank actif</div>' +
      "<p>Commencez par créer votre espace client pour débloquer la page de vérification et le journal d'ouverture.</p>";

    if (kycGate) {
      kycGate.className = "gate-banner";
      kycGate.textContent =
        "Créez d'abord votre compte Bay4Bank depuis la page d'ouverture pour activer cette étape.";
    }

    if (fileInput) fileInput.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    syncAccountAuthControls();
    return;
  }

  const statusText =
    accountState.humanReviewRequired
      ? "Agent humain saisi"
      : accountState.kycStatus === "approved"
      ? "Compte actif"
      : accountState.kycStatus === "rejected"
        ? "Dossier refusé"
      : accountState.kycStatus === "pending_review"
        ? "Revue en cours"
        : "Compte créé";
  const statusTone =
    accountState.humanReviewRequired
      ? "alert"
      : accountState.kycStatus === "approved"
      ? "success"
      : accountState.kycStatus === "rejected"
        ? "alert"
      : accountState.kycStatus === "pending_review"
        ? "pending"
        : "neutral";

  if (accountPill) {
    accountPill.className = "status-badge " + statusTone;
    accountPill.textContent = statusText;
  }

  setCrmStatus(statusText, statusTone);

  const rows = [];
  const fullName = [accountState.firstName, accountState.lastName].filter(Boolean).join(" ");

  if (fullName) rows.push({ label: "Titulaire", value: fullName });
  if (accountState.contactEmail) {
    rows.push({ label: "Adresse e-mail", value: accountState.contactEmail });
  }
  if (accountState.phone) {
    rows.push({ label: "Téléphone", value: accountState.phone });
  }
  if (accountState.submittedAt) {
    rows.push({
      label: "Dossier transmis",
      value: new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(accountState.submittedAt)),
    });
  }
  if (accountState.humanReviewRequired) {
    rows.push({ label: "Revue", value: "Agent humain assigné" });
  }
  if (accountState.kycStatus === "rejected") {
    rows.push({ label: "Décision", value: "Refusé après revue humaine" });
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
    if (accountState.humanReviewRequired) {
      kycGate.className = "gate-banner";
      kycGate.textContent =
        accountState.humanReviewReason ||
        "Une anomalie a été détectée. Le dossier a été remonté à un agent humain pour revue.";
    } else if (accountState.kycStatus === "rejected") {
      kycGate.className = "gate-banner";
      kycGate.textContent =
        accountState.humanReviewReason ||
        "Le dossier a été refusé après revue. Merci de reprendre les documents ou de contacter Bay4Bank.";
    } else {
      kycGate.className = "gate-banner is-ready";
      kycGate.textContent =
        "Votre compte est prêt. Vous pouvez maintenant envoyer vos documents et finaliser le dossier.";
    }
  }

  if (fileInput) fileInput.disabled = false;
  if (submitBtn) submitBtn.disabled = false;
  syncAccountAuthControls();
}

function formatClientDate(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function centsValue(value, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;
  return Math.round(number);
}

function getClientFinancials(account) {
  const financials = (account && account.financials) || {};

  return {
    availableBalanceCents: centsValue(financials.availableBalanceCents, 42075),
    monthlyLimitCents: Math.max(0, centsValue(financials.monthlyLimitCents, 150000)),
    recentCardPaymentCents: Math.max(0, centsValue(financials.recentCardPaymentCents, 1290)),
    recentIncomingTransferCents: Math.max(
      0,
      centsValue(financials.recentIncomingTransferCents, 25000),
    ),
    cardLast4: String(financials.cardLast4 || "4821").replace(/\D/g, "").slice(-4) || "4821",
    onlinePaymentsEnabled:
      typeof financials.onlinePaymentsEnabled === "boolean"
        ? financials.onlinePaymentsEnabled
        : true,
  };
}

function formatClientMoney(cents, options) {
  const sign = options && options.sign ? options.sign : "";
  const value = centsValue(cents, 0) / 100;
  const displayValue = sign ? Math.abs(value) : value;
  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(displayValue);

  return sign + formatted;
}

function buildClientIban(account) {
  const source = String((account && account.accountId) || "bay4bank")
    .replace(/\D/g, "")
    .padEnd(18, "4")
    .slice(0, 18);

  return [
    "FR76",
    "3000",
    "4000",
    source.slice(0, 4),
    source.slice(4, 8),
    source.slice(8, 12),
    source.slice(12, 16),
    source.slice(16, 18),
  ].join(" ");
}

function renderClientInfoGrid(target, rows) {
  if (!target) return;

  target.innerHTML = rows
    .map(function(row) {
      return (
        "<div>" +
        "<span>" +
        escapeHtml(row.label) +
        "</span><strong>" +
        escapeHtml(row.value || "—") +
        "</strong></div>"
      );
    })
    .join("");
}

function renderClientLockedState(kind) {
  if (!clientLockedState || !clientDashboard) return;

  clientDashboard.hidden = true;
  clientLockedState.hidden = false;

  const needsLogin = kind === "login" || !authSessionToken || !accountState;
  const isRejected = accountState && accountState.kycStatus === "rejected";
  const isPending = accountState && accountState.kycStatus === "pending_review";
  const title = needsLogin
    ? "Connectez-vous à votre compte Bay4Bank"
    : isRejected
      ? "Votre demande nécessite une reprise"
      : isPending || accountState.humanReviewRequired
        ? "Votre dossier est encore en revue"
        : "Votre espace client n'est pas encore activé";
  const detail = needsLogin
    ? "L'espace client bancaire s'ouvre après connexion et validation du dossier."
    : isRejected
      ? accountState.humanReviewReason ||
        "Le dossier a été refusé après revue humaine. Vous pouvez revenir au dossier pour reprendre les informations."
      : "Dès que la validation est terminée, vous accédez automatiquement à votre compte courant, vos cartes et vos opérations.";
  const actionHref = needsLogin ? "open-account.html" : "kyc.html";
  const actionLabel = needsLogin ? "Se connecter" : "Voir mon dossier";

  clientLockedState.innerHTML =
    '<div class="client-locked-card">' +
    '<span class="section-kicker" data-icon="' +
    escapeHtml(kind || "lock") +
    '">' +
    escapeHtml(needsLogin ? "Accès sécurisé" : "Dossier client") +
    "</span>" +
    "<h2>" +
    escapeHtml(title) +
    "</h2>" +
    "<p>" +
    escapeHtml(detail) +
    "</p>" +
    '<a href="' +
    escapeHtml(actionHref) +
    '" class="button button-primary" data-icon="' +
    escapeHtml(needsLogin ? "login" : "description") +
    '">' +
    escapeHtml(actionLabel) +
    "</a>" +
    "</div>";

  if (clientStatusBadge) {
    clientStatusBadge.className = "status-badge " + (isRejected ? "alert" : "pending");
    clientStatusBadge.textContent = needsLogin ? "Connexion requise" : "Validation en cours";
  }

  if (clientGreeting) {
    clientGreeting.textContent = title;
  }

  if (clientIntro) {
    clientIntro.textContent = detail;
  }

  if (clientIdentitySummary) {
    clientIdentitySummary.innerHTML =
      "<p>Les informations du compte apparaîtront ici dès l'activation.</p>";
  }
}

function renderClientSpace() {
  if (currentPage !== "client") return;
  if (!clientDashboard || !clientLockedState) return;

  if (!authSessionToken || !accountState) {
    renderClientLockedState("login");
    return;
  }

  if (!isAccountApproved(accountState)) {
    renderClientLockedState(accountState.kycStatus === "rejected" ? "block" : "pending_actions");
    return;
  }

  const fullName =
    [accountState.firstName, accountState.lastName].filter(Boolean).join(" ").trim() ||
    "Client Bay4Bank";
  const cityCountry = [accountState.city, accountState.country].filter(Boolean).join(", ");
  const financials = getClientFinancials(accountState);

  clientLockedState.hidden = true;
  clientDashboard.hidden = false;

  if (clientStatusBadge) {
    clientStatusBadge.className = "status-badge success";
    clientStatusBadge.textContent = "Compte actif";
  }

  if (clientGreeting) {
    clientGreeting.textContent = "Bonjour " + fullName;
  }

  if (clientIntro) {
    clientIntro.textContent =
      "Votre compte Bay4Bank est actif. Vous pouvez suivre vos opérations, gérer votre carte et consulter vos informations client.";
  }

  if (clientIdentitySummary) {
    renderClientInfoGrid(clientIdentitySummary, [
      { label: "Titulaire", value: fullName },
      { label: "Compte", value: accountState.accountId },
      { label: "Client depuis", value: formatClientDate(accountState.decisionAt || accountState.submittedAt || accountState.createdAt) },
      { label: "Conseiller", value: accountState.owner },
    ]);
  }

  if (clientIban) {
    clientIban.textContent = buildClientIban(accountState);
  }

  if (clientCardHolder) {
    clientCardHolder.textContent = fullName.toUpperCase();
  }

  if (clientAvailableBalance) {
    clientAvailableBalance.textContent = formatClientMoney(financials.availableBalanceCents);
  }

  if (clientMonthlyLimit) {
    clientMonthlyLimit.textContent = formatClientMoney(financials.monthlyLimitCents);
  }

  if (clientCardLast4) {
    clientCardLast4.textContent = "•••• " + financials.cardLast4;
  }

  if (clientOnlinePayments) {
    clientOnlinePayments.textContent = financials.onlinePaymentsEnabled ? "Activé" : "Désactivé";
  }

  if (clientRecentCardPayment) {
    clientRecentCardPayment.textContent = formatClientMoney(financials.recentCardPaymentCents, {
      sign: "-",
    });
  }

  if (clientRecentIncomingTransfer) {
    clientRecentIncomingTransfer.textContent = formatClientMoney(
      financials.recentIncomingTransferCents,
      { sign: "+" },
    );
  }

  renderClientInfoGrid(clientProfileGrid, [
    { label: "Adresse e-mail", value: accountState.contactEmail },
    { label: "Téléphone", value: accountState.phone },
    { label: "Résidence", value: cityCountry || accountState.country },
    { label: "Adresse", value: accountState.street },
    { label: "Code postal", value: accountState.postal },
    { label: "Nationalité", value: accountState.nationality },
  ]);
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
  if (accountState && accountState.kycSessionId) {
    sessionId = accountState.kycSessionId;
    sessionStorage.setItem("kycSessionId", sessionId);
    return;
  }

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
    message || "Créez d'abord votre espace Bay4Bank avant d'envoyer des documents.";

  if (currentPage === "kyc") setResultMessage(text, "error");

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
    chatShell.classList.remove("is-expanded");
    chatLauncher.hidden = false;
    if (chatMenu) chatMenu.hidden = true;
    return;
  }

  chatShell.hidden = false;
  chatLauncher.hidden = true;
  chatShell.classList.toggle("is-minimized", chatIsMinimized);
  chatShell.classList.toggle("is-expanded", chatIsExpanded);
  if (chatUnread) chatUnread.hidden = true;
  if (chatStatus) chatStatus.textContent = "En ligne";
  syncChatComposerState();

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
  if (document.getElementById("emptyState")) return;

  const welcome =
    currentPage === "kyc"
      ? "Bonjour, je peux vous aider à envoyer vos documents, vérifier les pièces acceptées et préremplir le formulaire KYC."
      : "Bonjour, je peux vous aider à ouvrir votre compte Bay4Bank et à préparer les prochaines étapes.";

  say(welcome, "agent");
}

function openChat() {
  if (!chatShell || !chatLauncher) return;
  chatIsOpen = true;
  chatIsMinimized = false;
  closeChatMenu();
  updateChatShell();
  ensureChatWelcome();
  revealChatIntro();
  syncChatComposerState();
}

function closeChat() {
  chatIsOpen = false;
  chatIsMinimized = false;
  chatIsExpanded = false;
  closeChatMenu();
  updateChatShell();
}

function toggleChatMinimize() {
  closeChat();
}

function toggleChatExpand() {
  chatIsExpanded = !chatIsExpanded;
  closeChatMenu();
  updateChatShell();
  scrollMessages();
}

function buildNextStepHint(french) {
  if (!accountState) {
    return french
      ? "Commencez par créer votre espace Bay4Bank."
      : "Start by creating your Bay4Bank account.";
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
  return {
    base64: base64,
    mimeType: "image/jpeg",
    previewUrl: createDocumentPreviewUrl(canvas),
  };
}

function createDocumentPreviewUrl(sourceCanvas) {
  const maxDimension = 900;
  const ratio = Math.min(
    1,
    maxDimension / sourceCanvas.width,
    maxDimension / sourceCanvas.height,
  );
  const width = Math.max(1, Math.round(sourceCanvas.width * ratio));
  const height = Math.max(1, Math.round(sourceCanvas.height * ratio));
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = width;
  previewCanvas.height = height;
  previewCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0, width, height);
  return previewCanvas.toDataURL("image/jpeg", 0.7);
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
    planName: "Bay4Bank Everyday",
    createdAt: existing.createdAt || new Date().toISOString(),
    kycStatus: existing.kycStatus || null,
  };
}

function applyAuthenticatedPayload(payload) {
  if (!payload || !payload.account) return;

  persistAuthToken(payload.sessionToken || authSessionToken);
  applyAccountState(payload.account);
  updateAccountCtas();
  prefillAccountForm();
  prefillProfileFromAccount();
  renderAccountState();
  renderClientSpace();
  syncAccountAuthControls();
  syncJourneyStage();
}

function initAccountPage() {
  if (accountForm) {
    accountForm.addEventListener("submit", async function(event) {
      event.preventDefault();
      await initSession();

      if (authSessionToken && accountState) {
        setInlineFeedback(
          "Session déjà active. Redirection vers votre espace Bay4Bank…",
          "success",
        );
        window.setTimeout(function() {
          window.location.href = getAccountDestination(accountState);
        }, 400);
        return;
      }

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

      try {
        createAccountBtn.disabled = true;
        setInlineFeedback("Création du compte Bay4Bank en cours…", "warning");
        setLoginFeedback("", "");

        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.accountEmail,
            phone: formData.accountPhone,
            password: formData.accountPassword,
            sessionId: sessionId,
          }),
        });

        const payload = await response.json().catch(function() {
          return {};
        });

        if (!response.ok) {
          setInlineFeedback(
            payload.error || "Impossible de créer le compte pour le moment.",
            "error",
          );
          return;
        }

        journeyFinished = false;
        applyAuthenticatedPayload(payload);
        setInlineFeedback(
          "Compte créé. Redirection vers la page de vérification Bay4Bank…",
          "success",
        );

        window.setTimeout(function() {
          window.location.href = "kyc.html";
        }, 500);
      } catch (error) {
        console.error("Account registration error:", error);
        setInlineFeedback(
          "La création du compte a échoué à cause d'une erreur réseau.",
          "error",
        );
      } finally {
        createAccountBtn.disabled = false;
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
      event.preventDefault();

      const email = getFormFieldValue(loginForm, "loginEmail");
      const password = getFormFieldValue(loginForm, "loginPassword");

      if (!email || !password) {
        setLoginFeedback("Merci de renseigner votre adresse e-mail et votre mot de passe.", "error");
        return;
      }

      try {
        if (loginBtn) loginBtn.disabled = true;
        setLoginFeedback("Connexion à votre espace Bay4Bank…", "warning");
        setInlineFeedback("", "");

        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            password: password,
          }),
        });

        const payload = await response.json().catch(function() {
          return {};
        });

        if (!response.ok) {
          setLoginFeedback(
            payload.error || "Connexion impossible pour le moment.",
            "error",
          );
          return;
        }

        journeyFinished = Boolean(payload.account && payload.account.kycStatus);
        applyAuthenticatedPayload(payload);
        setLoginFeedback("Connexion réussie. Redirection vers votre espace…", "success");

        window.setTimeout(function() {
          window.location.href = getAccountDestination(payload.account);
        }, 450);
      } catch (error) {
        console.error("Account login error:", error);
        setLoginFeedback("La connexion a échoué à cause d'une erreur réseau.", "error");
      } finally {
        if (loginBtn) loginBtn.disabled = false;
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function() {
      try {
        logoutBtn.disabled = true;

        if (authSessionToken) {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + authSessionToken,
            },
          });
        }
      } catch (error) {
        console.error("Account logout error:", error);
      } finally {
        clearAccountSessionState();
        if (accountForm) accountForm.reset();
        if (loginForm) loginForm.reset();
        setInlineFeedback("Session fermée. Vous pouvez créer ou reconnecter un compte.", "warning");
        setLoginFeedback("", "");
        updateAccountCtas();
        renderAccountState();
        renderClientSpace();
        syncAccountAuthControls();
        prefillProfileFromAccount();
        syncJourneyStage();
        logoutBtn.disabled = false;
      }
    });
  }
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
      "Créez votre compte Bay4Bank avant d'envoyer un document depuis cette page.",
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
      const previewUrl = prepared.previewUrl || "data:image/jpeg;base64," + base64;
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
        documentAssets[effectiveCategory] = {
          fileName: file.name,
          previewUrl: previewUrl,
          mimeType: mimeType,
        };
        persistDocumentPreview(effectiveCategory, documentAssets[effectiveCategory]);
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
      setResultMessage(message, "warning");
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
          authToken: authSessionToken || "",
          documentFiles: {
            identity: documentNames.identity,
            address: documentNames.address,
          },
          documentAssets: {
            identity: documentAssets.identity,
            address: documentAssets.address,
          },
        }),
      });

      removeProcessing();

      if (!response.ok) {
        const error = await response.json().catch(function() {
          return {};
        });
        const message =
          "La soumission a échoué : " + (error.error || "merci de réessayer.");
        setResultMessage(message, "error");
        say(message, "agent");
        return;
      }

      const submission = await response.json();
      journeyFinished = true;
      const humanReview = submission.humanReview || { required: false };

      applyAccountState(Object.assign({}, accountState, {
        firstName: profileData.firstName || accountState.firstName,
        lastName: profileData.lastName || accountState.lastName,
        contactEmail: profileData.email || accountState.contactEmail,
        phone: profileData.phone || accountState.phone,
        country: profileData.country || accountState.country,
        dob: profileData.dob || accountState.dob,
        street: profileData.street || accountState.street,
        city: profileData.city || accountState.city,
        state: profileData.state || accountState.state,
        postal: profileData.postal || accountState.postal,
        documentNumber:
          (identityExtraction && identityExtraction.documentNumber) ||
          accountState.documentNumber,
        documentExpiry:
          (identityExtraction && identityExtraction.dateOfExpiry) ||
          accountState.documentExpiry,
        nationality:
          (identityExtraction && identityExtraction.nationality) ||
          accountState.nationality,
        kycStatus: submission.status,
        humanReviewRequired: Boolean(humanReview.required),
        humanReviewReason: humanReview.message || "",
        submissionId: submission.submissionId,
        submittedAt: submission.submittedAt,
        accountId:
          (submission.accountTimeline && submission.accountTimeline.accountId) ||
          accountState.accountId,
        customerId:
          (submission.accountTimeline && submission.accountTimeline.customerId) ||
          accountState.customerId,
        owner:
          (submission.accountTimeline && submission.accountTimeline.owner) ||
          accountState.owner,
        kycSessionId: sessionId,
      }));
      persistAdminHumanReviewCase(submission, profileData);
      updateAccountCtas();
      renderAccountState();
      renderClientSpace();
      syncJourneyStage();

      const timeline = submission.accountTimeline || null;

      if (submission.status === "approved") {
        setResultMessage(
          "Compte activé. Votre dossier a été validé et votre espace Bay4Bank est prêt.",
          "success",
        );
        say(
          "Le dossier est validé. Votre compte Bay4Bank est activé. Je vous redirige vers votre espace client.",
          "agent",
        );
        window.setTimeout(function() {
          window.location.href = "client.html";
        }, 1600);
      } else if (humanReview.required) {
        setResultMessage(
          humanReview.message ||
            "Une anomalie a été détectée entre les documents. Le dossier a été remonté à un agent humain pour revue.",
          "alert",
        );
        say(
          (humanReview.message ||
            "Une anomalie a été détectée entre les documents. Le dossier a été remonté à un agent humain pour revue.") +
            " Le journal d'ouverture vous indique maintenant cette escalade.",
          "agent",
        );
      } else {
        setResultMessage(
          "Dossier transmis. L'ouverture de compte se poursuit pendant la revue du dossier.",
          "warning",
        );
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
      setResultMessage(message, "error");
      say(message, "agent");
    }
  });
}

function initChat() {
  if (!chatShell || !chatLauncher) return;
  if (chatAttachActionBtn) {
    chatAttachActionBtn.hidden = false;
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

  if (chatInfoBtn) {
    chatInfoBtn.addEventListener("click", function() {
      openChat();
      say(
        currentPage === "kyc"
          ? "Je peux vous guider sur les documents acceptés, lancer l'envoi d'une pièce et suivre l'avancement du dossier."
          : "Je peux vous aider à ouvrir votre compte, expliquer les étapes et préparer votre passage sur la page de vérification.",
        "agent",
      );
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

  if (chatAttachBtn && !fileInput) {
    chatAttachBtn.addEventListener("click", function() {
      openChat();
      say(
        "Créez d'abord votre compte, puis ouvrez la page de vérification pour joindre vos documents.",
        "agent",
      );
    });
  }

  if (chatAttachActionBtn && fileInput) {
    chatAttachActionBtn.addEventListener("click", function() {
      closeChatMenu();
      openChat();
      openUploadPicker(null);
    });
  }

  if (chatAttachActionBtn && !fileInput) {
    chatAttachActionBtn.addEventListener("click", function() {
      closeChatMenu();
      openChat();
      say(
        "Les pièces jointes seront disponibles dès que votre compte sera créé et que vous serez sur la page de vérification.",
        "agent",
      );
    });
  }

  chatQuickActionButtons.forEach(function(button) {
    button.addEventListener("click", function() {
      const quickMessage = button.dataset.chatMessage;
      const wantsUpload = button.dataset.chatUpload === "true";
      openChat();

      if (wantsUpload && fileInput) {
        openUploadPicker(null);
        return;
      }

      if (quickMessage) {
        sendMessage(quickMessage);
      }
    });
  });

  window.addEventListener("click", function(event) {
    if (!chatMenu || chatMenu.hidden) return;
    if (chatMenu.contains(event.target)) return;
    if (chatMenuBtn && chatMenuBtn.contains(event.target)) return;
    closeChatMenu();
  });

  if (chatMinimizeBtn) {
    chatMinimizeBtn.addEventListener("click", toggleChatMinimize);
  }

  if (chatExpandBtn) {
    chatExpandBtn.addEventListener("click", toggleChatExpand);
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
      syncChatComposerState();
      sendMessage(value);
    });
  }

  if (input) {
    input.addEventListener("input", syncChatComposerState);
    input.addEventListener("keydown", function(event) {
      if ((event.key === "Enter" || event.keyCode === 13) && !event.shiftKey) {
        event.preventDefault();
        const value = input.value.trim();
        if (!value) return;
        input.value = "";
        syncChatComposerState();
        sendMessage(value);
      }
    });
  }
}

(async function init() {
  updateBranding();
  initHeader();
  await hydrateAuthenticatedAccount();
  updateAccountCtas();
  if (accountState) persistAccountState();
  prefillAccountForm();
  prefillProfileFromAccount();
  renderAccountState();
  renderClientSpace();
  syncAccountAuthControls();
  renderDocumentState();
  updateChecklist();
  syncJourneyStage();
  initAccountPage();
  initUploadFlow();
  initSubmitFlow();
  initChat();
  updateChatShell();
  syncChatComposerState();

  if (accountState && accountState.kycStatus) {
    setCrmStatus(
      accountState.kycStatus === "approved"
        ? "Compte actif"
        : accountState.kycStatus === "rejected"
          ? "Dossier refusé"
          : "Revue en cours",
      accountState.kycStatus === "approved"
        ? "success"
        : accountState.kycStatus === "rejected"
          ? "alert"
          : "pending",
    );
  } else {
    setCrmStatus("En attente", "neutral");
  }

  await initSession();
})();
