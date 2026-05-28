const { EmbedBuilder } = require("discord.js");
const { getGuildConfig } = require("../utils/guildConfig");

const once = false;

async function execute(member, client) {
  try {
    const cfg     = await getGuildConfig(member.guild.id);
    const logChId = cfg.logging?.memberLeave;
    if (!logChId || !cfg.logging?.enabled) return;

    const logCh = member.guild.channels.cache.get(logChId);
    if (!logCh) return;

    await logCh.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("📤 Mitglied verlassen")
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: "Nutzer",     value: `${member.user.tag}`,                   inline: true },
            { name: "ID",         value: member.user.id,                         inline: true },
            { name: "Beigetreten",value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp/1000)}:F>` : "—", inline: true },
          )
          .setTimestamp(),
      ],
    });
  } catch {}
}

module.exports = { once, execute };
