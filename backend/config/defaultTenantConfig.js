const defaultTenantConfig = {
  tenantId: "",
  type: "client",
  active: true,
  botEnabled: true,
  aiEnabled: true,
  plan: "essential",
  subscriptionStatus: "active",
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
    sessionId: ""
  },
  products: [],
  services: [],
  partnerships: [],
  links: [],
  advancedOptions: [],
  menu: [
    {
      id: "menu_sobre",
      label: "Sobre a empresa",
      type: "business_info",
      enabled: true,
      aliases: ["sobre", "empresa", "quem sao", "quem e"]
    },
    {
      id: "menu_produtos",
      label: "Produtos",
      type: "products",
      enabled: true,
      aliases: ["produtos", "cardapio", "catalogo"]
    },
    {
      id: "menu_servicos",
      label: "Servicos",
      type: "services",
      enabled: true,
      aliases: ["servicos"]
    },
    {
      id: "menu_atendimento",
      label: "Atendimento",
      type: "handoff",
      enabled: true,
      aliases: ["atendente", "humano", "atendimento"]
    }
  ],
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
  },
  meta: {
    createdAt: "",
    updatedAt: ""
  }
};

module.exports = { defaultTenantConfig };
