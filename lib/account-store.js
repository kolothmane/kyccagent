"use strict";

const { randomUUID, scryptSync, timingSafeEqual } = require("crypto");
const { Redis } = require("@upstash/redis");

const memoryStore = globalThis.__BAY4BANK_ACCOUNT_STORE__ || {
  accounts: [],
  sessions: [],
};

globalThis.__BAY4BANK_ACCOUNT_STORE__ = memoryStore;

const ACCOUNT_KEY_PREFIX = "bay4bank:accounts:item:";
const EMAIL_KEY_PREFIX = "bay4bank:accounts:email:";
const SESSION_KEY_PREFIX = "bay4bank:accounts:session:";
const ACCOUNT_INDEX_KEY = "bay4bank:accounts:index";
const SESSION_TTL_DAYS = 30;
const DEFAULT_FINANCIALS = {
  availableBalanceCents: 42075,
  monthlyLimitCents: 150000,
  recentCardPaymentCents: 1290,
  recentIncomingTransferCents: 25000,
  cardLast4: "4821",
  onlinePaymentsEnabled: true,
};

let redisClient = undefined;

function getRedisUrl() {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
}

function getRedisToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
}

function hasRedisConfig() {
  return Boolean(getRedisUrl() && getRedisToken());
}

function getRedisClient() {
  if (redisClient !== undefined) return redisClient;

  if (!hasRedisConfig()) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({
    url: getRedisUrl(),
    token: getRedisToken(),
  });

  return redisClient;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function parseJson(raw) {
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  return raw;
}

function plusDays(isoDate, days) {
  return new Date(new Date(isoDate).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function pickOwner(seed) {
  const owners = ["Amina Rahal", "Lucas Meyer", "Sarah Klein", "Noah Bernard"];
  const input = cleanText(seed || "bay4bank");
  const index = input.length % owners.length;
  return owners[index];
}

function hashPassword(password, salt) {
  return scryptSync(String(password || ""), String(salt || ""), 64).toString("hex");
}

function createPasswordRecord(password) {
  const salt = randomUUID().replace(/-/g, "");
  return {
    salt,
    hash: hashPassword(password, salt),
  };
}

function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;

  const incoming = Buffer.from(hashPassword(password, salt), "hex");
  const stored = Buffer.from(hash, "hex");

  if (incoming.length !== stored.length) return false;
  return timingSafeEqual(incoming, stored);
}

function accountKey(accountId) {
  return ACCOUNT_KEY_PREFIX + accountId;
}

function emailKey(email) {
  return EMAIL_KEY_PREFIX + normalizeEmail(email);
}

function sessionKey(token) {
  return SESSION_KEY_PREFIX + token;
}

function ensureSerializableArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCents(value, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.max(-999999999, Math.min(999999999, Math.round(number)));
}

function normalizePositiveCents(value, fallback) {
  return Math.max(0, normalizeCents(value, fallback));
}

function normalizeCardLast4(value, fallback) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length >= 4) return digits.slice(-4);
  return fallback;
}

function normalizeFinancials(value) {
  const input = value && typeof value === "object" ? value : {};

  return {
    availableBalanceCents: normalizeCents(
      input.availableBalanceCents,
      DEFAULT_FINANCIALS.availableBalanceCents,
    ),
    monthlyLimitCents: normalizePositiveCents(
      input.monthlyLimitCents,
      DEFAULT_FINANCIALS.monthlyLimitCents,
    ),
    recentCardPaymentCents: normalizePositiveCents(
      input.recentCardPaymentCents,
      DEFAULT_FINANCIALS.recentCardPaymentCents,
    ),
    recentIncomingTransferCents: normalizePositiveCents(
      input.recentIncomingTransferCents,
      DEFAULT_FINANCIALS.recentIncomingTransferCents,
    ),
    cardLast4: normalizeCardLast4(input.cardLast4, DEFAULT_FINANCIALS.cardLast4),
    onlinePaymentsEnabled:
      typeof input.onlinePaymentsEnabled === "boolean"
        ? input.onlinePaymentsEnabled
        : DEFAULT_FINANCIALS.onlinePaymentsEnabled,
  };
}

