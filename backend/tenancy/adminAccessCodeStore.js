const path = require("path");
const { readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");
const { normalizePlan } = require("../services/featureAccessService");

const adminAccessCodesFilePath = path.resolve(__dirname, "../../data/adminAccessCodes.json");

function buildEmptyStore() {
  return {
    items: []
  };
}

function readAdminAccessCodes() {
  const store = readJsonFile(adminAccessCodesFilePath, buildEmptyStore());
  return Array.isArray(store?.items) ? store : buildEmptyStore();
}

function writeAdminAccessCodes(codes) {
  return writeJsonFile(adminAccessCodesFilePath, {
    items: Array.isArray(codes?.items) ? codes.items : []
  });
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  return normalizeString(value).toLowerCase() === "inactive" ? "inactive" : "active";
}

function normalizePositiveInteger(value, fallbackValue = 1) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : fallbackValue;
}

function normalizeUsedBy(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((item) => ({
    tenantId: normalizeString(item?.tenantId),
    whatsapp: normalizeString(item?.whatsapp),
    usedAt: normalizeString(item?.usedAt)
  }));
}

function normalizeActivationCode(input = {}) {
  const maxUsesRaw = input?.maxUses;
  const unlimitedUses = maxUsesRaw === null || String(maxUsesRaw).toLowerCase() === "unlimited";
  const usedCount = Math.max(0, Math.floor(Number(input.usedCount) || 0));

  return {
    code: normalizeString(input.code).toUpperCase(),
    plan: normalizePlan(input.plan),
    status: normalizeStatus(input.status),
    expiresAt: normalizeString(input.expiresAt),
    maxUses: unlimitedUses ? null : normalizePositiveInteger(maxUsesRaw, 1),
    usedCount,
    usedBy: normalizeUsedBy(input.usedBy),
    createdAt: normalizeString(input.createdAt) || new Date().toISOString()
  };
}

function readAdminAccessCode(code) {
  const normalizedCode = normalizeString(code).toUpperCase();
  return readAdminAccessCodes().items.find((item) => item.code === normalizedCode) || null;
}

function saveAdminAccessCode(code, payload) {
  const normalizedCode = normalizeString(code).toUpperCase();
  const nextCode = normalizeActivationCode({
    ...payload,
    code: normalizedCode
  });
  const store = readAdminAccessCodes();
  const existingIndex = store.items.findIndex((item) => item.code === normalizedCode);

  if (existingIndex >= 0) {
    store.items[existingIndex] = nextCode;
  } else {
    store.items.push(nextCode);
  }

  writeAdminAccessCodes(store);
  return readAdminAccessCode(normalizedCode);
}

function updateAdminAccessCode(code, payload) {
  const normalizedCode = normalizeString(code).toUpperCase();
  const currentCode = readAdminAccessCode(normalizedCode) || {};
  return saveAdminAccessCode(normalizedCode, {
    ...currentCode,
    ...payload
  });
}

function listAdminAccessCodes() {
  return readAdminAccessCodes().items
    .map((item) => normalizeActivationCode(item))
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
}

module.exports = {
  adminAccessCodesFilePath,
  listAdminAccessCodes,
  normalizeActivationCode,
  readAdminAccessCode,
  readAdminAccessCodes,
  saveAdminAccessCode,
  updateAdminAccessCode
};
