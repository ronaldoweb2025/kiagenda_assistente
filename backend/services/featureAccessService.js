function normalizePlan(value) {
  return String(value || "").trim().toLowerCase() === "professional" ? "professional" : "essential";
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

function canUseFeature(tenant = {}, feature) {
  const normalizedFeature = String(feature || "").trim().toLowerCase();
  const plan = normalizePlan(tenant.plan);
  const subscriptionEnabled = hasActiveSubscription(tenant);

  if (!subscriptionEnabled) {
    return false;
  }

  if (["text", "products", "services", "links", "handoff"].includes(normalizedFeature)) {
    return true;
  }

  if (["ai", "image", "images", "audio", "media"].includes(normalizedFeature)) {
    if (normalizedFeature === "ai" && tenant.aiEnabled === false) {
      return false;
    }

    return plan === "professional";
  }

  return false;
}

module.exports = {
  canUseFeature,
  hasActiveSubscription,
  normalizePlan,
  normalizeSubscriptionStatus
};
