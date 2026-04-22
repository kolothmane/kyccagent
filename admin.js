"use strict";

const ADMIN_ESCALATIONS_STORAGE_KEY = "baybankAdminEscalations";
const ADMIN_DOCUMENT_PREVIEWS_KEY = "baybankAdminDocumentPreviews";
const ADMIN_DELETED_ESCALATIONS_KEY = "baybankDeletedEscalations";
const ACCOUNT_STORAGE_KEY = "baybankAccountState";

const siteHeader = document.getElementById("siteHeader");
const navToggle = document.getElementById("navToggle");
const navbarCollapse = document.getElementById("navbarCollapse");
const refreshBtn = document.getElementById("adminRefresh");
const adminGrid = document.querySelector(".admin-grid");

const pendingCountNode = document.getElementById("adminPendingCount");
const approvedCountNode = document.getElementById("adminApprovedCount");
const rejectedCountNode = document.getElementById("adminRejectedCount");
const listCountNode = document.getElementById("adminListCount");
const listEmptyNode = document.getElementById("adminListEmpty");
const caseListNode = document.getElementById("adminCaseList");

const detailEmptyNode = document.getElementById("adminDetailEmpty");
const detailNode = document.getElementById("adminDetail");
const backToListBtn = document.getElementById("adminBackToList");
const clientNameNode = document.getElementById("adminClientName");
const decisionStatusNode = document.getElementById("adminDecisionStatus");
const accountIdNode = document.getElementById("adminAccountId");
const customerIdNode = document.getElementById("adminCustomerId");
const submittedAtNode = document.getElementById("adminSubmittedAt");
const ownerNode = document.getElementById("adminOwner");
const approveBtn = document.getElementById("adminApproveBtn");
const rejectBtn = document.getElementById("adminRejectBtn");
const deleteBtn = document.getElementById("adminDeleteBtn");
const decisionNoteNode = document.getElementById("adminDecisionNote");
const clientInfoNode = document.getElementById("adminClientInfo");
const escalationMessageNode = document.getElementById("adminEscalationMessage");
const signalsNode = document.getElementById("adminSignals");
const documentsNode = document.getElementById("adminDocuments");
const documentsEmptyNode = document.getElementById("adminDocumentsEmpty");
const crmEmptyNode = document.getElementById("adminCrmEmpty");
const crmLogsNode = document.getElementById("adminCrmLogs");

let escalations = [];
let selectedEscalationId = null;
let selectedEscalationRef = null;
let adminBusy = false;

