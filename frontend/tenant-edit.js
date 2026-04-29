const dashboardState = {
  tenantId: "",
  tenant: null,
  session: null,
  planSettings: {},
  currentSection: "overview",
  sessionPollTimer: null,
  sessionAutoStartAttempted: false,
  activeCategoryId: "",
  editingCategoryId: "",
  editingCategoryItemId: "",
  catalogKeywordSuggestions: [],
  editingLinkId: "",
  editingMenuId: "",
  editingMessageType: "",
  advancedMenuOpen: false,
  menuEditedManually: false
};

const DASHBOARD_SECTION_STORAGE_KEY = "kiagenda.dashboard.activeSection";
const BOT_MODEL_OPTIONS = {
  standard: {
    label: "Atendimento padrao",
    description: "Focado em apresentar as principais informacoes do negocio e direcionar o cliente para produtos, servicos, links ou atendimento."
  },
  loja_online: {
    label: "Loja online",
    description: "Focado em apresentar produtos, links de compra e facilitar o contato para fechar pedidos."
  },
  services_agendamento: {
    label: "Servicos / Agendamento",
    description: "Focado em apresentar servicos, orientar o cliente e facilitar o agendamento."
  },
  delivery: {
    label: "Delivery",
    description: "Focado em apresentar cardapio, links de pedido, entrega ou retirada e atendimento."
  },
  custom: {
    label: "Personalizado",
    description: "Use esse modo somente se voce quiser escrever as mensagens manualmente."
  }
};

const dashboardElements = {
  feedbackMessage: document.getElementById("feedbackMessage"),
  sidebarBusinessName: document.getElementById("sidebarBusinessName"),
  headerBusinessName: document.getElementById("headerBusinessName"),
  headerWhatsappBadge: document.getElementById("headerWhatsappBadge"),
  headerBotBadge: document.getElementById("headerBotBadge"),
  saveConfigButton: document.getElementById("saveConfigButton"),
  logoutButton: document.getElementById("logoutButton"),
  navButtons: Array.from(document.querySelectorAll(".dashboard-nav-button")),
  panels: Array.from(document.querySelectorAll(".panel-section")),
  overviewWhatsappStatus: document.getElementById("overviewWhatsappStatus"),
  overviewCatalogCount: document.getElementById("overviewCatalogCount"),
  overviewLinksCount: document.getElementById("overviewLinksCount"),
  overviewBotStatus: document.getElementById("overviewBotStatus"),
  overviewBotToggleButton: document.getElementById("overviewBotToggleButton"),
  overviewTestButton: document.getElementById("overviewTestButton"),
  overviewPlanBadge: document.getElementById("overviewPlanBadge"),
  planFeaturesList: document.getElementById("planFeaturesList"),
  planUsageList: document.getElementById("planUsageList"),
  whatsappStatus: document.getElementById("whatsappStatus"),
  accountWhatsappNumber: document.getElementById("accountWhatsappNumber"),
  connectedWhatsappNumber: document.getElementById("connectedWhatsappNumber"),
  whatsappSessionId: document.getElementById("whatsappSessionId"),
  connectWhatsappButton: document.getElementById("connectWhatsappButton"),
  resetWhatsappSessionButton: document.getElementById("resetWhatsappSessionButton"),
  disconnectWhatsappButton: document.getElementById("disconnectWhatsappButton"),
  refreshWhatsappButton: document.getElementById("refreshWhatsappButton"),
  whatsappQrPanel: document.getElementById("whatsappQrPanel"),
  botModelSelect: document.getElementById("botModelSelect"),
  botModelTitle: document.getElementById("botModelTitle"),
  botModelDescription: document.getElementById("botModelDescription"),
  aiToggleCard: document.getElementById("aiToggleCard"),
  aiEnabledToggle: document.getElementById("aiEnabledToggle"),
  geminiConfigCard: document.getElementById("geminiConfigCard"),
  geminiApiKey: document.getElementById("geminiApiKey"),
  geminiModel: document.getElementById("geminiModel"),
  aiLockedNotice: document.getElementById("aiLockedNotice"),
  botPlanLockCard: document.getElementById("botPlanLockCard"),
  botStatusDescription: document.getElementById("botStatusDescription"),
  botToggleButton: document.getElementById("botToggleButton"),
  botMenuPreview: document.getElementById("botMenuPreview"),
  welcomePreview: document.getElementById("welcomePreview"),
  fallbackPreview: document.getElementById("fallbackPreview"),
  handoffPreview: document.getElementById("handoffPreview"),
  welcomeMessage: document.getElementById("welcomeMessage"),
  fallbackMessage: document.getElementById("fallbackMessage"),
  handoffMessage: document.getElementById("handoffMessage"),
  welcomeEditor: document.getElementById("welcomeEditor"),
  fallbackEditor: document.getElementById("fallbackEditor"),
  handoffEditor: document.getElementById("handoffEditor"),
  editWelcomeMessageButton: document.getElementById("editWelcomeMessageButton"),
  editFallbackMessageButton: document.getElementById("editFallbackMessageButton"),
  editHandoffMessageButton: document.getElementById("editHandoffMessageButton"),
  saveWelcomeMessageButton: document.getElementById("saveWelcomeMessageButton"),
  saveFallbackMessageButton: document.getElementById("saveFallbackMessageButton"),
  saveHandoffMessageButton: document.getElementById("saveHandoffMessageButton"),
  cancelWelcomeMessageButton: document.getElementById("cancelWelcomeMessageButton"),
  cancelFallbackMessageButton: document.getElementById("cancelFallbackMessageButton"),
  cancelHandoffMessageButton: document.getElementById("cancelHandoffMessageButton"),
  messageAudioField: document.getElementById("messageAudioField"),
  messageAudio: document.getElementById("messageAudio"),
  messageAudioStatus: document.getElementById("messageAudioStatus"),
  messageAudioLockNotice: document.getElementById("messageAudioLockNotice"),
  showProductsTabButton: document.getElementById("showProductsTabButton"),
  showServicesTabButton: document.getElementById("showServicesTabButton"),
  showPartnershipsTabButton: document.getElementById("showPartnershipsTabButton"),
  currentPlanName: document.getElementById("currentPlanName"),
  currentPlanDescription: document.getElementById("currentPlanDescription"),
  currentSubscriptionStatus: document.getElementById("currentSubscriptionStatus"),
  currentPlanUsageSummary: document.getElementById("currentPlanUsageSummary"),
  plansUpgradeButton: document.getElementById("plansUpgradeButton"),
  essentialPlanCard: document.getElementById("essentialPlanCard"),
  professionalPlanCard: document.getElementById("professionalPlanCard"),
  businessPlanCard: document.getElementById("businessPlanCard"),
  essentialPlanPrice: document.getElementById("essentialPlanPrice"),
  professionalPlanPrice: document.getElementById("professionalPlanPrice"),
  businessPlanPrice: document.getElementById("businessPlanPrice"),
  essentialPlanFeatures: document.getElementById("essentialPlanFeatures"),
  professionalPlanFeatures: document.getElementById("professionalPlanFeatures"),
  businessPlanFeatures: document.getElementById("businessPlanFeatures"),
  productsPanel: document.getElementById("productsPanel"),
  servicesPanel: document.getElementById("servicesPanel"),
  productName: document.getElementById("productName"),
  productPrice: document.getElementById("productPrice"),
  productDescription: document.getElementById("productDescription"),
  productLink: document.getElementById("productLink"),
  productKeywords: document.getElementById("productKeywords"),
  generateProductKeywordsButton: document.getElementById("generateProductKeywordsButton"),
  productKeywordSuggestions: document.getElementById("productKeywordSuggestions"),
  productImages: document.getElementById("productImages"),
  productImagesStatus: document.getElementById("productImagesStatus"),
  productMediaNotice: document.getElementById("productMediaNotice"),
  productsUsageCounter: document.getElementById("productsUsageCounter"),
  addProductButton: document.getElementById("addProductButton"),
  cancelProductEditButton: document.getElementById("cancelProductEditButton"),
  productsList: document.getElementById("productsList"),
  serviceName: document.getElementById("serviceName"),
  servicePrice: document.getElementById("servicePrice"),
  serviceDescription: document.getElementById("serviceDescription"),
  serviceLink: document.getElementById("serviceLink"),
  serviceKeywords: document.getElementById("serviceKeywords"),
  generateServiceKeywordsButton: document.getElementById("generateServiceKeywordsButton"),
  serviceKeywordSuggestions: document.getElementById("serviceKeywordSuggestions"),
  serviceImage: document.getElementById("serviceImage"),
  serviceImageStatus: document.getElementById("serviceImageStatus"),
  serviceMediaNotice: document.getElementById("serviceMediaNotice"),
  servicesUsageCounter: document.getElementById("servicesUsageCounter"),
  addServiceButton: document.getElementById("addServiceButton"),
  cancelServiceEditButton: document.getElementById("cancelServiceEditButton"),
  servicesList: document.getElementById("servicesList"),
  partnershipsPanel: document.getElementById("partnershipsPanel"),
  partnershipName: document.getElementById("partnershipName"),
  partnershipPrice: document.getElementById("partnershipPrice"),
  partnershipDescription: document.getElementById("partnershipDescription"),
  partnershipLink: document.getElementById("partnershipLink"),
  partnershipKeywords: document.getElementById("partnershipKeywords"),
  generatePartnershipKeywordsButton: document.getElementById("generatePartnershipKeywordsButton"),
  partnershipKeywordSuggestions: document.getElementById("partnershipKeywordSuggestions"),
  partnershipsUsageCounter: document.getElementById("partnershipsUsageCounter"),
  addPartnershipButton: document.getElementById("addPartnershipButton"),
  cancelPartnershipEditButton: document.getElementById("cancelPartnershipEditButton"),
  partnershipsList: document.getElementById("partnershipsList"),
  linkTitle: document.getElementById("linkTitle"),
  linkUrl: document.getElementById("linkUrl"),
  linkDescription: document.getElementById("linkDescription"),
  addLinkButton: document.getElementById("addLinkButton"),
  cancelLinkEditButton: document.getElementById("cancelLinkEditButton"),
  linksList: document.getElementById("linksList"),
  toggleAdvancedMenuButton: document.getElementById("toggleAdvancedMenuButton"),
  advancedMenuPanel: document.getElementById("advancedMenuPanel"),
  menuLabel: document.getElementById("menuLabel"),
  menuType: document.getElementById("menuType"),
  menuAliases: document.getElementById("menuAliases"),
  menuCustomReplyField: document.getElementById("menuCustomReplyField"),
  menuCustomReply: document.getElementById("menuCustomReply"),
  addMenuButton: document.getElementById("addMenuButton"),
  cancelMenuEditButton: document.getElementById("cancelMenuEditButton"),
  menuOptionsList: document.getElementById("menuOptionsList"),
  simulatorContactId: document.getElementById("simulatorContactId"),
  simulatorMessage: document.getElementById("simulatorMessage"),
  simulateMessageButton: document.getElementById("simulateMessageButton"),
  simulatorIntent: document.getElementById("simulatorIntent"),
  simulatorReply: document.getElementById("simulatorReply"),
  tenantId: document.getElementById("tenantId"),
  tenantActive: document.getElementById("tenantActive"),
  businessName: document.getElementById("businessName"),
  attendantName: document.getElementById("attendantName"),
  businessType: document.getElementById("businessType"),
  businessDescription: document.getElementById("businessDescription"),
  settingsPlanDescription: document.getElementById("settingsPlanDescription"),
  settingsUpgradeButton: document.getElementById("settingsUpgradeButton"),
  googleAccountAvatar: document.getElementById("googleAccountAvatar"),
  googleAccountStatus: document.getElementById("googleAccountStatus"),
  googleAccountHint: document.getElementById("googleAccountHint"),
  googleAccountEmail: document.getElementById("googleAccountEmail"),
  connectGoogleButton: document.getElementById("connectGoogleButton"),
  newPassword: document.getElementById("newPassword"),
  confirmNewPassword: document.getElementById("confirmNewPassword"),
  updatePasswordButton: document.getElementById("updatePasswordButton"),
  stateTTL: document.getElementById("stateTTL"),
  handoffTimeout: document.getElementById("handoffTimeout"),
  upgradeButtons: Array.from(document.querySelectorAll("[data-upgrade-action]"))
};

function isProfessionalPlan() {
  return ["professional", "business"].includes(String(dashboardState.tenant?.plan || "essential"));
}

function normalizeSubscriptionStatus(value) {
  if (String(value || "").trim().toLowerCase() === "inactive") {
    return "inactive";
  }

  if (String(value || "").trim().toLowerCase() === "trial") {
    return "trial";
  }

  return "active";
}

function hasActiveSubscription() {
  const status = normalizeSubscriptionStatus(dashboardState.tenant?.subscriptionStatus);
  return status === "active" || status === "trial";
}

function getPlanKey() {
  const normalizedPlan = String(dashboardState.tenant?.plan || "essential").trim().toLowerCase();

  if (normalizedPlan === "professional") {
    return "professional";
  }

  if (normalizedPlan === "business") {
    return "business";
  }

  return "essential";
}

function getDefaultPlanSettings() {
  return {
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
}

function getAllPlanSettings() {
  const defaultSettings = getDefaultPlanSettings();
  return Object.keys(defaultSettings).reduce((accumulator, planKey) => {
    accumulator[planKey] = {
      ...defaultSettings[planKey],
      ...(dashboardState.planSettings?.[planKey] || {})
    };
    return accumulator;
  }, {});
}

function getCurrentPlanSettings() {
  return getAllPlanSettings()[getPlanKey()];
}

function formatPriceMonthly(value) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue)
    ? numericValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";
}

function slugifyCategoryLabel(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCatalogCategories() {
  const categories = Array.isArray(dashboardState.tenant?.categories) ? dashboardState.tenant.categories : [];

  return [...categories]
    .filter((category) => String(category?.type || "catalog") === "catalog")
    .sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0));
}

function findCategoryById(categoryId) {
  return getCatalogCategories().find((category) => category.id === categoryId) || null;
}

