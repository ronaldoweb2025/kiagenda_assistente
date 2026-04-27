const CLOUD_UPGRADE_URL = "https://kiagenda.com.br";
const STORAGE_KEY = "kiagenda.extension.essentialConfig";

const defaultState = {
  business: { name: "", attendantName: "", type: "" },
  messages: { welcome: "", fallback: "", handoff: "" },
  products: [],
  services: [],
  links: [],
  selectedModel: "standard"
};

const models = {
  standard: {
    label: "Atendimento padrao",
    description: "Focado em apresentar as principais informacoes do negocio e direcionar para produtos, servicos, links ou atendimento.",
    buildMessages(state) {
      const businessName = state.business.name || "nosso negocio";
      const attendantName = state.business.attendantName || "nosso atendimento";
      return {
        welcome: `Ola! Seja bem-vindo ao ${businessName}.\n\nSou o assistente virtual e estou aqui para ajudar voce.\n\nVoce pode pedir produtos, servicos, links ou falar com atendimento.`,
        fallback: "Nao entendi muito bem.\n\nVoce pode me pedir assim:\n\n• produtos\n• servicos\n• links\n• atendimento",
        handoff: `Perfeito.\n\nJa estou encaminhando voce para ${attendantName}. Ele vai te atender em instantes.`
      };
    }
  },
  store: {
    label: "Loja online",
    description: "Focado em apresentar produtos, links de compra e facilitar o contato para fechar pedidos.",
    buildMessages(state) {
      const businessName = state.business.name || "nossa loja";
      const attendantName = state.business.attendantName || "nosso atendimento";
      return {
        welcome: `Ola! Bem-vindo a ${businessName}.\n\nPosso mostrar nossos produtos, links importantes e te encaminhar para atendimento quando precisar.`,
        fallback: "Posso te ajudar com produtos, links importantes ou atendimento.\n\nDigite o que voce procura para eu te mostrar.",
        handoff: `Certo.\n\nVou encaminhar voce para ${attendantName} finalizar esse atendimento.`
      };
    }
  },
  services: {
    label: "Servicos",
    description: "Focado em apresentar servicos, orientar o cliente e facilitar o contato para agendamento ou atendimento.",
    buildMessages(state) {
      const businessName = state.business.name || "nosso negocio";
      const attendantName = state.business.attendantName || "nosso atendimento";
      return {
        welcome: `Ola! Seja bem-vindo ao ${businessName}.\n\nPosso mostrar nossos servicos, links importantes e te encaminhar para atendimento humano se voce quiser.`,
        fallback: "Posso te ajudar com servicos, links ou atendimento.\n\nDigite servicos para ver as opcoes disponiveis.",
        handoff: `Combinado.\n\nVou encaminhar voce para ${attendantName} continuar esse atendimento.`
      };
    }
  },
  delivery: {
    label: "Delivery",
    description: "Focado em apresentar cardapio, links de pedido e facilitar o contato para entrega ou retirada.",
    buildMessages(state) {
      const businessName = state.business.name || "nosso delivery";
      const attendantName = state.business.attendantName || "nosso atendimento";
      return {
        welcome: `Ola! Bem-vindo ao ${businessName}.\n\nPosso mostrar o cardapio, links de pedido e te encaminhar para atendimento se voce precisar de ajuda com entrega ou retirada.`,
        fallback: "Posso te ajudar com cardapio, links de pedido ou atendimento.\n\nDigite produtos, links ou atendimento.",
        handoff: `Tudo certo.\n\nVou encaminhar voce para ${attendantName} ajudar com o seu pedido.`
      };
    }
  },
  custom: {
    label: "Personalizado",
    description: "Comece com uma base simples e ajuste as mensagens como preferir.",
    buildMessages(state) {
      return {
        welcome: state.messages.welcome || "Ola! Como posso ajudar voce hoje?",
        fallback: state.messages.fallback || "Nao entendi muito bem. Me diga se voce procura produtos, servicos, links ou atendimento.",
        handoff: state.messages.handoff || "Perfeito. Vou encaminhar voce para atendimento humano."
      };
    }
  }
};

const state = clone(defaultState);
const ui = { section: "business", tab: "products", catalogEditId: null, linkEditId: null, context: null };

