const crypto = require("crypto");
const { canUseFeature } = require("../services/featureAccessService");
const { listTenants, readTenant, updateTenant } = require("../tenancy/tenantConfigStore");
const { readCampaignStore, updateCampaignStore } = require("./campaignStore");

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_DAILY_LIMIT = 10;
const DEFAULT_MAX_DAILY_LIMIT = 20;
const MAX_ITEMS_PER_IMPORT = 20;
const SAFE_OPERATION_START = "09:15";
const SAFE_OPERATION_END = "17:30";
const MAX_LOGS = 2000;
const MAX_HISTORY = 5000;
const MAX_REPLIES = 3000;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeInteger(value, fallbackValue, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  return Math.min(max, Math.max(min, Math.floor(numericValue)));
}

function normalizePhone(value) {
  return normalizeString(value).replace(/\D/g, "");
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function randomBetween(min, max) {
  const safeMin = Number(min);
  const safeMax = Number(max);

  if (!Number.isFinite(safeMin) || !Number.isFinite(safeMax)) {
    return 0;
  }

  if (safeMax <= safeMin) {
    return Math.max(0, safeMin);
  }

  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(normalizeString(value));
}

function timeToMinutes(value) {
  const [hours, minutes] = normalizeString(value).split(":").map((part) => Number(part));

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function todayKey(timezone = DEFAULT_TIMEZONE, referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(referenceDate);
}

function buildOperationalSettings(tenant, campaignPayload = {}) {
  const tenantFeature = tenant?.features?.campaigns || {};
  const timezone = normalizeString(campaignPayload.timezone) || normalizeString(tenantFeature.timezone) || DEFAULT_TIMEZONE;
  const dailyLimit = normalizeInteger(
    campaignPayload.daily_limit,
    normalizeInteger(tenantFeature.dailyLimit, DEFAULT_DAILY_LIMIT, { min: 1, max: DEFAULT_MAX_DAILY_LIMIT }),
    { min: 1, max: normalizeInteger(tenantFeature.maxDailyLimit, DEFAULT_MAX_DAILY_LIMIT, { min: 1, max: 50 }) }
  );

  const start = isValidTime(campaignPayload.operational_window?.start)
    ? campaignPayload.operational_window.start
    : normalizeString(tenantFeature.operationalWindowStart) || SAFE_OPERATION_START;
  const end = isValidTime(campaignPayload.operational_window?.end)
    ? campaignPayload.operational_window.end
    : normalizeString(tenantFeature.operationalWindowEnd) || SAFE_OPERATION_END;

  return {
    timezone,
    dailyLimit,
    operationalWindow: {
      start: isValidTime(start) ? start : SAFE_OPERATION_START,
      end: isValidTime(end) ? end : SAFE_OPERATION_END
    },
    replyPauseHours: normalizeInteger(tenantFeature.replyPauseHours, 72, { min: 1, max: 720 })
  };
}

function ensureCampaignAccess(tenant) {
  if (canUseFeature(tenant, "campaigns")) {
    return;
  }

  const error = new Error("Recurso de campanhas nao liberado para este cliente.");
  error.statusCode = 403;
  throw error;
}

function validateImportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    const error = new Error("JSON de campanha invalido.");
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(payload.items) || !payload.items.length) {
    const error = new Error("A campanha precisa conter ao menos um item.");
    error.statusCode = 400;
    throw error;
  }

  if (payload.items.length > MAX_ITEMS_PER_IMPORT) {
    const error = new Error(`Cada campanha pode ter no maximo ${MAX_ITEMS_PER_IMPORT} leads na fase inicial.`);
    error.statusCode = 400;
    throw error;
  }
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.map((tag) => normalizeString(tag)).filter(Boolean) : [];
}

function validatePhone(phone) {
  const normalized = normalizePhone(phone);
  return normalized.length >= 12 && normalized.length <= 13;
}

