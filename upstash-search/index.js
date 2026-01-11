import { Search } from "@upstash/search";
import { XMLParser } from "fast-xml-parser";
import { config } from "dotenv";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

config();

const client = new Search({
  url: process.env.UPSTASH_SEARCH_REST_URL,
  token: process.env.UPSTASH_SEARCH_REST_TOKEN,
});

const index = client.index("songs");
const parser = new XMLParser();

const MAX_LYRICS_LENGTH = 3500;

function cleanLyrics(lyrics) {
  if (!lyrics) return "";
  const str = String(lyrics);

  // Remove section markers like [V1], [C], [B], etc.
  const cleaned = str
    .replace(/\[V\d+\]/gi, "")
    .replace(/\[C\d*\]/gi, "")
    .replace(/\[B\d*\]/gi, "")
    .replace(/\[P\d*\]/gi, "")
    .replace(/\[T\d*\]/gi, "")
    .replace(/\[E\d*\]/gi, "")
    .replace(/\[I\d*\]/gi, "")
    .replace(/\[\w+\]/g, "")
    .replace(/\|:/g, "")
    .replace(/:\|/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > MAX_LYRICS_LENGTH) {
    return cleaned.slice(0, MAX_LYRICS_LENGTH) + "...";
  }
  return cleaned;
}

async function getAllSongFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllSongFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.name.endsWith(".opensong")) {
      files.push({ path: fullPath, category: dir.split("/").pop() });
    }
  }

  return files;
}

async function parseSongFile(filePath, category) {
  const content = await readFile(filePath, "utf-8");
  const parsed = parser.parse(content);

  if (!parsed.song) return null;

  const song = parsed.song;
  const title = String(song.title || "").trim();
  const lyrics = cleanLyrics(song.lyrics);
  const author = String(song.author || "").trim();
  const churchHubId = song.church_hub_id?.toString();

  if (!churchHubId) return null;

  return {
    id: churchHubId,
    content: {
      title,
      author: author || "",
      lyrics,
    },
    metadata: {
      category,
      church_hub_id: churchHubId,
    },
  };
}

async function pushSongs() {
  console.log("Reading song files...");
  const songsDir = join(import.meta.dirname, "songs_data");
  const songFiles = await getAllSongFiles(songsDir);
  console.log(`Found ${songFiles.length} songs`);

  const batchSize = 100;
  let processed = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < songFiles.length; i += batchSize) {
    const batch = songFiles.slice(i, i + batchSize);
    const songs = [];

    for (const { path, category } of batch) {
      try {
        const song = await parseSongFile(path, category);
        if (song) {
          songs.push(song);
        } else {
          skipped++;
        }
      } catch (err) {
        skipped++;
      }
    }

    if (songs.length > 0) {
      try {
        await index.upsert(songs);
        processed += songs.length;
        console.log(`Pushed ${processed}/${songFiles.length} songs`);
      } catch (err) {
        errors += songs.length;
        console.error(`Error pushing batch: ${err.message}`);

        if (err.message.includes("daily write limit")) {
          console.log("Daily limit reached. Try again tomorrow.");
          break;
        }
      }
    }
  }

  console.log(`\nDone! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
}

pushSongs().catch(console.error);
