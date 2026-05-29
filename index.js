// ─── Polyfill ────────────────────────────────────────────────────
const { File } = require('node:buffer');
if (typeof globalThis.File === 'undefined') globalThis.File = File;

const {
  Client, GatewayIntentBits, EmbedBuilder, ActivityType,
  REST, Routes, SlashCommandBuilder
} = require('discord.js');
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType,
  NoSubscriberBehavior, getVoiceConnection
} = require('@discordjs/voice');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { DisTube, RepeatMode } = require('distube');
const ffmpegPath = require('ffmpeg-static');
if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath;
require('dotenv').config();

// ─── Client ─────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ─── DisTube ────────────────────────────────────────────────────
const distube = new DisTube(client, {
  plugins: [new YtDlpPlugin({ update: false })],
  ffmpeg: { path: ffmpegPath },
  joinNewVoiceChannel: true,
  nsfw: false,
});

// ─── Slash Commands ──────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Play a song or add to queue')
    .addStringOption(o => o.setName('query').setDescription('Song name or YouTube URL').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop music and clear queue'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause the current song'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume the paused song'),
  new SlashCommandBuilder().setName('queue').setDescription('Show the current queue'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Show currently playing song'),
  new SlashCommandBuilder().setName('loop').setDescription('Set loop mode')
    .addStringOption(o => o.setName('mode').setDescription('Loop mode').setRequired(true)
      .addChoices(
        { name: 'Off', value: '0' },
        { name: 'Song', value: '1' },
        { name: 'Queue', value: '2' }
      )),
  new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue'),
  new SlashCommandBuilder().setName('volume').setDescription('Set volume (0-100)')
    .addIntegerOption(o => o.setName('level').setDescription('Volume 0-100').setRequired(true).setMinValue(0).setMaxValue(100)),
  new SlashCommandBuilder().setName('remove').setDescription('Remove a song from queue')
    .addIntegerOption(o => o.setName('position').setDescription('Song position (starts at 1)').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('leave').setDescription('Disconnect from voice channel'),
  new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
].map(c => c.toJSON());

// ─── Ready ───────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity('/play | Music Bot', { type: ActivityType.Listening });
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered!');
  } catch (err) {
    console.error('Command register error:', err.message);
  }
});