const el = {
  saveAllButton: document.getElementById("saveAllButton"),
  saveStatus: document.getElementById("saveStatus"),
  sections: [...document.querySelectorAll(".panel-section")],
  navButtons: [...document.querySelectorAll(".sidebar-link")],
  businessName: document.getElementById("businessName"),
  attendantName: document.getElementById("attendantName"),
  businessType: document.getElementById("businessType"),
  modelGrid: document.getElementById("modelGrid"),
  modelTitle: document.getElementById("modelTitle"),
  modelDescription: document.getElementById("modelDescription"),
  modelOptions: document.getElementById("modelOptions"),
  messageCards: [...document.querySelectorAll(".message-card")],
  catalogTabs: [...document.querySelectorAll(".tab-button")],
  catalogForm: document.getElementById("catalogForm"),
  catalogName: document.getElementById("catalogName"),
  catalogPrice: document.getElementById("catalogPrice"),
  catalogDescription: document.getElementById("catalogDescription"),
  catalogLink: document.getElementById("catalogLink"),
  catalogSubmitButton: document.getElementById("catalogSubmitButton"),
  catalogCancelEditButton: document.getElementById("catalogCancelEditButton"),
  catalogList: document.getElementById("catalogList"),
  linkForm: document.getElementById("linkForm"),
  linkTitle: document.getElementById("linkTitle"),
  linkUrl: document.getElementById("linkUrl"),
  linkSubmitButton: document.getElementById("linkSubmitButton"),
  linkCancelEditButton: document.getElementById("linkCancelEditButton"),
  linksList: document.getElementById("linksList"),
  linkSuggestions: [...document.querySelectorAll("[data-link-suggestion]")],
  testForm: document.getElementById("testForm"),
  testMessageInput: document.getElementById("testMessageInput"),
  testResponseOutput: document.getElementById("testResponseOutput"),
  testSuggestionButtons: [...document.querySelectorAll("[data-test-message]")],
  upgradeButton: document.getElementById("upgradeButton")
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMultiline(value) {
  return escapeHtml(value || "").replace(/\n/g, "<br>");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function setStatus(message, tone = "neutral") {
  el.saveStatus.textContent = message;
  el.saveStatus.className = `status-pill ${tone}`;
}

function businessToState() {
  state.business.name = el.businessName.value.trim();
  state.business.attendantName = el.attendantName.value.trim();
  state.business.type = el.businessType.value.trim();
}

function fillBusiness() {
  el.businessName.value = state.business.name || "";
  el.attendantName.value = state.business.attendantName || "";
  el.businessType.value = state.business.type || "";
}

function currentModelKey() {
  return models[state.selectedModel] ? state.selectedModel : "standard";
}

function applyModel(modelKey, save = true) {
  state.selectedModel = models[modelKey] ? modelKey : "standard";
  if (state.selectedModel !== "custom") {
    state.messages = models[state.selectedModel].buildMessages(state);
  }
  renderModels();
  renderModelInfo();
  renderMessageCards();
  if (save) saveState("Modelo atualizado com sucesso.");
}

function renderModels() {
  el.modelGrid.innerHTML = Object.entries(models).map(([key, model]) => `
    <button type="button" class="model-card${state.selectedModel === key ? " active" : ""}" data-model="${key}">
      <span class="model-card-label">${escapeHtml(model.label)}</span>
      <span class="model-card-copy">${escapeHtml(model.description)}</span>
    </button>
  `).join("");

  [...el.modelGrid.querySelectorAll("[data-model]")].forEach((button) => {
    button.addEventListener("click", () => applyModel(button.dataset.model));
  });
}

function modelOptions() {
  const hasProducts = state.products.length > 0;
  const hasServices = state.services.length > 0;
  const hasLinks = state.links.length > 0;
  const all = {
    standard: [
      ["Produtos", hasProducts, hasProducts ? "Mostra os produtos cadastrados." : "Cadastre produtos para ativar esta opcao."],
      ["Servicos", hasServices, hasServices ? "Mostra os servicos cadastrados." : "Cadastre servicos para ativar esta opcao."],
      ["Links importantes", hasLinks, hasLinks ? "Mostra os links cadastrados." : "Cadastre links para ativar esta opcao."],
      ["Falar com atendimento", true, "Encaminha para atendimento humano."]
    ],
    store: [
      ["Produtos", hasProducts, hasProducts ? "Apresenta os produtos cadastrados." : "Cadastre produtos para ativar esta opcao."],
      ["Links importantes", hasLinks, hasLinks ? "Mostra links de compra e contato." : "Cadastre links para ativar esta opcao."],
      ["Falar com atendimento", true, "Facilita o contato para fechar pedidos."]
    ],
    services: [
      ["Servicos", hasServices, hasServices ? "Apresenta os servicos cadastrados." : "Cadastre servicos para ativar esta opcao."],
      ["Links importantes", hasLinks, hasLinks ? "Mostra links de contato e agendamento." : "Cadastre links para ativar esta opcao."],
      ["Falar com atendimento", true, "Encaminha para atendimento humano."]
    ],
    delivery: [
      ["Cardapio / Produtos", hasProducts, hasProducts ? "Mostra os itens disponiveis." : "Cadastre produtos para ativar esta opcao."],
      ["Links de pedido", hasLinks, hasLinks ? "Mostra links para pedidos." : "Cadastre links para ativar esta opcao."],
      ["Entrega ou retirada", true, "Ajuda o cliente a seguir para atendimento humano."],
      ["Falar com atendimento", true, "Encaminha para atendimento humano."]
    ],
    custom: [
      ["Produtos", hasProducts, hasProducts ? "Mostra os produtos cadastrados." : "Cadastre produtos para ativar esta opcao."],
      ["Servicos", hasServices, hasServices ? "Mostra os servicos cadastrados." : "Cadastre servicos para ativar esta opcao."],
      ["Links importantes", hasLinks, hasLinks ? "Mostra os links cadastrados." : "Cadastre links para ativar esta opcao."],
      ["Falar com atendimento", true, "Encaminha para atendimento humano."]
    ]
  };

  return all[currentModelKey()];
}

function renderModelInfo() {
  const model = models[currentModelKey()];
  el.modelTitle.textContent = model.label;
  el.modelDescription.textContent = model.description;
  el.modelOptions.innerHTML = modelOptions().map(([title, enabled, helper]) => `
    <article class="option-card${enabled ? " enabled" : ""}">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(helper)}</p>
    </article>
  `).join("");
}

function renderMessageCards() {
  el.messageCards.forEach((card) => {
    const key = card.dataset.messageKey;
    card.querySelector(".message-preview").innerHTML = formatMultiline(state.messages[key] || "");
    card.querySelector("textarea").value = state.messages[key] || "";
  });
}

function openMessageEditor(card) {
  card.classList.add("editing");
  card.querySelector(".message-preview").classList.add("hidden");
  card.querySelector(".message-edit-button").classList.add("hidden");
  card.querySelector(".message-editor").classList.remove("hidden");
}

function closeMessageEditor(card, reset = false) {
  const key = card.dataset.messageKey;
  if (reset) card.querySelector("textarea").value = state.messages[key] || "";
  card.classList.remove("editing");
  card.querySelector(".message-preview").classList.remove("hidden");
  card.querySelector(".message-edit-button").classList.remove("hidden");
  card.querySelector(".message-editor").classList.add("hidden");
}

function bindMessageCards() {
  el.messageCards.forEach((card) => {
    card.querySelector(".message-edit-button").addEventListener("click", () => openMessageEditor(card));
    card.querySelector(".message-cancel-button").addEventListener("click", () => closeMessageEditor(card, true));
    card.querySelector(".message-save-button").addEventListener("click", () => {
      const key = card.dataset.messageKey;
      state.messages[key] = card.querySelector("textarea").value.trim();
      state.selectedModel = "custom";
      renderModels();
      renderModelInfo();
      renderMessageCards();
      closeMessageEditor(card);
      saveState("Mensagem atualizada com sucesso.");
    });
  });
}

function aliasesFromName(name) {
  const words = normalize(name).split(/\s+/).filter((word) => word.length > 2);
  return [...new Set([normalize(name), ...words])].filter(Boolean);
}

function aliasesFromLink(title) {
  const base = aliasesFromName(title);
  if (normalize(title).includes("loja")) base.push("comprar", "site");
  if (normalize(title).includes("instagram")) base.push("instagram", "rede social");
  if (normalize(title).includes("agendamento")) base.push("agendar", "horario");
  return [...new Set(base)];
}

function currentCatalog() {
  return ui.tab === "products" ? state.products : state.services;
}

function setCurrentCatalog(items) {
  if (ui.tab === "products") state.products = items;
  else state.services = items;
}

function fillCatalogForm(item = null) {
  el.catalogName.value = item?.name || "";
  el.catalogPrice.value = item?.price || "";
  el.catalogDescription.value = item?.description || "";
  el.catalogLink.value = item?.link || "";
}

function resetCatalogForm() {
  ui.catalogEditId = null;
  fillCatalogForm();
  el.catalogSubmitButton.textContent = "Adicionar item";
  el.catalogCancelEditButton.classList.add("hidden");
}

function renderCatalogTabs() {
  el.catalogTabs.forEach((button) => button.classList.toggle("active", button.dataset.tab === ui.tab));
}

function renderCatalogList() {
  const items = currentCatalog();
  const label = ui.tab === "products" ? "produto" : "servico";
  if (!items.length) {
    el.catalogList.innerHTML = `<div class="empty-state">Nenhum ${label} cadastrado ainda.</div>`;
    renderModelInfo();
    return;
  }

  el.catalogList.innerHTML = items.map((item) => `
    <article class="list-card">
      <div>
        <h4>${escapeHtml(item.name)}</h4>
        <p>${escapeHtml(item.description || "Sem descricao cadastrada.")}</p>
        <div class="meta-row">
          ${item.price ? `<span class="meta-pill">${escapeHtml(item.price)}</span>` : ""}
          ${item.link ? '<span class="meta-pill">Com link</span>' : ""}
        </div>
      </div>
      <div class="item-actions">
        <button type="button" class="neutral-button" data-catalog-edit="${item.id}">Editar</button>
        <button type="button" class="danger-button" data-catalog-remove="${item.id}">Remover</button>
      </div>
    </article>
  `).join("");

  [...el.catalogList.querySelectorAll("[data-catalog-edit]")].forEach((button) => {
    button.addEventListener("click", () => {
      const item = currentCatalog().find((entry) => entry.id === button.dataset.catalogEdit);
      ui.catalogEditId = item.id;
      fillCatalogForm(item);
      el.catalogSubmitButton.textContent = "Salvar alteracoes";
      el.catalogCancelEditButton.classList.remove("hidden");
    });
  });

  [...el.catalogList.querySelectorAll("[data-catalog-remove]")].forEach((button) => {
    button.addEventListener("click", () => {
      setCurrentCatalog(currentCatalog().filter((entry) => entry.id !== button.dataset.catalogRemove));
      resetCatalogForm();
      renderCatalogList();
      saveState("Item removido com sucesso.");
    });
  });

  renderModelInfo();
}

function handleCatalogSubmit(event) {
  event.preventDefault();
  const name = el.catalogName.value.trim();
  if (!name) {
    setStatus("Preencha o nome do item.", "warning");
    return;
  }

  const data = {
    name,
    price: el.catalogPrice.value.trim(),
    description: el.catalogDescription.value.trim(),
    link: el.catalogLink.value.trim(),
    aliases: aliasesFromName(name)
  };

  if (ui.catalogEditId) {
    setCurrentCatalog(currentCatalog().map((item) => item.id === ui.catalogEditId ? { ...item, ...data } : item));
  } else {
    setCurrentCatalog([...currentCatalog(), { id: uniqueId(), ...data }]);
  }

  resetCatalogForm();
  renderCatalogList();
  saveState("Item salvo com sucesso.");
}

function fillLinkForm(item = null) {
  el.linkTitle.value = item?.title || "";
  el.linkUrl.value = item?.url || "";
}

function resetLinkForm() {
  ui.linkEditId = null;
  fillLinkForm();
  el.linkSubmitButton.textContent = "Adicionar link";
  el.linkCancelEditButton.classList.add("hidden");
}

function renderLinks() {
  if (!state.links.length) {
    el.linksList.innerHTML = '<div class="empty-state">Nenhum link cadastrado ainda.</div>';
    renderModelInfo();
    return;
  }

  el.linksList.innerHTML = state.links.map((item) => `
    <article class="list-card">
      <div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.url)}</p>
      </div>
      <div class="item-actions">
        <button type="button" class="neutral-button" data-link-edit="${item.id}">Editar</button>
        <button type="button" class="danger-button" data-link-remove="${item.id}">Remover</button>
      </div>
    </article>
  `).join("");

  [...el.linksList.querySelectorAll("[data-link-edit]")].forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.links.find((entry) => entry.id === button.dataset.linkEdit);
      ui.linkEditId = item.id;
      fillLinkForm(item);
      el.linkSubmitButton.textContent = "Salvar alteracoes";
      el.linkCancelEditButton.classList.remove("hidden");
    });
  });

  [...el.linksList.querySelectorAll("[data-link-remove]")].forEach((button) => {
    button.addEventListener("click", () => {
      state.links = state.links.filter((entry) => entry.id !== button.dataset.linkRemove);
      resetLinkForm();
      renderLinks();
      saveState("Link removido com sucesso.");
    });
  });

  renderModelInfo();
}

