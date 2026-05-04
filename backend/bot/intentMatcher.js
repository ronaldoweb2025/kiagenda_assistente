const {
  getActiveCatalogCategoriesWithItems,
  isServiceCategory
} = require("../utils/catalogCategories");

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeKeywordVariant(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  return normalized.endsWith("s") && normalized.length > 3 ? normalized.slice(0, -1) : normalized;
}

function calculateScore(message, service) {
  const normalizedMessage = normalizeText(message);
  const keywords = Array.isArray(service?.keywords)
    ? service.keywords.map((item) => normalizeText(item)).filter(Boolean)
    : [];

  if (!normalizedMessage || !keywords.length) {
    return 0;
  }

  const normalizedMessageVariant = normalizeKeywordVariant(normalizedMessage);
  const matches = keywords.filter((keyword) => {
    const keywordVariant = normalizeKeywordVariant(keyword);

    return (
      normalizedMessage.includes(keyword) ||
      normalizedMessage.includes(keywordVariant) ||
      normalizedMessageVariant.includes(keyword) ||
      normalizedMessageVariant.includes(keywordVariant)
    );
  });

  return matches.length / keywords.length;
}

function matchBestService(message, services = []) {
  let bestMatch = null;

  for (const service of services) {
    const score = calculateScore(message, service);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { service, score };
    }
  }

  return bestMatch;
}

function getCatalogCandidates(item) {
  return [
    ...(item?.keywords || []).map((candidate) => ({ value: normalizeText(candidate), priority: 3 })),
    ...(item?.aliases || []).map((candidate) => ({ value: normalizeText(candidate), priority: 2 })),
    item?.name ? [{ value: normalizeText(item.name), priority: 1 }] : []
  ].filter((candidate) => candidate.value);
}

function scoreCandidateMatch(text, candidateEntry) {
  const candidate = candidateEntry?.value || "";
  const textVariant = normalizeKeywordVariant(text);
  const candidateVariant = normalizeKeywordVariant(candidate);
  const priority = Number(candidateEntry?.priority || 0);

  if (!text || !candidate) {
    return 0;
  }

  if (text === candidate || textVariant === candidateVariant) {
    return 50 + priority;
  }

  if (text.includes(candidate) || text.includes(candidateVariant) || textVariant.includes(candidate) || textVariant.includes(candidateVariant)) {
    return (candidate.split(/\s+/).length > 1 ? 40 : 30) + priority;
  }

  if (candidate.includes(text) || candidateVariant.includes(textVariant)) {
    return 20 + priority;
  }

  return 0;
}

function includesAny(text, terms) {
  return terms.some((term) => term && text.includes(normalizeText(term)));
}

function isIdentityQuestion(text) {
  if (!text) {
    return false;
  }

  if (/\b(?:voce|vc)\s+e\b.*\b(?:ronaldo|humano|robo|assistente|atendente)\b/.test(text)) {
    return true;
  }

  if (/\be\b.*\b(?:ronaldo|humano|robo|assistente|atendente)\b/.test(text) && text.includes("?")) {
    return true;
  }

  return [
    "voce e o",
    "voce e a",
    "vc e o",
    "vc e a",
    "e voce mesmo",
    "e vc mesmo",
    "e humano",
    "voce e humano",
    "vc e humano",
    "e robo",
    "voce e robo",
    "vc e robo",
    "estou falando com quem",
    "to falando com quem",
    "quem esta falando",
    "quem fala",
    "quem e voce",
    "quem e vc"
  ].some((term) => text.includes(term));
}

function findAdvancedOptionMatch(text, config) {
  const options = Array.isArray(config?.advancedOptions) ? config.advancedOptions : [];

  return options.find((item) => {
    if (!item?.enabled) {
      return false;
    }

    const candidates = [item.label, ...(item.keywords || [])];
    return includesAny(text, candidates);
  }) || null;
}

function findMenuMatch(text, config) {
  return config.menu.find((item) => {
    if (!item.enabled) {
      return false;
    }

    const candidates = [item.label, item.id, ...(item.aliases || [])];
    return includesAny(text, candidates);
  });
}

function findLinkMatch(text, config) {
  return config.links.find((link) => {
    const candidates = [link.title, link.url, ...(link.aliases || [])];
    return includesAny(text, candidates);
  });
}

function findCatalogMatch(text, items) {
  let bestMatch = null;

  for (const item of items) {
    for (const candidate of getCatalogCandidates(item)) {
      const score = scoreCandidateMatch(text, candidate);

      if (!score) {
        continue;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { item, score };
      }
    }
  }

  return bestMatch?.item || null;
}

function findCatalogCategoryMatch(text, config) {
  const categories = getActiveCatalogCategoriesWithItems(config);

  return categories.find((category) => {
    const candidates = [category.name, ...(category.keywords || [])];
    return includesAny(text, candidates);
  }) || null;
}