function findLegacyCategory(legacyKey) {
  return getCatalogCategories().find((category) => category.legacyKey === legacyKey) || null;
}

function ensureTenantCategories() {
  const existingCategories = Array.isArray(dashboardState.tenant?.categories) ? dashboardState.tenant.categories : [];

  if (existingCategories.length) {
    return existingCategories;
  }

  const categories = [
    {
      id: "category_products",
      name: "Produtos",
      keywords: ["produtos", "produto", "catalogo", "cardapio"],
      type: "catalog",
      enabled: true,
      order: 0,
      legacyKey: "products",
      customReply: "",
      items: Array.isArray(dashboardState.tenant?.products) ? dashboardState.tenant.products : []
    },
    {
      id: "category_services",
      name: "Servicos",
      keywords: ["servicos", "servico", "agendamento"],
      type: "catalog",
      enabled: true,
      order: 1,
      legacyKey: "services",
      customReply: "",
      items: Array.isArray(dashboardState.tenant?.services) ? dashboardState.tenant.services : []
    }
  ];

  if (Array.isArray(dashboardState.tenant?.partnerships) && dashboardState.tenant.partnerships.length) {
    categories.push({
      id: "category_partnerships",
      name: "Revenda e Parcerias",
      keywords: ["revenda", "parceria", "parcerias", "representante", "distribuidor"],
      type: "catalog",
      enabled: true,
      order: 2,
      legacyKey: "partnerships",
      customReply: "",
      items: dashboardState.tenant.partnerships
    });
  }

  dashboardState.tenant.categories = categories;
  return categories;
}

function syncLegacyCatalogCollectionsFromCategories() {
  ensureTenantCategories();
  dashboardState.tenant.products = findLegacyCategory("products")?.items || [];
  dashboardState.tenant.services = findLegacyCategory("services")?.items || [];
  dashboardState.tenant.partnerships = findLegacyCategory("partnerships")?.items || [];
}

function countUsedCategories() {
  return getCatalogCategories().filter((category) => Array.isArray(category.items) && category.items.length > 0).length;
}

function countUsedImages() {
  return getCatalogCategories().reduce((total, category) => {
    return total + (category.items || []).reduce((innerTotal, item) => {
      if (Array.isArray(item?.images) && item.images.length) {
        return innerTotal + item.images.filter(Boolean).length;
      }

      return innerTotal + (item?.image ? 1 : 0);
    }, 0);
  }, 0);
}

function countUsedAudio() {
  return dashboardState.tenant?.messages?.audio ? 1 : 0;
}

function getUpgradeMessage() {
  return getCurrentPlanSettings().upgradeMessage || "Limite do seu plano atingido. Faca upgrade para liberar mais recursos.";
}

function canUseFeatureInPanel(feature) {
  const normalizedFeature = String(feature || "").trim().toLowerCase();
  const plan = getCurrentPlanSettings();

  if (!hasActiveSubscription()) {
    return false;
  }

  if (["text", "products", "services", "partnerships", "links", "handoff", "categories"].includes(normalizedFeature)) {
    return true;
  }

  if (normalizedFeature === "ai") {
    return Boolean(plan.allowAI);
  }

  if (["image", "images"].includes(normalizedFeature)) {
    return Boolean(plan.allowImages);
  }

  if (normalizedFeature === "audio") {
    return Boolean(plan.allowAudio);
  }

  if (normalizedFeature === "media") {
    return Boolean(plan.allowImages || plan.allowAudio);
  }

  return false;
}

function getPlanLabel() {
  const planKey = getPlanKey();

  if (planKey === "professional") {
    return "Profissional";
  }

  if (planKey === "business") {
    return "Business";
  }

  return "Essencial";
}

function hasProfessionalAccess() {
  return hasActiveSubscription() && (canUseFeatureInPanel("ai") || canUseFeatureInPanel("images") || canUseFeatureInPanel("audio"));
}

function getPlanDescription() {
  return isProfessionalPlan()
    ? "IA Gemini para auxiliar, Até 3 imagens, 1 Áudio Mp3. Respostas mais Inteligentes para um Atendimento mais completo."
    : "Atendimento por texto com produtos, servicos, links e atendimento humano.";
}

function getPlanFeatures() {
  const baseFeatures = [
    "Atendimento por texto",
    "Produtos e servicos",
    "Links",
    "Atendimento humano"
  ];

  if (!isProfessionalPlan()) {
    return baseFeatures;
  }

  return [
    ...baseFeatures,
    "IA do atendimento",
    "Ate 3 imagens por produto",
    "1 audio de atendimento"
  ];
}

function getSubscriptionStatusLabel() {
  const status = normalizeSubscriptionStatus(dashboardState.tenant?.subscriptionStatus);

  if (status === "trial") {
    return "Assinatura em teste";
  }

  if (status === "inactive") {
    return "Assinatura inativa";
  }

  return "Assinatura ativa";
}

function openPlanUpgrade() {
  window.alert("Solicite o upgrade com o administrador.");
}

function getPlanDescription() {
  const plan = getCurrentPlanSettings();
  return [
    `Mensalidade de ${formatPriceMonthly(plan.priceMonthly)}`,
    plan.allowAI ? "IA liberada" : "IA bloqueada",
    plan.allowImages ? `${plan.maxImagesPerAccount} imagem(ns) por conta` : "Sem imagens",
    plan.allowAudio ? `${Math.min(plan.maxAudioPerAccount, 1)} audio(s) por conta` : "Sem audio",
    `${plan.maxCategories} categoria(s)`,
    `${plan.maxItemsPerCategory} item(ns) por categoria`
  ].join(" | ");
}

function getPlanFeatures() {
  const plan = getCurrentPlanSettings();
  const features = [
    "Atendimento por texto",
    "Produtos e servicos",
    "Links",
    "Atendimento humano",
    `Ate ${plan.maxCategories} categoria(s)`,
    `Ate ${plan.maxItemsPerCategory} item(ns) por categoria`
  ];

  if (plan.allowAI) {
    features.push("IA do atendimento");
  }

  if (plan.allowImages) {
    features.push(`${plan.maxImagesPerAccount} imagem(ns) por conta`);
    features.push(`Imagem de ate ${plan.maxImageSizeMB} MB`);
  }

  if (plan.allowAudio) {
    features.push(`${Math.min(plan.maxAudioPerAccount, 1)} audio(s) por conta`);
  }

  if (plan.allowSubcategories) {
    features.push(`Subcategorias ate ${plan.maxSubcategoriesPerCategory} por categoria`);
  }

  return features;
}

function openPlanUpgrade() {
  window.alert(getUpgradeMessage());
}

function getUsageSummary() {
  const plan = getCurrentPlanSettings();
  return {
    categories: {
      used: countUsedCategories(),
      limit: plan.maxCategories
    },
    images: {
      used: countUsedImages(),
      limit: plan.maxImagesPerAccount
    },
    audio: {
      used: countUsedAudio(),
      limit: Math.min(plan.maxAudioPerAccount, 1)
    }
  };
}

function renderUsageList(container, lines) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  lines.forEach((line) => {
    const item = document.createElement("p");
    item.className = "field-help";
    item.textContent = line;
    container.appendChild(item);
  });
}

function getPlanCardFeatureLines(planKey) {
  const plan = getAllPlanSettings()[planKey];
  const features = [
    `Mensalidade: ${formatPriceMonthly(plan.priceMonthly)}`,
    `Categorias: ate ${plan.maxCategories}`,
    `Itens por categoria: ate ${plan.maxItemsPerCategory}`,
    plan.allowAI ? "IA liberada" : "IA bloqueada",
    plan.allowImages ? `Imagens: ate ${plan.maxImagesPerAccount}` : "Imagens bloqueadas",
    plan.allowAudio ? `Audio: ate ${Math.min(plan.maxAudioPerAccount, 1)}` : "Audio bloqueado"
  ];

  if (plan.allowSubcategories) {
    features.push(`Subcategorias: ate ${plan.maxSubcategoriesPerCategory}`);
  }

  return features;
}

function ensureCategoryLimit(kind, collection) {
  const usage = countUsedCategories();
  const currentPlan = getCurrentPlanSettings();
  const isNewCategoryActivation = !collection.length;

  if (isNewCategoryActivation && usage >= currentPlan.maxCategories) {
    throw new Error(getUpgradeMessage());
  }

  if (collection.length >= currentPlan.maxItemsPerCategory) {
    throw new Error(getUpgradeMessage());
  }
}

function ensureImageLimit(nextImageCount, assets = []) {
  const currentPlan = getCurrentPlanSettings();

  if (!currentPlan.allowImages) {
    throw new Error(getUpgradeMessage());
  }

  if (nextImageCount > currentPlan.maxImagesPerAccount) {
    throw new Error(getUpgradeMessage());
  }

  const maxImageBytes = Number(currentPlan.maxImageSizeMB || 0) * 1024 * 1024;
  assets.forEach((asset) => {
    if (Number(asset?.sizeBytes || 0) > maxImageBytes) {
      throw new Error(`Cada imagem deve ter no maximo ${currentPlan.maxImageSizeMB} MB.`);
    }
  });
}

function ensureAudioLimit(nextAudioCount) {
  const currentPlan = getCurrentPlanSettings();

  if (!currentPlan.allowAudio) {
    throw new Error(getUpgradeMessage());
  }

  if (nextAudioCount > Math.min(currentPlan.maxAudioPerAccount, 1)) {
    throw new Error(getUpgradeMessage());
  }
}

function setFeedback(message) {
  dashboardElements.feedbackMessage.textContent = message || "";
}

function stopSessionPolling() {
  if (dashboardState.sessionPollTimer) {
    window.clearTimeout(dashboardState.sessionPollTimer);
    dashboardState.sessionPollTimer = null;
  }
}

function getTenantId() {
  const tenantId = KiagendaApp.normalizeTenantId(KiagendaApp.getQueryParam("id"));

  if (!tenantId) {
    throw new Error("Abra esta pagina com tenant-edit.html?id=seu-cliente.");
  }

  return tenantId;
}

function getAuthSessionForTenant(tenantId = dashboardState.tenantId) {
  const authSession = KiagendaApp.getAuthSession();
  const targetTenantId = KiagendaApp.normalizeTenantId(tenantId);
  const sessionTenantId = KiagendaApp.normalizeTenantId(authSession?.tenantId);
  return sessionTenantId && targetTenantId && sessionTenantId === targetTenantId ? authSession : null;
}

function ensureAuthenticatedAccess(tenantId = dashboardState.tenantId) {
  const authSession = getAuthSessionForTenant(tenantId);

  if (authSession && KiagendaApp.isAccountActive(authSession)) {
    return true;
  }

  window.location.replace("index.html");
  return false;
}

function getWhatsappStatusLabel(session) {
  const status = String(session?.status || "");

  if (session?.connected || status === "connected") return "Conectado";
  if (status === "qr") return "QR Code pronto";
  if (status === "authenticated") return "Conectando";
  if (status === "initializing") return "Iniciando conexao";
  if (status === "reconnecting") return "Reconectando";
  if (status === "restore_pending") return "Sessao salva, aguardando inicializacao";
  if (status === "reconnect_timeout") return "Reconexao pausada por timeout";
  if (status === "auth_failure") return "Falha na autenticacao";
  return "Desconectado";
}

function getWhatsappStatusTone(session) {
  const status = String(session?.status || "");

  if (session?.connected || status === "connected") return "positive";
  if (["qr", "authenticated", "initializing", "reconnecting", "restore_pending"].includes(status)) return "pending";
  return "negative";
}

function getBotEnabled() {
  return dashboardState.tenant?.botEnabled !== false;
}

function getBotStatusLabel() {
  return getBotEnabled() ? "Atendimento ativo" : "Atendimento pausado";
}

function getBotStatusTone() {
  return getBotEnabled() ? "positive" : "negative";
}

function getAccountWhatsappNumber() {
  return getAuthSessionForTenant()?.whatsapp || "";
}

function getGoogleLinkedSession() {
  const session = getAuthSessionForTenant();
  return session || null;
}

function isGoogleLinked() {
  const session = getGoogleLinkedSession();
  return Boolean(session?.googleLinked || session?.googleId || session?.google_id);
}

function getGoogleDisplayEmail() {
  return String(getGoogleLinkedSession()?.email || dashboardState.tenant?.email || "").trim();
}

function renderGoogleConnectionStatus() {
  const session = getGoogleLinkedSession();
  const linked = isGoogleLinked();
  const displayName = String(session?.name || dashboardState.tenant?.business?.attendantName || "Google").trim();
  const avatarUrl = String(session?.avatarUrl || "").trim();

  dashboardElements.googleAccountStatus.textContent = linked
    ? "Google conectado"
    : "Google nao conectado";
  dashboardElements.googleAccountHint.textContent = linked
    ? "Sua conta ja pode usar o botao Entrar com Google na tela de login."
    : "Conecte a mesma conta de email do seu cadastro para liberar o login com Google.";
  dashboardElements.googleAccountEmail.textContent = getGoogleDisplayEmail()
    ? `Email da conta: ${getGoogleDisplayEmail()}`
    : "Defina um email valido no seu cadastro antes de conectar o Google.";
  dashboardElements.connectGoogleButton.querySelector("span:last-child").textContent = linked
    ? "Reconectar conta Google"
    : "Conectar conta Google";

  if (avatarUrl) {
    dashboardElements.googleAccountAvatar.innerHTML = `<img src="${KiagendaApp.escapeHtml(avatarUrl)}" alt="">`;
    return;
  }

  dashboardElements.googleAccountAvatar.textContent = displayName.slice(0, 1).toUpperCase() || "G";
}

function getConnectedWhatsappNumber() {
  return (
    dashboardState.session?.connectedWhatsappNumber ||
    dashboardState.session?.number ||
    dashboardState.tenant?.whatsapp?.number ||
    ""
  );
}

function applyStatusTone(element, tone) {
  element.classList.remove("status-positive", "status-negative", "status-pending");
  element.classList.add(`status-${tone}`);
}

function applyChipTone(element, tone, label) {
  element.classList.remove("status-chip-positive", "status-chip-negative", "status-chip-pending");
  element.classList.add(`status-chip-${tone}`);
  element.textContent = label;
}