function handleLinkSubmit(event) {
  event.preventDefault();
  const title = el.linkTitle.value.trim();
  const url = el.linkUrl.value.trim();
  if (!title || !url) {
    setStatus("Preencha o nome e a URL do link.", "warning");
    return;
  }

  const data = { title, url, aliases: aliasesFromLink(title) };
  if (ui.linkEditId) {
    state.links = state.links.map((item) => item.id === ui.linkEditId ? { ...item, ...data } : item);
  } else {
    state.links = [...state.links, { id: uniqueId(), ...data }];
  }

  resetLinkForm();
  renderLinks();
  saveState("Link salvo com sucesso.");
}

function showSection(sectionId) {
  ui.section = sectionId;
  el.sections.forEach((section) => section.classList.toggle("active", section.dataset.section === sectionId));
  el.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.target === sectionId));
}

function findMatches(items, message) {
  const input = normalize(message);
  return items.filter((item) => {
    const itemName = normalize(item.name);
    if (itemName.includes(input) || input.includes(itemName)) return true;
    return (item.aliases || []).some((alias) => input.includes(alias) || alias.includes(input));
  });
}

function buildListResponse(items, plural) {
  if (!items.length) return `Ainda nao temos ${plural} cadastrados por aqui.`;
  return `Claro.\n\nEstes sao os ${plural} disponiveis:\n\n${items.map((item) => `• ${item.name}`).join("\n")}\n\nDigite o nome do ${plural === "produtos" ? "produto" : "servico"} que voce quer conhecer melhor.`;
}

