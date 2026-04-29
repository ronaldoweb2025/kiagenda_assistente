const { readPlanSettings } = require("../tenancy/planSettingsStore");

function normalizePlan(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (normalizedValue === "professional") {
    return "professional";
  }

  if (normalizedValue === "business") {
    return "business";
  }

  return "essential";
}

function normalizeSubscriptionStatus(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (normalizedValue === "inactive") {
    return "inactive";
  }

  if (normalizedValue === "trial") {
    return "trial";
  }

  return "active";
}

function hasActiveSubscription(tenant = {}) {
  const status = normalizeSubscriptionStatus(tenant.subscriptionStatus);
  return status === "active" || status === "trial";
}

function getPlanLimits(tenant = {}) {
  const planSettings = readPlanSettings();
  const plan = normalizePlan(tenant.plan);
  return {
    plan,
    ...planSettings[plan]
  };
}

function getUpgradeMessage(tenant = {}) {
  return getPlanLimits(tenant).upgradeMessage || "Limite do seu plano atingido. Faca upgrade para liberar mais recursos.";
}

function getCatalogCollections(tenant = {}) {
  return [
    Array.isArray(tenant.products) ? tenant.products : [],
    Array.isArray(tenant.services) ? tenant.services : [],
    Array.isArray(tenant.partnerships) ? tenant.partnerships : []
  ];
}

function countUsedCategories(tenant = {}) {
  return getCatalogCollections(tenant).filter((items) => items.length > 0).length;
}

function countImages(tenant = {}) {
  return getCatalogCollections(tenant).reduce((total, items) => {
    return total + items.reduce((innerTotal, item) => {
      if (Array.isArray(item?.images) && item.images.length) {
        return innerTotal + item.images.filter(Boolean).length;
      }

      return innerTotal + (item?.image ? 1 : 0);
    }, 0);
  }, 0);
}

function countAudioAssets(tenant = {}) {
  const catalogAudioCount = getCatalogCollections(tenant).reduce((total, items) => {
    return total + items.filter((item) => item?.audio).length;
  }, 0);

  return catalogAudioCount + (tenant?.messages?.audio ? 1 : 0);
}

function canUseFeature(tenant = {}, feature) {
  const normalizedFeature = String(feature || "").trim().toLowerCase();
  const subscriptionEnabled = hasActiveSubscription(tenant);
  const limits = getPlanLimits(tenant);

  if (!subscriptionEnabled) {
    return false;
  }

  if (["text", "products", "services", "partnerships", "links", "handoff", "categories"].includes(normalizedFeature)) {
    return true;
  }

  if (normalizedFeature === "ai") {
    if (!limits.allowAI || tenant.aiEnabled === false) {
      return false;
    }

    return true;
  }

  if (["image", "images"].includes(normalizedFeature)) {
    return limits.allowImages;
  }

  if (normalizedFeature === "audio") {
    return limits.allowAudio;
  }

  if (normalizedFeature === "media") {
    return limits.allowImages || limits.allowAudio;
  }

  return false;
}

function validatePlanLimit(tenant = {}, resource = {}) {
  const normalizedType = String(resource?.type || resource?.resource || "").trim().toLowerCase();
  const limits = getPlanLimits(tenant);
  const upgradeMessage = getUpgradeMessage(tenant);

  if (!hasActiveSubscription(tenant)) {
    return {
      allowed: false,
      message: "Sua assinatura esta inativa. Ative sua conta para continuar.",
      reason: "subscription_inactive",
      limits
    };
  }

  if (normalizedType === "ai") {
    return canUseFeature(tenant, "ai")
      ? { allowed: true, limits }
      : {
          allowed: false,
          message: upgradeMessage,
          reason: "ai_locked",
          limits
        };
  }

  if (normalizedType === "category") {
    const nextCount = Number(resource?.nextCount);
    const usedCategories = Number.isFinite(nextCount) ? nextCount : countUsedCategories(tenant);

    if (usedCategories > limits.maxCategories) {
      return {
        allowed: false,
        message: upgradeMessage,
        reason: "categories_limit",
        limits,
        usage: usedCategories
      };
    }

    return { allowed: true, limits, usage: usedCategories };
  }

  if (normalizedType === "item") {
    const nextCount = Number(resource?.nextCount);
    const itemCount = Number.isFinite(nextCount) ? nextCount : 0;

    if (itemCount > limits.maxItemsPerCategory) {
      return {
        allowed: false,
        message: upgradeMessage,
        reason: "items_per_category_limit",
        limits,
        usage: itemCount
      };
    }

    return { allowed: true, limits, usage: itemCount };
  }

  if (normalizedType === "image") {
    if (!limits.allowImages) {
      return {
        allowed: false,
        message: upgradeMessage,
        reason: "images_locked",
        limits
      };
    }

    const nextCount = Number(resource?.nextCount);
    const imageCount = Number.isFinite(nextCount) ? nextCount : countImages(tenant);

    if (imageCount > limits.maxImagesPerAccount) {
      return {
        allowed: false,
        message: upgradeMessage,
        reason: "images_limit",
        limits,
        usage: imageCount
      };
    }

    const maxImageSizeBytes = Number(limits.maxImageSizeMB || 0) * 1024 * 1024;
    const fileSizeBytes = Number(resource?.fileSizeBytes || 0);

    if (fileSizeBytes > 0 && maxImageSizeBytes > 0 && fileSizeBytes > maxImageSizeBytes) {
      return {
        allowed: false,
        message: `Cada imagem deve ter no maximo ${limits.maxImageSizeMB} MB.`,
        reason: "image_size_limit",
        limits,
        usage: fileSizeBytes
      };
    }

    return { allowed: true, limits, usage: imageCount };
  }

  if (normalizedType === "audio") {
    if (!limits.allowAudio) {
      return {
        allowed: false,
        message: upgradeMessage,
        reason: "audio_locked",
        limits
      };
    }

    const nextCount = Number(resource?.nextCount);
    const audioCount = Number.isFinite(nextCount) ? nextCount : countAudioAssets(tenant);

    if (audioCount > Math.min(limits.maxAudioPerAccount, 1)) {
      return {
        allowed: false,
        message: upgradeMessage,
        reason: "audio_limit",
        limits,
        usage: audioCount
      };
    }

    return { allowed: true, limits, usage: audioCount };
  }

  if (normalizedType === "subcategory") {
    if (!limits.allowSubcategories) {
      return {
        allowed: false,
        message: upgradeMessage,
        reason: "subcategories_locked",
        limits
      };
    }

    const nextCount = Number(resource?.nextCount);
    const subcategoryCount = Number.isFinite(nextCount) ? nextCount : 0;

    if (subcategoryCount > limits.maxSubcategoriesPerCategory) {
      return {
        allowed: false,
        message: upgradeMessage,
        reason: "subcategories_limit",
        limits,
        usage: subcategoryCount
      };
    }

    return { allowed: true, limits, usage: subcategoryCount };
  }

  return { allowed: true, limits };
}

module.exports = {
  canUseFeature,
  countAudioAssets,
  countImages,
  countUsedCategories,
  getPlanLimits,
  hasActiveSubscription,
  normalizePlan,
  normalizeSubscriptionStatus,
  validatePlanLimit
};
