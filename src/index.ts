import fetch from "node-fetch";
import fetchBase64 from "fetch-base64";

import "dotenv/config";
import { SpotifyAPI } from "@statsfm/spotify.js";
import { Client, Intents, MessageAttachment } from "discord.js";
import { existsSync, readFileSync, writeFileSync } from "fs";

if (!existsSync("database.json")) {
  writeFileSync("database.json", '{"threads":{}}');
}

const client = new Client({
  intents: new Intents(["GUILDS", "GUILD_MESSAGES"]),
  presence: {
    activities: [
      {
        name: "songs being sent in",
        type: "WATCHING",
      },
    ],
  },
  partials: ["MESSAGE", "GUILD_MEMBER", "USER"],
  sweepers: {
    guildMembers: {
      interval: 1800,
      filter: () => (member) => member.id !== member.client.user.id,
    },
    messages: {
      interval: 1800,
      lifetime: 1800,
    },
    users: {
      interval: 1800,
      filter: () => (user) => user.id !== user.client.user.id,
    },
  }
});

const spotifyApi = new SpotifyAPI({
  clientCredentials: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  },
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
});

client.login(process.env.DISCORD_TOKEN);

client.on("ready", () => {
  console.log("Ready!");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (
    (message.channel.type === "GUILD_NEWS" ||
      message.channel.type === "GUILD_TEXT") &&
    message.channelId === process.env.CHALLENGE_CHANNEL
  ) {
    const day = /Day: (?<day>[0-9]+)/gm.exec(message.content)?.groups?.day;
    const name = /Name: (?<name>.*)$/gm.exec(message.content)?.groups?.name;
    const attachment = message?.attachments.first();
    const image = attachment?.proxyURL;

    if (!(
      day &&
      name &&
      image &&
      attachment?.contentType === "image/jpeg" &&
      attachment?.size <= 2560000
    )) {
      await message.author.send(
        'Invalid challenge posted. Please make sure to include 2 lines with "Day: XXX" and "Name: The name of the challenge" and an JPEG image attached (max 256kb)'
      );
      await message.delete();
      return;
    }

    const db = JSON.parse(
      readFileSync("database.json", {
        encoding: "utf8",
      })
    );
    // Disable all old threads that are still active.
    const activeThreads = await message.channel.threads.fetchActive();
    await Promise.all(
      activeThreads.threads.map(async (thread) => {
        await thread.send(
          `This challenge is now closed, check the final playlist here https://open.spotfy.com/playlist/${
            db.threads[thread.id]?.playlistId
          }`
        );
        return thread.edit(
          {
            locked: true,
            archived: true,
          },
          `New challenge was posted by ${message.author.tag} (${message.author.id}), closing this one...`
        );
      })
    );
    // Create new thread
    const thread = await message.startThread({
      autoArchiveDuration: 1440,
      name: "Challenge thread",
      reason: `New challenge was posted by ${message.author.tag} (${message.author.id})`,
    });

    const me = await spotifyApi.me.get();
    const playlist = await spotifyApi.playlist.create(me.id, {
      name: `Day #${day} - ${name}`,
      public: true,
      collaborative: false,
      description: `This is day ${day} of the Daily Song Challenge by Stats.fm (formerly Spotistats for Spotify). To submit an entry head over the #song-challenge channel in the Discord server -> stats.fm/discord :)`,
    });
    db.threads[thread.id] = {
      playlistId: playlist.id,
    };
    writeFileSync("database.json", JSON.stringify(db));

    // Send message to thread
    await thread.send(
      `New song challenge! Please respond with your song here!\n\nToday's playlist: ${playlist.external_urls.spotify}\n\n*Only one song per person*`
    );

    const doFetchRemote = fetchBase64.remote(image);
    doFetchRemote.then(
      async (data) => {
        await fetch(
          `https://api.spotify.com/v1/playlists/${playlist.id}/images`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${spotifyApi.config.acccessToken}`,
              "Content-Type": attachment.contentType,
            },
            body: data[0],
            redirect: "follow",
          }
        );
      },
      (reason) => {
        console.log(`Fetch Failed: ${reason}`);
      }
    );
  } else if (
    message.channel.isThread() &&
    message.channel.parentId === process.env.CHALLENGE_CHANNEL
  ) {
    // Check if this is the first message for the user in the chat, if not delete it.
    const messages = await message.channel.messages.fetch({ limit: 100 });
    const userMessages = messages.filter(
      (msg) => msg.author.id === message.author.id
    );
    if (userMessages.size > 1) {
      await message.delete();
      return;
    }

    const spotifyId = /track\/(?<id>[0-9a-zA-Z]+)(.*)?$/gm.exec(message.content)
      ?.groups?.id;
    if (spotifyId?.length === 22) {
      const db = JSON.parse(readFileSync("database.json").toString());
      const playlistId = db.threads[message.channel.id]?.playlistId;
      if (playlistId?.length === 22) {
        await spotifyApi.playlist.add(playlistId, [spotifyId]);
      }
    }
  }
});
