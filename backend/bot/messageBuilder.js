const {
  findCategoryById,
  getActiveCatalogCategoriesWithItems
} = require("../utils/catalogCategories");

function joinAliases(items) {
  return items.filter(Boolean).join(", ");
}

function buildSeparator() {
  return "------------";
}

function joinBlocks(blocks) {
  return blocks.filter(Boolean).join("\n\n");
}

function getAttendantLabel(config) {
  const attendantName = String(config?.business?.attendantName || "").trim();
  return attendantName && attendantName.toLowerCase() !== "atendimento" ? attendantName : "nossa equipe";
}

function getBotAdjustablePrompt(config) {
  return config?.botProfile?.adjustablePrompt || {};
}

function getServiceWorkflow(config) {
  return config?.botProfile?.serviceWorkflow || {};
}

function isServicesBotProfile(config) {
  const niche = String(config?.botProfile?.niche || "").trim().toLowerCase();
  const promptMode = String(config?.botProfile?.promptMode || "").trim().toLowerCase();
  const botModel = String(config?.botModel || "").trim().toLowerCase();
  return niche === "services" || promptMode === "services" || botModel === "services_agendamento";
}

function getServiceClosingQuestion(config) {
  const focus = String(getBotAdjustablePrompt(config)?.focoAtendimento || "").toLowerCase();
  const nextStep = String(getServiceWorkflow(config)?.nextStep || "").toLowerCase();

  if (focus.includes("reuniao")) {
    return "Voce ja tem algo em mente ou quer que eu te encaminhe para atendimento?";
  }

  if (nextStep === "schedule_meeting") {
    return "Se quiser, posso te encaminhar para marcar uma reuniao.";
  }

  if (focus.includes("lead")) {
    return "Quer que eu te explique melhor ou te encaminhe para atendimento?";
  }

  return "Quer que eu te explique melhor ou te encaminhe para atendimento?";
}

function hasCustomerProfile(state) {
  return Boolean(state?.customerName && state?.customerRegion);
}

function buildDynamicMenuLines(config) {
  const lines = [];
  const categories = getActiveCatalogCategoriesWithItems(config);

  categories.forEach((category, index) => {
    const trigger = category.keywords?.[0] || category.name;
    lines.push(`${index + 1}. ${category.name}${trigger ? ` (digite: ${trigger})` : ""}`);
  });

  if (Array.isArray(config.links) && config.links.length) {
    lines.push(`${lines.length + 1}. Links importantes (digite: links)`);
  }

  lines.push(`${lines.length + 1}. Falar com atendimento (digite: atendimento)`);
  return lines;
}

function buildProfileCollectionPrompt(config) {
  return joinBlocks([
    `Ola! Seja bem-vindo(a) ao ${config.business.name || "nosso negocio"}`,
    "Sou um assistente, mas estou aqui para agilizar seu atendimento.",
    "Para comecar, me diga:",
    "- Seu nome\n- De qual cidade ou regiao voce esta falando"
  ]);
}

function buildPersonalizedMenuMessage(config, state) {
  return joinBlocks([
    `Prazer, ${state.customerName}!`,
    `Voce esta em ${state.customerRegion}, certo?`,
    `Enquanto ${getAttendantLabel(config)} nao pode lhe atender no momento, eu vou te ajudar com as opcoes disponiveis por aqui.`,
    "Agora me diga como posso te ajudar:",
    buildMenuMessage(config)
  ]);
}

function buildProfileCollectionRetryMessage() {
  return joinBlocks([
    "Para eu continuar, me envie estas duas informacoes na mesma mensagem:",
    "- Seu nome\n- Sua cidade ou regiao"
  ]);
}

function buildWelcomeMessage(config) {
  if (config.messages.welcome) {
    return interpolate(config.messages.welcome, config);
  }

  if (isServicesBotProfile(config)) {
    return joinBlocks([
      `Ola! Voce esta falando com ${config.business.name || "nossa equipe"}.`,
      "Posso te ajudar a entender os servicos e organizar seu atendimento inicial.",
      buildMenuMessage(config)
    ]);
  }

  return joinBlocks([
    `Ola! Voce esta falando com ${config.business.name || "nossa equipe"}.`,
    "Escolha uma opcao do menu:",
    buildMenuMessage(config)
  ]);
}

function buildMenuMessage(config) {
  const enabledItems = buildDynamicMenuLines(config);

  if (!enabledItems.length) {
    return "No momento nao ha opcoes ativas no menu.";
  }

  return enabledItems.join("\n");
}

