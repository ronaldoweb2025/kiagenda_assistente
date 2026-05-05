const fs = require("fs");
const path = require("path");
const { defaultTenantConfig } = require("../config/defaultTenantConfig");
const {
  migrateCategoriesSafely,
  normalizeCategories
} = require("../utils/catalogCategories");
const {
  countAudioAssets,
  getCatalogCollections,
  countImages,
  countUsedCategories,
  getPlanLimits,
  normalizePlan,
  normalizeSubscriptionStatus,
  validatePlanLimit
} = require("../services/featureAccessService");
const { assertTenantId, normalizeString } = require("./tenantResolver");
const { ensureDirectory, readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");

const dataDirectoryPath = path.resolve(__dirname, "../../data");
const tenantsDirectoryPath = path.resolve(dataDirectoryPath, "tenants");
const backupsDirectoryPath = path.resolve(dataDirectoryPath, "backups");
const tenantConfigBackupsDirectoryPath = path.resolve(dataDirectoryPath, "tenantConfig.backup");
const legacyConfigFilePath = path.resolve(dataDirectoryPath, "config.json");
const PLAN_DOWNGRADE_WARNING =
  "Voce possui recursos acima do limite do plano atual. Eles foram preservados, mas alguns ficarao bloqueados ate fazer upgrade.";
const PROTECTED_EMPTY_KEYS = new Set(["", null, undefined]);

function isTenantConfigDebugEnabled() {
  return String(process.env.TENANT_CONFIG_DEBUG || "").trim().toLowerCase() === "true";
}

function redactSensitiveConfig(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveConfig(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (/apiKey|token|secret|password/i.test(key)) {
        const rawValue = normalizeString(entryValue);
        return [key, rawValue ? `${rawValue.slice(0, 6)}***${rawValue.slice(-4)}` : ""];
      }

      if (key === "dataUrl" && typeof entryValue === "string") {
        return [key, entryValue ? `${entryValue.slice(0, 40)}...<redacted>` : ""];
      }

      return [key, redactSensitiveConfig(entryValue)];
    })
  );
}

function logTenantConfig(label, config) {
  if (!isTenantConfigDebugEnabled()) {
    return;
  }

  console.log(`${label}:`, JSON.stringify(redactSensitiveConfig(config), null, 2));
}

function isMeaningfulMergeValue(value) {
  if (PROTECTED_EMPTY_KEYS.has(value)) {
    return false;
  }

  if (typeof value === "string" && value.trim() === "") {
    return false;
  }

  return true;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeMerge(oldConfig, newConfig) {
  if (!isPlainObject(newConfig)) {
    return isMeaningfulMergeValue(newConfig) ? newConfig : oldConfig;
  }

  const merged = {
    ...(isPlainObject(oldConfig) ? oldConfig : {})
  };

  Object.entries(newConfig).forEach(([key, nextValue]) => {
    const previousValue = merged[key];

    if (!isMeaningfulMergeValue(nextValue)) {
      return;
    }

    if (isPlainObject(previousValue) && isPlainObject(nextValue)) {
      merged[key] = safeMerge(previousValue, nextValue);
      return;
    }

    merged[key] = nextValue;
  });

  return merged;
}

function countMeaningfulValues(value) {
  if (!isMeaningfulMergeValue(value)) {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countMeaningfulValues(item), 0);
  }

  if (isPlainObject(value)) {
    return Object.values(value).reduce((total, item) => total + countMeaningfulValues(item), 0);
  }

  return 1;
}

function assertNotAlmostEmptyConfig(config, label = "config") {
  const meaningfulValues = countMeaningfulValues(config);

  if (meaningfulValues < 3) {
    const error = new Error(`${label}_quase_vazia_bloqueada`);
    error.statusCode = 400;
    throw error;
  }
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function inferTenantType(value, fallbackType = "") {
  const tenantId = normalizeString(value).toLowerCase();
  const normalizedFallbackType = normalizeString(fallbackType).toLowerCase();

  if (["client", "test", "system"].includes(normalizedFallbackType)) {
    return normalizedFallbackType;
  }

  if (!tenantId) {
    return "client";
  }

  if (tenantId === "default" || ["flow", "applyplan", "reset", "verify", "cooldown"].some((token) => tenantId.includes(token))) {
    return "system";
  }

  if (["test", "demo"].some((token) => tenantId.includes(token))) {
    return "test";
  }

  return "client";
}

function normalizeNumber(value, fallbackValue) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallbackValue;
}

function normalizeInteger(value, fallbackValue, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  return Math.min(max, Math.max(min, Math.floor(numericValue)));
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => normalizeString(value)).filter(Boolean);
}

