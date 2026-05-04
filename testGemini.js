require("dotenv").config();

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

function getApiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
}

function extractGeminiText(payload = {}) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];

    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return "";
}

async function testGemini() {
  const apiKey = getApiKey();
  const model = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  if (!apiKey) {
    console.error("ERRO: API key do Gemini nao encontrada no .env.");
    console.error("Variaveis aceitas: GEMINI_API_KEY, GOOGLE_GEMINI_API_KEY ou GOOGLE_API_KEY.");
    process.exitCode = 1;
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Responda apenas: Conexao Gemini OK"
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 30
        }
      })
    });

    const responseText = await response.text();
    let payload = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      payload = null;
    }

    console.log("Status da resposta:", response.status, response.statusText);

    if (!response.ok) {
      console.error("ERRO: chamada Gemini falhou.");
      console.error("Mensagem de erro completa:");
      console.error(responseText || "(resposta vazia)");
      process.exitCode = 1;
      return;
    }

    console.log("SUCESSO: conexao com Gemini funcionando.");
    console.log("Modelo:", model);
    console.log("Resposta:", extractGeminiText(payload) || responseText || "(sem texto na resposta)");
  } catch (error) {
    console.error("ERRO: falha ao chamar Gemini.");
    console.error("Mensagem de erro completa:");
    console.error(error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  testGemini();
}

module.exports = {
  testGemini
};