function normalizeAccountRecord(input) {
  const now = new Date().toISOString();
  const email = normalizeEmail(input.contactEmail || input.email);
  const emailHandle = email.split("@")[0] || "client";

  return {
    accountId: input.accountId || "acct_" + randomUUID().split("-")[0],
    customerId: input.customerId || "client_" + randomUUID().split("-")[0],
    accountName: cleanText(input.accountName) || "Compte " + emailHandle,
    planName: cleanText(input.planName) || "Bay4Bank Everyday",
    owner: cleanText(input.owner) || pickOwner(email),
    contactEmail: email,
    emailLower: email,
    phone: cleanText(input.phone),
    firstName: cleanText(input.firstName),
    lastName: cleanText(input.lastName),
    country: cleanText(input.country),
    dob: cleanText(input.dob),
    street: cleanText(input.street),
    city: cleanText(input.city),
    state: cleanText(input.state),
    postal: cleanText(input.postal),
    documentNumber: cleanText(input.documentNumber),
    documentExpiry: cleanText(input.documentExpiry),
    nationality: cleanText(input.nationality),
    kycStatus: input.kycStatus || null,
    humanReviewRequired: Boolean(input.humanReviewRequired),
    humanReviewReason: cleanText(input.humanReviewReason),
    submissionId: cleanText(input.submissionId),
    submittedAt: input.submittedAt || null,
    decisionAt: input.decisionAt || null,
    decisionBy: cleanText(input.decisionBy),
    crmLogs: input.crmLogs || null,
    activity: ensureSerializableArray(input.activity),
    financials: normalizeFinancials(input.financials),
    kycSessionId: cleanText(input.kycSessionId || input.sessionId),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    lastLoginAt: input.lastLoginAt || null,
    passwordSalt: cleanText(input.passwordSalt),
    passwordHash: cleanText(input.passwordHash),
  };
}

function mergeAccountRecord(current, patch) {
  const next = normalizeAccountRecord(
    Object.assign({}, current || {}, patch || {}, {
      accountId: current && current.accountId,
      customerId: (patch && patch.customerId) || (current && current.customerId),
      createdAt: current && current.createdAt,
      passwordSalt: (current && current.passwordSalt) || (patch && patch.passwordSalt),
      passwordHash: (current && current.passwordHash) || (patch && patch.passwordHash),
    }),
  );

  next.updatedAt = new Date().toISOString();
  next.lastLoginAt = (patch && patch.lastLoginAt) || (current && current.lastLoginAt) || null;
  next.activity =
    Array.isArray(patch && patch.activity) && patch.activity.length
      ? patch.activity
      : ensureSerializableArray(current && current.activity);
  next.crmLogs =
    patch && Object.prototype.hasOwnProperty.call(patch, "crmLogs")
      ? patch.crmLogs
      : current && current.crmLogs
        ? current.crmLogs
        : null;

  return next;
}

function sanitizeAccount(account) {
  if (!account) return null;

  const next = clone(account);
  delete next.passwordHash;
  delete next.passwordSalt;
  delete next.emailLower;
  return next;
}

function buildSessionRecord(account) {
  const createdAt = new Date().toISOString();
  return {
    token: "sess_" + randomUUID().replace(/-/g, ""),
    accountId: account.accountId,
    emailLower: account.emailLower,
    createdAt,
    expiresAt: plusDays(createdAt, SESSION_TTL_DAYS),
  };
}

async function resolveAccountId(redis, ref) {
  if (!ref) return null;

  if (ref.accountId) {
    const existing = await redis.get(accountKey(ref.accountId));
    if (existing) return ref.accountId;
  }

  const email = normalizeEmail(ref.contactEmail || ref.email);
  if (email) {
    const mapped = await redis.get(emailKey(email));
    if (mapped) return String(mapped);
  }

  return null;
}

async function persistAccount(redis, account) {
  await Promise.all([
    redis.set(accountKey(account.accountId), JSON.stringify(account)),
    redis.set(emailKey(account.contactEmail), account.accountId),
    redis.zadd(ACCOUNT_INDEX_KEY, {
      score: new Date(account.updatedAt || account.createdAt || Date.now()).getTime(),
      member: account.accountId,
    }),
  ]);
}

async function persistSession(redis, session) {
  await redis.set(sessionKey(session.token), JSON.stringify(session));
}

async function removeSession(redis, token) {
  await redis.del(sessionKey(token));
}

function getMemoryAccount(ref) {
  const email = normalizeEmail(ref && (ref.contactEmail || ref.email));
  const account = memoryStore.accounts.find(function(item) {
    return Boolean(
      (ref && ref.accountId && item.accountId === ref.accountId) ||
        (email && item.emailLower === email),
    );
  });

  return account ? clone(account) : null;
}

