/**
 * /rp start  — Postet oder aktualisiert die RP-Nachricht auf "aktiv"
 * /rp stop   — Aktualisiert die bestehende RP-Nachricht auf "inaktiv"
 * /rp status — Zeigt den aktuellen RP-Status
 *
 * Die Nachricht wird beim ersten Mal gepostet und danach immer nur editiert.
 * Verwendet Components V2 (flags: 32768).
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
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
    return interaction.reply({
      content: "❌ Du hast keine Berechtigung, den RP-Status zu ändern.",
      ephemeral: true,
    });
  }

  // ── Status ──────────────────────────────────────────────────────────────────
  if (sub === "status") {
    const active = cfg.rpState === "active";
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(active ? 0x57F287 : 0xED4245)
          .setTitle("RP Status")
          .setDescription(active
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

  const isStart       = sub === "start";
  const newState      = isStart ? "active" : "inactive";
  const pingContent   = cfg.rpPingRoleId ? `<@&${cfg.rpPingRoleId}>` : null;

  await interaction.deferReply({ ephemeral: true });

  // Guard against double-trigger
  if (isStart && cfg.rpState === "active") {
    return interaction.editReply({ content: "⚠️ Das Roleplay ist bereits aktiv." });
  }
  if (!isStart && cfg.rpState !== "active") {
    return interaction.editReply({ content: "⚠️ Das Roleplay ist bereits inaktiv." });
  }

  // Get emojis
  const emojis = await getEmojis(interaction.guild, cfg);

  // Build Components V2 message payload
  const payload = buildRpPayload(isStart, emojis, pingContent);

  // ── Edit existing message OR post new one ───────────────────────────────────
  let posted = false;
  if (cfg.rpMessageId) {
    try {
      const existing = await channel.messages.fetch(cfg.rpMessageId);
      await existing.edit(payload);
      posted = true;
    } catch {
      // Message was deleted — fall through to post new one
    }
  }

  if (!posted) {
    const msg = await channel.send(payload);
    await updateGuildConfig(guildId, { rpMessageId: msg.id });
  }

  // Update state in DB
  await updateGuildConfig(guildId, { rpState: newState });

  return interaction.editReply({
    content: `✅ RP **${isStart ? "Start" : "Stop"}** wurde ${posted ? "aktualisiert" : "gepostet"} in ${channel}.`,
  });
}

// ── Build Components V2 payload ───────────────────────────────────────────────
function buildRpPayload(isStart, emojis, pingContent) {
  const statusEmoji  = isStart ? (emojis.ok     || "🟢") : (emojis.error  || "🔴");
  const headerEmoji  = isStart ? (emojis.rpstart || "🎮") : (emojis.rpstop || "⚠️");
  const infoEmoji    = emojis.info    || "ℹ️";
  const staffEmoji   = emojis.staff   || "⭐";
  const memberEmoji  = emojis.member  || "👤";

  const title = isStart
    ? `${headerEmoji} Roleplay Start`
    : `${headerEmoji} Roleplay Stop`;

  const mainText = isStart
    ? [
        `${statusEmoji} **Der Server ist ab jetzt moderiert und das Roleplay ist eröffnet.**`,
        ``,
        `${memberEmoji} Danke, dass du ein Teil der Community bist!`,
        `${staffEmoji} Unser Team steht dir bei Fragen zur Verfügung.`,
        ``,
        `Viel Spaß beim Spielen! 🎮`,
      ].join("\n")
    : [
        `${statusEmoji} **Der Server ist nicht mehr moderiert und das Roleplay ist beendet.**`,
        ``,
        `${memberEmoji} Danke, dass du dabei warst und zur Community beigetragen hast!`,
        `${infoEmoji} Das nächste Roleplay wird rechtzeitig angekündigt.`,
        ``,
        `Bis zum nächsten Mal! 👋`,
      ].join("\n");

  const footer = `-# NRW:RP I German • ${isStart ? "Roleplay aktiv 🟢" : "Roleplay beendet 🔴"}`;

  const components = [
    // Optional ping above the container
    ...(pingContent ? [{ type: 10, content: pingContent }] : []),
    {
      type: 17, // Container
      accent_color: isStart ? 0x57F287 : 0xED4245,
      components: [
        {
          type: 10,
          content: `# ${title}`,
        },
        { type: 14 }, // Separator
        {
          type: 10,
          content: mainText,
        },
        { type: 14 },
        {
          type: 10,
          content: footer,
        },
      ],
    },
  ];

  return {
    flags: 32768, // IS_COMPONENTS_V2
    allowedMentions: pingContent ? { roles: [pingContent.replace("<@&", "").replace(">", "")] } : { parse: [] },
    components,
  };
}

module.exports = { data, execute };
