"use strict";

const CLIENT_ASSISTANT_AUTH_KEY = "baybankAuthToken";
const CLIENT_ASSISTANT_TIMEOUT_MS = 28000;
const CLIENT_ASSISTANT_RECORDING_MAX_MS = 12000;
const CLIENT_ASSISTANT_MIN_AUDIO_BYTES = 700;

const assistantLauncher = document.getElementById("clientAssistantLauncher");
const assistantHeaderCta = document.getElementById("clientAssistantHeaderCta");
const assistantShell = document.getElementById("clientAssistantShell");
const assistantClose = document.getElementById("clientAssistantClose");
const assistantMinimize = document.getElementById("clientAssistantMinimize");
const assistantInterrupt = document.getElementById("clientAssistantInterrupt");
const assistantLanguage = document.getElementById("clientAssistantLanguage");
const assistantMessages = document.getElementById("clientAssistantMessages");
const assistantInput = document.getElementById("clientAssistantInput");
const assistantSend = document.getElementById("clientAssistantSend");
const assistantComposer = document.querySelector(".client-assistant-composer");
const assistantMic = document.getElementById("clientAssistantMic");
const assistantMute = document.getElementById("clientAssistantMute");
const assistantStatus = document.getElementById("clientAssistantStatus");
const assistantTitle = document.getElementById("clientAssistantTitle");
const assistantQuickActions = document.querySelectorAll("[data-client-assistant-prompt]");

let clientAssistantAccount = null;
let clientAssistantHistory = [];
let clientAssistantOpen = false;
let clientAssistantBusy = false;
let clientAssistantVoiceBusy = false;
let clientAssistantWelcomed = false;
let clientAssistantListening = false;
let clientAssistantAbortController = null;
let clientAssistantMediaRecorder = null;
let clientAssistantMediaStream = null;
let clientAssistantAudioChunks = [];
let clientAssistantRecordingTimer = null;
let clientAssistantDiscardRecording = false;
let clientAssistantHasVoiceHint = false;

function clientAssistantToken() {
  return String(localStorage.getItem(CLIENT_ASSISTANT_AUTH_KEY) || "").trim();
}

