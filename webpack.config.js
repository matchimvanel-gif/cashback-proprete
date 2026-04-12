const createExpoWebpackConfigAsync = require("@expo/webpack-config");
const path = require("path");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    "barcode-detector": path.resolve(
      __dirname,
      "node_modules/barcode-detector/dist/es/index.js",
    ),
  };

  config.resolve.mainFields = ["browser", "module", "main"];

  return config;
};