// ─── Interactions ────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, member, guild, channel } = interaction;
  const voiceChannel = member?.voice?.channel;

  const needsVoice = ['play','skip','stop','pause','resume','loop','shuffle','volume','remove','leave'];
  if (needsVoice.includes(commandName) && !voiceChannel) {
    return interaction.reply({ content: '❌ You need to be in a voice channel first!', ephemeral: true });
  }

  try {
    switch (commandName) {

      case 'play': {
        const query = interaction.options.getString('query');
        await interaction.deferReply();

        // Manually join voice first to ensure connection before distube
        let connection = getVoiceConnection(guild.id);
        if (!connection) {
          connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
          });

          try {
            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
            console.log('✅ Voice connection ready');
          } catch (e) {
            connection.destroy();
            return interaction.editReply('❌ Could not connect to your voice channel. Make sure I have permission to join it!');
          }
        }

        await distube.play(voiceChannel, query, { member, textChannel: channel });
        await interaction.deleteReply().catch(() => {});
        break;
      }

      case 'skip': {
        const q = distube.getQueue(guild.id);
        if (!q) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        await q.skip();
        interaction.reply('⏭ Skipped!');
        break;
      }

      case 'stop': {
        const q = distube.getQueue(guild.id);
        if (!q) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        await q.stop();
        interaction.reply('⏹ Stopped and cleared the queue!');
        break;
      }

      case 'pause': {
        const q = distube.getQueue(guild.id);
        if (!q) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        if (q.paused) return interaction.reply({ content: '⏸ Already paused!', ephemeral: true });
        q.pause();
        interaction.reply('⏸ Paused!');
        break;
      }

      case 'resume': {
        const q = distube.getQueue(guild.id);
        if (!q) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        if (!q.paused) return interaction.reply({ content: '▶️ Not paused!', ephemeral: true });
        q.resume();
        interaction.reply('▶️ Resumed!');
        break;
      }

      case 'queue': {
        const q = distube.getQueue(guild.id);
        if (!q || !q.songs.length) return interaction.reply({ content: '❌ Queue is empty!', ephemeral: true });
        const modeLabel = ['Off','Song','Queue'];
        const list = q.songs.slice(0, 10).map((s, i) =>
          i === 0 ? `▶️ **${s.name}** [${s.formattedDuration}]` : `\`${i}.\` ${s.name} [${s.formattedDuration}]`
        );
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📋 Music Queue')
          .setDescription(list.join('\n'))
          .setFooter({ text: `${q.songs.length} song(s) | Loop: ${modeLabel[q.repeatMode]} | Vol: ${q.volume}%` });
        if (q.songs.length > 10) embed.addFields({ name: '...', value: `and ${q.songs.length - 10} more` });
        interaction.reply({ embeds: [embed] });
        break;
      }

      case 'nowplaying': {
        const q = distube.getQueue(guild.id);
        if (!q || !q.songs[0]) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        const s = q.songs[0];
        const modeLabel = ['Off','Song','Queue'];
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Now Playing')
          .setDescription(`**[${s.name}](${s.url})**`)
          .addFields(
            { name: '⏱ Duration', value: s.formattedDuration, inline: true },
            { name: '👤 Requested by', value: s.user?.username || 'Unknown', inline: true },
            { name: '🔁 Loop', value: modeLabel[q.repeatMode], inline: true }
          ).setThumbnail(s.thumbnail);
        interaction.reply({ embeds: [embed] });
        break;
      }

      case 'loop': {
        const q = distube.getQueue(guild.id);
        if (!q) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        const mode = parseInt(interaction.options.getString('mode'));
        q.setRepeatMode(mode);
        const labels = ['Off','Song','Queue'];
        interaction.reply(`🔁 Loop set to **${labels[mode]}**`);
        break;
      }

      case 'shuffle': {
        const q = distube.getQueue(guild.id);
        if (!q || q.songs.length < 2) return interaction.reply({ content: '❌ Not enough songs!', ephemeral: true });
        await q.shuffle();
        interaction.reply('🔀 Queue shuffled!');
        break;
      }

      case 'volume': {
        const q = distube.getQueue(guild.id);
        if (!q) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        const level = interaction.options.getInteger('level');
        q.setVolume(level);
        interaction.reply(`🔊 Volume set to **${level}%**`);
        break;
      }

      case 'remove': {
        const q = distube.getQueue(guild.id);
        if (!q || q.songs.length < 2) return interaction.reply({ content: '❌ Nothing to remove!', ephemeral: true });
        const pos = interaction.options.getInteger('position');
        if (pos >= q.songs.length) return interaction.reply({ content: '❌ Invalid position!', ephemeral: true });
        const removed = q.songs[pos];
        q.songs.splice(pos, 1);
        interaction.reply(`🗑 Removed **${removed.name}**`);
        break;
      }

      case 'leave': {
        const q = distube.getQueue(guild.id);
        if (q) await q.stop();
        const conn = getVoiceConnection(guild.id);
        if (conn) conn.destroy();
        interaction.reply('👋 Left the voice channel!');
        break;
      }

      case 'help': {
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Music Bot — All Commands')
          .addFields(
            { name: '▶️ Playback', value: '`/play` `/pause` `/resume` `/skip` `/stop` `/nowplaying`' },
            { name: '📋 Queue', value: '`/queue` `/shuffle` `/remove <pos>` `/loop <off/song/queue>`' },
            { name: '⚙️ Settings', value: '`/volume <0-100>` `/leave`' }
          )
          .setFooter({ text: 'Powered by yt-dlp • YouTube & more' });
        interaction.reply({ embeds: [embed] });
        break;
      }
    }
  } catch (err) {
    console.error(`[${commandName}] Error:`, err.message);
    const msg = `❌ ${err.message || 'An error occurred.'}`;
    try {
      if (interaction.deferred || interaction.replied) interaction.editReply(msg).catch(() => {});
      else interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    } catch {}
  }
});

// ─── DisTube Events ──────────────────────────────────────────────
distube.on('playSong', (queue, song) => {
  const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Now Playing')
    .setDescription(`**[${song.name}](${song.url})**`)
    .addFields(
      { name: '⏱ Duration', value: song.formattedDuration, inline: true },
      { name: '👤 Requested by', value: song.user?.username || 'Unknown', inline: true },
      { name: '🔁 Loop', value: ['Off','Song','Queue'][queue.repeatMode], inline: true }
    ).setThumbnail(song.thumbnail)
    .setFooter({ text: `${queue.songs.length} song(s) in queue` });
  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('addSong', (queue, song) => {
  const embed = new EmbedBuilder().setColor('#57F287').setTitle('➕ Added to Queue')
    .setDescription(`**[${song.name}](${song.url})**`)
    .addFields(
      { name: '⏱ Duration', value: song.formattedDuration, inline: true },
      { name: '📋 Position', value: `#${queue.songs.length}`, inline: true }
    ).setThumbnail(song.thumbnail);
  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('finish', (queue) => {
  queue.textChannel?.send('✅ Queue finished! Use `/play` to add more songs.');
});

distube.on('error', (channel, err) => {
  console.error('DisTube error:', err.message);
  channel?.send(`❌ Error: ${err.message}`);
});

distube.on('disconnect', (queue) => {
  queue.textChannel?.send('👋 Disconnected from voice channel.');
});

// ─── Safety Net ──────────────────────────────────────────────────
process.on('unhandledRejection', err => console.error('Unhandled:', err?.message));
process.on('uncaughtException', err => console.error('Uncaught:', err?.message));

// ─── Login ───────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