function buildBusinessMessage(config) {
  const lines = [
    config.business.name ? `${config.business.name}` : "",
    config.business.type ? `Tipo: ${config.business.type}` : "",
    config.business.description || "",
    getServiceWorkflow(config)?.serviceProcess ? `Como funciona o atendimento: ${getServiceWorkflow(config).serviceProcess}` : ""
  ];

  return lines.filter(Boolean).join("\n");
}

function resolveCatalogTarget(config, target, fallbackTitle = "", fallbackSingularLabel = "item") {
  if (typeof target === "object" && target) {
    return {
      id: target.id || "",
      title: target.name || fallbackTitle || "Categoria",
      singularLabel: fallbackSingularLabel,
      items: Array.isArray(target.items) ? target.items : []
    };
  }

  const category = findCategoryById(config, String(target || ""));

  if (category) {
    return {
      id: category.id,
      title: category.name,
      singularLabel: fallbackSingularLabel,
      items: Array.isArray(category.items) ? category.items : []
    };
  }

  const items = Array.isArray(config?.[target]) ? config[target] : [];

  return {
    id: String(target || ""),
    title: fallbackTitle || "Categoria",
    singularLabel: fallbackSingularLabel,
    items
  };
}

function buildCatalogMessage(config, key, title) {
  const target = resolveCatalogTarget(config, key, title);
  const items = target.items;

  if (!items.length) {
    return `${target.title}: nada cadastrado no momento.`;
  }

  const blocks = items.map((item, index) => {
    const lines = [
      `${index + 1}. ${item.name || "Item sem nome"}`,
      item.offer ? `Oferta: ${item.offer}` : "",
      item.price ? `Preco: ${item.price}` : "",
      item.description || "",
      item.link ? `Link: ${item.link}` : "",
      buildSeparator()
    ];

    return joinBlocks(lines);
  });

  return `${target.title}:\n\n${blocks.join("\n\n")}`;
}

function buildCatalogListMessage(config, key, title, singularLabel) {
  const target = resolveCatalogTarget(config, key, title, singularLabel);
  const items = target.items;

  if (!items.length) {
    return `${target.title}: nada cadastrado no momento.`;
  }

  const names = items
    .map((item) => item.name)
    .filter(Boolean)
    .map((name) => `- ${name}`);

  return `Claro.\n\nEstas sao as opcoes de ${target.title.toLowerCase()}:\n\n${names.join("\n")}\n\nDigite o nome do ${target.singularLabel.toLowerCase()} que voce quer conhecer melhor.`;
}

function buildCatalogItemMessage(item) {
  const blocks = [
    item?.name || "Item sem nome",
    item?.description || "",
    item?.offer ? `Oferta: ${item.offer}` : "",
    item?.price ? `Preco: ${item.price}` : "",
    item?.link ? `Saiba mais:\n${item.link}` : "",
    "Se quiser, posso te encaminhar para atendimento."
  ];

  return joinBlocks(blocks);
}

function buildServiceDetailMessage(config, item, options = {}) {
  const detailLevel = String(getBotAdjustablePrompt(config)?.nivelDetalhe || "").toLowerCase();
  const workflow = getServiceWorkflow(config);
  const shouldBeShort = detailLevel.includes("curto");
  const shouldBeDetailed = detailLevel.includes("explic");
  const blocks = [item?.name || "Servico"];

  if (item?.description) {
    blocks.push(item.description);
  }

  if (item?.price && workflow?.priceDisplayMode !== "do_not_inform") {
    blocks.push(
      workflow?.priceDisplayMode === "starting_at_only"
        ? `Valor a partir de ${item.price}`
        : `Preco: ${item.price}`
    );
  } else if (options.includeMissingPriceHint) {
    blocks.push("Esse servico e sob consulta e depende da necessidade do cliente.");
  }

  if (shouldBeDetailed && item?.link) {
    blocks.push(`Saiba mais:\n${item.link}`);
  }

  if (shouldBeDetailed && workflow?.serviceProcess) {
    blocks.push(`Como funciona: ${workflow.serviceProcess}`);
  }

  if (!shouldBeShort) {
    blocks.push(getServiceClosingQuestion(config));
  }

  return joinBlocks(blocks);
}