function buildCampaignRecord(tenant, payload, options = {}) {
  const settings = buildOperationalSettings(tenant, payload);
  const createdAt = new Date().toISOString();
  const campaignId = createId("campaign");
  const batchId = normalizeString(payload.batch_id) || campaignId;
  const mode = payload.items.length <= 3 ? "small" : "standard";

  return {
    campaignId,
    batchId,
    campaignName: normalizeString(payload.campaign_name) || `Campanha ${batchId}`,
    sourceFileName: normalizeString(options.sourceFileName),
    createdAt,
    updatedAt: createdAt,
    importedBy: normalizeString(options.importedBy) || "admin",
    status: "imported",
    mode,
    timezone: settings.timezone,
    dailyLimit: settings.dailyLimit,
    maxDailyLimit: normalizeInteger(tenant?.features?.campaigns?.maxDailyLimit, DEFAULT_MAX_DAILY_LIMIT, {
      min: 1,
      max: 50
    }),
    operationalWindow: settings.operationalWindow,
    totals: {
      total: payload.items.length,
      pending: payload.items.length,
      scheduled: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      replied: 0,
      cancelled: 0,
      skipped: 0
    },
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}
  };
}

function computeSuggestedSchedule(index, total, operationalWindow) {
  const startMinutes = timeToMinutes(operationalWindow.start) ?? timeToMinutes(SAFE_OPERATION_START);
  const endMinutes = timeToMinutes(operationalWindow.end) ?? timeToMinutes(SAFE_OPERATION_END);
  const windowSize = Math.max(60, endMinutes - startMinutes);

  if (total <= 3) {
    if (index === 0) {
      return {
        offsetMinutes: 0,
        minDelayMinutes: 0,
        maxDelayMinutes: 2
      };
    }

    if (index === 1) {
      return {
        offsetMinutes: randomBetween(7, 10),
        minDelayMinutes: 7,
        maxDelayMinutes: 10
      };
    }

    return {
      offsetMinutes: randomBetween(25, 30),
      minDelayMinutes: 25,
      maxDelayMinutes: 30
    };
  }

  const slots = total - 1;
  const usableWindow = Math.max(90, windowSize - 45);
  const step = Math.max(20, Math.floor(usableWindow / Math.max(1, slots)));
  const baseOffset = index === 0 ? randomBetween(0, 12) : index * step;
  const jitter = randomBetween(-12, 18);

  return {
    offsetMinutes: Math.max(0, baseOffset + jitter),
    minDelayMinutes: Math.max(5, step - 8),
    maxDelayMinutes: Math.max(15, step + 12)
  };
}

function resolveScheduledFor(baseDate, operationalWindow, item, scheduleHint) {
  if (normalizeString(item.scheduled_for)) {
    const explicitDate = new Date(item.scheduled_for);
    if (!Number.isNaN(explicitDate.getTime())) {
      return explicitDate.toISOString();
    }
  }

  const startMinutes = timeToMinutes(operationalWindow.start) ?? timeToMinutes(SAFE_OPERATION_START);
  const baseStart = new Date(baseDate);
  baseStart.setHours(0, 0, 0, 0);
  let scheduled = addMinutes(baseStart, startMinutes + scheduleHint.offsetMinutes);

  if (scheduled.getTime() < Date.now()) {
    scheduled = addMinutes(new Date(), randomBetween(5, 18));
  }

  return scheduled.toISOString();
}

function hasRecentReply(store, phone, replyPauseHours) {
  const normalizedPhone = normalizePhone(phone);
  const threshold = Date.now() - replyPauseHours * 60 * 60 * 1000;

  return store.inboundReplies.some((reply) => {
    return normalizePhone(reply.phone) === normalizedPhone && new Date(reply.receivedAt).getTime() >= threshold;
  });
}

function hasSentMessageToday(store, phone, timezone) {
  const normalizedPhone = normalizePhone(phone);
  const currentDay = todayKey(timezone);

  return store.leadHistory.some((entry) => {
    return (
      normalizePhone(entry.phone) === normalizedPhone &&
      entry.direction === "outbound" &&
      entry.status === "sent" &&
      todayKey(timezone, new Date(entry.createdAt)) === currentDay
    );
  });
}

