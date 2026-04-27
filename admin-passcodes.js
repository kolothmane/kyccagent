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
const financialForm = document.getElementById("passcodeFinancialForm");
const financialBalanceInput = document.getElementById("financialBalance");
const financialMonthlyLimitInput = document.getElementById("financialMonthlyLimit");
const financialCardPaymentInput = document.getElementById("financialCardPayment");
const financialIncomingTransferInput = document.getElementById("financialIncomingTransfer");
const financialCardLast4Input = document.getElementById("financialCardLast4");
const financialOnlinePaymentsInput = document.getElementById("financialOnlinePayments");
const financialFeedbackNode = document.getElementById("financialFeedback");
const financialSaveBtn = document.getElementById("financialSaveBtn");
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

function setFinancialFeedback(message, tone) {
  if (!financialFeedbackNode) return;

  financialFeedbackNode.className = "inline-feedback";
  if (tone) financialFeedbackNode.classList.add("is-" + tone);
  financialFeedbackNode.textContent = message || "";
}

function centsValue(value, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;
  return Math.round(number);
}

function eurosToCents(value) {
  const normalized = String(value || "").replace(",", ".").trim();
  if (!normalized) return null;

  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;

  return Math.round(number * 100);
}

function centsToEuros(value, fallback) {
  return (centsValue(value, fallback) / 100).toFixed(2);
}

function getFinancials(account) {
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

function formatEuros(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(centsValue(value, 0) / 100);
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
      setFinancialFeedback("", "");
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
    { label: "Solde affiché", value: formatEuros(getFinancials(account).availableBalanceCents) },
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

function renderFinancialForm(account) {
  const financials = getFinancials(account);

  if (financialBalanceInput) {
    financialBalanceInput.value = centsToEuros(financials.availableBalanceCents, 42075);
  }

  if (financialMonthlyLimitInput) {
    financialMonthlyLimitInput.value = centsToEuros(financials.monthlyLimitCents, 150000);
  }

  if (financialCardPaymentInput) {
    financialCardPaymentInput.value = centsToEuros(financials.recentCardPaymentCents, 1290);
  }

  if (financialIncomingTransferInput) {
    financialIncomingTransferInput.value = centsToEuros(
      financials.recentIncomingTransferCents,
      25000,
    );
  }

  if (financialCardLast4Input) {
    financialCardLast4Input.value = financials.cardLast4;
  }

  if (financialOnlinePaymentsInput) {
    financialOnlinePaymentsInput.value = financials.onlinePaymentsEnabled ? "true" : "false";
  }
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
  renderFinancialForm(account);
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

async function saveFinancials(event) {
  event.preventDefault();

  const account = accounts.find(function(item) {
    return item.accountId === selectedAccountId;
  });

  if (!account) {
    setFinancialFeedback("Sélectionnez un compte client.", "error");
    return;
  }

  const availableBalanceCents = eurosToCents(financialBalanceInput && financialBalanceInput.value);
  const monthlyLimitCents = eurosToCents(financialMonthlyLimitInput && financialMonthlyLimitInput.value);
  const recentCardPaymentCents = eurosToCents(
    financialCardPaymentInput && financialCardPaymentInput.value,
  );
  const recentIncomingTransferCents = eurosToCents(
    financialIncomingTransferInput && financialIncomingTransferInput.value,
  );
  const cardLast4 = String((financialCardLast4Input && financialCardLast4Input.value) || "")
    .replace(/\D/g, "")
    .slice(-4);

  if (
    availableBalanceCents === null ||
    monthlyLimitCents === null ||
    recentCardPaymentCents === null ||
    recentIncomingTransferCents === null
  ) {
    setFinancialFeedback("Renseignez tous les montants au format numérique.", "error");
    return;
  }

  if (monthlyLimitCents < 0 || recentCardPaymentCents < 0 || recentIncomingTransferCents < 0) {
    setFinancialFeedback("Les plafonds et opérations doivent être positifs.", "error");
    return;
  }

  if (cardLast4.length !== 4) {
    setFinancialFeedback("Les 4 derniers chiffres de carte doivent contenir 4 chiffres.", "error");
    return;
  }

  try {
    busy = true;
    if (financialSaveBtn) financialSaveBtn.disabled = true;
    setFinancialFeedback("Mise à jour des chiffres en cours…", "warning");

    const response = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "update_financials",
        accountId: account.accountId,
        financials: {
          availableBalanceCents,
          monthlyLimitCents,
          recentCardPaymentCents,
          recentIncomingTransferCents,
          cardLast4,
          onlinePaymentsEnabled:
            !financialOnlinePaymentsInput || financialOnlinePaymentsInput.value !== "false",
        },
      }),
    });

    const payload = await response.json().catch(function() {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.error || "financial update failed");
    }

    accounts = accounts.map(function(item) {
      return item.accountId === payload.account.accountId ? payload.account : item;
    });

    render();
    setFinancialFeedback("Chiffres mis à jour dans l'espace client.", "success");
  } catch (error) {
    console.error("Financial update error:", error);
    setFinancialFeedback(error.message || "Impossible de modifier les chiffres.", "error");
  } finally {
    busy = false;
    if (financialSaveBtn) financialSaveBtn.disabled = false;
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

  if (financialForm) {
    financialForm.addEventListener("submit", saveFinancials);
  }

  loadAccounts();
}

init();
