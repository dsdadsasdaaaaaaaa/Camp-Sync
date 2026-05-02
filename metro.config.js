const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};

const customBlockList = [/\.local[\\/].*/];
const existing = config.resolver.blockList;

if (Array.isArray(existing)) {
  config.resolver.blockList = [...existing, ...customBlockList];
} else if (existing) {
  config.resolver.blockList = [existing, ...customBlockList];
} else {
  config.resolver.blockList = customBlockList;
}

module.exports = config;
