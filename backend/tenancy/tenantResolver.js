function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeTenantId(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
}

function assertTenantId(value) {
  const tenantId = normalizeTenantId(value);

  if (!tenantId) {
    const error = new Error("tenantId_invalido");
    error.statusCode = 400;
    throw error;
  }

  return tenantId;
}

module.exports = {
  normalizeString,
  normalizeTenantId,
  assertTenantId
};