function normalizeBotProfile(input = {}) {
  const adjustablePrompt = input?.adjustablePrompt || {};
  const serviceWorkflow = input?.serviceWorkflow || {};
  const blockedActions = serviceWorkflow?.blockedActions || {};
  const normalizedAiTemperature = Number(input?.aiTemperature);

  return {
    niche: normalizeString(input?.niche) || defaultTenantConfig.botProfile.niche,
    promptMode: normalizeString(input?.promptMode) || defaultTenantConfig.botProfile.promptMode,
    promptBase: normalizeString(input?.promptBase) || defaultTenantConfig.botProfile.promptBase,
    additionalInstructions: normalizeString(input?.additionalInstructions),
    aiMode: normalizeString(input?.aiMode) || defaultTenantConfig.botProfile.aiMode,
    aiTemperature:
      Number.isFinite(normalizedAiTemperature) && normalizedAiTemperature >= 0 && normalizedAiTemperature <= 1
        ? normalizedAiTemperature
        : defaultTenantConfig.botProfile.aiTemperature,
    adjustablePrompt: {
      estiloAtendimento:
        normalizeString(adjustablePrompt?.estiloAtendimento) ||
        defaultTenantConfig.botProfile.adjustablePrompt.estiloAtendimento,
      tomDeVoz:
        normalizeString(adjustablePrompt?.tomDeVoz) ||
        defaultTenantConfig.botProfile.adjustablePrompt.tomDeVoz,
      nivelDetalhe:
        normalizeString(adjustablePrompt?.nivelDetalhe) ||
        defaultTenantConfig.botProfile.adjustablePrompt.nivelDetalhe,
      focoAtendimento:
        normalizeString(adjustablePrompt?.focoAtendimento) ||
        defaultTenantConfig.botProfile.adjustablePrompt.focoAtendimento,
      instrucoesNegocio: normalizeString(adjustablePrompt?.instrucoesNegocio),
      regrasPersonalizadas: normalizeString(adjustablePrompt?.regrasPersonalizadas || input?.rules || input?.regras)
    },
    serviceWorkflow: {
      attendanceType:
        normalizeString(serviceWorkflow?.attendanceType) ||
        defaultTenantConfig.botProfile.serviceWorkflow.attendanceType,
      serviceProcess: normalizeString(serviceWorkflow?.serviceProcess),
      budgetMode:
        normalizeString(serviceWorkflow?.budgetMode) ||
        defaultTenantConfig.botProfile.serviceWorkflow.budgetMode,
      priceDisplayMode:
        normalizeString(serviceWorkflow?.priceDisplayMode) ||
        defaultTenantConfig.botProfile.serviceWorkflow.priceDisplayMode,
      nextStep:
        normalizeString(serviceWorkflow?.nextStep) ||
        defaultTenantConfig.botProfile.serviceWorkflow.nextStep,
      nextStepDetails: normalizeString(serviceWorkflow?.nextStepDetails),
      blockedActions: {
        noNegotiate:
          blockedActions?.noNegotiate !== undefined
            ? normalizeBoolean(blockedActions.noNegotiate)
            : defaultTenantConfig.botProfile.serviceWorkflow.blockedActions.noNegotiate,
        noDiscount:
          blockedActions?.noDiscount !== undefined
            ? normalizeBoolean(blockedActions.noDiscount)
            : defaultTenantConfig.botProfile.serviceWorkflow.blockedActions.noDiscount,
        noCloseSale:
          blockedActions?.noCloseSale !== undefined
            ? normalizeBoolean(blockedActions.noCloseSale)
            : defaultTenantConfig.botProfile.serviceWorkflow.blockedActions.noCloseSale,
        noPromiseDeadline:
          blockedActions?.noPromiseDeadline !== undefined
            ? normalizeBoolean(blockedActions.noPromiseDeadline)
            : defaultTenantConfig.botProfile.serviceWorkflow.blockedActions.noPromiseDeadline,
        noFinalPriceWithoutAnalysis:
          blockedActions?.noFinalPriceWithoutAnalysis !== undefined
            ? normalizeBoolean(blockedActions.noFinalPriceWithoutAnalysis)
            : defaultTenantConfig.botProfile.serviceWorkflow.blockedActions.noFinalPriceWithoutAnalysis,
        noInventInfo:
          blockedActions?.noInventInfo !== undefined
            ? normalizeBoolean(blockedActions.noInventInfo)
            : defaultTenantConfig.botProfile.serviceWorkflow.blockedActions.noInventInfo
      },
      notes: normalizeString(serviceWorkflow?.notes)
    }
  };
}

