const { readTenantStates, writeTenantStates } = require("../tenancy/tenantStateStore");

function getDefaultState() {
  return {
    currentState: "idle",
    lastInteractionAt: null,
    fallbackCount: 0,
    handoffUntil: null,
    lastBotMessageType: null,
    customerName: "",
    customerRegion: "",
    conversationState: {
      stage: "",
      lastSuggestedService: "",
      lastIntent: "",
      rejectedServices: []
    },
    lastUserMessage: "",
    pendingServiceConfirmationId: "",
    pendingServiceConfirmationScore: 0
  };
}

function getTenantBucket(tenantId) {
  return readTenantStates(tenantId);
}

function isExpired(state, ttlMinutes) {
  if (!state.lastInteractionAt) {
    return false;
  }

  return Date.now() - state.lastInteractionAt > ttlMinutes * 60 * 1000;
}

function getState(tenantId, contactId, ttlMinutes) {
  const tenantBucket = getTenantBucket(tenantId);
  const currentState = tenantBucket[contactId];

  if (!currentState || isExpired(currentState, ttlMinutes)) {
    const nextState = getDefaultState();
    tenantBucket[contactId] = nextState;
    writeTenantStates(tenantId, tenantBucket);
    return nextState;
  }

  return currentState;
}

function setState(tenantId, contactId, nextState, ttlMinutes) {
  const currentState = getState(tenantId, contactId, ttlMinutes);
  const mergedState = {
    ...currentState,
    ...nextState,
    lastInteractionAt: Date.now()
  };

  const tenantBucket = getTenantBucket(tenantId);
  tenantBucket[contactId] = mergedState;
  writeTenantStates(tenantId, tenantBucket);
  return mergedState;
}

function clearState(tenantId, contactId) {
  const tenantBucket = getTenantBucket(tenantId);
  delete tenantBucket[contactId];
  writeTenantStates(tenantId, tenantBucket);
}

function listTenantStates(tenantId, ttlMinutes) {
  const tenantBucket = getTenantBucket(tenantId);
  const entries = [];

  Object.entries(tenantBucket).forEach(([contactId, state]) => {
    if (!isExpired(state, ttlMinutes)) {
      entries.push({ contactId, state });
    }
  });

  return entries;
}

module.exports = {
  getState,
  setState,
  clearState,
  listTenantStates
};
