const BACKEND_URL = 'http://localhost:3000/api/session';
const INSTAGRAM_URL = 'https://www.instagram.com/';

function normalizeCookie(cookie) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    expirationDate: cookie.expirationDate,
    sameSite: cookie.sameSite,
  };
}

async function collectInstagramCookies() {
  const cookies = await chrome.cookies.getAll({ url: INSTAGRAM_URL });
  const normalized = cookies
    .filter((cookie) => /instagram\.com$/i.test(cookie.domain ?? ''))
    .map(normalizeCookie);

  const sessionCookie = normalized.find((cookie) => cookie.name === 'sessionid');
  if (!sessionCookie) {
    throw new Error('Cookie sessionid introuvable. Connecte-toi d’abord à Instagram dans Chrome.');
  }

  return normalized;
}

async function sendCookiesToBackend(cookies) {
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cookies }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Instagram Session Bridge installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'CONNECT_INSTAGRAM') {
    return false;
  }

  (async () => {
    try {
      const cookies = await collectInstagramCookies();
      const result = await sendCookiesToBackend(cookies);
      sendResponse({ ok: true, username: result.username ?? null });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Erreur inconnue' });
    }
  })();

  return true;
});