function normalizeMediaAsset(asset) {
  if (!asset || typeof asset !== "object") {
    return null;
  }

  const dataUrl = normalizeString(asset.dataUrl);
  const mimeType = normalizeString(asset.mimeType);
  const fileName = normalizeString(asset.fileName);

  if (!dataUrl || !mimeType) {
    return null;
  }

  const providedSizeBytes = Number(asset.sizeBytes);
  const inferredSizeBytes = dataUrl.includes(",")
    ? Math.floor((dataUrl.split(",")[1].length * 3) / 4)
    : 0;

  return {
    dataUrl,
    mimeType,
    fileName: fileName || "",
    sizeBytes: Number.isFinite(providedSizeBytes) && providedSizeBytes >= 0 ? providedSizeBytes : inferredSizeBytes
  };
}

function normalizeMediaAssetList(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => normalizeMediaAsset(item)).filter(Boolean).slice(0, 3);
}

function inferMenuType(item) {
  const candidate = normalizeString(item?.id || item?.label).toLowerCase();

  if (candidate.includes("sobre")) {
    return "business_info";
  }

  if (candidate.includes("produto") || candidate.includes("loja")) {
    return "products";
  }

  if (candidate.includes("servico")) {
    return "services";
  }

  if (candidate.includes("link")) {
    return "links";
  }

  if (candidate.includes("entrega") || candidate.includes("retirada")) {
    return "delivery_pickup";
  }

  if (candidate.includes("atendimento") || candidate.includes("humano")) {
    return "handoff";
  }

  return "custom";
}

function normalizeCatalogItems(items, prefix) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => ({
      id: normalizeString(item?.id) || `${prefix}_${index + 1}`,
      name: normalizeString(item?.name),
      price: normalizeString(item?.price),
      description: normalizeString(item?.description),
      link: normalizeString(item?.link),
      aliases: normalizeStringList(item?.aliases),
      keywords: normalizeStringList(item?.keywords),
      images: normalizeMediaAssetList(item?.images),
      image: normalizeMediaAsset(item?.image),
      audio: normalizeMediaAsset(item?.audio)
    }))
    .filter((item) => item.name || item.price || item.description || item.link || item.image || item.audio || (item.images && item.images.length));
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .map((link, index) => ({
      id: normalizeString(link?.id) || `link_${index + 1}`,
      title: normalizeString(link?.title),
      url: normalizeString(link?.url),
      description: normalizeString(link?.description),
      aliases: normalizeStringList(link?.aliases)
    }))
    .filter((link) => link.title || link.url);
}

function normalizeFaqItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      const pergunta = normalizeString(item?.pergunta || item?.question);
      const rawPerguntas = item?.perguntas || item?.questions || (pergunta ? [pergunta] : []);
      const perguntas = normalizeStringList(Array.isArray(rawPerguntas) ? rawPerguntas : [rawPerguntas]);

      return {
        id: normalizeString(item?.id) || `faq_${index + 1}`,
        pergunta: pergunta || perguntas[0] || "",
        perguntas,
        resposta: normalizeString(item?.resposta || item?.answer),
        mode: ["fixed", "knowledge"].includes(normalizeString(item?.mode || item?.modo).toLowerCase())
          ? normalizeString(item?.mode || item?.modo).toLowerCase()
          : "knowledge",
        critical: item?.critical !== undefined ? normalizeBoolean(item.critical) : false
      };
    })
    .filter((item) => item.resposta && (item.pergunta || item.perguntas.length));
}

function normalizeConversationFlows(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => ({
      id: normalizeString(item?.id) || `flow_${index + 1}`,
      name: normalizeString(item?.name),
      enabled: item?.enabled !== undefined ? normalizeBoolean(item.enabled) : true,
      triggers: normalizeStringList(item?.triggers),
      objective: normalizeString(item?.objective),
      steps: normalizeString(item?.steps),
      rules: normalizeString(item?.rules),
      handoffCondition: normalizeString(item?.handoffCondition)
    }))
    .filter((item) => item.name && item.triggers.length);
}

function normalizeAdvancedOptions(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => ({
      id: normalizeString(item?.id) || `advanced_option_${index + 1}`,
      label: normalizeString(item?.label) || `Opcao extra ${index + 1}`,
      actionType: normalizeString(item?.actionType || item?.type || "customReply") || "customReply",
      keywords: normalizeStringList(item?.keywords || item?.aliases),
      customReply: normalizeString(item?.customReply),
      enabled: item?.enabled !== undefined ? normalizeBoolean(item.enabled) : true
    }))
    .filter((item) => item.label && item.keywords.length);
}

