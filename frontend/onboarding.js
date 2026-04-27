const ONBOARDING_STEPS = [
  "Dados do negocio",
  "WhatsApp",
  "Produtos ou servicos",
  "Links importantes",
  "Revisar e ativar"
];

const BOT_MODELS = {
  loja_online: {
    label: "Loja online",
    type: "standard",
    productsLabel: "Produtos",
    servicesLabel: "Atendimento",
    welcomeHint: "Posso te mostrar produtos, links e ajudar com a compra.",
    menu: ["Sobre a empresa", "Produtos", "Links importantes", "Falar com a equipe"]
  },
  barbearia: {
    label: "Barbearia",
    type: "standard",
    productsLabel: "Cuidados",
    servicesLabel: "Servicos",
    welcomeHint: "Posso te mostrar servicos, horarios e falar com a equipe.",
    menu: ["Sobre a empresa", "Servicos", "Links importantes", "Falar com a equipe"]
  },
  clinica: {
    label: "Clinica",
    type: "standard",
    productsLabel: "Orientacoes",
    servicesLabel: "Servicos",
    welcomeHint: "Posso te apresentar servicos, informacoes e atendimento.",
    menu: ["Sobre a empresa", "Servicos", "Links importantes", "Falar com a equipe"]
  },
  restaurante: {
    label: "Restaurante",
    type: "standard",
    productsLabel: "Cardapio",
    servicesLabel: "Atendimento",
    welcomeHint: "Posso te mostrar o cardapio, links e ajudar com pedidos.",
    menu: ["Sobre a empresa", "Produtos", "Links importantes", "Falar com a equipe"]
  },
  servicos_gerais: {
    label: "Servicos gerais",
    type: "standard",
    productsLabel: "Solucoes",
    servicesLabel: "Servicos",
    welcomeHint: "Posso te apresentar servicos, contatos e atendimento.",
    menu: ["Sobre a empresa", "Servicos", "Links importantes", "Falar com a equipe"]
  },
  kiagenda_servicos: {
    label: "KiAgenda Servicos",
    type: "kiagenda",
    menu: ["Ver servicos", "Agendar horario", "Horarios disponiveis", "Falar com atendimento"]
  },
  kiagenda_delivery: {
    label: "KiAgenda Delivery",
    type: "kiagenda",
    menu: ["Ver cardapio", "Fazer pedido", "Entrega ou retirada", "Falar com atendimento"]
  }
};

const onboardingState = {
  tenantId: "",
  isNew: false,
  tenant: null,
  session: null,
  step: 1,
  pendingKiagendaModel: "",
  sessionPollTimer: null,
  sessionAutoStartAttempted: false
};

