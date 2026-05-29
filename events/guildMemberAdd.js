/**
 * guildMemberAdd.js — Components V2 welcome
 * Mirrors the same structure as rp.js which is confirmed working.
 *
 * Key rules (learned from working RP implementation):
 *  - flags: 32768 (IS_COMPONENTS_V2)
 *  - NO top-level content field
 *  - NO top-level embeds
 *  - Ping goes INSIDE the container as the first text component
 *  - MediaGallery (type 12) for banner
 *  - Separator (type 14) between sections
 *  - allowedMentions at the message level
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
      // ── Components V2 — ping goes INSIDE the container, not top-level ────────
      await channel.send({
        flags: 32768,
        allowedMentions: { users: [member.id] },
        components: [
          {
            type: 17, // Container — the ONLY top-level component
            components: [
              // 1. Ping the user inside the container
              {
                type: 10,
                content: `<@${member.id}>`,
              },
              // 2. Banner image
              {
                type: 12,
                items: [{ media: { url: cfg.welcomeBannerUrl } }],
              },
              // 3. Title
              {
                type: 10,
                content: `# ${eWelcome} Willkommen hier auf NRW:RP I German`,
              },
              { type: 14 },
              // 4. Main content
              {
                type: 10,
                content: mainText,
              },
              { type: 14 },
              // 5. Footer
              {
                type: 10,
                content: footer,
              },
            ],
          },
        ],
      });
    } else {
      // ── Embed fallback (no banner configured) ────────────────────────────────
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
