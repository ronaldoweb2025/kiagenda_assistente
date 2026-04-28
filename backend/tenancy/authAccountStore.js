const path = require("path");
const { readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");
const { normalizeTenantId, normalizeString } = require("./tenantResolver");

const authAccountsFilePath = path.resolve(__dirname, "../../data/authAccounts.json");

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function buildEmptyStore() {
  return {
    items: []
  };
}

function readAuthAccounts() {
  const store = readJsonFile(authAccountsFilePath, buildEmptyStore());
  return Array.isArray(store?.items)
    ? store
    : buildEmptyStore();
}

function writeAuthAccounts(store) {
  return writeJsonFile(authAccountsFilePath, {
    items: Array.isArray(store?.items) ? store.items : []
  });
}

function normalizeAccount(input = {}) {
  return {
    tenantId: normalizeTenantId(input.tenantId),
    name: normalizeString(input.name),
    businessName: normalizeString(input.businessName),
    whatsapp: normalizePhone(input.whatsapp),
    email: normalizeEmail(input.email),
    passwordHash: normalizeString(input.passwordHash),
    authProvider: normalizeString(input.authProvider) || "local",
    googleId: normalizeString(input.googleId),
    avatarUrl: normalizeString(input.avatarUrl),
    whatsappVerified: Boolean(input.whatsappVerified),
    whatsappVerificationCode: normalizeString(input.whatsappVerificationCode),
    whatsappVerificationExpiresAt: normalizeString(input.whatsappVerificationExpiresAt),
    whatsappVerificationSentAt: normalizeString(input.whatsappVerificationSentAt),
    whatsappVerificationUsedAt: normalizeString(input.whatsappVerificationUsedAt),
    activationStatus: normalizeString(input.activationStatus).toLowerCase() === "active" ? "active" : "pending",
    activationCode: normalizeString(input.activationCode),
    activationCodeExpiresAt: normalizeString(input.activationCodeExpiresAt),
    activationCodeUsedAt: normalizeString(input.activationCodeUsedAt),
    createdAt: normalizeString(input.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function listAuthAccounts() {
  return readAuthAccounts().items.map((item) => normalizeAccount(item));
}

function findAuthAccountByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return listAuthAccounts().find((account) => account.email === normalizedEmail) || null;
}

function findAuthAccountByWhatsapp(whatsapp) {
  const normalizedPhone = normalizePhone(whatsapp);
  return listAuthAccounts().find((account) => account.whatsapp === normalizedPhone) || null;
}

function findAuthAccountByTenantId(tenantId) {
  const normalizedTenant = normalizeTenantId(tenantId);
  return listAuthAccounts().find((account) => account.tenantId === normalizedTenant) || null;
}

function upsertAuthAccount(accountInput = {}) {
  const nextAccount = normalizeAccount(accountInput);
  const store = readAuthAccounts();
  const currentItems = Array.isArray(store.items) ? store.items : [];
  const existingIndex = currentItems.findIndex((account) => {
    return account?.tenantId === nextAccount.tenantId || account?.email === nextAccount.email;
  });

  if (existingIndex >= 0) {
    const currentAccount = normalizeAccount(currentItems[existingIndex]);
    currentItems[existingIndex] = {
      ...currentAccount,
      ...nextAccount,
      createdAt: currentAccount.createdAt || nextAccount.createdAt,
      updatedAt: new Date().toISOString()
    };
  } else {
    currentItems.push(nextAccount);
  }

  writeAuthAccounts({
    items: currentItems
  });

  return findAuthAccountByTenantId(nextAccount.tenantId);
}

function deleteAuthAccountByTenantId(tenantId) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const store = readAuthAccounts();
  const currentItems = Array.isArray(store.items) ? store.items : [];
  const nextItems = currentItems.filter((account) => normalizeTenantId(account?.tenantId) !== normalizedTenantId);

  if (nextItems.length === currentItems.length) {
    return false;
  }

  writeAuthAccounts({
    items: nextItems
  });

  return true;
}

module.exports = {
  authAccountsFilePath,
  deleteAuthAccountByTenantId,
  findAuthAccountByEmail,
  findAuthAccountByTenantId,
  findAuthAccountByWhatsapp,
  listAuthAccounts,
  normalizeEmail,
  normalizePhone,
  upsertAuthAccount
};
