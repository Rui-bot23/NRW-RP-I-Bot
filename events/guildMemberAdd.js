/**
 * guildMemberAdd.js — Components V2 welcome (requires discord.js 14.16.0+)
 */

const { EmbedBuilder } = require("discord.js");
const { getGuildConfig } = require("../utils/guildConfig");
const { getEmojis } = require("../utils/emojiManager");

const once = false;

async function execute(member, client) {
  try {
    const cfg = await getGuildConfig(member.guild.id);
    if (!cfg.welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(cfg.welcomeChannelId);
    if (!channel) return;

    // Pass cfg directly so getEmojis skips the extra DB call
    const emojis = await getEmojis(member.guild, cfg);
    const nick   = member.displayName || member.user.username;
    const ch     = (id) => id ? `<#${id}>` : "`(nicht gesetzt)`";

    const eWelcome  = emojis.welcome  || emojis.member  || "👤";
    const eVerified = emojis.verified || "✅";
    const eMember   = emojis.member   || "👤";
    const eTicket   = emojis.ticket   || "🎫";
    const eStaff    = emojis.staff    || "⭐";
    const eInfo     = emojis.info     || "ℹ️";

    const mainText = [
      `Schön, dass du da bist **${nick}**! Bitte lies dir diese Infos aufmerksam durch:`,
      ``,
      `${eVerified} Lies dir unsere ${ch(cfg.welcomeRulesChannel)} durch.`,
      `${eMember} Hole dir eine Rolle in ${ch(cfg.welcomeRolesChannel)} für Pings.`,
      `${eTicket} Bei Fragen öffne ein Ticket in ${ch(cfg.welcomeTicketChannel)}.`,
      `${eStaff} Fraktionen findest du in ${ch(cfg.welcomeFraktionChannel)}.`,
      `${eInfo} Bei Interesse kannst du dich auch im Staff Team bewerben!`,
    ].join("\n");

    const footer = `-# Bitte halte dich an unsere Regeln und viel Spaß im RP!\n-# NRW:RP I German`;

    if (cfg.welcomeBannerUrl) {
      // ── Components V2 (discord.js 14.16.0+ required) ────────────────────────
      await channel.send({
        flags: 32768,                                      // MessageFlags.IsComponentsV2
        allowedMentions: { users: [member.id] },
        components: [
          {
            type: 10,                                      // TextDisplay — ping
            content: `<@${member.id}>`,
          },
          {
            type: 17,                                      // Container
            components: [
              {
                type: 12,                                  // MediaGallery — banner
                items: [{ media: { url: cfg.welcomeBannerUrl } }],
              },
              {
                type: 10,
                content: `# ${eWelcome} Willkommen hier auf NRW:RP I German`,
              },
              { type: 14 },                               // Separator
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
      // ── Embed fallback ───────────────────────────────────────────────────────
      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(`${eWelcome} Willkommen hier auf NRW:RP I German`)
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