function clientAssistantEscape(value) {
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

function clientAssistantLogoMark(className) {
  return (
    '<span class="' +
    className +
    '" aria-hidden="true"><img src="assets/bay4bank-header-logo.svg" alt="" /></span>'
  );
}

function clientAssistantName(account) {
  return [account && account.firstName, account && account.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function clientAssistantGreeting(account) {
  const name = clientAssistantName(account);
  if (name) {
    return "Bonjour " + name + ", en quoi puis-je vous aider aujourd'hui ?";
  }
  return "Bonjour, en quoi puis-je vous aider aujourd'hui ?";
}

function setClientAssistantVisibility(visible) {
  if (assistantLauncher) assistantLauncher.hidden = !visible || clientAssistantOpen;
  if (assistantHeaderCta) assistantHeaderCta.hidden = !visible;

  if (!visible && assistantShell) {
    assistantShell.hidden = true;
    clientAssistantOpen = false;
  }
}

function syncClientAssistantShell() {
  const eligible = Boolean(
    clientAssistantAccount && clientAssistantAccount.kycStatus === "approved",
  );

  if (!eligible) {
    setClientAssistantVisibility(false);
    return;
  }

  if (assistantShell) assistantShell.hidden = !clientAssistantOpen;
  if (assistantLauncher) assistantLauncher.hidden = clientAssistantOpen;
  if (assistantHeaderCta) assistantHeaderCta.hidden = false;

  const busy = clientAssistantBusy || clientAssistantVoiceBusy;

  if (assistantStatus) {
    assistantStatus.textContent = busy
      ? "En traitement"
      : clientAssistantListening
        ? "Écoute active"
        : "En ligne";
  }

  if (assistantShell) {
    assistantShell.classList.toggle("is-thinking", busy);
    assistantShell.classList.toggle("is-listening", clientAssistantListening);
  }

  if (assistantSend) {
    assistantSend.disabled =
      busy || !assistantInput || !assistantInput.value.trim();
  }

  if (assistantMic) {
    assistantMic.classList.toggle("is-active", clientAssistantListening);
    assistantMic.setAttribute(
      "aria-label",
      clientAssistantListening ? "Arrêter l'écoute vocale" : "Activer l'écoute vocale",
    );
  }
}

function scrollClientAssistantMessages() {
  if (!assistantMessages) return;
  assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

function appendClientAssistantMessage(role, content, meta) {
  if (!assistantMessages) return null;

  const row = document.createElement("article");
  row.className = "client-assistant-message " + role;

  if (role === "assistant") {
    row.innerHTML =
      clientAssistantLogoMark("client-assistant-avatar") +
      '<div class="client-assistant-bubble">' +
      "<p>" +
      clientAssistantEscape(content) +
      "</p>" +
      (meta && meta.escalate
        ? '<span class="client-assistant-handoff">Transmis à un spécialiste</span>'
        : "") +
      "</div>";
  } else {
    row.innerHTML =
      '<div class="client-assistant-bubble"><p>' +
      clientAssistantEscape(content) +
      "</p></div>";
  }

  assistantMessages.appendChild(row);
  scrollClientAssistantMessages();
  return row;
}

function appendClientAssistantThinking() {
  if (!assistantMessages) return null;

  const row = document.createElement("article");
  row.className = "client-assistant-message assistant is-loading";
  row.dataset.clientAssistantThinking = "true";
  row.innerHTML =
    clientAssistantLogoMark("client-assistant-avatar") +
    '<div class="client-assistant-bubble">' +
    '<span class="client-assistant-dots" aria-label="Sophie prépare une réponse">' +
    "<i></i><i></i><i></i>" +
    "</span>" +
    "</div>";

  assistantMessages.appendChild(row);
  scrollClientAssistantMessages();
  return row;
}

function removeClientAssistantThinking() {
  if (!assistantMessages) return;

  assistantMessages
    .querySelectorAll("[data-client-assistant-thinking]")
    .forEach(function(node) {
      node.remove();
    });
}

function clientAssistantFallback(message) {
  const text = String(message || "").toLowerCase();
  const financials = (clientAssistantAccount && clientAssistantAccount.financials) || {};
  const balance = Number(financials.availableBalanceCents || 42075) / 100;
  const balanceLabel = Number.isFinite(balance)
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(balance)
    : "visible dans votre espace client";

  if (/fraude|fraud|vol|vole|stolen|litige|reclamation|réclamation/.test(text)) {
    return {
      reply:
        "Cette demande est sensible. Je prépare le contexte pour qu'un spécialiste Bay4Bank prenne le relais en priorité.",
      escalate: true,
    };
  }

  if (/solde|balance|رصيد/.test(text)) {
    return {
      reply: "Votre solde disponible est de " + balanceLabel + ".",
      escalate: false,
    };
  }

  if (/carte|card|tarjeta/.test(text)) {
    return {
      reply:
        "Je peux vous aider avec votre carte Bay4Bank, les plafonds, le paiement en ligne ou l'orientation vers un conseiller si la demande est sensible.",
      escalate: false,
    };
  }

  if (/virement|transfer|transferencia|iban|rib/.test(text)) {
    return {
      reply:
        "Pour les virements et l'IBAN, vérifiez les informations dans la carte de compte courant. Pour une opération inhabituelle, je peux vous orienter vers un conseiller.",
      escalate: false,
    };
  }

  return {
    reply:
      "Je peux vous aider sur les demandes simples : solde, carte, virement, IBAN, accès au compte et orientation vers un conseiller si nécessaire.",
    escalate: false,
  };
}

function welcomeClientAssistant() {
  if (clientAssistantWelcomed) return;
  clientAssistantWelcomed = true;

  const name = clientAssistantName(clientAssistantAccount);
  if (assistantTitle) {
    assistantTitle.textContent = name ? "Sophie pour " + name : "Sophie";
  }

  appendClientAssistantMessage(
    "assistant",
    clientAssistantGreeting(clientAssistantAccount) +
      " Je peux vous aider avec vos demandes bancaires simples, vos cartes, vos virements et l'orientation vers un conseiller.",
  );
}

function openClientAssistant() {
  if (!clientAssistantAccount || clientAssistantAccount.kycStatus !== "approved") return;

  clientAssistantOpen = true;
  syncClientAssistantShell();
  welcomeClientAssistant();

  window.setTimeout(function() {
    if (assistantInput) assistantInput.focus();
  }, 120);
}

function closeClientAssistant() {
  clientAssistantOpen = false;
  stopClientAssistantListening(true);
  syncClientAssistantShell();
}

function interruptClientAssistant() {
  if (clientAssistantAbortController) {
    clientAssistantAbortController.abort();
  }
  stopClientAssistantListening(true);
  removeClientAssistantThinking();
  clientAssistantBusy = false;
  clientAssistantVoiceBusy = false;
  syncClientAssistantShell();
}

async function sendClientAssistantMessage(message) {
  const text = String(message || "").trim();
  if (!text || clientAssistantBusy || clientAssistantVoiceBusy) return;

  openClientAssistant();
  appendClientAssistantMessage("user", text);
  clientAssistantHistory.push({ role: "user", content: text });

  clientAssistantBusy = true;
  syncClientAssistantShell();
  appendClientAssistantThinking();

  const fallback = clientAssistantFallback(text);
  clientAssistantAbortController = new AbortController();
  const timeout = window.setTimeout(function() {
    if (clientAssistantAbortController) clientAssistantAbortController.abort();
  }, CLIENT_ASSISTANT_TIMEOUT_MS);

  try {
    const response = await fetch("/api/client-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + clientAssistantToken(),
      },
      signal: clientAssistantAbortController.signal,
      body: JSON.stringify({
        message: text,
        language: assistantLanguage ? assistantLanguage.value : "fr",
        history: clientAssistantHistory.slice(-16),
      }),
    });

    const payload = await response.json().catch(function() {
      return {};
    });

    const reply =
      response.ok && typeof payload.reply === "string" && payload.reply.trim()
        ? payload.reply.trim()
        : fallback.reply;

    removeClientAssistantThinking();
    appendClientAssistantMessage("assistant", reply, { escalate: Boolean(payload.escalate) });
    clientAssistantHistory.push({ role: "assistant", content: reply });
  } catch (error) {
    if (error && error.name !== "AbortError") {
      console.error("Client assistant error:", error);
    }
    removeClientAssistantThinking();
    appendClientAssistantMessage("assistant", fallback.reply, {
      escalate: fallback.escalate,
    });
    clientAssistantHistory.push({ role: "assistant", content: fallback.reply });
  } finally {
    window.clearTimeout(timeout);
    clientAssistantAbortController = null;
    clientAssistantBusy = false;
    syncClientAssistantShell();
  }
}

function getClientAssistantAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return (
    candidates.find(function(mimeType) {
      return MediaRecorder.isTypeSupported(mimeType);
    }) || ""
  );
}

function blobToBase64(blob) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onloadend = function() {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function cleanupClientAssistantMedia() {
  if (clientAssistantRecordingTimer) {
    window.clearTimeout(clientAssistantRecordingTimer);
    clientAssistantRecordingTimer = null;
  }

  if (clientAssistantMediaStream) {
    clientAssistantMediaStream.getTracks().forEach(function(track) {
      track.stop();
    });
  }

  clientAssistantMediaStream = null;
  clientAssistantMediaRecorder = null;
}

async function transcribeClientAssistantRecording(blob) {
  if (!blob || blob.size < CLIENT_ASSISTANT_MIN_AUDIO_BYTES) {
    appendClientAssistantMessage(
      "assistant",
      "Je n'ai pas capté assez d'audio. Cliquez sur le micro, parlez clairement, puis cliquez à nouveau pour envoyer.",
    );
    return;
  }

  clientAssistantVoiceBusy = true;
  syncClientAssistantShell();
  appendClientAssistantThinking();

  try {
    const audio = await blobToBase64(blob);
    const response = await fetch("/api/client-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + clientAssistantToken(),
      },
      body: JSON.stringify({
        action: "transcribe_voice",
        audio,
        mimeType: blob.type || "audio/webm",
        language: assistantLanguage ? assistantLanguage.value : "fr",
      }),
    });

    const payload = await response.json().catch(function() {
      return {};
    });

    const transcript = String(payload.text || "").trim();
    removeClientAssistantThinking();
    clientAssistantVoiceBusy = false;
    syncClientAssistantShell();

    if (!response.ok || !transcript) {
      appendClientAssistantMessage(
        "assistant",
        payload.error ||
          "Je n'ai pas entendu de voix claire. Cliquez sur le micro, parlez deux à trois secondes, puis cliquez à nouveau pour envoyer.",
      );
      return;
    }

    if (assistantInput) assistantInput.value = transcript;
    await sendClientAssistantMessage(transcript);
  } catch (error) {
    console.error("Client voice transcription error:", error);
    removeClientAssistantThinking();
    appendClientAssistantMessage(
      "assistant",
      "La transcription OpenAI est indisponible pour le moment. Vous pouvez écrire votre demande.",
    );
  } finally {
    clientAssistantVoiceBusy = false;
    syncClientAssistantShell();
  }
}

