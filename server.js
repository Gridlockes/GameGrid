'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const games = require('./data/games');

const app = express();
const PORT = process.env.PORT || 3000;

// --- where the intro sound comes from, and where we cache it locally ---
const INTRO_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/1474/1474-preview.mp3';
const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'intro.mp3');
const USER_AUDIO = path.join(__dirname, 'public', 'audio', 'intro.mp3'); // optional drop-in override

// ---------------------------------------------------------------------------
// API: the game catalog
// ---------------------------------------------------------------------------
app.get('/api/games', (req, res) => {
  res.json(games);
});

app.get('/api/health', (req, res) => res.json({ ok: true, games: games.length }));

// ---------------------------------------------------------------------------
// Audio: serve the intro sound from our own origin.
// First request downloads + caches it; afterwards it streams straight from disk,
// so the boot intro gets the sound instantly with no cross-origin round trip.
// ---------------------------------------------------------------------------
let fetchingAudio = null;

async function ensureIntroAudio() {
  // a user-provided file always wins (lets you swap the sound without code changes)
  if (fileReady(USER_AUDIO)) return USER_AUDIO;
  if (fileReady(CACHE_FILE)) return CACHE_FILE;

  // de-dupe concurrent downloads
  if (!fetchingAudio) {
    fetchingAudio = (async () => {
      await fs.promises.mkdir(CACHE_DIR, { recursive: true });
      const resp = await fetch(INTRO_SOUND_URL);
      if (!resp.ok) throw new Error('upstream audio responded ' + resp.status);
      const buf = Buffer.from(await resp.arrayBuffer());
      await fs.promises.writeFile(CACHE_FILE, buf);
      return CACHE_FILE;
    })().finally(() => { fetchingAudio = null; });
  }
  return fetchingAudio;
}

function fileReady(p) {
  try { return fs.statSync(p).size > 0; } catch { return false; }
}

app.get('/audio/intro.mp3', async (req, res) => {
  let file;
  try {
    file = await ensureIntroAudio();
  } catch (err) {
    console.error('Intro audio unavailable:', err.message);
    return res.status(502).json({ error: 'intro audio unavailable (no network / no cached file)' });
  }
  streamWithRange(req, res, file, 'audio/mpeg');
});

// Standard HTTP range streaming so the <audio> element can buffer/seek cleanly.
function streamWithRange(req, res, filePath, contentType) {
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;

  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (!range) {
    res.setHeader('Content-Length', total);
    return fs.createReadStream(filePath).pipe(res);
  }

  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
  if (isNaN(start) || start < 0) start = 0;
  if (isNaN(end) || end >= total) end = total - 1;
  if (start > end) { start = 0; end = total - 1; }

  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
  res.setHeader('Content-Length', end - start + 1);
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\n  GameGrid running →  http://localhost:${PORT}\n`);
});
