const { EmbedBuilder } = require("discord.js");
const { getGuildConfig } = require("../utils/guildConfig");
const { snipeStore } = require("../commands/fun/fun");

const once = false;

async function execute(message, client) {
  if (!message.guild || message.author?.bot) return;

  // Store for snipe
  if (message.content || message.attachments.size) {
    snipeStore.set(message.channel.id, {
      content:     message.content || "*Kein Text*",
      authorTag:   message.author?.tag || "Unbekannt",
      authorAvatar: message.author?.displayAvatarURL() || null,
      timestamp:   message.createdTimestamp,
    });
  }

  // Logging
  try {
    const cfg     = await getGuildConfig(message.guild.id);
    const logChId = cfg.logging?.messageDelete;
    if (!logChId || !cfg.logging?.enabled) return;

    const logCh = message.guild.channels.cache.get(logChId);
    if (!logCh) return;

    await logCh.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("🗑️ Nachricht gelöscht")
          .addFields(
            { name: "Nutzer",   value: `<@${message.author?.id}> (${message.author?.tag})`, inline: true },
            { name: "Channel",  value: `<#${message.channel.id}>`,                          inline: true },
            { name: "Inhalt",   value: message.content?.slice(0, 1024) || "*Kein Text*",    inline: false },
          )
          .setTimestamp(),
      ],
    });
  } catch {}
}

module.exports = { once, execute };