function hasActiveQueueForPhone(store, phone) {
  const normalizedPhone = normalizePhone(phone);

  return store.queue.some((item) => {
    return (
      normalizePhone(item.phone) === normalizedPhone &&
      ["pending", "scheduled", "sending"].includes(String(item.status || ""))
    );
  });
}

function buildQueueItems(tenant, campaign, payload) {
  const operationalSettings = buildOperationalSettings(tenant, payload);
  const baseDate = new Date();

  return payload.items.map((item, index) => {
    const scheduleHint = computeSuggestedSchedule(index, payload.items.length, campaign.operationalWindow);
    const queueId = createId("queue");

    return {
      queueId,
      campaignId: campaign.campaignId,
      batchId: campaign.batchId,
      tenantId: tenant.tenantId,
      leadId: normalizeString(item.lead_id) || queueId,
      company: normalizeString(item.company),
      city: normalizeString(item.city),
      niche: normalizeString(item.niche),
      phone: normalizePhone(item.phone),
      personalizedMessage: normalizeString(item.personalized_message),
      sendMode: normalizeString(item.send_mode) || campaign.mode,
      scheduledFor: resolveScheduledFor(baseDate, campaign.operationalWindow, item, scheduleHint),
      minDelayMinutes: normalizeInteger(item.min_delay_minutes, scheduleHint.minDelayMinutes, { min: 0, max: 180 }),
      maxDelayMinutes: normalizeInteger(item.max_delay_minutes, scheduleHint.maxDelayMinutes, { min: 0, max: 240 }),
      tags: normalizeTags(item.tags),
      metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {},
      status: "scheduled",
      createdAt: campaign.createdAt,
      updatedAt: campaign.createdAt,
      lastAttemptAt: "",
      sentAt: "",
      repliedAt: "",
      cancelledAt: "",
      failureReason: "",
      sourceStatus: normalizeString(item.status) || "ready",
      processing: {
        attempts: 0,
        lockToken: "",
        lockedAt: "",
        nextEligibleAt: resolveScheduledFor(baseDate, campaign.operationalWindow, item, scheduleHint)
      },
      safety: {
        duplicateBlocked: false,
        replyBlocked: false,
        dailyLimitDayKey: "",
        randomizationBucket: `${campaign.mode}_${index + 1}`
      },
      operationalWindow: operationalSettings.operationalWindow,
      timezone: operationalSettings.timezone
    };
  });
}

function validateQueueItem(queueItem, store, replyPauseHours) {
  const issues = [];

  if (!queueItem.company) {
    issues.push("company_obrigatoria");
  }

  if (!queueItem.personalizedMessage) {
    issues.push("mensagem_personalizada_obrigatoria");
  }

  if (!validatePhone(queueItem.phone)) {
    issues.push("telefone_invalido");
  }

  if (hasActiveQueueForPhone(store, queueItem.phone)) {
    issues.push("duplicidade_na_fila");
  }

  if (hasRecentReply(store, queueItem.phone, replyPauseHours)) {
    issues.push("lead_com_resposta_recente");
  }

  return issues;
}

function appendLog(store, entry) {
  store.logs.push(entry);
  if (store.logs.length > MAX_LOGS) {
    store.logs = store.logs.slice(-MAX_LOGS);
  }
}

function appendHistory(store, entry) {
  store.leadHistory.push(entry);
  if (store.leadHistory.length > MAX_HISTORY) {
    store.leadHistory = store.leadHistory.slice(-MAX_HISTORY);
  }
}