function buildDetail(item) {
  return [
    item.name,
    item.description || "",
    item.price ? `Preco: ${item.price}` : "",
    item.link ? `Saiba mais:\n${item.link}` : "",
    "Se quiser, posso te encaminhar para atendimento."
  ].filter(Boolean).join("\n\n");
}

function buildLinksResponse() {
  if (!state.links.length) return "Ainda nao temos links cadastrados por aqui.";
  return `Claro.\n\nAqui estao os links importantes:\n\n${state.links.map((item) => `• ${item.title}\n${item.url}`).join("\n\n")}`;
}

function simulate(message) {
  const input = normalize(message);
  if (!input) return "Digite uma mensagem para testar.";
  if (["oi", "ola", "bom dia", "boa tarde", "boa noite", "menu"].some((term) => input.includes(term))) {
    ui.context = null;
    return state.messages.welcome;
  }
  if (input.includes("produt")) {
    ui.context = "products";
    return buildListResponse(state.products, "produtos");
  }
  if (input.includes("servic")) {
    ui.context = "services";
    return buildListResponse(state.services, "servicos");
  }
  if (input.includes("link") || input.includes("site") || input.includes("instagram")) {
    ui.context = null;
    return buildLinksResponse();
  }
  if (input.includes("atendimento") || input.includes("humano")) {
    ui.context = null;
    return state.messages.handoff;
  }

  const catalog = ui.context === "products" ? state.products : ui.context === "services" ? state.services : [];
  if (catalog.length) {
    const matches = findMatches(catalog, input);
    if (matches.length === 1) {
      ui.context = null;
      return buildDetail(matches[0]);
    }
    if (matches.length > 1) {
      return `Encontrei mais de uma opcao parecida:\n\n${matches.map((item) => `• ${item.name}`).join("\n")}\n\nDigite o nome que voce quer conhecer melhor.`;
    }
    return `Nao encontrei esse ${ui.context === "products" ? "produto" : "servico"}. Digite um dos nomes listados para eu te mostrar melhor.`;
  }

  const directProduct = findMatches(state.products, input);
  if (directProduct.length === 1) return buildDetail(directProduct[0]);
  const directService = findMatches(state.services, input);
  if (directService.length === 1) return buildDetail(directService[0]);
  return state.messages.fallback;
}