function getSavedSection() {
  const savedSection = window.localStorage.getItem(DASHBOARD_SECTION_STORAGE_KEY);
  const sectionExists = dashboardElements.panels.some((panel) => panel.dataset.section === savedSection);
  return sectionExists ? savedSection : "overview";
}

function showSection(sectionId) {
  const nextSection = dashboardElements.panels.some((panel) => panel.dataset.section === sectionId)
    ? sectionId
    : "overview";

  dashboardState.currentSection = nextSection;

  dashboardElements.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.section === nextSection);
  });

  dashboardElements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.target === nextSection);
  });

  window.localStorage.setItem(DASHBOARD_SECTION_STORAGE_KEY, nextSection);
}

function normalizePanelBotModel(botModel) {
  switch (botModel) {
    case "loja_online":
      return "loja_online";
    case "restaurante":
    case "kiagenda_delivery":
    case "delivery":
      return "delivery";
    case "barbearia":
    case "clinica":
    case "servicos_gerais":
    case "kiagenda_servicos":
    case "services_agendamento":
      return "services_agendamento";
    case "custom":
      return "custom";
    default:
      return "standard";
  }
}

function splitKeywords(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2);
}

function uniqueList(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildCatalogAliases(name) {
  const keywords = splitKeywords(name);
  const aliases = [...keywords];

  if (keywords.length > 1) {
    aliases.push(keywords.join(" "));
  }

  return uniqueList(aliases);
}

function singularizeKeyword(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized || normalized.length <= 3) {
    return normalized;
  }

  if (normalized.endsWith("s")) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function pluralizeKeyword(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return normalized;
  }

  if (normalized.endsWith("s")) {
    return normalized;
  }

  return `${normalized}s`;
}

function parseKeywordFieldValue(value) {
  return uniqueList(
    KiagendaApp.parseAliases(value).map((item) =>
      String(item || "")
        .toLowerCase()
        .trim()
    )
  );
}

function formatKeywordFieldValue(values) {
  return uniqueList(values).join(", ");
}

function buildLocalKeywordSuggestions(name) {
  const normalizedName = splitKeywords(name).join(" ");

  if (!normalizedName) {
    return [];
  }

  const rawTokens = splitKeywords(name);
  const baseTerms = uniqueList([
    normalizedName,
    ...rawTokens,
    ...rawTokens.map((item) => singularizeKeyword(item)),
    ...rawTokens.map((item) => pluralizeKeyword(item))
  ]).filter((item) => item && item.length >= 3);

  const suggestions = [];

  baseTerms.forEach((term) => {
    suggestions.push(term);
    suggestions.push(`criar ${term}`);
    suggestions.push(`fazer ${term}`);
    suggestions.push(`quero ${term}`);
    suggestions.push(`preciso de ${term}`);
  });

  return uniqueList(suggestions);
}

function getGeminiKeywordApiKey() {
  return String(
    dashboardElements.geminiApiKey?.value ||
    dashboardState.tenant?.integration?.gemini?.apiKey ||
    ""
  ).trim();
}

async function requestGeminiKeywordSuggestions(name, kind) {
  const apiKey = getGeminiKeywordApiKey();
  const model = String(
    dashboardElements.geminiModel?.value ||
    dashboardState.tenant?.integration?.gemini?.model ||
    "gemini-2.5-flash-lite"
  ).trim();

  if (!apiKey || !name) {
    return [];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  `Gere palavras-chave curtas para um ${kind === "products" ? "produto" : "servico"} chamado "${name}". ` +
                  "Retorne apenas uma lista separada por virgulas, sem explicacao. " +
                  "Inclua variacoes naturais, sinonimos simples e termos que clientes digitariam no WhatsApp."
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      })
    }
  );

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join(" ").trim() || "";

  return uniqueList(
    text
      .split(/[\n,;]/)
      .map((item) =>
        String(item || "")
          .toLowerCase()
          .replace(/^[-•\s]+/, "")
          .trim()
      )
      .filter(Boolean)
  );
}

function renderKeywordSuggestions(kind) {
  const isProduct = kind === "products";
  const isService = kind === "services";
  const container = isProduct
    ? dashboardElements.productKeywordSuggestions
    : isService
      ? dashboardElements.serviceKeywordSuggestions
      : dashboardElements.partnershipKeywordSuggestions;
  const input = isProduct
    ? dashboardElements.productKeywords
    : isService
      ? dashboardElements.serviceKeywords
      : dashboardElements.partnershipKeywords;
  const suggestions = isProduct
    ? dashboardState.productKeywordSuggestions
    : isService
      ? dashboardState.serviceKeywordSuggestions
      : dashboardState.partnershipKeywordSuggestions;

  if (!container) {
    return;
  }

  if (!suggestions.length) {
    container.innerHTML = "";
    container.classList.add("hidden-view");
    return;
  }

  const currentValues = parseKeywordFieldValue(input.value);

  container.innerHTML = suggestions
    .map((suggestion) => {
      const selectedClass = currentValues.includes(suggestion) ? " is-selected" : "";
      return `<button type="button" class="suggestion-chip${selectedClass}" data-keyword-suggestion="${KiagendaApp.escapeHtml(suggestion)}">${KiagendaApp.escapeHtml(suggestion)}</button>`;
    })
    .join("");

  container.classList.remove("hidden-view");

  Array.from(container.querySelectorAll("[data-keyword-suggestion]")).forEach((button) => {
    button.addEventListener("click", () => {
      const nextValues = uniqueList([...parseKeywordFieldValue(input.value), button.dataset.keywordSuggestion]);
      input.value = formatKeywordFieldValue(nextValues);
      renderKeywordSuggestions(kind);
    });
  });
}

async function generateKeywordSuggestions(kind) {
  const isProduct = kind === "products";
  const isService = kind === "services";
  const name = String(
    isProduct
      ? dashboardElements.productName.value
      : isService
        ? dashboardElements.serviceName.value
        : dashboardElements.partnershipName.value
  ).trim();

  if (!name) {
    throw new Error(`Informe o nome do ${isProduct ? "produto" : isService ? "servico" : "oferta"} antes de gerar sugestoes.`);
  }

  const localSuggestions = buildLocalKeywordSuggestions(name);
  let aiSuggestions = [];

  try {
    aiSuggestions = await requestGeminiKeywordSuggestions(name, kind);
  } catch (error) {
    console.error("Nao foi possivel gerar sugestoes com Gemini:", error);
  }

  const mergedSuggestions = uniqueList([...localSuggestions, ...aiSuggestions]).filter((item) => item.length >= 3);

  if (isProduct) {
    dashboardState.productKeywordSuggestions = mergedSuggestions;
  } else if (isService) {
    dashboardState.serviceKeywordSuggestions = mergedSuggestions;
  } else {
    dashboardState.partnershipKeywordSuggestions = mergedSuggestions;
  }

  renderKeywordSuggestions(kind);
  setFeedback(aiSuggestions.length ? "Sugestoes geradas com apoio da Gemini." : "Sugestoes geradas com base no nome do item.");
}

function buildLinkAliases(title) {
  const keywords = splitKeywords(title);
  const aliases = [...keywords, "link"];
  const normalizedTitle = keywords.join(" ");

  if (normalizedTitle.includes("loja")) {
    aliases.push("comprar", "site");
  }

  if (normalizedTitle.includes("instagram")) {
    aliases.push("rede social", "perfil");
  }

  if (normalizedTitle.includes("agendamento") || normalizedTitle.includes("agenda")) {
    aliases.push("agendar", "horario");
  }

  if (normalizedTitle.includes("site")) {
    aliases.push("empresa", "pagina");
  }

  return uniqueList(aliases);
}

function getBusinessName() {
  return dashboardState.tenant.business.name || "nosso negocio";
}

function getAttendantName() {
  return dashboardState.tenant.business.attendantName || "Atendimento";
}

function buildModelMessages(modelId) {
  const businessName = getBusinessName();
  const attendantName = getAttendantName();
  const activeCategories = getCatalogCategories().filter((category) => category.enabled !== false && Array.isArray(category.items) && category.items.length > 0);
  const categoryMenuLines = activeCategories
    .map((category) => `• ${category.name} (digite: ${(category.keywords || [category.name])[0] || category.name})`)
    .join("\n");
  const hasLinks = dashboardState.tenant.links.length > 0;

  const templates = {
    standard: {
      welcome:
        `Ol\u00e1! Seja bem-vindo ao ${businessName} \u2615\n\n` +
        "Sou o assistente virtual e estou aqui pra te ajudar \u{1F60A}\n\n" +
        "Voc\u00ea pode:\n\n" +
        `${categoryMenuLines ? `${categoryMenuLines}\n` : ""}` +
        `${dashboardState.tenant.links.length ? "\u2022 Acessar nossos links (digite: links)\n" : ""}` +
        "\u2022 Falar com atendimento (digite: atendimento)\n\n" +
        "\u00c9 s\u00f3 escrever o que voc\u00ea precisa \u{1F44D}",
      fallback:
        "N\u00e3o entendi muito bem \u{1F605}\n\n" +
        "Voc\u00ea pode me pedir assim:\n\n" +
        `${activeCategories.map((category) => `• ${(category.keywords || [category.name])[0] || category.name}`).join("\n")}${activeCategories.length ? "\n" : ""}` +
        `${dashboardState.tenant.links.length ? "\u2022 links\n" : ""}` +
        "\u2022 atendimento\n\n" +
        "Me diga o que voc\u00ea precisa \u{1F44D}",
      handoff:
        "Perfeito \u{1F60A}\n\n" +
        `J\u00e1 estou encaminhando voc\u00ea para o ${attendantName}.\n` +
        "Ele vai te atender em instantes \u{1F44C}"
    },
    loja_online: {
      welcome:
        `Ol\u00e1! Bem-vindo ao ${businessName}.\n\n` +
        "Posso te ajudar a ver produtos, acessar links de compra e falar com a equipe.",
      fallback:
        "N\u00e3o entendi muito bem.\n\n" +
        "Voc\u00ea pode pedir produtos, links ou atendimento.",
      handoff:
        `Perfeito! Vou encaminhar voc\u00ea para o ${attendantName} agora mesmo.`
    },
    services_agendamento: {
      welcome:
        `Ol\u00e1! Bem-vindo ao ${businessName}.\n\n` +
        "Posso te mostrar servicos, orientar seu agendamento e falar com a equipe.",
      fallback:
        "N\u00e3o entendi muito bem.\n\n" +
        "Voc\u00ea pode pedir servicos, links ou atendimento.",
      handoff:
        `Perfeito! Vou chamar o ${attendantName} para continuar com voc\u00ea.`
    },
    delivery: {
      welcome:
        `Ol\u00e1! Bem-vindo ao ${businessName}.\n\n` +
        "Posso te mostrar o cardapio, os links de pedido, orientar sobre entrega ou retirada e te ajudar com o atendimento.",
      fallback:
        "N\u00e3o entendi muito bem.\n\n" +
        "Voc\u00ea pode pedir cardapio, pedido, entrega, retirada ou atendimento.",
      handoff:
        `Perfeito! J\u00e1 estou chamando o ${attendantName} para te atender.`
    }
  };

  if (modelId === "loja_online" && !hasLinks) {
    templates.loja_online.welcome =
      `Ol\u00e1! Bem-vindo ao ${businessName}.\n\n` +
      "Posso te ajudar com as categorias do seu menu e falar com a equipe para fechar seu pedido.";
  }

  if (modelId === "services_agendamento" && !hasLinks) {
    templates.services_agendamento.welcome =
      `Ol\u00e1! Bem-vindo ao ${businessName}.\n\n` +
      "Posso te mostrar as categorias cadastradas e falar com a equipe para ajudar com seu agendamento.";
  }

  if (modelId === "delivery" && !hasLinks) {
    templates.delivery.welcome =
      `Ol\u00e1! Bem-vindo ao ${businessName}.\n\n` +
      "Posso te mostrar o cardapio, orientar sobre entrega ou retirada e te ajudar com o atendimento.";
  }

  return templates[modelId] || templates.standard;
}

function buildBotOptionPreview(modelId) {
  const categories = getCatalogCategories();
  const hasLinks = dashboardState.tenant.links.length > 0;

  return [
    ...categories.map((category) => ({
      label: category.name,
      available: category.enabled !== false && Array.isArray(category.items) && category.items.length > 0,
      hint: Array.isArray(category.items) && category.items.length
        ? "Mostra os itens cadastrados nessa categoria."
        : "Cadastre itens para ativar esta categoria."
    })),
    ...(hasLinks ? [{
      label: "Links importantes",
      available: true,
      hint: "Mostra links importantes do negocio."
    }] : [{
      label: "Links importantes",
      available: false,
      hint: "Cadastre links para ativar esta opcao."
    }]),
    {
      label: "Falar com atendimento",
      available: true,
      hint: "Encaminha o cliente para atendimento."
    }
  ];
}

function buildAutomaticMenu(modelId) {
  const items = [];
  const categories = getCatalogCategories()
    .filter((category) => category.enabled !== false && Array.isArray(category.items) && category.items.length)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  const hasLinks = dashboardState.tenant.links.length > 0;

  categories.forEach((category) => {
    items.push({
      id: `menu_${category.id}`,
      label: category.name,
      type: "custom",
      enabled: true,
      linkId: "",
      aliases: Array.isArray(category.keywords) ? category.keywords : []
    });
  });

  if (hasLinks) {
    items.push({
      id: "menu_links",
      label: modelId === "delivery" ? "Links de pedido" : "Links importantes",
      type: "links",
      enabled: true,
      linkId: "",
      aliases: modelId === "services_agendamento"
        ? ["links", "agendamento", "agenda"]
        : modelId === "delivery"
          ? ["pedido", "links", "delivery"]
          : ["links", "site", "acesso"]
    });
  }

  if (modelId === "delivery") {
    items.push({
      id: "menu_entrega",
      label: "Entrega ou retirada",
      type: "custom",
      enabled: true,
      linkId: "",
      aliases: ["entrega", "retirada", "receber", "buscar"],
      customReply: "Posso te orientar sobre entrega ou retirada. Se quiser confirmar a melhor opcao agora, digite atendimento."
    });
  }

  items.push({
    id: "menu_atendimento",
    label: "Falar com atendimento",
    type: "handoff",
    enabled: true,
    linkId: "",
    aliases: ["atendimento", "humano", "atendente"]
  });

  return items;
}

