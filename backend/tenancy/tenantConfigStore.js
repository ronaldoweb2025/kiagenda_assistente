const fs = require("fs");
const path = require("path");
const { defaultTenantConfig } = require("../config/defaultTenantConfig");
const {
  normalizePlan,
  normalizeSubscriptionStatus,
  validatePlanLimit
} = require("../services/featureAccessService");
const { assertTenantId, normalizeString } = require("./tenantResolver");
const { ensureDirectory, readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");

const dataDirectoryPath = path.resolve(__dirname, "../../data");
const tenantsDirectoryPath = path.resolve(dataDirectoryPath, "tenants");
const legacyConfigFilePath = path.resolve(dataDirectoryPath, "config.json");

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

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => normalizeString(value)).filter(Boolean);
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

function buildTenantMeta(input = {}) {
  return {
    createdAt: normalizeString(input.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function mergeMeta(currentMeta = {}, nextMeta = {}) {
  return {
    createdAt: normalizeString(currentMeta.createdAt) || normalizeString(nextMeta.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeTenant(input = {}) {
  const tenantId = assertTenantId(input?.tenantId);

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
    plan: normalizePlan(input?.plan),
    subscriptionStatus: normalizeSubscriptionStatus(input?.subscriptionStatus),
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
    advancedOptions: normalizeAdvancedOptions(input?.advancedOptions),
    products: normalizeCatalogItems(input?.products, "product"),
    services: normalizeCatalogItems(input?.services, "service"),
    partnerships: normalizeCatalogItems(input?.partnerships, "partnership"),
    menu: normalizeMenu(input?.menu),
    messages: {
      welcome: normalizeString(input?.messages?.welcome),
      fallback: normalizeString(input?.messages?.fallback),
      handoff: normalizeString(input?.messages?.handoff),
      audio: normalizeMediaAsset(input?.messages?.audio)
    },
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
    advancedOptions: Array.isArray(partialTenant.advancedOptions)
      ? partialTenant.advancedOptions
      : baseTenant.advancedOptions,
    products: Array.isArray(partialTenant.products) ? partialTenant.products : baseTenant.products,
    services: Array.isArray(partialTenant.services) ? partialTenant.services : baseTenant.services,
    partnerships: Array.isArray(partialTenant.partnerships) ? partialTenant.partnerships : baseTenant.partnerships,
    menu: Array.isArray(partialTenant.menu) ? partialTenant.menu : baseTenant.menu,
    messages: {
      ...baseTenant.messages,
      ...(partialTenant.messages || {})
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
    meta: mergeMeta(baseTenant.meta, partialTenant.meta)
  });
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
  const categoryCollections = [
    tenant.products || [],
    tenant.services || [],
    tenant.partnerships || []
  ];
  const usedCategories = categoryCollections.filter((items) => Array.isArray(items) && items.length > 0).length;

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
      nextCount: imageAssets.length
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
      nextCount: audioAssets.length
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
    return fallback;
  }

  return normalizeTenant({
    ...parsed,
    tenantId: resolvedTenantId,
    meta: mergeMeta(parsed.meta || {}, {})
  });
}

function writeTenant(tenantId, tenantData) {
  const resolvedTenantId = assertTenantId(tenantId);
  const filePath = getTenantFilePath(resolvedTenantId);
  const normalizedTenant = normalizeTenant({
    ...tenantData,
    tenantId: resolvedTenantId,
    meta: mergeMeta(tenantData.meta || {}, {})
  });

  validateTenantPlanConstraints(normalizedTenant);

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
  const mergedTenant = mergeTenant(currentTenant, partialTenant || {});
  return writeTenant(tenantId, mergedTenant);
}

function listTenants() {
  ensureDataDirectories();

  return fs
    .readdirSync(tenantsDirectoryPath)
    .filter((fileName) => fileName.endsWith(".json"))
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
  getTenantFilePath,
  listTenants,
  readTenant,
  tenantExists,
  deleteTenantFile,
  updateTenant,
  writeTenant,
  tenantsDirectoryPath
};
