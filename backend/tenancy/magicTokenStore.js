const path = require("path");
const { readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");

const magicTokensFilePath = path.resolve(__dirname, "../../data/magicTokens.json");

function readMagicTokens() {
  const tokens = readJsonFile(magicTokensFilePath, {});
  return tokens && typeof tokens === "object" && !Array.isArray(tokens) ? tokens : {};
}

function writeMagicTokens(tokens) {
  return writeJsonFile(magicTokensFilePath, tokens && typeof tokens === "object" ? tokens : {});
}

function saveMagicToken(token, payload) {
  const tokens = readMagicTokens();
  tokens[String(token || "")] = payload;
  writeMagicTokens(tokens);
  return tokens[String(token || "")];
}

function readMagicToken(token) {
  const tokens = readMagicTokens();
  return tokens[String(token || "")] || null;
}

function updateMagicToken(token, payload) {
  const tokens = readMagicTokens();
  const currentToken = tokens[String(token || "")] || {};
  tokens[String(token || "")] = {
    ...currentToken,
    ...payload
  };
  writeMagicTokens(tokens);
  return tokens[String(token || "")];
}

module.exports = {
  magicTokensFilePath,
  readMagicToken,
  readMagicTokens,
  saveMagicToken,
  updateMagicToken
};
