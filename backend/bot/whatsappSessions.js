const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const { processIncomingMessage } = require("./flowEngine");
const { canUseFeature } = require("../services/featureAccessService");
const { readTenant, listTenants, updateTenant } = require("../tenancy/tenantConfigStore");
const { readSession, writeSession } = require("../tenancy/tenantSessionStore");
const { assertTenantId } = require("../tenancy/tenantResolver");

const authDirectoryPath = path.resolve(__dirname, "../../data/.wwebjs_auth");
const sessions = {};
const RECONNECT_BASE_DELAY_MS = 5000;
const RECONNECT_MAX_DELAY_MS = 30000;
const RECONNECT_MAX_ATTEMPTS = Number(process.env.WHATSAPP_RECONNECT_MAX_ATTEMPTS || 15);
const SESSION_INIT_TIMEOUT_MS = Number(process.env.WHATSAPP_SESSION_INIT_TIMEOUT_MS || 120000);
const BOOTSTRAP_CONCURRENCY = Math.max(1, Number(process.env.WHATSAPP_BOOTSTRAP_CONCURRENCY || 1));
const BOOTSTRAP_MODE = String(process.env.WHATSAPP_BOOTSTRAP_MODE || "lazy").trim().toLowerCase();
const DEFAULT_PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu"
];

ensureAuthDirectory();

function ensureAuthDirectory() {
  fs.mkdirSync(authDirectoryPath, { recursive: true });
}

function getProvider() {
  return "whatsapp-web.js";
}

function getSessionEntry(tenantId) {
  return sessions[assertTenantId(tenantId)] || null;
}

function ensureSessionEntry(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);

  if (!sessions[resolvedTenantId]) {
    sessions[resolvedTenantId] = {
      tenantId: resolvedTenantId,
      client: null,
      isInitializing: false,
      isReady: false,
      stopRequested: false,
      lastQrImage: "",
      initializedAt: null,
      reconnectAttempts: 0,
      lastDisconnectAt: null,
      reconnectTimer: null,
      timing: {
        startAt: null,
        qrAt: null,
        authenticatedAt: null,
        readyAt: null
      }
    };
  }

  return sessions[resolvedTenantId];
}

function clearReconnectTimer(entry) {
  if (entry?.reconnectTimer) {
    clearTimeout(entry.reconnectTimer);
    entry.reconnectTimer = null;
  }
}

function resetTiming(entry) {
  if (!entry) {
    return;
  }

  entry.timing = {
    startAt: null,
    qrAt: null,
    authenticatedAt: null,
    readyAt: null
  };
}

function markTiming(entry, stage) {
  if (!entry) {
    return;
  }

  if (!entry.timing) {
    resetTiming(entry);
  }

  entry.timing[stage] = Date.now();
}

function getElapsedMs(entry, fromStage, toStage) {
  const from = entry?.timing?.[fromStage];
  const to = entry?.timing?.[toStage];

  if (!from || !to) {
    return null;
  }

  return Math.max(0, to - from);
}

function logSessionTiming(entry, tenantId, stage) {
  const total = getElapsedMs(entry, "startAt", stage);
  const startToQr = getElapsedMs(entry, "startAt", "qrAt");
  const qrToAuthenticated = getElapsedMs(entry, "qrAt", "authenticatedAt");
  const authenticatedToReady = getElapsedMs(entry, "authenticatedAt", "readyAt");
  const parts = [`[tenant:${tenantId}] timing:${stage}`];

  if (total !== null) {
    parts.push(`start->${stage}=${total}ms`);
  }

  if (startToQr !== null) {
    parts.push(`start->qr=${startToQr}ms`);
  }

  if (qrToAuthenticated !== null) {
    parts.push(`qr->authenticated=${qrToAuthenticated}ms`);
  }

  if (authenticatedToReady !== null) {
    parts.push(`authenticated->ready=${authenticatedToReady}ms`);
  }

  console.log(parts.join(" | "));
}

function getClientAuthDirectoryPath(tenantId) {
  return path.resolve(authDirectoryPath, `session-tenant-${assertTenantId(tenantId)}`);
}