function getMenuTypeLabel(type) {
  switch (type) {
    case "products":
      return "Mostrar produtos";
    case "services":
      return "Mostrar servicos";
    case "links":
      return "Mostrar links";
    case "handoff":
      return "Falar com atendimento";
    case "customReply":
      return "Resposta personalizada";
    default:
      return "Resposta personalizada";
  }
}

function getMenuActionDescription(item) {
  const firstTrigger = (item.keywords && item.keywords[0]) || item.label || "essa opcao";

  switch (item.actionType) {
    case "products":
      return `Quando o cliente digitar ${firstTrigger}, o atendimento automatico mostra os produtos cadastrados.`;
    case "services":
      return `Quando o cliente digitar ${firstTrigger}, o atendimento automatico mostra os servicos cadastrados.`;
    case "links":
      return `Quando o cliente digitar ${firstTrigger}, o atendimento automatico mostra os links importantes.`;
    case "handoff":
      return `Quando o cliente digitar ${firstTrigger}, o atendimento automatico chama o atendimento.`;
    case "customReply":
      return `Quando o cliente digitar ${firstTrigger}, o atendimento automatico envia a resposta personalizada abaixo.`;
    default:
      return `Quando o cliente digitar ${firstTrigger}, o atendimento automatico executa essa opcao personalizada.`;
  }
}

function resetMenuForm() {
  dashboardState.editingMenuId = "";
  dashboardElements.menuLabel.value = "";
  dashboardElements.menuType.value = "customReply";
  dashboardElements.menuAliases.value = "";
  dashboardElements.menuCustomReply.value = "";
  dashboardElements.menuCustomReplyField.classList.remove("hidden-view");
  dashboardElements.addMenuButton.textContent = "Adicionar opcao";
  dashboardElements.cancelMenuEditButton.classList.add("hidden-view");
}

function toggleAdvancedMenu(forceOpen) {
  dashboardState.advancedMenuOpen = typeof forceOpen === "boolean" ? forceOpen : !dashboardState.advancedMenuOpen;
  dashboardElements.advancedMenuPanel.classList.toggle("hidden-view", !dashboardState.advancedMenuOpen);
  dashboardElements.toggleAdvancedMenuButton.textContent = dashboardState.advancedMenuOpen
    ? "Esconder opcoes extras"
    : "Mostrar opcoes extras";
}

function getEffectiveMessages() {
  if (dashboardState.tenant.botModel === "custom") {
    return {
      welcome: dashboardState.tenant.messages.welcome || buildModelMessages("standard").welcome,
      fallback: dashboardState.tenant.messages.fallback || buildModelMessages("standard").fallback,
      handoff: dashboardState.tenant.messages.handoff || buildModelMessages("standard").handoff,
      audio: dashboardState.tenant.messages.audio || null
    };
  }

  return {
    ...buildModelMessages(dashboardState.tenant.botModel),
    audio: dashboardState.tenant.messages.audio || null
  };
}

function resetMessageEditors() {
  dashboardState.editingMessageType = "";
  dashboardElements.welcomePreview.classList.remove("hidden-view");
  dashboardElements.fallbackPreview.classList.remove("hidden-view");
  dashboardElements.handoffPreview.classList.remove("hidden-view");
  dashboardElements.editWelcomeMessageButton.classList.remove("hidden-view");
  dashboardElements.editFallbackMessageButton.classList.remove("hidden-view");
  dashboardElements.editHandoffMessageButton.classList.remove("hidden-view");
  dashboardElements.welcomeEditor.classList.add("hidden-view");
  dashboardElements.fallbackEditor.classList.add("hidden-view");
  dashboardElements.handoffEditor.classList.add("hidden-view");
  clearFileInput(dashboardElements.messageAudio);
}

function startMessageEdit(messageType) {
  const defaults = buildModelMessages(dashboardState.tenant.botModel === "custom" ? "standard" : dashboardState.tenant.botModel);
  resetMessageEditors();
  dashboardState.editingMessageType = messageType;

  if (messageType === "welcome") {
    dashboardElements.welcomePreview.classList.add("hidden-view");
    dashboardElements.editWelcomeMessageButton.classList.add("hidden-view");
    dashboardElements.welcomeMessage.value = dashboardState.tenant.messages.welcome || defaults.welcome || "";
    dashboardElements.welcomeEditor.classList.remove("hidden-view");
    dashboardElements.welcomeMessage.focus();
    return;
  }

  if (messageType === "fallback") {
    dashboardElements.fallbackPreview.classList.add("hidden-view");
    dashboardElements.editFallbackMessageButton.classList.add("hidden-view");
    dashboardElements.fallbackMessage.value = dashboardState.tenant.messages.fallback || defaults.fallback || "";
    dashboardElements.fallbackEditor.classList.remove("hidden-view");
    dashboardElements.fallbackMessage.focus();
    return;
  }

  dashboardElements.handoffPreview.classList.add("hidden-view");
  dashboardElements.editHandoffMessageButton.classList.add("hidden-view");
  dashboardElements.handoffMessage.value = dashboardState.tenant.messages.handoff || defaults.handoff || "";
  setMediaStatus(
    dashboardElements.messageAudioStatus,
    dashboardState.tenant.messages.audio,
    "Opcional. Esse audio sera enviado junto com o atendimento humano."
  );
  dashboardElements.messageAudioField.classList.toggle("hidden-view", !canUseFeatureInPanel("audio"));
  dashboardElements.messageAudioLockNotice.classList.toggle("hidden-view", canUseFeatureInPanel("audio"));
  dashboardElements.handoffEditor.classList.remove("hidden-view");
  dashboardElements.handoffMessage.focus();
}

async function saveMessageEdit(messageType) {
  if (messageType === "welcome") {
    dashboardState.tenant.messages.welcome = dashboardElements.welcomeMessage.value.trim();
  } else if (messageType === "fallback") {
    dashboardState.tenant.messages.fallback = dashboardElements.fallbackMessage.value.trim();
  } else if (messageType === "handoff") {
    dashboardState.tenant.messages.handoff = dashboardElements.handoffMessage.value.trim();

    if (canUseFeatureInPanel("audio")) {
      const audioFile = dashboardElements.messageAudio?.files?.[0] || null;

      if (audioFile) {
        if (audioFile.type !== "audio/mpeg") {
          throw new Error("O audio de atendimento precisa estar em formato MP3.");
        }

        ensureAudioLimit(audioFile ? 1 : countUsedAudio());
        dashboardState.tenant.messages.audio = await readMediaFile(audioFile, "audio/");
      }
    } else {
      dashboardState.tenant.messages.audio = null;
    }
  }

  dashboardState.tenant.botModel = "custom";
  dashboardElements.botModelSelect.value = "custom";
  resetMessageEditors();
  renderBot();
}

function setCatalogTab(tabId) {
  dashboardState.activeCatalogTab = ["services", "partnerships"].includes(tabId) ? tabId : "products";
  dashboardElements.showProductsTabButton.classList.toggle("active", dashboardState.activeCatalogTab === "products");
  dashboardElements.showServicesTabButton.classList.toggle("active", dashboardState.activeCatalogTab === "services");
  dashboardElements.showPartnershipsTabButton.classList.toggle("active", dashboardState.activeCatalogTab === "partnerships");
  dashboardElements.productsPanel.classList.toggle("active", dashboardState.activeCatalogTab === "products");
  dashboardElements.servicesPanel.classList.toggle("active", dashboardState.activeCatalogTab === "services");
  dashboardElements.partnershipsPanel.classList.toggle("active", dashboardState.activeCatalogTab === "partnerships");
}

function setMediaStatus(statusElement, asset, emptyLabel = "Opcional") {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = asset?.fileName
    ? `Arquivo atual: ${asset.fileName}`
    : emptyLabel;
}

function setMediaListStatus(statusElement, assets = [], emptyLabel = "Opcional") {
  if (!statusElement) {
    return;
  }

  const validAssets = Array.isArray(assets) ? assets.filter(Boolean) : [];

  if (!validAssets.length) {
    statusElement.textContent = emptyLabel;
    return;
  }

  const fileNames = validAssets
    .map((asset) => asset?.fileName)
    .filter(Boolean)
    .join(", ");

  statusElement.textContent = fileNames
    ? `Arquivos atuais: ${fileNames}`
    : `${validAssets.length} imagem(ns) cadastrada(s)`;
}

function clearFileInput(inputElement) {
  if (inputElement) {
    inputElement.value = "";
  }
}

function resetProductForm() {
  dashboardState.editingProductId = "";
  dashboardState.productKeywordSuggestions = [];
  dashboardElements.productName.value = "";
  dashboardElements.productPrice.value = "";
  dashboardElements.productDescription.value = "";
  dashboardElements.productLink.value = "";
  dashboardElements.productKeywords.value = "";
  clearFileInput(dashboardElements.productImages);
  setMediaListStatus(dashboardElements.productImagesStatus, []);
  dashboardElements.addProductButton.textContent = "Adicionar produto";
  dashboardElements.cancelProductEditButton.classList.add("hidden-view");
  renderKeywordSuggestions("products");
}

function resetServiceForm() {
  dashboardState.editingServiceId = "";
  dashboardState.serviceKeywordSuggestions = [];
  dashboardElements.serviceName.value = "";
  dashboardElements.servicePrice.value = "";
  dashboardElements.serviceDescription.value = "";
  dashboardElements.serviceLink.value = "";
  dashboardElements.serviceKeywords.value = "";
  clearFileInput(dashboardElements.serviceImage);
  setMediaStatus(dashboardElements.serviceImageStatus, null);
  dashboardElements.addServiceButton.textContent = "Adicionar servico";
  dashboardElements.cancelServiceEditButton.classList.add("hidden-view");
  renderKeywordSuggestions("services");
}

function resetPartnershipForm() {
  dashboardState.editingPartnershipId = "";
  dashboardState.partnershipKeywordSuggestions = [];
  dashboardElements.partnershipName.value = "";
  dashboardElements.partnershipPrice.value = "";
  dashboardElements.partnershipDescription.value = "";
  dashboardElements.partnershipLink.value = "";
  dashboardElements.partnershipKeywords.value = "";
  dashboardElements.addPartnershipButton.textContent = "Adicionar oferta";
  dashboardElements.cancelPartnershipEditButton.classList.add("hidden-view");
  renderKeywordSuggestions("partnerships");
}

function resetLinkForm() {
  dashboardState.editingLinkId = "";
  dashboardElements.linkTitle.value = "";
  dashboardElements.linkUrl.value = "";
  dashboardElements.linkDescription.value = "";
  dashboardElements.addLinkButton.textContent = "Adicionar link";
  dashboardElements.cancelLinkEditButton.classList.add("hidden-view");
}

function resetPasswordForm() {
  dashboardElements.newPassword.value = "";
  dashboardElements.confirmNewPassword.value = "";
}

function renderQrPanel() {
  const qrValue = dashboardState.session?.qr || dashboardState.session?.qrCode || "";

  if (!qrValue) {
    const status = String(dashboardState.session?.status || "");
    const waitingMessage = status === "initializing" || status === "authenticated"
      ? "A conexao esta sendo preparada. O status sera atualizado automaticamente em alguns segundos."
      : "O QR Code vai aparecer aqui quando a conexao for iniciada.";
    dashboardElements.whatsappQrPanel.innerHTML = `<p class="muted-copy">${waitingMessage}</p>`;
    return;
  }

  if (String(qrValue).startsWith("data:image")) {
    dashboardElements.whatsappQrPanel.innerHTML = `<img class="qr-image" src="${qrValue}" alt="QR Code do WhatsApp">`;
    return;
  }

  dashboardElements.whatsappQrPanel.innerHTML = `<pre class="qr-raw">${KiagendaApp.escapeHtml(qrValue)}</pre>`;
}

function syncMenuLinkSelect() {
  return;
}

function renderListActions(onEdit, onRemove) {
  const actions = document.createElement("div");
  actions.className = "item-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "neutral-button";
  editButton.textContent = "Editar";
  editButton.addEventListener("click", onEdit);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "danger-button";
  removeButton.textContent = "Remover";
  removeButton.addEventListener("click", onRemove);

  actions.appendChild(editButton);
  actions.appendChild(removeButton);
  return actions;
}

function renderCatalogList(container, items, kind) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = '<li class="item-card"><p>Nada cadastrado ainda.</p></li>';
    return;
  }

  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = "item-card";
    const imageCount = Array.isArray(item.images) ? item.images.filter(Boolean).length : item.image ? 1 : 0;
    const mediaBadges = [
      imageCount ? `<span class="mini-badge">${imageCount} imagem(ns)</span>` : "",
      item.audio ? '<span class="mini-badge">Audio MP3</span>' : ""
    ].filter(Boolean).join("");
    listItem.innerHTML = `
      <div>
        <h4>${KiagendaApp.escapeHtml(item.name || "Sem nome")}</h4>
        <p>${KiagendaApp.escapeHtml(item.price || "")}</p>
        <p>${KiagendaApp.escapeHtml(item.description || "")}</p>
        <p>${KiagendaApp.escapeHtml(item.link || "")}</p>
        ${mediaBadges ? `<div class="mini-badge-row">${mediaBadges}</div>` : ""}
      </div>
    `;

    listItem.appendChild(renderListActions(
      () => startCatalogEdit(kind, item.id),
      () => removeCatalogItem(kind, item.id)
    ));

    container.appendChild(listItem);
  });
}

function getOrCreateDynamicCategoriesManager() {
  let manager = document.getElementById("dynamicCategoriesManager");

  if (manager) {
    return manager;
  }

  const productsSection = document.querySelector('[data-section="products"] .section-card');

  if (!productsSection) {
    return null;
  }

  manager = document.createElement("div");
  manager.id = "dynamicCategoriesManager";
  const referenceNode = productsSection.querySelector(".tab-switch");
  productsSection.insertBefore(manager, referenceNode || null);
  return manager;
}