function findCatalogItemMatch(text, config) {
  const categories = getActiveCatalogCategoriesWithItems(config);

  for (const category of categories) {
    if (isServiceCategory(category)) {
      const bestServiceMatch = matchBestService(text, category.items || []);

      if (bestServiceMatch?.service && bestServiceMatch.score >= 0.6) {
        return {
          intent: "detalhe_categoria_item",
          categoryId: category.id,
          itemId: bestServiceMatch.service.id,
          confidenceScore: bestServiceMatch.score,
          matchSource: "keywords"
        };
      }

      if (bestServiceMatch?.service && bestServiceMatch.score >= 0.3) {
        return {
          intent: "confirmar_servico_categoria",
          categoryId: category.id,
          itemId: bestServiceMatch.service.id,
          confidenceScore: bestServiceMatch.score,
          matchSource: "keywords"
        };
      }
    }

    const itemMatch = findCatalogMatch(text, category.items || []);

    if (itemMatch) {
      return {
        intent: "detalhe_categoria_item",
        categoryId: category.id,
        itemId: itemMatch.id
      };
    }
  }

  return null;
}

function resolveMenuIntent(menuItem) {
  switch (menuItem?.type) {
    case "business_info":
      return { intent: "menu", menuAction: "business_info" };
    case "products":
      return { intent: "menu", menuAction: "menu" };
    case "services":
      return { intent: "menu", menuAction: "menu" };
    case "partnerships":
      return { intent: "menu", menuAction: "menu" };
    case "links":
      return { intent: "menu", menuAction: "links" };
    case "specific_link":
      return { intent: "ver_link_especifico", menuAction: "specific_link", linkId: menuItem.linkId };
    case "delivery_pickup":
      return { intent: "entrega_retirada", menuAction: "delivery_pickup" };
    case "handoff":
      return { intent: "atendimento_humano", menuAction: "handoff" };
    case "custom":
      return {
        intent: "menu_customizado",
        menuAction: "custom",
        customReply: String(menuItem?.customReply || ""),
        menuItemId: String(menuItem?.id || "")
      };
    default:
      return { intent: "menu", menuAction: "menu" };
  }
}

function resolveAdvancedOptionIntent(option) {
  const actionType = String(option?.actionType || "").trim();

  switch (actionType) {
    case "links":
      return { intent: "menu", menuAction: "links", source: "advanced_option", optionId: option.id };
    case "handoff":
      return { intent: "atendimento_humano", menuAction: "handoff", source: "advanced_option", optionId: option.id };
    case "customReply":
    default:
      return {
        intent: "menu_customizado",
        menuAction: "custom",
        customReply: String(option?.customReply || ""),
        optionId: String(option?.id || ""),
        source: "advanced_option"
      };
  }
}

function matchIntent(message, config) {
  const text = normalizeText(message);

  if (!text) {
    return { intent: "menu" };
  }

  if (includesAny(text, ["oi", "ola", "bom dia", "boa tarde", "boa noite"])) {
    return { intent: "saudacao" };
  }

  if (isIdentityQuestion(text)) {
    return { intent: "duvida_identidade" };
  }

  if (includesAny(text, ["menu", "opcoes", "opcao", "inicio", "comecar", "quais opcoes"])) {
    return { intent: "menu" };
  }

  if (includesAny(text, ["link", "links", "catalogo", "agenda", "agendamento"])) {
    return { intent: "menu", menuAction: "links" };
  }

  if (includesAny(text, ["entrega", "retirada", "buscar", "delivery"])) {
    return { intent: "entrega_retirada" };
  }

  if (includesAny(text, [
    "quero falar com humano",
    "falar com humano",
    "quero falar com atendente",
    "falar com atendente",
    "chama atendente",
    "chamar atendente",
    "chama uma pessoa",
    "chamar uma pessoa",
    "quero atendimento humano",
    "me passa para atendimento",
    "me encaminha",
    "pode chamar o ronaldo",
    "quero falar com ronaldo"
  ])) {
    return { intent: "atendimento_humano" };
  }

  const serviceCategory = findCatalogCategoryMatch("servicos", config);
  const categoryItemMatch = findCatalogItemMatch(text, config);

  if (categoryItemMatch) {
    return categoryItemMatch;
  }

  if (serviceCategory && includesAny(text, ["servico", "servicos", "o que voce faz", "quais servicos", "opcoes de servico"])) {
    return { intent: "ver_categoria", categoryId: serviceCategory.id };
  }

  if (serviceCategory && includesAny(text, [
    "site",
    "sites",
    "landing page",
    "pagina de vendas",
    "trafego",
    "anuncio",
    "anuncios",
    "facebook ads",
    "google ads",
    "google meu negocio",
    "google maps",
    "aparecer no google",
    "seo",
    "orcamento",
    "preco",
    "valor",
    "quanto custa"
  ])) {
    const itemMatch = findCatalogItemMatch(text, config);

    if (itemMatch) {
      return itemMatch;
    }

    return { intent: "ver_categoria", categoryId: serviceCategory.id };
  }

  const linkMatch = findLinkMatch(text, config);

  if (linkMatch) {
    return { intent: "ver_link_especifico", linkId: linkMatch.id };
  }

  const menuMatch = findMenuMatch(text, config);

  if (menuMatch) {
    return resolveMenuIntent(menuMatch);
  }

  const advancedOptionMatch = findAdvancedOptionMatch(text, config);

  if (advancedOptionMatch) {
    return resolveAdvancedOptionIntent(advancedOptionMatch);
  }

  const categoryMatch = findCatalogCategoryMatch(text, config);

  if (categoryMatch) {
    return { intent: "ver_categoria", categoryId: categoryMatch.id };
  }

  return { intent: "fora_do_escopo" };
}

module.exports = {
  calculateScore,
  matchBestService,
  matchIntent
};
