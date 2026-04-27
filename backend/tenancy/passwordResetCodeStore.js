const path = require("path");
const { readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");

const passwordResetCodesFilePath = path.resolve(__dirname, "../../data/passwordResetCodes.json");

function readPasswordResetCodes() {
  const codes = readJsonFile(passwordResetCodesFilePath, {});
  return codes && typeof codes === "object" && !Array.isArray(codes) ? codes : {};
}

function writePasswordResetCodes(codes) {
  return writeJsonFile(passwordResetCodesFilePath, codes && typeof codes === "object" ? codes : {});
}

function readPasswordResetCode(whatsapp) {
  const codes = readPasswordResetCodes();
  return codes[String(whatsapp || "")] || null;
}

function savePasswordResetCode(whatsapp, payload) {
  const codes = readPasswordResetCodes();
  codes[String(whatsapp || "")] = payload;
  writePasswordResetCodes(codes);
  return codes[String(whatsapp || "")];
}

function updatePasswordResetCode(whatsapp, payload) {
  const codes = readPasswordResetCodes();
  const currentCode = codes[String(whatsapp || "")] || {};
  codes[String(whatsapp || "")] = {
    ...currentCode,
    ...payload
  };
  writePasswordResetCodes(codes);
  return codes[String(whatsapp || "")];
}

module.exports = {
  passwordResetCodesFilePath,
  readPasswordResetCode,
  readPasswordResetCodes,
  savePasswordResetCode,
  updatePasswordResetCode
};