function hasSessionArtifacts(tenantId) {
  const clientAuthDirectoryPath = getClientAuthDirectoryPath(tenantId);

  if (!fs.existsSync(clientAuthDirectoryPath)) {
    return false;
  }

  try {
    return fs.readdirSync(clientAuthDirectoryPath).length > 0;
  } catch (error) {
    console.error(`[tenant:${tenantId}] Nao foi possivel verificar artefatos da sessao:`, error);
    return false;
  }
}

function buildSessionId(tenantId, options = {}) {
  return options.sessionId || readSession(tenantId).sessionId || `${tenantId}-session`;
}

function buildPhoneNumber(client) {
  return String(client?.info?.wid?.user || client?.info?.me?.user || "");
}

function persistSession(tenantId, partialSession = {}) {
  const resolvedTenantId = assertTenantId(tenantId);
  const currentSession = readSession(resolvedTenantId);
  const nextSession = writeSession(resolvedTenantId, {
    ...currentSession,
    ...partialSession,
    tenantId: resolvedTenantId,
    provider: getProvider()
  });

  if (shouldSyncTenantWhatsappState(currentSession, nextSession, partialSession)) {
    updateTenant(resolvedTenantId, {
      whatsapp: {
        connected: Boolean(nextSession.connected),
        number: nextSession.connectedWhatsappNumber || nextSession.number || "",
        sessionId: nextSession.sessionId || ""
      }
    });
  }

  return nextSession;
}

function shouldSyncTenantWhatsappState(currentSession, nextSession, partialSession = {}) {
  if (partialSession?.syncTenantState === true) {
    return true;
  }

  const status = String(nextSession?.status || "");
  const currentConnected = Boolean(currentSession?.connected);
  const nextConnected = Boolean(nextSession?.connected);
  const currentNumber = String(currentSession?.connectedWhatsappNumber || currentSession?.number || "");
  const nextNumber = String(nextSession?.connectedWhatsappNumber || nextSession?.number || "");
  const currentSessionId = String(currentSession?.sessionId || "");
  const nextSessionId = String(nextSession?.sessionId || "");

  if (currentConnected !== nextConnected) {
    return true;
  }

  if (currentNumber !== nextNumber || currentSessionId !== nextSessionId) {
    return true;
  }

  return ["connected", "disconnected", "auth_failure", "reconnect_timeout", "initialization_failed"].includes(status);
}

function isSessionActive(entry) {
  return Boolean(entry?.client) && !entry.stopRequested;
}

function getReconnectDelay(attempts) {
  return Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * Math.max(1, attempts));
}