function recalculateCampaignTotals(store, campaignId) {
  const campaign = store.campaigns.find((item) => item.campaignId === campaignId);

  if (!campaign) {
    return;
  }

  const queueItems = store.queue.filter((item) => item.campaignId === campaignId);
  const totals = {
    total: queueItems.length,
    pending: 0,
    scheduled: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    replied: 0,
    cancelled: 0,
    skipped: 0
  };

  queueItems.forEach((item) => {
    const status = String(item.status || "");
    if (totals[status] !== undefined) {
      totals[status] += 1;
    }
  });

  campaign.totals = totals;
  campaign.updatedAt = new Date().toISOString();
  campaign.status = totals.cancelled === totals.total
    ? "cancelled"
    : totals.sent + totals.failed + totals.replied + totals.cancelled >= totals.total
      ? "finished"
      : "running";
}

function importCampaign(tenantId, payload, options = {}) {
  const tenant = readTenant(tenantId);
  ensureCampaignAccess(tenant);
  validateImportPayload(payload);

  return updateCampaignStore(tenantId, (store) => {
    const campaign = buildCampaignRecord(tenant, payload, options);

    if (store.campaigns.some((item) => item.batchId === campaign.batchId)) {
      const error = new Error("Ja existe uma campanha importada com este batch_id para este tenant.");
      error.statusCode = 409;
      throw error;
    }

    const queueItems = buildQueueItems(tenant, campaign, payload);
    const importIssues = [];
    const acceptedQueueItems = [];

    queueItems.forEach((queueItem) => {
      const issues = validateQueueItem(queueItem, store, campaign.metadata.replyPauseHours || tenant.features.campaigns.replyPauseHours);

      if (issues.length) {
        queueItem.status = issues.includes("lead_com_resposta_recente") ? "replied" : "cancelled";
        queueItem.failureReason = issues.join(",");
        queueItem.updatedAt = new Date().toISOString();
        queueItem.cancelledAt = queueItem.status === "cancelled" ? queueItem.updatedAt : "";
        queueItem.repliedAt = queueItem.status === "replied" ? queueItem.updatedAt : "";
        queueItem.safety.duplicateBlocked = issues.includes("duplicidade_na_fila");
        queueItem.safety.replyBlocked = issues.includes("lead_com_resposta_recente");
        importIssues.push({
          leadId: queueItem.leadId,
          phone: queueItem.phone,
          issues
        });
      } else {
        acceptedQueueItems.push(queueItem);
      }
    });

    store.campaigns.push(campaign);
    store.queue.push(...queueItems);

    appendLog(store, {
      logId: createId("log"),
      campaignId: campaign.campaignId,
      type: "import",
      level: "info",
      createdAt: new Date().toISOString(),
      message: `Campanha importada com ${acceptedQueueItems.length} item(ns) ativos e ${importIssues.length} bloqueado(s).`,
      details: {
        batchId: campaign.batchId,
        sourceFileName: campaign.sourceFileName,
        issues: importIssues
      }
    });

    recalculateCampaignTotals(store, campaign.campaignId);

    store.meta.updatedAt = new Date().toISOString();

    return store;
  });
}

function getCampaigns(tenantId) {
  const tenant = readTenant(tenantId);
  ensureCampaignAccess(tenant);
  const store = readCampaignStore(tenantId);
  return {
    campaigns: store.campaigns,
    queue: store.queue,
    logs: store.logs.slice(-100),
    inboundReplies: store.inboundReplies.slice(-100)
  };
}

function countSentToday(store, timezone) {
  const currentDay = todayKey(timezone);
  return store.queue.filter((item) => item.status === "sent" && todayKey(timezone, new Date(item.sentAt || item.updatedAt)) === currentDay).length;
}