function upsertMemoryAccount(input) {
  const existing = getMemoryAccount(input);
  const next = existing ? mergeAccountRecord(existing, input) : normalizeAccountRecord(input);
  const index = memoryStore.accounts.findIndex(function(item) {
    return item.accountId === next.accountId;
  });

  if (index >= 0) {
    memoryStore.accounts[index] = next;
  } else {
    memoryStore.accounts.push(next);
  }

  return clone(next);
}

function getMemorySession(token) {
  const session = memoryStore.sessions.find(function(item) {
    return item.token === token;
  });

  return session ? clone(session) : null;
}

function persistMemorySession(session) {
  const index = memoryStore.sessions.findIndex(function(item) {
    return item.token === session.token;
  });

  if (index >= 0) {
    memoryStore.sessions[index] = session;
  } else {
    memoryStore.sessions.push(session);
  }

  return clone(session);
}

function removeMemorySession(token) {
  const index = memoryStore.sessions.findIndex(function(item) {
    return item.token === token;
  });

  if (index >= 0) {
    memoryStore.sessions.splice(index, 1);
  }
}

async function getAccount(ref) {
  const redis = getRedisClient();

  if (!redis) {
    return sanitizeAccount(getMemoryAccount(ref));
  }

  const accountId = await resolveAccountId(redis, ref);
  if (!accountId) return null;

  const raw = await redis.get(accountKey(accountId));
  const account = parseJson(raw);
  return sanitizeAccount(account);
}

async function listAccounts() {
  const redis = getRedisClient();

  if (!redis) {
    return memoryStore.accounts
      .slice()
      .sort(function(a, b) {
        return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      })
      .map(sanitizeAccount);
  }

  const indexedIds = await redis.zrange(ACCOUNT_INDEX_KEY, 0, -1, { rev: true });
  const keys = await redis.keys(ACCOUNT_KEY_PREFIX + "*");
  const keyIds = Array.isArray(keys)
    ? keys.map(function(key) {
        return String(key).replace(ACCOUNT_KEY_PREFIX, "");
      })
    : [];
  const accountIds = Array.from(new Set([].concat(indexedIds || [], keyIds)));

  const accounts = await Promise.all(
    accountIds.map(async function(accountId) {
      return parseJson(await redis.get(accountKey(accountId)));
    }),
  );

  return accounts
    .filter(Boolean)
    .sort(function(a, b) {
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    })
    .map(sanitizeAccount);
}

async function getRawAccount(ref) {
  const redis = getRedisClient();

  if (!redis) {
    return getMemoryAccount(ref);
  }

  const accountId = await resolveAccountId(redis, ref);
  if (!accountId) return null;

  return parseJson(await redis.get(accountKey(accountId)));
}

async function updateAccount(ref, patch) {
  const redis = getRedisClient();

  if (!redis) {
    const existing = getMemoryAccount(ref);
    if (!existing) return null;
    const next = upsertMemoryAccount(Object.assign({}, existing, patch || {}));
    return sanitizeAccount(next);
  }

  const current = await getRawAccount(ref);
  if (!current) return null;

  const next = mergeAccountRecord(current, patch || {});
  await persistAccount(redis, next);
  return sanitizeAccount(next);
}

async function resetAccountPassword(ref, password) {
  if (String(password || "").length < 8) {
    const error = new Error("Le mot de passe doit contenir au moins 8 caractères");
    error.code = "PASSWORD_TOO_SHORT";
    throw error;
  }

  const redis = getRedisClient();
  const current = redis ? await getRawAccount(ref) : getMemoryAccount(ref);

  if (!current) return null;

  const passwordRecord = createPasswordRecord(password);
  const next = normalizeAccountRecord(
    Object.assign({}, current, {
      passwordSalt: passwordRecord.salt,
      passwordHash: passwordRecord.hash,
      updatedAt: new Date().toISOString(),
    }),
  );

  if (!redis) {
    const index = memoryStore.accounts.findIndex(function(item) {
      return item.accountId === next.accountId;
    });

    if (index >= 0) {
      memoryStore.accounts[index] = next;
    } else {
      memoryStore.accounts.push(next);
    }

    return sanitizeAccount(next);
  }

  await persistAccount(redis, next);
  return sanitizeAccount(next);
}

