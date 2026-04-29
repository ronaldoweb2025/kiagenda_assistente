function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function normalizeBoolean(value, fallbackValue = true) {
  if (value === undefined) {
    return Boolean(fallbackValue);
  }

  return Boolean(value);
}

function normalizeNumber(value, fallbackValue) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallbackValue;
}

function normalizeMediaAsset(asset) {
  if (!asset) {
    return null;
  }

  if (typeof asset === "string") {
    const dataUrl = normalizeString(asset);
    return dataUrl
      ? {
          dataUrl,
          mimeType: "",
          fileName: "",
          sizeBytes: 0
        }
      : null;
  }

  if (typeof asset !== "object") {
    return null;
  }

  const dataUrl = normalizeString(asset.dataUrl);

  if (!dataUrl) {
    return null;
  }

  return {
    dataUrl,
    mimeType: normalizeString(asset.mimeType),
    fileName: normalizeString(asset.fileName),
    sizeBytes: Number(asset.sizeBytes || 0) || 0
  };
}

function normalizeMediaAssetList(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => normalizeMediaAsset(item)).filter(Boolean).slice(0, 3);
}

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCategoryType(value) {
  const normalized = normalizeString(value).toLowerCase();

  if (normalized === "customreply") {
    return "customReply";
  }

  if (normalized === "handoff") {
    return "handoff";
  }

  return "catalog";
}

function normalizeCategoryItems(items, prefix = "category_item") {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      const images = normalizeMediaAssetList(item?.images);
      const image = normalizeMediaAsset(item?.image) || images[0] || null;
      const imageUrls = Array.isArray(item?.imageUrls)
        ? item.imageUrls.map((entry) => normalizeString(typeof entry === "string" ? entry : entry?.dataUrl)).filter(Boolean)
        : images.map((asset) => asset.dataUrl).filter(Boolean);
      const price = normalizeString(item?.price);
      const offer = normalizeString(item?.offer) || price;

      return {
        id: normalizeString(item?.id) || `${prefix}_${index + 1}`,
        name: normalizeString(item?.name),
        offer,
        description: normalizeString(item?.description),
        price,
        link: normalizeString(item?.link),
        aliases: normalizeStringList(item?.aliases),
        keywords: normalizeStringList(item?.keywords),
        imageUrls,
        images,
        image,
        audio: normalizeMediaAsset(item?.audio)
      };
    })
    .filter((item) => item.name || item.offer || item.price || item.description || item.link || item.imageUrls.length);
}

function getLegacyCategoryDefinitions() {
  return [
    {
      legacyKey: "products",
      id: "category_products",
      name: "Produtos",
      keywords: ["produtos", "produto", "catalogo", "cardapio"],
      order: 0
    },
    {
      legacyKey: "services",
      id: "category_services",
      name: "Servicos",
      keywords: ["servicos", "servico", "agendamento"],
      order: 1
    },
    {
      legacyKey: "partnerships",
      id: "category_partnerships",
      name: "Revenda e Parcerias",
      keywords: ["revenda", "parceria", "parcerias", "representante", "distribuidor"],
      order: 2
    }
  ];
}

function buildLegacyCategoriesFromTenant(input = {}) {
  return getLegacyCategoryDefinitions().map((definition) => ({
    id: definition.id,
    name: definition.name,
    keywords: definition.keywords,
    type: "catalog",
    enabled: true,
    order: definition.order,
    legacyKey: definition.legacyKey,
    customReply: "",
    items: normalizeCategoryItems(input?.[definition.legacyKey], definition.legacyKey)
  }));
}

function normalizeCategories(categories, fallbackTenant = {}) {
  const sourceCategories = Array.isArray(categories) && categories.length
    ? categories
    : buildLegacyCategoriesFromTenant(fallbackTenant);

  return sourceCategories.map((category, index) => {
    const normalizedName = normalizeString(category?.name) || `Categoria ${index + 1}`;
    const normalizedType = normalizeCategoryType(category?.type);
    const legacyKey = normalizeString(category?.legacyKey).toLowerCase();
    const categoryId = normalizeString(category?.id) || `category_${slugify(normalizedName) || index + 1}`;

    return {
      id: categoryId,
      name: normalizedName,
      keywords: normalizeStringList(category?.keywords || category?.aliases),
      type: normalizedType,
      enabled: normalizeBoolean(category?.enabled, true),
      order: normalizeNumber(category?.order, index),
      legacyKey: ["products", "services", "partnerships"].includes(legacyKey) ? legacyKey : "",
      customReply: normalizeString(category?.customReply),
      items: normalizedType === "catalog"
        ? normalizeCategoryItems(category?.items, categoryId)
        : []
    };
  });
}