async function startClientAssistantListening() {
  if (clientAssistantListening) {
    stopClientAssistantListening(false);
    return;
  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    appendClientAssistantMessage(
      "assistant",
      "Le micro du navigateur n'est pas disponible. Vous pouvez écrire votre demande.",
    );
    return;
  }

  try {
    openClientAssistant();
    clientAssistantAudioChunks = [];
    clientAssistantDiscardRecording = false;
    clientAssistantMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const mimeType = getClientAssistantAudioMimeType();
    clientAssistantMediaRecorder = new MediaRecorder(
      clientAssistantMediaStream,
      mimeType ? { mimeType } : undefined,
    );

    clientAssistantMediaRecorder.addEventListener("dataavailable", function(event) {
      if (event.data && event.data.size > 0) {
        clientAssistantAudioChunks.push(event.data);
      }
    });

    clientAssistantMediaRecorder.addEventListener("stop", function() {
      const blob = new Blob(clientAssistantAudioChunks, {
        type:
          (clientAssistantMediaRecorder && clientAssistantMediaRecorder.mimeType) ||
          mimeType ||
          "audio/webm",
      });
      const shouldDiscard = clientAssistantDiscardRecording;
      clientAssistantAudioChunks = [];
      cleanupClientAssistantMedia();
      if (!shouldDiscard) transcribeClientAssistantRecording(blob);
    });

    clientAssistantMediaRecorder.start(250);
    clientAssistantListening = true;
    syncClientAssistantShell();

    if (!clientAssistantHasVoiceHint) {
      clientAssistantHasVoiceHint = true;
      appendClientAssistantMessage(
        "assistant",
        "Je vous écoute. Parlez maintenant, puis cliquez à nouveau sur le micro pour envoyer.",
      );
    }

    clientAssistantRecordingTimer = window.setTimeout(function() {
      stopClientAssistantListening(false);
    }, CLIENT_ASSISTANT_RECORDING_MAX_MS);
  } catch (error) {
    console.error("Client microphone error:", error);
    cleanupClientAssistantMedia();
    clientAssistantListening = false;
    syncClientAssistantShell();
    appendClientAssistantMessage(
      "assistant",
      "Autorisez l'accès au micro pour utiliser la voix, ou écrivez votre demande.",
    );
  }
}

