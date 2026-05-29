/**
 * Fraktion System für NRW:RP
 * /frakcreate  — Fraktion offiziell machen
 * /frakdelete  — Fraktion auflösen
 * /fraklist    — Fraktionsliste updaten/posten
 * /frakwarn    — Fraktion verwarnen
 * /frakupdate  — Fraktion aktualisieren (Discord, Standort, etc.)
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
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");
const { Fraktion } = require("../../models");
const { getGuildConfig, updateGuildConfig } = require("../../utils/guildConfig");

// ── Permission check ──────────────────────────────────────────────────────────
function canManageFrak(interaction, cfg) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg.fraktionAllowedRoleId && interaction.member.roles.cache.has(cfg.fraktionAllowedRoleId)) return true;
  return false;
}

// ── Build the Fraktionsliste embed (Components V2) ────────────────────────────
async function buildFrakListPayload(guildId, guild) {
  const fraktionen = await Fraktion.find({ guildId, active: true }).sort({ createdAt: 1 });

  const container = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# 🏛️ Staatliche Fraktionen — NRW:RP I German")
    )
    .addSeparatorComponents(new SeparatorBuilder());

  if (!fraktionen.length) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("*Aktuell sind noch keine Fraktionen eingetragen.*")
    );
  } else {
    for (const frak of fraktionen) {
      const warnBar = frak.warns > 0 ? `⚠️ ${"🔴".repeat(frak.warns)}${"⚪".repeat(Math.max(0, 3 - frak.warns))}` : "✅ Keine Verwarnungen";
      const lines = [
        `### ${frak.name}`,
        `> 👤 **Leitung:** ${frak.leitungId ? `<@${frak.leitungId}>` : "*Nicht gesetzt*"}`,
        `> 📍 **Standort:** ${frak.standort || "*Nicht gesetzt*"}`,
        `> 🌐 **Discord:** ${frak.discordLink || "*Nicht gesetzt*"}`,
        `> ⚠️ **Warns:** ${frak.warns} von 3 ${warnBar}`,
        ...(frak.aufbauschutzBis ? [`> 🛡️ **Aufbauschutz bis:** ${frak.aufbauschutzBis}`] : []),
        ...(frak.testphaseBis    ? [`> 🧪 **Testphase bis:** ${frak.testphaseBis}`] : []),
        "",
      ];
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join("\n"))
      );
    }
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# NRW:RP I German • ${fraktionen.length} Fraktion${fraktionen.length !== 1 ? "en" : ""} aktiv`)
    );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ── Update persistent list message ────────────────────────────────────────────
async function updateFrakList(guild, guildCfg) {
  const channelId = guildCfg.fraktionListChannelId;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const payload = await buildFrakListPayload(guild.id, guild);

  if (guildCfg.fraktionListMessageId) {
    try {
      const msg = await channel.messages.fetch(guildCfg.fraktionListMessageId);
      await msg.edit(payload);
      return;
    } catch {}
  }
  const msg = await channel.send(payload);
  await updateGuildConfig(guild.id, { fraktionListMessageId: msg.id });
}

// ── /frakcreate ───────────────────────────────────────────────────────────────
const createData = new SlashCommandBuilder()
  .setName("frakcreate")
  .setDescription("Fraktion offiziell machen")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Name der Fraktion").setRequired(true))
  .addUserOption(o => o.setName("leitung").setDescription("ID der Leitung").setRequired(true))
  .addStringOption(o => o.setName("standort").setDescription("Standort der Fraktion").setRequired(true))
  .addStringOption(o => o.setName("discord").setDescription("Discord-Link der Fraktion").setRequired(true))
  .addStringOption(o => o.setName("aufbauschutz").setDescription("Aufbauschutz bis (z.B. Mittwoch, 8. April 2026 22:27)"))
  .addStringOption(o => o.setName("testphase").setDescription("Testphase bis (z.B. Freitag, 10. April 2026 22:27)"));

async function executeCreate(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg = await getGuildConfig(interaction.guild.id);
  if (!canManageFrak(interaction, cfg)) {
    return interaction.editReply({ content: "❌ Keine Berechtigung." });
  }

  const name          = interaction.options.getString("name");
  const leitung       = interaction.options.getUser("leitung");
  const standort      = interaction.options.getString("standort");
  const discord       = interaction.options.getString("discord");
  const aufbauschutz  = interaction.options.getString("aufbauschutz") || null;
  const testphase     = interaction.options.getString("testphase")    || null;

  // Check duplicate
  const existing = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });
  if (existing) return interaction.editReply({ content: `❌ Eine Fraktion namens **${name}** ist bereits aktiv.` });

  const frak = await Fraktion.create({
    guildId:        interaction.guild.id,
    fraktionId:     uuidv4(),
    name,
    leitungId:      leitung.id,
    discordLink:    discord,
    standort,
    aufbauschutzBis: aufbauschutz,
    testphaseBis:    testphase,
    announceChannelId: cfg.fraktionAnnounceChannelId || null,
  });

  // Post announcement using Components V2
  const announceChannelId = cfg.fraktionAnnounceChannelId;
  if (announceChannelId) {
    const ch = interaction.guild.channels.cache.get(announceChannelId);
    if (ch) {
      const container = new ContainerBuilder()
        .setAccentColor(0x57F287)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("# ➕ FRAKTION OFFIZIELL")
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`➕ Die Fraktion **${name}** ist nun offiziell.`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `🏛️ **Fraktion:** ${name}`,
              `👤 **Leitung:** <@${leitung.id}>`,
              aufbauschutz ? `🛡️ **Aufbauschutz bis:** ${aufbauschutz}` : null,
              testphase    ? `🧪 **Testphase bis:** ${testphase}` : null,
              `📍 **Standort:** ${standort}`,
              `🌐 **Discord-Server:** ${discord}`,
            ].filter(Boolean).join("\n")
          )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("Mit freundlichen Grüßen,\n@frakleitung")
        );

      const msg = await ch.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
      frak.announceChannelId = ch.id;
      frak.announceMsgId     = msg.id;
      await frak.save();
    }
  }

  // Update the faction list
  await updateFrakList(interaction.guild, cfg);

  await interaction.editReply({ content: `✅ Fraktion **${name}** wurde offiziell gemacht und in die Liste eingetragen.` });
}

// ── /frakdelete ───────────────────────────────────────────────────────────────
const deleteData = new SlashCommandBuilder()
  .setName("frakdelete")
  .setDescription("Fraktion auflösen")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Name der Fraktion").setRequired(true).setAutocomplete(true))
  .addStringOption(o => o.setName("grund").setDescription("Grund für die Auflösung").setRequired(true));

async function executeDelete(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg   = await getGuildConfig(interaction.guild.id);
  if (!canManageFrak(interaction, cfg)) return interaction.editReply({ content: "❌ Keine Berechtigung." });

  const name  = interaction.options.getString("name");
  const grund = interaction.options.getString("grund");
  const frak  = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });

  if (!frak) return interaction.editReply({ content: `❌ Keine aktive Fraktion namens **${name}** gefunden.` });

  frak.active = false;
  await frak.save();

  // Post dissolution announcement
  const announceChannelId = cfg.fraktionAnnounceChannelId;
  if (announceChannelId) {
    const ch = interaction.guild.channels.cache.get(announceChannelId);
    if (ch) {
      const container = new ContainerBuilder()
        .setAccentColor(0xED4245)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("# ➖ FRAKTION AUFGELÖST")
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`➖ Die Fraktion **${name}** wurde offiziell aufgelöst.`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`≡ **Grund:** ${grund}`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("Mit freundlichen Grüßen,\n@frakleitung")
        );

      await ch.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  }

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ Fraktion **${name}** wurde aufgelöst.` });
}

// ── /fraklist ─────────────────────────────────────────────────────────────────
const listData = new SlashCommandBuilder()
  .setName("fraklist")
  .setDescription("Fraktionsliste posten/aktualisieren")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(o => o.setName("channel").setDescription("Channel (Standard: konfigurierter List-Channel)"));

async function executeList(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg     = await getGuildConfig(interaction.guild.id);
  const channel = interaction.options.getChannel("channel");

  if (channel) {
    await updateGuildConfig(interaction.guild.id, { fraktionListChannelId: channel.id, fraktionListMessageId: null });
    cfg.fraktionListChannelId = channel.id;
    cfg.fraktionListMessageId = null;
  }

  if (!cfg.fraktionListChannelId && !channel) {
    return interaction.editReply({ content: "❌ Kein List-Channel gesetzt. Nutze `/fraklist channel:#kanal`." });
  }

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: "✅ Fraktionsliste wurde aktualisiert." });
}

// ── /frakwarn ─────────────────────────────────────────────────────────────────
const warnData = new SlashCommandBuilder()
  .setName("frakwarn")
  .setDescription("Fraktion verwarnen")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Fraktion").setRequired(true).setAutocomplete(true))
  .addStringOption(o => o.setName("grund").setDescription("Grund der Verwarnung").setRequired(true))
  .addIntegerOption(o => o.setName("warns").setDescription("Neue Gesamtanzahl Warns (leer = +1)").setMinValue(0).setMaxValue(3));

async function executeWarn(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg   = await getGuildConfig(interaction.guild.id);
  if (!canManageFrak(interaction, cfg)) return interaction.editReply({ content: "❌ Keine Berechtigung." });

  const name  = interaction.options.getString("name");
  const grund = interaction.options.getString("grund");
  const frak  = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });

  if (!frak) return interaction.editReply({ content: `❌ Fraktion **${name}** nicht gefunden.` });

  const newWarns = interaction.options.getInteger("warns") ?? Math.min(3, frak.warns + 1);
  frak.warns = newWarns;
  await frak.save();

  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ **${name}** hat jetzt **${newWarns}/3** Verwarnungen.\nGrund: ${grund}` });
}

// ── /frakupdate ───────────────────────────────────────────────────────────────
const updateData = new SlashCommandBuilder()
  .setName("frakupdate")
  .setDescription("Fraktion aktualisieren")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Fraktion").setRequired(true).setAutocomplete(true))
  .addUserOption(o => o.setName("leitung").setDescription("Neue Leitung"))
  .addStringOption(o => o.setName("discord").setDescription("Neuer Discord-Link"))
  .addStringOption(o => o.setName("standort").setDescription("Neuer Standort"))
  .addStringOption(o => o.setName("aufbauschutz").setDescription("Aufbauschutz bis"))
  .addStringOption(o => o.setName("testphase").setDescription("Testphase bis"));

async function executeUpdate(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg  = await getGuildConfig(interaction.guild.id);
  if (!canManageFrak(interaction, cfg)) return interaction.editReply({ content: "❌ Keine Berechtigung." });

  const name = interaction.options.getString("name");
  const frak = await Fraktion.findOne({ guildId: interaction.guild.id, name: new RegExp(`^${name}$`, "i"), active: true });
  if (!frak) return interaction.editReply({ content: `❌ Fraktion **${name}** nicht gefunden.` });

  const leitung      = interaction.options.getUser("leitung");
  const discord      = interaction.options.getString("discord");
  const standort     = interaction.options.getString("standort");
  const aufbauschutz = interaction.options.getString("aufbauschutz");
  const testphase    = interaction.options.getString("testphase");

  if (leitung)      frak.leitungId      = leitung.id;
  if (discord)      frak.discordLink    = discord;
  if (standort)     frak.standort       = standort;
  if (aufbauschutz) frak.aufbauschutzBis = aufbauschutz;
  if (testphase)    frak.testphaseBis   = testphase;

  await frak.save();
  await updateFrakList(interaction.guild, cfg);
  await interaction.editReply({ content: `✅ Fraktion **${name}** wurde aktualisiert.` });
}

// ── Autocomplete ───────────────────────────────────────────────────────────────
async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const fraks   = await Fraktion.find({ guildId: interaction.guild.id, active: true }).limit(25);
  await interaction.respond(
    fraks.filter(f => f.name.toLowerCase().includes(focused)).map(f => ({ name: f.name, value: f.name }))
  );
}

module.exports = {
  data:    createData,
  execute: executeCreate,
  frakdelete: { data: deleteData, execute: executeDelete, autocomplete },
  fraklist:   { data: listData,   execute: executeList },
  frakwarn:   { data: warnData,   execute: executeWarn,   autocomplete },
  frakupdate: { data: updateData, execute: executeUpdate, autocomplete },
};