function removeLegacyCatalogMarkup() {
  const productsSection = document.querySelector('[data-section="products"] .section-card');

  if (!productsSection) {
    return;
  }

  productsSection.querySelectorAll(".tab-switch, .catalog-panel").forEach((node) => {
    if (node?.parentNode) {
      node.parentNode.removeChild(node);
    }
  });
}

function setActiveCategory(categoryId) {
  dashboardState.activeCategoryId = categoryId;
  dashboardState.editingCategoryItemId = "";
}

function getActiveCategory() {
  const categories = getCatalogCategories();

  if (!categories.length) {
    return null;
  }

  if (!dashboardState.activeCategoryId || !findCategoryById(dashboardState.activeCategoryId)) {
    dashboardState.activeCategoryId = categories[0].id;
  }

  return findCategoryById(dashboardState.activeCategoryId);
}

function createCategory() {
  const currentPlan = getCurrentPlanSettings();
  const categories = getCatalogCategories();

  if (categories.length >= currentPlan.maxCategories) {
    throw new Error(getUpgradeMessage());
  }

  const nextCategory = {
    id: `category_${Date.now()}`,
    name: `Nova categoria ${categories.length + 1}`,
    keywords: [],
    type: "catalog",
    enabled: true,
    order: categories.length,
    legacyKey: "",
    customReply: "",
    items: []
  };

  dashboardState.tenant.categories.push(nextCategory);
  setActiveCategory(nextCategory.id);
  renderCatalog();
}

function updateActiveCategoryFromForm() {
  const category = getActiveCategory();

  if (!category) {
    return;
  }

  const nameInput = document.getElementById("dynamicCategoryName");
  const keywordsInput = document.getElementById("dynamicCategoryKeywords");
  const enabledInput = document.getElementById("dynamicCategoryEnabled");

  category.name = nameInput?.value.trim() || category.name;
  category.keywords = KiagendaApp.parseAliases(keywordsInput?.value || "");
  category.enabled = Boolean(enabledInput?.checked);

  renderCatalog();
}

function removeActiveCategory() {
  const category = getActiveCategory();

  if (!category) {
    return;
  }

  dashboardState.tenant.categories = dashboardState.tenant.categories.filter((entry) => entry.id !== category.id);
  dashboardState.activeCategoryId = getCatalogCategories()[0]?.id || "";
  dashboardState.editingCategoryItemId = "";
  syncLegacyCatalogCollectionsFromCategories();
  renderCatalog();
}

function startCategoryItemEdit(itemId) {
  dashboardState.editingCategoryItemId = itemId;
  renderCatalog();
}

function removeCategoryItem(itemId) {
  const category = getActiveCategory();

  if (!category) {
    return;
  }

  category.items = (category.items || []).filter((item) => item.id !== itemId);
  dashboardState.editingCategoryItemId = "";
  syncLegacyCatalogCollectionsFromCategories();
  renderAll();
}

async function upsertActiveCategoryItem() {
  const category = getActiveCategory();

  if (!category) {
    throw new Error("Selecione uma categoria.");
  }

  const currentPlan = getCurrentPlanSettings();
  const existingItems = Array.isArray(category.items) ? category.items : [];
  const existingItem = existingItems.find((item) => item.id === dashboardState.editingCategoryItemId) || null;

  if (!existingItem && existingItems.length >= currentPlan.maxItemsPerCategory) {
    throw new Error(getUpgradeMessage());
  }

  let images = Array.isArray(existingItem?.images) ? existingItem.images : [];
  let image = existingItem?.image || null;
  let imageUrls = Array.isArray(existingItem?.imageUrls) ? existingItem.imageUrls : [];
  const imageInput = document.getElementById("dynamicCategoryItemImages");

  if (canUseFeatureInPanel("images") && imageInput?.files?.length) {
    images = await readMediaFileList(imageInput.files, "image/", 3);
    image = images[0] || null;
    imageUrls = images.map((asset) => asset.dataUrl).filter(Boolean);
    const currentItemImages = Array.isArray(existingItem?.images) ? existingItem.images.filter(Boolean).length : existingItem?.image ? 1 : 0;
    ensureImageLimit(countUsedImages() - currentItemImages + images.length, images);
  }

  const nextItem = {
    id: dashboardState.editingCategoryItemId || `category_item_${Date.now()}`,
    name: document.getElementById("dynamicCategoryItemName")?.value.trim() || "",
    offer: document.getElementById("dynamicCategoryItemOffer")?.value.trim() || "",
    price: document.getElementById("dynamicCategoryItemPrice")?.value.trim() || "",
    description: document.getElementById("dynamicCategoryItemDescription")?.value.trim() || "",
    link: document.getElementById("dynamicCategoryItemLink")?.value.trim() || "",
    aliases: existingItem?.aliases || [],
    keywords: KiagendaApp.parseAliases(document.getElementById("dynamicCategoryItemKeywords")?.value || ""),
    imageUrls,
    images,
    image,
    audio: null
  };

  if (!nextItem.name) {
    throw new Error("Informe o nome do item.");
  }

  const existingIndex = existingItems.findIndex((item) => item.id === nextItem.id);

  if (existingIndex >= 0) {
    existingItems[existingIndex] = nextItem;
  } else {
    existingItems.push(nextItem);
  }

  category.items = existingItems;
  dashboardState.editingCategoryItemId = "";
  syncLegacyCatalogCollectionsFromCategories();
  renderAll();
}

function getEditingCategoryItem() {
  const category = getActiveCategory();
  return (category?.items || []).find((item) => item.id === dashboardState.editingCategoryItemId) || null;
}

function renderDynamicCategoriesManager() {
  ensureTenantCategories();
  removeLegacyCatalogMarkup();
  const manager = getOrCreateDynamicCategoriesManager();

  if (!manager) {
    return;
  }

  document.querySelectorAll('.dashboard-nav-button[data-target="products"]').forEach((button) => {
    button.textContent = "Menu do Atendimento";
  });
  const productsSection = document.querySelector('[data-section="products"]');
  productsSection?.querySelector(".eyebrow")?.replaceChildren(document.createTextNode("Menu do Atendimento"));
  const productsTitle = productsSection?.querySelector("h3");
  if (productsTitle) {
    productsTitle.textContent = "Organize as categorias e ofertas do seu atendimento";
  }
  const productsCopy = productsSection?.querySelector(".muted-copy");
  if (productsCopy) {
    productsCopy.textContent = "Crie categorias dinamicas, ajuste palavras-chave e cadastre os itens que o bot deve apresentar automaticamente.";
  }
  const overviewCatalogLabel = dashboardElements.overviewCatalogCount?.parentElement?.querySelector("span");
  if (overviewCatalogLabel) {
    overviewCatalogLabel.textContent = "Menu do Atendimento";
  }

  const categories = getCatalogCategories();
  const activeCategory = getActiveCategory();
  const editingItem = getEditingCategoryItem();
  const currentPlan = getCurrentPlanSettings();
  const showMediaFields = canUseFeatureInPanel("images");
  manager.innerHTML = `
    <div class="section-subcard">
      <div class="section-subcard-header">
        <div>
          <h4>Menu do Atendimento</h4>
          <p class="muted-copy">Categorias editaveis, palavras-chave e itens/ofertas do bot.</p>
        </div>
        <button id="dynamicAddCategoryButton" class="secondary-button" type="button">Criar categoria</button>
      </div>
      <div class="mini-badge-row">
        ${categories.map((category) => `<button class="tab-switch-button ${activeCategory?.id === category.id ? "active" : ""}" type="button" data-dynamic-category-tab="${category.id}">${KiagendaApp.escapeHtml(category.name)}</button>`).join("")}
      </div>
    </div>
    ${activeCategory ? `
      <div class="section-subcard">
        <h4>Configuracoes da categoria</h4>
        <p class="field-help">Itens usados: ${(activeCategory.items || []).length} de ${currentPlan.maxItemsPerCategory}. Categorias criadas: ${categories.length} de ${currentPlan.maxCategories}.</p>
        <div class="field-grid">
          <label>Nome<input id="dynamicCategoryName" type="text" value="${KiagendaApp.escapeHtml(activeCategory.name || "")}"></label>
          <label>Palavras-chave<input id="dynamicCategoryKeywords" type="text" value="${KiagendaApp.escapeHtml((activeCategory.keywords || []).join(", "))}" placeholder="Ex.: revenda, parceria, distribuidor"></label>
          <label class="toggle-field"><span>Categoria ativa</span><input id="dynamicCategoryEnabled" type="checkbox" ${activeCategory.enabled !== false ? "checked" : ""}></label>
        </div>
        <div class="button-row">
          <button id="dynamicSaveCategoryButton" class="primary-button" type="button">Salvar categoria</button>
          <button id="dynamicRemoveCategoryButton" class="danger-button" type="button">Remover categoria</button>
        </div>
      </div>
      <div class="section-subcard">
        <h4>Adicionar item na categoria selecionada</h4>
        <div class="field-grid">
          <label>Nome<input id="dynamicCategoryItemName" type="text" value="${KiagendaApp.escapeHtml(editingItem?.name || "")}"></label>
          <label>Oferta<input id="dynamicCategoryItemOffer" type="text" value="${KiagendaApp.escapeHtml(editingItem?.offer || "")}" placeholder="Ex.: Condicao especial"></label>
          <label>Preco<input id="dynamicCategoryItemPrice" type="text" value="${KiagendaApp.escapeHtml(editingItem?.price || "")}" placeholder="Ex.: R$ 120,00"></label>
          <label class="full-width">Descricao<textarea id="dynamicCategoryItemDescription">${KiagendaApp.escapeHtml(editingItem?.description || "")}</textarea></label>
          <label class="full-width">Link<input id="dynamicCategoryItemLink" type="text" value="${KiagendaApp.escapeHtml(editingItem?.link || "")}" placeholder="https://"></label>
          <label class="full-width">Palavras-chave<input id="dynamicCategoryItemKeywords" type="text" value="${KiagendaApp.escapeHtml((editingItem?.keywords || []).join(", "))}" placeholder="Ex.: revenda, parceria, distribuidor"></label>
          ${showMediaFields ? `<label class="full-width">Imagens do item<input id="dynamicCategoryItemImages" type="file" accept="image/*" multiple><span class="field-help">${editingItem?.imageUrls?.length ? `${editingItem.imageUrls.length} imagem(ns) atual(is).` : "Opcional. Envie ate 3 imagens."}</span></label>` : ""}
        </div>
        <div class="button-row">
          <button id="dynamicSaveCategoryItemButton" class="primary-button" type="button">${editingItem ? "Salvar item" : "Adicionar item"}</button>
          ${editingItem ? '<button id="dynamicCancelCategoryItemEditButton" class="neutral-button" type="button">Cancelar edicao</button>' : ""}
        </div>
      </div>
      <div class="section-subcard">
        <h4>Itens da categoria</h4>
        <ul class="item-list">
          ${(activeCategory.items || []).length ? (activeCategory.items || []).map((item) => `
            <li class="item-card">
              <div>
                <h4>${KiagendaApp.escapeHtml(item.name || "Sem nome")}</h4>
                <p>${KiagendaApp.escapeHtml(item.offer || item.price || "")}</p>
                <p>${KiagendaApp.escapeHtml(item.description || "")}</p>
                <p>${KiagendaApp.escapeHtml(item.link || "")}</p>
              </div>
              <div class="item-actions">
                <button class="neutral-button" type="button" data-dynamic-edit-item="${item.id}">Editar</button>
                <button class="danger-button" type="button" data-dynamic-remove-item="${item.id}">Remover</button>
              </div>
            </li>
          `).join("") : '<li class="item-card"><p>Nenhum item cadastrado ainda.</p></li>'}
        </ul>
      </div>
    ` : '<div class="section-subcard"><p class="muted-copy">Crie a primeira categoria para montar o menu do atendimento.</p></div>'}
  `;

  document.querySelectorAll("[data-dynamic-category-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveCategory(button.dataset.dynamicCategoryTab);
      renderCatalog();
    });
  });

  document.getElementById("dynamicAddCategoryButton")?.addEventListener("click", () => runAction(createCategory));
  document.getElementById("dynamicSaveCategoryButton")?.addEventListener("click", () => runAction(updateActiveCategoryFromForm));
  document.getElementById("dynamicRemoveCategoryButton")?.addEventListener("click", () => runAction(removeActiveCategory));
  document.getElementById("dynamicSaveCategoryItemButton")?.addEventListener("click", () => runAction(upsertActiveCategoryItem));
  document.getElementById("dynamicCancelCategoryItemEditButton")?.addEventListener("click", () => {
    dashboardState.editingCategoryItemId = "";
    renderCatalog();
  });
  document.querySelectorAll("[data-dynamic-edit-item]").forEach((button) => {
    button.addEventListener("click", () => startCategoryItemEdit(button.dataset.dynamicEditItem));
  });
  document.querySelectorAll("[data-dynamic-remove-item]").forEach((button) => {
    button.addEventListener("click", () => removeCategoryItem(button.dataset.dynamicRemoveItem));
  });
}

function renderLinksList() {
  dashboardElements.linksList.innerHTML = "";

  if (!dashboardState.tenant.links.length) {
    dashboardElements.linksList.innerHTML = '<li class="item-card"><p>Nenhum link cadastrado ainda.</p></li>';
    return;
  }

  dashboardState.tenant.links.forEach((link) => {
    const listItem = document.createElement("li");
    listItem.className = "item-card";
    listItem.innerHTML = `
      <div>
        <h4>${KiagendaApp.escapeHtml(link.title || "Sem titulo")}</h4>
        <p>${KiagendaApp.escapeHtml(link.url || "")}</p>
        <p>${KiagendaApp.escapeHtml(link.description || "")}</p>
      </div>
    `;

    listItem.appendChild(renderListActions(
      () => startLinkEdit(link.id),
      () => removeLink(link.id)
    ));

    dashboardElements.linksList.appendChild(listItem);
  });
}