const onboardingElements = {
  onboardingTitle: document.getElementById("onboardingTitle"),
  advancedPanelLink: document.getElementById("advancedPanelLink"),
  feedback: document.getElementById("onboardingFeedback"),
  progressText: document.getElementById("progressText"),
  progressStepTitle: document.getElementById("progressStepTitle"),
  progressFill: document.getElementById("progressFill"),
  stepButtons: Array.from(document.querySelectorAll(".onboarding-step")),
  panels: Array.from(document.querySelectorAll(".onboarding-panel")),
  modelCards: Array.from(document.querySelectorAll(".model-card")),
  standardModelButtons: Array.from(document.querySelectorAll(".model-card-standard")),
  kiagendaModelCards: Array.from(document.querySelectorAll(".template-card-kiagenda")),
  kiagendaModalTriggers: Array.from(document.querySelectorAll("[data-open-kiagenda-modal]")),
  selectedModelBadge: document.getElementById("selectedModelBadge"),
  businessNameInput: document.getElementById("businessNameInput"),
  attendantNameInput: document.getElementById("attendantNameInput"),
  businessTypeInput: document.getElementById("businessTypeInput"),
  businessLocationInput: document.getElementById("businessLocationInput"),
  whatsappNumberInput: document.getElementById("whatsappNumberInput"),
  connectWhatsappButtonSimple: document.getElementById("connectWhatsappButtonSimple"),
  refreshWhatsappStatusButton: document.getElementById("refreshWhatsappStatusButton"),
  whatsappStatusText: document.getElementById("whatsappStatusText"),
  whatsappQrPanel: document.getElementById("whatsappQrPanel"),
  itemKindInput: document.getElementById("itemKindInput"),
  itemNameInput: document.getElementById("itemNameInput"),
  itemPriceInput: document.getElementById("itemPriceInput"),
  itemDescriptionInput: document.getElementById("itemDescriptionInput"),
  itemLinkInput: document.getElementById("itemLinkInput"),
  itemKeywordsInput: document.getElementById("itemKeywordsInput"),
  addItemButton: document.getElementById("addItemButton"),
  productsPreviewList: document.getElementById("productsPreviewList"),
  servicesPreviewList: document.getElementById("servicesPreviewList"),
  linkTitleInput: document.getElementById("linkTitleInput"),
  linkUrlInput: document.getElementById("linkUrlInput"),
  addLinkButtonSimple: document.getElementById("addLinkButtonSimple"),
  linksPreviewList: document.getElementById("linksPreviewList"),
  reviewGrid: document.getElementById("reviewGrid"),
  prevStepButton: document.getElementById("prevStepButton"),
  nextStepButton: document.getElementById("nextStepButton"),
  activateButton: document.getElementById("activateButton"),
  kiagendaModal: document.getElementById("kiagendaModal"),
  kiagendaModalTitle: document.getElementById("kiagendaModalTitle"),
  kiagendaTokenInput: document.getElementById("kiagendaTokenInput"),
  kiagendaAccountStatus: document.getElementById("kiagendaAccountStatus"),
  connectKiagendaButton: document.getElementById("connectKiagendaButton"),
  closeKiagendaModalButton: document.getElementById("closeKiagendaModalButton")
};

function setFeedback(message) {
  onboardingElements.feedback.textContent = message;
}

function stopSessionPolling() {
  if (onboardingState.sessionPollTimer) {
    window.clearTimeout(onboardingState.sessionPollTimer);
    onboardingState.sessionPollTimer = null;
  }
}

function getTenantIdFromQuery() {
  const tenantId = KiagendaApp.normalizeTenantId(KiagendaApp.getQueryParam("id"));

  if (!tenantId) {
    throw new Error("Abra esta pagina com onboarding.html?id=seu-cliente.");
  }

  return tenantId;
}

function ensureAuthenticatedAccess(tenantId) {
  const authSession = KiagendaApp.getAuthSession();
  const sessionTenantId = KiagendaApp.normalizeTenantId(authSession?.tenantId);
  const targetTenantId = KiagendaApp.normalizeTenantId(tenantId);

  if (
    sessionTenantId &&
    targetTenantId &&
    sessionTenantId === targetTenantId &&
    KiagendaApp.isAccountActive(authSession)
  ) {
    return true;
  }

  window.location.replace("index.html");
  return false;
}

function createEmptyTenant(tenantId) {
  return {
    tenantId,
    type: "client",
    active: true,
    botEnabled: true,
    aiEnabled: true,
    onboardingCompleted: false,
    botModel: "",
    business: {
      name: "",
      attendantName: "Atendimento",
      type: "",
      location: "",
      description: ""
    },
    whatsapp: {
      connected: false,
      number: "",
      sessionId: `${tenantId}-session`
    },
    products: [],
    services: [],
    links: [],
    menu: [],
    messages: {
      welcome: "",
      fallback: "",
      handoff: "",
      audio: null
    },
    settings: {
      stateTTL: 60,
      handoffTimeout: 30
    },
    integration: {
      gemini: {
        apiKey: "",
        model: "gemini-2.5-flash-lite"
      },
      kiagenda: {
        connected: false,
        token: "",
        accountStatus: "not_connected",
        mode: null
      }
    }
  };
}

function createEmptySession(tenantId) {
  return {
    tenantId,
    connected: false,
    status: "disconnected",
    number: "",
    sessionId: `${tenantId}-session`,
    qr: ""
  };
}

