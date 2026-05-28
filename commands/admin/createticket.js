/**
 * /createticket  — Create a ticket category
 * /deleteticket  — Delete a ticket category
 * /listtickets   — List all ticket categories
 * /ticketpanel   — Send the ticket panel to a channel
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");
const { TicketCategory } = require("../../models");
const { getGuildConfig } = require("../../utils/guildConfig");

// ── /createticket ─────────────────────────────────────────────────────────────
const createData = new SlashCommandBuilder()
  .setName("createticket")
  .setDescription("Neue Ticket-Kategorie erstellen (Admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName("name").setDescription("Kategoriename (z.B. Support)").setRequired(true))
  .addStringOption(o => o.setName("emoji").setDescription("Emoji (z.B. 🎫)").setRequired(true))
  .addStringOption(o => o.setName("description").setDescription("Kurzbeschreibung im Dropdown").setRequired(true))
  .addRoleOption(o => o.setName("teampingid").setDescription("Rolle die gepingt wird wenn dieses Ticket geöffnet wird"))
  .addStringOption(o => o.setName("prefix").setDescription("Kanal-Präfix (z.B. support → support-username)"));

async function executeCreate(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId     = interaction.guild.id;
  const name        = interaction.options.getString("name");
  const emoji       = interaction.options.getString("emoji");
  const description = interaction.options.getString("description");
  const teamRole    = interaction.options.getRole("teampingid");
  const prefixRaw   = interaction.options.getString("prefix");
  const prefix      = (prefixRaw || name).toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 20);

  const existing = await TicketCategory.findOne({ guildId, name: new RegExp(`^${name}$`, "i") });
  if (existing) {
    return interaction.editReply({ content: `❌ Eine Kategorie namens **${name}** existiert bereits.` });
  }

  await TicketCategory.create({
    guildId,
    categoryId: uuidv4(),
    name,
    description,
    emoji,
    prefix,
    teamPingId: teamRole?.id || null,
  });

  const total = await TicketCategory.countDocuments({ guildId });

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle("✅  Ticket-Kategorie erstellt")
    .addFields(
      { name: "Name",        value: `${emoji} ${name}`,                            inline: true },
      { name: "Präfix",      value: `\`${prefix}-username\``,                      inline: true },
      { name: "Team-Ping",   value: teamRole ? `${teamRole}` : "*Keiner*",         inline: true },
      { name: "Beschreibung",value: description,                                    inline: false },
      { name: "Kategorien",  value: `Gesamt: **${total}**`,                        inline: true },
    )
    .setFooter({ text: "Benutze /ticketpanel um das Panel zu senden" })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ── /deleteticket ─────────────────────────────────────────────────────────────
const deleteData = new SlashCommandBuilder()
  .setName("deleteticket")
  .setDescription("Ticket-Kategorie löschen (Admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o =>
    o.setName("name").setDescription("Name der Kategorie").setRequired(true).setAutocomplete(true)
  );

async function executeDelete(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const name    = interaction.options.getString("name");
  const deleted = await TicketCategory.findOneAndDelete({
    guildId: interaction.guild.id,
    name: new RegExp(`^${name}$`, "i"),
  });

  if (!deleted) {
    return interaction.editReply({ content: `❌ Keine Kategorie namens **${name}** gefunden.` });
  }

  return interaction.editReply({
    content: `✅ **${deleted.emoji} ${deleted.name}** wurde entfernt.\nBenutze \`/ticketpanel\` um das Panel zu aktualisieren.`,
  });
}

async function autocompleteDelete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const cats = await TicketCategory.find({ guildId: interaction.guild.id }).limit(25);
  await interaction.respond(
    cats.filter(c => c.name.toLowerCase().includes(focused))
       .map(c => ({ name: `${c.emoji} ${c.name}`, value: c.name }))
  );
}

// ── /listtickets ──────────────────────────────────────────────────────────────
const listData = new SlashCommandBuilder()
  .setName("listtickets")
  .setDescription("Alle Ticket-Kategorien anzeigen")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function executeList(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const cats = await TicketCategory.find({ guildId: interaction.guild.id }).sort({ createdAt: 1 });

  if (!cats.length) {
    return interaction.editReply({ content: "Noch keine Kategorien. Benutze `/createticket` um eine zu erstellen." });
  }

  const lines = cats.map((c, i) =>
    `**${i + 1}.** ${c.emoji} **${c.name}**\n> ${c.description}\n> Präfix: \`${c.prefix}\` · Ping: ${c.teamPingId ? `<@&${c.teamPingId}>` : "*Keiner*"}`
  ).join("\n\n");

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🎫  Ticket-Kategorien (${cats.length})`)
    .setDescription(lines)
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ── /ticketpanel ──────────────────────────────────────────────────────────────
const panelData = new SlashCommandBuilder()
  .setName("ticketpanel")
  .setDescription("Ticket-Panel in einen Channel senden")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(o =>
    o.setName("channel").setDescription("Channel (Standard: aktueller Channel)")
      .addChannelTypes(ChannelType.GuildText)
  );

async function executePanel(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId  = interaction.guild.id;
  const target   = interaction.options.getChannel("channel") || interaction.channel;
  const guildCfg = await getGuildConfig(guildId);
  const cats     = await TicketCategory.find({ guildId }).sort({ createdAt: 1 });

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle("🎫  NRW:RP I German — Support")
    .setDescription(
      "Hast du ein Problem oder eine Frage? Erstelle einfach ein Support-Ticket!\n\n" +
      "**Wie funktioniert es?**\n" +
      "• Wähle eine Kategorie aus dem Dropdown unten\n" +
      "• Gib deinen Namen und deinen Grund an\n" +
      "• Unser Support-Team wird sich schnellstmöglich um dich kümmern!\n\n" +
      `**Verfügbare Kategorien:** ${cats.length}`
    )
    .setFooter({ text: "NRW:RP I German" })
    .setTimestamp();

  let components = [];
  if (cats.length > 0) {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("nrw_ticket_category")
        .setPlaceholder("🎫  Wähle eine Ticket-Kategorie...")
        .addOptions(cats.map(c => ({
          label: c.name,
          description: c.description.slice(0, 100),
          value: `nrw_open_${c.categoryId}`,
          emoji: c.emoji,
        })))
    );
    components = [row];
  } else {
    embed.setDescription(embed.data.description + "\n\n> ⚠️ Noch keine Kategorien. Benutze `/createticket`.");
  }

  await target.send({ embeds: [embed], components });
  return interaction.editReply({ content: `✅ Ticket-Panel wurde in ${target} gesendet. (${cats.length} Kategorien)` });
}

module.exports = {
  data:    createData,
  execute: executeCreate,
  deleteTicket: { data: deleteData, execute: executeDelete, autocomplete: autocompleteDelete },
  listTickets:  { data: listData,   execute: executeList },
  ticketPanel:  { data: panelData,  execute: executePanel },
};