function renderMenuList() {
  dashboardElements.menuOptionsList.innerHTML = "";
  const menuItems = dashboardState.tenant.advancedOptions || [];

  if (!menuItems.length) {
    dashboardElements.menuOptionsList.innerHTML = '<p class="empty-copy">Nenhuma opcao cadastrada ainda.</p>';
    return;
  }

  menuItems.forEach((item) => {
    const row = document.createElement("article");
    row.className = "menu-config-card";
    row.innerHTML = `
      <div>
        <strong>${KiagendaApp.escapeHtml(item.label)}</strong>
        <span>${KiagendaApp.escapeHtml(getMenuActionDescription(item))}</span>
        <span><strong>Palavras que ativam:</strong> ${KiagendaApp.escapeHtml((item.keywords || []).join(", ") || item.label || "-")}</span>
        <span><strong>Tipo de resposta:</strong> ${KiagendaApp.escapeHtml(getMenuTypeLabel(item.actionType))}</span>
        ${item.actionType === "customReply" && item.customReply ? `<span><strong>Resposta personalizada:</strong> ${KiagendaApp.escapeHtml(item.customReply)}</span>` : ""}
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "neutral-button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => {
      dashboardState.editingMenuId = item.id;
      dashboardElements.menuLabel.value = item.label || "";
      dashboardElements.menuType.value = item.actionType || "customReply";
      dashboardElements.menuAliases.value = (item.keywords || []).join(", ");
      dashboardElements.menuCustomReply.value = item.customReply || "";
      dashboardElements.menuCustomReplyField.classList.toggle("hidden-view", item.actionType !== "customReply");
      dashboardElements.addMenuButton.textContent = "Salvar alteracoes";
      dashboardElements.cancelMenuEditButton.classList.remove("hidden-view");
      toggleAdvancedMenu(true);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "danger-button";
    removeButton.textContent = "Remover";
    removeButton.addEventListener("click", () => {
      dashboardState.tenant.advancedOptions = (dashboardState.tenant.advancedOptions || []).filter((menuItem) => menuItem.id !== item.id);
      if (dashboardState.editingMenuId === item.id) {
        resetMenuForm();
      }
      renderAll();
    });

    actions.appendChild(editButton);
    actions.appendChild(removeButton);
    row.appendChild(actions);
    dashboardElements.menuOptionsList.appendChild(row);
  });
}

function renderOverview() {
  const sessionLabel = getWhatsappStatusLabel(dashboardState.session);
  const sessionTone = getWhatsappStatusTone(dashboardState.session);
  const totalCatalog = getCatalogCategories().reduce((total, category) => total + (category.items || []).length, 0);
  const botActive = getBotEnabled();
  const usage = getUsageSummary();

  dashboardElements.overviewWhatsappStatus.textContent = sessionLabel;
  applyStatusTone(dashboardElements.overviewWhatsappStatus, sessionTone);
  dashboardElements.overviewCatalogCount.textContent = String(totalCatalog);
  dashboardElements.overviewLinksCount.textContent = String(dashboardState.tenant.links.length);
  dashboardElements.overviewBotStatus.textContent = botActive ? "Ativo" : "Pausado";
  dashboardElements.overviewBotStatus.className = botActive ? "status-positive" : "status-negative";
  dashboardElements.overviewBotToggleButton.textContent = botActive ? "Pausar atendimento" : "Ativar atendimento";
  dashboardElements.overviewPlanBadge.textContent = getPlanLabel();
  dashboardElements.planFeaturesList.innerHTML = "";
  getPlanFeatures().forEach((feature) => {
    const badge = document.createElement("span");
    badge.className = "mini-badge";
    badge.textContent = feature;
    dashboardElements.planFeaturesList.appendChild(badge);
  });
  renderUsageList(dashboardElements.planUsageList, [
    `Voce usou ${usage.categories.used} de ${usage.categories.limit} categorias`,
    `Voce usou ${usage.images.used} de ${usage.images.limit} imagens`,
    `Voce usou ${usage.audio.used} de ${usage.audio.limit} audio(s)`
  ]);
}

function renderHeader() {
  const businessName = dashboardState.tenant.business.name || dashboardState.tenant.tenantId;
  const statusLabel = `WhatsApp ${getWhatsappStatusLabel(dashboardState.session).toLowerCase()}`;
  const statusTone = getWhatsappStatusTone(dashboardState.session);
  const botStatusLabel = getBotStatusLabel();
  const botStatusTone = getBotStatusTone();

  dashboardElements.sidebarBusinessName.textContent = businessName;
  dashboardElements.headerBusinessName.textContent = businessName;
  applyChipTone(dashboardElements.headerWhatsappBadge, statusTone, statusLabel);
  applyChipTone(dashboardElements.headerBotBadge, botStatusTone, botStatusLabel);
}

function renderWhatsapp() {
  dashboardElements.whatsappStatus.textContent = getWhatsappStatusLabel(dashboardState.session);
  applyStatusTone(dashboardElements.whatsappStatus, getWhatsappStatusTone(dashboardState.session));
  dashboardElements.accountWhatsappNumber.value = getAccountWhatsappNumber();
  dashboardElements.connectedWhatsappNumber.value = getConnectedWhatsappNumber();
  dashboardElements.whatsappSessionId.value =
    dashboardState.tenant.whatsapp.sessionId || dashboardState.session?.sessionId || `${dashboardState.tenantId}-session`;
  renderQrPanel();
}

function renderBot() {
  const modelId = dashboardState.tenant.botModel || "standard";
  const messages = getEffectiveMessages();
  const autoMenuPreview = buildBotOptionPreview(modelId);
  const botEnabled = getBotEnabled();

  dashboardElements.botModelSelect.value = modelId;
  dashboardElements.botModelTitle.textContent = BOT_MODEL_OPTIONS[modelId].label;
  dashboardElements.botModelDescription.textContent = BOT_MODEL_OPTIONS[modelId].description;
  dashboardElements.botStatusDescription.textContent = botEnabled
    ? "Seu atendimento automatico esta ativo e pode responder normalmente."
    : "Atendimento automatico pausado. Seu WhatsApp continua conectado, mas o robo nao respondera mensagens.";
  dashboardElements.botToggleButton.textContent = botEnabled ? "Pausar atendimento" : "Ativar atendimento";
  dashboardElements.botPlanLockCard.classList.toggle("hidden-view", canUseFeatureInPanel("ai"));
  dashboardElements.aiToggleCard.classList.toggle("hidden-view", !canUseFeatureInPanel("ai"));
  dashboardElements.geminiConfigCard.classList.toggle("hidden-view", !canUseFeatureInPanel("ai"));
  dashboardElements.aiLockedNotice.classList.toggle("hidden-view", canUseFeatureInPanel("ai"));
  dashboardElements.aiEnabledToggle.checked = dashboardState.tenant.aiEnabled !== false;
  dashboardElements.geminiApiKey.value = dashboardState.tenant.integration?.gemini?.apiKey || "";
  dashboardElements.geminiModel.value = dashboardState.tenant.integration?.gemini?.model || "gemini-2.5-flash-lite";
  dashboardElements.welcomePreview.textContent = messages.welcome || "-";
  dashboardElements.fallbackPreview.textContent = messages.fallback || "-";
  dashboardElements.handoffPreview.textContent = messages.handoff || "-";

  dashboardElements.botMenuPreview.innerHTML = "";
  autoMenuPreview.forEach((item) => {
    const optionCard = document.createElement("article");
    optionCard.className = `preview-option-card ${item.available ? "is-ready" : "is-muted"}`;
    optionCard.innerHTML = `
      <strong>${KiagendaApp.escapeHtml(item.label)}</strong>
      <p>${KiagendaApp.escapeHtml(item.hint)}</p>
    `;
    dashboardElements.botMenuPreview.appendChild(optionCard);
  });
}

function renderPlans() {
  const allPlanSettings = getAllPlanSettings();
  const usage = getUsageSummary();

  dashboardElements.currentPlanName.textContent = getPlanLabel();
  dashboardElements.currentPlanDescription.textContent = getPlanDescription();
  dashboardElements.currentSubscriptionStatus.textContent = getSubscriptionStatusLabel();
  renderUsageList(dashboardElements.currentPlanUsageSummary, [
    `Categorias usadas: ${usage.categories.used} de ${usage.categories.limit}`,
    `Imagens usadas: ${usage.images.used} de ${usage.images.limit}`,
    `Audio usado: ${usage.audio.used} de ${usage.audio.limit}`
  ]);
  dashboardElements.essentialPlanPrice.textContent = `A partir de ${formatPriceMonthly(allPlanSettings.essential.priceMonthly)}/mes`;
  dashboardElements.professionalPlanPrice.textContent = `A partir de ${formatPriceMonthly(allPlanSettings.professional.priceMonthly)}/mes`;
  dashboardElements.businessPlanPrice.textContent = `A partir de ${formatPriceMonthly(allPlanSettings.business.priceMonthly)}/mes`;
  [
    ["essential", dashboardElements.essentialPlanFeatures],
    ["professional", dashboardElements.professionalPlanFeatures],
    ["business", dashboardElements.businessPlanFeatures]
  ].forEach(([planKey, container]) => {
    container.innerHTML = "";
    getPlanCardFeatureLines(planKey).forEach((feature) => {
      const item = document.createElement("li");
      item.textContent = feature;
      container.appendChild(item);
    });
  });
  dashboardElements.essentialPlanCard.classList.toggle("is-highlighted", getPlanKey() === "essential");
  dashboardElements.professionalPlanCard.classList.toggle("is-highlighted", getPlanKey() === "professional");
  dashboardElements.businessPlanCard.classList.toggle("is-highlighted", getPlanKey() === "business");
  dashboardElements.plansUpgradeButton.classList.toggle("hidden-view", getPlanKey() === "business");
  dashboardElements.upgradeButtons.forEach((button) => {
    button.classList.toggle("hidden-view", getPlanKey() === "business");
  });
}

function renderCatalog() {
  ensureTenantCategories();
  syncLegacyCatalogCollectionsFromCategories();
  const shouldShowMediaFields = canUseFeatureInPanel("images");
  const usage = getUsageSummary();
  const currentPlan = getCurrentPlanSettings();
  document.querySelectorAll(".professional-media-field").forEach((field) => {
    field.classList.toggle("hidden-view", !shouldShowMediaFields);
  });
  dashboardElements.productMediaNotice.classList.toggle("hidden-view", shouldShowMediaFields);
  dashboardElements.serviceMediaNotice.classList.toggle("hidden-view", shouldShowMediaFields);
  dashboardElements.productsUsageCounter.textContent = `Voce usou ${dashboardState.tenant.products.length} de ${currentPlan.maxItemsPerCategory} itens nesta categoria.`;
  dashboardElements.servicesUsageCounter.textContent = `Voce usou ${dashboardState.tenant.services.length} de ${currentPlan.maxItemsPerCategory} itens nesta categoria.`;
  dashboardElements.partnershipsUsageCounter.textContent = `Voce usou ${(dashboardState.tenant.partnerships || []).length} de ${currentPlan.maxItemsPerCategory} itens nesta categoria.`;
  dashboardElements.productImagesStatus.textContent = shouldShowMediaFields
    ? `Opcional. Voce usou ${usage.images.used} de ${currentPlan.maxImagesPerAccount} imagens no plano.`
    : getUpgradeMessage();
  dashboardElements.serviceImageStatus.textContent = shouldShowMediaFields
    ? `Opcional. Voce usou ${usage.images.used} de ${currentPlan.maxImagesPerAccount} imagens no plano.`
    : getUpgradeMessage();
  renderCatalogList(dashboardElements.productsList, dashboardState.tenant.products, "products");
  renderCatalogList(dashboardElements.servicesList, dashboardState.tenant.services, "services");
  renderCatalogList(dashboardElements.partnershipsList, dashboardState.tenant.partnerships || [], "partnerships");
  renderDynamicCategoriesManager();
}

function renderLinks() {
  renderLinksList();
  syncMenuLinkSelect();
}

function renderSettings() {
  dashboardElements.tenantId.value = dashboardState.tenant.tenantId;
  dashboardElements.tenantActive.value = String(getBotEnabled());
  dashboardElements.businessName.value = dashboardState.tenant.business.name || "";
  dashboardElements.attendantName.value = dashboardState.tenant.business.attendantName || "";
  dashboardElements.businessType.value = dashboardState.tenant.business.type || "";
  dashboardElements.businessDescription.value = dashboardState.tenant.business.description || "";
  resetPasswordForm();
  dashboardElements.stateTTL.value = dashboardState.tenant.settings.stateTTL || 60;
  dashboardElements.handoffTimeout.value = dashboardState.tenant.settings.handoffTimeout || 30;
  dashboardElements.settingsPlanDescription.textContent = `Seu plano atual: ${getPlanLabel()}`;
  dashboardElements.settingsUpgradeButton.classList.toggle("hidden-view", getPlanKey() === "business");
  dashboardElements.menuCustomReplyField.classList.toggle(
    "hidden-view",
    dashboardElements.menuType.value !== "customReply"
  );
  renderGoogleConnectionStatus();
  toggleAdvancedMenu(dashboardState.advancedMenuOpen);
  renderMenuList();
}

function renderAll() {
  renderHeader();
  renderOverview();
  renderWhatsapp();
  renderBot();
  renderPlans();
  renderCatalog();
  renderLinks();
  renderSettings();
}

function startCatalogEdit(kind, itemId) {
  const collection = dashboardState.tenant[kind];
  const item = collection.find((entry) => entry.id === itemId);

  if (!item) {
    return;
  }

  if (kind === "products") {
    dashboardState.editingProductId = itemId;
    dashboardElements.productName.value = item.name || "";
    dashboardElements.productPrice.value = item.price || "";
    dashboardElements.productDescription.value = item.description || "";
    dashboardElements.productLink.value = item.link || "";
    dashboardElements.productKeywords.value = (item.keywords || []).join(", ");
    dashboardState.productKeywordSuggestions = [];
    clearFileInput(dashboardElements.productImages);
    setMediaListStatus(
      dashboardElements.productImagesStatus,
      Array.isArray(item.images) && item.images.length ? item.images : item.image ? [item.image] : [],
      "Nenhuma imagem cadastrada"
    );
    dashboardElements.addProductButton.textContent = "Salvar alteracoes";
    dashboardElements.cancelProductEditButton.classList.remove("hidden-view");
    renderKeywordSuggestions("products");
    setCatalogTab("products");
    return;
  }

  if (kind === "services") {
    dashboardState.editingServiceId = itemId;
    dashboardElements.serviceName.value = item.name || "";
    dashboardElements.servicePrice.value = item.price || "";
    dashboardElements.serviceDescription.value = item.description || "";
    dashboardElements.serviceLink.value = item.link || "";
    dashboardElements.serviceKeywords.value = (item.keywords || []).join(", ");
    dashboardState.serviceKeywordSuggestions = [];
    clearFileInput(dashboardElements.serviceImage);
    setMediaStatus(dashboardElements.serviceImageStatus, item.image, "Nenhuma imagem cadastrada");
    dashboardElements.addServiceButton.textContent = "Salvar alteracoes";
    dashboardElements.cancelServiceEditButton.classList.remove("hidden-view");
    renderKeywordSuggestions("services");
    setCatalogTab("services");
    return;
  }

  dashboardState.editingPartnershipId = itemId;
  dashboardElements.partnershipName.value = item.name || "";
  dashboardElements.partnershipPrice.value = item.price || "";
  dashboardElements.partnershipDescription.value = item.description || "";
  dashboardElements.partnershipLink.value = item.link || "";
  dashboardElements.partnershipKeywords.value = (item.keywords || []).join(", ");
  dashboardState.partnershipKeywordSuggestions = [];
  dashboardElements.addPartnershipButton.textContent = "Salvar alteracoes";
  dashboardElements.cancelPartnershipEditButton.classList.remove("hidden-view");
  renderKeywordSuggestions("partnerships");
  setCatalogTab("partnerships");
}

function removeCatalogItem(kind, itemId) {
  dashboardState.tenant[kind] = dashboardState.tenant[kind].filter((item) => item.id !== itemId);

  if (kind === "products" && dashboardState.editingProductId === itemId) {
    resetProductForm();
  }

  if (kind === "services" && dashboardState.editingServiceId === itemId) {
    resetServiceForm();
  }

  if (kind === "partnerships" && dashboardState.editingPartnershipId === itemId) {
    resetPartnershipForm();
  }

  renderAll();
}

async function readMediaFile(file, allowedPrefix) {
  if (!file) {
    return null;
  }

  if (!String(file.type || "").startsWith(allowedPrefix)) {
    throw new Error(`Selecione um arquivo ${allowedPrefix === "image/" ? "de imagem" : "MP3"} valido.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        dataUrl: String(reader.result || ""),
        mimeType: String(file.type || ""),
        fileName: String(file.name || ""),
        sizeBytes: Number(file.size || 0)
      });
    };
    reader.onerror = () => reject(new Error("Nao foi possivel ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

async function readMediaFileList(files, allowedPrefix, maxItems) {
  const fileList = Array.from(files || []).filter(Boolean);

  if (!fileList.length) {
    return [];
  }

  if (fileList.length > maxItems) {
    throw new Error(`Voce pode enviar no maximo ${maxItems} arquivo(s) neste campo.`);
  }

  const assets = [];

  for (const file of fileList) {
    assets.push(await readMediaFile(file, allowedPrefix));
  }

  return assets;
}

async function buildCatalogMedia(kind, existingItem) {
  if (kind === "products") {
    if (!canUseFeatureInPanel("images")) {
      return {
        images: Array.isArray(existingItem?.images) ? existingItem.images : existingItem?.image ? [existingItem.image] : []
      };
    }

    const imageFiles = dashboardElements.productImages?.files || [];
    const nextImages = imageFiles.length
      ? await readMediaFileList(imageFiles, "image/", 3)
      : Array.isArray(existingItem?.images) && existingItem.images.length
        ? existingItem.images
        : existingItem?.image
          ? [existingItem.image]
          : [];

    const currentItemImages = Array.isArray(existingItem?.images) && existingItem.images.length
      ? existingItem.images.filter(Boolean).length
      : existingItem?.image
        ? 1
        : 0;
    const nextImageCount = countUsedImages() - currentItemImages + nextImages.filter(Boolean).length;
    ensureImageLimit(nextImageCount, nextImages);

    return { images: nextImages };
  }

  if (kind === "partnerships") {
    return {
      image: null
    };
  }

  if (!canUseFeatureInPanel("images")) {
    return {
      image: existingItem?.image || null
    };
  }

  const imageFile = dashboardElements.serviceImage?.files?.[0] || null;
  const image = imageFile ? await readMediaFile(imageFile, "image/") : existingItem?.image || null;
  const currentItemImages = existingItem?.image ? 1 : 0;
  const nextImageCount = countUsedImages() - currentItemImages + (image ? 1 : 0);
  ensureImageLimit(nextImageCount, image ? [image] : []);

  return { image };
}

async function upsertCatalogItem(kind) {
  const isProduct = kind === "products";
  const isService = kind === "services";
  const nameInput = isProduct
    ? dashboardElements.productName
    : isService
      ? dashboardElements.serviceName
      : dashboardElements.partnershipName;
  const priceInput = isProduct
    ? dashboardElements.productPrice
    : isService
      ? dashboardElements.servicePrice
      : dashboardElements.partnershipPrice;
  const descriptionInput = isProduct
    ? dashboardElements.productDescription
    : isService
      ? dashboardElements.serviceDescription
      : dashboardElements.partnershipDescription;
  const linkInput = isProduct
    ? dashboardElements.productLink
    : isService
      ? dashboardElements.serviceLink
      : dashboardElements.partnershipLink;
  const keywordsInput = isProduct
    ? dashboardElements.productKeywords
    : isService
      ? dashboardElements.serviceKeywords
      : dashboardElements.partnershipKeywords;
  const editingId = isProduct ? dashboardState.editingProductId : isService ? dashboardState.editingServiceId : dashboardState.editingPartnershipId;
  const collection = dashboardState.tenant[kind];
  const existingItem = collection.find((item) => item.id === editingId) || null;
  const media = await buildCatalogMedia(kind, existingItem);
  const parsedKeywords = KiagendaApp.parseAliases(keywordsInput.value);

  const nextItem = {
    id: editingId || `${isProduct ? "product" : isService ? "service" : "partnership"}_${Date.now()}`,
    name: nameInput.value.trim(),
    price: priceInput.value.trim(),
    description: descriptionInput.value.trim(),
    link: linkInput.value.trim(),
    aliases: buildCatalogAliases(nameInput.value.trim()),
    keywords: parsedKeywords.length ? parsedKeywords : existingItem?.keywords?.length ? existingItem.keywords : buildCatalogAliases(nameInput.value.trim())
  };

  if (isProduct) {
    nextItem.images = media.images || [];
    nextItem.image = nextItem.images[0] || null;
    nextItem.audio = null;
  } else if (isService) {
    nextItem.image = media.image || null;
    nextItem.audio = existingItem?.audio || null;
  } else {
    nextItem.image = null;
    nextItem.audio = null;
  }

  if (!nextItem.name) {
    throw new Error(`Informe o nome do ${isProduct ? "produto" : isService ? "servico" : "oferta"}.`);
  }

  const existingIndex = collection.findIndex((item) => item.id === nextItem.id);

  if (existingIndex < 0) {
    ensureCategoryLimit(kind, collection);
  }

  if (existingIndex >= 0) {
    collection[existingIndex] = nextItem;
  } else {
    collection.push(nextItem);
  }

  if (isProduct) {
    resetProductForm();
  } else if (isService) {
    resetServiceForm();
  } else {
    resetPartnershipForm();
  }

  renderAll();
}

function startLinkEdit(linkId) {
  const link = dashboardState.tenant.links.find((item) => item.id === linkId);

  if (!link) {
    return;
  }

  dashboardState.editingLinkId = linkId;
  dashboardElements.linkTitle.value = link.title || "";
  dashboardElements.linkUrl.value = link.url || "";
  dashboardElements.linkDescription.value = link.description || "";
  dashboardElements.addLinkButton.textContent = "Salvar alteracoes";
  dashboardElements.cancelLinkEditButton.classList.remove("hidden-view");
}

function removeLink(linkId) {
  dashboardState.tenant.links = dashboardState.tenant.links.filter((item) => item.id !== linkId);

  if (dashboardState.editingLinkId === linkId) {
    resetLinkForm();
  }

  renderAll();
}

function upsertLink() {
  const nextLink = {
    id: dashboardState.editingLinkId || `link_${Date.now()}`,
    title: dashboardElements.linkTitle.value.trim(),
    url: dashboardElements.linkUrl.value.trim(),
    description: dashboardElements.linkDescription.value.trim(),
    aliases: buildLinkAliases(dashboardElements.linkTitle.value.trim())
  };

  if (!nextLink.title || !nextLink.url) {
    throw new Error("Informe pelo menos o titulo e a URL do link.");
  }

  const existingIndex = dashboardState.tenant.links.findIndex((item) => item.id === nextLink.id);

  if (existingIndex >= 0) {
    dashboardState.tenant.links[existingIndex] = nextLink;
  } else {
    dashboardState.tenant.links.push(nextLink);
  }

  resetLinkForm();
  renderAll();
}

function addAdvancedMenuItem() {
  const label = dashboardElements.menuLabel.value.trim();
  const actionType = dashboardElements.menuType.value;
  const keywords = KiagendaApp.parseAliases(dashboardElements.menuAliases.value);
  const customReply = actionType === "customReply" ? dashboardElements.menuCustomReply.value.trim() : "";

  if (!label) {
    throw new Error("Informe o nome da opcao.");
  }

  if (!keywords.length) {
    throw new Error("Informe pelo menos uma palavra que ativa essa opcao.");
  }

  if (!actionType) {
    throw new Error("Escolha o tipo de resposta.");
  }

  if (actionType === "customReply" && !customReply) {
    throw new Error("Escreva a resposta personalizada dessa opcao.");
  }

  const nextItem = {
    id: dashboardState.editingMenuId || `advanced_option_${Date.now()}`,
    label,
    actionType,
    enabled: true,
    keywords,
    customReply
  };

  dashboardState.tenant.advancedOptions = Array.isArray(dashboardState.tenant.advancedOptions)
    ? dashboardState.tenant.advancedOptions
    : [];
  const existingIndex = dashboardState.tenant.advancedOptions.findIndex((item) => item.id === nextItem.id);

  if (existingIndex >= 0) {
    dashboardState.tenant.advancedOptions[existingIndex] = nextItem;
  } else {
    dashboardState.tenant.advancedOptions.push(nextItem);
  }

  resetMenuForm();
  renderAll();
  toggleAdvancedMenu(true);
  setFeedback("Opcao extra adicionada na tela. Clique em Salvar alteracoes para publicar no bot.");
}

function syncFormToState() {
  dashboardState.tenant.active = dashboardElements.tenantActive.value === "true";
  dashboardState.tenant.botEnabled = dashboardElements.tenantActive.value === "true";
  dashboardState.tenant.aiEnabled = canUseFeatureInPanel("ai")
    ? Boolean(dashboardElements.aiEnabledToggle.checked)
    : false;
  dashboardState.tenant.business.name = dashboardElements.businessName.value.trim();
  dashboardState.tenant.business.attendantName = dashboardElements.attendantName.value.trim() || "Atendimento";
  dashboardState.tenant.business.type = dashboardElements.businessType.value.trim();
  dashboardState.tenant.business.description = dashboardElements.businessDescription.value.trim();
  dashboardState.tenant.settings.stateTTL = Number(dashboardElements.stateTTL.value || 60);
  dashboardState.tenant.settings.handoffTimeout = Number(dashboardElements.handoffTimeout.value || 30);
  dashboardState.tenant.whatsapp.sessionId = dashboardElements.whatsappSessionId.value.trim() || `${dashboardState.tenantId}-session`;
  dashboardState.tenant.botModel = dashboardElements.botModelSelect.value;
  dashboardState.tenant.integration = dashboardState.tenant.integration || {};
  dashboardState.tenant.integration.gemini = {
    apiKey: canUseFeatureInPanel("ai") ? dashboardElements.geminiApiKey.value.trim() : "",
    model: canUseFeatureInPanel("ai") ? dashboardElements.geminiModel.value : "gemini-2.5-flash-lite"
  };
}

function buildPayload() {
  syncFormToState();
  syncLegacyCatalogCollectionsFromCategories();

  return {
    active: dashboardState.tenant.active,
    botEnabled: getBotEnabled(),
    aiEnabled: dashboardState.tenant.aiEnabled !== false,
    plan: dashboardState.tenant.plan || "essential",
    subscriptionStatus: normalizeSubscriptionStatus(dashboardState.tenant.subscriptionStatus),
    onboardingCompleted: true,
    botModel: dashboardState.tenant.botModel || "standard",
    business: { ...dashboardState.tenant.business },
    whatsapp: {
      connected: Boolean(dashboardState.session?.connected),
      number: getConnectedWhatsappNumber(),
      sessionId: dashboardState.tenant.whatsapp.sessionId
    },
    categories: dashboardState.tenant.categories || [],
    products: dashboardState.tenant.products,
    services: dashboardState.tenant.services,
    partnerships: dashboardState.tenant.partnerships || [],
    links: dashboardState.tenant.links,
    advancedOptions: dashboardState.tenant.advancedOptions || [],
    menu: buildAutomaticMenu(dashboardState.tenant.botModel),
    messages: getEffectiveMessages(),
    settings: { ...dashboardState.tenant.settings },
    integration: dashboardState.tenant.integration
  };
}

async function loadPlanSettings() {
  try {
    const response = await KiagendaApp.requestJson("/api/admin/plan-settings");
    dashboardState.planSettings = response.data || {};
  } catch (error) {
    dashboardState.planSettings = getDefaultPlanSettings();
  }
}

async function refreshSession() {
  try {
    dashboardState.session = await KiagendaApp.requestJson(`/api/tenants/${dashboardState.tenantId}/session`);
  } catch (error) {
    dashboardState.session = {
      tenantId: dashboardState.tenantId,
      connected: false,
      status: "disconnected",
      number: dashboardState.tenant.whatsapp.number || "",
      connectedWhatsappNumber: dashboardState.tenant.whatsapp.number || "",
      sessionId: dashboardState.tenant.whatsapp.sessionId || `${dashboardState.tenantId}-session`,
      qr: ""
    };
  }

  renderAll();
  await maybeAutoStartSession(dashboardState.session);
  return dashboardState.session;
}

function shouldKeepPollingSession(session) {
  const status = String(session?.status || "");
  return ["initializing", "qr", "authenticated", "reconnecting", "restore_pending"].includes(status);
}

function shouldAutoStartSession(session) {
  const status = String(session?.status || "");

  if (dashboardState.sessionAutoStartAttempted) {
    return false;
  }

  if (session?.connected || session?.runtimeActive || session?.runtimeInitializing) {
    return false;
  }

  return ["qr", "restore_pending"].includes(status) && Boolean(session?.hasLocalSessionArtifacts);
}

async function maybeAutoStartSession(session) {
  if (!shouldAutoStartSession(session)) {
    return session;
  }

  dashboardState.sessionAutoStartAttempted = true;

  const response = await KiagendaApp.requestJson(`/api/tenants/${dashboardState.tenantId}/session/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId: dashboardState.tenant?.whatsapp?.sessionId || `${dashboardState.tenantId}-session`
    })
  });

  dashboardState.session = response.data;
  renderAll();
  await pollSession();
  return dashboardState.session;
}

async function pollSession(attempt = 0) {
  stopSessionPolling();
  const session = await refreshSession();

  if (!shouldKeepPollingSession(session) || attempt >= 29) {
    return;
  }

  dashboardState.sessionPollTimer = window.setTimeout(() => {
    runAction(() => pollSession(attempt + 1));
  }, 2000);
}

async function saveTenant() {
  const response = await KiagendaApp.requestJson(`/api/tenants/${dashboardState.tenantId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildPayload())
  });

  dashboardState.tenant = response.data;
  dashboardState.tenant.botModel = normalizePanelBotModel(response.data.botModel);
  renderAll();
  setFeedback(response.message || "Alteracoes salvas com sucesso.");
}

async function toggleBotEnabled() {
  dashboardState.tenant.botEnabled = !getBotEnabled();
  dashboardState.tenant.active = dashboardState.tenant.botEnabled;
  dashboardElements.tenantActive.value = String(dashboardState.tenant.botEnabled);
  await saveTenant();
  setFeedback(
    getBotEnabled()
      ? "Atendimento automatico ativado com sucesso."
      : "Atendimento automatico pausado. Seu WhatsApp continua conectado, mas o robo nao respondera mensagens."
  );
}

async function updatePassword() {
  const newPassword = dashboardElements.newPassword.value;
  const confirmNewPassword = dashboardElements.confirmNewPassword.value;

  if (!newPassword || !confirmNewPassword) {
    throw new Error("Preencha os dois campos para atualizar a senha.");
  }

  if (newPassword !== confirmNewPassword) {
    throw new Error("As senhas nao conferem.");
  }

  await KiagendaApp.updateAuthPassword(dashboardState.tenantId, newPassword, confirmNewPassword);
  resetPasswordForm();
  setFeedback("Senha atualizada com sucesso.");
}

function connectGoogleAccount() {
  if (!dashboardState.tenantId) {
    throw new Error("Nao encontramos a conta atual para conectar ao Google.");
  }

  window.location.href = `/auth/google?mode=connect&tenantId=${encodeURIComponent(dashboardState.tenantId)}`;
}

function consumeAuthSuccessMessage() {
  const authSuccess = KiagendaApp.getQueryParam("auth_success");

  if (authSuccess === "google_connected") {
    setFeedback("Conta Google conectada com sucesso.");
    const url = new URL(window.location.href);
    url.searchParams.delete("auth_success");
    window.history.replaceState({}, document.title, url.toString());
  }
}

function logout() {
  KiagendaApp.clearAuthSession();
  window.location.replace("index.html");
}

async function startWhatsappSession() {
  const response = await KiagendaApp.requestJson(`/api/tenants/${dashboardState.tenantId}/session/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId: dashboardState.tenant.whatsapp.sessionId
    })
  });

  dashboardState.session = response.data;
  await refreshSession();
  setFeedback(response.message || "Conexao iniciada com sucesso.");
  await pollSession();
}

async function resetWhatsappSession() {
  const confirmed = window.confirm(
    "Isso vai desconectar o WhatsApp atual e apagar a sessao salva. Depois voce precisara escanear o QR Code com o novo numero."
  );

  if (!confirmed) {
    return;
  }

  const response = await KiagendaApp.requestJson(`/api/tenants/${dashboardState.tenantId}/whatsapp/reset-session`, {
    method: "POST"
  });

  dashboardState.session = response.data;
  dashboardState.tenant.whatsapp.connected = false;
  dashboardState.tenant.whatsapp.number = "";
  stopSessionPolling();
  await refreshSession();
  setFeedback(response.message || "Sessao do WhatsApp de atendimento reiniciada com sucesso.");
  await pollSession();
}

async function stopWhatsappSession() {
  const response = await KiagendaApp.requestJson(`/api/tenants/${dashboardState.tenantId}/session/stop`, {
    method: "POST"
  });

  dashboardState.session = response.data;
  stopSessionPolling();
  await refreshSession();
  setFeedback(response.message || "Conexao encerrada com sucesso.");
}

async function simulateMessage() {
  const response = await KiagendaApp.requestJson(`/api/tenants/${dashboardState.tenantId}/bot/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contactId: dashboardElements.simulatorContactId.value.trim() || "contato_demo",
      message: dashboardElements.simulatorMessage.value.trim()
    })
  });

  dashboardElements.simulatorIntent.textContent = response.intent || "-";
  dashboardElements.simulatorReply.textContent = response.reply || "-";
  setFeedback("Teste realizado com sucesso.");
}

