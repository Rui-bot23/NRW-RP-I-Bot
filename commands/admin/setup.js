/**
 * /setup — Configure NRW:RP Bot from Discord
 *
 * Groups:
 *   welcome  — channel, banner, rules/roles/ticket/fraktion channels
 *   rp       — channel, allowed role, ping role
 *
 * Top-level:
 *   /setup view  — show current config
 *   /setup reset — reset a section
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../../utils/guildConfig");
const { getEmojis, SLOT_FIELD, UNICODE } = require("../../utils/emojiManager");

const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("NRW:RP Bot konfigurieren")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // ── Welcome group ──────────────────────────────────────────────────────────
  .addSubcommandGroup(group =>
    group.setName("welcome").setDescription("Willkommensnachricht konfigurieren")

      .addSubcommand(sub =>
        sub.setName("channel")
          .setDescription("Channel für Willkommensnachrichten setzen")
          .addChannelOption(o =>
            o.setName("channel").setDescription("Willkommens-Channel").setRequired(true)
              .addChannelTypes(ChannelType.GuildText)
          )
      )
      .addSubcommand(sub =>
        sub.setName("banner")
          .setDescription("Banner-URL für die Willkommensnachricht setzen")
          .addStringOption(o =>
            o.setName("url").setDescription("Direkte Bild-URL (z.B. https://...)").setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub.setName("channels")
          .setDescription("Alle Kanal-Erwähnungen in der Willkommensnachricht setzen")
          .addChannelOption(o =>
            o.setName("regeln").setDescription("Regelwerk-Channel").setRequired(true)
              .addChannelTypes(ChannelType.GuildText)
          )
          .addChannelOption(o =>
            o.setName("rollen").setDescription("Rollen-Channel").setRequired(true)
              .addChannelTypes(ChannelType.GuildText)
          )
          .addChannelOption(o =>
            o.setName("ticket").setDescription("Ticket-Channel").setRequired(true)
              .addChannelTypes(ChannelType.GuildText)
          )
          .addChannelOption(o =>
            o.setName("fraktionen").setDescription("Fraktionen-Channel").setRequired(true)
              .addChannelTypes(ChannelType.GuildText)
          )
      )
      .addSubcommand(sub =>
        sub.setName("test")
          .setDescription("Willkommensnachricht als Test für dich selbst senden")
      )
  )

  // ── RP group ───────────────────────────────────────────────────────────────
  .addSubcommandGroup(group =>
    group.setName("rp").setDescription("RP Start/Stop konfigurieren")

      .addSubcommand(sub =>
        sub.setName("channel")
          .setDescription("Channel für RP Start/Stop Nachrichten setzen")
          .addChannelOption(o =>
            o.setName("channel").setDescription("RP Announcements Channel").setRequired(true)
              .addChannelTypes(ChannelType.GuildText)
          )
      )
      .addSubcommand(sub =>
        sub.setName("role")
          .setDescription("Rolle setzen, die /rp benutzen darf")
          .addRoleOption(o =>
            o.setName("role").setDescription("Erlaubte Rolle (z.B. @Moderator)").setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub.setName("pingrole")
          .setDescription("Rolle setzen, die bei RP Start/Stop gepingt wird")
          .addRoleOption(o =>
            o.setName("role").setDescription("Ping-Rolle (z.B. @RP-Spieler)").setRequired(true)
          )
      )
  )

  // ── Tickets group ─────────────────────────────────────────────────────────
  .addSubcommandGroup(group =>
    group.setName("tickets").setDescription("Ticket-System konfigurieren")
      .addSubcommand(sub =>
        sub.setName("logs")
          .setDescription("Transcript-Log-Channel setzen")
          .addChannelOption(o =>
            o.setName("channel").setDescription("Log-Channel").setRequired(true)
              .addChannelTypes(ChannelType.GuildText)
          )
      )
      .addSubcommand(sub =>
        sub.setName("category")
          .setDescription("Discord-Kategorie für Ticket-Channels setzen")
          .addChannelOption(o =>
            o.setName("kategorie").setDescription("Discord Kategorie").setRequired(true)
              .addChannelTypes(ChannelType.GuildCategory)
          )
      )
      .addSubcommand(sub =>
        sub.setName("addrole")
          .setDescription("Support-Rolle hinzufügen")
          .addRoleOption(o => o.setName("role").setDescription("Support-Rolle").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("removerole")
          .setDescription("Support-Rolle entfernen")
          .addRoleOption(o => o.setName("role").setDescription("Rolle entfernen").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("options")
          .setDescription("Ticket-Optionen setzen")
          .addIntegerOption(o => o.setName("max_per_user").setDescription("Max offene Tickets pro Nutzer (Standard 1)").setMinValue(1).setMaxValue(5))
          .addBooleanOption(o => o.setName("dm_transcript").setDescription("Transcript per DM senden (Standard: ja)"))
          .addIntegerOption(o => o.setName("close_delay").setDescription("Sekunden bis Channel gelöscht wird (Standard: 5)").setMinValue(0).setMaxValue(60))
      )
  )

  // ── Emojis group ──────────────────────────────────────────────────────────
  .addSubcommandGroup(group =>
    group.setName("emojis").setDescription("Custom Emojis für Bot-Nachrichten setzen")
      .addSubcommand(sub =>
        sub.setName("set")
          .setDescription("Einen Emoji-Slot mit deinem eigenen Emoji belegen")
          .addStringOption(o =>
            o.setName("slot").setDescription("Welcher Slot?").setRequired(true)
              .addChoices(
                { name: "welcome  — Willkommens-Header",    value: "welcome"  },
                { name: "ticket   — Ticket Panel & Intro",  value: "ticket"   },
                { name: "staff    — Staff-Zeile",           value: "staff"    },
                { name: "member   — Nutzer-Zeile",          value: "member"   },
                { name: "verified — Regeln-Zeile",          value: "verified" },
                { name: "info     — Info-Zeile",            value: "info"     },
                { name: "ok       — Erfolg / RP Start",     value: "ok"       },
                { name: "error    — Fehler / RP Stop",      value: "error"    },
                { name: "warning  — Warnung / Priorität",   value: "warning"  },
                { name: "rpstart  — RP Start Header",       value: "rpstart"  },
                { name: "rpstop   — RP Stop Header",        value: "rpstop"   },
              )
          )
          .addStringOption(o =>
            o.setName("emoji").setDescription("Dein Emoji (z.B. :meinemoji: oder Unicode)").setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub.setName("reset")
          .setDescription("Einen oder alle Emoji-Slots zurücksetzen")
          .addStringOption(o =>
            o.setName("slot").setDescription("Slot zurücksetzen (leer = alle)")
              .addChoices(
                { name: "welcome",  value: "welcome"  },
                { name: "ticket",   value: "ticket"   },
                { name: "staff",    value: "staff"    },
                { name: "member",   value: "member"   },
                { name: "verified", value: "verified" },
                { name: "info",     value: "info"     },
                { name: "ok",       value: "ok"       },
                { name: "error",    value: "error"    },
                { name: "warning",  value: "warning"  },
                { name: "rpstart",  value: "rpstart"  },
                { name: "rpstop",   value: "rpstop"   },
                { name: "alle",     value: "all"      },
              )
          )
      )
      .addSubcommand(sub =>
        sub.setName("list")
          .setDescription("Alle aktuell gesetzten Emoji-Slots anzeigen")
      )
  )

  // ── Top-level ──────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub.setName("view")
      .setDescription("Aktuelle Bot-Konfiguration anzeigen")
  )
  .addSubcommand(sub =>
    sub.setName("reset")
      .setDescription("Einen Abschnitt zurücksetzen")
      .addStringOption(o =>
        o.setName("section").setDescription("Welchen Abschnitt?").setRequired(true)
          .addChoices(
            { name: "Welcome", value: "welcome" },
            { name: "RP", value: "rp" },
            { name: "Alles", value: "all" },
          )
      )
  );

// ── Execute ───────────────────────────────────────────────────────────────────
async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId  = interaction.guild.id;
  const cfg      = await getGuildConfig(guildId);
  const sub      = interaction.options.getSubcommand(false);
  const group    = interaction.options.getSubcommandGroup(false);

  try {
    if (sub === "view")  return await handleView(interaction, cfg);
    if (sub === "reset") return await handleReset(interaction, guildId);

    if (group === "welcome") {
      if (sub === "channel")  return await welcomeChannel(interaction, guildId);
      if (sub === "banner")   return await welcomeBanner(interaction, guildId);
      if (sub === "channels") return await welcomeChannels(interaction, guildId);
      if (sub === "test")     return await welcomeTest(interaction, cfg);
    }

    if (group === "emojis") {
      if (sub === "set")   return await emojiSet(interaction, guildId);
      if (sub === "reset") return await emojiReset(interaction, guildId);
      if (sub === "list")  return await emojiList(interaction, guildId);
    }

    if (group === "tickets") {
      if (sub === "logs")       return await ticketLogs(interaction, guildId);
      if (sub === "category")   return await ticketCategory(interaction, guildId);
      if (sub === "addrole")    return await ticketRole(interaction, guildId, true);
      if (sub === "removerole") return await ticketRole(interaction, guildId, false);
      if (sub === "options")    return await ticketOptions(interaction, guildId, cfg);
    }

    if (group === "rp") {
      if (sub === "channel")  return await rpChannel(interaction, guildId);
      if (sub === "role")     return await rpRole(interaction, guildId);
      if (sub === "pingrole") return await rpPingRole(interaction, guildId);
    }
  } catch (err) {
    console.error("[SETUP]", err);
    return interaction.editReply({ content: `❌ Fehler: ${err.message}` });
  }
}

// ── View ──────────────────────────────────────────────────────────────────────
async function handleView(interaction, cfg) {
  const c = (id) => id ? `<#${id}>` : "❌ *Nicht gesetzt*";
  const r = (id) => id ? `<@&${id}>` : "❌ *Nicht gesetzt*";

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle("⚙️  NRW:RP Bot — Konfiguration")
    .addFields(
      {
        name: "👋 Willkommen",
        value: [
          `**Channel:** ${c(cfg.welcomeChannelId)}`,
          `**Banner:** ${cfg.welcomeBannerUrl ? `[Link](${cfg.welcomeBannerUrl})` : "❌ *Nicht gesetzt*"}`,
          `**Regeln:** ${c(cfg.welcomeRulesChannel)}`,
          `**Rollen:** ${c(cfg.welcomeRolesChannel)}`,
          `**Ticket:** ${c(cfg.welcomeTicketChannel)}`,
          `**Fraktionen:** ${c(cfg.welcomeFraktionChannel)}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🎫 Tickets",
        value: [
          `**Log-Channel:** ${c(cfg.ticketLogChannelId)}`,
          `**Kategorie:** ${c(cfg.ticketCategoryId)}`,
          `**Support-Rollen:** ${cfg.ticketSupportRoleIds?.length ? cfg.ticketSupportRoleIds.map(id => `<@&${id}>`).join(", ") : "❌ *Keine*"}`,
          `**Max pro Nutzer:** ${cfg.ticketMaxPerUser ?? 1} · **DM Transcript:** ${cfg.ticketDmTranscript ? "✅" : "❌"} · **Delay:** ${cfg.ticketCloseDelay ?? 5}s`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🎮 RP Start/Stop",
        value: [
          `**Channel:** ${c(cfg.rpChannelId)}`,
          `**Erlaubte Rolle:** ${r(cfg.rpAllowedRoleId)}`,
          `**Ping-Rolle:** ${r(cfg.rpPingRoleId)}`,
        ].join("\n"),
        inline: false,
      }
    )
    .setFooter({ text: `Server: ${interaction.guild.name}` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ── Reset ─────────────────────────────────────────────────────────────────────
async function handleReset(interaction, guildId) {
  const section = interaction.options.getString("section");
  const updates = {};

  if (section === "welcome" || section === "all") {
    Object.assign(updates, {
      welcomeChannelId: null, welcomeBannerUrl: null,
      welcomeRulesChannel: null, welcomeRolesChannel: null,
      welcomeTicketChannel: null, welcomeFraktionChannel: null,
    });
  }
  if (section === "rp" || section === "all") {
    Object.assign(updates, {
      rpChannelId: null, rpAllowedRoleId: null, rpPingRoleId: null,
    });
  }

  await updateGuildConfig(guildId, updates);
  return interaction.editReply({ content: `✅ Abschnitt **${section}** wurde zurückgesetzt.` });
}

// ── Welcome handlers ──────────────────────────────────────────────────────────
async function welcomeChannel(interaction, guildId) {
  const channel = interaction.options.getChannel("channel");
  await updateGuildConfig(guildId, { welcomeChannelId: channel.id });
  return interaction.editReply({ content: `✅ Willkommens-Channel gesetzt: ${channel}` });
}

async function welcomeBanner(interaction, guildId) {
  const url = interaction.options.getString("url");
  // Basic URL validation
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return interaction.editReply({ content: "❌ Bitte eine gültige URL eingeben (muss mit https:// beginnen)." });
  }
  await updateGuildConfig(guildId, { welcomeBannerUrl: url });
  return interaction.editReply({ content: `✅ Banner-URL gesetzt:\n${url}` });
}

async function welcomeChannels(interaction, guildId) {
  const regeln     = interaction.options.getChannel("regeln");
  const rollen     = interaction.options.getChannel("rollen");
  const ticket     = interaction.options.getChannel("ticket");
  const fraktionen = interaction.options.getChannel("fraktionen");

  await updateGuildConfig(guildId, {
    welcomeRulesChannel:    regeln.id,
    welcomeRolesChannel:    rollen.id,
    welcomeTicketChannel:   ticket.id,
    welcomeFraktionChannel: fraktionen.id,
  });

  return interaction.editReply({
    content: [
      "✅ Kanal-Erwähnungen gesetzt:",
      `📖 Regeln: ${regeln}`,
      `🏷️ Rollen: ${rollen}`,
      `🎫 Ticket: ${ticket}`,
      `⚔️ Fraktionen: ${fraktionen}`,
    ].join("\n"),
  });
}

async function welcomeTest(interaction, cfg) {
  // Fires the same logic as guildMemberAdd but for the admin themselves
  const { getEmojis } = require("../../utils/emojiManager");
  const member = interaction.member;

  if (!cfg.welcomeChannelId) {
    return interaction.editReply({ content: "❌ Kein Willkommens-Channel gesetzt. Bitte erst `/setup welcome channel` ausführen." });
  }

  const channel = interaction.guild.channels.cache.get(cfg.welcomeChannelId);
  if (!channel) {
    return interaction.editReply({ content: "❌ Willkommens-Channel nicht gefunden." });
  }

  const nickname = member.displayName || member.user.username;
  const ch = (id) => id ? `<#${id}>` : "`(nicht gesetzt)`";

  const emojis      = await getEmojis(interaction.guild);
  const ticketEmoji  = emojis.ticket   || "🎫";
  const staffEmoji   = emojis.staff    || "⭐";
  const memberEmoji  = emojis.member   || "👤";
  const verifiedEmoji = emojis.verified || "✅";
  const infoEmoji    = emojis.info     || "ℹ️";

  const mainText = [
    `Schön, dass du da bist **${nickname}**! Bitte lies dir diese Infos aufmerksam durch:`,
    ``,
    `${verifiedEmoji} Lies dir unsere ${ch(cfg.welcomeRulesChannel)} durch.`,
    `${memberEmoji} Hole dir dann eine Rolle in ${ch(cfg.welcomeRolesChannel)}, für Pings.`,
    `${ticketEmoji} Bei Fragen kannst du ein Ticket im ${ch(cfg.welcomeTicketChannel)} Channel öffnen.`,
    `${staffEmoji} Fraktionen findest du in unserem ${ch(cfg.welcomeFraktionChannel)} Channel.`,
    `${infoEmoji} Bei Interesse kannst du dich auch gerne im Staff Team bewerben!`,
  ].join("\n");
  const footer = `-# Bitte halte dich an unsere Server Regeln und viel Spaß im RP!\n-# NRW:RP I German`;

  if (cfg.welcomeBannerUrl) {
    await channel.send({
      flags: 32768,
      allowedMentions: { users: [member.id] },
      components: [
        { type: 10, content: `<@${member.id}> *(Testvorschau)*` },
        {
          type: 17,
          components: [
            { type: 12, items: [{ media: { url: cfg.welcomeBannerUrl } }] },
            { type: 10, content: `# ${memberEmoji} Willkommen hier auf NRW:RP I German` },
            { type: 14 },
            { type: 10, content: mainText },
            { type: 14 },
            { type: 10, content: footer },
          ],
        },
      ],
    });
  } else {
    const { EmbedBuilder } = require("discord.js");
    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle(`${memberEmoji} Willkommen hier auf NRW:RP I German`)
      .setDescription(mainText + "\n\n" + footer)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    await channel.send({
      content: `<@${member.id}> *(Testvorschau)*`,
      embeds: [embed],
      allowedMentions: { users: [member.id] },
    });
  }

  return interaction.editReply({ content: `✅ Testvorschau wurde in ${channel} gesendet.` });
}

// ── RP handlers ───────────────────────────────────────────────────────────────
async function rpChannel(interaction, guildId) {
  const channel = interaction.options.getChannel("channel");
  await updateGuildConfig(guildId, { rpChannelId: channel.id });
  return interaction.editReply({ content: `✅ RP-Channel gesetzt: ${channel}` });
}

async function rpRole(interaction, guildId) {
  const role = interaction.options.getRole("role");
  await updateGuildConfig(guildId, { rpAllowedRoleId: role.id });
  return interaction.editReply({ content: `✅ Erlaubte Rolle für /rp gesetzt: ${role}` });
}

async function rpPingRole(interaction, guildId) {
  const role = interaction.options.getRole("role");
  await updateGuildConfig(guildId, { rpPingRoleId: role.id });
  return interaction.editReply({ content: `✅ Ping-Rolle gesetzt: ${role}` });
}

// ── Emoji handlers ───────────────────────────────────────────────────────────
async function emojiSet(interaction, guildId) {
  const slot      = interaction.options.getString("slot");
  const emojiInput = interaction.options.getString("emoji").trim();
  const field     = SLOT_FIELD[slot];
  if (!field) return interaction.editReply({ content: "❌ Unbekannter Slot." });

  // Accept: <:name:id>  <a:name:id>  or plain unicode/text
  await updateGuildConfig(guildId, { [field]: emojiInput });

  return interaction.editReply({
    content: `✅ Slot **${slot}** gesetzt auf: ${emojiInput}`,
  });
}

async function emojiReset(interaction, guildId) {
  const slot  = interaction.options.getString("slot") || "all";
  const updates = {};

  if (slot === "all") {
    for (const field of Object.values(SLOT_FIELD)) updates[field] = null;
  } else {
    const field = SLOT_FIELD[slot];
    if (!field) return interaction.editReply({ content: "❌ Unbekannter Slot." });
    updates[field] = null;
  }

  await updateGuildConfig(guildId, updates);
  return interaction.editReply({ content: `✅ Emoji-Slot(s) **${slot}** zurückgesetzt auf Standard.` });
}

async function emojiList(interaction, guildId) {
  const { EmbedBuilder } = require("discord.js");
  const cfg    = await getGuildConfig(guildId);
  const emojis = await getEmojis(interaction.guild, cfg);

  const slots = Object.keys(SLOT_FIELD);
  const lines = slots.map(slot => {
    const field    = SLOT_FIELD[slot];
    const custom   = cfg[field];
    const resolved = emojis[slot] || UNICODE[slot] || "•";
    const source   = custom ? "✏️ Custom" : "📦 Standard";
    return `${resolved} \`${slot}\` — ${source}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🎨  Emoji Slots")
    .setDescription(lines.join("\n"))
    .setFooter({ text: "✏️ Custom = per /setup emojis set  •  📦 Standard = bundled/unicode" })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ── Ticket handlers ────────────────────────────────────────────────────────────
async function ticketLogs(interaction, guildId) {
  const channel = interaction.options.getChannel("channel");
  await updateGuildConfig(guildId, { ticketLogChannelId: channel.id });
  return interaction.editReply({ content: `✅ Ticket Log-Channel gesetzt: ${channel}` });
}

async function ticketCategory(interaction, guildId) {
  const cat = interaction.options.getChannel("kategorie");
  await updateGuildConfig(guildId, { ticketCategoryId: cat.id });
  return interaction.editReply({ content: `✅ Ticket-Kategorie gesetzt: **${cat.name}**` });
}

async function ticketRole(interaction, guildId, add) {
  const role = interaction.options.getRole("role");
  const cfg  = await getGuildConfig(guildId);
  let roles  = [...(cfg.ticketSupportRoleIds || [])];

  if (add) {
    if (roles.includes(role.id)) return interaction.editReply({ content: `⚠️ ${role} ist bereits eine Support-Rolle.` });
    roles.push(role.id);
  } else {
    if (!roles.includes(role.id)) return interaction.editReply({ content: `❌ ${role} ist keine Support-Rolle.` });
    roles = roles.filter(id => id !== role.id);
  }

  await updateGuildConfig(guildId, { ticketSupportRoleIds: roles });
  return interaction.editReply({ content: `✅ ${role} wurde ${add ? "hinzugefügt" : "entfernt"}.` });
}

async function ticketOptions(interaction, guildId, cfg) {
  const updates = {};
  const max   = interaction.options.getInteger("max_per_user");
  const dm    = interaction.options.getBoolean("dm_transcript");
  const delay = interaction.options.getInteger("close_delay");

  if (max   !== null) updates.ticketMaxPerUser  = max;
  if (dm    !== null) updates.ticketDmTranscript = dm;
  if (delay !== null) updates.ticketCloseDelay   = delay;

  if (!Object.keys(updates).length) return interaction.editReply({ content: "⚠️ Keine Änderungen angegeben." });
  await updateGuildConfig(guildId, updates);

  const lines = [];
  if (max   !== null) lines.push(`**Max pro Nutzer:** ${max}`);
  if (dm    !== null) lines.push(`**DM Transcript:** ${dm ? "✅" : "❌"}`);
  if (delay !== null) lines.push(`**Schließ-Verzögerung:** ${delay}s`);
  return interaction.editReply({ content: `✅ Ticket-Optionen aktualisiert:
${lines.join("\n")}` });
}

module.exports = { data, execute };

// NOTE: Ticket setup is handled via separate /setup ticket subcommands below.
// Append the ticket subcommand group by patching the data builder at module load.
