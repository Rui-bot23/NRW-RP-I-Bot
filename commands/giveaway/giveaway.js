/**
 * /giveaway start  — Startet ein Giveaway
 * /giveaway end    — Beendet ein Giveaway sofort
 * /giveaway reroll — Neuen Gewinner auswählen
 * /giveaway list   — Aktive Giveaways anzeigen
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { GuildConfig } = require("../../models");

// In-memory giveaway store (also saved to DB)
const activeGiveaways = new Map(); // messageId -> giveaway data

function parseDuration(str) {
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  return parseInt(match[1]) * (map[match[2].toLowerCase()] || 0);
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function pickWinners(participants, count) {
  if (!participants.length) return [];
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, participants.length));
}

function buildGiveawayEmbed(data, ended = false) {
  const { prize, hostedBy, endsAt, winners, participants, winnerCount } = data;
  const timeLeft = endsAt - Date.now();

  const embed = new EmbedBuilder()
    .setColor(ended ? 0x808080 : 0xFEE75C)
    .setTitle(`🎉 GIVEAWAY${ended ? " — BEENDET" : ""}`)
    .addFields(
      { name: "🏆 Preis",       value: prize,                                        inline: false },
      { name: "🎯 Gewinner",    value: `${winnerCount}`,                             inline: true  },
      { name: "👥 Teilnehmer", value: `${participants.length}`,                      inline: true  },
      { name: "👤 Veranstalter", value: `<@${hostedBy}>`,                           inline: true  },
    )
    .setTimestamp();

  if (ended && winners?.length) {
    embed.addFields({ name: "🥇 Gewinner", value: winners.map(id => `<@${id}>`).join(", "), inline: false });
  } else if (!ended) {
    embed.addFields({ name: "⏰ Endet", value: `<t:${Math.floor(endsAt / 1000)}:R>`, inline: true });
    embed.setFooter({ text: "Klicke 🎉 um teilzunehmen!" });
  }

  return embed;
}

const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Giveaway System")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

  .addSubcommand(sub =>
    sub.setName("start")
      .setDescription("Neues Giveaway starten")
      .addStringOption(o => o.setName("preis").setDescription("Was wird verlost?").setRequired(true))
      .addStringOption(o => o.setName("dauer").setDescription("Dauer (z.B. 1h, 30m, 2d)").setRequired(true))
      .addIntegerOption(o => o.setName("gewinner").setDescription("Anzahl Gewinner").setMinValue(1).setMaxValue(20))
      .addChannelOption(o => o.setName("channel").setDescription("Channel (Standard: aktuell)"))
  )
  .addSubcommand(sub =>
    sub.setName("end")
      .setDescription("Giveaway sofort beenden")
      .addStringOption(o => o.setName("message_id").setDescription("Message-ID des Giveaways").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("reroll")
      .setDescription("Neuen Gewinner auswählen")
      .addStringOption(o => o.setName("message_id").setDescription("Message-ID des Giveaways").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("list")
      .setDescription("Aktive Giveaways anzeigen")
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "start")  return await startGiveaway(interaction);
  if (sub === "end")    return await endGiveaway(interaction);
  if (sub === "reroll") return await rerollGiveaway(interaction);
  if (sub === "list")   return await listGiveaways(interaction);
}

async function startGiveaway(interaction) {
  await interaction.deferReply({ flags: 64 });

  const prize      = interaction.options.getString("preis");
  const dauerStr   = interaction.options.getString("dauer");
  const winCount   = interaction.options.getInteger("gewinner") || 1;
  const channel    = interaction.options.getChannel("channel") || interaction.channel;
  const durationMs = parseDuration(dauerStr);

  if (!durationMs) {
    return interaction.editReply({ content: "❌ Ungültige Dauer. Beispiele: `30m`, `1h`, `2d`" });
  }

  const endsAt = Date.now() + durationMs;

  const giveawayData = {
    prize,
    hostedBy:    interaction.user.id,
    guildId:     interaction.guild.id,
    channelId:   channel.id,
    endsAt,
    winnerCount: winCount,
    participants: [],
    winners:     [],
    ended:       false,
  };

  const embed  = buildGiveawayEmbed(giveawayData);
  const row    = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("nrw_giveaway_join")
      .setLabel("Teilnehmen")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎉")
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  giveawayData.messageId = msg.id;
  activeGiveaways.set(msg.id, giveawayData);

  // Auto-end timer
  setTimeout(() => endGiveawayById(msg.id, interaction.guild), durationMs);

  await interaction.editReply({ content: `✅ Giveaway gestartet in ${channel}! Endet <t:${Math.floor(endsAt / 1000)}:R>` });
}

async function endGiveawayById(messageId, guild) {
  const data = activeGiveaways.get(messageId);
  if (!data || data.ended) return;

  data.ended = true;
  const winners = pickWinners(data.participants, data.winnerCount);
  data.winners = winners;

  try {
    const channel = guild.channels.cache.get(data.channelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return;

    const embed = buildGiveawayEmbed(data, true);
    await msg.edit({ embeds: [embed], components: [] });

    if (winners.length) {
      await channel.send({
        content: winners.map(id => `<@${id}>`).join(", "),
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("🎉 Giveaway Gewinner!")
            .setDescription(`Herzlichen Glückwunsch! ${winners.map(id => `<@${id}>`).join(", ")} ${winners.length === 1 ? "hat" : "haben"} **${data.prize}** gewonnen!`)
            .setTimestamp(),
        ],
      });
      // DM winners
      for (const winnerId of winners) {
        try {
          const winnerUser = await guild.members.fetch(winnerId);
          await winnerUser.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🎉 Du hast ein Giveaway gewonnen!")
                .setDescription(`Du hast **${data.prize}** auf **${guild.name}** gewonnen!

Herzlichen Glückwunsch! 🎊`)
                .setTimestamp(),
            ],
          });
        } catch {}
      }
    } else {
      await channel.send({ content: "Leider keine Teilnehmer. Kein Gewinner. 😢" });
    }
  } catch (err) {
    console.error("[GIVEAWAY END]", err.message);
  }
}

async function endGiveaway(interaction) {
  await interaction.deferReply({ flags: 64 });
  const msgId = interaction.options.getString("message_id");
  const data  = activeGiveaways.get(msgId);

  if (!data) return interaction.editReply({ content: "❌ Giveaway nicht gefunden oder bereits beendet." });
  if (data.guildId !== interaction.guild.id) return interaction.editReply({ content: "❌ Nicht auf diesem Server." });

  await endGiveawayById(msgId, interaction.guild);
  await interaction.editReply({ content: "✅ Giveaway wurde beendet." });
}

async function rerollGiveaway(interaction) {
  await interaction.deferReply({ flags: 64 });
  const msgId = interaction.options.getString("message_id");
  const data  = activeGiveaways.get(msgId);

  if (!data || !data.ended) return interaction.editReply({ content: "❌ Giveaway nicht gefunden oder noch nicht beendet." });
  if (!data.participants.length) return interaction.editReply({ content: "❌ Keine Teilnehmer vorhanden." });

  const newWinners = pickWinners(data.participants, data.winnerCount);
  data.winners = newWinners;

  const channel = interaction.guild.channels.cache.get(data.channelId);
  if (channel) {
    await channel.send({
      content: newWinners.map(id => `<@${id}>`).join(", "),
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("🎉 Giveaway Reroll!")
          .setDescription(`Neue Gewinner: ${newWinners.map(id => `<@${id}>`).join(", ")} haben **${data.prize}** gewonnen!`)
          .setTimestamp(),
      ],
    });
  }

  await interaction.editReply({ content: "✅ Neue Gewinner wurden ausgewählt." });
}

async function listGiveaways(interaction) {
  const guildGiveaways = [...activeGiveaways.values()]
    .filter(g => g.guildId === interaction.guild.id && !g.ended);

  if (!guildGiveaways.length) {
    return interaction.reply({ content: "Keine aktiven Giveaways.", flags: 64 });
  }

  const lines = guildGiveaways.map(g =>
    `**${g.prize}** — <#${g.channelId}> — endet <t:${Math.floor(g.endsAt / 1000)}:R> — ${g.participants.length} Teilnehmer`
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`🎉 Aktive Giveaways (${guildGiveaways.length})`)
        .setDescription(lines.join("\n"))
        .setTimestamp(),
    ],
    flags: 64,
  });
}

// Exported for use in interactionCreate button handler
function handleGiveawayJoin(interaction) {
  const msgId = interaction.message.id;
  const data  = activeGiveaways.get(msgId);

  if (!data || data.ended) {
    return interaction.reply({ content: "❌ Dieses Giveaway ist bereits beendet.", flags: 64 });
  }

  if (data.participants.includes(interaction.user.id)) {
    // Toggle off
    data.participants = data.participants.filter(id => id !== interaction.user.id);
    interaction.reply({ content: "❌ Du hast deine Teilnahme zurückgezogen.", flags: 64 });
  } else {
    data.participants.push(interaction.user.id);
    interaction.reply({ content: "✅ Du nimmst jetzt am Giveaway teil! Viel Glück! 🎉", flags: 64 });
  }

  // Update embed participant count
  const embed = buildGiveawayEmbed(data);
  interaction.message.edit({ embeds: [embed] }).catch(() => {});
}

module.exports = { data, execute, handleGiveawayJoin };
