const path = require("path");
const { ensureDirectory, readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");

const planSettingsFilePath = path.resolve(__dirname, "../../data/planSettings.json");

const DEFAULT_PLAN_SETTINGS = {
  essential: {
    priceMonthly: 49.9,
    allowAI: false,
    allowImages: false,
    maxImagesPerAccount: 0,
    maxImageSizeMB: 1,
    autoOptimizeImages: true,
    allowAudio: false,
    maxAudioPerAccount: 0,
    maxCategories: 5,
    maxItemsPerCategory: 10,
    allowSubcategories: false,
    maxSubcategoriesPerCategory: 0,
    upgradeMessage: "Limite do seu plano atingido. Faca upgrade para liberar mais recursos."
  },
  professional: {
    priceMonthly: 97,
    allowAI: true,
    allowImages: true,
    maxImagesPerAccount: 10,
    maxImageSizeMB: 1,
    autoOptimizeImages: true,
    allowAudio: true,
    maxAudioPerAccount: 1,
    maxCategories: 10,
    maxItemsPerCategory: 20,
    allowSubcategories: false,
    maxSubcategoriesPerCategory: 0,
    upgradeMessage: "Limite do seu plano atingido. Faca upgrade para liberar mais recursos."
  },
  business: {
    priceMonthly: 197,
    allowAI: true,
    allowImages: true,
    maxImagesPerAccount: 20,
    maxImageSizeMB: 1,
    autoOptimizeImages: true,
    allowAudio: true,
    maxAudioPerAccount: 1,
    maxCategories: 15,
    maxItemsPerCategory: 30,
    allowSubcategories: true,
    maxSubcategoriesPerCategory: 5,
    upgradeMessage: "Limite do seu plano atingido. Faca upgrade para liberar mais recursos."
  }
};

const PLAN_KEYS = ["essential", "professional", "business"];

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value, fallbackValue = false) {
  if (value === undefined) {
    return fallbackValue;
  }

  return Boolean(value);
}

function normalizeNonNegativeInteger(value, fallbackValue) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? Math.floor(numericValue) : fallbackValue;
}

function normalizePositiveNumber(value, fallbackValue) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallbackValue;
}

function normalizePlanConfig(input = {}, fallback = {}, planKey = "essential") {
  const requestedAllowAudio = normalizeBoolean(input.allowAudio, fallback.allowAudio ?? false);
  const normalizedAllowAudio = planKey === "essential" ? false : requestedAllowAudio;
  const requestedMaxAudio = normalizeNonNegativeInteger(input.maxAudioPerAccount, fallback.maxAudioPerAccount ?? 0);

  return {
    priceMonthly: normalizePositiveNumber(input.priceMonthly, fallback.priceMonthly ?? 0),
    allowAI: normalizeBoolean(input.allowAI, fallback.allowAI ?? false),
    allowImages: normalizeBoolean(input.allowImages, fallback.allowImages ?? false),
    maxImagesPerAccount: normalizeNonNegativeInteger(input.maxImagesPerAccount, fallback.maxImagesPerAccount ?? 0),
    maxImageSizeMB: normalizePositiveNumber(input.maxImageSizeMB, fallback.maxImageSizeMB ?? 1),
    autoOptimizeImages: normalizeBoolean(input.autoOptimizeImages, fallback.autoOptimizeImages ?? true),
    allowAudio: normalizedAllowAudio,
    maxAudioPerAccount: normalizedAllowAudio ? Math.min(requestedMaxAudio, 1) : 0,
    maxCategories: normalizeNonNegativeInteger(input.maxCategories, fallback.maxCategories ?? 0),
    maxItemsPerCategory: normalizeNonNegativeInteger(input.maxItemsPerCategory, fallback.maxItemsPerCategory ?? 0),
    allowSubcategories: normalizeBoolean(input.allowSubcategories, fallback.allowSubcategories ?? false),
    maxSubcategoriesPerCategory: normalizeNonNegativeInteger(
      input.maxSubcategoriesPerCategory,
      fallback.maxSubcategoriesPerCategory ?? 0
    ),
    upgradeMessage:
      normalizeString(input.upgradeMessage) ||
      normalizeString(fallback.upgradeMessage) ||
      "Limite do seu plano atingido. Faca upgrade para liberar mais recursos."
  };
}

function normalizePlanSettings(input = {}) {
  return PLAN_KEYS.reduce((accumulator, planKey) => {
    accumulator[planKey] = normalizePlanConfig(input?.[planKey], DEFAULT_PLAN_SETTINGS[planKey], planKey);
    return accumulator;
  }, {});
}

function readPlanSettings() {
  const parsed = readJsonFile(planSettingsFilePath, null);
  return normalizePlanSettings(parsed || DEFAULT_PLAN_SETTINGS);
}

function writePlanSettings(nextSettings) {
  const normalizedSettings = normalizePlanSettings(nextSettings);
  writeJsonFile(planSettingsFilePath, normalizedSettings);
  return normalizedSettings;
}

function updatePlanSettings(partialSettings = {}) {
  const currentSettings = readPlanSettings();
  const mergedSettings = PLAN_KEYS.reduce((accumulator, planKey) => {
    accumulator[planKey] = normalizePlanConfig(
      {
        ...currentSettings[planKey],
        ...(partialSettings?.[planKey] || {})
      },
      DEFAULT_PLAN_SETTINGS[planKey],
      planKey
    );
    return accumulator;
  }, {});

  return writePlanSettings(mergedSettings);
}

function bootstrapPlanSettingsStore() {
  ensureDirectory(path.dirname(planSettingsFilePath));

  if (!readJsonFile(planSettingsFilePath, null)) {
    writePlanSettings(DEFAULT_PLAN_SETTINGS);
  } else {
    writePlanSettings(readPlanSettings());
  }
}

module.exports = {
  DEFAULT_PLAN_SETTINGS,
  PLAN_KEYS,
  bootstrapPlanSettingsStore,
  normalizePlanSettings,
  planSettingsFilePath,
  readPlanSettings,
  updatePlanSettings,
  writePlanSettings
};
