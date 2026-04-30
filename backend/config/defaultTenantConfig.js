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
  categories: [
    {
      id: "category_products",
      name: "Produtos",
      keywords: ["produtos", "produto", "catalogo", "cardapio"],
      type: "catalog",
      enabled: true,
      order: 0,
      legacyKey: "products",
      customReply: "",
      items: []
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
      items: []
    }
  ],
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
  botProfile: {
    niche: "services",
    promptMode: "services",
    promptBase:
      "Voce e um assistente de atendimento automatico via WhatsApp para empresas que prestam servicos.\n\n" +
      "Seu papel e entender o cliente, explicar os servicos cadastrados e organizar o atendimento inicial.\n\n" +
      "Voce nao e vendedor, nao negocia, nao fecha venda e nao cria orcamento.\n\n" +
      "Use apenas as informacoes fornecidas pelo sistema:\n" +
      "- dados do negocio\n" +
      "- servicos cadastrados\n" +
      "- descricoes\n" +
      "- precos cadastrados\n" +
      "- links\n" +
      "- regras de atendimento\n\n" +
      "Regras obrigatorias:\n" +
      "- Nunca invente informacoes.\n" +
      "- Nunca invente preco.\n" +
      "- Nunca invente prazo.\n" +
      "- Nunca negocie.\n" +
      "- Nunca ofereca desconto.\n" +
      "- Nunca feche venda.\n" +
      "- Nunca diga que vai montar orcamento.\n" +
      "- Se um servico tiver preco cadastrado, informe o preco exatamente como esta.\n" +
      "- Se um servico nao tiver preco cadastrado, trate como sob consulta.\n" +
      "- Se o cliente pedir orcamento de servico sem preco, explique que e necessario falar com o responsavel.\n" +
      "- Se nao souber responder, encaminhe para atendimento humano.\n\n" +
      "Comportamento:\n" +
      "- Responda de forma clara, curta e natural.\n" +
      "- Mantenha o contexto da conversa.\n" +
      "- Nao volte para o menu sem necessidade.\n" +
      "- Nao peca comandos se conseguir entender a intencao do cliente.\n" +
      "- Se o cliente estiver falando sobre um servico especifico, continue nesse servico ate ele mudar de assunto.\n" +
      "- Faca perguntas simples quando precisar entender melhor a necessidade.\n" +
      "- Sempre respeite as regras do negocio configuradas no painel.\n\n" +
      "Objetivo:\n" +
      "- tirar duvidas iniciais\n" +
      "- explicar servicos\n" +
      "- qualificar o interesse\n" +
      "- encaminhar para humano, reuniao ou orcamento quando necessario",
    additionalInstructions: "",
    aiMode: "balanced",
    aiTemperature: 0.4,
    adjustablePrompt: {
      estiloAtendimento: "consultivo e profissional",
      tomDeVoz: "simples e direto",
      nivelDetalhe: "equilibrado",
      focoAtendimento: "entender a necessidade e direcionar para atendimento humano",
      instrucoesNegocio: "",
      regrasPersonalizadas: ""
    },
    serviceWorkflow: {
      attendanceType: "online",
      serviceProcess: "",
      budgetMode: "custom",
      priceDisplayMode: "registered_only",
      nextStep: "human_whatsapp",
      nextStepDetails: "",
      blockedActions: {
        noNegotiate: true,
        noDiscount: true,
        noCloseSale: true,
        noPromiseDeadline: true,
        noFinalPriceWithoutAnalysis: true,
        noInventInfo: true
      },
      notes: ""
    }
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
