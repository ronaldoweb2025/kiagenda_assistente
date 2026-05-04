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

function isKiagendaBot(config) {
  const botModel = String(config?.botModel || config?.integration?.kiagenda?.mode || "").trim().toLowerCase();
  return botModel === "kiagenda_servicos";
}

function isLojaOnlineBot(config) {
  const botModel = String(config?.botModel || "").trim().toLowerCase();
  return botModel === "loja_online";
}

function findSchedulingLink(config) {
  const links = Array.isArray(config?.links) ? config.links : [];
  const scoringTerms = ["agend", "agenda", "horar", "calend", "marcar"];
  let bestLink = null;

  links.forEach((link) => {
    const rawText = [link?.title, link?.description, link?.url, ...(link?.aliases || [])].join(" ").toLowerCase();
    const score = scoringTerms.reduce((total, term) => total + (rawText.includes(term) ? 1 : 0), 0);

    if (score > 0 && (!bestLink || score > bestLink.score)) {
      bestLink = {
        score,
        link
      };
    }
  });

  return bestLink?.link || null;
}

function buildSchedulingCta(config, intro = "Voce pode ver os horarios disponiveis e agendar direto por aqui") {
  const schedulingLink = findSchedulingLink(config);

  if (schedulingLink?.url) {
    return `${intro} 👇\n${schedulingLink.url}`;
  }

  if (schedulingLink?.title) {
    return `${intro} 👇\n${schedulingLink.title}`;
  }

  return `${intro}.`;
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
    `Oi! Voce esta falando com ${config.business.name || "nossa equipe"}.`,
    "Me conta rapidinho como posso te ajudar hoje."
  ]);
}

function buildPersonalizedMenuMessage(config, state) {
  const firstName = String(state.customerName || "").split(/\s+/).filter(Boolean)[0] || state.customerName;
  const serviceHint = buildMainServiceQuestion(config);

  return joinBlocks([
    firstName ? `Prazer, ${firstName}.` : "",
    state.customerRegion ? `${state.customerRegion} anotado por aqui.` : "",
    serviceHint
  ]);
}

function buildProfileCollectionRetryMessage() {
  return "Entendi mais ou menos. Voce quer ajuda com servicos, produtos, links ou atendimento?";
}

function buildWelcomeMessage(config) {
  const customWelcome = String(config.messages?.welcome || "").trim();

  if (customWelcome && !isServicesBotProfile(config)) {
    return interpolate(config.messages.welcome, config);
  }

  if (isServicesBotProfile(config)) {
    return `Oi! Tudo bem? Me conta rapidinho como posso te ajudar hoje.`;
  }

  if (isKiagendaBot(config)) {
    return joinBlocks([
      "Oi! Tudo bem?",
      "Posso te ajudar com informacoes ou te direcionar para o agendamento."
    ]);
  }

  if (isLojaOnlineBot(config)) {
    return joinBlocks([
      "Oi! Tudo bem?",
      "Me conta o que voce procura que eu te ajudo por aqui."
    ]);
  }

  return "Oi! Tudo bem? Me conta como posso te ajudar hoje.";
}

function buildMenuMessage(config) {
  const enabledItems = buildDynamicMenuLines(config);

  if (!enabledItems.length) {
    return "No momento nao ha opcoes ativas no menu.";
  }

  return `Posso te ajudar com estas opcoes:\n${enabledItems.join("\n")}`;
}

function buildMainServiceQuestion(config) {
  const categories = getActiveCatalogCategoriesWithItems(config);
  const servicesCategory = categories.find((category) => String(category.legacyKey || "").toLowerCase() === "services") || categories[0];
  const serviceNames = (servicesCategory?.items || [])
    .map((item) => item?.name)
    .filter(Boolean)
    .slice(0, 3);

  if (serviceNames.length >= 2) {
    return `Posso te ajudar com ${serviceNames.join(", ")}. Qual desses faz mais sentido pra voce?`;
  }

  if (serviceNames.length === 1) {
    return `Posso te ajudar com ${serviceNames[0]}. O que voce gostaria de saber?`;
  }

  return "Me conta o que voce precisa que eu te direciono pelo melhor caminho.";
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

  return `Claro. Hoje tenho estas opcoes de ${target.title.toLowerCase()}:\n\n${names.join("\n")}\n\nQual delas faz mais sentido pra voce?`;
}

function buildCatalogItemMessage(configOrItem, maybeItem) {
  const config = maybeItem ? configOrItem : null;
  const item = maybeItem || configOrItem;
  const isStoreBot = isLojaOnlineBot(config);
  const blocks = [
    item?.name || "Item sem nome",
    item?.description || "",
    item?.offer ? `Oferta: ${item.offer}` : "",
    item?.price ? `Preco: ${item.price}` : "",
    item?.link
      ? isStoreBot
        ? `Voce pode ver mais detalhes ou comprar por aqui 👇\n${item.link}`
        : `Saiba mais:\n${item.link}`
      : "",
    !item?.link && isStoreBot
      ? "Se quiser, posso te direcionar para atendimento para te passar o link."
      : !isStoreBot
        ? "Se quiser, posso te encaminhar para atendimento."
        : ""
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

  if (isKiagendaBot(config)) {
    blocks.push(buildSchedulingCta(config, "Fica bem mais facil ver os horarios disponiveis e agendar por aqui"));
    return joinBlocks(blocks);
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
  if (config.messages.handoff && !isServicesBotProfile(config)) {
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

    return "Claro, vou encaminhar para o atendimento. Assim que possivel alguem te responde por aqui.";
  }

  if (isKiagendaBot(config)) {
    return buildSchedulingCta(config, "Voce pode seguir pelo sistema de agendamento por aqui");
  }

  return "Claro, vou encaminhar para o atendimento. Assim que possivel alguem te responde por aqui.";
}

function buildFallbackMessage(config) {
  if (config.messages.fallback && !isServicesBotProfile(config)) {
    return interpolate(config.messages.fallback, config);
  }

  if (isServicesBotProfile(config)) {
    return buildMainServiceQuestion(config);
  }

  if (isKiagendaBot(config)) {
    return `Posso te ajudar com informacoes basicas e te direcionar para o agendamento.\n\n${buildSchedulingCta(config, "Fica bem mais facil agendar direto por aqui")}`;
  }

  if (isLojaOnlineBot(config)) {
    return "Posso te mostrar o produto, informar o preco se estiver cadastrado e te passar o link de compra.";
  }

  return "Entendi mais ou menos. Voce quer ajuda com servicos, produtos, links ou atendimento?";
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
  buildMainServiceQuestion,
  buildPersonalizedMenuMessage,
  buildProfileCollectionPrompt,
  buildProfileCollectionRetryMessage,
  buildSpecificLinkMessage,
  getBotAdjustablePrompt,
  findSchedulingLink,
  buildSchedulingCta,
  getServiceWorkflow,
  isKiagendaBot,
  isLojaOnlineBot,
  buildWelcomeMessage,
  hasCustomerProfile
};
