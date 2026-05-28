// ─── Fix: Node 18 undici "File is not defined" ──────────────────
const { File } = require('node:buffer');
if (typeof globalThis.File === 'undefined') globalThis.File = File;

const {
  Client, GatewayIntentBits, EmbedBuilder, ActivityType,
  REST, Routes, SlashCommandBuilder, InteractionType
} = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
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
  emitNewSongOnly: true,
  joinNewVoiceChannel: true,
});

// ─── Slash Commands Definition ──────────────────────────────────
const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Play a song or add to queue')
    .addStringOption(o => o.setName('query').setDescription('Song name or YouTube URL').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop music and clear queue'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause the current song'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume the paused song'),
  new SlashCommandBuilder().setName('queue').setDescription('Show the current queue'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Show the currently playing song'),
  new SlashCommandBuilder().setName('loop').setDescription('Toggle loop mode')
    .addStringOption(o => o.setName('mode').setDescription('Loop mode').setRequired(true)
      .addChoices({ name: 'Off', value: '0' }, { name: 'Song', value: '1' }, { name: 'Queue', value: '2' })),
  new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue'),
  new SlashCommandBuilder().setName('volume').setDescription('Set the volume (0-100)')
    .addIntegerOption(o => o.setName('level').setDescription('Volume level 0-100').setRequired(true).setMinValue(0).setMaxValue(100)),
  new SlashCommandBuilder().setName('remove').setDescription('Remove a song from queue')
    .addIntegerOption(o => o.setName('position').setDescription('Song position in queue').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('leave').setDescription('Disconnect the bot from voice channel'),
  new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
].map(c => c.toJSON());

// ─── Register Slash Commands ────────────────────────────────────
async function registerCommands(clientId) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('✅ Slash commands registered!');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

// ─── Ready ──────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity('/play | Music Bot', { type: ActivityType.Listening });
  await registerCommands(client.user.id);
});

// ─── Interaction Handler ─────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guild, channel } = interaction;
  const voiceChannel = member?.voice?.channel;

  // Commands that need voice channel
  const needsVoice = ['play', 'skip', 'stop', 'pause', 'resume', 'loop', 'shuffle', 'volume', 'remove', 'leave'];
  if (needsVoice.includes(commandName) && !voiceChannel) {
    return interaction.reply({ content: '❌ You need to be in a voice channel!', ephemeral: true });
  }

  try {
    switch (commandName) {

      case 'play': {
        const query = interaction.options.getString('query');
        await interaction.deferReply();
        await distube.play(voiceChannel, query, {
          member,
          textChannel: channel,
          interaction,
        });
        break;
      }

      case 'skip': {
        const queue = distube.getQueue(guild);
        if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        await queue.skip();
        interaction.reply('⏭ Skipped!');
        break;
      }

      case 'stop': {
        const queue = distube.getQueue(guild);
        if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        await queue.stop();
        interaction.reply('⏹ Stopped and cleared the queue!');
        break;
      }

      case 'pause': {
        const queue = distube.getQueue(guild);
        if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        if (queue.paused) return interaction.reply({ content: '⏸ Already paused!', ephemeral: true });
        queue.pause();
        interaction.reply('⏸ Paused!');
        break;
      }

      case 'resume': {
        const queue = distube.getQueue(guild);
        if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        if (!queue.paused) return interaction.reply({ content: '▶️ Not paused!', ephemeral: true });
        queue.resume();
        interaction.reply('▶️ Resumed!');
        break;
      }

      case 'queue': {
        const queue = distube.getQueue(guild);
        if (!queue || !queue.songs.length) return interaction.reply({ content: '❌ Queue is empty!', ephemeral: true });
        const list = queue.songs.slice(0, 10).map((s, i) =>
          i === 0 ? `▶️ **${s.name}** [${s.formattedDuration}]` : `\`${i}.\` ${s.name} [${s.formattedDuration}]`
        );
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📋 Music Queue')
          .setDescription(list.join('\n'))
          .setFooter({ text: `${queue.songs.length} song(s) | Loop: ${['Off','Song','Queue'][queue.repeatMode]} | Vol: ${queue.volume}%` });
        if (queue.songs.length > 10) embed.addFields({ name: '...', value: `and ${queue.songs.length - 10} more` });
        interaction.reply({ embeds: [embed] });
        break;
      }

      case 'nowplaying': {
        const queue = distube.getQueue(guild);
        if (!queue || !queue.songs[0]) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        const s = queue.songs[0];
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Now Playing')
          .setDescription(`**[${s.name}](${s.url})**`)
          .addFields(
            { name: '⏱ Duration', value: s.formattedDuration, inline: true },
            { name: '👤 Requested by', value: s.user?.username || 'Unknown', inline: true },
            { name: '🔁 Loop', value: ['Off','Song','Queue'][queue.repeatMode], inline: true }
          ).setThumbnail(s.thumbnail);
        interaction.reply({ embeds: [embed] });
        break;
      }

      case 'loop': {
        const queue = distube.getQueue(guild);
        if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        const mode = parseInt(interaction.options.getString('mode'));
        queue.setRepeatMode(mode);
        const labels = ['Off', 'Song', 'Queue'];
        interaction.reply(`🔁 Loop set to **${labels[mode]}**`);
        break;
      }

      case 'shuffle': {
        const queue = distube.getQueue(guild);
        if (!queue || queue.songs.length < 2) return interaction.reply({ content: '❌ Not enough songs!', ephemeral: true });
        await queue.shuffle();
        interaction.reply('🔀 Queue shuffled!');
        break;
      }

      case 'volume': {
        const queue = distube.getQueue(guild);
        if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        const level = interaction.options.getInteger('level');
        queue.setVolume(level);
        interaction.reply(`🔊 Volume set to **${level}%**`);
        break;
      }

      case 'remove': {
        const queue = distube.getQueue(guild);
        if (!queue || queue.songs.length < 2) return interaction.reply({ content: '❌ Nothing to remove!', ephemeral: true });
        const pos = interaction.options.getInteger('position');
        if (pos >= queue.songs.length) return interaction.reply({ content: '❌ Invalid position!', ephemeral: true });
        const removed = queue.songs[pos];
        queue.songs.splice(pos, 1);
        interaction.reply(`🗑 Removed **${removed.name}**`);
        break;
      }

      case 'leave': {
        const queue = distube.getQueue(guild);
        if (queue) await queue.stop();
        const voiceConn = guild.voiceStates.cache.get(client.user.id);
        if (voiceConn) voiceConn.disconnect();
        interaction.reply('👋 Left the voice channel!');
        break;
      }

      case 'help': {
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Music Bot Commands')
          .addFields(
            { name: '▶️ Playback', value: '`/play` `/pause` `/resume` `/skip` `/stop` `/nowplaying`' },
            { name: '📋 Queue', value: '`/queue` `/shuffle` `/remove` `/loop`' },
            { name: '⚙️ Settings', value: '`/volume` `/leave`' },
            { name: '❓ Other', value: '`/help`' }
          );
        interaction.reply({ embeds: [embed] });
        break;
      }
    }
  } catch (err) {
    console.error('Command error:', err);
    const msg = '❌ An error occurred. Please try again.';
    if (interaction.deferred || interaction.replied) {
      interaction.editReply(msg);
    } else {
      interaction.reply({ content: msg, ephemeral: true });
    }
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
  console.error('DisTube error:', err);
  channel?.send(`❌ Error: ${err.message}`);
});

distube.on('disconnect', (queue) => {
  queue.textChannel?.send('👋 Disconnected from voice channel.');
});

// ─── Login ───────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
