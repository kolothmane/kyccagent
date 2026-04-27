"use strict";

const siteHeader = document.getElementById("siteHeader");
const navToggle = document.getElementById("navToggle");
const navbarCollapse = document.getElementById("navbarCollapse");
const refreshBtn = document.getElementById("passcodesRefresh");
const searchInput = document.getElementById("passcodesSearch");

const totalCountNode = document.getElementById("passcodesTotalCount");
const approvedCountNode = document.getElementById("passcodesApprovedCount");
const reviewCountNode = document.getElementById("passcodesReviewCount");
const listCountNode = document.getElementById("passcodesListCount");
const listEmptyNode = document.getElementById("passcodesListEmpty");
const accountListNode = document.getElementById("passcodesAccountList");

const detailEmptyNode = document.getElementById("passcodesDetailEmpty");
const detailNode = document.getElementById("passcodesDetail");
const clientNameNode = document.getElementById("passcodesClientName");
const statusNode = document.getElementById("passcodesStatus");
const profileGridNode = document.getElementById("passcodesProfileGrid");
const resetForm = document.getElementById("passcodeResetForm");
const passwordInput = document.getElementById("passcodePassword");
const confirmInput = document.getElementById("passcodePasswordConfirm");
const feedbackNode = document.getElementById("passcodeFeedback");
const resetBtn = document.getElementById("passcodeResetBtn");

let accounts = [];
let selectedAccountId = null;
let busy = false;

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

