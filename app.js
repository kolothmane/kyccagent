/**
 * KYC Onboarding — frontend controller
 *
 * Wires the existing three-panel UI to backend API endpoints.
 * All document intelligence (OCR / extraction) happens server-side via OpenAI.
 * Client-side: PDF→image rendering (PDF.js), image compression, UI state management.
 */
console.log("Build: KYC v2 — backend-powered");

// ─── DOM refs ──────────────────────────────────────────────────────────────────
const messages    = document.getElementById("messages");
const input       = document.getElementById("input");
const sendBtn     = document.getElementById("send");
const fileInput   = document.getElementById("file");
const profileForm = document.getElementById("profile");
const result      = document.getElementById("result");
const elapsedEl   = document.getElementById("elapsed");
const barEl       = document.getElementById("bar");
const checklist   = document.querySelector(".checklist");
const stepItems   = document.querySelectorAll(".steps-list li");

// ─── Session state ─────────────────────────────────────────────────────────────
let sessionId          = sessionStorage.getItem("kycSessionId") || null;
let chatHistory        = [];
let identityExtraction = null;
let addressExtraction  = null;
let uploadedDocuments  = [];
let validationErrors   = [];
let validationWarnings = [];
let currentStep        = "welcome"; // welcome | upload | review | confirm

// ─── SLA timer ─────────────────────────────────────────────────────────────────
const startedAt = Date.now();
setInterval(() => {
  const diff = Math.floor((Date.now() - startedAt) / 1000);
  const mm = String(Math.floor(diff / 60)).padStart(2, "0");
  const ss = String(diff % 60).padStart(2, "0");
  elapsedEl.textContent = `${mm}:${ss}`;
  barEl.style.width = Math.min(100, (diff / 180) * 100) + "%";
}, 500);

// ─── Utility: chat message ─────────────────────────────────────────────────────
function say(text, who = "agent") {
  const d = document.createElement("div");
  d.className = `msg ${who}`;
  d.textContent = text;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
  const es = document.getElementById("emptyState");
  if (es) es.remove();
}

// ─── Utility: processing indicator in chat ────────────────────────────────────
function showProcessing(label) {
  const d = document.createElement("div");
  d.className = "msg agent processing";
  d.id = "processingMsg";
  const spin = document.createElement("span");
  spin.className = "spinner";
  spin.setAttribute("aria-hidden", "true");
  d.appendChild(spin);
  d.appendChild(document.createTextNode(" " + label));
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

// ─── Utility: document checklist ─────────────────────────────────────────────
function updateChecklist() {
  if (!checklist) return;
  const items = [
    { key: "identity", label: "Photo ID / Passport",  sub: "Passport, national ID or driving licence" },
    { key: "address",  label: "Proof of address",      sub: "Utility bill, bank statement (< 90 days)" },
  ];
  const ul = document.createElement("ul");
  ul.className = "check-items";
  items.forEach(function(item) {
    const done = uploadedDocuments.includes(item.key);
    const li = document.createElement("li");
    li.innerHTML = '<div class="cm">' + (done ? "✅" : "⬜") + " " + item.label + '</div><div class="cs">' + item.sub + "</div>";
    ul.appendChild(li);
  });
  checklist.innerHTML = '<div class="check-title">Document checklist</div>';
  checklist.appendChild(ul);
}

// ─── Utility: step indicator ──────────────────────────────────────────────────
const STEPS = ["welcome", "upload", "review", "confirm"];
function setStep(step) {
  currentStep = step;
  const idx = STEPS.indexOf(step);
  stepItems.forEach(function(li, i) {
    li.classList.toggle("active", i === idx);
    li.classList.toggle("done",   i < idx);
  });
}

// ─── Utility: fill review form from extraction data ───────────────────────────
function fillForm(r) {
  const addr = r.address || "";
  const addrParts = addr.split(",");
  const map = {
    firstName: r.firstName,
    lastName:  r.lastName,
    dob:       r.dateOfBirth,
    street:    r.street || (addrParts[0] || "").trim(),
    city:      r.city   || (addrParts[1] || "").trim(),
    state:     r.state  || (addrParts[2] || "").trim(),
    postal:    r.postal,
  };
  Object.keys(map).forEach(function(k) {
    const v = map[k];
    if (v && profileForm.elements[k]) profileForm.elements[k].value = v;
  });
  if (r.documentNumber) document.getElementById("docNumber").textContent = r.documentNumber;
  if (r.dateOfExpiry)   document.getElementById("docExpiry").textContent = r.dateOfExpiry;
  if (r.nationality)    document.getElementById("nationality").textContent = r.nationality;
}

// ─── Utility: validation banner in details panel ──────────────────────────────
function showValidationBanner(errors, warnings) {
  const existing = document.querySelectorAll(".validation-banner");
  existing.forEach(function(el) { el.remove(); });
  if (errors.length === 0 && warnings.length === 0) return;
  const banner = document.createElement("div");
  const isError = errors.length > 0;
  banner.className = "validation-banner " + (isError ? "banner-error" : "banner-warning");
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

// ─── Session init ──────────────────────────────────────────────────────────────
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

// ─── Chat send (backend-powered) ──────────────────────────────────────────────
async function sendMessage(text) {
  if (!text.trim()) return;
  say(text, "user");
  chatHistory.push({ role: "user", content: text });
  showProcessing("Thinking…");
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        message: text,
        history: chatHistory.slice(-20),
        context: {
          step: currentStep,
          uploadedDocuments: uploadedDocuments,
          validationErrors: validationErrors,
          validationWarnings: validationWarnings,
        },
      }),
    });
    removeProcessing();
    if (!resp.ok) {
      say("⚠️ Chat service temporarily unavailable. Please try again.");
      return;
    }
    const data = await resp.json();
    const reply = data.reply || "I'm sorry, I couldn't generate a response.";
    say(reply);
    chatHistory.push({ role: "assistant", content: reply });
  } catch (e) {
    removeProcessing();
    say("⚠️ Network error. Please check your connection and try again.");
  }
}