function setStep(step) {
  onboardingState.step = Math.min(Math.max(Number(step) || 1, 1), ONBOARDING_STEPS.length);

  onboardingElements.panels.forEach((panel) => {
    panel.classList.toggle("hidden-view", Number(panel.dataset.step) !== onboardingState.step);
  });

  onboardingElements.stepButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.stepTarget) === onboardingState.step);
  });

  onboardingElements.progressText.textContent = `Passo ${onboardingState.step} de ${ONBOARDING_STEPS.length}`;
  onboardingElements.progressStepTitle.textContent = ONBOARDING_STEPS[onboardingState.step - 1];
  onboardingElements.progressFill.style.width = `${(onboardingState.step / ONBOARDING_STEPS.length) * 100}%`;
  onboardingElements.prevStepButton.disabled = onboardingState.step === 1;
  onboardingElements.nextStepButton.classList.toggle("hidden-view", onboardingState.step === ONBOARDING_STEPS.length);
  onboardingElements.activateButton.classList.toggle("hidden-view", onboardingState.step !== ONBOARDING_STEPS.length);

  if (onboardingState.step === ONBOARDING_STEPS.length) {
    renderReview();
  }
}

function getWhatsappStatusLabel(session) {
  const status = String(session?.status || "");

  if (session?.connected || status === "connected") return "Conectado";
  if (status === "qr") return "QR Code pronto para leitura";
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

function applyStatusTone(element, tone) {
  element.classList.remove("status-positive", "status-negative", "status-pending");
  element.classList.add(`status-${tone}`);
}

function getModelLabel(modelId) {
  return BOT_MODELS[modelId]?.label || "Nenhum modelo selecionado";
}

function updateSelectedModelUi() {
  const currentModel = onboardingState.tenant.botModel;
  onboardingElements.selectedModelBadge.textContent = currentModel
    ? getModelLabel(currentModel)
    : "Nenhum modelo selecionado";

  onboardingElements.modelCards.forEach((card) => {
    card.classList.toggle("active", card.dataset.modelId === currentModel);
  });

  const kiagendaStatus = onboardingState.tenant.integration?.kiagenda?.accountStatus || "not_connected";
  onboardingElements.kiagendaAccountStatus.textContent = kiagendaStatus === "connected_demo"
    ? "Conta conectada"
    : "Nao conectada";
  onboardingElements.kiagendaTokenInput.value = onboardingState.tenant.integration?.kiagenda?.token || "";
}

function openKiagendaModal(modelId) {
  onboardingState.pendingKiagendaModel = modelId;
  onboardingElements.kiagendaModalTitle.textContent = `Ativar ${getModelLabel(modelId)}`;
  onboardingElements.kiagendaModal.classList.remove("hidden-view");
  onboardingElements.kiagendaModal.setAttribute("aria-hidden", "false");
}

function closeKiagendaModal() {
  onboardingState.pendingKiagendaModel = "";
  onboardingElements.kiagendaModal.classList.add("hidden-view");
  onboardingElements.kiagendaModal.setAttribute("aria-hidden", "true");
}

function buildStandardMenu(modelId) {
  const model = BOT_MODELS[modelId];
  const items = [];

  if (model.menu.includes("Sobre a empresa")) {
    items.push({
      id: "menu_sobre",
      label: "Sobre a empresa",
      type: "business_info",
      enabled: true,
      linkId: "",
      aliases: []
    });
  }

  if (model.menu.includes("Produtos")) {
    items.push({
      id: "menu_produtos",
      label: model.productsLabel || "Produtos",
      type: "products",
      enabled: true,
      linkId: "",
      aliases: []
    });
  }

  if (model.menu.includes("Servicos")) {
    items.push({
      id: "menu_servicos",
      label: model.servicesLabel || "Servicos",
      type: "services",
      enabled: true,
      linkId: "",
      aliases: []
    });
  }

  if (model.menu.includes("Links importantes")) {
    items.push({
      id: "menu_links",
      label: "Links importantes",
      type: "links",
      enabled: true,
      linkId: "",
      aliases: []
    });
  }

  if (model.menu.includes("Falar com a equipe")) {
    items.push({
      id: "menu_atendimento",
      label: "Falar com a equipe",
      type: "handoff",
      enabled: true,
      linkId: "",
      aliases: []
    });
  }

  return items;
}

function buildKiagendaMenu(modelId) {
  if (modelId === "kiagenda_servicos") {
    return [
      { id: "menu_servicos", label: "Ver servicos", type: "services", enabled: true, linkId: "", aliases: [] },
      { id: "menu_agendar", label: "Agendar horario", type: "links", enabled: true, linkId: "", aliases: [] },
      { id: "menu_horarios", label: "Horarios disponiveis", type: "links", enabled: true, linkId: "", aliases: [] },
      { id: "menu_atendimento", label: "Falar com atendimento", type: "handoff", enabled: true, linkId: "", aliases: [] }
    ];
  }

  return [
    { id: "menu_cardapio", label: "Ver cardapio", type: "products", enabled: true, linkId: "", aliases: [] },
    { id: "menu_pedido", label: "Fazer pedido", type: "links", enabled: true, linkId: "", aliases: [] },
    { id: "menu_entrega", label: "Entrega ou retirada", type: "delivery_pickup", enabled: true, linkId: "", aliases: [] },
    { id: "menu_atendimento", label: "Falar com atendimento", type: "handoff", enabled: true, linkId: "", aliases: [] }
  ];
}

function applyBotModel(modelId) {
  const model = BOT_MODELS[modelId];
  if (!model) {
    return;
  }

  onboardingState.tenant.botModel = modelId;

  if (model.type === "kiagenda") {
    onboardingState.tenant.integration.kiagenda.mode = modelId;
    onboardingState.tenant.menu = buildKiagendaMenu(modelId);
  } else {
    onboardingState.tenant.menu = buildStandardMenu(modelId);
  }

  if (!onboardingState.tenant.messages.welcome && model.welcomeHint) {
    onboardingState.tenant.messages.welcome = model.welcomeHint;
  }

  updateSelectedModelUi();
}

function handleModelSelection(modelId) {
  const model = BOT_MODELS[modelId];
  if (!model) {
    return;
  }

  if (model.type === "kiagenda" && !onboardingState.tenant.integration.kiagenda.connected) {
    openKiagendaModal(modelId);
    return;
  }

  applyBotModel(modelId);
}

async function connectKiagenda() {
  const token = onboardingElements.kiagendaTokenInput.value.trim();

  if (!token) {
    throw new Error("Informe o token ou chave KiAgenda para continuar.");
  }

  onboardingState.tenant.integration.kiagenda = {
    connected: true,
    token,
    accountStatus: "connected_demo",
    mode: onboardingState.pendingKiagendaModel || onboardingState.tenant.integration.kiagenda.mode || null
  };

  if (onboardingState.pendingKiagendaModel) {
    applyBotModel(onboardingState.pendingKiagendaModel);
  }

  updateSelectedModelUi();
  closeKiagendaModal();
  setFeedback("Conta KiAgenda conectada em modo preparado para integracao futura.");
}

function renderQrPanel() {
  const qrValue = onboardingState.session?.qr || onboardingState.session?.qrCode || "";
  onboardingElements.whatsappStatusText.textContent = getWhatsappStatusLabel(onboardingState.session);
  applyStatusTone(onboardingElements.whatsappStatusText, getWhatsappStatusTone(onboardingState.session));

  if (!qrValue) {
    const status = String(onboardingState.session?.status || "");
    const waitingMessage = status === "initializing" || status === "authenticated"
      ? "A conexao esta sendo preparada. O status sera atualizado automaticamente em alguns segundos."
      : "O QR Code vai aparecer aqui quando a conexao for iniciada.";
    onboardingElements.whatsappQrPanel.innerHTML = `<p class="muted-copy">${waitingMessage}</p>`;
    return;
  }

  if (String(qrValue).startsWith("data:image")) {
    onboardingElements.whatsappQrPanel.innerHTML = `<img class="qr-image" src="${qrValue}" alt="QR Code do WhatsApp">`;
    return;
  }

  onboardingElements.whatsappQrPanel.innerHTML = `<pre class="qr-raw">${KiagendaApp.escapeHtml(qrValue)}</pre>`;
}

function renderCollectionList(container, items, kind) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = '<li class="item-card"><p>Nada adicionado ainda.</p></li>';
    return;
  }

  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = "item-card";
    listItem.innerHTML = `
      <div>
        <h4>${KiagendaApp.escapeHtml(item.name || item.title || "Sem nome")}</h4>
        <p>${KiagendaApp.escapeHtml(item.price || item.url || "")}</p>
        <p>${KiagendaApp.escapeHtml(item.description || "")}</p>
      </div>
    `;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "danger-button";
    removeButton.textContent = "Remover";
    removeButton.addEventListener("click", () => removeCollectionItem(kind, item.id));

    listItem.appendChild(removeButton);
    container.appendChild(listItem);
  });
}