function markLeadReplied(tenantId, payload = {}) {
  return updateCampaignStore(tenantId, (store) => {
    const phone = normalizePhone(payload.phone || payload.contactId);

    if (!phone) {
      return store;
    }

    const replyEntry = {
      replyId: createId("reply"),
      tenantId,
      phone,
      contactId: normalizeString(payload.contactId),
      body: normalizeString(payload.body),
      receivedAt: payload.receivedAt || new Date().toISOString(),
      raw: payload.raw && typeof payload.raw === "object" ? payload.raw : {}
    };

    store.inboundReplies.push(replyEntry);
    if (store.inboundReplies.length > MAX_REPLIES) {
      store.inboundReplies = store.inboundReplies.slice(-MAX_REPLIES);
    }

    store.queue.forEach((item) => {
      if (
        normalizePhone(item.phone) === phone &&
        ["pending", "scheduled", "sending"].includes(String(item.status || ""))
      ) {
        item.status = "replied";
        item.repliedAt = replyEntry.receivedAt;
        item.updatedAt = replyEntry.receivedAt;
        item.failureReason = "paused_after_reply";
      }
    });

    appendHistory(store, {
      historyId: createId("history"),
      tenantId,
      phone,
      direction: "inbound",
      status: "replied",
      createdAt: replyEntry.receivedAt,
      message: replyEntry.body,
      campaignId: ""
    });

    const impactedCampaignIds = new Set(
      store.queue.filter((item) => normalizePhone(item.phone) === phone).map((item) => item.campaignId)
    );
    impactedCampaignIds.forEach((campaignId) => recalculateCampaignTotals(store, campaignId));

    store.meta.updatedAt = new Date().toISOString();
    return store;
  });
}

function cancelCampaign(tenantId, campaignId, reason = "cancelled_by_admin") {
  return updateCampaignStore(tenantId, (store) => {
    store.queue.forEach((item) => {
      if (item.campaignId === campaignId && ["pending", "scheduled", "sending"].includes(item.status)) {
        item.status = "cancelled";
        item.cancelledAt = new Date().toISOString();
        item.updatedAt = item.cancelledAt;
        item.failureReason = reason;
      }
    });

    appendLog(store, {
      logId: createId("log"),
      campaignId,
      type: "cancel",
      level: "warn",
      createdAt: new Date().toISOString(),
      message: "Campanha cancelada manualmente.",
      details: { reason }
    });

    recalculateCampaignTotals(store, campaignId);
    store.meta.updatedAt = new Date().toISOString();
    return store;
  });
}

function getNextDueQueueItem(store) {
  const dueItems = store.queue
    .filter((item) => ["pending", "scheduled"].includes(String(item.status || "")))
    .filter((item) => new Date(item.processing?.nextEligibleAt || item.scheduledFor).getTime() <= Date.now())
    .sort((left, right) => new Date(left.processing?.nextEligibleAt || left.scheduledFor).getTime() - new Date(right.processing?.nextEligibleAt || right.scheduledFor).getTime());

  return dueItems[0] || null;
}

