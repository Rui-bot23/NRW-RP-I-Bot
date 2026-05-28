/**
 * utils/emojiManager.js
 *
 * Priority order for each emoji slot:
 *   1. Custom emoji set via /setup emojis (stored in guildCfg.emojiXxx)
 *   2. Bundled PNG uploaded to the guild (stored in guildCfg.customEmojis map)
 *   3. Unicode fallback
 */

const fs   = require("fs");
const path = require("path");
const { GuildConfig } = require("../models");

const ASSETS_DIR = path.join(__dirname, "..", "assets", "emojis");

// Slot name → bundled PNG filename
const BUNDLED_EMOJIS = {
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
  info:      "9396-info.png",
  ok:        "4569-ok.png",
  warning:   "8649-warning.png",
  error:     "4934-error.png",
  cooldown:  "8649-cooldown.png",
  top:       "8907-top.png",
};

// Unicode fallbacks
const UNICODE = {
  owner: "👑", partner: "🤝", admin: "🛡️", staff: "⭐",
  ticket: "🎫", verified: "✅", vip: "💎", creator: "🎨",
  developer: "💻", member: "👤", bot: "🤖",
  info: "ℹ️", ok: "✅", warning: "⚠️", error: "❌",
  cooldown: "⏱️", top: "🔝",
};

// Slot name → GuildConfig field name (for custom overrides)
const SLOT_FIELD = {
  welcome:  "emojiWelcome",
  ticket:   "emojiTicket",
  staff:    "emojiStaff",
  member:   "emojiMember",
  verified: "emojiVerified",
  info:     "emojiInfo",
  ok:       "emojiOk",
  error:    "emojiError",
  warning:  "emojiWarning",
  rpstart:  "emojiRpStart",
  rpstop:   "emojiRpStop",
};

/**
 * Resolve a single emoji slot to its display string.
 * @param {string} slot  e.g. "ticket", "staff", "ok"
 * @param {Guild}  guild
 * @param {object} cfg   GuildConfig document
 */
function resolveEmoji(slot, guild, cfg) {
  // 1. Custom override via /setup emojis
  const field = SLOT_FIELD[slot];
  if (field && cfg?.[field]) return cfg[field];

  // 2. Bundled PNG uploaded to guild
  const stored = cfg?.customEmojis;
  const storedId = stored instanceof Map ? stored.get(slot) : stored?.[slot];
  if (storedId) {
    const e = guild.emojis.cache.get(storedId);
    if (e) return `<:${e.name}:${e.id}>`;
  }

  // 3. Unicode fallback
  return UNICODE[slot] || "•";
}

/**
 * Get all emoji slots resolved for a guild.
 * Returns an object: { ticket: "<:nrw_ticket:123>", staff: "⭐", ... }
 */
async function getEmojis(guild, cfg = null) {
  if (!cfg) cfg = await GuildConfig.findOne({ guildId: guild.id });
  const slots = Object.keys(BUNDLED_EMOJIS);
  const result = {};
  for (const slot of slots) {
    result[slot] = resolveEmoji(slot, guild, cfg);
  }
  // Also resolve the named message slots
  result.welcome = resolveEmoji("welcome", guild, cfg) || result.member;
  result.rpstart  = resolveEmoji("rpstart",  guild, cfg) || result.top;
  result.rpstop   = resolveEmoji("rpstop",   guild, cfg) || result.warning;
  return result;
}

/**
 * Upload all bundled PNGs to the guild and cache their IDs.
 */
async function ensureEmojis(guild) {
  const cfg    = await GuildConfig.findOne({ guildId: guild.id });
  const stored = cfg?.customEmojis instanceof Map
    ? Object.fromEntries(cfg.customEmojis)
    : (cfg?.customEmojis || {});
  const result = {};

  for (const [name, filename] of Object.entries(BUNDLED_EMOJIS)) {
    if (stored[name]) {
      const existing = guild.emojis.cache.get(stored[name]);
      if (existing) { result[name] = `<:${existing.name}:${existing.id}>`; continue; }
    }

    const filePath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(filePath)) { result[name] = UNICODE[name] || "•"; continue; }

    try {
      const emojiName = `nrw_${name}`;
      const byName = guild.emojis.cache.find(e => e.name === emojiName);
      if (byName) {
        stored[name] = byName.id;
        result[name] = `<:${byName.name}:${byName.id}>`;
        continue;
      }
      const uploaded = await guild.emojis.create({ attachment: filePath, name: emojiName });
      stored[name] = uploaded.id;
      result[name] = `<:${uploaded.name}:${uploaded.id}>`;
    } catch {
      result[name] = UNICODE[name] || "•";
    }
  }

  await GuildConfig.findOneAndUpdate(
    { guildId: guild.id },
    { $set: { customEmojis: stored } },
    { upsert: true }
  );
  return result;
}

module.exports = { ensureEmojis, getEmojis, resolveEmoji, BUNDLED_EMOJIS, SLOT_FIELD, UNICODE };
