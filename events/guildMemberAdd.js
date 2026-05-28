/**
 * guildMemberAdd.js
 * Fires when a new member joins — sends Components V2 welcome message.
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

    const emojis   = await getEmojis(member.guild);
    const nickname = member.displayName || member.user.username;
    const ch       = (id) => id ? `<#${id}>` : "`(nicht gesetzt)`";

    const ticketEmoji  = emojis.ticket  || "🎫";
    const staffEmoji   = emojis.staff   || "⭐";
    const memberEmoji  = emojis.member  || "👤";
    const verifiedEmoji = emojis.verified || "✅";
    const infoEmoji    = emojis.info    || "ℹ️";

    const mainText = [
      `Schön, dass du da bist **${nickname}**! Bitte lies dir diese Infos aufmerksam durch, damit du weißt, wie es weitergeht:`,
      ``,
      `${verifiedEmoji} Lies dir unsere ${ch(cfg.welcomeRulesChannel)} durch.`,
      `${memberEmoji} Hole dir dann eine Rolle in ${ch(cfg.welcomeRolesChannel)}, für Pings.`,
      `${ticketEmoji} Bei Fragen kannst du ein Ticket im ${ch(cfg.welcomeTicketChannel)} Channel öffnen.`,
      `${staffEmoji} Fraktionen findest du in unserem ${ch(cfg.welcomeFraktionChannel)} Channel.`,
      `${infoEmoji} Bei Interesse kannst du dich auch gerne im Staff Team bewerben!`,
    ].join("\n");

    const footer = `-# Bitte halte dich an unsere Server Regeln und viel Spaß im RP!\n-# NRW:RP I German`;

    if (cfg.welcomeBannerUrl) {
      // Full Components V2 with banner
      await channel.send({
        flags: 32768,
        components: [
          // User mention above container
          {
            type: 10,
            content: `${member}`,
          },
          {
            type: 17, // Container
            components: [
              {
                type: 12, // MediaGallery
                items: [
                  { media: { url: cfg.welcomeBannerUrl } },
                ],
              },
              {
                type: 10,
                content: `# ${memberEmoji} Willkommen hier auf NRW:RP I German`,
              },
              { type: 14 }, // Separator
              {
                type: 10,
                content: mainText,
              },
              { type: 14 },
              {
                type: 10,
                content: footer,
              },
              { type: 14 },
            ],
          },
        ],
      });
    } else {
      // Embed fallback (no banner set)
      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(`${memberEmoji} Willkommen hier auf NRW:RP I German`)
        .setDescription(mainText + "\n\n" + footer)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await channel.send({ content: `${member}`, embeds: [embed] });
    }
  } catch (err) {
    console.error("[WELCOME]", err.message);
  }
}

module.exports = { once, execute };