function normalizeMenu(menuItems) {
  const sourceItems = Array.isArray(menuItems) && menuItems.length ? menuItems : defaultTenantConfig.menu;

  return sourceItems.map((item, index) => {
    const explicitType = normalizeString(item?.type);

    return {
      id: normalizeString(item?.id) || `menu_${index + 1}`,
      label: normalizeString(item?.label) || `Opcao ${index + 1}`,
      type: explicitType || inferMenuType(item),
      enabled: normalizeBoolean(item?.enabled),
      linkId: normalizeString(item?.linkId),
      aliases: normalizeStringList(item?.aliases),
      customReply: normalizeString(item?.customReply)
    };
  });
}

function normalizeCampaignFeature(input = {}) {
  const fallback = defaultTenantConfig.features.campaigns;

  return {
    enabledByAdmin:
      input?.enabledByAdmin !== undefined ? normalizeBoolean(input.enabledByAdmin) : fallback.enabledByAdmin,
    privatePlanCode: normalizeString(input?.privatePlanCode) || fallback.privatePlanCode,
    dailyLimit: normalizeInteger(input?.dailyLimit, fallback.dailyLimit, { min: 1, max: 20 }),
    maxDailyLimit: normalizeInteger(input?.maxDailyLimit, fallback.maxDailyLimit, { min: 1, max: 50 }),
    operationalWindowStart: normalizeString(input?.operationalWindowStart) || fallback.operationalWindowStart,
    operationalWindowEnd: normalizeString(input?.operationalWindowEnd) || fallback.operationalWindowEnd,
    timezone: normalizeString(input?.timezone) || fallback.timezone,
    replyPauseHours: normalizeInteger(input?.replyPauseHours, fallback.replyPauseHours, { min: 1, max: 720 })
  };
}

