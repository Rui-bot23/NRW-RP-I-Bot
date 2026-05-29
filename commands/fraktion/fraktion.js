/**
 * Fraktion System für NRW:RP
 * Rollen: bis zu 2, werden sowohl für Commands als auch für Pings genutzt
 * Kategoriefarben: staatlich=blau, illegal=rot, firma=gelb, andere=grün
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

// ── Kategorie colors & labels ─────────────────────────────────────────────────
const KAT_COLORS = {
  staatlich: 0x5865F2,  // Blau
  illegal:   0xED4245,  // Rot
  firma:     0xFEE75C,  // Gelb
  andere:    0x57F287,  // Grün
};

function katLabel(cfg, kat) {
  return {
    staatlich: cfg.frakCatStaatlichLabel || "🏛️ Staatliche Fraktionen",
    illegal:   cfg.frakCatIllegalLabel   || "💀 Illegale Fraktionen",
    firma:     cfg.frakCatFirmaLabel     || "🏢 Firmen",
    andere:    cfg.frakCatAndereLabel    || "📋 Andere",
  }[kat] || kat;
}

// ── Fill placeholders ─────────────────────────────────────────────────────────
function fill(text, vars) {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v ?? ""), text || "");
}

// ── Permission check (uses fraktionRoleIds) ───────────────────────────────────
function canManage(interaction, cfg) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roleIds = cfg.fraktionRoleIds || [];
  return roleIds.some(id => interaction.member.roles.cache.has(id));
}

// ── Build ping string from fraktionRoleIds ────────────────────────────────────
function buildPing(cfg) {
  const ids = cfg.fraktionRoleIds || [];
  return ids.map(id => `<@&${id}>`).join(" ");
}

// ── Build Fraktionsliste ──────────────────────────────────────────────────────
// Each category gets its own container with its own accent color
async function buildFrakListPayload(guildId, cfg) {
  const all = await Fraktion.find({ guildId, active: true }).sort({ name: 1 });
  const components = [];

  // Header container (neutral blue)
  const header = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ${cfg.frakListTitle || "Fraktionsliste — NRW:RP I German"}`
      )
    );
  components.push(header);

  let hasAny = false;

  for (const kat of ["staatlich", "illegal", "firma", "andere"]) {
    const fraks = all.filter(f => f.kategorie === kat);
    if (!fraks.length) continue;
    hasAny = true;

    // New container per category with its own color
    const katContainer = new ContainerBuilder()
      .setAccentColor(KAT_COLORS[kat]);

    katContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${katLabel(cfg, kat)}`)
    );
    katContainer.addSeparatorComponents(new SeparatorBuilder());

    for (const frak of fraks) {
      const warnDots = "🔴".repeat(frak.warns) + "⚪".repeat(Math.max(0, 3 - frak.warns));
      const lines = [
        `**${frak.name}**`,
        `> 👤 Leitung: ${frak.leitungId ? `<@${frak.leitungId}>` : "*Nicht gesetzt*"}`,
        `> 📍 Standort: ${frak.standort || "*Nicht gesetzt*"}`,
        frak.discordLink     ? `> 🌐 Discord: ${frak.discordLink}`              : null,
        frak.aufbauschutzBis ? `> 🛡️ Aufbauschutz bis: ${frak.aufbauschutzBis}` : null,
        frak.testphaseBis    ? `> 🧪 Testphase bis: ${frak.testphaseBis}`       : null,
        `> ⚠️ Warns: ${frak.warns}/3 ${warnDots}`,
      ].filter(Boolean).join("\n");

      katContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
    }

    components.push(katContainer);
  }

  if (!hasAny) {
    const empty = new ContainerBuilder()
      .setAccentColor(0x5865F2)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("*Aktuell sind noch keine Fraktionen eingetragen.*")
      );
    components.push(empty);
  }

  // Footer container
  const footer = new ContainerBuilder()
    .setAccentColor(0x2B2D31)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${cfg.frakListFooter || "NRW:RP I German"} • ${all.length} Fraktion${all.length !== 1 ? "en" : ""} aktiv`
      )
    );
  components.push(footer);

  return { components, flags: MessageFlags.IsComponentsV2 };
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

// ── Build announcement (one container per category color) ─────────────────────
function buildAnnouncement(cfg, type, vars, ping = null, pingRoleIds = []) {
  // Color based on category
  const katColor = KAT_COLORS[vars.kategorie] || 0x5865F2;
  let color;
  if (type === "offiziell")   color = katColor;
  else if (type === "aufgeloest") color = 0xED4245;
  else color = 0xFEE75C; // warn

  let title, body;
  if (type === "offiziell") {
    title = fill(cfg.frakMsgOffiziellTitle  || "FRAKTION OFFIZIELL", vars);
    body  = fill(cfg.frakMsgOffiziellBody   || "Die Fraktion **{name}** ist nun offiziell.", vars);
  } else if (type === "aufgeloest") {
    title = fill(cfg.frakMsgAufgeloestTitle || "FRAKTION AUFGELÖST", vars);
    body  = fill(cfg.frakMsgAufgeloestBody  || "Die Fraktion **{name}** wurde offiziell aufgelöst.", vars);
  } else {
    title = fill(cfg.frakMsgWarnTitle       || "FRAKTION VERWARNT",  vars);
    body  = fill(cfg.frakMsgWarnBody        || "Die Fraktion **{name}** hat **{warns}/3** Verwarnungen.\n**Grund:** {grund}", vars);
  }

  // Build actual role mentions for the greeting
  const roleMentions = pingRoleIds.length
    ? pingRoleIds.map(id => `<@&${id}>`).join(" ")
    : (ping || "@frakleitung");
  const greetingTemplate = cfg.frakMsgGreeting || "Mit freundlichen Grüßen,\n{frakleitung}";
  const greeting = fill(greetingTemplate, { ...vars, frakleitung: roleMentions });
  const sign = type === "offiziell" ? "➕" : type === "aufgeloest" ? "➖" : "⚠️";

  const container = new ContainerBuilder()
    .setAccentColor(color);

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${sign} ${title}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${sign} ${body}`))
    .addSeparatorComponents(new SeparatorBuilder());

  if (type === "offiziell") {
    const details = [
      `🏛️ **Fraktion:** ${vars.name}`,
      `👤 **Leitung:** <@${vars.leitungId}>`,
      vars.aufbauschutz ? `🛡️ **Aufbauschutz bis:** ${vars.aufbauschutz}` : null,
      vars.testphase    ? `🧪 **Testphase bis:** ${vars.testphase}`        : null,
      `📍 **Standort:** ${vars.standort}`,
      `🌐 **Discord-Server:** ${vars.discord}`,
    ].filter(Boolean).join("\n");

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(details));
    container.addSeparatorComponents(new SeparatorBuilder());
  }

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(greeting));

  if (cfg.frakBannerUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setMedia(new UnfurledMediaItemBuilder().setURL(cfg.frakBannerUrl))
      )
    );
  }

  const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
  if (ping && pingRoleIds.length) {
    payload.allowedMentions = { roles: pingRoleIds };
  }
  return payload;
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
        o.setName("liste").setDescription("Fraktionsliste Channel")
          .addChannelTypes(ChannelType.GuildText)
      )
      .addChannelOption(o =>
        o.setName("ankündigungen").setDescription("Ankündigungs-Channel")
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(sub =>
    sub.setName("rolle")
      .setDescription("Rollen setzen (min 1, max 2) — diese Rollen dürfen Commands nutzen UND werden gepingt")
      .addRoleOption(o => o.setName("rolle1").setDescription("Erste Rolle").setRequired(true))
      .addRoleOption(o => o.setName("rolle2").setDescription("Zweite Rolle (optional)"))
  )
  .addSubcommand(sub =>
    sub.setName("banner")
      .setDescription("Banner-URL für Ankündigungen (oder 'remove')")
      .addStringOption(o => o.setName("url").setDescription("Bild-URL").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("status")
      .setDescription("Aktuelle Konfiguration anzeigen")
  );

async function executeSetup(interaction) {
  await interaction.deferReply({ flags: 64 });
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const cfg     = await getGuildConfig(guildId);

  if (sub === "channels") {
    const liste  = interaction.options.getChannel("liste");
    const ankünd = interaction.options.getChannel("ankündigungen");
    if (!liste && !ankünd) return interaction.editReply({ content: "⚠️ Gib mindestens einen Channel an." });
    const updates = {};
    if (liste)  { updates.fraktionListChannelId = liste.id; updates.fraktionListMessageId = null; }
    if (ankünd) { updates.fraktionAnnounceChannelId = ankünd.id; }
    await updateGuildConfig(guildId, updates);
    return interaction.editReply({ content: `✅ Channels gesetzt:\n${liste ? `📊 Liste: ${liste}\n` : ""}${ankünd ? `📣 Ankündigungen: ${ankünd}` : ""}` });
  }

  if (sub === "rolle") {
    const r1 = interaction.options.getRole("rolle1");
    const r2 = interaction.options.getRole("rolle2");
    const ids = [r1.id];
    if (r2 && r2.id !== r1.id) ids.push(r2.id);
    await updateGuildConfig(guildId, { fraktionRoleIds: ids });
    return interaction.editReply({
      content: `✅ Fraktions-Rollen gesetzt:\n${ids.map(id => `<@&${id}>`).join(" und ")}\n\n> Diese Rollen dürfen Fraktions-Commands nutzen und werden bei Ankündigungen gepingt.`,
    });
  }

  if (sub === "banner") {
    const url = interaction.options.getString("url");
    await updateGuildConfig(guildId, { frakBannerUrl: url === "remove" ? null : url });
    return interaction.editReply({ content: url === "remove" ? "✅ Banner entfernt." : `✅ Banner: ${url}` });
  }

  if (sub === "status") {
    const roleIds = cfg.fraktionRoleIds || [];
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🏛️ Frak-Setup Status")
          .addFields(
            { name: "📊 Listen-Channel",      value: cfg.fraktionListChannelId      ? `<#${cfg.fraktionListChannelId}>`      : "❌ Nicht gesetzt", inline: true },
            { name: "📣 Ankündigungs-Channel", value: cfg.fraktionAnnounceChannelId  ? `<#${cfg.fraktionAnnounceChannelId}>` : "❌ Nicht gesetzt", inline: true },
            { name: "🔑 Rollen (Command + Ping)", value: roleIds.length ? roleIds.map(id => `<@&${id}>`).join("\n") : "❌ Nicht gesetzt", inline: false },
            { name: "🖼️ Banner",              value: cfg.frakBannerUrl              ? `[Link](${cfg.frakBannerUrl})`        : "❌ Nicht gesetzt", inline: true },
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
  .addStringOption(o => o.setName("standort").setDescription("Standort").setRequired(true))
  .addStringOption(o => o.setName("discord").setDescription("Discord-Link").setRequired(true))
  .addStringOption(o =>
    o.setName("kategorie").setDescription("Kategorie").setRequired(true)
      .addChoices(
        { name: "🏛️ Staatliche Fraktion", value: "staatlich" },
        { name: "💀 Illegale Fraktion",    value: "illegal"   },
        { name: "🏢 Firma",               value: "firma"     },
        { name: "📋 Andere",              value: "andere"    },
      )
  )
  .addStringOption(o => o.setName("aufbauschutz").setDescription("Aufbauschutz bis"))
  .addStringOption(o => o.setName("testphase").setDescription("Testphase bis"));

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
  if (existing) return interaction.editReply({ content: `❌ Fraktion **${name}** ist bereits aktiv.` });

  const frak = await Fraktion.create({
    guildId: interaction.guild.id,
    fraktionId: uuidv4(),
    name, kategorie,
    leitungId: leitung.id,
    discordLink: discord,
    standort, aufbauschutzBis: aufbauschutz, testphaseBis: testphase,
  });

  if (cfg.fraktionAnnounceChannelId) {
    const ch = interaction.guild.channels.cache.get(cfg.fraktionAnnounceChannelId);
    if (ch) {
      const ping    = buildPing(cfg);
      const payload = buildAnnouncement(cfg, "offiziell", { name, leitungId: leitung.id, standort, discord, aufbauschutz, testphase, kategorie }, ping, cfg.fraktionRoleIds || []);
      const msg = await ch.send(payload);
      frak.announceChannelId = ch.id;
      frak.announceMsgId     = msg.id;
      await frak.save();
    }
  }

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ **${name}** (${katLabel(cfg, kategorie)}) ist nun offiziell.` });
}

// ─────────────────────────────────────────────────────────────────────────────
// /frakdelete
// ─────────────────────────────────────────────────────────────────────────────
const deleteData = new SlashCommandBuilder()
  .setName("frakdelete")
  .setDescription("Fraktion auflösen")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Fraktion").setRequired(true).setAutocomplete(true))
  .addStringOption(o => o.setName("grund").setDescription("Grund").setRequired(true));

async function executeDelete(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg   = await getGuildConfig(interaction.guild.id);
  if (!canManage(interaction, cfg)) return interaction.editReply({ content: "❌ Keine Berechtigung." });

  const name  = interaction.options.getString("name");
  const grund = interaction.options.getString("grund");
  const frak  = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });
  if (!frak) return interaction.editReply({ content: `❌ Keine aktive Fraktion **${name}** gefunden.` });

  frak.active = false;
  await frak.save();

  if (cfg.fraktionAnnounceChannelId) {
    const ch = interaction.guild.channels.cache.get(cfg.fraktionAnnounceChannelId);
    if (ch) {
      const ping    = buildPing(cfg);
      const payload = buildAnnouncement(cfg, "aufgeloest", { name, grund, kategorie: frak.kategorie }, ping, cfg.fraktionRoleIds || []);
      await ch.send(payload);
    }
  }

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ **${name}** wurde aufgelöst.` });
}

// ─────────────────────────────────────────────────────────────────────────────
// /fraklist
// ─────────────────────────────────────────────────────────────────────────────
const listData = new SlashCommandBuilder()
  .setName("fraklist")
  .setDescription("Fraktionsliste posten/aktualisieren")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(o =>
    o.setName("channel").setDescription("Channel (überschreibt gespeicherten)")
      .addChannelTypes(ChannelType.GuildText)
  );

async function executeList(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg = await getGuildConfig(interaction.guild.id);
  const ch  = interaction.options.getChannel("channel");

  if (ch) {
    await updateGuildConfig(interaction.guild.id, { fraktionListChannelId: ch.id, fraktionListMessageId: null });
    cfg.fraktionListChannelId = ch.id;
    cfg.fraktionListMessageId = null;
  }

  if (!cfg.fraktionListChannelId) {
    return interaction.editReply({ content: "❌ Kein Listen-Channel. Nutze `/fraksetup channels liste:#kanal`." });
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
  .addStringOption(o => o.setName("grund").setDescription("Grund").setRequired(true))
  .addIntegerOption(o => o.setName("warns").setDescription("Neue Gesamtanzahl (leer = +1)").setMinValue(0).setMaxValue(3));

async function executeWarn(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg  = await getGuildConfig(interaction.guild.id);
  if (!canManage(interaction, cfg)) return interaction.editReply({ content: "❌ Keine Berechtigung." });

  const name  = interaction.options.getString("name");
  const grund = interaction.options.getString("grund");
  const frak  = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });
  if (!frak) return interaction.editReply({ content: `❌ Fraktion **${name}** nicht gefunden.` });

  frak.warns = interaction.options.getInteger("warns") ?? Math.min(3, frak.warns + 1);
  await frak.save();

  if (cfg.fraktionAnnounceChannelId) {
    const ch = interaction.guild.channels.cache.get(cfg.fraktionAnnounceChannelId);
    if (ch) {
      const ping    = buildPing(cfg);
      const payload = buildAnnouncement(cfg, "warn", { name, warns: frak.warns, grund, kategorie: frak.kategorie }, ping, cfg.fraktionRoleIds || []);
      await ch.send(payload);
    }
  }

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ **${name}** hat jetzt **${frak.warns}/3** Verwarnungen.` });
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

  const leitung  = interaction.options.getUser("leitung");
  const discord  = interaction.options.getString("discord");
  const standort = interaction.options.getString("standort");
  const aufb     = interaction.options.getString("aufbauschutz");
  const test     = interaction.options.getString("testphase");
  const kat      = interaction.options.getString("kategorie");

  if (leitung)  frak.leitungId       = leitung.id;
  if (discord)  frak.discordLink     = discord;
  if (standort) frak.standort        = standort;
  if (aufb)     frak.aufbauschutzBis = aufb;
  if (test)     frak.testphaseBis    = test;
  if (kat)      frak.kategorie       = kat;

  await frak.save();
  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ **${name}** wurde aktualisiert.` });
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const katEmoji = { staatlich: "🏛️", illegal: "💀", firma: "🏢", andere: "📋" };
  const fraks = await Fraktion.find({ guildId: interaction.guild.id, active: true }).limit(25);
  await interaction.respond(
    fraks.filter(f => f.name.toLowerCase().includes(focused))
         .map(f => ({ name: `${katEmoji[f.kategorie] || ""} ${f.name}`, value: f.name }))
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
