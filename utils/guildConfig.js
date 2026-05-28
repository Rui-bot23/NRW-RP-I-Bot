const { GuildConfig } = require("../models");

async function getGuildConfig(guildId) {
  let cfg = await GuildConfig.findOne({ guildId });
  if (!cfg) cfg = await GuildConfig.create({ guildId });
  return cfg;
}

async function updateGuildConfig(guildId, updates) {
  return GuildConfig.findOneAndUpdate(
    { guildId },
    { $set: updates },
    { upsert: true, new: true }
  );
}

module.exports = { getGuildConfig, updateGuildConfig };