function saveState(message = "Configuracoes salvas com sucesso.") {
  businessToState();
  chrome.storage.local.set({ [STORAGE_KEY]: state })
    .then(() => setStatus(message, "success"))
    .catch(() => setStatus("Nao foi possivel salvar agora.", "error"));
}

function normalizeLoaded(saved) {
  const merged = {
    ...clone(defaultState),
    ...(saved || {}),
    business: { ...clone(defaultState.business), ...(saved?.business || {}) },
    messages: { ...clone(defaultState.messages), ...(saved?.messages || {}) }
  };

  merged.products = Array.isArray(saved?.products) ? saved.products.map((item) => ({
    id: item.id || uniqueId(),
    name: item.name || "",
    price: item.price || "",
    description: item.description || "",
    link: item.link || "",
    aliases: Array.isArray(item.aliases) && item.aliases.length ? item.aliases : aliasesFromName(item.name || "")
  })) : [];

  merged.services = Array.isArray(saved?.services) ? saved.services.map((item) => ({
    id: item.id || uniqueId(),
    name: item.name || "",
    price: item.price || "",
    description: item.description || "",
    link: item.link || "",
    aliases: Array.isArray(item.aliases) && item.aliases.length ? item.aliases : aliasesFromName(item.name || "")
  })) : [];

  merged.links = Array.isArray(saved?.links) ? saved.links.map((item) => ({
    id: item.id || uniqueId(),
    title: item.title || "",
    url: item.url || "",
    aliases: Array.isArray(item.aliases) && item.aliases.length ? item.aliases : aliasesFromLink(item.title || "")
  })) : [];

  merged.selectedModel = models[merged.selectedModel] ? merged.selectedModel : "standard";
  if (!merged.messages.welcome || !merged.messages.fallback || !merged.messages.handoff) {
    merged.messages = models[merged.selectedModel].buildMessages(merged);
  }
  return merged;
}