function renderCollections() {
  renderCollectionList(onboardingElements.productsPreviewList, onboardingState.tenant.products, "products");
  renderCollectionList(onboardingElements.servicesPreviewList, onboardingState.tenant.services, "services");
  renderCollectionList(onboardingElements.linksPreviewList, onboardingState.tenant.links, "links");
}

function renderReview() {
  const tenant = onboardingState.tenant;
  const integration = tenant.integration?.kiagenda || {};

  onboardingElements.reviewGrid.innerHTML = `
    <article class="review-card">
      <h3>Negocio</h3>
      <p><strong>Empresa:</strong> ${KiagendaApp.escapeHtml(tenant.business.name || "-")}</p>
      <p><strong>Atendente:</strong> ${KiagendaApp.escapeHtml(tenant.business.attendantName || "-")}</p>
      <p><strong>Tipo:</strong> ${KiagendaApp.escapeHtml(tenant.business.type || "-")}</p>
      <p><strong>Local:</strong> ${KiagendaApp.escapeHtml(tenant.business.location || "-")}</p>
    </article>
    <article class="review-card">
      <h3>Modelo escolhido</h3>
      <p><strong>Modelo:</strong> ${KiagendaApp.escapeHtml(getModelLabel(tenant.botModel))}</p>
      <p><strong>Conta KiAgenda:</strong> ${integration.connected ? "Conectada" : "Nao conectada"}</p>
      <p><strong>Modo especial:</strong> ${KiagendaApp.escapeHtml(integration.mode || "-")}</p>
    </article>
    <article class="review-card">
      <h3>WhatsApp e conteudo</h3>
      <p><strong>WhatsApp:</strong> ${KiagendaApp.escapeHtml(tenant.whatsapp.number || "-")}</p>
      <p><strong>Produtos:</strong> ${tenant.products.length}</p>
      <p><strong>Servicos:</strong> ${tenant.services.length}</p>
      <p><strong>Links:</strong> ${tenant.links.length}</p>
    </article>
  `;
}

