/**
 * /ticket — Staff ticket management
 * close | claim | unclaim | add | remove | rename | priority | list | stats
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType,
} = require("discord.js");
const { Ticket } = require("../../models");
const { getGuildConfig } = require("../../utils/guildConfig");

const PRIORITY_COLORS = {
  Low:      0x57F287,
  Normal:   0x5865F2,
  High:     0xFEE75C,
  Critical: 0xED4245,
};

function isStaff(member, cfg) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some(r => (cfg.ticketSupportRoleIds || []).includes(r.id));
}

const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Tickets verwalten")

  .addSubcommand(sub =>
    sub.setName("close")
      .setDescription("Dieses Ticket schließen")
      .addStringOption(o => o.setName("grund").setDescription("Grund für das Schließen"))
  )
  .addSubcommand(sub => sub.setName("claim").setDescription("Dieses Ticket beanspruchen"))
  .addSubcommand(sub => sub.setName("unclaim").setDescription("Ticket freigeben"))
  .addSubcommand(sub =>
    sub.setName("add")
      .setDescription("Nutzer zum Ticket hinzufügen")
      .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("remove")
      .setDescription("Nutzer aus dem Ticket entfernen")
      .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("rename")
      .setDescription("Ticket-Channel umbenennen")
      .addStringOption(o => o.setName("name").setDescription("Neuer Name").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("priority")
      .setDescription("Ticket-Priorität setzen")
      .addStringOption(o =>
        o.setName("stufe").setDescription("Prioritätsstufe").setRequired(true)
          .addChoices(
            { name: "🟢 Low",      value: "Low"      },
            { name: "🔵 Normal",   value: "Normal"   },
            { name: "🟡 High",     value: "High"     },
            { name: "🔴 Critical", value: "Critical" },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName("list")
      .setDescription("Offene Tickets anzeigen")
      .addUserOption(o => o.setName("nutzer").setDescription("Nach Nutzer filtern"))
  )
  .addSubcommand(sub => sub.setName("stats").setDescription("Ticket-Statistiken anzeigen"));

async function execute(interaction) {
  const cfg = await getGuildConfig(interaction.guild.id);
  const sub = interaction.options.getSubcommand();

  try {
    if (sub === "close")    return await doClose(interaction, cfg);
    if (sub === "claim")    return await doClaim(interaction, cfg, true);
    if (sub === "unclaim")  return await doClaim(interaction, cfg, false);
    if (sub === "add")      return await doAddRemove(interaction, cfg, true);
    if (sub === "remove")   return await doAddRemove(interaction, cfg, false);
    if (sub === "rename")   return await doRename(interaction, cfg);
    if (sub === "priority") return await doPriority(interaction, cfg);
    if (sub === "list")     return await doList(interaction, cfg);
    if (sub === "stats")    return await doStats(interaction, cfg);
  } catch (err) {
    console.error("[TICKET CMD]", err);
    const p = { content: `❌ Fehler: ${err.message}`, ephemeral: true };
    return interaction.replied || interaction.deferred
      ? interaction.editReply(p)
      : interaction.reply(p);
  }
}

// ── Close ─────────────────────────────────────────────────────────────────────
async function doClose(interaction, cfg) {
  const grund  = interaction.options.getString("grund") || "Kein Grund angegeben";
  const ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: "open" });

  if (!ticket) {
    return interaction.reply({ content: "❌ Dieser Channel ist kein offenes Ticket.", ephemeral: true });
  }

  const isOwner = interaction.user.id === ticket.ownerId;
  if (!isOwner && !isStaff(interaction.member, cfg)) {
    return interaction.reply({ content: "❌ Nur der Ticket-Ersteller oder Staff kann dieses Ticket schließen.", ephemeral: true });
  }

  await interaction.deferReply();

  ticket.status   = "closed";
  ticket.closedAt = Date.now();
  await ticket.save();

  const closeEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle("🔒  Ticket geschlossen")
    .setDescription(`Geschlossen von **${interaction.user.tag}**\n**Grund:** ${grund}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [closeEmbed] });

  // Post transcript
  await postTranscript(interaction.channel, ticket, interaction.guild, cfg);

  const delay = (cfg.ticketCloseDelay ?? 5) * 1000;
  setTimeout(() => interaction.channel.delete().catch(() => {}), delay);
}

// ── Claim ─────────────────────────────────────────────────────────────────────
async function doClaim(interaction, cfg, claim) {
  if (!isStaff(interaction.member, cfg)) {
    return interaction.reply({ content: "❌ Nur Staff kann Tickets beanspruchen.", ephemeral: true });
  }

  const ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: "open" });
  if (!ticket) {
    return interaction.reply({ content: "❌ Dieser Channel ist kein offenes Ticket.", ephemeral: true });
  }

  if (claim) {
    if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
      return interaction.reply({ content: `⚠️ Dieses Ticket wurde bereits von <@${ticket.claimedBy}> beansprucht.`, ephemeral: true });
    }
    ticket.claimedBy = interaction.user.id;
    await ticket.save();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✋ ${interaction.user} kümmert sich jetzt um dieses Ticket.`).setTimestamp()],
    });
  } else {
    ticket.claimedBy = null;
    await ticket.save();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`↩️ ${interaction.user} hat das Ticket freigegeben.`).setTimestamp()],
    });
  }
}

// ── Add / Remove ──────────────────────────────────────────────────────────────
async function doAddRemove(interaction, cfg, add) {
  if (!isStaff(interaction.member, cfg)) {
    return interaction.reply({ content: "❌ Nur Staff kann Nutzer hinzufügen/entfernen.", ephemeral: true });
  }

  const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
  if (!ticket) {
    return interaction.reply({ content: "❌ Dieser Channel ist kein Ticket.", ephemeral: true });
  }

  const user   = interaction.options.getUser("nutzer");
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    return interaction.reply({ content: "❌ Nutzer nicht auf dem Server gefunden.", ephemeral: true });
  }

  if (add) {
    await interaction.channel.permissionOverwrites.edit(member, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
    });
    return interaction.reply({ content: `✅ ${user} wurde zum Ticket hinzugefügt.` });
  } else {
    await interaction.channel.permissionOverwrites.delete(member);
    return interaction.reply({ content: `✅ ${user} wurde aus dem Ticket entfernt.` });
  }
}

// ── Rename ────────────────────────────────────────────────────────────────────
async function doRename(interaction, cfg) {
  if (!isStaff(interaction.member, cfg)) {
    return interaction.reply({ content: "❌ Nur Staff kann Tickets umbenennen.", ephemeral: true });
  }

  const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
  if (!ticket) {
    return interaction.reply({ content: "❌ Dieser Channel ist kein Ticket.", ephemeral: true });
  }

  const newName = interaction.options.getString("name")
    .toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 50);

  await interaction.channel.setName(newName);
  return interaction.reply({ content: `✅ Channel umbenannt zu **${newName}**.` });
}

// ── Priority ──────────────────────────────────────────────────────────────────
async function doPriority(interaction, cfg) {
  if (!isStaff(interaction.member, cfg)) {
    return interaction.reply({ content: "❌ Nur Staff kann die Priorität setzen.", ephemeral: true });
  }

  const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
  if (!ticket) {
    return interaction.reply({ content: "❌ Dieser Channel ist kein Ticket.", ephemeral: true });
  }

  const stufe = interaction.options.getString("stufe");
  ticket.priority = stufe;
  await ticket.save();

  const emoji = { Low: "🟢", Normal: "🔵", High: "🟡", Critical: "🔴" }[stufe] || "🔵";

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(PRIORITY_COLORS[stufe] || 0x5865F2)
        .setTitle(`${emoji}  Priorität → ${stufe}`)
        .setDescription(`Die Priorität dieses Tickets wurde auf **${stufe}** gesetzt.`)
        .setTimestamp(),
    ],
  });
}

// ── List ──────────────────────────────────────────────────────────────────────
async function doList(interaction, cfg) {
  if (!isStaff(interaction.member, cfg)) {
    return interaction.reply({ content: "❌ Nur Staff kann Tickets auflisten.", ephemeral: true });
  }

  const nutzer = interaction.options.getUser("nutzer");
  const query  = { guildId: interaction.guild.id, status: "open" };
  if (nutzer) query.ownerId = nutzer.id;

  const tickets = await Ticket.find(query).sort({ createdAt: -1 }).limit(20);

  if (!tickets.length) {
    return interaction.reply({ content: "ℹ️ Keine offenen Tickets gefunden.", ephemeral: true });
  }

  const lines = tickets.map(t => {
    const ch = interaction.guild.channels.cache.get(t.channelId);
    const prioEmoji = { Low: "🟢", Normal: "🔵", High: "🟡", Critical: "🔴" }[t.priority] || "🔵";
    return `${ch ? `<#${t.channelId}>` : `\`${t.ticketId}\``} — **${t.category}** — <@${t.ownerId}> — ${prioEmoji} ${t.priority}`;
  });

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎫  Offene Tickets (${tickets.length})`)
        .setDescription(lines.join("\n"))
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function doStats(interaction, cfg) {
  const guildId = interaction.guild.id;

  const [total, open, closed] = await Promise.all([
    Ticket.countDocuments({ guildId }),
    Ticket.countDocuments({ guildId, status: "open" }),
    Ticket.countDocuments({ guildId, status: "closed" }),
  ]);

  const catBreakdown = await Ticket.aggregate([
    { $match: { guildId } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  const catLines = catBreakdown.map(c => `**${c._id}:** ${c.count}`).join("\n") || "*Keine*";

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📊  Ticket Statistiken")
        .addFields(
          { name: "📋 Gesamt",    value: `${total}`,  inline: true },
          { name: "🟢 Offen",     value: `${open}`,   inline: true },
          { name: "🔴 Geschlossen", value: `${closed}`, inline: true },
          { name: "📂 Top Kategorien", value: catLines, inline: false },
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}

// ── Transcript ────────────────────────────────────────────────────────────────
async function postTranscript(channel, ticket, guild, cfg) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted   = [...messages.values()].reverse();
    const lines    = sorted.map(m =>
      `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || "(embed/attachment)"}`
    ).join("\n");

    if (cfg.ticketLogChannelId) {
      const logCh = guild.channels.cache.get(cfg.ticketLogChannelId);
      if (logCh) {
        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`📋  Transcript — ${ticket.ticketId}`)
          .addFields(
            { name: "Kategorie", value: ticket.category,        inline: true },
            { name: "Ersteller", value: `<@${ticket.ownerId}>`, inline: true },
            { name: "Geschlossen", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          )
          .setTimestamp();

        const att = new AttachmentBuilder(
          Buffer.from(lines, "utf8"),
          { name: `transcript-${ticket.ticketId}.txt` }
        );
        await logCh.send({ embeds: [embed], files: [att] });
      }
    }

    if (cfg.ticketDmTranscript) {
      try {
        const owner = await guild.members.fetch(ticket.ownerId);
        const att2  = new AttachmentBuilder(
          Buffer.from(lines, "utf8"),
          { name: `transcript-${ticket.ticketId}.txt` }
        );
        await owner.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle("Dein Ticket wurde geschlossen")
              .setDescription(`Ticket \`${ticket.ticketId}\` auf **${guild.name}** wurde geschlossen. Transcript im Anhang.`)
              .setTimestamp(),
          ],
          files: [att2],
        });
      } catch {}
    }
  } catch (err) {
    console.error("[TRANSCRIPT]", err.message);
  }
}

module.exports = { data, execute, isStaff, postTranscript };
