const path = require("path");
RegExp.prototype.toJSON = RegExp.prototype.toString;
module.exports = function override(config, env) {
  const rulesOneOf = config.module.rules[1].oneOf;

  rulesOneOf.splice(rulesOneOf.length - 1, 0, {
    ...rulesOneOf[2],
    include: path.join(__dirname, "../../packages/"),
  });

  return config;
};