async function loadDashboard() {
  dashboardState.tenantId = getTenantId();
  if (!ensureAuthenticatedAccess(dashboardState.tenantId)) {
    return;
  }
  consumeAuthSuccessMessage();
  stopSessionPolling();
  await loadPlanSettings();

  let tenant;

  try {
    tenant = await KiagendaApp.requestJson(`/api/tenants/${dashboardState.tenantId}`);
  } catch (error) {
    window.location.href = `onboarding.html?id=${encodeURIComponent(dashboardState.tenantId)}`;
    return;
  }

  const session = await KiagendaApp.requestJson(`/api/tenants/${dashboardState.tenantId}/session`).catch(() => null);

  if (tenant.onboardingCompleted !== true) {
    window.location.href = `onboarding.html?id=${encodeURIComponent(dashboardState.tenantId)}`;
    return;
  }

  dashboardState.tenant = tenant;
  dashboardState.tenant.botModel = normalizePanelBotModel(tenant.botModel);
  dashboardState.tenant.advancedOptions = Array.isArray(tenant.advancedOptions) ? tenant.advancedOptions : [];
  dashboardState.tenant.categories = Array.isArray(tenant.categories) ? tenant.categories : [];
  dashboardState.tenant.partnerships = Array.isArray(tenant.partnerships) ? tenant.partnerships : [];
  dashboardState.tenant.botEnabled = tenant.botEnabled !== false;
  dashboardState.tenant.aiEnabled = tenant.aiEnabled !== false;
  dashboardState.tenant.plan = tenant.plan || "essential";
  dashboardState.tenant.subscriptionStatus = normalizeSubscriptionStatus(tenant.subscriptionStatus);
  dashboardState.tenant.integration = {
    ...(tenant.integration || {}),
    gemini: {
      apiKey: tenant.integration?.gemini?.apiKey || "",
      model: tenant.integration?.gemini?.model || "gemini-2.5-flash-lite"
    },
    kiagenda: {
      ...(tenant.integration?.kiagenda || {})
    }
  };
  dashboardState.session = session || {
    tenantId: dashboardState.tenantId,
    connected: false,
    status: "disconnected",
    number: tenant.whatsapp?.number || "",
    connectedWhatsappNumber: tenant.whatsapp?.number || "",
    sessionId: tenant.whatsapp?.sessionId || `${dashboardState.tenantId}-session`,
    qr: ""
  };

  ensureTenantCategories();
  syncLegacyCatalogCollectionsFromCategories();
  dashboardState.activeCategoryId = getCatalogCategories()[0]?.id || "";

  resetProductForm();
  resetServiceForm();
  resetPartnershipForm();
  resetLinkForm();
  resetMenuForm();
  renderAll();
  showSection(getSavedSection());
  await maybeAutoStartSession(dashboardState.session);
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    setFeedback(error.message || "Nao foi possivel concluir esta acao.");
  }
}

