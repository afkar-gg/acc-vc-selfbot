const { Client, Options } = require('discord.js-selfbot-v13');
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");

const config = require(`${process.cwd()}/config.json`);
const tokens = normalizeTokens(config);

if (!tokens.length) {
    console.error("No tokens found. Add `Tokens` array (or `Token`) in config.json.");
    process.exit(1);
}

const clients = [];

for (const [index, token] of tokens.entries()) {
    const client = new Client({
        checkUpdate: false,
        makeCache: Options.cacheWithLimits({
            ...Options.defaultMakeCacheSettings,
            ReactionManager: 0,
            PresenceManager: 0,
            StageInstanceManager: 0,
            ThreadMemberManager: 0,
            MessageManager: 0,
            VoiceStateManager: 0,
            GuildMemberManager: 200,
            UserManager: 200,
        }),
        sweepers: {
            ...Options.defaultSweeperSettings,
            users: { interval: 600, lifetime: 1800 },
            guildMembers: { interval: 600, lifetime: 1800 },
            bans: { interval: 3600, lifetime: 7200 },
            emojis: { interval: 3600, lifetime: 7200 },
            stickers: { interval: 3600, lifetime: 7200 },
            invites: { interval: 3600, lifetime: 7200 },
        },
    });

    client.on('ready', async () => {
        try {
            console.log(`Logged in as ${client.user.tag}! (${index + 1}/${tokens.length})`);
            await joinVC(client, config);
        } catch (err) {
            console.error(`Error in ready handler for ${client.user?.tag || 'unknown'}:`, err);
        }
    });

    client.on('voiceStateUpdate', async (oldState, newState) => {
        try {
            if (newState.member.id !== client.user.id) return;
            if (oldState.channelId === newState.channelId) return;
            await joinVC(client, config);
        } catch (err) {
            console.error(`Error in voiceStateUpdate for ${client.user?.tag || 'unknown'}:`, err);
        }
    });

    client.login(token).catch(err => {
        console.error(`Failed to login token #${index + 1}:`, err);
    });
    clients.push(client);
}

async function joinVC(client, config) {
    let guild = client.guilds.cache.get(config.Guild);
    if (!guild) {
        guild = await client.guilds.fetch(config.Guild).catch(() => null);
    }
    if (!guild) {
        console.error(`Guild not found for ${client.user?.tag || "unknown user"}: ${config.Guild}`);
        return;
    }

    let voiceChannel = guild.channels.cache.get(config.Channel);
    if (!voiceChannel) {
        voiceChannel = await guild.channels.fetch(config.Channel).catch(() => null);
    }
    if (!voiceChannel) {
        console.error(`Channel not found for ${client.user?.tag || "unknown user"}: ${config.Channel}`);
        return;
    }

    try {
        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true,
        });
    } catch (err) {
        console.error(`Failed to join VC for ${client.user?.tag || "unknown user"}:`, err);
    }
}

function normalizeTokens(config) {
    if (Array.isArray(config.Tokens)) {
        return config.Tokens.map((t) => String(t).trim()).filter(Boolean);
    }
    if (typeof config.Tokens === "string") {
        return config.Tokens.split(",").map((t) => t.trim()).filter(Boolean);
    }
    if (typeof config.Token === "string") {
        return [config.Token.trim()].filter(Boolean);
    }
    return [];
}

function cleanup() {
    console.log('\nShutting down gracefully...');
    for (const client of clients) {
        try {
            const connection = getVoiceConnection(config.Guild);
            if (connection) connection.destroy();
        } catch {}
        try {
            client.destroy();
        } catch {}
    }
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
