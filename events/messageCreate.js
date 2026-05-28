/**
 * events/messageCreate.js
 * Handles: AutoMod (antilink, antispam, antibadwords), AFK detection
 */

const { EmbedBuilder } = require("discord.js");
const { getGuildConfig } = require("../utils/guildConfig");
const { afkStore } = require("../commands/fun/fun");

const once = false;

// Spam tracking: userId -> [timestamps]
const spamMap = new Map();

const URL_REGEX = /https?:\/\/\S+|discord\.gg\/\S+|discordapp\.com\/invite\/\S+/i;

async function execute(message, client) {
  if (!message.guild || message.author.bot) return;

  try {
    const cfg = await getGuildConfig(message.guild.id);
    const am  = cfg.automod || {};

    // Ignore list check
    const ignoreList = am.ignoreList || [];
    if (ignoreList.includes(message.channel.id)) return;
    if (message.member?.roles.cache.some(r => ignoreList.includes(r.id))) return;
    // Never automod admins
    if (message.member?.permissions.has("Administrator")) return;

    // ── Anti-Link ─────────────────────────────────────────────────────────────
    if (am.antilinkEnabled && URL_REGEX.test(message.content)) {
      await message.delete().catch(() => {});
      const action = am.antilinkAction || "delete";

      const warn = () => message.channel.send({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${message.author} Links sind in diesem Server nicht erlaubt!`).setTimestamp()],
      }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

      if (action === "delete") await warn();
      if (action === "warn")   { await warn(); }
      if (action === "kick")   { await warn(); await message.member.kick("AutoMod: Link gesendet").catch(() => {}); }
      if (action === "ban")    { await warn(); await message.member.ban({ reason: "AutoMod: Link gesendet" }).catch(() => {}); }
      return;
    }

    // ── Anti-Spam ─────────────────────────────────────────────────────────────
    if (am.antispamEnabled) {
      const key  = `${message.guild.id}:${message.author.id}`;
      const now  = Date.now();
      const limit = am.antispamLimit || 5;
      const window = 5000; // 5 seconds

      if (!spamMap.has(key)) spamMap.set(key, []);
      const times = spamMap.get(key).filter(t => now - t < window);
      times.push(now);
      spamMap.set(key, times);

      if (times.length >= limit) {
        spamMap.delete(key);
        // Delete recent messages
        const msgs = await message.channel.messages.fetch({ limit: 20 });
        const toDelete = [...msgs.values()].filter(m => m.author.id === message.author.id).slice(0, limit);
        await message.channel.bulkDelete(toDelete, true).catch(() => {});

        await message.channel.send({
          embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${message.author} Bitte nicht spammen!`).setTimestamp()],
        }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        return;
      }
    }

    // ── Anti-Badwords ─────────────────────────────────────────────────────────
    if (am.antibadwordsEnabled && am.blacklist?.length) {
      const content = message.content.toLowerCase();
      const found   = am.blacklist.some(w => content.includes(w.toLowerCase()));
      if (found) {
        await message.delete().catch(() => {});
        await message.channel.send({
          embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${message.author} Das ist ein verbotenes Wort!`).setTimestamp()],
        }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        return;
      }
    }

    // ── AFK Check — someone mentions an AFK user ──────────────────────────────
    for (const [userId, afkData] of afkStore.entries()) {
      if (message.mentions.users.has(userId)) {
        const since = Math.floor(afkData.timestamp / 1000);
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setDescription(`💤 <@${userId}> ist AFK: **${afkData.reason}** (seit <t:${since}:R>)`)
              .setTimestamp(),
          ],
        }).then(m => setTimeout(() => m.delete().catch(() => {}), 10000));
      }
    }

    // ── AFK — author sends a message, remove their AFK ───────────────────────
    if (afkStore.has(message.author.id)) {
      afkStore.delete(message.author.id);
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✅ Willkommen zurück ${message.author}! Dein AFK wurde entfernt.`).setTimestamp()],
      }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

  } catch (err) {
    console.error("[MSG CREATE]", err.message);
  }
}

module.exports = { once, execute };