async function registerAccount(input) {
  const email = normalizeEmail(input && input.email);
  const phone = cleanText(input && input.phone);
  const password = String((input && input.password) || "");

  if (!email) {
    const error = new Error("Adresse e-mail requise");
    error.code = "EMAIL_REQUIRED";
    throw error;
  }

  if (password.length < 8) {
    const error = new Error("Mot de passe trop court");
    error.code = "PASSWORD_TOO_SHORT";
    throw error;
  }

  const existing = await getRawAccount({ email });
  if (existing) {
    const error = new Error("Un compte existe déjà avec cette adresse e-mail");
    error.code = "ACCOUNT_EXISTS";
    throw error;
  }

  const passwordRecord = createPasswordRecord(password);
  const account = normalizeAccountRecord({
    contactEmail: email,
    phone,
    planName: "Bay4Bank Everyday",
    passwordSalt: passwordRecord.salt,
    passwordHash: passwordRecord.hash,
    kycSessionId: input && input.sessionId,
  });

  const redis = getRedisClient();
  if (!redis) {
    upsertMemoryAccount(account);
    const session = persistMemorySession(buildSessionRecord(account));
    return {
      account: sanitizeAccount(account),
      session,
    };
  }

  await persistAccount(redis, account);
  const session = buildSessionRecord(account);
  await persistSession(redis, session);

  return {
    account: sanitizeAccount(account),
    session,
  };
}

async function loginAccount(input) {
  const email = normalizeEmail(input && input.email);
  const password = String((input && input.password) || "");
  const redis = getRedisClient();

  const account = redis ? await getRawAccount({ email }) : getMemoryAccount({ email });
  if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    return null;
  }

  const updated = mergeAccountRecord(account, {
    lastLoginAt: new Date().toISOString(),
  });
  const session = buildSessionRecord(updated);

  if (!redis) {
    upsertMemoryAccount(updated);
    persistMemorySession(session);
  } else {
    await Promise.all([persistAccount(redis, updated), persistSession(redis, session)]);
  }

  return {
    account: sanitizeAccount(updated),
    session,
  };
}

async function getAccountBySessionToken(token) {
  const sessionToken = cleanText(token);
  if (!sessionToken) return null;

  const redis = getRedisClient();
  const session = redis
    ? parseJson(await redis.get(sessionKey(sessionToken)))
    : getMemorySession(sessionToken);

  if (!session) return null;

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    if (redis) {
      await removeSession(redis, sessionToken);
    } else {
      removeMemorySession(sessionToken);
    }
    return null;
  }

  return getAccount({ accountId: session.accountId });
}

async function logoutSession(token) {
  const sessionToken = cleanText(token);
  if (!sessionToken) return false;

  const redis = getRedisClient();
  if (!redis) {
    const exists = Boolean(getMemorySession(sessionToken));
    removeMemorySession(sessionToken);
    return exists;
  }

  const existing = await redis.get(sessionKey(sessionToken));
  if (!existing) return false;
  await removeSession(redis, sessionToken);
  return true;
}

async function syncAccountKyc(input) {
  const ref = {
    accountId: input && input.accountId,
    email: input && input.contactEmail,
  };

  const patch = {
    customerId: input && input.customerId,
    accountName: input && input.accountName,
    owner: input && input.owner,
    contactEmail: input && input.contactEmail,
    phone: input && input.phone,
    firstName: input && input.firstName,
    lastName: input && input.lastName,
    country: input && input.country,
    dob: input && input.dob,
    street: input && input.street,
    city: input && input.city,
    state: input && input.state,
    postal: input && input.postal,
    documentNumber: input && input.documentNumber,
    documentExpiry: input && input.documentExpiry,
    nationality: input && input.nationality,
    kycStatus: input && input.kycStatus,
    humanReviewRequired: Boolean(input && input.humanReviewRequired),
    humanReviewReason: input && input.humanReviewReason,
    submissionId: input && input.submissionId,
    submittedAt: input && input.submittedAt,
    kycSessionId: input && input.sessionId,
    activity: input && input.activity,
  };

  return updateAccount(ref, patch);
}

async function applyAccountReviewDecision(input) {
  return updateAccount(
    {
      accountId: input && input.accountId,
      email: input && input.contactEmail,
    },
    {
      kycStatus: input && input.kycStatus,
      humanReviewRequired: false,
      humanReviewReason: input && input.humanReviewReason,
      decisionAt: input && input.decisionAt,
      decisionBy: input && input.decisionBy,
      crmLogs:
        input && Object.prototype.hasOwnProperty.call(input, "crmLogs")
          ? input.crmLogs
          : null,
      activity: input && input.activity,
    },
  );
}

module.exports = {
  registerAccount,
  loginAccount,
  listAccounts,
  getAccount,
  getAccountBySessionToken,
  updateAccount,
  resetAccountPassword,
  syncAccountKyc,
  applyAccountReviewDecision,
  logoutSession,
};