function withTimeout(promise, timeoutMs, errorMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function resetReconnectState(entry, tenantId) {
  if (!entry) {
    return;
  }

  clearReconnectTimer(entry);
  entry.reconnectAttempts = 0;
  entry.lastDisconnectAt = null;

  persistSession(tenantId, {
    reconnectAttempts: 0,
    lastDisconnectAt: null,
    nextReconnectAt: null,
    manualStop: false
  });
}

function scheduleReconnect(tenantId, reason = "") {
  const entry = ensureSessionEntry(tenantId);

  if (entry.stopRequested) {
    return;
  }

  if (entry.isInitializing || entry.client) {
    return;
  }

  clearReconnectTimer(entry);

  entry.reconnectAttempts = Number(entry.reconnectAttempts || 0) + 1;
  entry.lastDisconnectAt = new Date().toISOString();

  if (entry.reconnectAttempts > RECONNECT_MAX_ATTEMPTS) {
    persistSession(tenantId, {
      connected: false,
      status: "reconnect_timeout",
      reconnectAttempts: entry.reconnectAttempts,
      lastDisconnectAt: entry.lastDisconnectAt,
      nextReconnectAt: null,
      manualStop: false,
      lastError: String(reason || "reconnect_timeout")
    });

    console.error(`[tenant:${tenantId}] Limite de reconexao atingido (${RECONNECT_MAX_ATTEMPTS}).`);
    return;
  }

  const delay = getReconnectDelay(entry.reconnectAttempts);
  const nextReconnectAt = new Date(Date.now() + delay).toISOString();

  persistSession(tenantId, {
    connected: false,
    status: "reconnecting",
    reconnectAttempts: entry.reconnectAttempts,
    lastDisconnectAt: entry.lastDisconnectAt,
    nextReconnectAt,
    manualStop: false,
    lastError: String(reason || "")
  });

  console.log(
    `[tenant:${tenantId}] Reconexao agendada em ${delay}ms (tentativa ${entry.reconnectAttempts}). Motivo: ${reason || "desconhecido"}`
  );

  entry.reconnectTimer = setTimeout(async () => {
    entry.reconnectTimer = null;

    if (entry.stopRequested || entry.isInitializing || entry.client) {
      return;
    }

    try {
      await startSession(tenantId, { reconnecting: true });
    } catch (error) {
      console.error(`[tenant:${tenantId}] Falha na tentativa de reconexao:`, error);
    }
  }, delay);
}

function shouldIgnoreMessage(msg) {
  if (!msg) {
    return true;
  }

  if (msg.fromMe) {
    return true;
  }

  if (msg.from === "status@broadcast") {
    return true;
  }

  if (String(msg.from || "").endsWith("@g.us")) {
    return true;
  }

  if (!String(msg.body || "").trim()) {
    return true;
  }

  return false;
}

function getContactIdFromMessage(msg) {
  if (!msg) {
    return "";
  }

  return msg.fromMe ? msg.to : msg.from;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getHumanLikeDelay(text) {
  const textLength = String(text || "").trim().length;
  return Math.min(5000, Math.max(1200, textLength * 25));
}

async function sendHumanLikeMessage(client, msg, response) {
  if (!response) {
    return;
  }

  const delay = getHumanLikeDelay(response);
  let chat = null;

  try {
    if (typeof msg.getChat === "function") {
      chat = await msg.getChat();
    }
  } catch (error) {
    console.error("Erro ao carregar chat para simular digitacao:", error);
  }

  try {
    if (chat && typeof chat.sendStateTyping === "function") {
      await chat.sendStateTyping();
    }
  } catch (error) {
    console.error("Erro ao ativar estado de digitacao:", error);
  }

  await sleep(delay);

  try {
    if (chat && typeof chat.clearState === "function") {
      await chat.clearState();
    }
  } catch (error) {
    console.error("Erro ao limpar estado de digitacao:", error);
  }

  if (typeof msg.reply === "function") {
    try {
      await msg.reply(response);
      return;
    } catch (error) {
      console.error("Erro ao responder com reply, tentando envio direto:", error);
    }
  }

  await client.sendMessage(msg.from, response);
}

function getMediaDelay(asset) {
  if (String(asset?.mimeType || "").startsWith("audio/")) {
    return 1800;
  }

  return 1400;
}

function buildMessageMedia(asset) {
  const dataUrl = String(asset?.dataUrl || "");
  const mimeType = String(asset?.mimeType || "");

  if (!dataUrl || !mimeType || !dataUrl.includes(",")) {
    return null;
  }

  const [, base64Data] = dataUrl.split(",", 2);

  if (!base64Data) {
    return null;
  }

  return new MessageMedia(mimeType, base64Data, asset?.fileName || undefined);
}

async function sendMediaIfAllowed(client, msg, tenant, mediaMessages = []) {
  if (!canUseFeature(tenant, "media")) {
    return;
  }

  const imageMessages = mediaMessages
    .filter((asset) => String(asset?.mimeType || "").startsWith("image/"))
    .slice(0, 3);
  const audioMessages = mediaMessages
    .filter((asset) => String(asset?.mimeType || "").startsWith("audio/"))
    .slice(0, 1);

  for (const asset of [...imageMessages, ...audioMessages]) {
    const media = buildMessageMedia(asset);

    if (!media) {
      continue;
    }

    await sleep(getMediaDelay(asset));
    await client.sendMessage(msg.from, media);
  }
}

async function handleIncomingWhatsappMessage(tenantId, client, msg) {
  if (shouldIgnoreMessage(msg)) {
    return;
  }

  const tenant = readTenant(tenantId);
  const result = await processIncomingMessage({
    tenantId,
    contactId: getContactIdFromMessage(msg),
    message: String(msg.body || ""),
    config: tenant
  });

  await sendHumanLikeMessage(client, msg, result.reply);
  await sendMediaIfAllowed(client, msg, tenant, result.mediaMessages);
}

async function destroyClient(client) {
  if (!client) {
    return;
  }

  try {
    await client.destroy();
  } catch (error) {
    console.error("Erro ao destruir client do WhatsApp:", error);
  }
}

function createClient(tenantId) {
  return new Client({
    authStrategy: new LocalAuth({
      clientId: `tenant-${tenantId}`,
      dataPath: authDirectoryPath
    }),
    takeoverOnConflict: true,
    takeoverTimeoutMs: 10000,
    authTimeoutMs: 90000,
    puppeteer: {
      headless: true,
      args: DEFAULT_PUPPETEER_ARGS
    }
  });
}

async function createQrImage(qr) {
  if (!qr) {
    return "";
  }

  try {
    return await QRCode.toDataURL(qr);
  } catch (error) {
    console.error("Erro ao gerar imagem do QR Code:", error);
    return "";
  }
}

function getSession(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);
  const session = readSession(resolvedTenantId);
  const entry = getSessionEntry(resolvedTenantId);

  return {
    ...session,
    hasLocalSessionArtifacts: hasSessionArtifacts(resolvedTenantId),
    runtimeActive: Boolean(entry?.client),
    runtimeInitializing: Boolean(entry?.isInitializing),
    runtimeReady: Boolean(entry?.isReady)
  };
}

function getReadyClientEntries() {
  return Object.values(sessions).filter((entry) => entry?.client && entry?.isReady);
}

function normalizeWhatsappRecipient(value) {
  return String(value || "").replace(/\D/g, "");
}

async function sendSystemWhatsappMessage(whatsapp, message) {
  const recipient = normalizeWhatsappRecipient(whatsapp);
  const readyEntries = getReadyClientEntries();

  if (!recipient || !message || !readyEntries.length) {
    return false;
  }

  for (const entry of readyEntries) {
    try {
      await entry.client.sendMessage(`${recipient}@c.us`, String(message));
      return true;
    } catch (error) {
      console.error(`[tenant:${entry.tenantId}] Falha ao enviar mensagem de sistema para ${recipient}:`, error);
    }
  }

  return false;
}

function registerClientEvents(client, entry, sessionId) {
  const tenantId = entry.tenantId;

  client.on("qr", async (qr) => {
    markTiming(entry, "qrAt");
    const qrImage = await createQrImage(qr);
    entry.lastQrImage = qrImage;
    entry.isReady = false;
    logSessionTiming(entry, tenantId, "qrAt");

    persistSession(tenantId, {
      connected: false,
      status: "qr",
      qr: qrImage || qr,
      qrCode: qrImage || qr,
      qrRaw: qr,
      sessionId,
      nextReconnectAt: null,
      manualStop: false,
      stoppedAt: null,
      startedAt: readSession(tenantId).startedAt || new Date().toISOString()
    });
  });

  client.on("authenticated", () => {
    markTiming(entry, "authenticatedAt");
    entry.isInitializing = false;
    entry.isReady = false;
    logSessionTiming(entry, tenantId, "authenticatedAt");

    persistSession(tenantId, {
      connected: false,
      status: "authenticated",
      qr: "",
      qrCode: "",
      qrRaw: "",
      sessionId,
      nextReconnectAt: null,
      manualStop: false,
      stoppedAt: null,
      startedAt: readSession(tenantId).startedAt || new Date().toISOString()
    });
  });

  client.on("ready", () => {
    markTiming(entry, "readyAt");
    entry.isInitializing = false;
    entry.isReady = true;
    entry.lastQrImage = "";
    logSessionTiming(entry, tenantId, "readyAt");
    resetReconnectState(entry, tenantId);

    persistSession(tenantId, {
      connected: true,
      status: "connected",
      qr: "",
      qrCode: "",
      qrRaw: "",
      sessionId,
      number: buildPhoneNumber(client),
      connectedWhatsappNumber: buildPhoneNumber(client),
      reconnectAttempts: 0,
      lastDisconnectAt: null,
      nextReconnectAt: null,
      manualStop: false,
      lastError: "",
      stoppedAt: null,
      startedAt: readSession(tenantId).startedAt || new Date().toISOString()
    });
  });

  client.on("auth_failure", async (message) => {
    entry.isInitializing = false;
    entry.isReady = false;
    entry.lastQrImage = "";
    clearReconnectTimer(entry);

    if (entry.client === client) {
      entry.client = null;
    }

    await destroyClient(client);

    persistSession(tenantId, {
      connected: false,
      status: "auth_failure",
      qr: "",
      qrCode: "",
      qrRaw: "",
      lastError: String(message || ""),
      sessionId,
      nextReconnectAt: null,
      manualStop: false,
      stoppedAt: new Date().toISOString()
    });
  });

  client.on("disconnected", async (reason) => {
    entry.isInitializing = false;
    entry.isReady = false;
    entry.lastQrImage = "";

    if (entry.client === client) {
      entry.client = null;
    }

    await destroyClient(client);

    persistSession(tenantId, {
      connected: false,
      status: "disconnected",
      qr: "",
      qrCode: "",
      qrRaw: "",
      lastError: String(reason || ""),
      sessionId,
      lastDisconnectAt: new Date().toISOString(),
      manualStop: false,
      stoppedAt: new Date().toISOString()
    });

    if (!entry.stopRequested) {
      console.log(`[tenant:${tenantId}] WhatsApp desconectado: ${reason}`);
      scheduleReconnect(tenantId, String(reason || ""));
    }
  });

  client.on("message", async (msg) => {
    try {
      await handleIncomingWhatsappMessage(tenantId, client, msg);
    } catch (error) {
      console.error(`Erro ao processar mensagem do tenant ${tenantId}:`, error);
    }
  });
}

async function startSession(tenantId, options = {}) {
  const resolvedTenantId = assertTenantId(tenantId);
  const currentSession = getSession(resolvedTenantId);
  const entry = ensureSessionEntry(resolvedTenantId);

  if (entry.isInitializing || entry.client) {
    return currentSession;
  }

  clearReconnectTimer(entry);

  const sessionId = buildSessionId(resolvedTenantId, options);
  const client = createClient(resolvedTenantId);

  entry.client = client;
  entry.isInitializing = true;
  entry.isReady = false;
  entry.stopRequested = false;
  entry.lastQrImage = "";
  entry.initializedAt = new Date().toISOString();
  resetTiming(entry);
  markTiming(entry, "startAt");
  console.log(`[tenant:${resolvedTenantId}] timing:startAt=0ms`);

  registerClientEvents(client, entry, sessionId);

  const nextSession = persistSession(resolvedTenantId, {
    connected: false,
    status: "initializing",
    qr: "",
    qrCode: "",
    qrRaw: "",
    sessionId,
    number: currentSession.connectedWhatsappNumber || currentSession.number || "",
    connectedWhatsappNumber: currentSession.connectedWhatsappNumber || currentSession.number || "",
    nextReconnectAt: null,
    manualStop: false,
    startedAt: currentSession.startedAt || new Date().toISOString(),
    stoppedAt: null
  });

  try {
    await withTimeout(
      client.initialize(),
      SESSION_INIT_TIMEOUT_MS,
      `Timeout ao inicializar sessao WhatsApp apos ${SESSION_INIT_TIMEOUT_MS}ms`
    );
  } catch (error) {
    entry.isInitializing = false;
    entry.isReady = false;
    entry.client = null;

    await destroyClient(client);

    persistSession(resolvedTenantId, {
      connected: false,
      status: "initialization_failed",
      qr: "",
      qrCode: "",
      qrRaw: "",
      lastError: String(error.message || error),
      sessionId,
      manualStop: false,
      stoppedAt: new Date().toISOString()
    });

    if (!entry.stopRequested) {
      scheduleReconnect(resolvedTenantId, String(error.message || error));
    }

    throw error;
  }

  return nextSession;
}

async function stopSession(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);
  const entry = getSessionEntry(resolvedTenantId);

  if (entry) {
    entry.stopRequested = true;
    entry.isInitializing = false;
    entry.isReady = false;
    clearReconnectTimer(entry);
  }

  await destroyClient(entry?.client);

  if (entry) {
    entry.client = null;
    entry.lastQrImage = "";
  }

  return persistSession(resolvedTenantId, {
    connected: false,
    status: "disconnected",
    qr: "",
    qrCode: "",
    qrRaw: "",
    connectedWhatsappNumber: "",
    manualStop: true,
    reconnectAttempts: 0,
    lastDisconnectAt: null,
    nextReconnectAt: null,
    lastError: "",
    stoppedAt: new Date().toISOString()
  });
}

