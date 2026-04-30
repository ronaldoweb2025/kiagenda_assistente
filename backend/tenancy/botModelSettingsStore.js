const path = require("path");
const { ensureDirectory, readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");

const botModelSettingsFilePath = path.resolve(__dirname, "../../data/botModelSettings.json");

const DEFAULT_BOT_MODEL_SETTINGS = {
  services: {
    name: "Bot Servicos",
    promptBase:
      "Voce e um assistente de atendimento automatico via WhatsApp para empresas que prestam servicos.\n\n" +
      "Seu papel e entender o cliente, explicar os servicos cadastrados e organizar o atendimento inicial.\n\n" +
      "Voce nao e vendedor, nao negocia, nao fecha venda e nao cria orcamento.\n\n" +
      "Use apenas as informacoes fornecidas pelo sistema:\n" +
      "- dados do negocio\n- servicos cadastrados\n- descricoes\n- precos cadastrados\n- links\n- regras de atendimento\n\n" +
      "Regras obrigatorias:\n" +
      "- Nunca invente informacoes.\n- Nunca invente preco.\n- Nunca invente prazo.\n- Nunca negocie.\n- Nunca ofereca desconto.\n- Nunca feche venda.\n- Nunca diga que vai montar orcamento.\n" +
      "- Se um servico tiver preco cadastrado, informe o preco exatamente como esta.\n" +
      "- Se um servico nao tiver preco cadastrado, trate como sob consulta.\n" +
      "- Se o cliente pedir orcamento de servico sem preco, explique que e necessario falar com o responsavel.\n" +
      "- Se nao souber responder, encaminhe para atendimento humano.\n\n" +
      "Comportamento:\n" +
      "- Responda de forma clara, curta e natural.\n- Mantenha o contexto da conversa.\n- Nao volte para o menu sem necessidade.\n" +
      "- Nao peca comandos se conseguir entender a intencao do cliente.\n" +
      "- Se o cliente estiver falando sobre um servico especifico, continue nesse servico ate ele mudar de assunto.\n" +
      "- Faca perguntas simples quando precisar entender melhor a necessidade.\n" +
      "- Sempre respeite as regras do negocio configuradas no painel.\n\n" +
      "Objetivo:\n- tirar duvidas iniciais\n- explicar servicos\n- qualificar o interesse\n- encaminhar para humano, reuniao ou orcamento quando necessario",
    additionalInstructions: "",
    aiMode: "balanced",
    temperature: 0.4
  },
  kiagenda: {
    name: "Bot KiAgenda",
    promptBase:
      "Voce e um assistente de atendimento automatico via WhatsApp que ajuda o cliente a entender servicos e direciona para agendamento automatico atraves do sistema.\n\n" +
      "Seu papel e entender o que o cliente deseja, explicar o servico ou atendimento, tirar duvidas basicas e incentivar sempre o uso do sistema de agendamento.\n\n" +
      "Regras obrigatorias:\n" +
      "- Nunca agende manualmente.\n" +
      "- Nunca prometa horario especifico.\n" +
      "- Nunca reserve horario.\n" +
      "- Nunca negocie.\n" +
      "- Nunca de desconto.\n" +
      "- Nunca invente informacoes.\n" +
      "- Nunca simule sistema interno.\n" +
      "- Sempre que possivel, direcione para o link do sistema de agendamento.\n\n" +
      "Comportamento:\n" +
      "- linguagem simples e amigavel\n" +
      "- respostas curtas e objetivas\n" +
      "- nao ser insistente\n" +
      "- falar de forma natural sobre o sistema\n" +
      "- manter contexto do servico\n" +
      "- finalizar com incentivo ao agendamento quando fizer sentido",
    additionalInstructions: "",
    aiMode: "balanced",
    temperature: 0.4
  },
  delivery: {
    name: "Bot Delivery",
    promptBase: "",
    additionalInstructions: "",
    aiMode: "conservative",
    temperature: 0.2
  },
  loja_online: {
    name: "Bot Loja Online",
    promptBase: "",
    additionalInstructions: "",
    aiMode: "conservative",
    temperature: 0.2
  }
};

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeMode(value, fallbackValue = "balanced") {
  const normalized = normalizeString(value).toLowerCase();

  if (["conservative", "balanced", "expansive"].includes(normalized)) {
    return normalized;
  }

  return fallbackValue;
}

function normalizeTemperature(value, fallbackValue = 0.4) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  return Math.max(0, Math.min(0.5, numericValue));
}

function normalizeModelConfig(input = {}, fallback = {}) {
  return {
    name: normalizeString(input?.name) || normalizeString(fallback?.name),
    promptBase: normalizeString(input?.promptBase) || normalizeString(fallback?.promptBase),
    additionalInstructions: normalizeString(input?.additionalInstructions) || normalizeString(fallback?.additionalInstructions),
    aiMode: normalizeMode(input?.aiMode, normalizeMode(fallback?.aiMode, "balanced")),
    temperature: normalizeTemperature(input?.temperature, normalizeTemperature(fallback?.temperature, 0.4))
  };
}

function normalizeBotModelSettings(input = {}) {
  return {
    services: normalizeModelConfig(input?.services, DEFAULT_BOT_MODEL_SETTINGS.services),
    kiagenda: normalizeModelConfig(input?.kiagenda, DEFAULT_BOT_MODEL_SETTINGS.kiagenda),
    delivery: normalizeModelConfig(input?.delivery, DEFAULT_BOT_MODEL_SETTINGS.delivery),
    loja_online: normalizeModelConfig(input?.loja_online, DEFAULT_BOT_MODEL_SETTINGS.loja_online)
  };
}

function readBotModelSettings() {
  const parsed = readJsonFile(botModelSettingsFilePath, null);
  return normalizeBotModelSettings(parsed || DEFAULT_BOT_MODEL_SETTINGS);
}

function writeBotModelSettings(nextSettings) {
  const normalized = normalizeBotModelSettings(nextSettings);
  writeJsonFile(botModelSettingsFilePath, normalized);
  return normalized;
}

function updateBotModelSettings(partialSettings = {}) {
  const current = readBotModelSettings();
  return writeBotModelSettings({
    ...current,
    ...partialSettings,
    services: {
      ...current.services,
      ...(partialSettings?.services || {})
    },
    kiagenda: {
      ...current.kiagenda,
      ...(partialSettings?.kiagenda || {})
    },
    delivery: {
      ...current.delivery,
      ...(partialSettings?.delivery || {})
    },
    loja_online: {
      ...current.loja_online,
      ...(partialSettings?.loja_online || {})
    }
  });
}

function bootstrapBotModelSettingsStore() {
  ensureDirectory(path.dirname(botModelSettingsFilePath));

  if (!readJsonFile(botModelSettingsFilePath, null)) {
    writeBotModelSettings(DEFAULT_BOT_MODEL_SETTINGS);
  } else {
    writeBotModelSettings(readBotModelSettings());
  }
}

module.exports = {
  DEFAULT_BOT_MODEL_SETTINGS,
  bootstrapBotModelSettingsStore,
  botModelSettingsFilePath,
  readBotModelSettings,
  updateBotModelSettings,
  writeBotModelSettings
};
