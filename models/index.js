const { model, Schema } = require("mongoose");

// Stores all per-guild settings configured via slash commands
const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },

  // Welcome
  welcomeChannelId:   { type: String, default: null },  // channel to send welcome message
  welcomeBannerUrl:   { type: String, default: null },  // attachment or image URL for banner
  welcomeRulesChannel:     { type: String, default: null },  // #regeln channel mention
  welcomeRolesChannel:     { type: String, default: null },  // #rollen channel mention
  welcomeTicketChannel:    { type: String, default: null },  // #ticket channel mention
  welcomeFraktionChannel:  { type: String, default: null },  // #fraktionen channel mention

  // Tickets
  ticketLogChannelId:   { type: String, default: null },
  ticketCategoryId:     { type: String, default: null },
  ticketSupportRoleIds: { type: [String], default: [] },
  ticketMaxPerUser:     { type: Number, default: 1 },
  ticketDmTranscript:   { type: Boolean, default: true },
  ticketCloseDelay:     { type: Number, default: 5 },

  // RP — persistent message
  rpMessageId:        { type: String, default: null },  // ID of the message to edit
  rpState:            { type: String, default: 'inactive' }, // 'active' | 'inactive'

  // Custom emojis (uploaded to guild, stored as emojiId map)
  customEmojis: { type: Map, of: String, default: {} },

  // RP Start/Stop
  rpChannelId:        { type: String, default: null },  // channel to post rp start/stop
  rpAllowedRoleId:    { type: String, default: null },  // role allowed to trigger start/stop
  rpPingRoleId:       { type: String, default: null },  // role to ping on start/stop
});

const GuildConfig = model("NRWGuildConfig", guildConfigSchema);

const { model: m2, Schema: S2 } = require("mongoose");

const ticketCategorySchema = new S2({
  guildId:     { type: String, required: true },
  categoryId:  { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  description: { type: String, default: "Öffne ein Support-Ticket" },
  emoji:       { type: String, default: "🎫" },
  prefix:      { type: String, required: true },
  teamPingId:  { type: String, default: null },
  createdAt:   { type: Number, default: () => Date.now() },
});

const ticketSchema = new S2({
  ticketId:    { type: String, required: true, unique: true },
  channelId:   { type: String, required: true },
  guildId:     { type: String, required: true },
  ownerId:     { type: String, required: true },
  ownerTag:    { type: String, required: true },
  category:    { type: String, default: "Support" },
  subject:     { type: String, default: "" },
  description: { type: String, default: "" },
  status:      { type: String, default: "open" },
  claimedBy:   { type: String, default: null },
  priority:    { type: String, default: "Normal" },
  createdAt:   { type: Number, default: () => Date.now() },
  closedAt:    { type: Number, default: null },
});

const TicketCategory = m2("NRWTicketCategory", ticketCategorySchema);
const Ticket         = m2("NRWTicket",         ticketSchema);

module.exports = { GuildConfig, TicketCategory, Ticket };