dashboardElements.navButtons.forEach((button) => {
  button.addEventListener("click", () => showSection(button.dataset.target));
});

dashboardElements.logoutButton.addEventListener("click", logout);
dashboardElements.overviewBotToggleButton.addEventListener("click", () => runAction(toggleBotEnabled));
dashboardElements.overviewTestButton.addEventListener("click", () => showSection("test"));
dashboardElements.saveConfigButton.addEventListener("click", () => runAction(saveTenant));
dashboardElements.connectWhatsappButton.addEventListener("click", () => runAction(startWhatsappSession));
dashboardElements.resetWhatsappSessionButton.addEventListener("click", () => runAction(resetWhatsappSession));
dashboardElements.disconnectWhatsappButton.addEventListener("click", () => runAction(stopWhatsappSession));
dashboardElements.refreshWhatsappButton.addEventListener("click", () => runAction(refreshSession));
dashboardElements.showProductsTabButton.addEventListener("click", () => setCatalogTab("products"));
dashboardElements.showServicesTabButton.addEventListener("click", () => setCatalogTab("services"));
dashboardElements.showPartnershipsTabButton.addEventListener("click", () => setCatalogTab("partnerships"));
dashboardElements.addProductButton.addEventListener("click", () => runAction(() => upsertCatalogItem("products")));
dashboardElements.addServiceButton.addEventListener("click", () => runAction(() => upsertCatalogItem("services")));
dashboardElements.addPartnershipButton.addEventListener("click", () => runAction(() => upsertCatalogItem("partnerships")));
dashboardElements.generateProductKeywordsButton.addEventListener("click", () => runAction(() => generateKeywordSuggestions("products")));
dashboardElements.generateServiceKeywordsButton.addEventListener("click", () => runAction(() => generateKeywordSuggestions("services")));
dashboardElements.generatePartnershipKeywordsButton.addEventListener("click", () => runAction(() => generateKeywordSuggestions("partnerships")));
dashboardElements.cancelProductEditButton.addEventListener("click", resetProductForm);
dashboardElements.cancelServiceEditButton.addEventListener("click", resetServiceForm);
dashboardElements.cancelPartnershipEditButton.addEventListener("click", resetPartnershipForm);
dashboardElements.addLinkButton.addEventListener("click", () => runAction(upsertLink));
dashboardElements.cancelLinkEditButton.addEventListener("click", resetLinkForm);
dashboardElements.toggleAdvancedMenuButton.addEventListener("click", () => toggleAdvancedMenu());
dashboardElements.cancelMenuEditButton.addEventListener("click", resetMenuForm);
dashboardElements.addMenuButton.addEventListener("click", () => runAction(addAdvancedMenuItem));
dashboardElements.menuType.addEventListener("change", () => {
  dashboardElements.menuCustomReplyField.classList.toggle("hidden-view", dashboardElements.menuType.value !== "customReply");
});
dashboardElements.productImages?.addEventListener("change", () => {
  const files = Array.from(dashboardElements.productImages.files || []).filter(Boolean);
  setMediaListStatus(dashboardElements.productImagesStatus, files, "Opcional. Envie ate 3 imagens.");
});
dashboardElements.messageAudio?.addEventListener("change", () => {
  const file = dashboardElements.messageAudio.files?.[0] || null;
  setMediaStatus(
    dashboardElements.messageAudioStatus,
    file ? { fileName: file.name } : null,
    "Opcional. Esse audio sera enviado junto com o atendimento humano."
  );
});
dashboardElements.connectGoogleButton?.addEventListener("click", () => runAction(connectGoogleAccount));
dashboardElements.updatePasswordButton.addEventListener("click", () => runAction(updatePassword));
dashboardElements.botToggleButton.addEventListener("click", () => runAction(toggleBotEnabled));
dashboardElements.upgradeButtons.forEach((button) => {
  button.addEventListener("click", openPlanUpgrade);
});
dashboardElements.editWelcomeMessageButton.addEventListener("click", () => startMessageEdit("welcome"));
dashboardElements.editFallbackMessageButton.addEventListener("click", () => startMessageEdit("fallback"));
dashboardElements.editHandoffMessageButton.addEventListener("click", () => startMessageEdit("handoff"));
dashboardElements.saveWelcomeMessageButton.addEventListener("click", () => saveMessageEdit("welcome"));
dashboardElements.saveFallbackMessageButton.addEventListener("click", () => saveMessageEdit("fallback"));
dashboardElements.saveHandoffMessageButton.addEventListener("click", () => saveMessageEdit("handoff"));
dashboardElements.cancelWelcomeMessageButton.addEventListener("click", resetMessageEditors);
dashboardElements.cancelFallbackMessageButton.addEventListener("click", resetMessageEditors);
dashboardElements.cancelHandoffMessageButton.addEventListener("click", resetMessageEditors);
dashboardElements.simulateMessageButton.addEventListener("click", () => runAction(simulateMessage));
dashboardElements.botModelSelect.addEventListener("change", () => {
  dashboardState.tenant.botModel = dashboardElements.botModelSelect.value;
  resetMessageEditors();
  renderAll();
});

loadDashboard().catch((error) => {
  setFeedback(error.message || "Nao foi possivel carregar o painel.");
});

window.addEventListener("pageshow", () => {
  const tenantId = dashboardState.tenantId || KiagendaApp.normalizeTenantId(KiagendaApp.getQueryParam("id"));
  if (tenantId) {
    ensureAuthenticatedAccess(tenantId);
  }
});