async function deleteSessionArtifacts(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);
  await stopSession(resolvedTenantId);

  const clientAuthDirectoryPath = getClientAuthDirectoryPath(resolvedTenantId);

  if (fs.existsSync(clientAuthDirectoryPath)) {
    fs.rmSync(clientAuthDirectoryPath, { recursive: true, force: true });
  }
}

async function resetSession(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);
  const entry = ensureSessionEntry(resolvedTenantId);
  entry.stopRequested = true;
  clearReconnectTimer(entry);

  await destroyClient(entry.client);

  entry.client = null;
  entry.isInitializing = false;
  entry.isReady = false;
  entry.lastQrImage = "";
  entry.reconnectAttempts = 0;
  entry.lastDisconnectAt = null;

  const clientAuthDirectoryPath = getClientAuthDirectoryPath(resolvedTenantId);

  if (fs.existsSync(clientAuthDirectoryPath)) {
    fs.rmSync(clientAuthDirectoryPath, { recursive: true, force: true });
  }

  return persistSession(resolvedTenantId, {
    connected: false,
    status: "disconnected",
    sessionId: "",
    qr: "",
    qrCode: "",
    qrRaw: "",
    number: "",
    connectedWhatsappNumber: "",
    manualStop: true,
    reconnectAttempts: 0,
    lastDisconnectAt: null,
    nextReconnectAt: null,
    lastError: "",
    stoppedAt: new Date().toISOString()
  });
}

