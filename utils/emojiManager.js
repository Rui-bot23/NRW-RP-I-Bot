/**
 * utils/emojiManager.js
 * Uploads the bundled PNG emojis to the Discord guild and caches their IDs.
 * Admins can also register custom emojis via /emoji commands.
 */

const fs   = require("fs");
const path = require("path");
const { GuildConfig } = require("../models");

// Friendly name → filename mapping for bundled emojis
const BUNDLED_EMOJIS = {
  // Role icons
  owner:     "43165-owner.png",
  partner:   "4188-partner.png",
  admin:     "88726-admin.png",
  staff:     "14551-staff.png",
  ticket:    "4188-ticket.png",
  verified:  "37590-verified.png",
  vip:       "45254-vip.png",
  creator:   "77095-creator.png",
  developer: "21100-developer.png",
  member:    "12920-member.png",
  bot:       "68882-bot.png",
  // Moderation
  info:      "9396-info.png",
  ok:        "4569-ok.png",
  warning:   "8649-warning.png",
  error:     "4934-error.png",
  cooldown:  "8649-cooldown.png",
  top:       "8907-top.png",
};

const ASSETS_DIR = path.join(__dirname, "..", "assets", "emojis");

/**
 * Upload all bundled emojis to a guild if not already uploaded.
 * Stores emoji IDs in the guild config.
 * @param {Guild} guild
 * @returns {Promise<object>} map of name -> emoji string (e.g. "<:staff:123456>")
 */
async function ensureEmojis(guild) {
  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  const stored = cfg?.customEmojis || {};

  const result = {};

  for (const [name, filename] of Object.entries(BUNDLED_EMOJIS)) {
    // Already uploaded and cached
    if (stored[name]) {
      // Verify it still exists on the guild
      const existing = guild.emojis.cache.get(stored[name]);
      if (existing) {
        result[name] = `<:${existing.name}:${existing.id}>`;
        continue;
      }
    }

    // Upload it
    const filePath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(filePath)) continue;

    try {
      const emojiName = `nrw_${name}`;
      // Check if already exists by name
      const byName = guild.emojis.cache.find(e => e.name === emojiName);
      if (byName) {
        stored[name] = byName.id;
        result[name] = `<:${byName.name}:${byName.id}>`;
        continue;
      }

      const uploaded = await guild.emojis.create({
        attachment: filePath,
        name: emojiName,
      });
      stored[name] = uploaded.id;
      result[name] = `<:${uploaded.name}:${uploaded.id}>`;
    } catch (err) {
      // Fallback to unicode if upload fails (e.g. emoji slot limit)
      result[name] = fallbackEmoji(name);
    }
  }

  // Save updated IDs
  await GuildConfig.findOneAndUpdate(
    { guildId: guild.id },
    { $set: { customEmojis: stored } },
    { upsert: true }
  );

  return result;
}

/**
 * Get cached emoji strings for a guild (fast, no uploads).
 * Falls back to unicode if not uploaded yet.
 */
async function getEmojis(guild) {
  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  const stored = cfg?.customEmojis || {};
  const result = {};

  for (const name of Object.keys(BUNDLED_EMOJIS)) {
    if (stored[name]) {
      const e = guild.emojis.cache.get(stored[name]);
      result[name] = e ? `<:${e.name}:${e.id}>` : fallbackEmoji(name);
    } else {
      result[name] = fallbackEmoji(name);
    }
  }

  return result;
}

function fallbackEmoji(name) {
  const map = {
    owner: "👑", partner: "🤝", admin: "🛡️", staff: "⭐",
    ticket: "🎫", verified: "✅", vip: "💎", creator: "🎨",
    developer: "💻", member: "👤", bot: "🤖",
    info: "ℹ️", ok: "✅", warning: "⚠️", error: "❌",
    cooldown: "⏱️", top: "🔝",
  };
  return map[name] || "•";
}

module.exports = { ensureEmojis, getEmojis, BUNDLED_EMOJIS, fallbackEmoji };
