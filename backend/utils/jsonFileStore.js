const fs = require("fs");
const path = require("path");

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function readJsonFile(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallbackValue;
  }
}

function writeJsonFile(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  return value;
}

module.exports = {
  ensureDirectory,
  readJsonFile,
  writeJsonFile
};