async function processTenantCampaignQueue(tenantId) {
  const tenant = readTenant(tenantId);
  const { getSession, sendTenantWhatsappMessage } = require("../bot/whatsappSessions");

  if (!canUseFeature(tenant, "campaigns")) {
    return {
      tenantId,
      processed: 0,
      reason: "feature_locked"
    };
  }

  const session = getSession(tenantId);
  if (!session.connected || !session.runtimeReady) {
    return {
      tenantId,
      processed: 0,
      reason: "whatsapp_not_ready"
    };
  }

  const store = readCampaignStore(tenantId);
  const nextItem = getNextDueQueueItem(store);

  if (!nextItem) {
    return {
      tenantId,
      processed: 0,
      reason: "no_due_items"
    };
  }

  const campaign = store.campaigns.find((item) => item.campaignId === nextItem.campaignId);
  const timezone = nextItem.timezone || campaign?.timezone || tenant.features.campaigns.timezone || DEFAULT_TIMEZONE;
  const dailyLimit = campaign?.dailyLimit || tenant.features.campaigns.dailyLimit || DEFAULT_DAILY_LIMIT;

  if (countSentToday(store, timezone) >= dailyLimit) {
    await postponeQueueItem(tenantId, nextItem.queueId, 90, "daily_limit_reached");
    return {
      tenantId,
      processed: 0,
      reason: "daily_limit_reached"
    };
  }

  if (hasRecentReply(store, nextItem.phone, tenant.features.campaigns.replyPauseHours)) {
    markLeadReplied(tenantId, {
      phone: nextItem.phone,
      body: "",
      receivedAt: new Date().toISOString(),
      raw: {
        source: "worker_safety_pause"
      }
    });
    return {
      tenantId,
      processed: 0,
      reason: "reply_pause_triggered"
    };
  }

  if (hasSentMessageToday(store, nextItem.phone, timezone)) {
    await cancelQueueItem(tenantId, nextItem.queueId, "already_sent_today");
    return {
      tenantId,
      processed: 0,
      reason: "already_sent_today"
    };
  }

  await updateCampaignStore(tenantId, (currentStore) => {
    const queueItem = currentStore.queue.find((item) => item.queueId === nextItem.queueId);
    if (!queueItem) {
      return currentStore;
    }

    queueItem.status = "sending";
    queueItem.updatedAt = new Date().toISOString();
    queueItem.lastAttemptAt = queueItem.updatedAt;
    queueItem.processing.attempts = normalizeInteger(queueItem.processing.attempts, 0, { min: 0, max: 99 }) + 1;
    queueItem.processing.lockToken = createId("lock");
    queueItem.processing.lockedAt = queueItem.updatedAt;
    recalculateCampaignTotals(currentStore, queueItem.campaignId);
    return currentStore;
  });

  try {
    await sendTenantWhatsappMessage(tenantId, nextItem.phone, nextItem.personalizedMessage, {
      purpose: "campanha_agendada"
    });

    await updateCampaignStore(tenantId, (currentStore) => {
      const queueItem = currentStore.queue.find((item) => item.queueId === nextItem.queueId);
      if (!queueItem) {
        return currentStore;
      }

      queueItem.status = "sent";
      queueItem.sentAt = new Date().toISOString();
      queueItem.updatedAt = queueItem.sentAt;
      queueItem.failureReason = "";
      queueItem.processing.lockToken = "";
      queueItem.processing.lockedAt = "";
      queueItem.safety.dailyLimitDayKey = todayKey(queueItem.timezone || timezone);

      appendHistory(currentStore, {
        historyId: createId("history"),
        tenantId,
        phone: queueItem.phone,
        direction: "outbound",
        status: "sent",
        createdAt: queueItem.sentAt,
        message: queueItem.personalizedMessage,
        campaignId: queueItem.campaignId
      });

      appendLog(currentStore, {
        logId: createId("log"),
        campaignId: queueItem.campaignId,
        queueId: queueItem.queueId,
        type: "send",
        level: "info",
        createdAt: queueItem.sentAt,
        message: `Mensagem enviada para ${queueItem.company}.`,
        details: {
          phone: queueItem.phone
        }
      });

      recalculateCampaignTotals(currentStore, queueItem.campaignId);
      currentStore.meta.updatedAt = new Date().toISOString();
      return currentStore;
    });

    return {
      tenantId,
      processed: 1,
      reason: "sent"
    };
  } catch (error) {
    await updateCampaignStore(tenantId, (currentStore) => {
      const queueItem = currentStore.queue.find((item) => item.queueId === nextItem.queueId);
      if (!queueItem) {
        return currentStore;
      }

      queueItem.status = "failed";
      queueItem.updatedAt = new Date().toISOString();
      queueItem.failureReason = String(error.message || error);
      queueItem.processing.lockToken = "";
      queueItem.processing.lockedAt = "";
      queueItem.processing.nextEligibleAt = addMinutes(new Date(), randomBetween(30, 75)).toISOString();

      appendLog(currentStore, {
        logId: createId("log"),
        campaignId: queueItem.campaignId,
        queueId: queueItem.queueId,
        type: "send_error",
        level: "error",
        createdAt: queueItem.updatedAt,
        message: "Falha ao enviar mensagem de campanha.",
        details: {
          phone: queueItem.phone,
          error: queueItem.failureReason
        }
      });

      recalculateCampaignTotals(currentStore, queueItem.campaignId);
      currentStore.meta.updatedAt = new Date().toISOString();
      return currentStore;
    });

    return {
      tenantId,
      processed: 0,
      reason: "send_failed",
      error: String(error.message || error)
    };
  }
}

