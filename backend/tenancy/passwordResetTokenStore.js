const path = require("path");
const { readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");

const passwordResetTokensFilePath = path.resolve(__dirname, "../../data/passwordResetTokens.json");

function readPasswordResetTokens() {
  const tokens = readJsonFile(passwordResetTokensFilePath, {});
  return tokens && typeof tokens === "object" && !Array.isArray(tokens) ? tokens : {};
}

function writePasswordResetTokens(tokens) {
  return writeJsonFile(passwordResetTokensFilePath, tokens && typeof tokens === "object" ? tokens : {});
}

function savePasswordResetToken(token, payload) {
  const tokens = readPasswordResetTokens();
  tokens[token] = payload;
  writePasswordResetTokens(tokens);
  return tokens[token];
}

function readPasswordResetToken(token) {
  const tokens = readPasswordResetTokens();
  return tokens[String(token || "")] || null;
}

function updatePasswordResetToken(token, payload) {
  const tokens = readPasswordResetTokens();
  const currentToken = tokens[String(token || "")] || {};
  tokens[String(token || "")] = {
    ...currentToken,
    ...payload
  };
  writePasswordResetTokens(tokens);
  return tokens[String(token || "")];
}

module.exports = {
  passwordResetTokensFilePath,
  readPasswordResetToken,
  readPasswordResetTokens,
  savePasswordResetToken,
  updatePasswordResetToken
};
