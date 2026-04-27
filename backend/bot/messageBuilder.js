function joinAliases(items) {
  return items.filter(Boolean).join(", ");
}

function buildSeparator() {
  return "━━━━━━━━━━━━";
}

function joinBlocks(blocks) {
  return blocks.filter(Boolean).join("\n\n");
}

function getAttendantLabel(config) {
  const attendantName = String(config?.business?.attendantName || "").trim();
  return attendantName && attendantName.toLowerCase() !== "atendimento" ? attendantName : "nossa equipe";
}

function hasCustomerProfile(state) {
  return Boolean(state?.customerName && state?.customerRegion);
}

function buildDynamicMenuLines(config) {
  const lines = [];

  if (Array.isArray(config.services) && config.services.length) {
    lines.push("• Servicos (digite: servicos)");
  }

  if (Array.isArray(config.products) && config.products.length) {
    lines.push("• Produtos (digite: produtos)");
  }

  if (Array.isArray(config.links) && config.links.length) {
    lines.push("• Links (digite: links)");
  }

  lines.push("• Falar com atendimento (digite: atendimento)");

  return lines;
}

function buildProfileCollectionPrompt(config) {
  return joinBlocks([
    `Ola! Seja bem-vindo(a) ao ${config.business.name || "nosso negocio"}`,
    "Sou um assistente, mas estou aqui para agilizar seu atendimento.",
    "Para comecar, me diga:",
    "• Seu nome\n• De qual cidade ou regiao voce esta falando"
  ]);
}

function buildPersonalizedMenuMessage(config, state) {
  return joinBlocks([
    `Prazer, ${state.customerName}!`,
    `Voce esta em ${state.customerRegion}, certo?`,
    `Enquanto ${getAttendantLabel(config)} esta em atendimento, eu vou te ajudar com as opcoes disponiveis por aqui.`,
    "Agora me diga como posso te ajudar:",
    buildMenuMessage(config)
  ]);
}

function buildProfileCollectionRetryMessage() {
  return joinBlocks([
    "Para eu continuar, me envie estas duas informacoes na mesma mensagem:",
    "• Seu nome\n• Sua cidade ou regiao"
  ]);
}

function buildWelcomeMessage(config) {
  if (config.messages.welcome) {
    return interpolate(config.messages.welcome, config);
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
    config.business.description || ""
  ];

  return lines.filter(Boolean).join("\n");
}

function buildCatalogMessage(config, key, title) {
  const items = config[key];

  if (!items.length) {
    return `${title}: nada cadastrado no momento.`;
  }

  const blocks = items.map((item, index) => {
    const lines = [
      `${index + 1}. ${item.name || "Item sem nome"}`,
      item.price ? `Preco: ${item.price}` : "",
      item.description ? `${item.description}` : "",
      item.link ? `Link: ${item.link}` : "",
      buildSeparator()
    ];

    return joinBlocks(lines);
  });

  return `${title}:\n\n${blocks.join("\n\n")}`;
}

function buildCatalogListMessage(config, key, title, singularLabel) {
  const items = config[key];

  if (!items.length) {
    return `${title}: nada cadastrado no momento.`;
  }

  const names = items
    .map((item) => item.name)
    .filter(Boolean)
    .map((name) => `• ${name}`);

  return `Claro 😊\n\nEstes sao os ${title.toLowerCase()} disponiveis:\n\n${names.join("\n")}\n\nDigite o nome do ${singularLabel.toLowerCase()} que voce quer conhecer melhor.`;
}

function buildCatalogItemMessage(item) {
  const blocks = [
    item?.name || "Item sem nome",
    item?.description || "",
    item?.price ? `💰 ${item.price}` : "",
    item?.link ? `👉 Saiba mais:\n${item.link}` : "",
    "Se quiser, posso te encaminhar para atendimento."
  ];

  return joinBlocks(blocks);
}

function buildCatalogMatchesMessage(items, title, singularLabel) {
  const names = items
    .map((item) => item.name)
    .filter(Boolean)
    .map((name) => `• ${name}`);

  return `Encontrei mais de um ${singularLabel.toLowerCase()} parecido.\n\n${names.join("\n")}\n\nDigite o nome do ${singularLabel.toLowerCase()} que voce quer conhecer melhor.`;
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
    .map((title) => `• ${title}`);

  return `Claro 😊\n\nEstes sao os links disponiveis:\n\n${items.join("\n")}\n\nDigite o nome do link que voce quer receber.`;
}

function buildSpecificLinkMessage(config, link) {
  return `${link.title}: ${link.url}`;
}

function buildLinkMatchesMessage(links) {
  const items = links
    .map((link) => link.title)
    .filter(Boolean)
    .map((title) => `• ${title}`);

  return `Encontrei mais de um link parecido.\n\n${items.join("\n")}\n\nDigite o nome do link que voce quer receber.`;
}

function buildLinkChoiceHelpMessage(config) {
  return `Nao consegui identificar qual link voce quer.\n\n${buildLinksMessage(config)}`;
}

function buildHandoffMessage(config) {
  if (config.messages.handoff) {
    return interpolate(config.messages.handoff, config);
  }

  return `${getAttendantLabel(config)} vai continuar por aqui em instantes.`;
}

function buildFallbackMessage(config) {
  if (config.messages.fallback) {
    return interpolate(config.messages.fallback, config);
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
  buildWelcomeMessage,
  hasCustomerProfile
};