function fillForm() {
  const tenant = onboardingState.tenant;

  onboardingElements.onboardingTitle.textContent = tenant.business.name
    ? `Configure o atendimento de ${tenant.business.name}`
    : "Configure seu atendimento";
  onboardingElements.advancedPanelLink.href = `tenant-edit.html?id=${encodeURIComponent(onboardingState.tenantId)}`;
  onboardingElements.businessNameInput.value = tenant.business.name || "";
  onboardingElements.attendantNameInput.value = tenant.business.attendantName || "";
  onboardingElements.businessTypeInput.value = tenant.business.type || "";
  onboardingElements.businessLocationInput.value = tenant.business.location || "";
  onboardingElements.whatsappNumberInput.value = tenant.whatsapp.number || "";
  renderQrPanel();
  renderCollections();
  updateSelectedModelUi();
}

function syncFormToState() {
  onboardingState.tenant.business.name = onboardingElements.businessNameInput.value.trim();
  onboardingState.tenant.business.attendantName = onboardingElements.attendantNameInput.value.trim() || "Atendimento";
  onboardingState.tenant.business.type = onboardingElements.businessTypeInput.value.trim();
  onboardingState.tenant.business.location = onboardingElements.businessLocationInput.value.trim();
  onboardingState.tenant.whatsapp.number = onboardingElements.whatsappNumberInput.value.trim();
  onboardingState.tenant.whatsapp.sessionId = onboardingState.tenant.whatsapp.sessionId || `${onboardingState.tenantId}-session`;
}