function buildTenantMeta(input = {}) {
  return {
    createdAt: normalizeString(input.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildAppliedPlanLimits(tenant = {}) {
  return getPlanLimits({
    plan: tenant?.plan
  });
}

function mergeMeta(currentMeta = {}, nextMeta = {}) {
  return {
    createdAt: normalizeString(currentMeta.createdAt) || normalizeString(nextMeta.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeTenant(input = {}) {
  const tenantId = assertTenantId(input?.tenantId);
  const plan = normalizePlan(input?.plan);
  const migratedTenant = migrateCategoriesSafely({
    ...input,
    categories: normalizeCategories(input?.categories, input)
  });

  return {
    tenantId,
    type: inferTenantType(tenantId, input?.type),
    isTest:
      input?.isTest !== undefined
        ? normalizeBoolean(input.isTest)
        : inferTenantType(tenantId, input?.type) !== "client",
    active: input?.active !== undefined ? normalizeBoolean(input.active) : true,
    botEnabled:
      input?.botEnabled !== undefined
        ? normalizeBoolean(input.botEnabled)
        : input?.active !== undefined
          ? normalizeBoolean(input.active)
          : true,
    aiEnabled: input?.aiEnabled !== undefined ? normalizeBoolean(input.aiEnabled) : true,
    plan,
    subscriptionStatus: normalizeSubscriptionStatus(input?.subscriptionStatus),
    planLimits: buildAppliedPlanLimits({ plan }),
    onboardingCompleted: input?.onboardingCompleted !== undefined ? normalizeBoolean(input.onboardingCompleted) : false,
    botModel: normalizeString(input?.botModel),
    business: {
      name: normalizeString(input?.business?.name),
      attendantName: normalizeString(input?.business?.attendantName) || defaultTenantConfig.business.attendantName,
      type: normalizeString(input?.business?.type),
      location: normalizeString(input?.business?.location),
      description: normalizeString(input?.business?.description)
    },
    links: normalizeLinks(input?.links),
    faq: normalizeFaqItems(input?.faq),
    conversationFlows: normalizeConversationFlows(input?.conversationFlows),
    advancedOptions: normalizeAdvancedOptions(input?.advancedOptions),
    categories: migratedTenant.categories,
    products: normalizeCatalogItems(migratedTenant.products, "product"),
    services: normalizeCatalogItems(migratedTenant.services, "service"),
    partnerships: normalizeCatalogItems(migratedTenant.partnerships, "partnership"),
    menu: normalizeMenu(input?.menu),
    messages: {
      welcome: normalizeString(input?.messages?.welcome),
      fallback: normalizeString(input?.messages?.fallback),
      handoff: normalizeString(input?.messages?.handoff),
      audio: normalizeMediaAsset(input?.messages?.audio)
    },
    botProfile: normalizeBotProfile(safeMerge(safeMerge(input?.behavior || {}, input?.botBehavior || {}), input?.botProfile || {})),
    settings: {
      stateTTL: normalizeNumber(input?.settings?.stateTTL, defaultTenantConfig.settings.stateTTL),
      handoffTimeout: normalizeNumber(
        input?.settings?.handoffTimeout,
        defaultTenantConfig.settings.handoffTimeout
      )
    },
    whatsapp: {
      connected: normalizeBoolean(input?.whatsapp?.connected),
      number: normalizeString(input?.whatsapp?.number),
      sessionId: normalizeString(input?.whatsapp?.sessionId)
    },
    integration: {
      gemini: {
        apiKey: normalizeString(input?.integration?.gemini?.apiKey),
        model: normalizeString(input?.integration?.gemini?.model) || "gemini-2.5-flash-lite"
      },
      kiagenda: {
        connected: normalizeBoolean(input?.integration?.kiagenda?.connected),
        token: normalizeString(input?.integration?.kiagenda?.token),
        accountStatus: normalizeString(input?.integration?.kiagenda?.accountStatus) || "not_connected",
        mode: normalizeString(input?.integration?.kiagenda?.mode) || null
      }
    },
    features: {
      campaigns: normalizeCampaignFeature(input?.features?.campaigns)
    },
    warning: collectTenantPlanConstraintViolations({
      ...migratedTenant,
      plan,
      subscriptionStatus: normalizeSubscriptionStatus(input?.subscriptionStatus)
    }).length
      ? PLAN_DOWNGRADE_WARNING
      : "",
    meta: buildTenantMeta(input?.meta)
  };
}

function mergeTenant(baseTenant, partialTenant) {
  return normalizeTenant({
    ...baseTenant,
    ...partialTenant,
    tenantId: baseTenant.tenantId,
    active: partialTenant?.active !== undefined ? partialTenant.active : baseTenant.active,
    botEnabled:
      partialTenant?.botEnabled !== undefined
        ? partialTenant.botEnabled
        : baseTenant.botEnabled,
    aiEnabled:
      partialTenant?.aiEnabled !== undefined
        ? partialTenant.aiEnabled
        : baseTenant.aiEnabled,
    plan: partialTenant?.plan !== undefined ? partialTenant.plan : baseTenant.plan,
    subscriptionStatus:
      partialTenant?.subscriptionStatus !== undefined
        ? partialTenant.subscriptionStatus
        : baseTenant.subscriptionStatus,
    onboardingCompleted:
      partialTenant?.onboardingCompleted !== undefined
        ? partialTenant.onboardingCompleted
        : baseTenant.onboardingCompleted,
    botModel: partialTenant?.botModel !== undefined ? partialTenant.botModel : baseTenant.botModel,
    business: {
      ...baseTenant.business,
      ...(partialTenant.business || {})
    },
    links: Array.isArray(partialTenant.links) ? partialTenant.links : baseTenant.links,
    faq: Array.isArray(partialTenant.faq) ? partialTenant.faq : baseTenant.faq,
    conversationFlows: Array.isArray(partialTenant.conversationFlows) && partialTenant.conversationFlows.length
      ? partialTenant.conversationFlows
      : baseTenant.conversationFlows,
    advancedOptions: Array.isArray(partialTenant.advancedOptions)
      ? partialTenant.advancedOptions
      : baseTenant.advancedOptions,
    categories: Array.isArray(partialTenant.categories) ? partialTenant.categories : baseTenant.categories,
    products: Array.isArray(partialTenant.products) ? partialTenant.products : baseTenant.products,
    services: Array.isArray(partialTenant.services) ? partialTenant.services : baseTenant.services,
    partnerships: Array.isArray(partialTenant.partnerships) ? partialTenant.partnerships : baseTenant.partnerships,
    menu: Array.isArray(partialTenant.menu) ? partialTenant.menu : baseTenant.menu,
    messages: {
      ...baseTenant.messages,
      ...(partialTenant.messages || {})
    },
    botProfile: {
      ...(baseTenant.botProfile || defaultTenantConfig.botProfile),
      ...(partialTenant.botProfile || {}),
      adjustablePrompt: {
        ...((baseTenant.botProfile && baseTenant.botProfile.adjustablePrompt) || defaultTenantConfig.botProfile.adjustablePrompt),
        ...((partialTenant.botProfile && partialTenant.botProfile.adjustablePrompt) || {})
      },
      serviceWorkflow: {
        ...((baseTenant.botProfile && baseTenant.botProfile.serviceWorkflow) || defaultTenantConfig.botProfile.serviceWorkflow),
        ...((partialTenant.botProfile && partialTenant.botProfile.serviceWorkflow) || {}),
        blockedActions: {
          ...(
            (baseTenant.botProfile &&
              baseTenant.botProfile.serviceWorkflow &&
              baseTenant.botProfile.serviceWorkflow.blockedActions) ||
            defaultTenantConfig.botProfile.serviceWorkflow.blockedActions
          ),
          ...(
            (partialTenant.botProfile &&
              partialTenant.botProfile.serviceWorkflow &&
              partialTenant.botProfile.serviceWorkflow.blockedActions) ||
            {}
          )
        }
      }
    },
    settings: {
      ...baseTenant.settings,
      ...(partialTenant.settings || {})
    },
    whatsapp: {
      ...baseTenant.whatsapp,
      ...(partialTenant.whatsapp || {})
    },
    integration: {
      ...baseTenant.integration,
      ...(partialTenant.integration || {}),
      gemini: {
        ...(baseTenant.integration?.gemini || {}),
        ...(partialTenant.integration?.gemini || {})
      },
      kiagenda: {
        ...baseTenant.integration.kiagenda,
        ...(partialTenant.integration?.kiagenda || {})
      }
    },
    features: {
      ...(baseTenant.features || defaultTenantConfig.features),
      ...(partialTenant.features || {}),
      campaigns: normalizeCampaignFeature({
        ...((baseTenant.features && baseTenant.features.campaigns) || defaultTenantConfig.features.campaigns),
        ...((partialTenant.features && partialTenant.features.campaigns) || {})
      })
    },
    meta: mergeMeta(baseTenant.meta, partialTenant.meta)
  });
}

function collectTenantPlanConstraintViolations(tenant) {
  const tenantForLimitCheck = {
    ...tenant,
    subscriptionStatus: "active"
  };
  const violations = [];
  const categoryCollections = getCatalogCollections(tenant);
  const usedCategories = countUsedCategories(tenant);
  const categoryValidation = validatePlanLimit(tenantForLimitCheck, {
    type: "category",
    nextCount: usedCategories
  });

  if (!categoryValidation?.allowed) {
    violations.push({
      resource: "categories",
      reason: categoryValidation.reason,
      usage: usedCategories,
      limit: categoryValidation?.limits?.maxCategories
    });
  }

  categoryCollections.forEach((items, index) => {
    const itemCount = Array.isArray(items) ? items.length : 0;
    const itemValidation = validatePlanLimit(tenantForLimitCheck, {
      type: "item",
      nextCount: itemCount
    });

    if (!itemValidation?.allowed) {
      violations.push({
        resource: tenant.categories?.[index]?.id || `category_${index + 1}`,
        reason: itemValidation.reason,
        usage: itemCount,
        limit: itemValidation?.limits?.maxItemsPerCategory
      });
    }
  });

  const imageCount = countImages(tenant);
  const imageValidation = validatePlanLimit(tenantForLimitCheck, {
    type: "image",
    nextCount: imageCount
  });

  if (!imageValidation?.allowed) {
    violations.push({
      resource: "images",
      reason: imageValidation.reason,
      usage: imageCount,
      limit: imageValidation?.limits?.maxImagesPerAccount
    });
  }

  const audioCount = countAudioAssets(tenant);
  const audioValidation = validatePlanLimit(tenantForLimitCheck, {
    type: "audio",
    nextCount: audioCount
  });

  if (!audioValidation?.allowed) {
    violations.push({
      resource: "audio",
      reason: audioValidation.reason,
      usage: audioCount,
      limit: audioValidation?.limits?.maxAudioPerAccount
    });
  }

  return violations;
}

function ensurePlanLimit(validationResult) {
  if (validationResult?.allowed) {
    return;
  }

  const error = new Error(validationResult?.message || "Limite do plano atingido.");
  error.statusCode = 400;
  throw error;
}

function validateTenantPlanConstraints(tenant) {
  const categoryCollections = getCatalogCollections(tenant);
  const usedCategories = countUsedCategories(tenant);

  ensurePlanLimit(
    validatePlanLimit(tenant, {
      type: "category",
      nextCount: usedCategories
    })
  );

  categoryCollections.forEach((items) => {
    ensurePlanLimit(
      validatePlanLimit(tenant, {
        type: "item",
        nextCount: Array.isArray(items) ? items.length : 0
      })
    );
  });

  const imageAssets = categoryCollections.flatMap((items) => {
    return (Array.isArray(items) ? items : []).flatMap((item) => {
      if (Array.isArray(item?.images) && item.images.length) {
        return item.images.filter(Boolean);
      }

      return item?.image ? [item.image] : [];
    });
  });

  ensurePlanLimit(
    validatePlanLimit(tenant, {
      type: "image",
      nextCount: countImages(tenant)
    })
  );

  imageAssets.forEach((asset) => {
    ensurePlanLimit(
      validatePlanLimit(tenant, {
        type: "image",
        nextCount: imageAssets.length,
        fileSizeBytes: Number(asset?.sizeBytes || 0)
      })
    );
  });

  const audioAssets = categoryCollections.flatMap((items) => {
    return (Array.isArray(items) ? items : []).map((item) => item?.audio).filter(Boolean);
  });

  if (tenant?.messages?.audio) {
    audioAssets.push(tenant.messages.audio);
  }

  ensurePlanLimit(
    validatePlanLimit(tenant, {
      type: "audio",
      nextCount: countAudioAssets(tenant)
    })
  );

}

function buildDefaultTenant(tenantId, input = {}) {
  return normalizeTenant({
    ...defaultTenantConfig,
    ...input,
    tenantId,
    meta: buildTenantMeta(input.meta)
  });
}

function getTenantFilePath(tenantId) {
  return path.resolve(tenantsDirectoryPath, `${assertTenantId(tenantId)}.json`);
}

function ensureDataDirectories() {
  ensureDirectory(tenantsDirectoryPath);
  ensureDirectory(backupsDirectoryPath);
  ensureDirectory(tenantConfigBackupsDirectoryPath);
}

function tenantExists(tenantId) {
  return fs.existsSync(getTenantFilePath(tenantId));
}

function readTenant(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);
  const filePath = getTenantFilePath(resolvedTenantId);

  if (!fs.existsSync(filePath)) {
    const error = new Error("tenant_nao_encontrado");
    error.statusCode = 404;
    throw error;
  }

  const parsed = readJsonFile(filePath, null);

  if (!parsed) {
    const fallback = buildDefaultTenant(resolvedTenantId);
    writeJsonFile(filePath, fallback);
    logTenantConfig("CONFIG CARREGADA", fallback);
    return fallback;
  }

  const normalizedTenant = normalizeTenant({
    ...parsed,
    tenantId: resolvedTenantId,
    meta: mergeMeta(parsed.meta || {}, {})
  });

  logTenantConfig("CONFIG CARREGADA", normalizedTenant);
  return normalizedTenant;
}

function writeTenant(tenantId, tenantData, options = {}) {
  const resolvedTenantId = assertTenantId(tenantId);
  const filePath = getTenantFilePath(resolvedTenantId);
  assertNotAlmostEmptyConfig(tenantData, "tenant_config");
  const normalizedTenant = normalizeTenant({
    ...tenantData,
    tenantId: resolvedTenantId,
    meta: mergeMeta(tenantData.meta || {}, {})
  });

  logTenantConfig("CONFIG ANTES DE SALVAR", normalizedTenant);

  if (!options.skipPlanValidation) {
    validateTenantPlanConstraints(normalizedTenant);
  }

  writeJsonFile(filePath, normalizedTenant);
  return normalizedTenant;
}

function deleteTenantFile(tenantId) {
  const filePath = getTenantFilePath(tenantId);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

function updateTenant(tenantId, partialTenant) {
  const currentTenant = readTenant(tenantId);
  logTenantConfig("PAYLOAD FRONT", partialTenant || {});
  const protectedPartialTenant = safeMerge(currentTenant, partialTenant || {});
  const mergedTenant = mergeTenant(currentTenant, protectedPartialTenant || {});
  const currentViolations = collectTenantPlanConstraintViolations(currentTenant);
  const nextViolations = collectTenantPlanConstraintViolations(mergedTenant);
  const backup = createTenantBackup(tenantId);
  const configBackup = createTenantConfigBackup(tenantId, currentTenant);

  if (!currentViolations.length) {
    const tenant = writeTenant(tenantId, mergedTenant);
    tenant.backup = backup;
    tenant.configBackup = configBackup;
    return tenant;
  }

  const currentViolationIndex = new Map(
    currentViolations.map((violation) => [`${violation.resource}:${violation.reason}`, Number(violation.usage || 0)])
  );
  const hasNewOrWorseViolation = nextViolations.some((violation) => {
    const key = `${violation.resource}:${violation.reason}`;
    const previousUsage = currentViolationIndex.get(key);

    if (previousUsage === undefined) {
      return true;
    }

    return Number(violation.usage || 0) > previousUsage;
  });

  if (hasNewOrWorseViolation) {
    validateTenantPlanConstraints(mergedTenant);
  }

  const tenant = writeTenant(tenantId, mergedTenant, {
    skipPlanValidation: true
  });
  tenant.backup = backup;
  tenant.configBackup = configBackup;
  return tenant;
}

function buildBackupFileName(tenantId, timestamp = new Date()) {
  const safeTimestamp = timestamp.toISOString().replace(/[:.]/g, "-");
  return `tenant-${assertTenantId(tenantId)}-${safeTimestamp}.json`;
}

function createTenantBackup(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);
  ensureDataDirectories();
  const currentTenant = readTenant(resolvedTenantId);
  const backupFileName = buildBackupFileName(resolvedTenantId);
  const backupFilePath = path.resolve(backupsDirectoryPath, backupFileName);

  writeJsonFile(backupFilePath, currentTenant);

  return {
    fileName: backupFileName,
    filePath: backupFilePath
  };
}

function createTenantConfigBackup(tenantId, currentTenant = null) {
  const resolvedTenantId = assertTenantId(tenantId);
  ensureDataDirectories();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${resolvedTenantId}.tenantConfig.backup.${timestamp}.json`;
  const backupFilePath = path.resolve(tenantConfigBackupsDirectoryPath, backupFileName);
  const tenantSnapshot = currentTenant || readTenant(resolvedTenantId);

  writeJsonFile(backupFilePath, tenantSnapshot);

  return {
    fileName: backupFileName,
    filePath: backupFilePath
  };
}

function listTenantBackups(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);
  ensureDataDirectories();

  return fs
    .readdirSync(backupsDirectoryPath)
    .filter((fileName) => fileName.startsWith(`tenant-${resolvedTenantId}-`) && fileName.endsWith(".json"))
    .sort((left, right) => right.localeCompare(left))
    .map((fileName) => ({
      fileName,
      filePath: path.resolve(backupsDirectoryPath, fileName)
    }));
}

function restoreTenantBackup(tenantId, backupFileName) {
  const resolvedTenantId = assertTenantId(tenantId);
  const backupEntry = listTenantBackups(resolvedTenantId).find((item) => item.fileName === backupFileName);

  if (!backupEntry) {
    const error = new Error("backup_nao_encontrado");
    error.statusCode = 404;
    throw error;
  }

  const backupPayload = readJsonFile(backupEntry.filePath, null);

  if (!backupPayload) {
    const error = new Error("backup_invalido");
    error.statusCode = 400;
    throw error;
  }

  return writeTenant(
    resolvedTenantId,
    {
      ...backupPayload,
      tenantId: resolvedTenantId
    },
    {
      skipPlanValidation: true
    }
  );
}

function updateTenantPlan(tenantId, newPlan, status) {
  const resolvedTenantId = assertTenantId(tenantId);
  const currentTenant = readTenant(resolvedTenantId);
  const backup = createTenantBackup(resolvedTenantId);
  const mergedTenant = mergeTenant(currentTenant, {
    plan: newPlan,
    subscriptionStatus: status
  });
  const violations = collectTenantPlanConstraintViolations(mergedTenant);
  const updatedTenant = writeTenant(resolvedTenantId, mergedTenant, {
    skipPlanValidation: true
  });

  return {
    tenant: updatedTenant,
    backup,
    warning: violations.length ? PLAN_DOWNGRADE_WARNING : "",
    violations
  };
}

function listTenants() {
  ensureDataDirectories();

  return fs
    .readdirSync(tenantsDirectoryPath)
    .filter((fileName) => fileName.endsWith(".json"))
    .filter((fileName) => !fileName.includes(".pre-restore-"))
    .map((fileName) => readTenant(fileName.replace(/\.json$/i, "")))
    .sort((left, right) => {
      const leftName = left.business.name || left.tenantId;
      const rightName = right.business.name || right.tenantId;
      return leftName.localeCompare(rightName);
    });
}

function migrateLegacyConfig() {
  if (!fs.existsSync(legacyConfigFilePath)) {
    return;
  }

  const defaultTenantFilePath = getTenantFilePath("default");

  if (fs.existsSync(defaultTenantFilePath)) {
    return;
  }

  const legacyConfig = readJsonFile(legacyConfigFilePath, null);

  if (!legacyConfig) {
    writeJsonFile(defaultTenantFilePath, buildDefaultTenant("default"));
    return;
  }

  writeJsonFile(
    defaultTenantFilePath,
    buildDefaultTenant("default", {
      ...legacyConfig,
      tenantId: "default"
    })
  );
}

function bootstrapTenantConfigStore() {
  ensureDataDirectories();
  migrateLegacyConfig();

  if (!listTenants().length) {
    writeJsonFile(getTenantFilePath("default"), buildDefaultTenant("default"));
  }
}

module.exports = {
  bootstrapTenantConfigStore,
  buildDefaultTenant,
  createTenantBackup,
  createTenantConfigBackup,
  getTenantFilePath,
  listTenants,
  listTenantBackups,
  readTenant,
  restoreTenantBackup,
  tenantExists,
  deleteTenantFile,
  updateTenantPlan,
  updateTenant,
  writeTenant,
  backupsDirectoryPath,
  tenantConfigBackupsDirectoryPath,
  tenantsDirectoryPath
};
