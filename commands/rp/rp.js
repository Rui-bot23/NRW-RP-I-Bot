/**
 * /rp start | stop | status
 * Uses proper ContainerBuilder classes per official discord.js docs
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../../utils/guildConfig");
const { getEmojis } = require("../../utils/emojiManager");

const data = new SlashCommandBuilder()
  .setName("rp")
  .setDescription("Roleplay Start/Stop verwalten")
  .addSubcommand(sub => sub.setName("start").setDescription("Roleplay starten"))
  .addSubcommand(sub => sub.setName("stop").setDescription("Roleplay beenden"))
  .addSubcommand(sub => sub.setName("status").setDescription("Aktuellen RP-Status anzeigen"));

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
    return interaction.reply({ content: "❌ Du hast keine Berechtigung, den RP-Status zu ändern.", flags: 64 });
  }

  // ── Status ──────────────────────────────────────────────────────────────────
  if (sub === "status") {
    const active = cfg.rpState === "active";
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(active ? 0x57F287 : 0xED4245)
          .setTitle("RP Status")
          .setDescription(active ? "🟢 Das Roleplay ist aktuell **aktiv**." : "🔴 Das Roleplay ist aktuell **inaktiv**.")
          .setTimestamp(),
      ],
      flags: 64,
    });
  }

  // ── Resolve channel ─────────────────────────────────────────────────────────
  const channel = cfg.rpChannelId
    ? interaction.guild.channels.cache.get(cfg.rpChannelId)
    : interaction.channel;

  if (!channel) {
    return interaction.reply({ content: "❌ RP-Channel nicht gefunden. Bitte `/setup rp channel` ausführen.", flags: 64 });
  }

  const isStart = sub === "start";

  await interaction.deferReply({ flags: 64 });

  if (isStart && cfg.rpState === "active") {
    return interaction.editReply({ content: "⚠️ Das Roleplay ist bereits aktiv." });
  }
  if (!isStart && cfg.rpState !== "active") {
    return interaction.editReply({ content: "⚠️ Das Roleplay ist bereits inaktiv." });
  }

  const emojis = await getEmojis(interaction.guild, cfg);

  // ── Build Components V2 payload ─────────────────────────────────────────────
  const pingRoleId = cfg.rpPingRoleId;

  const statusEmoji = isStart ? (emojis.ok     || "🟢") : (emojis.error  || "🔴");
  const headerEmoji = isStart ? (emojis.rpstart || "🎮") : (emojis.rpstop || "⚠️");

  const rpTitle = isStart
    ? (cfg.rpStartTitle || "Roleplay Start")
    : (cfg.rpStopTitle  || "Roleplay Stop");

  const rpText = isStart
    ? (cfg.rpStartText || "Der Server ist ab jetzt moderiert und das Roleplay ist eröffnet.\n\nDanke, dass du ein Teil der Community bist!\nViel Spaß beim Spielen! 🎮")
    : (cfg.rpStopText  || "Der Server ist nicht mehr moderiert und das Roleplay ist beendet.\n\nDanke, dass du dabei warst!\nBis zum nächsten Mal! 👋");

  const container = new ContainerBuilder()
    .setAccentColor(isStart ? 0x57F287 : 0xED4245)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${headerEmoji} ${statusEmoji} ${rpTitle}`)
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(rpText)
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# NRW:RP I German • ${isStart ? "Roleplay aktiv 🟢" : "Roleplay beendet 🔴"}`
      )
    );

  // Ping must go inside the container — content field not allowed with IS_COMPONENTS_V2
  if (pingRoleId) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`<@&${pingRoleId}>`)
    );
  }

  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    ...(pingRoleId ? { allowedMentions: { roles: [pingRoleId] } } : {}),
  };

  // ── Edit existing or post new ───────────────────────────────────────────────
  let posted = false;
  if (cfg.rpMessageId) {
    try {
      const existing = await channel.messages.fetch(cfg.rpMessageId);
      await existing.edit(payload);
      posted = true;
    } catch {
      // Message deleted — post new
    }
  }

  if (!posted) {
    const msg = await channel.send(payload);
    await updateGuildConfig(guildId, { rpMessageId: msg.id });
  }

  await updateGuildConfig(guildId, { rpState: isStart ? "active" : "inactive" });

  return interaction.editReply({
    content: `✅ RP **${isStart ? "Start" : "Stop"}** wurde ${posted ? "aktualisiert" : "gepostet"} in ${channel}.`,
  });
}

module.exports = { data, execute };
