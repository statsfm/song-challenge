import dotenv from 'dotenv';

import { Client, Intents } from 'discord.js';

dotenv.config();

const client = new Client({
  intents: new Intents(['GUILDS', 'GUILD_MESSAGES']),
  presence: {
    activities: [
      {
        name: 'songs being sent in',
        type: 'WATCHING'
      }
    ]
  },
  partials: ['MESSAGE', 'GUILD_MEMBER', 'USER']
});

client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
  console.log('Ready!');
})

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.isText() && (message.channel.type === 'GUILD_NEWS' || message.channel.type === 'GUILD_TEXT') && message.channelId === process.env.CHALLENGE_CHANNEL) {
    // Disable all old threads that are still active.
    const activeThreads = await message.channel.threads.fetchActive();
    await Promise.all(activeThreads.threads.map(thread => thread.edit({
      locked: true,
      archived: true,
    }, `New challenge was posted by ${message.author.tag} (${message.author.id})`)));
    // Create new thread
    const thread = await message.startThread({
      autoArchiveDuration: 1440,
      name: 'Challenge thread',
      reason: `New challenge was posted by ${message.author.tag} (${message.author.id})`
    });
    // Send message to thread
    await thread.send('New song challenge! Please respond with your song here!\n\n *Only one song per person*');
  } else if (message.channel.isThread() && message.channel.parentId === process.env.CHALLENGE_CHANNEL) {
    // Check if this is the first message for the user in the chat, if not delete it.
    const messages = await message.channel.messages.fetch({ limit: 100 });
    const userMessages = messages.filter(msg => msg.author.id === message.author.id);
    if (userMessages.size > 1) {
      await message.delete();
    }
  }
});