function formatDate(value) {
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

function getFullName(account) {
  return [
    account && account.firstName,
    account && account.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function statusTone(status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "alert";
  if (status === "pending_review") return "pending";
  return "neutral";
}

function statusLabel(status) {
  if (status === "approved") return "Compte actif";
  if (status === "rejected") return "Refusé";
  if (status === "pending_review") return "En revue";
  return "Compte créé";
}

function setFeedback(message, tone) {
  if (!feedbackNode) return;

  feedbackNode.className = "inline-feedback";
  if (tone) feedbackNode.classList.add("is-" + tone);
  feedbackNode.textContent = message || "";
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

function accountMatchesSearch(account, query) {
  if (!query) return true;

  const haystack = [
    getFullName(account),
    account.contactEmail,
    account.phone,
    account.accountId,
    account.customerId,
    account.kycStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function getVisibleAccounts() {
  const query = searchInput ? searchInput.value.trim() : "";
  return accounts.filter(function(account) {
    return accountMatchesSearch(account, query);
  });
}

function updateStats() {
  const approved = accounts.filter(function(account) {
    return account.kycStatus === "approved";
  }).length;
  const review = accounts.filter(function(account) {
    return account.kycStatus === "pending_review" || account.humanReviewRequired;
  }).length;

  if (totalCountNode) totalCountNode.textContent = String(accounts.length);
  if (approvedCountNode) approvedCountNode.textContent = String(approved);
  if (reviewCountNode) reviewCountNode.textContent = String(review);
}

function renderList() {
  if (!accountListNode || !listEmptyNode || !listCountNode) return;

  const visibleAccounts = getVisibleAccounts();
  listCountNode.textContent =
    visibleAccounts.length + " " + (visibleAccounts.length > 1 ? "comptes" : "compte");
  listEmptyNode.hidden = visibleAccounts.length > 0;

  accountListNode.innerHTML = visibleAccounts
    .map(function(account) {
      const fullName = getFullName(account) || "Client Bay4Bank";
      const selected = account.accountId === selectedAccountId;
      return (
        '<button type="button" class="passcodes-account-row' +
        (selected ? " is-selected" : "") +
        '" data-account-id="' +
        escapeHtml(account.accountId) +
        '">' +
        "<span>" +
        escapeHtml(fullName) +
        "</span>" +
        "<strong>" +
        escapeHtml(account.contactEmail || "—") +
        "</strong>" +
        '<em class="status-badge ' +
        escapeHtml(statusTone(account.kycStatus)) +
        '">' +
        escapeHtml(statusLabel(account.kycStatus)) +
        "</em>" +
        "</button>"
      );
    })
    .join("");

  accountListNode.querySelectorAll("[data-account-id]").forEach(function(button) {
    button.addEventListener("click", function() {
      selectedAccountId = button.dataset.accountId;
      setFeedback("", "");
      renderList();
      renderDetail();
    });
  });
}

function renderProfileGrid(account) {
  if (!profileGridNode) return;

  const rows = [
    { label: "Compte", value: account.accountId },
    { label: "Client", value: account.customerId },
    { label: "Adresse e-mail", value: account.contactEmail },
    { label: "Téléphone", value: account.phone },
    { label: "Statut KYC", value: statusLabel(account.kycStatus) },
    { label: "Créé le", value: formatDate(account.createdAt) },
    { label: "Dernière connexion", value: formatDate(account.lastLoginAt) },
    { label: "Conseiller", value: account.owner },
  ];

  profileGridNode.innerHTML = rows
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

function renderDetail() {
  if (!detailNode || !detailEmptyNode) return;

  const account = accounts.find(function(item) {
    return item.accountId === selectedAccountId;
  });

  if (!account) {
    detailNode.hidden = true;
    detailEmptyNode.hidden = false;
    return;
  }

  const fullName = getFullName(account) || "Client Bay4Bank";

  detailNode.hidden = false;
  detailEmptyNode.hidden = true;

  if (clientNameNode) clientNameNode.textContent = fullName;
  if (statusNode) {
    statusNode.className = "status-badge " + statusTone(account.kycStatus);
    statusNode.textContent = statusLabel(account.kycStatus);
  }

  renderProfileGrid(account);
}

function render() {
  updateStats();
  renderList();
  renderDetail();
}

async function loadAccounts() {
  try {
    if (refreshBtn) refreshBtn.disabled = true;

    const response = await fetch("/api/admin/accounts");
    const payload = await response.json().catch(function() {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.error || "accounts unavailable");
    }

    accounts = Array.isArray(payload.items) ? payload.items : [];

    if (!selectedAccountId && accounts.length) {
      selectedAccountId = accounts[0].accountId;
    }

    if (
      selectedAccountId &&
      !accounts.some(function(account) {
        return account.accountId === selectedAccountId;
      })
    ) {
      selectedAccountId = accounts[0] ? accounts[0].accountId : null;
    }

    render();
  } catch (error) {
    console.error("Accounts loading error:", error);
    if (listEmptyNode) {
      listEmptyNode.hidden = false;
      listEmptyNode.textContent = "Impossible de charger les comptes clients.";
    }
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

async function resetPassword(event) {
  event.preventDefault();

  const account = accounts.find(function(item) {
    return item.accountId === selectedAccountId;
  });
  const password = passwordInput ? passwordInput.value : "";
  const confirm = confirmInput ? confirmInput.value : "";

  if (!account) {
    setFeedback("Sélectionnez un compte client.", "error");
    return;
  }

  if (!password || password.length < 8) {
    setFeedback("Le mot de passe doit contenir au moins 8 caractères.", "error");
    return;
  }

  if (password !== confirm) {
    setFeedback("Les deux mots de passe ne correspondent pas.", "error");
    return;
  }

  try {
    busy = true;
    if (resetBtn) resetBtn.disabled = true;
    setFeedback("Mise à jour du mot de passe en cours…", "warning");

    const response = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "reset_password",
        accountId: account.accountId,
        password,
      }),
    });

    const payload = await response.json().catch(function() {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.error || "password reset failed");
    }

    accounts = accounts.map(function(item) {
      return item.accountId === payload.account.accountId ? payload.account : item;
    });

    if (passwordInput) passwordInput.value = "";
    if (confirmInput) confirmInput.value = "";

    setFeedback("Mot de passe mis à jour. Le client peut se reconnecter.", "success");
    render();
  } catch (error) {
    console.error("Password reset error:", error);
    setFeedback(error.message || "Impossible de modifier le mot de passe.", "error");
  } finally {
    busy = false;
    if (resetBtn) resetBtn.disabled = false;
  }
}

function init() {
  initHeader();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadAccounts);
  }

  if (searchInput) {
    searchInput.addEventListener("input", function() {
      renderList();
    });
  }

  if (resetForm) {
    resetForm.addEventListener("submit", resetPassword);
  }

  loadAccounts();
}

init();