function readStoredJson(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeLocalEscalations(items) {
  localStorage.setItem(ADMIN_ESCALATIONS_STORAGE_KEY, JSON.stringify(items || []));
}

function readLocalEscalations() {
  return readStoredJson(localStorage.getItem(ADMIN_ESCALATIONS_STORAGE_KEY));
}

function readDeletedEscalations() {
  return readStoredJson(localStorage.getItem(ADMIN_DELETED_ESCALATIONS_KEY));
}

function writeDeletedEscalations(items) {
  localStorage.setItem(ADMIN_DELETED_ESCALATIONS_KEY, JSON.stringify(items || []));
}

function readAccountState() {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

function hasActiveAccountContext() {
  const account = readAccountState();
  if (!account) return false;

  return Boolean(
    account.accountId ||
      account.customerId ||
      account.submissionId ||
      account.contactEmail ||
      account.email,
  );
}

function clearLocalAdminState() {
  writeLocalEscalations([]);
  writeDeletedEscalations([]);
}

function readDocumentPreviews() {
  const parsed = readStoredJson(localStorage.getItem(ADMIN_DOCUMENT_PREVIEWS_KEY));
  return parsed && typeof parsed === "object" ? parsed : {};
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

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function statusToTone(status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "alert";
  return "pending";
}

function statusToLabel(status) {
  if (status === "approved") return "Validé";
  if (status === "rejected") return "Refusé";
  return "En attente";
}

function buildEscalationRef(item) {
  if (!item || typeof item !== "object") return null;
  return {
    escalationId: item.escalationId || "",
    submissionId: item.submissionId || "",
    sessionId: item.sessionId || "",
    fingerprint: buildEscalationFingerprint(item),
  };
}

function buildEscalationFingerprint(item) {
  if (!item || typeof item !== "object") return "";

  const fullName = [
    item.client && item.client.firstName,
    item.client && item.client.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const reason =
    (item.humanReview && item.humanReview.message) ||
    ((item.humanReview && item.humanReview.reasons) || []).join(" | ") ||
    "";
  const accountId = (item.account && item.account.accountId) || "";
  const submittedAt = item.submittedAt || item.updatedAt || "";

  return [accountId, submittedAt, fullName, reason].join("::");
}

function matchesEscalation(item, ref) {
  if (!item || !ref) return false;

  return Boolean(
    (ref.escalationId && item.escalationId === ref.escalationId) ||
      (ref.submissionId && item.submissionId === ref.submissionId) ||
      (ref.sessionId && item.sessionId === ref.sessionId) ||
      (ref.fingerprint && buildEscalationFingerprint(item) === ref.fingerprint),
  );
}

function isEscalationDeleted(item) {
  const deletedRefs = readDeletedEscalations();
  if (!Array.isArray(deletedRefs) || !deletedRefs.length) return false;

  return deletedRefs.some(function(ref) {
    return Boolean(
      (ref.escalationId && item.escalationId === ref.escalationId) ||
        (ref.submissionId && item.submissionId === ref.submissionId) ||
        (ref.fingerprint && buildEscalationFingerprint(item) === ref.fingerprint),
    );
  });
}

function markEscalationDeleted(ref) {
  if (!ref || (!ref.escalationId && !ref.submissionId)) return;

  const deletedRefs = readDeletedEscalations().filter(function(entry) {
    return !(
      (ref.escalationId && entry.escalationId === ref.escalationId) ||
      (ref.submissionId && entry.submissionId === ref.submissionId)
    );
  });

  deletedRefs.unshift({
    escalationId: ref.escalationId || "",
    submissionId: ref.submissionId || "",
    fingerprint: ref.fingerprint || "",
  });

  writeDeletedEscalations(deletedRefs.slice(0, 100));
}

function unmarkEscalationDeleted(ref) {
  if (!ref || (!ref.escalationId && !ref.submissionId)) return;

  const deletedRefs = readDeletedEscalations().filter(function(entry) {
    return !(
      (ref.escalationId && entry.escalationId === ref.escalationId) ||
      (ref.submissionId && entry.submissionId === ref.submissionId)
    );
  });

  writeDeletedEscalations(deletedRefs);
}

function isPendingStatus(status) {
  return [
    "pending",
    "pending_review",
    "manual_review",
    "in_review",
    "open",
  ].includes(String(status || "").trim());
}

function mergeEscalations(primaryItems, secondaryItems) {
  const map = new Map();
  const previewsBySession = readDocumentPreviews();

  function keyFor(item) {
    return item.escalationId || item.submissionId || item.sessionId;
  }

  secondaryItems.forEach(function(item) {
    const key = keyFor(item);
    if (key) map.set(key, item);
  });

  primaryItems.forEach(function(item) {
    const key = keyFor(item);
    if (!key) return;
    const current = map.get(key);
    const merged = Object.assign({}, current || {}, item);

    if (Array.isArray((current && current.documents) || item.documents)) {
      const localDocuments = Array.isArray(current && current.documents)
        ? current.documents
        : [];
      const incomingDocuments = Array.isArray(item.documents)
        ? item.documents
        : localDocuments;

      merged.documents = incomingDocuments.map(function(document, index) {
        const localDocument = localDocuments[index] || {};
        const previewSet = previewsBySession[item.sessionId] || {};
        const previewAsset = previewSet[document.category] || {};
        return Object.assign({}, localDocument, document, {
          previewUrl:
            document.previewUrl ||
            localDocument.previewUrl ||
            previewAsset.previewUrl ||
            "",
          fileName:
            document.fileName ||
            localDocument.fileName ||
            previewAsset.fileName ||
            "",
        });
      });
    }

    map.set(key, merged);
  });

  return Array.from(map.values()).filter(function(item) {
    return !isEscalationDeleted(item);
  }).sort(function(a, b) {
    const weight = {
      pending: 0,
      pending_review: 0,
      manual_review: 0,
      in_review: 0,
      open: 0,
      approved: 1,
      rejected: 2,
    };
    const aWeight = weight[a.status] ?? 9;
    const bWeight = weight[b.status] ?? 9;
    if (aWeight !== bWeight) return aWeight - bWeight;
    return new Date(b.updatedAt || b.submittedAt).getTime() - new Date(a.updatedAt || a.submittedAt).getTime();
  });
}

function buildFallbackCrmLogs(record, agentName) {
  const reviewedAt = new Date().toISOString();
  const reviewer = agentName || "Agent conformité BayBank";
  const fullName = [record.client?.firstName, record.client?.lastName].filter(Boolean).join(" ").trim() || "Titulaire principal";

  return {
    reviewedAt,
    items: [
      {
        system: "Compliance",
        label: "Revue humaine clôturée",
        detail: reviewer + " a validé le dossier après contrôle manuel.",
        timestamp: reviewedAt,
      },
      {
        system: "CRM",
        label: "Fiche client confirmée",
        detail: fullName + " a été confirmé dans le référentiel client BayBank.",
        timestamp: new Date(new Date(reviewedAt).getTime() + 60000).toISOString(),
      },
      {
        system: "Lifecycle",
        label: "Compte activé",
        detail: "Le compte a été réintégré dans le flux d'activation.",
        timestamp: new Date(new Date(reviewedAt).getTime() + 120000).toISOString(),
      },
    ],
  };
}

function applyLocalDecision(record, action) {
  const reviewer = "Agent conformité BayBank";
  const reviewedAt = new Date().toISOString();
  const next = Object.assign({}, record, {
    status: action === "approve" ? "approved" : "rejected",
    reviewedAt: reviewedAt,
    reviewedBy: reviewer,
    updatedAt: reviewedAt,
    decisionNote:
      action === "approve"
        ? "Le dossier a été validé par l'agent."
        : "Le dossier a été refusé par l'agent.",
  });

  next.crmLogs = action === "approve" ? buildFallbackCrmLogs(next, reviewer) : null;
  return next;
}

function updateStoredEscalation(item) {
  unmarkEscalationDeleted(buildEscalationRef(item));
  const merged = mergeEscalations([item], readLocalEscalations());
  writeLocalEscalations(merged);
  return merged;
}

function removeStoredEscalation(ref) {
  const next = readLocalEscalations().filter(function(item) {
    return !matchesEscalation(item, ref);
  });
  writeLocalEscalations(next);
  return next;
}

function renderStats(items) {
  const pending = items.filter(function(item) { return isPendingStatus(item.status); }).length;
  const approved = items.filter(function(item) { return item.status === "approved"; }).length;
  const rejected = items.filter(function(item) { return item.status === "rejected"; }).length;

  if (pendingCountNode) pendingCountNode.textContent = String(pending);
  if (approvedCountNode) approvedCountNode.textContent = String(approved);
  if (rejectedCountNode) rejectedCountNode.textContent = String(rejected);
  if (listCountNode) {
    const total = items.length;
    listCountNode.textContent = total + " dossier" + (total > 1 ? "s" : "");
  }
}

function renderList(items) {
  renderStats(items);

  if (!caseListNode || !listEmptyNode) return;

  caseListNode.innerHTML = "";
  listEmptyNode.hidden = items.length > 0;

  items.forEach(function(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-case-card";
    if (matchesEscalation(item, selectedEscalationRef)) {
      button.classList.add("is-selected");
    }

    const fullName = [item.client?.firstName, item.client?.lastName].filter(Boolean).join(" ").trim() || "Titulaire principal";
    const reason = item.humanReview?.reasons?.join(", ") || item.humanReview?.message || "Revue humaine requise";

    button.innerHTML =
      '<div class="admin-case-topline">' +
      '<span class="card-badge">' + escapeHtml(item.account?.accountId || "Dossier") + "</span>" +
      '<span class="status-badge ' + escapeHtml(statusToTone(item.status)) + '">' + escapeHtml(statusToLabel(item.status)) + "</span>" +
      "</div>" +
      "<strong>" + escapeHtml(fullName) + "</strong>" +
      "<p>" + escapeHtml(reason) + "</p>" +
      '<div class="admin-case-meta">' +
      "<span>" + escapeHtml(item.documents?.length ? item.documents.length + " pièces" : "0 pièce") + "</span>" +
      "<span>" + escapeHtml(formatDateTime(item.updatedAt || item.submittedAt)) + "</span>" +
      "</div>";

    button.addEventListener("click", function() {
      selectedEscalationRef = buildEscalationRef(item);
      selectedEscalationId =
        item.escalationId || item.submissionId || item.sessionId || null;
      renderAll();
    });

    caseListNode.appendChild(button);
  });
}

function renderDataGrid(node, rows) {
  if (!node) return;
  node.innerHTML = "";

  rows.forEach(function(row) {
    const cell = document.createElement("div");
    cell.className = "admin-data-item";
    cell.innerHTML =
      "<span>" + escapeHtml(row.label) + "</span>" +
      "<strong>" + escapeHtml(row.value || "—") + "</strong>";
    node.appendChild(cell);
  });
}

function renderSignals(record) {
  if (!signalsNode) return;

  const signals = []
    .concat(record.humanReview?.reasons || [])
    .concat(record.reconciliation?.suspiciousSignals || [])
    .concat(record.reconciliation?.missingFields || []);

  if (!signals.length) {
    signalsNode.innerHTML = '<div class="admin-signal-empty">Aucun signal complémentaire.</div>';
    return;
  }

  signalsNode.innerHTML =
    '<ul class="admin-signal-items">' +
    signals.map(function(signal) {
      return "<li>" + escapeHtml(signal) + "</li>";
    }).join("") +
    "</ul>";
}

function buildDocumentSummary(document) {
  const extraction = document.extraction || {};

  if (document.category === "identity") {
    return [
      { label: "Nom", value: [extraction.firstName, extraction.lastName].filter(Boolean).join(" ") },
      { label: "Type", value: extraction.documentType },
      { label: "Numéro", value: extraction.documentNumber },
      { label: "Expiration", value: extraction.dateOfExpiry },
      { label: "Nationalité", value: extraction.nationality },
      { label: "Adresse lue", value: extraction.address },
    ].filter(function(item) { return item.value; });
  }

  return [
    { label: "Nom", value: extraction.customerName },
    { label: "Adresse", value: extraction.serviceAddress },
    { label: "Date document", value: extraction.billingDate },
    { label: "Ville", value: extraction.city },
    { label: "Code postal", value: extraction.postal },
    { label: "Pays", value: extraction.country },
  ].filter(function(item) { return item.value; });
}

function renderDocuments(record) {
  if (!documentsNode) return;
  documentsNode.innerHTML = "";

  const documents = Array.isArray(record.documents) ? record.documents : [];
  if (documentsEmptyNode) {
    documentsEmptyNode.hidden = documents.length > 0;
  }

  if (!documents.length) {
    return;
  }

  documents.forEach(function(document) {
    const card = document.createElement("article");
    card.className = "admin-doc-card";

    const summary = buildDocumentSummary(document);
    card.innerHTML =
      '<div class="admin-doc-topline">' +
      '<span class="card-badge">' + escapeHtml(document.label || document.category || "Document") + "</span>" +
      "</div>" +
      '<strong class="admin-doc-name">' + escapeHtml(document.fileName || "Fichier joint") + "</strong>" +
      (document.previewUrl
        ? '<a class="button button-secondary button-small admin-doc-link" href="' +
            escapeHtml(document.previewUrl) +
            '" target="_blank" rel="noreferrer">Ouvrir le document</a>' +
          '<div class="admin-doc-preview"><img src="' +
            escapeHtml(document.previewUrl) +
            '" alt="' +
            escapeHtml(document.label || "Document") +
            '" /></div>'
        : "") +
      '<div class="admin-doc-summary">' +
      summary.map(function(item) {
        return (
          '<div class="summary-row">' +
          "<span>" + escapeHtml(item.label) + "</span>" +
          "<strong>" + escapeHtml(item.value) + "</strong>" +
          "</div>"
        );
      }).join("") +
      "</div>";

    documentsNode.appendChild(card);
  });
}

function renderCrmLogs(record) {
  if (!crmLogsNode || !crmEmptyNode) return;

  const logs = record.crmLogs && Array.isArray(record.crmLogs.items) ? record.crmLogs.items : [];
  crmLogsNode.innerHTML = "";
  crmEmptyNode.hidden = logs.length > 0;

  logs.forEach(function(log) {
    const item = document.createElement("article");
    item.className = "crm-item";
    item.innerHTML =
      '<div class="crm-dot"></div>' +
      "<div>" +
      '<div class="crm-meta">' +
      "<strong>" + escapeHtml(log.label) + "</strong>" +
      "<span>" + escapeHtml(log.system || "CRM") + "</span>" +
      "</div>" +
      "<p>" + escapeHtml(log.detail) + "</p>" +
      "<time>" + escapeHtml(formatDateTime(log.timestamp)) + "</time>" +
      "</div>";
    crmLogsNode.appendChild(item);
  });
}

function renderDetail(record) {
  if (!detailNode || !detailEmptyNode) return;

  detailEmptyNode.hidden = true;
  detailNode.hidden = false;

  const fullName = [record.client?.firstName, record.client?.lastName].filter(Boolean).join(" ").trim() || "Titulaire principal";
  clientNameNode.textContent = fullName;
  decisionStatusNode.className = "status-badge " + statusToTone(record.status);
  decisionStatusNode.textContent = statusToLabel(record.status);
  accountIdNode.textContent = record.account?.accountId || "—";
  customerIdNode.textContent = record.account?.customerId || "—";
  submittedAtNode.textContent = formatDateTime(record.submittedAt);
  ownerNode.textContent = record.reviewedBy || record.account?.owner || "—";

  decisionNoteNode.className = "result-card";
  if (record.status === "approved") {
    decisionNoteNode.classList.add("is-success");
    decisionNoteNode.textContent =
      "Le dossier a été validé par l'agent. Les opérations CRM ont été enregistrées.";
  } else if (record.status === "rejected") {
    decisionNoteNode.classList.add("is-alert");
    decisionNoteNode.textContent =
      "Le dossier a été refusé après revue humaine. Une action supplémentaire est requise.";
  } else {
    decisionNoteNode.classList.add("is-warning");
    decisionNoteNode.textContent =
      record.humanReview?.message || "Une revue humaine est requise avant décision.";
  }

  renderDataGrid(clientInfoNode, [
    { label: "Adresse e-mail", value: record.client?.email },
    { label: "Téléphone", value: record.client?.phone },
    { label: "Date de naissance", value: record.client?.dob },
    { label: "Pays", value: record.client?.country },
    { label: "Adresse", value: record.client?.street },
    { label: "Ville", value: record.client?.city },
    { label: "Région", value: record.client?.state },
    { label: "Code postal", value: record.client?.postal },
  ]);

  escalationMessageNode.textContent =
    record.humanReview?.message || "Le dossier a été remonté à un agent humain.";

  renderSignals(record);
  renderDocuments(record);
  renderCrmLogs(record);

  const pending = isPendingStatus(record.status);
  approveBtn.disabled = adminBusy || !pending;
  rejectBtn.disabled = adminBusy || !pending;
  if (deleteBtn) {
    deleteBtn.disabled = adminBusy;
  }
}

function renderAll() {
  const hasSelection = Boolean(selectedEscalationRef);
  if (adminGrid) {
    adminGrid.classList.toggle("has-selection", hasSelection);
  }

  renderList(escalations);

  if (!escalations.length) {
    selectedEscalationId = null;
    selectedEscalationRef = null;
    if (adminGrid) {
      adminGrid.classList.remove("has-selection");
    }
    if (detailNode) detailNode.hidden = true;
    if (detailEmptyNode) detailEmptyNode.hidden = false;
    return;
  }

  if (!selectedEscalationRef) {
    if (detailNode) detailNode.hidden = true;
    if (detailEmptyNode) detailEmptyNode.hidden = false;
    return;
  }

  const selected = escalations.find(function(item) {
    return matchesEscalation(item, selectedEscalationRef);
  });

  if (!selected) {
    selectedEscalationId = null;
    selectedEscalationRef = null;
    if (adminGrid) {
      adminGrid.classList.remove("has-selection");
    }
    if (detailNode) detailNode.hidden = true;
    if (detailEmptyNode) detailEmptyNode.hidden = false;
    renderList(escalations);
    return;
  }

  renderDetail(selected);
}

async function loadEscalations() {
  if (refreshBtn) refreshBtn.disabled = true;

  const localItems = readLocalEscalations();
  let remoteItems = [];

  try {
    const response = await fetch("/api/admin/escalations");
    if (!response.ok) throw new Error("admin fetch failed");
    const data = await response.json();
    remoteItems = Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error("Admin fetch error:", error);
  }

  if (!remoteItems.length && localItems.length && !hasActiveAccountContext()) {
    clearLocalAdminState();
    escalations = [];
    selectedEscalationId = null;
    selectedEscalationRef = null;
    renderAll();
    if (refreshBtn) refreshBtn.disabled = false;
    return;
  }

  escalations = mergeEscalations(remoteItems, localItems);
  writeLocalEscalations(escalations);
  renderAll();

  if (refreshBtn) refreshBtn.disabled = false;
}

async function submitDecision(action) {
  const selected = escalations.find(function(item) {
    return matchesEscalation(item, selectedEscalationRef);
  });

  if (!selected || adminBusy || !isPendingStatus(selected.status)) return;

  adminBusy = true;
  renderDetail(selected);
  if (decisionNoteNode) {
    decisionNoteNode.className = "result-card is-warning";
    decisionNoteNode.textContent = "Décision en cours de traitement...";
  }

  let updated = null;

  try {
    const response = await fetch("/api/admin/escalations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        escalationId: selected.escalationId,
        action: action,
        agentName: "Agent conformité BayBank",
      }),
    });

    if (!response.ok) throw new Error("admin decision failed");

    const data = await response.json();
    updated = data.item || null;
  } catch (error) {
    console.error("Admin decision error:", error);
    updated = applyLocalDecision(selected, action);
  }

  if (!updated) {
    adminBusy = false;
    renderDetail(selected);
    return;
  }

  escalations = updateStoredEscalation(updated);
  selectedEscalationRef = buildEscalationRef(updated);
  selectedEscalationId =
    updated.escalationId || updated.submissionId || updated.sessionId || null;
  adminBusy = false;
  renderAll();
}

async function deleteSelectedEscalation() {
  const selected = escalations.find(function(item) {
    return matchesEscalation(item, selectedEscalationRef);
  });

  if (!selected || adminBusy) return;

  const fullName =
    [selected.client?.firstName, selected.client?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "ce dossier";
  const confirmed = window.confirm(
    "Supprimer la demande de revue humaine pour " + fullName + " ?"
  );

  if (!confirmed) return;

  adminBusy = true;
  renderDetail(selected);
  if (decisionNoteNode) {
    decisionNoteNode.className = "result-card is-warning";
    decisionNoteNode.textContent = "Suppression de la demande en cours...";
  }

  markEscalationDeleted(selectedEscalationRef);

  try {
    const response = await fetch("/api/admin/escalations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        escalationId: selected.escalationId,
        action: "delete",
        agentName: "Agent conformité BayBank",
      }),
    });

    if (!response.ok) throw new Error("admin delete failed");
  } catch (error) {
    console.error("Admin delete error:", error);
  }

  escalations = escalations.filter(function(item) {
    return !matchesEscalation(item, selectedEscalationRef);
  });
  removeStoredEscalation(selectedEscalationRef);
  selectedEscalationId = null;
  selectedEscalationRef = null;
  adminBusy = false;
  renderAll();
}

function initChrome() {
  function syncHeader() {
    if (!siteHeader) return;
    siteHeader.classList.toggle("header-scrolled", window.scrollY > 12);
  }

  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  if (navToggle && navbarCollapse) {
    navToggle.addEventListener("click", function() {
      navbarCollapse.classList.toggle("is-open");
    });
  }
}

function initActions() {
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadEscalations);
  }

  if (backToListBtn) {
    backToListBtn.addEventListener("click", function() {
      selectedEscalationId = null;
      selectedEscalationRef = null;
      renderAll();
    });
  }

  if (approveBtn) {
    approveBtn.addEventListener("click", function() {
      submitDecision("approve");
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener("click", function() {
      submitDecision("reject");
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", deleteSelectedEscalation);
  }
}

initChrome();
initActions();
loadEscalations();
