/**
 * /rp start  — Sends the RP Start embed and pings the configured role
 * /rp stop   — Sends the RP Stop embed and pings the configured role
 * /rp status — Shows current RP state
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { getGuildConfig } = require("../../utils/guildConfig");

// Track RP state in memory (resets on bot restart — fine for this use case)
const rpState = new Map(); // guildId -> "active" | "inactive"

const data = new SlashCommandBuilder()
  .setName("rp")
  .setDescription("Roleplay Start/Stop verwalten")
  .addSubcommand(sub =>
    sub.setName("start")
      .setDescription("Roleplay starten")
  )
  .addSubcommand(sub =>
    sub.setName("stop")
      .setDescription("Roleplay beenden")
  )
  .addSubcommand(sub =>
    sub.setName("status")
      .setDescription("Aktuellen RP-Status anzeigen")
  );

async function execute(interaction) {
  const cfg     = await getGuildConfig(interaction.guild.id);
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  // ── Permission check ────────────────────────────────────────────────────────
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const hasRole = cfg.rpAllowedRoleId
    ? interaction.member.roles.cache.has(cfg.rpAllowedRoleId)
    : false;

  if (!isAdmin && !hasRole) {
    return interaction.reply({
      content: "❌ Du hast keine Berechtigung, den RP-Status zu ändern.",
      ephemeral: true,
    });
  }

  // ── Status ──────────────────────────────────────────────────────────────────
  if (sub === "status") {
    const state = rpState.get(guildId) || "inactive";
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(state === "active" ? 0x57F287 : 0xED4245)
          .setTitle("RP Status")
          .setDescription(state === "active"
            ? "🟢 Das Roleplay ist aktuell **aktiv**."
            : "🔴 Das Roleplay ist aktuell **inaktiv**."
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }

  // ── Resolve channel ─────────────────────────────────────────────────────────
  const channel = cfg.rpChannelId
    ? interaction.guild.channels.cache.get(cfg.rpChannelId)
    : interaction.channel;

  if (!channel) {
    return interaction.reply({
      content: "❌ RP-Channel nicht gefunden. Bitte `/setup rp channel` ausführen.",
      ephemeral: true,
    });
  }

  // ── Ping content ────────────────────────────────────────────────────────────
  const pingContent = cfg.rpPingRoleId
    ? `<@&${cfg.rpPingRoleId}>`
    : null;

  await interaction.deferReply({ ephemeral: true });

  // ── START ───────────────────────────────────────────────────────────────────
  if (sub === "start") {
    if (rpState.get(guildId) === "active") {
      return interaction.editReply({ content: "⚠️ Das Roleplay ist bereits aktiv." });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle("Roleplay Start")
      .setDescription(
        "Der Server ist ab jetzt wieder moderiert und das Roleplay ist für heute eröffnet.\n" +
        "Danke, dass du ein Teil der Community bist!\n" +
        "Viel Spaß beim Spielen!"
      )
      .setFooter({ text: "NRW:RP I German" })
      .setTimestamp();

    await channel.send({
      content: pingContent,
      embeds: [embed],
    });

    rpState.set(guildId, "active");
    return interaction.editReply({ content: `✅ RP Start wurde in ${channel} gepostet.` });
  }

  // ── STOP ────────────────────────────────────────────────────────────────────
  if (sub === "stop") {
    if (rpState.get(guildId) === "inactive") {
      return interaction.editReply({ content: "⚠️ Das Roleplay ist bereits inaktiv." });
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle("Roleplay Stop")
      .setDescription(
        "Der Server ist nun nicht mehr moderiert und das Roleplay ist für heute vorbei.\n" +
        "Danke, dass du dabei warst und zur Community beigetragen hast!\n" +
        "Bis zum nächsten Mal!"
      )
      .setFooter({ text: "NRW:RP I German" })
      .setTimestamp();

    await channel.send({
      content: pingContent,
      embeds: [embed],
    });

    rpState.set(guildId, "inactive");
    return interaction.editReply({ content: `✅ RP Stop wurde in ${channel} gepostet.` });
  }
}

module.exports = { data, execute };