function buildCatalogMatchesMessage(items, title, singularLabel) {
  const names = items
    .map((item) => item.name)
    .filter(Boolean)
    .map((name) => `- ${name}`);

  return `Encontrei mais de um ${singularLabel.toLowerCase()} em ${title.toLowerCase()}.\n\n${names.join("\n")}\n\nDigite o nome do ${singularLabel.toLowerCase()} que voce quer conhecer melhor.`;
}

function buildCatalogChoiceHelpMessage(config, key, title, singularLabel) {
  return `Nao consegui identificar qual ${singularLabel.toLowerCase()} voce quer.\n\n${buildCatalogListMessage(config, key, title, singularLabel)}`;
}

function buildLinksMessage(config) {
  if (!config.links.length) {
    return "Nenhum link ativo foi encontrado.";
  }

  const items = config.links
    .map((link) => link.title)
    .filter(Boolean)
    .map((title) => `- ${title}`);

  return `Claro.\n\nEstes sao os links disponiveis:\n\n${items.join("\n")}\n\nDigite o nome do link que voce quer receber.`;
}

function buildSpecificLinkMessage(config, link) {
  return `${link.title}: ${link.url}`;
}

function buildLinkMatchesMessage(links) {
  const items = links
    .map((link) => link.title)
    .filter(Boolean)
    .map((title) => `- ${title}`);

  return `Encontrei mais de um link parecido.\n\n${items.join("\n")}\n\nDigite o nome do link que voce quer receber.`;
}

function buildLinkChoiceHelpMessage(config) {
  return `Nao consegui identificar qual link voce quer.\n\n${buildLinksMessage(config)}`;
}

function buildHandoffMessage(config) {
  if (config.messages.handoff) {
    return interpolate(config.messages.handoff, config);
  }

  if (isServicesBotProfile(config)) {
    const workflow = getServiceWorkflow(config);
    const nextStep = String(workflow?.nextStep || "").toLowerCase();

    if (nextStep === "schedule_meeting") {
      return "Vou te encaminhar para o responsavel continuar e alinhar uma reuniao com voce.";
    }

    if (nextStep === "send_link") {
      return workflow?.nextStepDetails || `${getAttendantLabel(config)} vai continuar com voce e te passar o proximo link de atendimento.`;
    }

    return `${getAttendantLabel(config)} vai continuar com voce e pode te orientar no proximo passo do atendimento.`;
  }

  return `${getAttendantLabel(config)} vai continuar por aqui em instantes.`;
}

function buildFallbackMessage(config) {
  if (config.messages.fallback) {
    return interpolate(config.messages.fallback, config);
  }

  if (isServicesBotProfile(config)) {
    return `Nao entendi totalmente sua mensagem ainda.\n\nPosso te mostrar os servicos, explicar um servico especifico ou te encaminhar para atendimento.`;
  }

  return `Nao entendi sua mensagem. Responda com uma opcao do menu:\n${buildMenuMessage(config)}`;
}

function buildDeliveryPickupMessage(config) {
  return `Se voce quiser entrega ou retirada, envie a opcao desejada e ${getAttendantLabel(config)} continua com voce.`;
}

function buildMenuHints(config) {
  const enabledItems = config.menu.filter((item) => item.enabled);

  return enabledItems
    .map((item) => `${item.label}${item.aliases.length ? ` (${joinAliases(item.aliases)})` : ""}`)
    .join("\n");
}

function interpolate(template, config) {
  return String(template || "")
    .replaceAll("{{business.name}}", config.business.name || "")
    .replaceAll("{{business.attendantName}}", config.business.attendantName || "")
    .replaceAll("{{business.type}}", config.business.type || "");
}

module.exports = {
  buildBusinessMessage,
  buildCatalogChoiceHelpMessage,
  buildCatalogItemMessage,
  buildCatalogListMessage,
  buildCatalogMatchesMessage,
  buildCatalogMessage,
  buildDeliveryPickupMessage,
  buildFallbackMessage,
  buildServiceDetailMessage,
  buildHandoffMessage,
  buildLinksMessage,
  buildLinkChoiceHelpMessage,
  buildLinkMatchesMessage,
  buildMenuHints,
  buildMenuMessage,
  buildPersonalizedMenuMessage,
  buildProfileCollectionPrompt,
  buildProfileCollectionRetryMessage,
  buildSpecificLinkMessage,
  getBotAdjustablePrompt,
  getServiceWorkflow,
  buildWelcomeMessage,
  hasCustomerProfile
};