function listSessions() {
  return listTenants().map((tenant) => getSession(tenant.tenantId));
}

async function bootstrapSessions() {
  const tenants = listTenants();

  const restorableTenants = tenants.filter((tenant) => {
    const session = readSession(tenant.tenantId);
    const hasLocalSession = hasSessionArtifacts(tenant.tenantId);
    const shouldRestoreByStatus = ["connected", "authenticated", "initializing", "qr", "disconnected", "reconnecting"].includes(
      String(session.status || "")
    );

    if (session.manualStop) {
      return false;
    }

    return hasLocalSession || shouldRestoreByStatus;
  });

  if (BOOTSTRAP_MODE !== "eager") {
    restorableTenants.forEach((tenant) => {
      const session = readSession(tenant.tenantId);
      const hasLocalSession = hasSessionArtifacts(tenant.tenantId);

      persistSession(tenant.tenantId, {
        ...session,
        connected: false,
        status: hasLocalSession ? "restore_pending" : "disconnected",
        nextReconnectAt: null,
        manualStop: false
      });
    });

    console.log(
      `[whatsapp] Bootstrap lazy ativo. ${restorableTenants.length} sessao(oes) marcadas para restauracao sob demanda.`
    );
    return;
  }

  for (let index = 0; index < restorableTenants.length; index += BOOTSTRAP_CONCURRENCY) {
    const batch = restorableTenants.slice(index, index + BOOTSTRAP_CONCURRENCY);

    await Promise.all(
      batch.map(async (tenant) => {
        const session = readSession(tenant.tenantId);

        try {
          await startSession(tenant.tenantId, {
            number: session.number || tenant.whatsapp?.number || "",
            sessionId: session.sessionId || tenant.whatsapp?.sessionId || `${tenant.tenantId}-session`
          });
          console.log(`[tenant:${tenant.tenantId}] Sessao do WhatsApp restaurada no bootstrap.`);
        } catch (error) {
          console.error(`[tenant:${tenant.tenantId}] Nao foi possivel restaurar a sessao do WhatsApp:`, error);
        }
      })
    );
  }
}

module.exports = {
  bootstrapSessions,
  resetSession,
  sendSystemWhatsappMessage,
  sessions,
  sendHumanLikeMessage,
  deleteSessionArtifacts,
  getSession,
  startSession,
  stopSession,
  listSessions
};
