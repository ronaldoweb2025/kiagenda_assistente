const path = require("path");
const fs = require("fs");
const { assertTenantId } = require("./tenantResolver");
const { ensureDirectory, readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");

const statesDirectoryPath = path.resolve(__dirname, "../../data/states");

function getStateFilePath(tenantId) {
  return path.resolve(statesDirectoryPath, `${assertTenantId(tenantId)}.json`);
}

function bootstrapTenantStateStore() {
  ensureDirectory(statesDirectoryPath);
}

function readTenantStates(tenantId) {
  return readJsonFile(getStateFilePath(tenantId), {});
}

function writeTenantStates(tenantId, states) {
  writeJsonFile(getStateFilePath(tenantId), states || {});
  return states || {};
}

function deleteTenantStates(tenantId) {
  const filePath = getStateFilePath(tenantId);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

module.exports = {
  bootstrapTenantStateStore,
  deleteTenantStates,
  readTenantStates,
  writeTenantStates,
  statesDirectoryPath
};
