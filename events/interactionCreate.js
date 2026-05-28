/**
 * events/interactionCreate.js
 * Routes: slash commands, autocomplete, select menus, modals, buttons
 */

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  AttachmentBuilder,
} = require("discord.js");
const { TicketCategory, Ticket } = require("../models");
const { getGuildConfig, updateGuildConfig } = require("../utils/guildConfig");
const { getEmojis } = require("../utils/emojiManager");
const { isStaff, postTranscript } = require("../commands/admin/ticket");
const { handleGiveawayJoin } = require("../commands/giveaway/giveaway");

const once = false;

async function execute(interaction, client) {

  // ── Autocomplete ────────────────────────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    const cmd = client.commands.get(interaction.commandName);
    if (cmd?.autocomplete) await cmd.autocomplete(interaction).catch(console.error);
    return;
  }

  // ── Slash Commands ──────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(`[CMD ERROR] /${interaction.commandName}:`, err);
      const p = { content: `❌ Fehler: ${err.message}`, flags: 64 };
      interaction.replied || interaction.deferred
        ? await interaction.editReply(p).catch(() => {})
        : await interaction.reply(p).catch(() => {});
    }
    return;
  }

  // ── Select Menu — Ticket Category ───────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === "nrw_ticket_category") {
    const categoryId = interaction.values[0].replace("nrw_open_", "");
    const category   = await TicketCategory.findOne({ categoryId });
    const cfg        = await getGuildConfig(interaction.guild.id);

    if (!category) {
      return interaction.reply({
        content: "❌ Diese Kategorie existiert nicht mehr. Bitte Admin kontaktieren.",
        flags: 64,
      });
    }

    // Max tickets check
    const openCount = await Ticket.countDocuments({
      ownerId: interaction.user.id,
      guildId: interaction.guild.id,
      status:  "open",
    });
    if (openCount >= (cfg.ticketMaxPerUser ?? 1)) {
      return interaction.reply({
        content: `⚠️ Du hast bereits **${openCount}** offene${openCount !== 1 ? " Tickets" : "s Ticket"}. Bitte warte bis es gelöst wurde.`,
        flags: 64,
      });
    }

    // Show modal
    const modal = new ModalBuilder()
      .setCustomId(`nrw_ticket_modal_${categoryId}`)
      .setTitle(`${category.emoji} ${category.name}`);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("ticket_subject")
          .setLabel("Betreff")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Kurze Zusammenfassung deines Anliegens")
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("ticket_description")
          .setLabel("Beschreibung")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Beschreibe dein Anliegen im Detail...")
          .setRequired(true)
          .setMaxLength(1000)
      )
    );

    return interaction.showModal(modal);
  }

  // ── Modal Submit — Ticket Open ──────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith("nrw_ticket_modal_")) {
    await interaction.deferReply({ flags: 64 });

    const categoryId  = interaction.customId.replace("nrw_ticket_modal_", "");
    const category    = await TicketCategory.findOne({ categoryId });
    const cfg         = await getGuildConfig(interaction.guild.id);
    const emojis      = await getEmojis(interaction.guild, cfg);
    const subject     = interaction.fields.getTextInputValue("ticket_subject");
    const description = interaction.fields.getTextInputValue("ticket_description");

    if (!category) {
      return interaction.editReply({ content: "❌ Kategorie nicht mehr vorhanden." });
    }

    const ticketId = `${category.prefix.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // Find or create Discord category
    let discordCat = cfg.ticketCategoryId
      ? interaction.guild.channels.cache.get(cfg.ticketCategoryId)
      : null;

    if (!discordCat) {
      discordCat = await interaction.guild.channels.create({
        name: "🎫 TICKETS",
        type: ChannelType.GuildCategory,
      });
      await updateGuildConfig(interaction.guild.id, { ticketCategoryId: discordCat.id });
    }

    // Permission overwrites
    const overwrites = [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
        ],
      },
    ];

    for (const roleId of (cfg.ticketSupportRoleIds || [])) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        overwrites.push({
          id: role.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.AttachFiles,
          ],
        });
      }
    }

    const channelName = `${category.prefix}-${interaction.user.username}`
      .toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50);

    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: discordCat.id,
      permissionOverwrites: overwrites,
    });

    await Ticket.create({
      ticketId,
      channelId:   channel.id,
      guildId:     interaction.guild.id,
      ownerId:     interaction.user.id,
      ownerTag:    interaction.user.tag,
      category:    category.name,
      subject,
      description,
    });

    // Emojis for intro
    const eTicket  = emojis.ticket  || "🎫";
    const eInfo    = emojis.info    || "ℹ️";
    const eStaff   = emojis.staff   || "⭐";
    const eWarning = emojis.warning || "⚠️";

    // Ticket intro embed
    const introEmbed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle(`${eTicket}  ${category.name} — \`${ticketId}\``)
      .setDescription(
        `Willkommen <@${interaction.user.id}>! Unser Support-Team kümmert sich so schnell wie möglich um dich.\n\n` +
        `${eInfo} **Betreff:** ${subject}\n` +
        `${eInfo} **Beschreibung:** ${description}`
      )
      .addFields({ name: `${eWarning} Priorität`, value: "Normal", inline: true })
      .setFooter({ text: "NRW:RP I German" })
      .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`nrw_ticket_close_${ticketId}`)
        .setLabel("Ticket schließen")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒"),
      new ButtonBuilder()
        .setCustomId(`nrw_ticket_claim_${ticketId}`)
        .setLabel("Übernehmen")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("✋"),
    );

    // Build ping string
    const mentionIds = [interaction.user.id];
    let pingContent  = `<@${interaction.user.id}>`;
    if (category.teamPingId) {
      pingContent += ` <@&${category.teamPingId}>`;
    } else if (cfg.ticketSupportRoleIds?.length) {
      pingContent += ` <@&${cfg.ticketSupportRoleIds[0]}>`;
    }

    await channel.send({
      content: pingContent,
      embeds: [introEmbed],
      components: [actionRow],
      allowedMentions: { users: [interaction.user.id], roles: category.teamPingId ? [category.teamPingId] : cfg.ticketSupportRoleIds?.slice(0, 1) || [] },
    });

    return interaction.editReply({ content: `✅ Dein Ticket wurde erstellt: ${channel}` });
  }

  // ── Button — Giveaway Join ─────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === "nrw_giveaway_join") {
    return handleGiveawayJoin(interaction);
  }

  // ── Button — Close ──────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith("nrw_ticket_close_")) {
    const cfg    = await getGuildConfig(interaction.guild.id);
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: "open" });

    if (!ticket) {
      return interaction.reply({ content: "❌ Kein offenes Ticket in diesem Channel.", flags: 64 });
    }

    const isOwner = interaction.user.id === ticket.ownerId;
    if (!isOwner && !isStaff(interaction.member, cfg)) {
      return interaction.reply({ content: "❌ Nur der Ticket-Ersteller oder Staff kann dieses Ticket schließen.", flags: 64 });
    }

    await interaction.deferReply();

    ticket.status   = "closed";
    ticket.closedAt = Date.now();
    await ticket.save();

    const emojis = await getEmojis(interaction.guild, cfg);
    const eError = emojis.error || "🔴";

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`${eError}  Ticket geschlossen`)
          .setDescription(`Geschlossen von **${interaction.user.tag}**.`)
          .setTimestamp(),
      ],
    });

    await postTranscript(interaction.channel, ticket, interaction.guild, cfg);

    const delay = (cfg.ticketCloseDelay ?? 5) * 1000;
    setTimeout(() => interaction.channel.delete().catch(() => {}), delay);
    return;
  }

  // ── Button — Claim ──────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith("nrw_ticket_claim_")) {
    const cfg = await getGuildConfig(interaction.guild.id);
    if (!isStaff(interaction.member, cfg)) {
      return interaction.reply({ content: "❌ Nur Staff kann Tickets übernehmen.", flags: 64 });
    }

    const ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: "open" });
    if (!ticket) {
      return interaction.reply({ content: "❌ Kein offenes Ticket in diesem Channel.", flags: 64 });
    }

    if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
      return interaction.reply({
        content: `⚠️ Bereits übernommen von <@${ticket.claimedBy}>.`,
        flags: 64,
      });
    }

    ticket.claimedBy = interaction.user.id;
    await ticket.save();

    const emojis = await getEmojis(interaction.guild, cfg);
    const eOk    = emojis.ok || "✅";

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`${eOk} <@${interaction.user.id}> kümmert sich jetzt um dieses Ticket.`)
          .setTimestamp(),
      ],
    });
  }
}

module.exports = { once, execute };