function removeCollectionItem(kind, itemId) {
  onboardingState.tenant[kind] = onboardingState.tenant[kind].filter((item) => item.id !== itemId);
  renderCollections();
}

function addItem() {
  const targetList = onboardingElements.itemKindInput.value === "service" ? "services" : "products";

  onboardingState.tenant[targetList].push({
    id: `${targetList.slice(0, -1)}_${Date.now()}`,
    name: onboardingElements.itemNameInput.value.trim(),
    price: onboardingElements.itemPriceInput.value.trim(),
    description: onboardingElements.itemDescriptionInput.value.trim(),
    link: onboardingElements.itemLinkInput.value.trim(),
    aliases: [],
    keywords: KiagendaApp.parseAliases(onboardingElements.itemKeywordsInput.value)
  });

  onboardingElements.itemNameInput.value = "";
  onboardingElements.itemPriceInput.value = "";
  onboardingElements.itemDescriptionInput.value = "";
  onboardingElements.itemLinkInput.value = "";
  onboardingElements.itemKeywordsInput.value = "";
  renderCollections();
}

function addLink() {
  onboardingState.tenant.links.push({
    id: `link_${Date.now()}`,
    title: onboardingElements.linkTitleInput.value.trim(),
    url: onboardingElements.linkUrlInput.value.trim(),
    description: "",
    aliases: []
  });

  onboardingElements.linkTitleInput.value = "";
  onboardingElements.linkUrlInput.value = "";
  renderCollections();
}

function buildDefaultMenu(tenant) {
  if (tenant.botModel && BOT_MODELS[tenant.botModel]?.type === "kiagenda") {
    return buildKiagendaMenu(tenant.botModel);
  }

  if (tenant.botModel && BOT_MODELS[tenant.botModel]?.type === "standard") {
    return buildStandardMenu(tenant.botModel);
  }

  return [
    {
      id: "menu_sobre",
      label: "Sobre a empresa",
      type: "business_info",
      enabled: true,
      linkId: "",
      aliases: []
    },
    {
      id: "menu_produtos",
      label: "Produtos",
      type: "products",
      enabled: tenant.products.length > 0,
      linkId: "",
      aliases: []
    },
    {
      id: "menu_servicos",
      label: "Servicos",
      type: "services",
      enabled: tenant.services.length > 0,
      linkId: "",
      aliases: []
    },
    {
      id: "menu_links",
      label: "Links importantes",
      type: "links",
      enabled: tenant.links.length > 0,
      linkId: "",
      aliases: []
    },
    {
      id: "menu_atendimento",
      label: "Falar com a equipe",
      type: "handoff",
      enabled: true,
      linkId: "",
      aliases: []
    }
  ];
}

function buildDefaultMessages(tenant) {
  const businessName = tenant.business.name || "nossa equipe";
  const attendantName = tenant.business.attendantName || "Atendimento";
  const model = BOT_MODELS[tenant.botModel];
  const topics = [];

  if (tenant.products.length) topics.push("produtos");
  if (tenant.services.length) topics.push("servicos");
  if (tenant.links.length) topics.push("links");

  const defaultTopics = topics.length ? topics.join(", ") : "informacoes do negocio";
  const hint = model?.welcomeHint || `Posso te ajudar com ${defaultTopics}.`;

  return {
    welcome: tenant.messages.welcome || `Ola! Voce esta falando com ${businessName}. Eu sou ${attendantName}. ${hint}`,
    fallback: tenant.messages.fallback || `Nao entendi muito bem. Posso te mostrar ${defaultTopics} ou chamar ${attendantName}.`,
    handoff: tenant.messages.handoff || `${attendantName} vai continuar com voce em instantes.`
  };
}

