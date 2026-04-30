const path = require("path");
const { ensureDirectory, readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");
const { assertTenantId } = require("../tenancy/tenantResolver");

const campaignsDataDirectoryPath = path.resolve(__dirname, "../../data/campaigns");

function getTenantCampaignStorePath(tenantId) {
  return path.resolve(campaignsDataDirectoryPath, `${assertTenantId(tenantId)}.json`);
}

function buildDefaultCampaignStore(tenantId) {
  return {
    tenantId: assertTenantId(tenantId),
    campaigns: [],
    queue: [],
    logs: [],
    leadHistory: [],
    inboundReplies: [],
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStore(store, tenantId) {
  const fallback = buildDefaultCampaignStore(tenantId);

  return {
    tenantId: fallback.tenantId,
    campaigns: normalizeArray(store?.campaigns),
    queue: normalizeArray(store?.queue),
    logs: normalizeArray(store?.logs),
    leadHistory: normalizeArray(store?.leadHistory),
    inboundReplies: normalizeArray(store?.inboundReplies),
    meta: {
      createdAt: String(store?.meta?.createdAt || fallback.meta.createdAt),
      updatedAt: new Date().toISOString()
    }
  };
}

function bootstrapCampaignStore() {
  ensureDirectory(campaignsDataDirectoryPath);
}

function readCampaignStore(tenantId) {
  const filePath = getTenantCampaignStorePath(tenantId);
  const parsed = readJsonFile(filePath, null);

  if (!parsed) {
    const fallback = buildDefaultCampaignStore(tenantId);
    writeJsonFile(filePath, fallback);
    return fallback;
  }

  const normalized = normalizeStore(parsed, tenantId);
  writeJsonFile(filePath, normalized);
  return normalized;
}

function writeCampaignStore(tenantId, nextStore) {
  const filePath = getTenantCampaignStorePath(tenantId);
  const normalized = normalizeStore(nextStore, tenantId);
  writeJsonFile(filePath, normalized);
  return normalized;
}

function updateCampaignStore(tenantId, updater) {
  const current = readCampaignStore(tenantId);
  const nextValue = typeof updater === "function" ? updater(current) : updater;
  return writeCampaignStore(tenantId, nextValue);
}

module.exports = {
  bootstrapCampaignStore,
  buildDefaultCampaignStore,
  campaignsDataDirectoryPath,
  getTenantCampaignStorePath,
  readCampaignStore,
  updateCampaignStore,
  writeCampaignStore
};
