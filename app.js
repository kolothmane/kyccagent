console.log("Build: Pro UI v4");
const messages = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const fileInput = document.getElementById("file");
const profileForm = document.getElementById("profile");
const result = document.getElementById("result");
const elapsedEl = document.getElementById("elapsed");
const barEl = document.getElementById("bar");

const DATE_RE = /\b(19|20)\d{2}[- /.](0[1-9]|1[0-2])[- /.](0[1-9]|[12]\d|3[01])\b/;
const UK_POST_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;


function stripForbidden(s){
  if(!s) return "";
  // remove lines that start with irrelevant labels
  return s.replace(/^(Nationality|Issue Date|Expiry Date|Authority|Passport|ID Number).*$/gi, "").trim();
}

const LABELS = [
  "Type:", "Country Code:", "Passport No:", "Passport Number:", "Surname:", "Given Names:",
  "Nationality:", "Date of Birth:", "DOB:", "Place of Birth:", "Date of Issue:", "Date of Expiry:", "Expiry Date:",
  "Authority:", "Residential Address:", "Address:", "Customer Name:", "Service Address:", "ID Number:", "ID No:"
];

function say(text, who="agent"){ const d=document.createElement("div"); d.className=`msg ${who}`; d.textContent=text; messages.appendChild(d); messages.scrollTop=messages.scrollHeight; }

// SLA timer
const startedAt = Date.now();
setInterval(()=>{ const diff=Math.floor((Date.now()-startedAt)/1000); const mm=String(Math.floor(diff/60)).padStart(2,"0"); const ss=String(diff%60).padStart(2,"0"); elapsedEl.textContent=`${mm}:${ss}`; barEl.style.width=Math.min(100,(diff/180)*100)+"%"; },500);

// Welcome
say("👋 Welcome to XXX! I’ll guide you through opening your account and verifying your identity. Just upload your photo ID and a recent proof of address. I’ll pre‑fill your details for you to confirm. Ready to begin?");

// Chat send
sendBtn.addEventListener("click", ()=>{ const t=input.value.trim(); if(!t) return; say(t,"user"); input.value=""; });

// Upload
fileInput.addEventListener("change", async (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  say(`Processing ${f.name}…`);
  try{
    let text="";
    if(f.type==="application/pdf") text = await pdfText(f);
    else text = await ocrImage(f);
    const rec = extract(text);
    fill(rec);
    say("I auto‑filled what I could. Review the right panel and adjust if needed, then press **Continue**.");
  }catch(err){
    say("⚠️ Sorry, I couldn't read that file. Try a PDF, JPG or PNG under 10MB.");
    console.error(err);
  }
});

// PDF + OCR
async function pdfText(file){
  const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs");
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";
  }
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  let full = "";
  for (let p=1;p<=pdf.numPages;p++){ const page=await pdf.getPage(p); const c=await page.getTextContent(); full += c.items.map(i=>i.str).join(" ") + "\\n"; }
  return full;
}
async function ocrImage(file){ const { createWorker } = Tesseract; const w = await createWorker("eng"); const { data } = await w.recognize(file); await w.terminate(); return data.text || ""; }

// Helpers
function firstLineAfter(text, label){
  const i = text.search(new RegExp(label.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&"), "i"));
  if (i === -1) return "";
  const rest = text.slice(i + label.length);
  // stop at newline OR next label, whichever comes first
  let stop = rest.indexOf("\\n");
  if (stop === -1) stop = rest.length;
  const line = rest.slice(0, stop);
  return line.trim();
}
// Stop at next label strictly
function valueAfterScoped(text, label){
  const idx = text.search(new RegExp(label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"), "i"));
  if (idx === -1) return "";
  const start = idx + label.length;
  const slice = text.slice(start);
  let cut = slice.length;
  for (const L of LABELS) {
    const j = slice.search(new RegExp("\\\\b" + L.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"), "i"));
    if (j !== -1 && j < cut) cut = j;
  }
  return slice.slice(0, cut).trim();
}
// Cleaners
const cleanName = s => (s||"").replace(/[^A-Za-z' -]/g," ").trim().split(/\s+/)[0].toUpperCase();
const cleanAlpha = s => (s||"").replace(/[^A-Za-z -]/g," ").trim();
const cleanDoc = s => (s||"").replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,32);

// Extract
function extract(t){
  const rec = {};
  // Names
  const given = firstLineAfter(t,"Given Names:") || firstLineAfter(t,"Name:");
  const surname = firstLineAfter(t,"Surname:");
  rec.firstName = cleanName(given);
  rec.lastName  = cleanName(surname);
  // DOB / Expiry (strict)
  const dobRaw = valueAfterScoped(t,"Date of Birth:") || valueAfterScoped(t,"DOB:");
  rec.dob = (dobRaw.match(DATE_RE)||[])[0] || "";
  const expRaw = valueAfterScoped(t,"Date of Expiry:") || valueAfterScoped(t,"Expiry Date:");
  rec.expiry = (expRaw.match(DATE_RE)||[])[0] || "";
  // Document number
  const docRaw = valueAfterScoped(t,"Passport No:") || valueAfterScoped(t,"Passport Number:") ||
                 valueAfterScoped(t,"ID Number:")   || valueAfterScoped(t,"ID No:");
  rec.docNumber = cleanDoc(docRaw);
  // Nationality (only word right after label)
  const natLine = firstLineAfter(t,"Nationality:");
  rec.nationality = cleanAlpha(natLine).split(" ")[0] || "";
  // Address
  const addr = valueAfterScoped(t,"Service Address:") || valueAfterScoped(t,"Residential Address:") || valueAfterScoped(t,"Address:");
  const pc = (addr.match(UK_POST_RE)||[])[1] || "";
  const parts = addr.replace(UK_POST_RE,"").split(",").map(s=>s.trim()).filter(Boolean);
  rec.street = stripForbidden(parts[0]||""); rec.city = stripForbidden(parts[1]||""); rec.state = stripForbidden(parts[2]||""); rec.postal = pc.toUpperCase();
  return rec;
}

function fill(r){
  const map = { firstName:r.firstName, lastName:r.lastName, dob:r.dob, street:r.street, city:r.city, state:r.state, postal:r.postal };
  Object.entries(map).forEach(([k,v])=>{ if(v && profileForm.elements[k]) profileForm.elements[k].value = v; });
  if(r.docNumber) document.getElementById("docNumber").textContent = r.docNumber;
  if(r.expiry) document.getElementById("docExpiry").textContent = r.expiry;
  if(r.nationality) document.getElementById("nationality").textContent = r.nationality;
}

// CTA
document.getElementById("submit").addEventListener("click",(e)=>{
  e.preventDefault();
  result.textContent = "Thanks! Your details have been submitted for verification. You’ll receive updates by email.";
});
