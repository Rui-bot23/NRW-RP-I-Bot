/**
 * Fraktion System für NRW:RP
 * /fraksetup   — Konfiguration (Channels, Rollen)
 * /frakcreate  — Fraktion offiziell machen
 * /frakdelete  — Fraktion auflösen
 * /fraklist    — Liste posten/updaten
 * /frakwarn    — Fraktion verwarnen
 * /frakupdate  — Fraktion aktualisieren
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  UnfurledMediaItemBuilder,
  MessageFlags,
  ChannelType,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");
const { Fraktion } = require("../../models");
const { getGuildConfig, updateGuildConfig } = require("../../utils/guildConfig");

// ── Kategorie config ──────────────────────────────────────────────────────────
const KATEGORIEN = {
  staatlich: { emoji: "🏛️", defaultLabel: "Staatliche Fraktionen" },
  illegal:   { emoji: "💀", defaultLabel: "Illegale Fraktionen"   },
  firma:     { emoji: "🏢", defaultLabel: "Firmen"                },
  andere:    { emoji: "📋", defaultLabel: "Andere"                },
};

function katLabel(cfg, kat) {
  const map = {
    staatlich: cfg.frakCatStaatlichLabel || "🏛️ Staatliche Fraktionen",
    illegal:   cfg.frakCatIllegalLabel   || "💀 Illegale Fraktionen",
    firma:     cfg.frakCatFirmaLabel     || "🏢 Firmen",
    andere:    cfg.frakCatAndereLabel    || "📋 Andere",
  };
  return map[kat] || kat;
}

// ── Fill placeholders ─────────────────────────────────────────────────────────
function fill(text, vars) {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v ?? ""), text || "");
}

// ── Permission check ──────────────────────────────────────────────────────────
function canManage(interaction, cfg) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg.fraktionAllowedRoleId && interaction.member.roles.cache.has(cfg.fraktionAllowedRoleId)) return true;
  return false;
}

// ── Build Fraktionsliste ──────────────────────────────────────────────────────
async function buildFrakListPayload(guildId, cfg) {
  const all = await Fraktion.find({ guildId, active: true }).sort({ name: 1 });

  const container = new ContainerBuilder().setAccentColor(0x5865F2);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${cfg.frakListTitle || "Fraktionsliste — NRW:RP I German"}`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  let hasAny = false;

  // Render each category in order
  for (const kat of ["staatlich", "illegal", "firma", "andere"]) {
    const fraks = all.filter(f => f.kategorie === kat);
    if (!fraks.length) continue;
    hasAny = true;

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${katLabel(cfg, kat)}`)
    );

    for (const frak of fraks) {
      const warnDots = "🔴".repeat(frak.warns) + "⚪".repeat(Math.max(0, 3 - frak.warns));
      const lines = [
        `**${frak.name}**`,
        `> 👤 Leitung: ${frak.leitungId ? `<@${frak.leitungId}>` : "*Nicht gesetzt*"}`,
        `> 📍 Standort: ${frak.standort || "*Nicht gesetzt*"}`,
        frak.discordLink ? `> 🌐 Discord: ${frak.discordLink}` : null,
        frak.aufbauschutzBis ? `> 🛡️ Aufbauschutz bis: ${frak.aufbauschutzBis}` : null,
        frak.testphaseBis    ? `> 🧪 Testphase bis: ${frak.testphaseBis}` : null,
        `> ⚠️ Warns: ${frak.warns}/3 ${warnDots}`,
      ].filter(Boolean).join("\n");

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines)
      );
    }

    container.addSeparatorComponents(new SeparatorBuilder());
  }

  if (!hasAny) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("*Aktuell sind noch keine Fraktionen eingetragen.*")
    );
    container.addSeparatorComponents(new SeparatorBuilder());
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# ${cfg.frakListFooter || "NRW:RP I German"} • ${all.length} Fraktion${all.length !== 1 ? "en" : ""} aktiv`
    )
  );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ── Update persistent list ────────────────────────────────────────────────────
async function updateFrakList(guild, cfg) {
  const channelId = cfg.fraktionListChannelId;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const payload = await buildFrakListPayload(guild.id, cfg);

  if (cfg.fraktionListMessageId) {
    try {
      const msg = await channel.messages.fetch(cfg.fraktionListMessageId);
      await msg.edit(payload);
      return;
    } catch {}
  }
  const msg = await channel.send(payload);
  await updateGuildConfig(guild.id, { fraktionListMessageId: msg.id });
}

// ── Build announcement embed (Components V2) ──────────────────────────────────
function buildAnnouncement(cfg, type, vars) {
  let title, body, color;

  if (type === "offiziell") {
    title = fill(cfg.frakMsgOffiziellTitle  || "FRAKTION OFFIZIELL",   vars);
    body  = fill(cfg.frakMsgOffiziellBody   || "Die Fraktion **{name}** ist nun offiziell.", vars);
    color = 0x57F287;
  } else if (type === "aufgeloest") {
    title = fill(cfg.frakMsgAufgeloestTitle || "FRAKTION AUFGELÖST",   vars);
    body  = fill(cfg.frakMsgAufgeloestBody  || "Die Fraktion **{name}** wurde aufgelöst.",   vars);
    color = 0xED4245;
  } else if (type === "warn") {
    title = fill(cfg.frakMsgWarnTitle       || "FRAKTION VERWARNT",    vars);
    body  = fill(cfg.frakMsgWarnBody        || "Die Fraktion **{name}** hat **{warns}/3** Verwarnungen.\n**Grund:** {grund}", vars);
    color = 0xFEE75C;
  }

  const greeting = fill(cfg.frakMsgGreeting || "Mit freundlichen Grüßen,\n@frakleitung", vars);
  const sign     = type === "offiziell" ? "➕" : type === "aufgeloest" ? "➖" : "⚠️";

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${sign} ${title}`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${sign} ${body}`)
    )
    .addSeparatorComponents(new SeparatorBuilder());

  // Extra details for offiziell
  if (type === "offiziell") {
    const details = [
      `🏛️ **Fraktion:** ${vars.name}`,
      `👤 **Leitung:** <@${vars.leitungId}>`,
      vars.aufbauschutz ? `🛡️ **Aufbauschutz bis:** ${vars.aufbauschutz}` : null,
      vars.testphase    ? `🧪 **Testphase bis:** ${vars.testphase}` : null,
      `📍 **Standort:** ${vars.standort}`,
      `🌐 **Discord-Server:** ${vars.discord}`,
    ].filter(Boolean).join("\n");

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(details)
    );
    container.addSeparatorComponents(new SeparatorBuilder());
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(greeting)
  );

  // Optional banner
  if (cfg.frakBannerUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setMedia(new UnfurledMediaItemBuilder().setURL(cfg.frakBannerUrl))
      )
    );
  }

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// /fraksetup
// ─────────────────────────────────────────────────────────────────────────────
const setupData = new SlashCommandBuilder()
  .setName("fraksetup")
  .setDescription("Fraktions-System konfigurieren")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName("channels")
      .setDescription("Channels setzen")
      .addChannelOption(o =>
        o.setName("liste").setDescription("Channel für die Fraktionsliste")
          .addChannelTypes(ChannelType.GuildText)
      )
      .addChannelOption(o =>
        o.setName("ankündigungen").setDescription("Channel für Fraktions-Ankündigungen")
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(sub =>
    sub.setName("rolle")
      .setDescription("Rolle setzen die /frak Commands nutzen darf")
      .addRoleOption(o => o.setName("rolle").setDescription("Erlaubte Rolle").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("banner")
      .setDescription("Banner-URL für Ankündigungen setzen")
      .addStringOption(o => o.setName("url").setDescription("Bild-URL (oder 'remove' zum Entfernen)").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("status")
      .setDescription("Aktuelle Frak-Konfiguration anzeigen")
  );

async function executeSetup(interaction) {
  await interaction.deferReply({ flags: 64 });
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const cfg = await getGuildConfig(guildId);

  if (sub === "channels") {
    const liste       = interaction.options.getChannel("liste");
    const ankündigungen = interaction.options.getChannel("ankündigungen");
    const updates = {};
    if (liste)         { updates.fraktionListChannelId = liste.id; updates.fraktionListMessageId = null; }
    if (ankündigungen) { updates.fraktionAnnounceChannelId = ankündigungen.id; }
    if (!Object.keys(updates).length) return interaction.editReply({ content: "⚠️ Gib mindestens einen Channel an." });
    await updateGuildConfig(guildId, updates);
    const lines = [];
    if (liste)         lines.push(`📊 **Liste:** ${liste}`);
    if (ankündigungen) lines.push(`📣 **Ankündigungen:** ${ankündigungen}`);
    return interaction.editReply({ content: `✅ Channels gesetzt:\n${lines.join("\n")}` });
  }

  if (sub === "rolle") {
    const rolle = interaction.options.getRole("rolle");
    await updateGuildConfig(guildId, { fraktionAllowedRoleId: rolle.id });
    return interaction.editReply({ content: `✅ Erlaubte Rolle gesetzt: ${rolle}` });
  }

  if (sub === "banner") {
    const url = interaction.options.getString("url");
    await updateGuildConfig(guildId, { frakBannerUrl: url === "remove" ? null : url });
    return interaction.editReply({ content: url === "remove" ? "✅ Banner entfernt." : `✅ Banner gesetzt: ${url}` });
  }

  if (sub === "status") {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🏛️ Frak-Setup")
          .addFields(
            { name: "📊 Listen-Channel",       value: cfg.fraktionListChannelId      ? `<#${cfg.fraktionListChannelId}>`      : "❌ Nicht gesetzt", inline: true },
            { name: "📣 Ankündigungs-Channel",  value: cfg.fraktionAnnounceChannelId  ? `<#${cfg.fraktionAnnounceChannelId}>` : "❌ Nicht gesetzt", inline: true },
            { name: "🔑 Erlaubte Rolle",        value: cfg.fraktionAllowedRoleId      ? `<@&${cfg.fraktionAllowedRoleId}>`    : "❌ Nicht gesetzt", inline: true },
            { name: "🖼️ Banner",               value: cfg.frakBannerUrl              ? `[Link](${cfg.frakBannerUrl})`        : "❌ Nicht gesetzt", inline: true },
          )
          .setTimestamp(),
      ],
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// /frakcreate
// ─────────────────────────────────────────────────────────────────────────────
const createData = new SlashCommandBuilder()
  .setName("frakcreate")
  .setDescription("Fraktion offiziell machen")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Name der Fraktion").setRequired(true))
  .addUserOption(o => o.setName("leitung").setDescription("Leitung der Fraktion").setRequired(true))
  .addStringOption(o => o.setName("standort").setDescription("Standort der Fraktion").setRequired(true))
  .addStringOption(o => o.setName("discord").setDescription("Discord-Link der Fraktion").setRequired(true))
  .addStringOption(o =>
    o.setName("kategorie").setDescription("Kategorie der Fraktion").setRequired(true)
      .addChoices(
        { name: "🏛️ Staatliche Fraktion", value: "staatlich" },
        { name: "💀 Illegale Fraktion",    value: "illegal"   },
        { name: "🏢 Firma",               value: "firma"     },
        { name: "📋 Andere",              value: "andere"    },
      )
  )
  .addStringOption(o => o.setName("aufbauschutz").setDescription("Aufbauschutz bis (z.B. Mittwoch, 8. April 2026 22:27)"))
  .addStringOption(o => o.setName("testphase").setDescription("Testphase bis (z.B. Freitag, 10. April 2026 22:27)"));

async function executeCreate(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg = await getGuildConfig(interaction.guild.id);
  if (!canManage(interaction, cfg)) return interaction.editReply({ content: "❌ Keine Berechtigung." });

  const name         = interaction.options.getString("name");
  const leitung      = interaction.options.getUser("leitung");
  const standort     = interaction.options.getString("standort");
  const discord      = interaction.options.getString("discord");
  const kategorie    = interaction.options.getString("kategorie");
  const aufbauschutz = interaction.options.getString("aufbauschutz") || null;
  const testphase    = interaction.options.getString("testphase")    || null;

  const existing = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });
  if (existing) return interaction.editReply({ content: `❌ Eine Fraktion namens **${name}** ist bereits aktiv.` });

  const frak = await Fraktion.create({
    guildId: interaction.guild.id,
    fraktionId: uuidv4(),
    name, kategorie,
    leitungId: leitung.id,
    discordLink: discord,
    standort,
    aufbauschutzBis: aufbauschutz,
    testphaseBis: testphase,
  });

  // Announcement
  if (cfg.fraktionAnnounceChannelId) {
    const ch = interaction.guild.channels.cache.get(cfg.fraktionAnnounceChannelId);
    if (ch) {
      const payload = buildAnnouncement(cfg, "offiziell", {
        name, leitungId: leitung.id, standort, discord, aufbauschutz, testphase,
      });
      const msg = await ch.send(payload);
      frak.announceChannelId = ch.id;
      frak.announceMsgId     = msg.id;
      await frak.save();
    }
  }

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ **${name}** (${katLabel(cfg, kategorie)}) wurde offiziell gemacht.` });
}

// ─────────────────────────────────────────────────────────────────────────────
// /frakdelete
// ─────────────────────────────────────────────────────────────────────────────
const deleteData = new SlashCommandBuilder()
  .setName("frakdelete")
  .setDescription("Fraktion auflösen")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Fraktion").setRequired(true).setAutocomplete(true))
  .addStringOption(o => o.setName("grund").setDescription("Grund für die Auflösung").setRequired(true));

async function executeDelete(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg   = await getGuildConfig(interaction.guild.id);
  if (!canManage(interaction, cfg)) return interaction.editReply({ content: "❌ Keine Berechtigung." });

  const name  = interaction.options.getString("name");
  const grund = interaction.options.getString("grund");
  const frak  = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });
  if (!frak) return interaction.editReply({ content: `❌ Keine aktive Fraktion namens **${name}**.` });

  frak.active = false;
  await frak.save();

  if (cfg.fraktionAnnounceChannelId) {
    const ch = interaction.guild.channels.cache.get(cfg.fraktionAnnounceChannelId);
    if (ch) {
      const payload = buildAnnouncement(cfg, "aufgeloest", { name, grund });
      await ch.send(payload);
    }
  }

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ Fraktion **${name}** wurde aufgelöst.` });
}

// ─────────────────────────────────────────────────────────────────────────────
// /fraklist
// ─────────────────────────────────────────────────────────────────────────────
const listData = new SlashCommandBuilder()
  .setName("fraklist")
  .setDescription("Fraktionsliste posten/aktualisieren")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(o =>
    o.setName("channel").setDescription("Channel (überschreibt den gespeicherten)")
      .addChannelTypes(ChannelType.GuildText)
  );

async function executeList(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg = await getGuildConfig(interaction.guild.id);
  const ch  = interaction.options.getChannel("channel");

  if (ch) {
    await updateGuildConfig(interaction.guild.id, { fraktionListChannelId: ch.id, fraktionListMessageId: null });
    cfg.fraktionListChannelId  = ch.id;
    cfg.fraktionListMessageId  = null;
  }

  if (!cfg.fraktionListChannelId) {
    return interaction.editReply({ content: "❌ Kein Listen-Channel gesetzt. Nutze `/fraksetup channels liste:#kanal`." });
  }

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: "✅ Fraktionsliste wurde aktualisiert." });
}

// ─────────────────────────────────────────────────────────────────────────────
// /frakwarn
// ─────────────────────────────────────────────────────────────────────────────
const warnData = new SlashCommandBuilder()
  .setName("frakwarn")
  .setDescription("Fraktion verwarnen")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Fraktion").setRequired(true).setAutocomplete(true))
  .addStringOption(o => o.setName("grund").setDescription("Grund der Verwarnung").setRequired(true))
  .addIntegerOption(o => o.setName("warns").setDescription("Neue Gesamtanzahl (leer = +1)").setMinValue(0).setMaxValue(3));

async function executeWarn(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg  = await getGuildConfig(interaction.guild.id);
  if (!canManage(interaction, cfg)) return interaction.editReply({ content: "❌ Keine Berechtigung." });

  const name  = interaction.options.getString("name");
  const grund = interaction.options.getString("grund");
  const frak  = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });
  if (!frak) return interaction.editReply({ content: `❌ Fraktion **${name}** nicht gefunden.` });

  const newWarns = interaction.options.getInteger("warns") ?? Math.min(3, frak.warns + 1);
  frak.warns = newWarns;
  await frak.save();

  if (cfg.fraktionAnnounceChannelId) {
    const ch = interaction.guild.channels.cache.get(cfg.fraktionAnnounceChannelId);
    if (ch) {
      const payload = buildAnnouncement(cfg, "warn", { name, warns: newWarns, grund });
      await ch.send(payload);
    }
  }

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ **${name}** hat jetzt **${newWarns}/3** Verwarnungen.\nGrund: ${grund}` });
}

// ─────────────────────────────────────────────────────────────────────────────
// /frakupdate
// ─────────────────────────────────────────────────────────────────────────────
const updateData = new SlashCommandBuilder()
  .setName("frakupdate")
  .setDescription("Fraktion aktualisieren")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Fraktion").setRequired(true).setAutocomplete(true))
  .addUserOption(o => o.setName("leitung").setDescription("Neue Leitung"))
  .addStringOption(o => o.setName("discord").setDescription("Neuer Discord-Link"))
  .addStringOption(o => o.setName("standort").setDescription("Neuer Standort"))
  .addStringOption(o => o.setName("aufbauschutz").setDescription("Aufbauschutz bis"))
  .addStringOption(o => o.setName("testphase").setDescription("Testphase bis"))
  .addStringOption(o =>
    o.setName("kategorie").setDescription("Kategorie ändern")
      .addChoices(
        { name: "🏛️ Staatliche Fraktion", value: "staatlich" },
        { name: "💀 Illegale Fraktion",    value: "illegal"   },
        { name: "🏢 Firma",               value: "firma"     },
        { name: "📋 Andere",              value: "andere"    },
      )
  );

async function executeUpdate(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg  = await getGuildConfig(interaction.guild.id);
  if (!canManage(interaction, cfg)) return interaction.editReply({ content: "❌ Keine Berechtigung." });

  const name = interaction.options.getString("name");
  const frak = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });
  if (!frak) return interaction.editReply({ content: `❌ Fraktion **${name}** nicht gefunden.` });

  const leitung      = interaction.options.getUser("leitung");
  const discord      = interaction.options.getString("discord");
  const standort     = interaction.options.getString("standort");
  const aufbauschutz = interaction.options.getString("aufbauschutz");
  const testphase    = interaction.options.getString("testphase");
  const kategorie    = interaction.options.getString("kategorie");

  if (leitung)      frak.leitungId       = leitung.id;
  if (discord)      frak.discordLink     = discord;
  if (standort)     frak.standort        = standort;
  if (aufbauschutz) frak.aufbauschutzBis = aufbauschutz;
  if (testphase)    frak.testphaseBis    = testphase;
  if (kategorie)    frak.kategorie       = kategorie;

  await frak.save();
  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ **${name}** wurde aktualisiert.` });
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const fraks   = await Fraktion.find({ guildId: interaction.guild.id, active: true }).limit(25);
  await interaction.respond(
    fraks.filter(f => f.name.toLowerCase().includes(focused))
         .map(f => ({ name: `${KATEGORIEN[f.kategorie]?.emoji || ""} ${f.name}`, value: f.name }))
  );
}

module.exports = {
  data:    setupData,
  execute: executeSetup,
  frakcreate: { data: createData, execute: executeCreate },
  frakdelete: { data: deleteData, execute: executeDelete, autocomplete },
  fraklist:   { data: listData,   execute: executeList   },
  frakwarn:   { data: warnData,   execute: executeWarn,   autocomplete },
  frakupdate: { data: updateData, execute: executeUpdate, autocomplete },
};