function upsertCategoryByLegacyKey(categories = [], definition, items = []) {
  const existingIndex = categories.findIndex((category) => category.legacyKey === definition.legacyKey || category.id === definition.id);
  const normalizedItems = normalizeCategoryItems(items, definition.legacyKey);

  if (existingIndex >= 0) {
    const existingCategory = categories[existingIndex];

    categories[existingIndex] = {
      ...existingCategory,
      id: existingCategory.id || definition.id,
      name: existingCategory.name || definition.name,
      keywords: normalizeStringList(existingCategory.keywords?.length ? existingCategory.keywords : definition.keywords),
      type: "catalog",
      enabled: existingCategory.enabled !== false,
      order: Number.isFinite(Number(existingCategory.order)) ? Number(existingCategory.order) : definition.order,
      legacyKey: definition.legacyKey,
      customReply: normalizeString(existingCategory.customReply),
      items: Array.isArray(existingCategory.items) && existingCategory.items.length
        ? normalizeCategoryItems(existingCategory.items, existingCategory.id || definition.id)
        : normalizedItems
    };

    return;
  }

  if (!normalizedItems.length) {
    return;
  }

  categories.push({
    id: definition.id,
    name: definition.name,
    keywords: normalizeStringList(definition.keywords),
    type: "catalog",
    enabled: true,
    order: definition.order,
    legacyKey: definition.legacyKey,
    customReply: "",
    items: normalizedItems
  });
}

function syncLegacyCollectionsFromCategories(tenant = {}, categories = []) {
  const normalizedCategories = Array.isArray(categories) ? categories : [];
  const products = findLegacyCategory({ categories: normalizedCategories }, "products")?.items || [];
  const services = findLegacyCategory({ categories: normalizedCategories }, "services")?.items || [];
  const partnerships = findLegacyCategory({ categories: normalizedCategories }, "partnerships")?.items || [];

  return {
    ...tenant,
    categories: normalizedCategories,
    products: normalizeCategoryItems(products, "product"),
    services: normalizeCategoryItems(services, "service"),
    partnerships: normalizeCategoryItems(partnerships, "partnership")
  };
}

function migrateCategoriesSafely(tenant = {}) {
  const definitions = getLegacyCategoryDefinitions();
  const normalizedCategories = normalizeCategories(tenant.categories, tenant);
  const nextCategories = normalizedCategories.map((category) => ({ ...category }));

  definitions.forEach((definition) => {
    upsertCategoryByLegacyKey(nextCategories, definition, tenant?.[definition.legacyKey] || []);
  });

  const sortedCategories = sortCategories(
    nextCategories.map((category, index) => ({
      ...category,
      order: Number.isFinite(Number(category.order)) ? Number(category.order) : index
    }))
  );

  return syncLegacyCollectionsFromCategories(tenant, sortedCategories);
}

function sortCategories(categories = []) {
  return [...categories].sort((left, right) => {
    const orderDiff = Number(left?.order || 0) - Number(right?.order || 0);

    if (orderDiff !== 0) {
      return orderDiff;
    }

    return normalizeString(left?.name).localeCompare(normalizeString(right?.name), "pt-BR");
  });
}

function getCatalogCategories(tenant = {}) {
  return sortCategories((Array.isArray(tenant?.categories) ? tenant.categories : []).filter((category) => category?.type === "catalog"));
}

function findCategoryById(tenant = {}, categoryId) {
  return (Array.isArray(tenant?.categories) ? tenant.categories : []).find((category) => category.id === categoryId) || null;
}

function findLegacyCategory(tenant = {}, legacyKey) {
  return getCatalogCategories(tenant).find((category) => category.legacyKey === legacyKey) || null;
}

function getLegacyCollectionFromCategories(tenant = {}, legacyKey) {
  return findLegacyCategory(tenant, legacyKey)?.items || [];
}

function getActiveCatalogCategoriesWithItems(tenant = {}) {
  return getCatalogCategories(tenant).filter((category) => category.enabled !== false && Array.isArray(category.items) && category.items.length > 0);
}

function isServiceCategory(category = {}) {
  if (category?.legacyKey === "services") {
    return true;
  }

  const tokens = [category?.name, ...(category?.keywords || [])]
    .map((value) => slugify(value))
    .filter(Boolean);

  return tokens.some((token) => token.includes("servico") || token.includes("servicos") || token.includes("agendamento"));
}

module.exports = {
  buildLegacyCategoriesFromTenant,
  findCategoryById,
  findLegacyCategory,
  getActiveCatalogCategoriesWithItems,
  getCatalogCategories,
  getLegacyCategoryDefinitions,
  getLegacyCollectionFromCategories,
  isServiceCategory,
  migrateCategoriesSafely,
  normalizeCategories,
  normalizeCategoryItems,
  normalizeCategoryType,
  sortCategories,
  syncLegacyCollectionsFromCategories
};