function postponeQueueItem(tenantId, queueId, minutes, reason) {
  return updateCampaignStore(tenantId, (store) => {
    const queueItem = store.queue.find((item) => item.queueId === queueId);
    if (!queueItem) {
      return store;
    }

    queueItem.status = "scheduled";
    queueItem.updatedAt = new Date().toISOString();
    queueItem.failureReason = reason;
    queueItem.processing.nextEligibleAt = addMinutes(new Date(), minutes).toISOString();
    recalculateCampaignTotals(store, queueItem.campaignId);
    store.meta.updatedAt = new Date().toISOString();
    return store;
  });
}

function cancelQueueItem(tenantId, queueId, reason) {
  return updateCampaignStore(tenantId, (store) => {
    const queueItem = store.queue.find((item) => item.queueId === queueId);
    if (!queueItem) {
      return store;
    }

    queueItem.status = "cancelled";
    queueItem.updatedAt = new Date().toISOString();
    queueItem.cancelledAt = queueItem.updatedAt;
    queueItem.failureReason = reason;
    recalculateCampaignTotals(store, queueItem.campaignId);
    store.meta.updatedAt = new Date().toISOString();
    return store;
  });
}

async function processCampaignQueue(options = {}) {
  const tenantIds = options.tenantId ? [options.tenantId] : listTenants().map((tenant) => tenant.tenantId);
  const results = [];

  for (const tenantId of tenantIds) {
    try {
      results.push(await processTenantCampaignQueue(tenantId));
    } catch (error) {
      results.push({
        tenantId,
        processed: 0,
        reason: "worker_error",
        error: String(error.message || error)
      });
    }
  }

  return results;
}

function updateCampaignAccess(tenantId, payload = {}) {
  const tenant = readTenant(tenantId);
  const nextFeature = {
    ...(tenant.features?.campaigns || {}),
    enabledByAdmin: payload.enabledByAdmin !== undefined ? Boolean(payload.enabledByAdmin) : tenant.features.campaigns.enabledByAdmin,
    privatePlanCode: normalizeString(payload.privatePlanCode) || tenant.features.campaigns.privatePlanCode,
    dailyLimit: normalizeInteger(payload.dailyLimit, tenant.features.campaigns.dailyLimit || DEFAULT_DAILY_LIMIT, { min: 1, max: 20 }),
    maxDailyLimit: normalizeInteger(payload.maxDailyLimit, tenant.features.campaigns.maxDailyLimit || DEFAULT_MAX_DAILY_LIMIT, { min: 1, max: 50 }),
    operationalWindowStart: isValidTime(payload.operationalWindowStart)
      ? payload.operationalWindowStart
      : tenant.features.campaigns.operationalWindowStart,
    operationalWindowEnd: isValidTime(payload.operationalWindowEnd)
      ? payload.operationalWindowEnd
      : tenant.features.campaigns.operationalWindowEnd,
    timezone: normalizeString(payload.timezone) || tenant.features.campaigns.timezone || DEFAULT_TIMEZONE,
    replyPauseHours: normalizeInteger(payload.replyPauseHours, tenant.features.campaigns.replyPauseHours || 72, {
      min: 1,
      max: 720
    })
  };

  return updateTenant(tenantId, {
    features: {
      campaigns: nextFeature
    }
  });
}

module.exports = {
  DEFAULT_DAILY_LIMIT,
  DEFAULT_MAX_DAILY_LIMIT,
  MAX_ITEMS_PER_IMPORT,
  SAFE_OPERATION_END,
  SAFE_OPERATION_START,
  cancelCampaign,
  getCampaigns,
  importCampaign,
  markLeadReplied,
  normalizePhone,
  processCampaignQueue,
  ensureCampaignAccess,
  updateCampaignAccess,
  validatePhone
};
