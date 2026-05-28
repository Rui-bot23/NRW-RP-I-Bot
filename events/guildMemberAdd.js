/**
 * guildMemberAdd.js — Components V2 welcome message
 *
 * Components V2 rules:
 * - flags: 32768 MUST be set
 * - No top-level "content" field — everything goes inside components
 * - No embeds alongside components v2
 * - allowedMentions must be set to allow user pings inside text components
 */

const { EmbedBuilder, AllowedMentionsTypes } = require("discord.js");
const { getGuildConfig } = require("../utils/guildConfig");
const { getEmojis } = require("../utils/emojiManager");

const once = false;

async function execute(member, client) {
  try {
    const cfg = await getGuildConfig(member.guild.id);
    if (!cfg.welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(cfg.welcomeChannelId);
    if (!channel) return;

    const emojis    = await getEmojis(member.guild);
    const nickname  = member.displayName || member.user.username;
    const ch        = (id) => id ? `<#${id}>` : "`(nicht gesetzt)`";

    const eTicket   = emojis.ticket   || "🎫";
    const eStaff    = emojis.staff    || "⭐";
    const eMember   = emojis.member   || "👤";
    const eVerified = emojis.verified || "✅";
    const eInfo     = emojis.info     || "ℹ️";

    const mainText = [
      `Schön, dass du da bist **${nickname}**! Bitte lies dir diese Infos aufmerksam durch:`,
      ``,
      `${eVerified} Lies dir unsere ${ch(cfg.welcomeRulesChannel)} durch.`,
      `${eMember} Hole dir eine Rolle in ${ch(cfg.welcomeRolesChannel)} für Pings.`,
      `${eTicket} Bei Fragen öffne ein Ticket in ${ch(cfg.welcomeTicketChannel)}.`,
      `${eStaff} Fraktionen findest du in ${ch(cfg.welcomeFraktionChannel)}.`,
      `${eInfo} Bei Interesse kannst du dich auch im Staff Team bewerben!`,
    ].join("\n");

    const footer = `-# Bitte halte dich an unsere Regeln und viel Spaß im RP!\n-# NRW:RP I German`;

    if (cfg.welcomeBannerUrl) {
      // ── Components V2 ────────────────────────────────────────────────────────
      // Rules:
      //   • flags 32768 = IS_COMPONENTS_V2
      //   • No top-level "content" — user mention goes as a text component BEFORE the container
      //   • allowedMentions needed so the user ping actually notifies them
      await channel.send({
        flags: 32768,
        allowedMentions: { users: [member.id] },
        components: [
          {
            type: 10,          // TextDisplay — user mention/ping
            content: `<@${member.id}>`,
          },
          {
            type: 17,          // Container
            components: [
              {
                type: 12,      // MediaGallery — banner image
                items: [{ media: { url: cfg.welcomeBannerUrl } }],
              },
              {
                type: 10,
                content: `# ${eMember} Willkommen hier auf NRW:RP I German`,
              },
              { type: 14 },    // Separator
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
        ],
      });

    } else {
      // ── Embed fallback (no banner set yet) ───────────────────────────────────
      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(`${eMember} Willkommen hier auf NRW:RP I German`)
        .setDescription(mainText + "\n\n" + footer)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await channel.send({
        content: `<@${member.id}>`,
        embeds: [embed],
        allowedMentions: { users: [member.id] },
      });
    }

  } catch (err) {
    console.error("[WELCOME]", err);
  }
}

module.exports = { once, execute };