function stopClientAssistantListening(discardRecording) {
  if (!clientAssistantListening && !clientAssistantMediaRecorder) return;

  clientAssistantDiscardRecording = Boolean(discardRecording);
  clientAssistantListening = false;

  if (clientAssistantRecordingTimer) {
    window.clearTimeout(clientAssistantRecordingTimer);
    clientAssistantRecordingTimer = null;
  }

  if (
    clientAssistantMediaRecorder &&
    clientAssistantMediaRecorder.state &&
    clientAssistantMediaRecorder.state !== "inactive"
  ) {
    if (clientAssistantMediaRecorder.requestData) {
      try {
        clientAssistantMediaRecorder.requestData();
      } catch (error) {
        console.warn("Client microphone flush skipped:", error);
      }
    }
    clientAssistantMediaRecorder.stop();
  } else {
    cleanupClientAssistantMedia();
  }

  syncClientAssistantShell();
}

async function loadClientAssistantEligibility() {
  const token = clientAssistantToken();

  if (!token) {
    clientAssistantAccount = null;
    setClientAssistantVisibility(false);
    return;
  }

  try {
    const response = await fetch("/api/auth/session", {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    const payload = await response.json().catch(function() {
      return {};
    });

    if (!response.ok || !payload.account || payload.account.kycStatus !== "approved") {
      clientAssistantAccount = null;
      setClientAssistantVisibility(false);
      return;
    }

    clientAssistantAccount = payload.account;
    setClientAssistantVisibility(true);
    syncClientAssistantShell();
  } catch (error) {
    console.error("Client assistant eligibility error:", error);
    clientAssistantAccount = null;
    setClientAssistantVisibility(false);
  }
}

function initClientAssistant() {
  if (!assistantLauncher || !assistantShell) return;

  assistantLauncher.addEventListener("click", openClientAssistant);
  if (assistantHeaderCta) assistantHeaderCta.addEventListener("click", openClientAssistant);
  if (assistantClose) assistantClose.addEventListener("click", closeClientAssistant);
  if (assistantMinimize) assistantMinimize.addEventListener("click", closeClientAssistant);
  if (assistantInterrupt) {
    assistantInterrupt.addEventListener("click", function() {
      if (clientAssistantBusy || clientAssistantVoiceBusy) {
        interruptClientAssistant();
        return;
      }
      startClientAssistantListening();
    });
  }
  if (assistantMic) assistantMic.addEventListener("click", startClientAssistantListening);
  if (assistantMute) assistantMute.addEventListener("click", interruptClientAssistant);

  if (assistantInput) {
    assistantInput.addEventListener("input", syncClientAssistantShell);
    assistantInput.addEventListener("keydown", function(event) {
      if ((event.key === "Enter" || event.keyCode === 13) && !event.shiftKey) {
        event.preventDefault();
        const value = assistantInput.value.trim();
        assistantInput.value = "";
        syncClientAssistantShell();
        sendClientAssistantMessage(value);
      }
    });
  }

  if (assistantSend) {
    assistantSend.addEventListener("click", function(event) {
      event.preventDefault();
      if (!assistantInput) return;
      const value = assistantInput.value.trim();
      assistantInput.value = "";
      syncClientAssistantShell();
      sendClientAssistantMessage(value);
    });
  }

  if (assistantComposer) {
    assistantComposer.addEventListener("submit", function(event) {
      event.preventDefault();
    });
  }

  assistantQuickActions.forEach(function(button) {
    button.addEventListener("click", function() {
      sendClientAssistantMessage(button.dataset.clientAssistantPrompt || button.textContent);
    });
  });

  document.addEventListener("click", function(event) {
    if (event.target && event.target.closest && event.target.closest("#logoutBtn")) {
      window.setTimeout(loadClientAssistantEligibility, 700);
    }
  });

  window.addEventListener("storage", function(event) {
    if (event.key === CLIENT_ASSISTANT_AUTH_KEY) loadClientAssistantEligibility();
  });

  loadClientAssistantEligibility();
  syncClientAssistantShell();
}

initClientAssistant();