function buildPayload() {
  syncFormToState();

  return {
    type: "client",
    active: true,
    botEnabled: true,
    aiEnabled: onboardingState.tenant.aiEnabled !== false,
    onboardingCompleted: false,
    botModel: onboardingState.tenant.botModel,
    business: {
      name: onboardingState.tenant.business.name,
      attendantName: onboardingState.tenant.business.attendantName,
      type: onboardingState.tenant.business.type,
      location: onboardingState.tenant.business.location,
      description: onboardingState.tenant.business.location
        ? `Atendimento em ${onboardingState.tenant.business.location}.`
        : ""
    },
    whatsapp: {
      connected: Boolean(onboardingState.session?.connected),
      number: onboardingState.tenant.whatsapp.number,
      sessionId: onboardingState.tenant.whatsapp.sessionId
    },
    products: onboardingState.tenant.products,
    services: onboardingState.tenant.services,
    links: onboardingState.tenant.links,
    menu: buildDefaultMenu(onboardingState.tenant),
    messages: buildDefaultMessages(onboardingState.tenant),
    settings: onboardingState.tenant.settings,
    integration: onboardingState.tenant.integration
  };
}

async function persistTenant() {
  const payload = {
    tenantId: onboardingState.tenantId,
    ...buildPayload()
  };

  if (onboardingState.isNew) {
    const response = await KiagendaApp.requestJson("/api/tenants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    onboardingState.tenant = response.data;
    onboardingState.isNew = false;
    return response;
  }

  const response = await KiagendaApp.requestJson(`/api/tenants/${onboardingState.tenantId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  onboardingState.tenant = response.data;
  return response;
}

async function refreshWhatsappStatus() {
  try {
    onboardingState.session = await KiagendaApp.requestJson(`/api/tenants/${onboardingState.tenantId}/session`);
  } catch (error) {
    onboardingState.session = createEmptySession(onboardingState.tenantId);
  }

  renderQrPanel();
  await maybeAutoStartWhatsappSession(onboardingState.session);
  return onboardingState.session;
}

function shouldKeepPollingSession(session) {
  const status = String(session?.status || "");

  return ["initializing", "qr", "authenticated", "reconnecting", "restore_pending"].includes(status);
}

function shouldAutoStartSession(session) {
  const status = String(session?.status || "");

  if (onboardingState.sessionAutoStartAttempted) {
    return false;
  }

  if (session?.connected || session?.runtimeActive || session?.runtimeInitializing) {
    return false;
  }

  return ["qr", "restore_pending"].includes(status) && Boolean(session?.hasLocalSessionArtifacts);
}

async function maybeAutoStartWhatsappSession(session) {
  if (!shouldAutoStartSession(session)) {
    return session;
  }

  onboardingState.sessionAutoStartAttempted = true;

  const response = await KiagendaApp.requestJson(`/api/tenants/${onboardingState.tenantId}/session/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      number: onboardingState.tenant?.whatsapp?.number || "",
      sessionId: onboardingState.tenant?.whatsapp?.sessionId || `${onboardingState.tenantId}-session`
    })
  });

  onboardingState.session = response.data;
  renderQrPanel();
  await pollWhatsappStatus();
  return onboardingState.session;
}

async function pollWhatsappStatus(attempt = 0) {
  stopSessionPolling();

  const session = await refreshWhatsappStatus();

  if (!shouldKeepPollingSession(session) || attempt >= 29) {
    return;
  }

  onboardingState.sessionPollTimer = window.setTimeout(() => {
    runAction(() => pollWhatsappStatus(attempt + 1));
  }, 2000);
}