function bindEvents() {
  el.navButtons.forEach((button) => button.addEventListener("click", () => showSection(button.dataset.target)));
  el.saveAllButton.addEventListener("click", () => saveState());
  [el.businessName, el.attendantName, el.businessType].forEach((field) => {
    field.addEventListener("input", () => {
      businessToState();
      if (state.selectedModel !== "custom") {
        state.messages = models[currentModelKey()].buildMessages(state);
        renderMessageCards();
      }
      renderModelInfo();
      setStatus("Alteracoes locais", "neutral");
    });
  });

  bindMessageCards();
  el.catalogTabs.forEach((button) => button.addEventListener("click", () => {
    ui.tab = button.dataset.tab;
    renderCatalogTabs();
    resetCatalogForm();
    renderCatalogList();
  }));
  el.catalogForm.addEventListener("submit", handleCatalogSubmit);
  el.catalogCancelEditButton.addEventListener("click", resetCatalogForm);
  el.linkForm.addEventListener("submit", handleLinkSubmit);
  el.linkCancelEditButton.addEventListener("click", resetLinkForm);
  el.linkSuggestions.forEach((button) => button.addEventListener("click", () => {
    el.linkTitle.value = button.dataset.linkSuggestion || "";
    el.linkTitle.focus();
  }));

  el.testForm.addEventListener("submit", (event) => {
    event.preventDefault();
    el.testResponseOutput.textContent = simulate(el.testMessageInput.value.trim());
  });
  el.testSuggestionButtons.forEach((button) => button.addEventListener("click", () => {
    el.testMessageInput.value = button.dataset.testMessage || "";
    el.testResponseOutput.textContent = simulate(button.dataset.testMessage || "");
  }));
  el.upgradeButton.addEventListener("click", () => chrome.tabs.create({ url: CLOUD_UPGRADE_URL }));
}

async function init() {
  bindEvents();
  const result = await chrome.storage.local.get(STORAGE_KEY);
  Object.assign(state, normalizeLoaded(result[STORAGE_KEY]));
  fillBusiness();
  renderModels();
  renderModelInfo();
  renderMessageCards();
  renderCatalogTabs();
  renderCatalogList();
  renderLinks();
  showSection("business");
  setStatus("Configuracoes carregadas", "success");
}

init().catch(() => {
  fillBusiness();
  renderModels();
  renderModelInfo();
  renderMessageCards();
  renderCatalogTabs();
  renderCatalogList();
  renderLinks();
  showSection("business");
  setStatus("Nao foi possivel carregar agora.", "error");
});
