/**
 * /module — Enable or disable bot modules per server
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../../utils/guildConfig");

const MODULES = {
  welcome:  { label: "👋 Willkommen",   desc: "Automatische Willkommensnachrichten" },
  tickets:  { label: "🎫 Tickets",      desc: "Ticket-System und Panel" },
  giveaway: { label: "🎉 Giveaways",    desc: "Giveaway-System" },
  automod:  { label: "🤖 AutoMod",      desc: "Anti-Link, Anti-Spam, Anti-Badwords" },
  logging:  { label: "📋 Logging",      desc: "Server-Event Logging" },
  modlog:   { label: "🛡️ Mod-Log",     desc: "Moderations-Aktionen loggen" },
};

const data = new SlashCommandBuilder()
  .setName("module")
  .setDescription("Bot-Module aktivieren oder deaktivieren")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName("toggle")
      .setDescription("Modul ein- oder ausschalten")
      .addStringOption(o =>
        o.setName("modul").setDescription("Welches Modul?").setRequired(true)
          .addChoices(...Object.keys(MODULES).map(k => ({ name: MODULES[k].label, value: k })))
      )
      .addBooleanOption(o => o.setName("aktiviert").setDescription("Ein oder Aus").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("status")
      .setDescription("Status aller Module anzeigen")
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const cfg = await getGuildConfig(interaction.guild.id);

  if (sub === "status") {
    const lines = Object.entries(MODULES).map(([key, info]) => {
      const on = cfg.modules?.[key] !== false;
      return `${on ? "✅" : "❌"} **${info.label}** — ${on ? "Aktiv" : "Deaktiviert"}\n> ${info.desc}`;
    });

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("⚙️ Modul Status")
          .setDescription(lines.join("\n\n"))
          .setTimestamp(),
      ],
      flags: 64,
    });
  }

  if (sub === "toggle") {
    const modul    = interaction.options.getString("modul");
    const aktiv    = interaction.options.getBoolean("aktiviert");
    const info     = MODULES[modul];

    if (!info) return interaction.reply({ content: "❌ Unbekanntes Modul.", flags: 64 });

    await updateGuildConfig(interaction.guild.id, { [`modules.${modul}`]: aktiv });

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(aktiv ? 0x57F287 : 0xED4245)
          .setTitle(`${aktiv ? "✅" : "❌"} Modul ${aktiv ? "aktiviert" : "deaktiviert"}`)
          .setDescription(`**${info.label}** wurde ${aktiv ? "aktiviert" : "deaktiviert"}.\n${info.desc}`)
          .setTimestamp(),
      ],
      flags: 64,
    });
  }
}

module.exports = { data, execute, MODULES };