async function connectWhatsapp() {
  syncFormToState();
  await persistTenant();

  const response = await KiagendaApp.requestJson(`/api/tenants/${onboardingState.tenantId}/session/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      number: onboardingState.tenant.whatsapp.number,
      sessionId: onboardingState.tenant.whatsapp.sessionId
    })
  });

  onboardingState.session = response.data;
  renderQrPanel();
  setFeedback(response.message || "Conexao iniciada com sucesso.");
  await pollWhatsappStatus();
}

async function activateOnboarding() {
  const payload = {
    tenantId: onboardingState.tenantId,
    ...buildPayload(),
    onboardingCompleted: true
  };

  const requestOptions = {
    method: onboardingState.isNew ? "POST" : "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  };

  const endpoint = onboardingState.isNew
    ? "/api/tenants"
    : `/api/tenants/${onboardingState.tenantId}`;

  const response = await KiagendaApp.requestJson(endpoint, requestOptions);
  onboardingState.tenant = response.data;
  onboardingState.isNew = false;
  setFeedback(response.message || "Atendimento ativado com sucesso.");
  window.location.href = `tenant-edit.html?id=${encodeURIComponent(onboardingState.tenantId)}`;
}

async function loadOnboarding() {
  onboardingState.tenantId = getTenantIdFromQuery();
  if (!ensureAuthenticatedAccess(onboardingState.tenantId)) {
    return;
  }
  closeKiagendaModal();
  stopSessionPolling();

  try {
    onboardingState.tenant = await KiagendaApp.requestJson(`/api/tenants/${onboardingState.tenantId}`);
    onboardingState.isNew = false;
  } catch (error) {
    onboardingState.tenant = createEmptyTenant(onboardingState.tenantId);
    onboardingState.isNew = true;
  }

  if (onboardingState.tenant?.onboardingCompleted === true) {
    window.location.href = `tenant-edit.html?id=${encodeURIComponent(onboardingState.tenantId)}`;
    return;
  }

  try {
    onboardingState.session = await KiagendaApp.requestJson(`/api/tenants/${onboardingState.tenantId}/session`);
  } catch (error) {
    onboardingState.session = createEmptySession(onboardingState.tenantId);
  }

  fillForm();
  setStep(1);
  await maybeAutoStartWhatsappSession(onboardingState.session);
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    setFeedback(error.message || "Nao foi possivel concluir esta etapa.");
  }
}

onboardingElements.prevStepButton.addEventListener("click", () => setStep(onboardingState.step - 1));
onboardingElements.nextStepButton.addEventListener("click", () => setStep(onboardingState.step + 1));
onboardingElements.activateButton.addEventListener("click", () => runAction(activateOnboarding));
onboardingElements.connectWhatsappButtonSimple.addEventListener("click", () => runAction(connectWhatsapp));
onboardingElements.refreshWhatsappStatusButton.addEventListener("click", () => runAction(refreshWhatsappStatus));
onboardingElements.addItemButton.addEventListener("click", addItem);
onboardingElements.addLinkButtonSimple.addEventListener("click", addLink);
onboardingElements.connectKiagendaButton.addEventListener("click", () => runAction(connectKiagenda));
onboardingElements.closeKiagendaModalButton.addEventListener("click", closeKiagendaModal);
onboardingElements.stepButtons.forEach((button) => {
  button.addEventListener("click", () => setStep(button.dataset.stepTarget));
});
onboardingElements.standardModelButtons.forEach((button) => {
  button.addEventListener("click", () => handleModelSelection(button.dataset.modelId));
});
onboardingElements.kiagendaModelCards.forEach((card) => {
  card.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-kiagenda-modal]")) {
      return;
    }

    openKiagendaModal(card.dataset.modelId);
  });
});
onboardingElements.kiagendaModalTriggers.forEach((button) => {
  button.addEventListener("click", () => openKiagendaModal(button.dataset.openKiagendaModal));
});

loadOnboarding().catch((error) => {
  setFeedback(error.message || "Nao foi possivel carregar o onboarding.");
});

window.addEventListener("pageshow", () => {
  const tenantId = onboardingState.tenantId || getTenantIdFromQuery();
  if (tenantId) {
    ensureAuthenticatedAccess(tenantId);
  }
});