sendBtn.addEventListener("click", function() {
  const t = input.value.trim();
  if (!t) return;
  input.value = "";
  sendMessage(t);
});
input.addEventListener("keydown", function(e) {
  if ((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

// ─── Image preparation: PDF→canvas + compress ─────────────────────────────────
async function prepareImageForUpload(file) {
  let bitmap;

  if (file.type === "application/pdf") {
    const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs");
    if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 2.0 });
    const offscreen = document.createElement("canvas");
    offscreen.width  = vp.width;
    offscreen.height = vp.height;
    await page.render({ canvasContext: offscreen.getContext("2d"), viewport: vp }).promise;
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
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  return { base64: base64, mimeType: "image/jpeg" };
}

// ─── Guess document category from filename ────────────────────────────────────
function guessCategory(fileName) {
  const lower = (fileName || "").toLowerCase();
  if (/selfie|liveness/.test(lower))                            return "selfie";
  if (/bill|address|utility|council|bank|statement/.test(lower)) return "address";
  return "identity";
}

// ─── File upload → backend extraction ────────────────────────────────────────
fileInput.addEventListener("change", async function(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;

  await initSession();
  setStep("upload");

  const allowed = ["image/jpeg","image/png","image/webp","image/gif","application/pdf"];
  if (!allowed.includes(f.type)) {
    say("⚠️ Unsupported file type. Please upload a JPEG, PNG, WebP, or PDF document.");
    return;
  }

  const documentCategory = guessCategory(f.name);
  showProcessing("Processing " + f.name + "…");

  try {
    const prepared = await prepareImageForUpload(f);
    const base64 = prepared.base64;
    const mimeType = prepared.mimeType;

    const approxBytes = Math.ceil((base64.length * 3) / 4);
    if (approxBytes > 4 * 1024 * 1024) {
      removeProcessing();
      say("⚠️ The document image is too large. Please use a smaller or lower-resolution file.");
      return;
    }

    const resp = await fetch("/api/kyc/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        documentCategory: documentCategory,
        fileName: f.name,
        mimeType: mimeType,
        data: base64,
      }),
    });

    removeProcessing();

    if (!resp.ok) {
      const err = await resp.json().catch(function() { return {}; });
      say("⚠️ " + (err.error || "Upload failed. Please try again."));
      return;
    }

    const uploadResult = await resp.json();
    const extraction = uploadResult.extraction;
    const validation = uploadResult.validation;

    if (!uploadedDocuments.includes(documentCategory)) uploadedDocuments.push(documentCategory);
    if (documentCategory === "identity") identityExtraction = extraction;
    if (documentCategory === "address")  addressExtraction  = extraction;

    validationErrors   = validation.errors   || [];
    validationWarnings = validation.warnings || [];

    updateChecklist();
    showValidationBanner(validationErrors, validationWarnings);

    if (documentCategory === "identity" || documentCategory === "address") {
      fillForm(extraction);
      setStep("review");
    }

    if (validation.passed) {
      say("✅ " + f.name + " processed successfully. Please review and confirm the pre-filled details on the right.");
    } else {
      say("⚠️ Document processed with issues:\n" + validationErrors.join("\n") + "\nPlease re-upload a valid document or correct the details manually.");
    }
  } catch (err) {
    removeProcessing();
    console.error("Upload error:", err);
    say("⚠️ An error occurred while processing your document. Please try again.");
  }
});

// ─── Submit ────────────────────────────────────────────────────────────────────
document.getElementById("submit").addEventListener("click", async function(e) {
  e.preventDefault();
  await initSession();
  setStep("confirm");

  const profileData = {};
  ["firstName","lastName","email","phone","country","dob","street","city","state","postal"].forEach(function(name) {
    const el = profileForm.elements[name];
    if (el) profileData[name] = el.value;
  });

  showProcessing("Submitting your application…");

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
      const err = await resp.json().catch(function() { return {}; });
      say("⚠️ Submission failed: " + (err.error || "please try again."));
      return;
    }

    const subResult = await resp.json();
    const recon = subResult.reconciliation || {};

    if (subResult.status === "approved") {
      result.textContent = "✅ Application submitted and pre-approved. You'll receive confirmation by email shortly.";
      say("Your identity has been verified and your application submitted. Welcome aboard!");
    } else {
      result.textContent = "📋 Application submitted — pending manual review. Our team will contact you within 1–2 business days.";
      say("Your application has been submitted for review. Our compliance team will be in touch within 1–2 business days.");
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

// ─── Init ──────────────────────────────────────────────────────────────────────
(async function() {
  updateChecklist();
  await initSession();
  say("👋 Welcome to DEMO! I'll guide you through verifying your identity. Please upload your photo ID and a recent proof of address — I'll extract your details automatically. Ready to begin?");
})();
