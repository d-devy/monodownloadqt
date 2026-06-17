#!/usr/bin/env bun

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

const DEFAULT_API_INSTANCES = [
    'https://ran412c.valerie.sh'
];

const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'downloads');
const DEFAULT_QUALITY = 'HI_RES_LOSSLESS';
const DEFAULT_DOWNLOAD_RETRIES = 2;
const DEFAULT_FOLDER_TEMPLATE = '{albumTitle} - {albumArtist}';
const DEFAULT_FILENAME_TEMPLATE = '{trackNumber} - {artist} - {title}';
const CACHE_PATH = path.resolve(process.cwd(), '.cache', 'monochrome-playlist-downloader-cache.json');
const AUTH_STORE_PATH = path.resolve(process.cwd(), '.cache', 'monochrome-instance-auth.json');
// Dynamic import Ink TUI if available
let inkUpdater = null;
try {
    const inkModule = await import('./tui.js');
    inkUpdater = inkModule.startTui;
} catch {}

const SETTINGS_PATH = path.resolve(process.cwd(), '.cache', 'monochrome-tui-settings.json');
const DEFAULT_INSTANCE_RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000;
const TIDAL_BROWSER_CLIENT_ID = 'txNoH4kkV41MfH25';
const TIDAL_BROWSER_CLIENT_SECRET = 'dQjy0MinCEvxi1O4UmxvxWnDjt4cgHBPw8ll6nYBk98=';

const DEFAULT_GENRE_PROVIDERS = ['musicbrainz', 'lastfm'];
const DEFAULT_LYRICS_PROVIDER = 'lrclib';

function parseLyricsProvider(value) {
    if (!value) return DEFAULT_LYRICS_PROVIDER;
    const provider = String(value).trim().toLowerCase();
    if (['lrclib', 'genius'].includes(provider)) return provider;
    return DEFAULT_LYRICS_PROVIDER;
}

function parseGenreProviders(value) {
    if (!value) return [...DEFAULT_GENRE_PROVIDERS];
    const providers = String(value).split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    const allowed = ['musicbrainz', 'lastfm', 'discogs'];
    return providers.filter(p => allowed.includes(p));
}

const DISCIN_DISCOGS_TOKEN = process.env.DISCOGS_TOKEN || null;

const JUNK_TAG_PATTERNS = [
    /^seen live$/ui, /^favorites?$/ui, /^favourite$/ui, /^awesome$/ui, /^good$/ui,
    /^my favorite$/ui, /^albums i own$/ui, /^beautiful$/ui, /^love$/ui, /^loved$/ui,
    /^under \d+ listeners$/ui,
];

function isJunkTag(tag) {
    const text = String(tag || '').trim();
    if (!text) return true;
    if (/\d{2,4}s$/ui.test(text)) return true;
    if (/^(english|japanese|german|french|spanish|italian|korean|russian|chinese|portuguese|dutch|swedish|norwegian|polish|instrumental)$/ui.test(text)) return true;
    if (JUNK_TAG_PATTERNS.some(re => re.test(text))) return true;
    return false;
}

function normalizeGenreName(name) {
    if (!name || !String(name).trim()) return null;
    let text = String(name).trim();
    text = text.replace(/\b([A-Z]{2,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
    const TOKEN_MAP = {
        'IDM': 'IDM', 'UK': 'UK', 'US': 'US', 'NYC': 'NYC', 'LA': 'LA', 'SF': 'SF',
        'R&B': 'R&B', 'R & B': 'R&B', 'Trap': 'Trap', 'Lo-Fi': 'Lo-Fi', 'Hi-Fi': 'Hi-Fi',
        'DnB': 'DnB', 'DNB': 'DnB', 'EDM': 'EDM', 'EP': 'EP', 'LP': 'LP', 'VGM': 'VGM',
        'Dream Pop': 'Dream Pop', 'Shoegaze': 'Shoegaze', 'Post-Rock': 'Post-Rock',
        'Post Rock': 'Post-Rock', 'Noise Pop': 'Noise Pop', 'Indie Rock': 'Indie Rock',
        'Neo-Psychedelia': 'Neo-Psychedelia', 'Ambient': 'Ambient', 'Downtempo': 'Downtempo',
        'IDM': 'IDM', 'Glitch': 'Glitch', 'Electronic': 'Electronic', 'Drone': 'Drone',
        'Minimal Techno': 'Minimal Techno', 'Deep House': 'Deep House', 'Techno': 'Techno',
        'House': 'House', 'Drum and Bass': 'Drum and Bass', 'Trip Hop': 'Trip Hop',
        'Chillout': 'Chillout', 'Breaks': 'Breaks', 'Garage': 'Garage', 'Grime': 'Grime',
        'Bass': 'Bass', 'Bassline': 'Bassline', 'Hardstyle': 'Hardstyle', 'Hardcore': 'Hardcore',
        'Trance': 'Trance', 'Progressive House': 'Progressive House', 'Progressive Trance': 'Progressive Trance',
        'Synthwave': 'Synthwave', 'Retrowave': 'Retrowave', 'Outrun': 'Outrun',
        'Dark Ambient': 'Dark Ambient', 'Ethereal': 'Ethereal', 'Wave': 'Wave',
        'Coldwave': 'Coldwave', 'Cold Wave': 'Coldwave', 'No Wave': 'No Wave',
        'Noise': 'Noise', 'Industrial': 'Industrial', 'EBM': 'EBM', 'Electro': 'Electro',
        'Electro Clash': 'Electro Clash', 'Bitpop': 'Bitpop', 'Chiptune': 'Chiptune',
        'Vaporwave': 'Vaporwave', 'Future Funk': 'Future Funk', 'Lo-fi': 'Lo-fi',
        'Hip Hop': 'Hip Hop', 'Rap': 'Rap', 'Soul': 'Soul', 'Funk': 'Funk',
        'Disco': 'Disco', 'Pop': 'Pop', 'Rock': 'Rock', 'Metal': 'Metal', 'Punk': 'Punk',
        'Jazz': 'Jazz', 'Blues': 'Blues', 'Classical': 'Classical', 'Folk': 'Folk',
        'Country': 'Country', 'Reggae': 'Reggae', 'Dub': 'Dub', 'Ska': 'Ska', 'Latin': 'Latin',
        'Afrobeat': 'Afrobeat', 'Krautrock': 'Krautrock', 'Psych': 'Psych', 'Prog': 'Prog',
        'Progressive': 'Progressive', 'Experimental': 'Experimental', 'Avant-Garde': 'Avant-Garde',
        'Modern Classical': 'Modern Classical', 'Contemporary': 'Contemporary', 'New Age': 'New Age',
        'Meditation': 'Meditation',
    };
    const upper = text.toUpperCase();
    if (TOKEN_MAP[upper]) return TOKEN_MAP[upper];
    for (const [key, val] of Object.entries(TOKEN_MAP)) {
        if (upper === key.toUpperCase()) return val;
    }
    if (text.length > 2) {
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    return text;
}

const GENRE_WEIGHTS = {
    discogsStyle: 3,
    discogsGenre: 2,
    lastfmAlbum: 2,
    lastfmArtist: 1,
    rymGenre: 5,
    rymDescriptor: 1,
    musicbrainzGenre: 1,
};

async function fetchAlbumGenresFromMusicBrainz(artistName, albumName, albumMbid) {
    if (!albumMbid) return null;
    try {
        await sleep(1100);
        const inc = 'artists+genres+release-groups+recordings+labels';
        const url = `https://musicbrainz.org/ws/2/release/${albumMbid}?fmt=json&inc=${encodeURIComponent(inc)}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        const genres = [];
        for (const g of (data.genres || [])) {
            const name = normalizeGenreName(g.name);
            if (name && !isJunkTag(name)) genres.push({ name, weight: GENRE_WEIGHTS.musicbrainzGenre });
        }
        const rg = data['release-group'] || {};
        const releaseTypes = {
            primary: rg['primary-type'] || null,
            secondary: rg['secondary-types'] || [],
        };
        const labelInfo = [];
        for (const rel of (data['release-events'] || [])) {
            const area = rel?.area?.name;
            if (area) labelInfo.push(area);
        }
        for (const lbl of (data.label_info || [])) {
            const labelName = lbl?.label?.name;
            if (labelName) labelInfo.push(labelName);
        }
        const uniqueLabels = [...new Set(labelInfo)];
        return {
            genres,
            releaseTypes,
            mbId: data.id || albumMbid,
            rgId: rg.id || null,
            country: data.country || null,
            labels: uniqueLabels,
            barcode: data.barcode || null,
            catalogNumber: data['catno'] || null,
            date: data.date || null,
        };
    } catch {
        return null;
    }
}

async function fetchReleaseGroupFromMusicBrainz(rgId) {
    if (!rgId) return null;
    try {
        await sleep(1100);
        const url = `https://musicbrainz.org/ws/2/release-group/${rgId}?fmt=json&inc=artists+genres`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        const genres = [];
        for (const g of (data.genres || [])) {
            const name = normalizeGenreName(g.name);
            if (name && !isJunkTag(name)) genres.push({ name, weight: GENRE_WEIGHTS.musicbrainzGenre });
        }
        return {
            genres,
            primaryType: data['primary-type'] || null,
            secondaryTypes: data['secondary-types'] || [],
        };
    } catch {
        return null;
    }
}

async function searchMusicBrainzReleaseGroup(artistName, albumName) {
    if (!artistName || !albumName) return null;
    try {
        await sleep(1100);
        const queries = [
            `release:"${albumName}" AND artist:"${artistName}"`,
            `release:"${albumName}" AND artist:"${artistName}" AND status:official`,
            `recording:"${albumName}" AND artist:"${artistName}"`,
        ];
        let rg = null;
        for (const q of queries) {
            const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(q)}&fmt=json&limit=3`;
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = await response.json();
            rg = data['release-groups']?.[0];
            if (rg?.id) break;
        }
        if (!rg?.id) {
            return null;
        }
        const rgData = await fetchReleaseGroupFromMusicBrainz(rg.id);
        if (!rgData) return null;
        const releaseResponse = await fetch(`https://musicbrainz.org/ws/2/release?release-group=${rg.id}&fmt=json&limit=1&inc=artists+genres+release-groups+recordings+labels`);
        if (!releaseResponse.ok) return null;
        const releaseData = await releaseResponse.json();
        const release = releaseData.releases?.[0];
        if (!release) return null;
        const genres = [];
        for (const g of (release.genres || [])) {
            const name = normalizeGenreName(g.name);
            if (name && !isJunkTag(name)) genres.push({ name, weight: GENRE_WEIGHTS.musicbrainzGenre });
        }
        const rgRelease = release['release-group'] || {};
        const releaseTypes = {
            primary: rgRelease['primary-type'] || rgData.primaryType,
            secondary: rgRelease['secondary-types'] || rgData.secondaryTypes,
        };
        const labelInfo = [];
        for (const rel of (release['release-events'] || [])) {
            const area = rel?.area?.name;
            if (area) labelInfo.push(area);
        }
        for (const lbl of (release.label_info || [])) {
            const labelName = lbl?.label?.name;
            if (labelName) labelInfo.push(labelName);
        }
        return {
            genres,
            releaseTypes,
            mbId: release.id || null,
            rgId: rg.id,
            country: release.country || null,
            labels: [...new Set(labelInfo)],
            barcode: release.barcode || null,
            catalogNumber: release.catno || null,
            date: release.date || null,
        };
    } catch {
        return null;
    }
}

function normalizeReleaseType(mbData) {
    if (!mbData) return null;
    const primary = String(mbData.primaryType || '').toLowerCase();
    const typeMap = {
        'album': 'album',
        'single': 'single',
        'ep': 'ep',
        'compilation': 'compilation',
        'live': 'live',
        'soundtrack': 'soundtrack',
        'remix': 'remix',
        'broadcast': 'broadcast',
        'other': 'other',
    };
    return typeMap[primary] || null;
}

async function fetchGenresFromLastFm(artistName, albumName) {
    const key = GENRE_API_CONFIG.lastfm.key;
    
    if (artistName && albumName) {
        const scraped = await scrapeLastFmAlbumTags(artistName, albumName);
        if (scraped.length > 0) {
            return { albumTags: scraped, artistTags: [] };
        }
    }
    
    if (!key) return { albumTags: [], artistTags: [] };
    
    try {
        let tags = [];
        if (artistName && albumName) {
            await waitForRateLimit('lastfm');
            const url = `https://ws.audioscrobbler.com/2.0/?method=album.getTopTags&api_key=${key}&artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(albumName)}&format=json&autocorrect=1`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                tags = (data?.album?.toptags?.tag || []).map(t => String(t.name)).filter(Boolean);
            }
        }
        const albumTags = tags.filter(t => !isJunkTag(t));
        let artistTags = [];
        if (albumTags.length === 0 && artistName) {
            await waitForRateLimit('lastfm');
            const url2 = `https://ws.audioscrobbler.com/2.0/?method=artist.getTopTags&api_key=${key}&artist=${encodeURIComponent(artistName)}&format=json&autocorrect=1`;
            const resp2 = await fetch(url2);
            if (resp2.ok) {
                const data2 = await resp2.json();
                artistTags = (data2?.artist?.toptags?.tag || []).map(t => String(t.name)).filter(t => !isJunkTag(t));
            }
        }
        return { albumTags, artistTags };
    } catch {
        return { albumTags: [], artistTags: [] };
    }
}

async function scrapeLastFmAlbumTags(artistName, albumName) {
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; GenreTagger/1.0)' };
        await sleep(1500);
        const albumUrl = `https://www.last.fm/music/${encodeURIComponent(artistName)}/${encodeURIComponent(albumName)}/+tags`;
        const albumResp = await fetch(albumUrl, { headers });
        if (!albumResp.ok) return [];
        const html = await albumResp.text();
        const tagUrls = html.match(/\/tag\/[a-zA-Z0-9+]+/gi) || [];
        const seen = new Set();
        const tags = [];
        for (const m of tagUrls) {
            const name = decodeURIComponent(m.replace(/^\/tag\//i, '')).replace(/\+/g, ' ');
            if (!name || isJunkTag(name)) continue;
            const key = name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                tags.push(name);
            }
        }
        return tags.slice(0, 20);
    } catch {
        return [];
    }
}

async function fetchGenresFromDiscogs(artistName, albumName) {
    if (!DISCIN_DISCOGS_TOKEN) return null;
    try {
        await sleep(1100);
        const query = encodeURIComponent(`${artistName} ${albumName}`);
        const response = await fetch(`https://api.discogs.com/database/search?q=${query}&type=release&per_page=5`, {
            headers: { 'Authorization': `Discogs token=${DISCIN_DISCOGS_TOKEN}` },
        });
        if (!response.ok) return null;
        const data = await response.json();
        const results = data.results || [];
        if (!results.length) return null;
        const bestMatch = results[0];
        const genres = (bestMatch.genre || []).map(g => normalizeGenreName(g)).filter(Boolean);
        const styles = (bestMatch.style || []).map(s => normalizeGenreName(s)).filter(Boolean);
        if (!genres.length && !styles.length) return null;
        return { genres, styles };
    } catch {
        return null;
    }
}

function aggregateGenres(sources) {
    const scoreMap = new Map();
    for (const source of sources) {
        if (!source) continue;
        for (const item of source) {
            if (!item || !item.name) continue;
            const name = item.name.trim();
            if (!name || isJunkTag(name)) continue;
            const normalized = normalizeGenreName(name);
            if (!normalized) continue;
            const current = scoreMap.get(normalized) || 0;
            scoreMap.set(normalized, current + (item.weight || 1));
        }
    }
    const sorted = [...scoreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(entry => entry[0]);
    return sorted;
}

async function fetchAllGenresAndReleaseType(artistName, albumName, albumMbid, providers, tidalAlbumMetadata) {
    let mbResult = null;
    let releaseTypes = null;
    let lastfmResult = null;
    let discogsResult = null;

    if (providers.includes('musicbrainz')) {
        mbResult = await searchMusicBrainzReleaseGroup(artistName, albumName);
        if (mbResult) {
            releaseTypes = mbResult.releaseTypes;
        }
    }

    if (providers.includes('lastfm')) {
        lastfmResult = await fetchGenresFromLastFm(artistName, albumName);
    }

    if (providers.includes('discogs') && DISCIN_DISCOGS_TOKEN) {
        discogsResult = await fetchGenresFromDiscogs(artistName, albumName);
    }

    const sources = [];
    if (mbResult?.genres?.length) {
        sources.push(mbResult.genres);
    }
    if (lastfmResult?.albumTags?.length) {
        sources.push(lastfmResult.albumTags.map(t => ({ name: t, weight: GENRE_WEIGHTS.lastfmAlbum })));
    }
    if (lastfmResult?.artistTags?.length) {
        sources.push(lastfmResult.artistTags.map(t => ({ name: t, weight: GENRE_WEIGHTS.lastfmArtist })));
    }
    if (discogsResult?.genres?.length) {
        sources.push(discogsResult.genres.map(g => ({ name: g, weight: GENRE_WEIGHTS.discogsGenre })));
    }
    if (discogsResult?.styles?.length) {
        sources.push(discogsResult.styles.map(s => ({ name: s, weight: GENRE_WEIGHTS.discogsStyle })));
    }

    const genres = aggregateGenres(sources);
    const releaseType = releaseTypes ? normalizeReleaseType(releaseTypes) : null;
    const mbId = mbResult?.mbId || albumMbid || null;
    const rgId = mbResult?.rgId || null;
    const country = mbResult?.country || null;
    const labels = mbResult?.labels || [];
    const barcode = mbResult?.barcode || null;
    const catalogNumber = mbResult?.catalogNumber || null;
    const date = mbResult?.date || null;
    const dateSource = mbResult?.date ? 'musicbrainz' : 'tidal';

    return {
        genres,
        releaseType,
        mbId,
        rgId,
        country,
        labels,
        barcode,
        catalogNumber,
        date,
        dateSource,
        tidal: tidalAlbumMetadata || null,
    };
}


async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printHelp();
        return;
    }

    if (!args.input && !args.interactive) {
        printHelp();
        process.exitCode = 1;
        return;
    }

    const input = path.resolve(args.input);
    const sourceValue = (await exists(input)) ? input : args.input;
    const outputRoot = path.resolve(args.output || DEFAULT_OUTPUT_ROOT);
    const apiBase = args['api-url'] || args.apiUrl || process.env.MONOCHROME_API || null;
    const quality = args.quality || DEFAULT_QUALITY;
    const includeLyrics = !args['no-lyrics'];
    const includeGenres = !args['no-genres'];
    const genreProviders = parseGenreProviders(args['genre-providers']);
    const lyricsProvider = parseLyricsProvider(args['lyrics-provider']);
    const lyricsOptions = { syncedOnly: args['lyrics-synced-only'], noArtist: args['lyrics-no-artist'] };
    const includeBpm = !args['no-bpm-detect'];
    const createZip = !args['no-zip'];
    const artistFolders = Boolean(args['artist-folders']);
    const downloadRetries = parseNonNegativeInteger(args['download-retries'], DEFAULT_DOWNLOAD_RETRIES);
    const skipPlaybackPreflight = Boolean(args['i-know-it-doesnt-work-but-ill-use-it-anyway']);
    const cache = await PersistentCache.load(CACHE_PATH);
    const authStore = await InstanceAuthStore.load(AUTH_STORE_PATH);
    const authUsername = args['auth-username'] || process.env.MONOCHROME_AUTH_USERNAME || null;
    const authLoginKey = args['auth-login-key'] || process.env.MONOCHROME_AUTH_LOGIN_KEY || null;
    const authPassword = args['auth-password'] || process.env.MONOCHROME_AUTH_PASSWORD || null;
    const lastfmApiKey = args['lastfm-api-key'] || process.env.LASTFM_API_KEY || null;
    const geniusApiKey = args['genius-api-key'] || process.env.GENIUS_API_KEY || null;
    const albumTypes = args.albumTypes || ['albums', 'eps'];
    let shuttingDown = false;
    let currentRunState = null;
    process.on('SIGINT', () => {
        if (shuttingDown) {
            process.exit(130);
            return;
        }
        shuttingDown = true;
        console.log('\nSIGINT received, flushing cache...');
        Promise.all([
            cache.flush().catch(() => {}),
            authStore.flush().catch(() => {}),
            currentRunState?.flush().catch(() => {}),
        ])
            .catch(() => {})
            .finally(() => process.exit(130));
    });

    // Set API keys from CLI args if provided
    if (lastfmApiKey) {
        GENRE_API_CONFIG.lastfm.key = lastfmApiKey;
        GENRE_API_CONFIG.lastfm.enabled = true;
    }
    if (geniusApiKey) {
        process.env.GENIUS_API_KEY = geniusApiKey;
    }

    const client = new MonochromeClient({
        apiBase,
        apiInstances: DEFAULT_API_INSTANCES,
        quality,
        cache,
        authStore,
        authUsername,
        authLoginKey,
        authPassword,
    });

    console.log(`Cache file: ${CACHE_PATH}`);
    console.log(`Auth store: ${AUTH_STORE_PATH}`);
    console.log(
        `Cache stats: search=${Object.keys(cache.data.searchTrack || {}).length}, metadata=${Object.keys(cache.data.trackMetadata || {}).length}, playlists=${Object.keys(cache.data.playlists || {}).length}, publicPlaylists=${Object.keys(cache.data.publicPlaylists || {}).length}, albums=${Object.keys(cache.data.albums || {}).length}, albumContents=${Object.keys(cache.data.albumContents || {}).length}, albumMergeQueues=${Object.keys(cache.data.albumMergeQueues || {}).length}, artists=${Object.keys(cache.data.artists || {}).length}, covers=${Object.keys(cache.data.covers || {}).length}`
    );

    console.log(`Resolving source: ${sourceValue}`);
    const source = await resolveSource(sourceValue, client, {
        skipPlaybackPreflight,
    });
    if (source.type === 'track' && source.metadata) {
        source.metadata = await hydrateTrackAlbumMetadata(source.metadata, client).catch(() => source.metadata);
    }
    await cache.flush();
    await fs.mkdir(outputRoot, { recursive: true });

    let assemblyRoot;
    let flatAlbumDir = false;
    let albumOnlyFolder = false;

    if (artistFolders && (source.type === 'album' || source.type === 'track')) {
        const artistName = sanitizeForFilename(getAlbumArtist(source.metadata) || 'Various Artists');
        const albumTitle = sanitizeForFilename(
            source.type === 'album' ? source.title : (source.metadata?.album?.title || source.title)
        );
        const artistDir = await resolvePreferredDirectory(outputRoot, artistName);
        assemblyRoot = await resolvePreferredDirectory(artistDir, albumTitle);
        flatAlbumDir = true;
    } else if (artistFolders && source.type === 'artist') {
        const safeSourceName = sanitizeForFilename(source.title);
        assemblyRoot = await resolvePreferredDirectory(outputRoot, safeSourceName);
        albumOnlyFolder = true;
    } else {
        const safeSourceName = sanitizeForFilename(source.title);
        assemblyRoot = await resolvePreferredDirectory(outputRoot, safeSourceName);
    }

    const zipArchivePath = createZip ? path.join(outputRoot, `${path.basename(assemblyRoot)}.zip`) : null;

    console.log(`Source type: ${source.type}`);
    console.log(`Tracks discovered: ${source.tracks.length}`);
    if (source.missing?.length) {
        console.log(`Source items skipped: ${source.missing.length}`);
    }

    if (!source.metadata?.preflightCompleted) {
        if (skipPlaybackPreflight) {
            console.log('Playback preflight bypassed by user flag.');
        } else {
            await runPlaybackPreflight(source, client);
        }
    }

    const recoveredState = await recoverDownloadedState(assemblyRoot, source);
    const downloaded = [...recoveredState.downloaded];
    const failures = [...recoveredState.failures];
    const albumCoverWrites = new Set();
    currentRunState = new RunState(assemblyRoot, source, downloaded, failures);
    await currentRunState.flush();

    if (recoveredState.downloadedIds.size > 0) {
        console.log(
            `Run state: skipped ${recoveredState.downloadedIds.size} track(s) from downloadedIds, rehydrated ${recoveredState.downloaded.length} track(s) with file paths.`
        );
    }

    let queue = source.tracks
        .filter((track) => !recoveredState.downloadedIds.has(normalizeId(track?.id)))
        .map((track) => ({ track, retryCount: 0 }));
    const pendingTrackCount = queue.length;
    if (createZip && zipArchivePath) {
        console.log(`ZIP archive: ${zipArchivePath}`);
    }

    while (queue.length > 0) {
        const nextQueue = [];

        if (queue[0]?.retryCount > 0) {
            console.log(`Retry pass ${queue[0].retryCount}/${downloadRetries}: ${queue.length} track(s) requeued`);
        }

        for (let index = 0; index < queue.length; index += 1) {
            const { track, retryCount } = queue[index];
            const displayTitle = `${getTrackArtists(track)} - ${getTrackTitle(track)}`;
            const trackLabel =
                retryCount > 0
                    ? `[retry ${retryCount}/${downloadRetries}] ${displayTitle}`
                    : `[${index + 1}/${pendingTrackCount} remaining | ${recoveredState.downloadedIds.size + index + 1}/${source.tracks.length} total] ${displayTitle}`;
            console.log(trackLabel);

            try {
                const downloadedTrack = await downloadTrack({
                    track,
                    assemblyRoot,
                    client,
                    includeLyrics,
                    lyricsProvider,
                    lyricsOptions,
                    includeGenres,
                    genreProviders,
                    includeBpm,
                    albumCoverWrites,
                    flatAlbumDir,
                    albumOnlyFolder,
                    zipArchivePath,
                });
                removeFailureByTrackId(failures, downloadedTrack.id);
                downloaded.push(downloadedTrack);
                console.log(`  -> completed ${downloaded.length}/${source.tracks.length}: ${downloadedTrack.filePath}`);
                if (zipArchivePath) {
                    console.log(`  -> archive updated: ${zipArchivePath}`);
                }
                await currentRunState.flush();
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);

                if (retryCount < downloadRetries && isRetryableDownloadError(message)) {
                    console.warn(`  Retry queued (${retryCount + 1}/${downloadRetries}): ${message}`);
                    nextQueue.push({
                        track,
                        retryCount: retryCount + 1,
                    });
                } else {
                    upsertFailure(failures, {
                        id: track.id,
                        title: getTrackTitle(track),
                        artist: getTrackArtists(track),
                        error: message,
                    });
                    console.warn(`  Failed: ${message}`);
                }

                await currentRunState.flush();
            }
        }

        queue = nextQueue;
    }

    await writeCollectionArtifacts(assemblyRoot, source, downloaded, failures);
    await cache.flush();
    await currentRunState.flush();

    console.log(`Completed: ${downloaded.length} succeeded, ${failures.length} failed.`);
    if (failures.length) {
        process.exitCode = 2;
    } else {
        process.exitCode = 0;
    }
}

function installPrettyLogging() {
    const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
    const rawArgv = process.argv.slice(2);
    const helpRequested = rawArgv.includes('--help') || rawArgv.includes('-h') || rawArgv.includes('help');
    const forcePlain = rawArgv.includes('--plain') || rawArgv.includes('--no-ui');
    const verbose = rawArgv.includes('--verbose');
    const interactive = rawArgv.includes('--interactive') || rawArgv.includes('-i') || (!rawArgv.some(a => !a.startsWith('--')));
    const useDashboard = Boolean(process.stdout.isTTY) && !helpRequested && !forcePlain && !verbose && !interactive;
    const original = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
    };
    const dashboard = useDashboard ? new TtyDashboard({ useColor, output: process.stdout }) : null;
    globalThis.__MONOCHROME_DASHBOARD__ = dashboard;

    const paint = (text, ...styles) => {
        if (!useColor) {
            return text;
        }
        return `${styles.join('')}${text}${ANSI.reset}`;
    };

    const shortenUrl = (value) => {
        try {
            const url = new URL(String(value));
            return `${url.host}${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ''}`;
        } catch {
            return String(value);
        }
    };

    const formatLine = (line) => {
        if (typeof line !== 'string' || !line.trim()) {
            return line;
        }

        const requestMatch = line.match(/^\[request:(api|tidal)\]\s+(.*)$/u);
        if (requestMatch) {
            const [, kind, detail] = requestMatch;
            const label = paint(kind.toUpperCase().padEnd(5), ANSI.bold, kind === 'tidal' ? ANSI.magenta : ANSI.blue);

            if (/^ok$/iu.test(detail.trim())) {
                return `${label} ${paint('ok', ANSI.green)}`;
            }

            if (/^\d{3}\s/u.test(detail.trim())) {
                const color = detail.startsWith('2') ? ANSI.green : detail.startsWith('4') ? ANSI.yellow : ANSI.red;
                return `${label} ${paint(detail.trim(), color)}`;
            }

            return `${label} ${paint(shortenUrl(detail.trim()), ANSI.gray)}`;
        }

        if (/^\[\d+\/\d+(?:[^\]]*)\]/u.test(line)) {
            return paint(line, ANSI.bold, ANSI.cyan);
        }

        if (/^\[resolve \d+\/\d+\]/u.test(line)) {
            return paint(line, ANSI.bold, ANSI.blue);
        }

        if (line.startsWith('  -> ')) {
            const body = line.slice(5);
            if (/rejected|preview|failed|unavailable|skipping/iu.test(body)) {
                return `  ${paint('->', ANSI.yellow)} ${paint(body, ANSI.yellow)}`;
            }
            if (/matched|accepted|resolved|source|selection|duration|cache hit|cover fetch|cover cache hit/iu.test(body)) {
                return `  ${paint('->', ANSI.cyan)} ${body}`;
            }
            return `  ${paint('->', ANSI.gray)} ${paint(body, ANSI.dim)}`;
        }

        if (/^Failed:/iu.test(line.trim()) || /^  Failed:/iu.test(line)) {
            return paint(line, ANSI.red);
        }

        if (/^Completed:/iu.test(line.trim())) {
            return paint(line, ANSI.bold, ANSI.green);
        }

        if (/^Cache file:|^Cache stats:|^Resolving source:|^Source type:|^Tracks discovered:|^Source items skipped:|^ZIP archive:/iu.test(line.trim())) {
            return paint(line, ANSI.dim);
        }

        return line;
    };

    const wrap = (method) => (...args) => {
        if (dashboard && args.length === 1 && typeof args[0] === 'string') {
            dashboard.handleLine(method, args[0]);
            return;
        }

        if (args.length === 1 && typeof args[0] === 'string') {
            original[method](formatLine(args[0]));
            return;
        }

        if (args.length > 1 && typeof args[0] === 'string') {
            original[method](formatLine(args[0]), ...args.slice(1));
            return;
        }

        original[method](...args);
    };

    console.log = wrap('log');
    console.warn = wrap('warn');
    console.error = wrap('error');
}

class TtyDashboard {
    constructor({ useColor, output }) {
        this.useColor = useColor;
        this.output = output;
        this.events = [];
        this.failures = [];
        this.cooldowns = [];
        this.cooldownTimer = null;
        this.active = false;
        this.suspended = false;
        this.state = {
            cacheFile: null,
            cacheStats: null,
            resolvingSource: null,
            sourceType: null,
            sourceTitle: null,
            tracksDiscovered: null,
            sourceItemsSkipped: 0,
            expansion: null,
            expansionQueued: null,
            currentTrack: null,
            playbackPreflight: null,
            currentPhase: 'Starting',
            downloaded: 0,
            skipped: 0,
            failed: 0,
            zipArchive: null,
            completed: null,
            fatalError: null,
        };
        if (this.output.isTTY) {
            this.active = true;
            this.output.write('\x1b[?1049h');
            this.output.write('\x1b[2J\x1b[H');
            this.output.write('\x1b[?25l');
            this.cooldownTimer = setInterval(() => {
                if (this.active) {
                    this.render();
                }
            }, 1000);
            this.cooldownTimer.unref?.();
        }
        process.on('exit', () => {
            this.stop(false);
        });
        this.render();
    }

    start() {
        if (this.active || !this.output.isTTY) {
            return;
        }
        this.active = true;
        this.output.write('\x1b[?1049h');
        this.output.write('\x1b[2J\x1b[H');
        this.output.write('\x1b[?25l');
        this.cooldownTimer = setInterval(() => {
            if (this.active) {
                this.render();
            }
        }, 1000);
        this.cooldownTimer.unref?.();
        this.render();
    }

    paint(text, ...styles) {
        if (!this.useColor) {
            return text;
        }
        return `${styles.join('')}${text}${ANSI.reset}`;
    }

    handleLine(method, line) {
        const trimmed = String(line || '').trim();
        if (!trimmed) {
            return;
        }

        this.parseLine(method, trimmed);
        this.render();
    }

    parseLine(method, line) {
        if (line.startsWith('[request:')) {
            return;
        }

        if (line.startsWith('Cache file:')) {
            this.state.cacheFile = line.replace(/^Cache file:\s*/u, '');
            return;
        }

        if (line.startsWith('Cache stats:')) {
            this.state.cacheStats = line.replace(/^Cache stats:\s*/u, '');
            return;
        }

        if (line.startsWith('Resolving source:')) {
            this.state.resolvingSource = line.replace(/^Resolving source:\s*/u, '');
            this.state.sourceTitle = this.state.resolvingSource;
            this.state.currentPhase = 'Resolving source';
            return;
        }

        if (line.startsWith('Source type:')) {
            this.state.sourceType = line.replace(/^Source type:\s*/u, '');
            return;
        }

        if (line.startsWith('Tracks discovered:')) {
            this.state.tracksDiscovered = Number(line.replace(/^Tracks discovered:\s*/u, '')) || 0;
            return;
        }

        if (line.startsWith('Source items skipped:')) {
            this.state.sourceItemsSkipped = Number(line.replace(/^Source items skipped:\s*/u, '')) || 0;
            return;
        }

        if (line.startsWith('JSON tracks to expand:')) {
            this.state.currentPhase = 'Expanding albums';
            this.state.expansion = {
                current: 0,
                total: Number(line.replace(/^JSON tracks to expand:\s*/u, '')) || 0,
                currentLabel: null,
            };
            return;
        }

        const expandMatch = line.match(/^\[expand (\d+)\/(\d+)\]\s+(.*)$/u);
        if (expandMatch) {
            this.state.currentPhase = 'Expanding albums';
            this.state.expansion = {
                current: Number(expandMatch[1]),
                total: Number(expandMatch[2]),
                currentLabel: expandMatch[3],
            };
            return;
        }

        const queuedMatch = line.match(/^->\s+album expanded:\s+.*\s+total=(\d+)\s+queued=(\d+)$/u);
        if (queuedMatch) {
            this.state.expansionQueued = (this.state.expansionQueued || 0) + Number(queuedMatch[2] || 0);
            return;
        }

        if (line.startsWith('Playback preflight:')) {
            this.state.currentPhase = 'Playback preflight';
            this.state.playbackPreflight = {
                summary: line,
                currentTrack: null,
                passed: 0,
                failed: 0,
            };
            return;
        }

        if (line.startsWith('-> preflight track:')) {
            this.state.currentPhase = 'Playback preflight';
            this.state.playbackPreflight = this.state.playbackPreflight || {};
            this.state.playbackPreflight.currentTrack = line.replace(/^->\s+preflight track:\s*/u, '');
            return;
        }

        if (line.startsWith('-> preflight passed')) {
            this.state.playbackPreflight = this.state.playbackPreflight || {};
            this.state.playbackPreflight.passed = (this.state.playbackPreflight.passed || 0) + 1;
            this.pushEvent('Preflight passed');
            return;
        }

        if (line.startsWith('-> preflight failed:')) {
            this.state.playbackPreflight = this.state.playbackPreflight || {};
            this.state.playbackPreflight.failed = (this.state.playbackPreflight.failed || 0) + 1;
            this.pushFailure(line.replace(/^->\s+preflight failed:\s*/u, ''));
            return;
        }

        const trackMatch = line.match(/^\[(\d+)\/(\d+)(?:[^\]]*)\]\s+(.*)$/u);
        if (trackMatch) {
            this.state.currentPhase = 'Downloading';
            this.state.currentTrack = {
                index: Number(trackMatch[1]),
                total: Number(trackMatch[2]),
                label: trackMatch[3],
            };
            this.state.downloaded = Math.max(
                this.state.downloaded,
                Math.max(0, Number(trackMatch[1]) - 1 - this.state.skipped - this.state.failed)
            );
            return;
        }

        if (line.startsWith('-> file exists, skipping download:')) {
            this.state.skipped += 1;
            this.pushEvent(line.replace(/^->\s+/u, ''));
            return;
        }

        if (line.startsWith('Failed:') || line.startsWith('Failed:'.padStart(10))) {
            this.state.failed += 1;
            this.pushFailure(line.replace(/^Failed:\s*/u, '').replace(/^\s*Failed:\s*/u, ''));
            return;
        }

        if (line.startsWith('Saved ') || line.includes('because the upstream stream was not FLAC')) {
            this.pushEvent(line);
            return;
        }

        if (line.includes('[') && line.includes('%') && line.includes('@')) {
            this.pushEvent(line.replace(/^-?\s+/u, ''));
            return;
        }

        if (line.startsWith('-> downloaded')) {
            this.pushEvent(line.replace(/^->/u, '').trim());
            return;
        }

        if (line.startsWith('ZIP archive:')) {
            this.state.zipArchive = line.replace(/^ZIP archive:\s*/u, '');
            return;
        }

        if (line.startsWith('Completed:')) {
            this.state.completed = line;
            this.state.currentPhase = 'Completed';
            return;
        }

        if (this.parseCooldownLine(line)) {
            return;
        }

        if (method === 'warn' || method === 'error') {
            this.state.fatalError = line;
            this.pushFailure(line);
            return;
        }

        this.pushEvent(line);
    }

    pushEvent(line) {
        this.events.unshift(line.replace(/^->\s+/u, ''));
        this.events = this.events.slice(0, 5);
    }

    pushFailure(line) {
        this.failures.unshift(line);
        this.failures = this.failures.slice(0, 5);
    }

    parseCooldownLine(line) {
        const setMatch = line.match(/^->\s+endpoint cooldown set:\s+base=(.+?)\s+endpoint=(.+?)\s+ttl=(\d+)s$/u);
        if (setMatch) {
            const [, base, endpoint, seconds] = setMatch;
            this.setCooldown(base, endpoint, Number(seconds) * 1000);
            return true;
        }

        const waitMatch = line.match(/^->\s+endpoint cooldown wait:\s+base=(.+?)\s+endpoint=(.+?)\s+remaining=(\d+)s$/u);
        if (waitMatch) {
            const [, base, endpoint, seconds] = waitMatch;
            this.setCooldown(base, endpoint, Number(seconds) * 1000);
            return true;
        }

        const clearMatch = line.match(/^->\s+endpoint cooldown cleared:\s+base=(.+?)\s+endpoint=(.+)$/u);
        if (clearMatch) {
            const [, base, endpoint] = clearMatch;
            this.cooldowns = this.cooldowns.filter((entry) => entry.base !== base || entry.endpoint !== endpoint);
            return true;
        }

        return false;
    }

    setCooldown(base, endpoint, durationMs) {
        const now = Date.now();
        const until = now + Math.max(1000, Number(durationMs) || 0);
        const key = `${base}::${endpoint}`;
        const existing = this.cooldowns.find((entry) => entry.key === key);

        if (existing) {
            existing.until = Math.max(existing.until, until);
        } else {
            this.cooldowns.unshift({ key, base, endpoint, until });
        }

        this.cooldowns = this.cooldowns
            .filter((entry) => entry.until > now)
            .sort((left, right) => left.until - right.until)
            .slice(0, 4);
    }

    render() {
        if (!this.active || !this.output.isTTY) {
            return;
        }

        const lines = [];
        lines.push(this.paint('Monochrome Downloader', ANSI.bold, ANSI.cyan));
        lines.push(`Phase: ${this.state.currentPhase}`);
        if (this.state.sourceType || this.state.tracksDiscovered != null) {
            lines.push(
                `Source: ${this.state.sourceType || 'unknown'}${this.state.tracksDiscovered != null ? ` | Tracks: ${this.state.tracksDiscovered}` : ''}${this.state.sourceItemsSkipped ? ` | Skipped source items: ${this.state.sourceItemsSkipped}` : ''}`
            );
        }

        if (this.state.expansion) {
            lines.push(
                `Expansion: ${this.state.expansion.current}/${this.state.expansion.total}${this.state.expansionQueued != null ? ` | Queued: ${this.state.expansionQueued}` : ''}`
            );
            if (this.state.expansion.currentLabel) {
                lines.push(`Album seed: ${truncate(this.state.expansion.currentLabel, 100)}`);
            }
        }

        if (this.state.playbackPreflight) {
            lines.push(
                `Preflight: passed=${this.state.playbackPreflight.passed || 0} failed=${this.state.playbackPreflight.failed || 0}`
            );
            if (this.state.playbackPreflight.currentTrack) {
                lines.push(`Preflight track: ${truncate(this.state.playbackPreflight.currentTrack, 100)}`);
            }
        }

        if (this.state.currentTrack) {
            lines.push(`Track: ${this.state.currentTrack.index}/${this.state.currentTrack.total}`);
            lines.push(`Now: ${truncate(this.state.currentTrack.label, 100)}`);
        }

        lines.push(
            `Progress: downloaded=${this.state.downloaded} skipped=${this.state.skipped} failed=${this.state.failed}`
        );

        const activeCooldowns = this.cooldowns
            .filter((entry) => entry.until > Date.now())
            .sort((left, right) => left.until - right.until)
            .slice(0, 4);
        this.cooldowns = activeCooldowns;

        if (activeCooldowns.length) {
            lines.push(this.paint('Cooldowns', ANSI.bold, ANSI.yellow));
            lines.push(
                ...activeCooldowns.map((entry) =>
                    `- ${truncate(`${entry.endpoint} on ${entry.base} (${formatRemainingSeconds(entry.until)}s)`, 110)}`
                )
            );
        }

        if (this.failures.length) {
            lines.push(this.paint('Recent Failures', ANSI.bold, ANSI.red));
            lines.push(...this.failures.map((line) => `- ${truncate(line, 110)}`));
        }

        if (this.events.length) {
            lines.push(this.paint('Recent Events', ANSI.bold, ANSI.gray));
            lines.push(...this.events.map((line) => `- ${truncate(line, 110)}`));
        }

        if (this.state.cacheStats) {
            lines.push(this.paint('Cache', ANSI.bold, ANSI.blue));
            lines.push(truncate(this.state.cacheStats, 110));
        }

        const body = lines.join('\n');
        this.output.write('\x1b[2J\x1b[H');
        this.output.write(`${body}\n`);
    }

    stop(keepCursorHidden = false) {
        if (!this.active || !this.output.isTTY) {
            return;
        }
        this.active = false;
        if (this.cooldownTimer) {
            clearInterval(this.cooldownTimer);
            this.cooldownTimer = null;
        }
        if (!keepCursorHidden) {
            this.output.write('\x1b[?25h');
        }
        this.output.write('\x1b[?1049l');
    }

    suspendForPrompt() {
        if (!this.output.isTTY) {
            return;
        }
        this.suspended = true;
        this.stop(false);
    }

    resumeAfterPrompt() {
        if (!this.output.isTTY || !this.suspended) {
            return;
        }
        this.suspended = false;
        this.start();
    }

    printFinalSummary() {
        this.stop(false);
        const lines = [];
        lines.push(this.paint('Monochrome Downloader Summary', ANSI.bold, ANSI.cyan));
        if (this.state.sourceType || this.state.sourceTitle) {
            lines.push(
                `Source: ${this.state.sourceType || 'unknown'}${this.state.sourceTitle ? ` | ${this.state.sourceTitle}` : ''}`
            );
        }
        if (this.state.tracksDiscovered != null) {
            lines.push(`Tracks discovered: ${this.state.tracksDiscovered}`);
        }
        lines.push(`Downloaded: ${this.state.downloaded}`);
        lines.push(`Skipped existing: ${this.state.skipped}`);
        lines.push(`Failed: ${this.state.failed}`);
        if (this.state.expansionQueued != null) {
            lines.push(`Album-merge queued tracks: ${this.state.expansionQueued}`);
        }
        if (this.state.zipArchive) {
            lines.push(`ZIP archive: ${this.state.zipArchive}`);
        }
        if (this.state.completed) {
            lines.push(this.paint(this.state.completed, ANSI.bold, ANSI.green));
        }
        if (this.state.fatalError) {
            lines.push(this.paint(`Error: ${this.state.fatalError}`, ANSI.bold, ANSI.red));
        }
        if (this.failures.length) {
            lines.push(this.paint('Recent failures:', ANSI.bold, ANSI.red));
            lines.push(...this.failures.slice(0, 3).map((line) => `- ${truncate(line, 120)}`));
        }
        this.output.write(`${lines.join('\n')}\n`);
    }
}

function truncate(value, maxLength) {
    const text = String(value || '');
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
}

function formatRemainingSeconds(until) {
    return Math.max(1, Math.ceil((Number(until) - Date.now()) / 1000));
}

function parseRetryAfterMs(value) {
    if (value == null) {
        return null;
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
        return null;
    }

    const seconds = Number(trimmed);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.max(1000, Math.ceil(seconds * 1000));
    }

    const dateMs = Date.parse(trimmed);
    if (Number.isFinite(dateMs)) {
        return Math.max(1000, dateMs - Date.now());
    }

    return null;
}

function normalizeApiBase(base) {
    return String(base || '').trim().replace(/\/$/u, '');
}

function getManifestFormatsForQuality(quality) {
    const normalized = String(quality || '').trim().toUpperCase();

    switch (normalized) {
        case 'LOW':
            return ['HEAACV1', 'AACLC'];
        case 'LOSSLESS':
            return ['FLAC', 'AACLC', 'HEAACV1'];
        case 'HI_RES_LOSSLESS':
            return ['FLAC_HIRES', 'FLAC', 'AACLC', 'HEAACV1'];
        default:
            return ['FLAC_HIRES', 'FLAC', 'AACLC', 'HEAACV1'];
    }
}

function parseArgs(argv) {
    const args = {};

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];

        if (token === '-h' || token === 'help') {
            args.help = true;
            continue;
        }

        if (!token.startsWith('--')) {
            if (!args.input) {
                args.input = token;
            }
            continue;
        }

        const key = token.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
            args[key] = true;
            continue;
        }

        args[key] = next;
        i += 1;
    }

    // Parse album types from comma-separated string
    if (args['album-types']) {
        args.albumTypes = String(args['album-types']).split(',').map(t => t.trim().toLowerCase());
    }

    return args;
}

function parseNonNegativeInteger(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

class PersistentCache {
    constructor(filePath, data) {
        this.filePath = filePath;
        this.data = data;
        this.saveTimer = null;
        this.pendingSave = null;
    }

    static async load(filePath) {
        const defaults = {
            searchTrack: {},
            trackMetadata: {},
            playlists: {},
            publicPlaylists: {},
            albums: {},
            albumContents: {},
            albumMergeQueues: {},
            artists: {},
            covers: {},
        };

        try {
            const raw = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            return new PersistentCache(filePath, { ...defaults, ...parsed });
        } catch {
            await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
            return new PersistentCache(filePath, defaults);
        }
    }

    get(bucket, key) {
        return this.data?.[bucket]?.[key] ?? null;
    }

    set(bucket, key, value) {
        if (!this.data[bucket]) {
            this.data[bucket] = {};
        }
        this.data[bucket][key] = value;
        this.scheduleSave();
    }

    async save() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    }

    scheduleSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        this.saveTimer = setTimeout(() => {
            this.pendingSave = this.save().catch(() => {});
        }, 250);
    }

    async flush() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        if (this.pendingSave) {
            await this.pendingSave.catch(() => {});
            this.pendingSave = null;
        }
        await this.save();
    }
}

class InstanceAuthStore {
    constructor(filePath, data) {
        this.filePath = filePath;
        this.data = data;
    }

    static async load(filePath) {
        const defaults = {
            instances: {},
        };

        try {
            const raw = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            return new InstanceAuthStore(filePath, {
                ...defaults,
                ...parsed,
                instances: {
                    ...defaults.instances,
                    ...(parsed?.instances || {}),
                },
            });
        } catch {
            await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
            return new InstanceAuthStore(filePath, defaults);
        }
    }

    get(base) {
        return this.data.instances[normalizeApiBase(base)] || null;
    }

    set(base, value) {
        this.data.instances[normalizeApiBase(base)] = {
            ...(value || {}),
            updatedAt: new Date().toISOString(),
        };
    }

    clearSession(base) {
        const key = normalizeApiBase(base);
        const current = this.data.instances[key];
        if (!current) {
            return;
        }
        delete current.sessionToken;
        delete current.expiresAt;
        current.updatedAt = new Date().toISOString();
    }

    async save() {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    }

    async flush() {
        await this.save();
    }
}

class RunState {
    constructor(rootDir, source, downloaded, failures) {
        this.rootDir = rootDir;
        this.source = source;
        this.downloaded = downloaded;
        this.failures = failures;
        this.statePath = path.join(rootDir, '_run-state.json');
    }

    async flush() {
        await fs.mkdir(this.rootDir, { recursive: true });
        await writeCollectionArtifacts(this.rootDir, this.source, this.downloaded, this.failures);
        await fs.writeFile(
            this.statePath,
            JSON.stringify(
                {
                    updated: new Date().toISOString(),
                    sourceType: this.source.type,
                    sourceTitle: this.source.title,
                    downloadedCount: this.downloaded.length,
                    failureCount: this.failures.length,
                    downloadedIds: this.downloaded.map((track) => track.id),
                    downloadedTracks: this.downloaded.map((track) => toPersistedTrackRecord(track)),
                    failures: this.failures,
                },
                null,
                2
            ),
            'utf8'
        );
    }
}

function printHelp() {
    console.log(`
Monochrome playlist downloader

Usage (non-interactive):
  bun index.mjs --input <csv-json-or-link> [--output <dir>]

Usage (interactive):
  bun index.mjs                    Run in interactive mode for multiple downloads
  bun index.mjs --interactive      Explicit interactive mode flag

In interactive mode, you can queue multiple URLs/links to download sequentially. Settings persist between downloads.

Accepted input:
  - Spotify playlist/library CSV exports with track and artist columns
  - Plain text files (.txt) with one supported link per line
  - Generated Monochrome collection JSON files (.json)
  - Monochrome playlist links: /playlist/{id}
  - Monochrome album links: /album/{id}
  - Monochrome track links: /track/{id}
  - Monochrome artist links: /artist/{id}
  - Tidal links (full URL): tidal.com/album/{id}, tidal.com/track/{id}, tidal.com/artist/{id}

Options:
  --input <value>          CSV/JSON/TXT path, Monochrome link, or Tidal link
  --output <dir>           Output directory root. Default: ./downloads
  --api-url <url>          Override Monochrome/HiFi API base URL
  --quality <token>        Default: HI_RES_LOSSLESS
  --auth-username <value>  Username for auth-enabled instances
  --auth-login-key <value> Login key for auth-enabled instances
  --auth-password <value>  Password for legacy Basic-auth instances
  --download-retries <n>   Retry transient track download failures this many times. Default: 2
  --no-lyrics              Skip .lrc lyric downloads
  --no-genres              Skip genre fetching
  --genre-providers <list> Comma-separated list of genre providers (musicbrainz,lastfm,discogs). Default: musicbrainz,lastfm
  --lastfm-api-key <key>   Last.fm API key for genre fetching
  --lyrics-provider <p>    Lyrics provider: lrclib or genius
  --lyrics-synced-only     Only fetch synced (LRC) lyrics
  --lyrics-no-artist       Don't include artist in lyrics search
  --genius-api-key <key>   Genius API key for lyrics fetching
  --no-bpm-detect          Skip BPM detection from metadata/audio
  --no-zip                 Skip ZIP archive creation
  --artist-folders         Save as {artist}/{album}/tracks instead of {source}/{album-artist}/tracks.
                           Applies to album, track, and artist sources only.
  --plain                  Force line-by-line logs instead of the TTY dashboard
  --verbose                Show raw request/resolver logs instead of the TTY dashboard
  --i-know-it-doesnt-work-but-ill-use-it-anyway
                            Skip the startup playback preflight
  --interactive, -i        Run in interactive mode for multiple sequential downloads
  --help, -h, help         Show this help

If an instance requires auth and no saved credentials are available, the CLI
will prompt for either legacy Basic auth or the newer login/redeem flow,
depending on what the instance root advertises.
`.trim());
}

async function resolveSource(input, client, options = {}) {
    if (await exists(input)) {
        const extension = path.extname(input).toLowerCase();
        if (extension === '.csv') {
            console.log(`Reading CSV: ${input}`);
            const csvText = await fs.readFile(input, 'utf8');
            const csvResult = await parseCsvSource(csvText, client);
            return {
                type: 'csv',
                title: path.basename(input, path.extname(input)),
                tracks: csvResult.tracks,
                missing: csvResult.missing,
                metadata: {
                    title: path.basename(input, path.extname(input)),
                    source: input,
                },
            };
        }

        if (extension === '.json') {
            console.log(`Reading JSON: ${input}`);
            const jsonText = await fs.readFile(input, 'utf8');
            return await parseJsonSource(jsonText, input, client, options);
        }

        if (extension === '.txt') {
            console.log(`Reading TXT: ${input}`);
            const text = await fs.readFile(input, 'utf8');
            return await parseTextSource(text, input, client, options);
        }

        throw new Error('Only CSV, TXT, and supported JSON files are supported for file input.');
    }

    const playlistMatch = input.match(/\/playlist\/([^/?#]+)/i);
    if (playlistMatch) {
        const playlistId = playlistMatch[1];
        const playlist = await client.getPlaylist(playlistId);
        return {
            type: 'playlist',
            title: playlist.playlist.title,
            tracks: playlist.tracks,
            missing: [],
            metadata: playlist.playlist,
        };
    }

    const userPlaylistMatch = input.match(/\/userplaylist\/([^/?#]+)/i);
    if (userPlaylistMatch) {
        const playlistId = userPlaylistMatch[1];
        throw new Error('Public user playlist links are no longer supported because the PocketBase backend is being shut down.');
    }

    const albumMatch = input.match(/\/album\/([^/?#]+)/i);
    if (albumMatch) {
        const albumId = albumMatch[1];
        const album = await client.getAlbum(albumId);
        return {
            type: 'album',
            title: album.album.title,
            tracks: album.tracks,
            missing: [],
            metadata: album.album,
        };
    }

    const trackMatch = input.match(/\/track\/([^/?#]+)/i);
    if (trackMatch) {
        const trackId = trackMatch[1];
        const track = await client.getTrackMetadata(trackId);
        return {
            type: 'track',
            title: `${getTrackArtists(track)} - ${getTrackTitle(track)}`,
            tracks: [track],
            missing: [],
            metadata: {
                ...track,
                title: getTrackTitle(track),
            },
        };
    }

    const artistMatch = input.match(/\/artist\/([^/?#]+)/i);
    if (artistMatch) {
        const artistId = artistMatch[1];
        const artist = await client.getArtistTracks(artistId);
        return {
            type: 'artist',
            title: artist.artist.name,
            tracks: artist.tracks,
            missing: [],
            metadata: artist.artist,
        };
    }

    throw new Error('Unsupported input. Use a CSV/TXT/JSON file, a Monochrome link, or a Tidal link (tidal.com).');
}

async function parseCsvSource(csvText, client) {
    const rows = parseCsv(csvText);
    if (rows.length <= 1) {
        return { tracks: [], missing: [] };
    }

    const headerMap = mapCsvHeaders(rows[0]);
    const tracks = [];
    const missing = [];
    console.log(`CSV rows to resolve: ${Math.max(0, rows.length - 1)}`);

    for (let index = 1; index < rows.length; index += 1) {
        const row = rows[index];
        if (!row.some((cell) => cell.trim())) {
            continue;
        }

        const trackName = getCsvValue(row, headerMap, 'track');
        const artistName = getCsvValue(row, headerMap, 'artist');
        const albumName = getCsvValue(row, headerMap, 'album');
        const isrc = getCsvValue(row, headerMap, 'isrc');
        console.log(
            `[resolve ${index}/${rows.length - 1}] track="${trackName}" artist="${artistName}" album="${albumName}" isrc="${isrc}"`
        );

        if (!trackName || !artistName) {
            console.log('  -> skipped: missing required track or artist column');
            missing.push({ title: trackName, artist: artistName, album: albumName, reason: 'Missing track or artist' });
            continue;
        }

        const found = await client.searchTrack(trackName, artistName, albumName, isrc);
        if (found) {
            console.log(`  -> matched: id=${found.id} title="${getTrackTitle(found)}" artist="${getTrackArtists(found)}"`);
            tracks.push(found);
        } else {
            console.log('  -> no match');
            missing.push({ title: trackName, artist: artistName, album: albumName, isrc, reason: 'No match' });
        }
    }

    return { tracks, missing };
}

async function parseTextSource(text, filePath, client, options = {}) {
    const lines = text
        .replace(/^\uFEFF/u, '')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));

    if (!lines.length) {
        return {
            type: 'txt',
            title: path.basename(filePath, path.extname(filePath)),
            tracks: [],
            missing: [],
            metadata: {
                title: path.basename(filePath, path.extname(filePath)),
                source: filePath,
                lineCount: 0,
            },
        };
    }

    const tracks = [];
    const missing = [];
    console.log(`TXT entries to resolve: ${lines.length}`);

    for (let index = 0; index < lines.length; index += 1) {
        const entry = lines[index];
        console.log(`[resolve ${index + 1}/${lines.length}] ${entry}`);

        try {
            const resolved = await resolveSource(entry, client, options);
            tracks.push(...(resolved.tracks || []));
            if (Array.isArray(resolved.missing) && resolved.missing.length) {
                missing.push(
                    ...resolved.missing.map((item) => ({
                        ...item,
                        source: entry,
                    }))
                );
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`  -> skipped: ${message}`);
            missing.push({
                source: entry,
                reason: message,
            });
        }
    }

    return {
        type: 'txt',
        title: path.basename(filePath, path.extname(filePath)),
        tracks: dedupeTracksById(tracks),
        missing,
        metadata: {
            title: path.basename(filePath, path.extname(filePath)),
            source: filePath,
            lineCount: lines.length,
        },
    };
}

async function parseJsonSource(jsonText, filePath, client, options = {}) {
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`Invalid JSON file: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (isGeneratedCollectionJson(parsed)) {
        if (options.skipPlaybackPreflight) {
            console.log('Playback preflight bypassed by user flag.');
        } else {
            await runPlaybackPreflight(
                {
                    type: 'playlist-json',
                    title: parsed?.source?.title || path.basename(filePath, path.extname(filePath)),
                    tracks: Array.isArray(parsed?.tracks) ? parsed.tracks : [],
                    missing: [],
                },
                client
            );
        }

        const result = await buildAlbumMergeSourceFromJson(parsed, filePath, jsonText, client);
        result.metadata = {
            ...(result.metadata || {}),
            preflightCompleted: !options.skipPlaybackPreflight,
        };
        return result;
    }

    if (isMonochromePlaylistJson(parsed)) {
        return parseMonochromePlaylistJsonSource(parsed, filePath);
    }

    throw new Error('Unsupported JSON input. Expected a generated Monochrome collection JSON file or a Monochrome playlist export.');
}

async function buildAlbumMergeSourceFromJson(parsed, filePath, jsonText, client) {
    const sourceTitle = parsed?.source?.title || path.basename(filePath, path.extname(filePath));
    const sourceTracks = Array.isArray(parsed?.tracks) ? parsed.tracks : [];
    const sourceFingerprint = createHash('sha1').update(jsonText).digest('hex');
    const queueCacheKey = JSON.stringify({
        filePath: path.resolve(filePath),
        fingerprint: sourceFingerprint,
        sourceType: parsed?.sourceType || null,
        trackCount: sourceTracks.length,
    });
    const cachedQueue = client.cache.get('albumMergeQueues', queueCacheKey);

    if (cachedQueue) {
        console.log(`Album merge queue cache hit: ${sourceTitle}`);
        return {
            type: 'album-merge',
            title: cachedQueue.title || `${sourceTitle} - Album Merge`,
            tracks: Array.isArray(cachedQueue.tracks) ? cachedQueue.tracks : [],
            missing: Array.isArray(cachedQueue.missing) ? cachedQueue.missing : [],
            metadata: {
                ...(cachedQueue.metadata || {}),
                queueCacheKey,
                sourceFingerprint,
            },
        };
    }

    const originalTrackIds = new Set(
        sourceTracks
            .map((track) => normalizeId(track?.id))
            .filter(Boolean)
    );
    const seenAlbumIds = new Set();
    const expandedTracks = [];
    const missing = [];

    console.log(`JSON tracks to expand: ${sourceTracks.length}`);

    for (let index = 0; index < sourceTracks.length; index += 1) {
        const seedTrack = sourceTracks[index];
        const seedTrackId = normalizeId(seedTrack?.id);
        const seedLabel = `${seedTrack?.artist || 'Unknown Artist'} - ${seedTrack?.title || 'Unknown Title'}`;
        console.log(`[expand ${index + 1}/${sourceTracks.length}] ${seedLabel}`);

        if (!seedTrackId) {
            console.log('  -> skipped: missing track id');
            missing.push({ title: seedTrack?.title || null, artist: seedTrack?.artist || null, reason: 'Missing track id' });
            continue;
        }

        const albumId = await resolveTrackAlbumId(seedTrack, seedTrackId, client).catch((error) => {
            missing.push({
                id: seedTrackId,
                title: seedTrack?.title || null,
                artist: seedTrack?.artist || null,
                reason: error instanceof Error ? error.message : String(error),
            });
            console.log(`  -> skipped: ${missing.at(-1).reason}`);
            return null;
        });

        if (!albumId) {
            continue;
        }

        if (seenAlbumIds.has(albumId)) {
            console.log(`  -> album already expanded: ${albumId}`);
            continue;
        }

        const album = await client.getAlbumContents(albumId).catch((error) => {
            missing.push({
                id: seedTrackId,
                albumId,
                title: seedTrack?.title || null,
                artist: seedTrack?.artist || null,
                reason: error instanceof Error ? error.message : String(error),
            });
            console.log(`  -> album expansion failed: ${missing.at(-1).reason}`);
            return null;
        });

        if (!album) {
            continue;
        }

        seenAlbumIds.add(albumId);

        const filteredAlbumTracks = album.tracks.filter((track) => {
            const trackId = normalizeId(track?.id);
            return trackId && !originalTrackIds.has(trackId);
        });

        console.log(
            `  -> album expanded: ${album.album.title || albumId} total=${album.tracks.length} queued=${filteredAlbumTracks.length}`
        );

        expandedTracks.push(...filteredAlbumTracks);
    }

    const dedupedTracks = dedupeTracksById(expandedTracks);
    const result = {
        type: 'album-merge',
        title: `${sourceTitle} - Album Merge`,
        tracks: dedupedTracks,
        missing,
        metadata: {
            title: `${sourceTitle} - Album Merge`,
            artist: parsed?.source?.artist || 'Various Artists',
            id: parsed?.source?.id || null,
            sourceFormat: parsed?.format || null,
            sourceType: parsed?.sourceType || null,
            sourcePath: filePath,
            queueCacheKey,
            sourceFingerprint,
            originalTrackCount: sourceTracks.length,
            originalAlbumCount: seenAlbumIds.size,
            expandedTrackCount: dedupedTracks.length,
        },
    };

    client.cache.set('albumMergeQueues', queueCacheKey, {
        title: result.title,
        tracks: result.tracks,
        missing: result.missing,
        metadata: result.metadata,
    });

    return result;
}

function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u);
    return lines.map((line) => {
        const cells = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            const next = line[i + 1];

            if (char === '"' && inQuotes && next === '"') {
                current += '"';
                i += 1;
                continue;
            }

            if (char === '"') {
                inQuotes = !inQuotes;
                continue;
            }

            if (char === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
                continue;
            }

            current += char;
        }

        cells.push(current.trim());
        return cells;
    });
}

function mapCsvHeaders(headers) {
    const aliases = {
        track: ['track name', 'title', 'song', 'name', 'track', 'track title'],
        artist: ['artist name(s)', 'artist name', 'artist', 'artists', 'creator'],
        album: ['album', 'album name'],
        isrc: ['isrc', 'isrc code'],
    };

    const normalized = headers.map((header) =>
        header
            .toLowerCase()
            .trim()
            .replace(/[_\s]+/gu, ' ')
    );

    const result = {};
    for (const [key, values] of Object.entries(aliases)) {
        result[key] = normalized.findIndex((header) => values.includes(header));
    }
    return result;
}

function getCsvValue(row, headerMap, key) {
    const index = headerMap[key];
    return index >= 0 ? (row[index] || '').trim() : '';
}

function isGeneratedCollectionJson(value) {
    return Boolean(
        value &&
            typeof value === 'object' &&
            ['monochrome-collection', 'monochrome-playlist'].includes(value.format) &&
            Array.isArray(value.tracks)
    );
}

function isMonochromePlaylistJson(value) {
    return Boolean(
        value &&
            typeof value === 'object' &&
            typeof (value.name || value.title) === 'string' &&
            Array.isArray(value.tracks) &&
            (value.id != null || value.uuid != null) &&
            ('isPublic' in value || 'createdAt' in value || 'updatedAt' in value)
    );
}

function parseMonochromePlaylistJsonSource(parsed, filePath) {
    const title = parsed?.name || parsed?.title || path.basename(filePath, path.extname(filePath));
    const tracks = Array.isArray(parsed?.tracks) ? parsed.tracks.map(normalizeMonochromePlaylistTrack) : [];

    return {
        type: 'playlist',
        title,
        tracks,
        missing: [],
        metadata: {
            ...parsed,
            title,
            id: parsed?.id ?? parsed?.uuid ?? null,
        },
    };
}

function normalizeMonochromePlaylistTrack(track) {
    const artists = Array.isArray(track?.artists)
        ? track.artists
              .filter((artist) => artist && typeof artist === 'object' && artist.name)
              .map((artist) => ({
                  id: artist.id ?? null,
                  name: artist.name,
              }))
        : [];
    const primaryArtist =
        track?.artist && typeof track.artist === 'object' && track.artist.name
            ? {
                  ...track.artist,
                  id: track.artist.id ?? null,
              }
            : artists[0]
              ? {
                    id: artists[0].id ?? null,
                    name: artists[0].name,
                }
              : null;

    return {
        ...track,
        id: track?.id ?? null,
        title: track?.title || track?.name || null,
        artist: primaryArtist,
        artists,
        album: {
            ...(track?.album || {}),
            id: track?.album?.id ?? null,
            title: track?.album?.title || track?.album?.name || null,
            cover: track?.album?.cover ?? null,
            artist:
                track?.album?.artist && typeof track.album.artist === 'object' && track.album.artist.name
                    ? {
                          ...track.album.artist,
                          id: track.album.artist.id ?? null,
                      }
                    : null,
        },
        duration: track?.duration ?? null,
        trackNumber: track?.trackNumber ?? null,
        volumeNumber: track?.volumeNumber ?? track?.discNumber ?? null,
        explicit: Boolean(track?.explicit),
        isrc: track?.isrc ?? null,
    };
}

function normalizeId(value) {
    if (value == null || value === '') {
        return null;
    }
    return String(value);
}

function toPersistedTrackRecord(track) {
    return {
        id: normalizeId(track?.id),
        title: getTrackTitle(track),
        artist: getTrackArtists(track),
        album: track?.album?.title || null,
        albumId: normalizeId(track?.album?.id || track?.albumId),
        albumArtist: getAlbumArtist(track),
        trackNumber: track?.trackNumber ?? null,
        duration: Math.round(track?.duration || 0),
        isrc: track?.isrc ?? null,
        filePath: track?.filePath || null,
    };
}

async function resolveTrackAlbumId(track, trackId, client) {
    const directAlbumId = normalizeId(track?.albumId || track?.album?.id);
    if (directAlbumId) {
        return directAlbumId;
    }

    console.log(`  -> metadata fetch for album id: ${trackId}`);
    const metadata = await client.getTrackMetadata(trackId);
    const hydratedAlbumId = normalizeId(metadata?.album?.id);
    if (!hydratedAlbumId) {
        throw new Error(`Track ${trackId} did not include an album id`);
    }
    return hydratedAlbumId;
}

function dedupeTracksById(tracks) {
    const seen = new Set();
    const deduped = [];

    for (const track of tracks) {
        const trackId = normalizeId(track?.id);
        if (!trackId || seen.has(trackId)) {
            continue;
        }
        seen.add(trackId);
        deduped.push(track);
    }

    return deduped;
}

async function runPlaybackPreflight(source, client) {
    const sampleTracks = selectPreflightTracks(source?.tracks || [], 3);
    if (sampleTracks.length < 2) {
        return;
    }

    console.log(`Playback preflight: sampling ${sampleTracks.length} tracks`);
    const failures = [];

    for (const track of sampleTracks) {
        try {
            console.log(`  -> preflight track: ${track.id} ${getTrackArtists(track)} - ${getTrackTitle(track)}`);
            await client.resolveTrackStream(track.id);
            console.log('  -> preflight passed');
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push({
                id: track.id,
                message,
            });
            console.log(`  -> preflight failed: ${message}`);
        }
    }

    const authLikeFailures = failures.filter((failure) => isLikelyPlaybackAuthFailure(failure.message));
    if (failures.length === sampleTracks.length && authLikeFailures.length === failures.length) {
        throw new Error(
            `Playback preflight failed for ${failures.length}/${sampleTracks.length} sampled tracks. Upstream playback access looks unavailable across all configured instances, so the run was stopped early.`
        );
    }
}

function selectPreflightTracks(tracks, limit) {
    const selected = [];
    const seen = new Set();

    for (const track of tracks) {
        const trackId = normalizeId(track?.id);
        if (!trackId || seen.has(trackId)) {
            continue;
        }
        seen.add(trackId);
        selected.push(track);
        if (selected.length >= limit) {
            break;
        }
    }

    return selected;
}

function isLikelyPlaybackAuthFailure(message) {
    const value = String(message || '').toLowerCase();
    return (
        value.includes('401 unauthorized') ||
        value.includes('403 forbidden') ||
        value.includes('authentication required for') ||
        value.includes('missing or invalid authorization header') ||
        value.includes('invalid or expired token') ||
        value.includes('preview dash manifest detected') ||
        value.includes('full_requires_subscription') ||
        value.includes('presentation=preview') ||
        value.includes('preview-only') ||
        value.includes('could not resolve stream from trackmanifests')
    );
}

function compactTrackForAlbumContents(track, albumFallback = null) {
    const album = {
        ...(albumFallback || {}),
        ...(track?.album || {}),
    };

    return {
        id: track?.id ?? null,
        title: track?.title || track?.name || null,
        version: track?.version || null,
        artist: track?.artist?.name ? { id: track.artist.id ?? null, name: track.artist.name } : null,
        artists: Array.isArray(track?.artists)
            ? track.artists
                  .filter((artist) => artist?.name)
                  .map((artist) => ({ id: artist.id ?? null, name: artist.name }))
            : [],
        album: {
            id: album?.id ?? null,
            title: album?.title || album?.name || null,
            cover: album?.cover ?? null,
            numberOfTracks: album?.numberOfTracks ?? null,
            numberOfTracksOnDisc: album?.numberOfTracksOnDisc ?? null,
            totalDiscs: album?.totalDiscs ?? null,
            releaseDate: album?.releaseDate ?? null,
            artist: album?.artist?.name ? { id: album.artist.id ?? null, name: album.artist.name } : null,
        },
        trackNumber: track?.trackNumber ?? null,
        volumeNumber: track?.volumeNumber ?? track?.discNumber ?? null,
        duration: track?.duration ?? null,
        isrc: track?.isrc ?? null,
        audioQuality: track?.audioQuality ?? null,
        explicit: Boolean(track?.explicit),
    };
}

function sanitizeForFilename(value) {
    const original = String(value || 'Unknown');
    let sanitized = original
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f-\u009f]/gu, '')
        .replace(/\p{Cf}+/gu, '')
        .replace(/[\\/:*?"<>|]/gu, '_')
        .replace(/[^\p{L}\p{N}\p{M}\s._()[\]&,'!+-]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .replace(/[. ]+$/gu, '')
        .trim();

    // unicode ew
    if (/[\u2300-\u23ff\u2500-\u259f\u25a0-\u25ff]/u.test(original)) {
        sanitized = sanitized
            .replace(/[^A-Za-z0-9\s._()[\]&,'!+-]/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[. ]+$/g, '')
            .trim();
    }

    if (!sanitized) {
        return 'Unknown';
    }

    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu.test(sanitized)) {
        return `${sanitized}_`;
    }

    return sanitized;
}

function formatTemplate(template, values) {
    const tokens = {
        trackNumber: values.trackNumber ? String(values.trackNumber).padStart(2, '0') : '00',
        artist: sanitizeForFilename(values.artist || 'Unknown Artist'),
        title: sanitizeForFilename(values.title || 'Unknown Title'),
        albumTitle: sanitizeForFilename(values.albumTitle || 'Unknown Album'),
        albumArtist: sanitizeForFilename(values.albumArtist || 'Unknown Artist'),
    };

    return template.replace(/\{([^{}]+)\}/gu, (match, key) => tokens[key] ?? match);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${Math.round(bytes)}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function formatSpeed(bytesPerSecond) {
    return `${formatFileSize(bytesPerSecond)}/s`;
}

function createProgressBar(percent, width = 20) {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return `${'='.repeat(filled)}${'-'.repeat(empty)}`;
}

async function monitorDownloadProgress(downloadPromise, filePath, trackLabel, metadata = null) {
    const startTime = Date.now();
    let lastReportTime = startTime;
    let lastReportedBytes = 0;
    let maxObservedBytes = 0;
    let isComplete = false;

    const reportProgress = () => {
        if (isComplete) return;
        try {
            const stat = require('fs').statSync(filePath);
            const currentBytes = stat.size;
            if (currentBytes === lastReportedBytes) return;
            
            maxObservedBytes = Math.max(maxObservedBytes, currentBytes);
            const elapsedMs = Date.now() - startTime;
            const timeSinceLastReport = Date.now() - lastReportTime;

            if (currentBytes > 0 && timeSinceLastReport > 200) {
                const bytesDownloaded = currentBytes - lastReportedBytes;
                const currentSpeed = (bytesDownloaded / (timeSinceLastReport / 1000));
                const avgSpeed = (currentBytes / (elapsedMs / 1000));
                const displaySpeed = Math.max(currentSpeed, avgSpeed);

                const humanCurrent = formatFileSize(currentBytes);
                // Use bitrate estimate if available
                const total = metadata?.estimatedBytes || currentBytes;
                const humanTotal = formatFileSize(total);
                const percent = total > 0 ? Math.min(100, (currentBytes / total) * 100) : 0;
                const bar = createProgressBar(percent);
                
                // Calculate ETA
                const remainingBytes = Math.max(0, total - currentBytes);
                const remainingSeconds = displaySpeed > 0 ? remainingBytes / displaySpeed : 0;
                const etaStr = remainingSeconds > 0 ? ` ETA ${formatSeconds(remainingSeconds)}` : '';

                const estimateLabel = metadata?.estimatedBytes ? ' (approximately)' : '';
                console.log(`  [${bar}] ${percent.toFixed(0)}% - ${humanCurrent} / ${humanTotal}${estimateLabel} @ ${formatSpeed(displaySpeed)}${etaStr}`);

                lastReportTime = Date.now();
                lastReportedBytes = currentBytes;
            }
        } catch (e) {
            // File not yet created or other error
        }
    };

    // Start monitoring after a brief delay to allow stream resolution
    await new Promise(resolve => setTimeout(resolve, 50));
    const progressInterval = setInterval(reportProgress, 25);
    
    let watcher;
    try {
        watcher = require('fs').watchFile(filePath, { interval: 100 }, reportProgress);
    } catch (e) {
        // watchFile may fail if file doesn't exist yet, polling will catch it
    }

    try {
        const result = await downloadPromise;
        isComplete = true;
        clearInterval(progressInterval);
        if (watcher) watcher.close?.();
        
        // Final progress report
        try {
            const finalStat = require('fs').statSync(filePath).size;
            const totalTime = (Date.now() - startTime) / 1000;
            const avgSpeed = finalStat / totalTime;
            const humanSize = formatFileSize(finalStat);
            console.log(`  -> downloaded ${humanSize} @ ${formatSpeed(avgSpeed)}`);
        } catch (e) {}
        
        return result;
    } catch (error) {
        isComplete = true;
        clearInterval(progressInterval);
        if (watcher) watcher.close?.();
        throw error;
    }
}

function getTrackTitle(track) {
    return track?.version ? `${track.title} (${track.version})` : track?.title || 'Unknown Title';
}


const GENRE_RATE_LIMIT_STATE = {
    lastFm: { lastRequest: 0, minInterval: 1000 },
};

async function waitForGenreRateLimit(api) {
    const state = GENRE_RATE_LIMIT_STATE[api];
    if (!state) return;
    const now = Date.now();
    const waitMs = state.minInterval - (now - state.lastRequest);
    if (waitMs > 0) {
        await sleep(waitMs);
    }
    state.lastRequest = Date.now();
}

const GENRE_API_CONFIG = {
    lastfm: { enabled: false, rateLimit: 1000, key: process.env.LASTFM_API_KEY },
};

const GENRE_API_STATE = {
    lastfm: { lastRequest: 0 },
};

async function waitForRateLimit(api) {
    const state = GENRE_API_STATE[api];
    const config = GENRE_API_CONFIG[api];
    if (!state || !config?.enabled) return;
    const now = Date.now();
    const waitMs = config.rateLimit - (now - state.lastRequest);
    if (waitMs > 0) await sleep(waitMs);
    state.lastRequest = Date.now();
}

async function downloadTrack({ track, assemblyRoot, client, includeLyrics, lyricsProvider, lyricsOptions, includeGenres, genreProviders, includeBpm, albumCoverWrites, flatAlbumDir = false, albumOnlyFolder = false, zipArchivePath = null }) {
    const hydratedTrack = await client.getTrackMetadata(track.id).catch(() => track);
    const mergedTrack = mergeTrackMetadata(track, hydratedTrack);
    const resolvedTrack = await hydrateTrackAlbumMetadata(mergedTrack, client).catch(() => mergedTrack);
    const fileBase = formatTemplate(DEFAULT_FILENAME_TEMPLATE, {
        trackNumber: resolvedTrack.trackNumber,
        artist: resolvedTrack.artist?.name || resolvedTrack.artists?.[0]?.name,
        title: getTrackTitle(resolvedTrack),
    });
    const discNumber = Number(resolvedTrack.volumeNumber || resolvedTrack.discNumber || 1);
    const totalDiscs = Number(resolvedTrack.album?.totalDiscs || resolvedTrack.album?.numberOfVolumes || 1);

    let albumDir;
    let relativeAudioPath;
    if (flatAlbumDir) {
        if (totalDiscs > 1) {
            const discDir = await resolvePreferredDirectory(assemblyRoot, `Disc ${discNumber}`);
            albumDir = discDir;
            relativeAudioPath = path.posix.join(path.basename(discDir), `${fileBase}.flac`);
        } else {
            albumDir = assemblyRoot;
            relativeAudioPath = `${fileBase}.flac`;
        }
    } else {
        const folderName = albumOnlyFolder
            ? sanitizeForFilename(resolvedTrack.album?.title || 'Unknown Album')
            : formatTemplate(DEFAULT_FOLDER_TEMPLATE, {
                  albumTitle: resolvedTrack.album?.title,
                  albumArtist: getAlbumArtist(resolvedTrack) || 'Various Artists',
              });
        albumDir = await resolvePreferredDirectory(assemblyRoot, folderName);
        const actualFolderName = path.basename(albumDir);
        relativeAudioPath = path.posix.join(actualFolderName, `${fileBase}.flac`);
    }

    const absoluteAudioPath = path.join(albumDir, `${fileBase}.flac`);

    const existingAudioPath = await findExistingAudioPath(absoluteAudioPath);
    let skippedDownload = false;
    let finalAbsoluteAudioPath = absoluteAudioPath;
    if (existingAudioPath) {
        const finalRelativeAudioPath = flatAlbumDir
            ? path.relative(assemblyRoot, existingAudioPath).split(path.sep).join(path.posix.sep)
            : path.posix.join(path.basename(albumDir), path.basename(existingAudioPath));
        console.log(`  -> file exists, skipping download: ${finalRelativeAudioPath}`);
        if (zipArchivePath) {
            await addFileToZipArchive(zipArchivePath, assemblyRoot, finalRelativeAudioPath);
            console.log(`  -> archived existing file: ${finalRelativeAudioPath}`);
            await fs.rm(existingAudioPath).catch(() => {});
        }
        skippedDownload = true;
        finalAbsoluteAudioPath = existingAudioPath;
    }

    if (!skippedDownload) {
        const trackLabel = `${resolvedTrack.artist?.name || resolvedTrack.artists?.[0]?.name || 'Unknown'} - ${getTrackTitle(resolvedTrack)}`;
        const metadata = { estimatedBytes: null };
        const downloadPromise = client.downloadTrackToFile(resolvedTrack.id, absoluteAudioPath, metadata);
        const audioResult = await monitorDownloadProgress(
            downloadPromise,
            absoluteAudioPath,
            trackLabel,
            metadata
        );
        finalAbsoluteAudioPath = absoluteAudioPath;

        if (audioResult.extension !== 'flac') {
            finalAbsoluteAudioPath = absoluteAudioPath.replace(/\.flac$/i, `.${audioResult.extension}`);
            await fs.rename(absoluteAudioPath, finalAbsoluteAudioPath);
            console.warn(`  Saved ${resolvedTrack.id} as .${audioResult.extension} because the upstream stream was not FLAC.`);
        }
    } else {
        finalAbsoluteAudioPath = existingAudioPath;
    }

    const finalRelativeAudioPath = flatAlbumDir
        ? path.relative(assemblyRoot, finalAbsoluteAudioPath).split(path.sep).join(path.posix.sep)
        : path.posix.join(path.basename(albumDir), path.basename(finalAbsoluteAudioPath));

    let embeddedLyrics = null;
    let fetchedGenres = [];
    let fetchedReleaseType = null;
    let fetchedMbId = null;
    let fetchedRgId = null;
    let metaCountry = null;
    let metaLabels = [];
    let metaBarcode = null;
    let metaCatalogNumber = null;
    let metaDate = null;
    let metaDateSource = 'tidal';
    const genreResult = includeGenres
        ? await fetchAllGenresAndReleaseType(
            resolvedTrack.artist?.name || resolvedTrack.artists?.[0]?.name || 'Unknown',
            resolvedTrack.album?.title || '',
            resolvedTrack.album?.id,
            genreProviders,
            { ...resolvedTrack.album },
          )
        : null;
    console.log(`  -> genre providers: ${genreProviders.join(', ')}`);
    console.log(`  -> resolved album id: ${resolvedTrack.album?.id} (type: ${typeof resolvedTrack.album?.id})`);
    if (genreResult) {
        console.log(`  -> genre result: mbId=${genreResult.mbId}, rgId=${genreResult.rgId}, releaseType=${genreResult.releaseType}, genres=${genreResult.genres.length}, country=${genreResult.country}`);
    }
    if (genreResult) {
        fetchedGenres = genreResult.genres;
        fetchedReleaseType = genreResult.releaseType;
        fetchedMbId = genreResult.mbId || resolvedTrack.album?.id || null;
        fetchedRgId = genreResult.rgId || null;
        metaCountry = genreResult.country ?? null;
        metaLabels = genreResult.labels ?? [];
        metaBarcode = genreResult.barcode ?? null;
        metaCatalogNumber = genreResult.catalogNumber ?? null;
        metaDate = genreResult.date ?? null;
        metaDateSource = genreResult.dateSource ?? 'musicbrainz';
        if (fetchedGenres.length > 0) {
            console.log(`  -> fetched genres (${fetchedGenres.length}): ${fetchedGenres.join(', ')}`);
        }
        if (fetchedReleaseType) {
            console.log(`  -> release type: ${fetchedReleaseType}`);
        }
        if (fetchedMbId) {
            console.log(`  -> MusicBrainz ID: ${fetchedMbId}`);
        }
    }
    if (includeLyrics) {
        console.log(`  -> fetching lyrics from ${lyricsProvider}...`);
        embeddedLyrics = await fetchLyrics(resolvedTrack, lyricsProvider, lyricsOptions);
        if (embeddedLyrics) {
            const lrcPath = finalAbsoluteAudioPath.replace(/\.[^.]+$/u, '.lrc');
            await fs.writeFile(lrcPath, embeddedLyrics, 'utf8');
            console.log(`  -> downloaded lyrics: ${path.basename(lrcPath)}`);
        } else {
            console.log(`  -> no lyrics found`);
        }
    }

    let fetchedBpm = null;
    if (includeBpm) {
        console.log(`  -> reading BPM from metadata...`);
        const probe = await probeMedia(finalAbsoluteAudioPath).catch(() => null);
        fetchedBpm = probe?.format?.tags?.['TBPM'] || probe?.format?.tags?.['bpm'];
        if (fetchedBpm) {
            console.log(`  -> found BPM from metadata: ${fetchedBpm}`);
        } else {
            // Try album-level BPM from track metadata
            const albumBpm = resolvedTrack.album?.metadata?.bpm || resolvedTrack.metadata?.bpm;
            if (albumBpm) {
                fetchedBpm = String(albumBpm);
                console.log(`  -> found BPM from album metadata: ${fetchedBpm}`);
            } else {
                console.log(`  -> no BPM metadata found, detecting with aubio...`);
                fetchedBpm = await detectBpmWithAubio(finalAbsoluteAudioPath);
                if (fetchedBpm) {
                    console.log(`  -> detected BPM: ${fetchedBpm}`);
                } else {
                    console.log(`  -> could not detect BPM`);
                }
            }
        }
    }

    let coverBuffer = null;
    const coverId = resolvedTrack.album?.cover;
    if (coverId) {
        const coverFolder = path.dirname(finalAbsoluteAudioPath);
        const coverTarget = path.join(coverFolder, 'cover.jpg');
        coverBuffer = await client.fetchCover(coverId);
        if (coverBuffer && !albumCoverWrites.has(coverTarget)) {
            await fs.writeFile(coverTarget, coverBuffer);
            albumCoverWrites.add(coverTarget);
        }
    }

    await embedMetadataWithFfmpeg({
        audioPath: finalAbsoluteAudioPath,
        track: resolvedTrack,
        lyrics: embeddedLyrics,
        coverBuffer,
        genres: fetchedGenres,
        releaseType: fetchedReleaseType,
        mbId: fetchedMbId,
        rgId: fetchedRgId,
        bpm: fetchedBpm ? parseInt(fetchedBpm, 10) : null,
        country: metaCountry,
        labels: metaLabels,
        barcode: metaBarcode,
        catalogNumber: metaCatalogNumber,
        date: metaDate,
        dateSource: metaDateSource,
    });

    if (zipArchivePath) {
        await addFileToZipArchive(zipArchivePath, assemblyRoot, finalRelativeAudioPath);
        console.log(`  -> archived track: ${finalRelativeAudioPath}`);
        await fs.rm(finalAbsoluteAudioPath).catch(() => {});
    }

    return {
        ...resolvedTrack,
        filePath: finalRelativeAudioPath,
    };
}

function getPrimaryTrackArtist(track) {
    if (track?.artist?.name) {
        return track.artist.name;
    }

    if (Array.isArray(track?.artists)) {
        const firstNamedArtist = track.artists.find((artist) => artist?.name);
        if (firstNamedArtist?.name) {
            return firstNamedArtist.name;
        }
    }

    return 'Unknown Artist';
}

function getTrackArtists(track) {
    if (Array.isArray(track?.artists) && track.artists.length > 0) {
        return track.artists.map((artist) => artist?.name || 'Unknown Artist').join(', ');
    }
    return getPrimaryTrackArtist(track);
}

function getAlbumArtist(track) {
    if (track?.album?.artist?.name) {
        return track.album.artist.name;
    }

    if (Array.isArray(track?.album?.artists)) {
        const firstNamedArtist = track.album.artists.find((artist) => artist?.name);
        if (firstNamedArtist?.name) {
            return firstNamedArtist.name;
        }
    }

    const primaryTrackArtist = getPrimaryTrackArtist(track);
    if (primaryTrackArtist && primaryTrackArtist !== 'Unknown Artist') {
        return primaryTrackArtist;
    }

    return 'Unknown Artist';
}

function isRetryableDownloadError(message) {
    const value = String(message || '').toLowerCase();
    return (
        value.includes('429 too many requests') ||
        value.includes('rate limit') ||
        value.includes('timed out') ||
        value.includes('timeout') ||
        value.includes('econnreset') ||
        value.includes('econnrefused') ||
        value.includes('eai_again') ||
        value.includes('enotfound') ||
        value.includes('network') ||
        value.includes('fetch failed') ||
        /\b5\d\d\b/u.test(value)
    );
}

function mergeTrackMetadata(primary, fallback) {
    return {
        ...fallback,
        ...primary,
        album: {
            ...(fallback?.album || {}),
            ...(primary?.album || {}),
        },
        artist: primary?.artist || fallback?.artist,
        artists: primary?.artists || fallback?.artists,
    };
}

async function hydrateTrackAlbumMetadata(track, client) {
    const albumId = normalizeId(track?.album?.id || track?.albumId);
    if (!albumId) {
        return track;
    }

    const albumPayload = await client.getAlbum(albumId).catch(() => null);
    const album = albumPayload?.album || null;
    if (!album) {
        return track;
    }

    return {
        ...track,
        album: {
            ...(track?.album || {}),
            ...album,
            artist: album?.artist || track?.album?.artist || null,
            artists: album?.artists || track?.album?.artists || [],
            totalDiscs: album?.totalDiscs ?? album?.numberOfVolumes ?? track?.album?.totalDiscs ?? null,
            numberOfTracks: album?.numberOfTracks ?? track?.album?.numberOfTracks ?? null,
        },
    };
}

function normalizeSearchResponse(data, key) {
    const section = findSearchSection(data, key, new Set());
    const items = section?.items ?? [];
    return { items };
}

function findSearchSection(source, key, visited) {
    if (!source || typeof source !== 'object') {
        return null;
    }

    if (Array.isArray(source)) {
        for (const entry of source) {
            const found = findSearchSection(entry, key, visited);
            if (found) {
                return found;
            }
        }
        return null;
    }

    if (visited.has(source)) {
        return null;
    }
    visited.add(source);

    if (Array.isArray(source.items)) {
        return source;
    }

    if (key in source) {
        const found = findSearchSection(source[key], key, visited);
        if (found) {
            return found;
        }
    }

    for (const value of Object.values(source)) {
        const found = findSearchSection(value, key, visited);
        if (found) {
            return found;
        }
    }

    return null;
}

function extractAlbumPayload(payload, albumId) {
    const album = findFirstObject(payload, (value) => isAlbumLike(value) && String(value.id || '') === String(albumId))
        || findFirstObject(payload, isAlbumLike);
    const tracks =
        pickBestTrackCollection(payload, ['tracks', 'items', 'albumTracks'])
            .map((entry) => normalizeTrackEntry(entry, album))
            .filter(isTrackLike);

    if (!album) {
        throw new Error(`Album ${albumId} not found`);
    }

    if (!tracks.length) {
        throw new Error(`Album ${albumId} did not include any tracks`);
    }

    return {
        album: {
            ...album,
            title: album.title || album.name || `Album ${albumId}`,
        },
        tracks,
    };
}

function extractArtistPayload(payload, artistId) {
    const artist = findFirstObject(payload, (value) => isArtistLike(value) && String(value.id || '') === String(artistId))
        || findFirstObject(payload, isArtistLike)
        || { id: artistId, name: `Artist ${artistId}` };
    const tracks =
        pickBestTrackCollection(payload, ['popularTracks', 'topTracks', 'tracks', 'items'])
            .map((entry) => normalizeTrackEntry(entry))
            .filter((track) => isTrackLike(track) && artistMatchesTrack(track, artist));

    if (!tracks.length) {
        throw new Error(`Artist ${artistId} did not include any downloadable tracks`);
    }

    return {
        artist,
        tracks,
    };
}

function findFirstObject(source, predicate, visited = new Set()) {
    if (!source || typeof source !== 'object') {
        return null;
    }

    if (visited.has(source)) {
        return null;
    }
    visited.add(source);

    if (!Array.isArray(source) && predicate(source)) {
        return source;
    }

    if (Array.isArray(source)) {
        for (const entry of source) {
            const found = findFirstObject(entry, predicate, visited);
            if (found) {
                return found;
            }
        }
        return null;
    }

    for (const value of Object.values(source)) {
        const found = findFirstObject(value, predicate, visited);
        if (found) {
            return found;
        }
    }

    return null;
}

function pickBestTrackCollection(source, preferredKeys = []) {
    const candidates = [];
    collectTrackCollections(source, candidates, [], new Set());
    if (!candidates.length) {
        return [];
    }

    const preferred = preferredKeys.map((key) => key.toLowerCase());
    candidates.sort((left, right) => scoreTrackCollection(right, preferred) - scoreTrackCollection(left, preferred));
    return candidates[0]?.tracks || [];
}

function collectTrackCollections(source, results, pathParts, visited) {
    if (!source || typeof source !== 'object') {
        return;
    }

    if (visited.has(source)) {
        return;
    }
    visited.add(source);

    if (Array.isArray(source)) {
        const normalizedTracks = source.map((entry) => normalizeTrackEntry(entry)).filter(isTrackLike);
        if (normalizedTracks.length > 0 && normalizedTracks.length >= Math.ceil(source.length / 2)) {
            results.push({
                path: pathParts.join('.'),
                tracks: source,
                normalizedTracks,
            });
        }

        source.forEach((entry, index) => {
            collectTrackCollections(entry, results, [...pathParts, String(index)], visited);
        });
        return;
    }

    for (const [key, value] of Object.entries(source)) {
        collectTrackCollections(value, results, [...pathParts, key], visited);
    }
}

function scoreTrackCollection(candidate, preferredKeys) {
    const pathText = candidate.path.toLowerCase();
    let score = candidate.normalizedTracks.length * 10;

    preferredKeys.forEach((key, index) => {
        if (pathText.includes(key)) {
            score += 100 - index * 10;
        }
    });

    if (/popular|top/i.test(pathText)) {
        score += 40;
    }
    if (/album/i.test(pathText)) {
        score += 20;
    }
    if (/video|artist.*album|similar/i.test(pathText)) {
        score -= 40;
    }

    return score;
}

function normalizeTrackEntry(entry, albumFallback = null) {
    const track = entry?.item || entry?.track || entry;
    if (!track || typeof track !== 'object') {
        return track;
    }

    return {
        ...track,
        album: {
            ...(albumFallback || {}),
            ...(track.album || {}),
        },
    };
}

function isTrackLike(value) {
    return Boolean(
        value &&
            typeof value === 'object' &&
            value.id != null &&
            !Array.isArray(value.tracks) &&
            !('numberOfTracks' in value) &&
            !('numberOfVolumes' in value) &&
            (value.title || value.name) &&
            (value.artist || value.artists) &&
            (
                value.duration != null ||
                value.trackNumber != null ||
                value.volumeNumber != null ||
                value.discNumber != null ||
                value.isrc != null ||
                value.audioQuality != null ||
                value.album != null
            )
    );
}

function isAlbumLike(value) {
    return Boolean(
        value &&
            typeof value === 'object' &&
            value.id != null &&
            (value.title || value.name) &&
            ('numberOfTracks' in value || 'numberOfVolumes' in value || 'cover' in value || Array.isArray(value.tracks))
    );
}

function isArtistLike(value) {
    return Boolean(value && typeof value === 'object' && value.id != null && typeof (value.name || value.title) === 'string');
}

function artistMatchesTrack(track, artist) {
    const artistId = String(artist?.id || '');
    if (!artistId) {
        return true;
    }

    if (String(track?.artist?.id || '') === artistId) {
        return true;
    }

    return Array.isArray(track?.artists) && track.artists.some((entry) => String(entry?.id || '') === artistId);
}

function scoreTrackMatch(item, trackName, artistName, albumName, isrc) {
    let score = 0;
    const normalizedTrack = normalizeLoose(trackName);
    const normalizedArtist = normalizeLoose(artistName);
    const normalizedAlbum = normalizeLoose(albumName);
    const itemTrack = normalizeLoose(getTrackTitle(item));
    const itemArtist = normalizeLoose(getTrackArtists(item));
    const itemAlbum = normalizeLoose(item.album?.title || '');

    if (isrc && item.isrc && String(item.isrc).toUpperCase() === String(isrc).toUpperCase()) {
        score += 1000;
    }
    if (itemTrack === normalizedTrack) {
        score += 100;
    } else if (itemTrack.includes(normalizedTrack) || normalizedTrack.includes(itemTrack)) {
        score += 50;
    }
    if (normalizedArtist && itemArtist.includes(normalizedArtist)) {
        score += 35;
    }
    if (normalizedAlbum && itemAlbum && (itemAlbum === normalizedAlbum || itemAlbum.includes(normalizedAlbum))) {
        score += 15;
    }
    return score;
}

function normalizeLoose(value) {
    return (value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .trim();
}

function detectExtension(buffer, contentType = '') {
    const normalizedContentType = String(contentType || '').toLowerCase();

    if (normalizedContentType.includes('flac')) {
        return 'flac';
    }
    if (buffer.length >= 4 && buffer[0] === 0x66 && buffer[1] === 0x4c && buffer[2] === 0x61 && buffer[3] === 0x43) {
        return 'flac';
    }
    if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
        return normalizedContentType.includes('video') ? 'mp4' : 'm4a';
    }
    if (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
        return 'mp3';
    }
    if (normalizedContentType.includes('mpeg')) {
        return 'mp3';
    }
    if (normalizedContentType.includes('mp4')) {
        return 'm4a';
    }
    return 'flac';
}

async function embedMetadataWithFfmpeg({ audioPath, track, lyrics, coverBuffer, genres, releaseType, mbId, rgId, bpm, country, labels, barcode, catalogNumber, date, dateSource }) {
    const parsedPath = path.parse(audioPath);
    const isMp4Family = ['.m4a', '.mp4'].includes(parsedPath.ext.toLowerCase());
    const tempOutput = path.join(parsedPath.dir, `${parsedPath.name}.tagged${isMp4Family ? '.mp4' : parsedPath.ext}`);
    const tempDir = await fs.mkdtemp(path.join(parsedPath.dir, '.meta-'));
    const cleanupPaths = [tempOutput];

    try {
        const metadataArgs = buildMetadataArgs(track, lyrics, genres, releaseType, mbId, rgId, bpm, { country, labels, barcode, catalogNumber, date, dateSource });
        const args = ['-y', '-i', audioPath];
        const shouldAttachCover = Boolean(coverBuffer) && !isMp4Family;

        if (shouldAttachCover) {
            const coverExt = detectImageExtension(coverBuffer);
            const coverPath = path.join(tempDir, `cover.${coverExt}`);
            await fs.writeFile(coverPath, coverBuffer);
            cleanupPaths.push(coverPath);
            args.push('-i', coverPath);
        }

        args.push('-map', '0:a');

        if (shouldAttachCover) {
            args.push('-map', '1');
        }

        args.push('-map_metadata', '-1', '-c:a', 'copy');

        if (isMp4Family) {
            args.push('-f', 'mp4');
        }

        if (shouldAttachCover) {
            args.push('-c:v', 'copy', '-disposition:v:0', 'attached_pic');
        }

        args.push(...metadataArgs, tempOutput);

        await runCommand('ffmpeg', args);
        await fs.rename(tempOutput, audioPath);
    } finally {
        for (const file of cleanupPaths.slice(1)) {
            await fs.rm(file, { force: true }).catch(() => {});
        }
        await fs.rm(tempOutput, { force: true }).catch(() => {});
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

function buildMetadataArgs(track, lyrics, genres = [], releaseType = null, mbId = null, rgId = null, bpm = null, extra = {}) {
    const metadata = new Map();
    const albumArtist = getAlbumArtist(track);
    const trackArtists = getTrackArtists(track);
    const trackNumber = formatNumberPair(track?.trackNumber, track?.album?.numberOfTracksOnDisc || track?.album?.numberOfTracks);
    const discNumber = formatNumberPair(track?.volumeNumber || track?.discNumber, track?.album?.totalDiscs);

    metadata.set('title', getTrackTitle(track));
    metadata.set('artist', trackArtists);
    metadata.set('album', track?.album?.title || '');
    metadata.set('album_artist', albumArtist || '');
    metadata.set('albumartist', albumArtist || '');
    metadata.set('track', trackNumber);
    metadata.set('tracknumber', trackNumber);
    metadata.set('disc', discNumber);
    metadata.set('discnumber', discNumber);
    const tidalDate = normalizeReleaseDate(track?.album?.releaseDate || track?.streamStartDate);
    const effectiveDate = extra.dateSource === 'musicbrainz' && extra.date ? normalizeReleaseDate(extra.date) : tidalDate;
    metadata.set('date', effectiveDate || '');
    metadata.set('isrc', track?.isrc || '');
    metadata.set('copyright', track?.copyright || '');
    metadata.set('lyrics', lyrics || '');
    if (Array.isArray(genres) && genres.length > 0) {
        for (const g of genres) {
            const normalized = sanitizeMetadataValue(g);
            if (normalized) {
                metadata.set('genre', normalized);
            }
        }
    }
    if (bpm) {
        metadata.set('bpm', bpm);
    }
    if (releaseType) {
        metadata.set('releasetype', releaseType);
    }
    if (mbId) {
        metadata.set('musicbrainz_albumid', mbId);
    }
    if (rgId) {
        metadata.set('musicbrainz_releasegroupid', rgId);
    }
    if (track?.album?.artist?.id) {
        metadata.set('musicbrainz_artistid', String(track.album.artist.id));
    }
    if (extra.country) {
        metadata.set('country', sanitizeMetadataValue(extra.country));
    }
    if (Array.isArray(extra.labels) && extra.labels.length) {
        for (const label of extra.labels) {
            const normalized = sanitizeMetadataValue(label);
            if (normalized) {
                metadata.set('label', normalized);
            }
        }
    }
    if (extra.barcode) {
        metadata.set('barcode', sanitizeMetadataValue(extra.barcode));
    }
    if (extra.catalogNumber) {
        metadata.set('catalognumber', sanitizeMetadataValue(extra.catalogNumber));
    }
    metadata.set('comment', buildComment(track));

    const args = [];
    for (const [key, value] of metadata.entries()) {
        if (value) {
            args.push('-metadata', `${key}=${sanitizeMetadataValue(value)}`);
        }
    }

    return args;
}

function formatNumberPair(number, total) {
    if (!number) {
        return '';
    }
    return total ? `${number}/${total}` : String(number);
}

function normalizeReleaseDate(value) {
    if (!value) {
        return '';
    }
    return String(value).split('T')[0];
}

function buildComment(track) {
    const payload = {
        tidalTrackId: track?.id || null,
        tidalAlbumId: track?.album?.id || null,
        audioQuality: track?.audioQuality || null,
        explicit: Boolean(track?.explicit),
        musicbrainz: {
            albumId: track?.album?.id || null,
            artistId: track?.album?.artist?.id || null,
        },
        tags: {
            genres: track?.album?.genres || [],
            styles: track?.album?.styles || [],
            releaseType: track?.album?.releaseType || null,
            country: track?.album?.country || null,
            label: track?.album?.label || null,
            barcode: track?.album?.barcode || null,
            catalogNumber: track?.album?.catalogNumber || null,
        },
    };
    return JSON.stringify(payload);
}

function sanitizeMetadataValue(value) {
    return String(value)
        .normalize('NFKC')
        .replace(/\0/gu, '')
        .replace(/[\u0001-\u001f\u007f-\u009f]/gu, ' ')
        .replace(/\p{Cf}+/gu, '')
        .replace(/\s+/gu, ' ')
        .trim();
}

function detectImageExtension(buffer) {
    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return 'png';
    }
    return 'jpg';
}

async function fetchLyrics(track, provider = 'lrclib', options = {}) {
    const { syncedOnly = false, noArtist = false } = options;
    const title = track?.title;
    const artist = noArtist ? '' : getTrackArtists(track);
    const album = track?.album?.title;
    const duration = track?.duration ? Math.round(track.duration) : null;

    if (!title || (!noArtist && !artist)) {
        // Try album-level lyrics as fallback
        if (track?.album?.title && track?.album?.artist) {
            return fetchAlbumLyrics(track.album, provider);
        }
        return null;
    }

    if (provider === 'lrclib') {
        return await fetchLyricsFromLrclib(title, artist, album, duration, syncedOnly);
    } else if (provider === 'genius') {
        return await fetchLyricsFromGenius(title, artist);
    }
    return null;
}

async function fetchAlbumLyrics(album, provider) {
    const title = album?.title;
    const artist = getAlbumArtist({ album });
    if (!title || !artist) return null;
    
    if (provider === 'lrclib') {
        const lyrics = await fetchLyricsFromLrclib('', artist, title, null, true);
        if (lyrics) return lyrics;
    }
    return null;
}

async function fetchLyricsFromLrclib(title, artist, album, duration, isAlbum = false) {
    const params = new URLSearchParams();
    if (isAlbum) {
        params.set('album_name', album || '');
        params.set('artist_name', artist || '');
    } else {
        params.set('track_name', title || '');
        params.set('artist_name', artist || '');
        if (album) {
            params.set('album_name', album);
        }
        if (duration) {
            params.set('duration', String(duration));
        }
    }

    try {
        const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
        if (!response.ok) return null;

        const json = await response.json();
        if (!json?.syncedLyrics) return null;

        return [
            `[ti:${isAlbum ? album || 'Unknown' : title}]`,
            `[ar:${artist}]`,
            `[al:${album || 'Unknown Album'}]`,
            `[by:LRCLIB]`,
            '',
            json.syncedLyrics,
        ].join('\n');
    } catch {
        return null;
    }
}

async function fetchLyricsFromGenius(title, artist) {
    // Would need API key - skip for now
    return null;
}

async function writeCollectionArtifacts(rootDir, source, tracks, failures) {
    const sourceName = sanitizeForFilename(source.title);
    const m3u = generateM3U(source.metadata, tracks);
    const m3u8 = generateM3U8(source.metadata, tracks);
    const cue = generateCUE(source.metadata, tracks);
    const nfo = generateNFO(source.metadata, tracks, source.type === 'album' ? 'album' : 'playlist');
    const json = generateJSON(source, tracks, failures);

    await Promise.all([
        fs.writeFile(path.join(rootDir, `${sourceName}.m3u`), m3u, 'utf8'),
        fs.writeFile(path.join(rootDir, `${sourceName}.m3u8`), m3u8, 'utf8'),
        fs.writeFile(path.join(rootDir, `${sourceName}.cue`), cue, 'utf8'),
        fs.writeFile(path.join(rootDir, `${sourceName}.nfo`), nfo, 'utf8'),
        fs.writeFile(path.join(rootDir, `${sourceName}.json`), json, 'utf8'),
    ]);
}

function generateM3U(metadata, tracks) {
    let content = '#EXTM3U\n';
    content += `#PLAYLIST:${sanitizeForFilename(metadata?.title || 'Playlist')}\n`;
    content += `#DATE:${new Date().toISOString().slice(0, 10)}\n\n`;

    for (const track of tracks) {
        content += `#EXTINF:${Math.round(track.duration || 0)},${getTrackArtists(track)} - ${getTrackTitle(track)}\n`;
        content += `${track.filePath}\n\n`;
    }
    return content;
}

function generateM3U8(metadata, tracks) {
    let content = '#EXTM3U\n';
    content += '#EXT-X-VERSION:3\n';
    content += '#EXT-X-PLAYLIST-TYPE:VOD\n';
    content += `#PLAYLIST:${sanitizeForFilename(metadata?.title || 'Playlist')}\n`;
    content += `#DATE:${new Date().toISOString().slice(0, 10)}\n\n`;

    for (const track of tracks) {
        content += `#EXTINF:${Math.round(track.duration || 0)}.000,${getTrackArtists(track)} - ${getTrackTitle(track)}\n`;
        content += `${track.filePath}\n\n`;
    }
    content += '#EXT-X-ENDLIST\n';
    return content;
}

function generateCUE(metadata, tracks) {
    let content = `PERFORMER "${escapeCue(metadata?.artist?.name || metadata?.artist || 'Various Artists')}"\n`;
    content += `TITLE "${escapeCue(metadata?.title || 'Playlist')}"\n`;

    tracks.forEach((track, index) => {
        const trackNumber = String(track.trackNumber || index + 1).padStart(2, '0');
        const extension = path.extname(track.filePath).slice(1).toUpperCase() || 'FLAC';
        content += `FILE "${track.filePath}" ${extension}\n`;
        content += `  TRACK ${trackNumber} AUDIO\n`;
        content += `    TITLE "${escapeCue(getTrackTitle(track))}"\n`;
        content += `    PERFORMER "${escapeCue(getTrackArtists(track))}"\n`;
        content += '    INDEX 01 00:00:00\n';
    });

    return content;
}

function generateNFO(metadata, tracks, type) {
    const date = new Date().toISOString();
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += type === 'album' ? '<album>\n' : '<musicplaylist>\n';
    xml += `  <title>${escapeXml(metadata?.title || 'Playlist')}</title>\n`;
    xml += `  <artist>${escapeXml(metadata?.artist?.name || metadata?.artist || 'Various Artists')}</artist>\n`;
    xml += `  <dateadded>${date}</dateadded>\n`;

    tracks.forEach((track, index) => {
        xml += '  <track>\n';
        xml += `    <position>${index + 1}</position>\n`;
        xml += `    <title>${escapeXml(getTrackTitle(track))}</title>\n`;
        xml += `    <artist>${escapeXml(getTrackArtists(track))}</artist>\n`;
        xml += `    <album>${escapeXml(track.album?.title || '')}</album>\n`;
        xml += `    <duration>${Math.round(track.duration || 0)}</duration>\n`;
        xml += `    <musicbrainztrackid>${track.id || ''}</musicbrainztrackid>\n`;
        xml += '  </track>\n';
    });

    xml += type === 'album' ? '</album>\n' : '</musicplaylist>\n';
    return xml;
}

function generateJSON(source, tracks, failures) {
    const metadata = source?.metadata || {};
    return JSON.stringify(
        {
            format: 'monochrome-collection',
            version: '1.0',
            generated: new Date().toISOString(),
            sourceType: source?.type || 'playlist',
            source: {
                title: metadata?.title || 'Playlist',
                artist: metadata?.artist?.name || metadata?.artist || metadata?.name || 'Various Artists',
                id: metadata?.id || metadata?.uuid || null,
            },
            tracks: tracks.map((track, index) => ({
                position: index + 1,
                id: track.id,
                title: getTrackTitle(track),
                artist: getTrackArtists(track),
                album: track.album?.title || null,
                albumId: track.album?.id || null,
                albumArtist: track.album?.artist?.name || null,
                trackNumber: track.trackNumber || null,
                duration: Math.round(track.duration || 0),
                isrc: track.isrc || null,
                filePath: track.filePath,
            })),
            failures,
        },
        null,
        2
    );
}

function escapeXml(value) {
    return String(value || '')
        .replace(/&/gu, '&amp;')
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;')
        .replace(/"/gu, '&quot;')
        .replace(/'/gu, '&#39;');
}

function escapeCue(value) {
    return String(value || '').replace(/"/gu, "'");
}

async function zipFolder(sourceDir, destinationZip) {
    if (process.platform !== 'win32') {
        throw new Error('ZIP creation currently uses PowerShell Compress-Archive and is only implemented for Windows.');
    }

    await fs.rm(destinationZip, { force: true }).catch(() => {});

    const sourcePath = path.resolve(sourceDir);
    const destinationPath = path.resolve(destinationZip);

    await new Promise((resolve, reject) => {
        const command = [
            '-NoProfile',
            '-Command',
            `Compress-Archive -Path '${sourcePath.replace(/'/gu, "''")}\\*' -DestinationPath '${destinationPath.replace(/'/gu, "''")}' -Force`,
        ];

        const child = spawn('powershell', command, { stdio: 'inherit' });
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`Compress-Archive failed with exit code ${code}`));
        });
        child.on('error', reject);
    });
}

async function runCommand(command, args, options = {}) {
    await new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            stdio: options.stdio || ['ignore', 'ignore', 'pipe'],
        });
        let stderr = '';

        if (child.stderr) {
            child.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });
        }

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} failed with exit code ${code}: ${stderr.trim()}`));
        });
    });
}

async function addFileToZipArchive(archivePath, rootDir, relativeFilePath) {
    if (!archivePath) {
        return;
    }

    const normalizedRelative = relativeFilePath.split(path.posix.sep).join(path.sep);
    try {
        if (process.platform === 'win32') {
            await runCommand(
                'powershell',
                [
                    '-NoProfile',
                    '-Command',
                    `Compress-Archive -Path '${path.join(rootDir, normalizedRelative).replace(/'/gu, "''")}' -Update -DestinationPath '${archivePath.replace(/'/gu, "''")}'`,
                ]
            );
        } else {
            await runCommand('zip', ['-q', '-u', archivePath, normalizedRelative], { cwd: rootDir });
        }
    } catch (error) {
        throw new Error(`ZIP update failed for ${relativeFilePath}: ${error.message}`);
    }
}

async function probeMedia(input) {
    return await new Promise((resolve, reject) => {
        const child = spawn(
            'ffprobe',
            ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', input],
            { stdio: ['ignore', 'pipe', 'pipe'] }
        );
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                try {
                    resolve(JSON.parse(stdout));
                } catch (error) {
                    reject(error);
                }
                return;
            }
            reject(new Error(`ffprobe failed with exit code ${code}: ${stderr.trim()}`));
        });
    });
}

async function detectBpmWithAubio(input) {
    const parsed = path.parse(input);
    const isFlac = parsed.ext.toLowerCase() === '.flac';
    
    if (isFlac) {
        const tempDir = await fs.mkdtemp(path.join(parsed.dir, '.bpm-'));
        const tempWav = path.join(tempDir, 'temp.wav');
        try {
            await runCommand('ffmpeg', ['-y', '-i', input, '-ar', '44100', '-ac', '1', tempWav]);
            return await runAubioTempo(tempWav);
        } catch {
            return null;
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
    }
    
    return await runAubioTempo(input);
}

async function runAubioTempo(input) {
    return await new Promise((resolve) => {
        const child = spawn(
            'aubio',
            ['tempo', input],
            { stdio: ['ignore', 'pipe', 'pipe'] }
        );
        let stdout = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.on('error', () => resolve(null));
        child.on('exit', (code) => {
            if (code === 0) {
                const match = stdout.match(/([\d.]+)\s*bpm/i);
                if (match) {
                    const bpm = parseFloat(match[1]);
                    if (!Number.isNaN(bpm) && bpm > 0) {
                        resolve(Math.round(bpm));
                    }
                }
            }
            resolve(null);
        });
    });
}

async function probeMediaBuffer(buffer, contentType = 'audio/flac') {
    const extension = detectExtension(buffer, contentType);
    const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.probe-'));
    const tempPath = path.join(tempDir, `probe.${extension}`);

    try {
        await fs.writeFile(tempPath, buffer);
        return await probeMedia(tempPath);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

async function exists(target) {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

async function findExistingAudioPath(flacPath) {
    const parsed = path.parse(flacPath);
    const candidates = [
        flacPath,
        path.join(parsed.dir, `${parsed.name}.m4a`),
        path.join(parsed.dir, `${parsed.name}.mp3`),
        path.join(parsed.dir, `${parsed.name}.mp4`),
    ];
    for (const candidate of candidates) {
        if (await exists(candidate)) {
            return candidate;
        }
    }

    return null;
}

async function readJsonIfExists(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

async function recoverDownloadedState(rootDir, source) {
    const runStatePath = path.join(rootDir, '_run-state.json');
    const collectionJsonPath = path.join(rootDir, `${sanitizeForFilename(source.title)}.json`);
    const runState = await readJsonIfExists(runStatePath);
    const collection = await readJsonIfExists(collectionJsonPath);
    const sourceTracksById = new Map(
        source.tracks
            .map((track) => [normalizeId(track?.id), track])
            .filter(([id]) => Boolean(id))
    );
    const persistedTrackRecords = new Map();

    for (const track of Array.isArray(collection?.tracks) ? collection.tracks : []) {
        const id = normalizeId(track?.id);
        if (id) {
            persistedTrackRecords.set(id, track);
        }
    }

    for (const track of Array.isArray(runState?.downloadedTracks) ? runState.downloadedTracks : []) {
        const id = normalizeId(track?.id);
        if (id) {
            persistedTrackRecords.set(id, track);
        }
    }

    const candidateIds = new Set(
        [
            ...(Array.isArray(runState?.downloadedIds) ? runState.downloadedIds : []),
            ...persistedTrackRecords.keys(),
        ]
            .map((id) => normalizeId(id))
            .filter(Boolean)
    );

    const downloaded = [];
    const downloadedIds = new Set(candidateIds);

    for (const id of candidateIds) {
        const sourceTrack = sourceTracksById.get(id);
        const persistedTrack = persistedTrackRecords.get(id);
        const relativeFilePath = String(persistedTrack?.filePath || '').trim();
        if (!sourceTrack || !relativeFilePath) {
            continue;
        }

        downloaded.push({
            ...sourceTrack,
            album: sourceTrack?.album || (persistedTrack?.album || persistedTrack?.albumId || persistedTrack?.albumArtist
                ? {
                      id: persistedTrack?.albumId || null,
                      title: persistedTrack?.album || null,
                      artist: persistedTrack?.albumArtist ? { id: null, name: persistedTrack.albumArtist } : null,
                  }
                : undefined),
            duration: sourceTrack?.duration ?? persistedTrack?.duration ?? null,
            trackNumber: sourceTrack?.trackNumber ?? persistedTrack?.trackNumber ?? null,
            isrc: sourceTrack?.isrc ?? persistedTrack?.isrc ?? null,
            filePath: relativeFilePath,
        });
    }

    const failures = (Array.isArray(runState?.failures) ? runState.failures : []).filter(
        (failure) => !downloadedIds.has(normalizeId(failure?.id))
    );

    return {
        downloaded,
        downloadedIds,
        failures,
    };
}

function upsertFailure(failures, failure) {
    const id = normalizeId(failure?.id);
    if (!id) {
        failures.push(failure);
        return;
    }

    const existingIndex = failures.findIndex((entry) => normalizeId(entry?.id) === id);
    if (existingIndex >= 0) {
        failures[existingIndex] = failure;
        return;
    }

    failures.push(failure);
}

function removeFailureByTrackId(failures, trackId) {
    const id = normalizeId(trackId);
    if (!id) {
        return;
    }

    const index = failures.findIndex((entry) => normalizeId(entry?.id) === id);
    if (index >= 0) {
        failures.splice(index, 1);
    }
}

function normalizeEquivalentPathSegment(value) {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f-\u009f]/gu, '')
        .replace(/\p{Cf}+/gu, '')
        .replace(/\s+/gu, ' ')
        .trim()
        .replace(/[. ]+$/gu, '')
        .toLowerCase();
}

async function resolvePreferredDirectory(parentDir, preferredName) {
    const normalizedPreferred = normalizeEquivalentPathSegment(preferredName);

    try {
        const entries = await fs.readdir(parentDir, { withFileTypes: true });
        const existing = entries.find(
            (entry) => entry.isDirectory() && normalizeEquivalentPathSegment(entry.name) === normalizedPreferred
        );
        if (existing) {
            return path.join(parentDir, existing.name);
        }
    } catch {
        // Parent may not exist yet; fall back to creating the preferred path.
    }

    const target = path.join(parentDir, preferredName);
    await fs.mkdir(target, { recursive: true });
    return target;
}

class MonochromeClient {
    constructor({ apiBase, apiInstances, quality, cache, authStore, authUsername, authLoginKey, authPassword }) {
        this.apiBase = apiBase;
        this.apiInstances = apiInstances;
        this.quality = quality;
        this.cache = cache;
        this.authStore = authStore;
        this.authUsername = authUsername;
        this.authLoginKey = authLoginKey;
        this.authPassword = authPassword;
        this.instanceCooldownMs = Number(process.env.MONOCHROME_INSTANCE_COOLDOWN_MS || DEFAULT_INSTANCE_RATE_LIMIT_COOLDOWN_MS);
        this.instanceEndpointCooldowns = new Map();
        this.instanceAuthRequirements = new Map();
        this.instanceValidatedTokens = new Map();
        this.instanceProfiles = new Map();
        this.tidalToken = null;
        this.tidalTokenExpiry = 0;
    }

    async request(relativePath, { type = 'api', raw = false } = {}) {
        const endpointKey = this.getEndpointKey(relativePath);
        let lastError = null;

        for (let pass = 0; pass < 2; pass += 1) {
            const instances = await this.getApiBasesForEndpoint(endpointKey);

            for (const base of instances) {
                const url = `${base.replace(/\/$/u, '')}${relativePath}`;
                try {
                    return await this.requestAgainstBase(base, relativePath, { type, raw });
                } catch (error) {
                    console.log(`[request:${type}] failed: ${error instanceof Error ? error.message : String(error)}`);
                    lastError = error;
                }
            }
        }

        throw lastError || new Error(`All ${type} instances failed for ${relativePath}`);
    }

    async searchTrack(trackName, artistName, albumName, isrc) {
        const cacheKey = JSON.stringify({
            trackName: trackName || '',
            artistName: artistName || '',
            albumName: albumName || '',
            isrc: isrc || '',
        });
        const cached = this.cache.get('searchTrack', cacheKey);
        if (cached) {
            console.log(`  -> cache hit: searchTrack`);
            return cached;
        }

        if (isrc) {
            console.log(`  -> searching by ISRC: ${isrc}`);
            const byIsrc = await this.request(`/search/?s=${encodeURIComponent(`isrc:${isrc}`)}`);
            const matches = normalizeSearchResponse(byIsrc.data || byIsrc, 'tracks').items;
            const exact = matches.find((item) => item.isrc && String(item.isrc).toUpperCase() === String(isrc).toUpperCase());
            if (exact) {
                this.cache.set('searchTrack', cacheKey, exact);
                return exact;
            }
        }

        const query = `"${trackName}" ${artistName}`.trim();
        console.log(`  -> searching by query: ${query}`);
        const result = await this.request(`/search/?s=${encodeURIComponent(query)}`);
        const items = normalizeSearchResponse(result.data || result, 'tracks').items;
        if (!items.length) {
            console.log('  -> API returned 0 candidates');
            return null;
        }

        console.log(`  -> API candidates: ${items.length}`);

        const ranked = [...items].sort(
            (left, right) =>
                scoreTrackMatch(right, trackName, artistName, albumName, isrc) -
                scoreTrackMatch(left, trackName, artistName, albumName, isrc)
        );
        const winner = ranked[0] || null;
        if (winner) {
            console.log(
                `  -> selected candidate: id=${winner.id} title="${getTrackTitle(winner)}" artist="${getTrackArtists(winner)}"`
            );
            this.cache.set('searchTrack', cacheKey, winner);
        }
        return winner;
    }

    async getPlaylist(id) {
        const cached = this.cache.get('playlists', String(id));
        if (cached) {
            console.log(`Playlist cache hit: ${id}`);
            return cached;
        }

        const payload = await this.request(`/playlist/?id=${encodeURIComponent(id)}`);
        const data = payload.data || payload;

        let playlist = data.playlist || null;
        let items = data.items || null;

        if (!playlist || !items) {
            const entries = Array.isArray(data) ? data : [data];
            for (const entry of entries) {
                if (!playlist && entry && typeof entry === 'object' && ('uuid' in entry || 'numberOfTracks' in entry)) {
                    playlist = entry;
                }
                if (!items && Array.isArray(entry?.items)) {
                    items = entry.items;
                }
            }
        }

        if (!playlist) {
            throw new Error(`Playlist ${id} not found`);
        }

        const tracks = (items || []).map((entry) => entry.item || entry);
        const result = { playlist, tracks };
        this.cache.set('playlists', String(id), result);
        return result;
    }

    async getAlbum(id) {
        const cached = this.cache.get('albums', String(id));
        if (cached) {
            console.log(`Album cache hit: ${id}`);
            return cached;
        }

        const payload = await this.request(`/album/?id=${encodeURIComponent(id)}`);
        const result = extractAlbumPayload(payload.data || payload, id);
        this.cache.set('albums', String(id), result);
        this.cache.set('albumContents', String(id), {
            album: compactTrackForAlbumContents({ album: result.album }).album,
            tracks: result.tracks.map((track) => compactTrackForAlbumContents(track, result.album)),
        });
        return result;
    }

    async getAlbumContents(id) {
        const cached = this.cache.get('albumContents', String(id));
        if (cached) {
            console.log(`Album contents cache hit: ${id}`);
            return cached;
        }

        const album = await this.getAlbum(id);
        const compact = {
            album: compactTrackForAlbumContents({ album: album.album }).album,
            tracks: album.tracks.map((track) => compactTrackForAlbumContents(track, album.album)),
        };
        this.cache.set('albumContents', String(id), compact);
        return compact;
    }

    async getArtistTracks(id) {
        const cached = this.cache.get('artists', String(id));
        if (cached) {
            console.log(`Artist cache hit: ${id}`);
            return cached;
        }

        const payload = await this.request(`/artist/?f=${encodeURIComponent(id)}`);
        const result = extractArtistPayload(payload.data || payload, id);
        this.cache.set('artists', String(id), result);
        return result;
    }

    async getTrackMetadata(id) {
        const cached = this.cache.get('trackMetadata', String(id));
        if (cached) {
            console.log(`  -> metadata cache hit: ${id}`);
            return cached;
        }

        console.log(`  -> metadata fetch: ${id}`);
        const payload = await this.request(`/info/?id=${encodeURIComponent(id)}`);
        const data = payload.data || payload;
        const list = Array.isArray(data) ? data : [data];
        const match = list.find((item) => item?.id == id || item?.item?.id == id);
        if (!match) {
            throw new Error(`Track metadata not found for ${id}`);
        }
        const result = match.item || match;
        this.cache.set('trackMetadata', String(id), result);
        return result;
    }

    async fetchCover(coverId) {
        const cached = this.cache.get('covers', String(coverId));
        if (cached) {
            console.log(`  -> cover cache hit: ${coverId}`);
            return Buffer.from(cached, 'base64');
        }

        const url = this.getCoverUrl(coverId, '1280');
        console.log(`  -> cover fetch: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        this.cache.set('covers', String(coverId), buffer.toString('base64'));
        return buffer;
    }

    getCoverUrl(id, size = '1280') {
        if (!id) {
            return null;
        }
        if (String(id).startsWith('http')) {
            return String(id);
        }
        const formatted = String(id).replace(/-/gu, '/');
        return `https://resources.tidal.com/images/${formatted}/${size}x${size}.jpg`;
    }

    async downloadTrackToFile(trackId, outputPath, metadata = null) {
        console.log(`  -> resolving stream: ${trackId}`);
        const stream = await this.resolveTrackStream(trackId, metadata);
        const extension = detectExtension(Buffer.alloc(0), stream.contentType);

        // Capture estimated bytes immediately after stream resolution
        if (metadata && stream.estimatedBytes) {
            metadata.estimatedBytes = stream.estimatedBytes;
        }

        if (stream.body) {
            console.log(`  -> downloading track...`);
            await streamToFile(stream, outputPath);
            const size = await fs.stat(outputPath).then((stat) => stat.size).catch(() => null);
            console.log(`  -> stream resolved: extension=.${extension} contentType=${stream.contentType} bytes=${size ?? 'unknown'}`);
            return { extension, estimatedBytes: stream.estimatedBytes };
        }

        console.log(`  -> buffering track...`);
        const buffer = await streamToBuffer(stream);
        console.log(`  -> stream resolved: extension=.${extension} contentType=${stream.contentType} bytes=${buffer.length}`);
        await fs.writeFile(outputPath, buffer);
        return { extension, estimatedBytes: stream.estimatedBytes };
    }

    async resolveTrackStream(trackId, metadata = null) {
        const diagnostics = [];

        const byManifest = await this.tryTrackManifestEndpointAcrossInstances(trackId).catch((error) => {
            diagnostics.push(error instanceof Error ? error.message : String(error));
            return null;
        });
        if (byManifest) {
            return byManifest;
        }

        const directManifest = await this.tryDirectTidalTrackManifest(trackId).catch((error) => {
            diagnostics.push(error instanceof Error ? error.message : String(error));
            return null;
        });
        if (directManifest) {
            console.log('  -> stream source: direct TIDAL trackManifests');
            try {
                return await this.downloadFromResolvedUri(directManifest, metadata);
            } catch (error) {
                diagnostics.push(error instanceof Error ? error.message : String(error));
            }
        } else {
            diagnostics.push('Direct TIDAL manifest unavailable or preview-only');
        }

        throw new Error(
            `Could not resolve stream from trackManifests${diagnostics.length ? `: ${diagnostics.join(' | ')}` : ''}`
        );
    }

    getApiBases() {
        return this.apiBase ? [this.apiBase] : this.apiInstances;
    }

    async getApiBasesForEndpoint(endpointKey) {
        while (true) {
            const now = Date.now();
            const preferred = [];
            const coolingDown = [];

            for (const base of this.getApiBases()) {
                const cooldownUntil = this.getEndpointCooldownUntil(base, endpointKey);
                if (cooldownUntil > now) {
                    coolingDown.push({ base, cooldownUntil });
                } else {
                    preferred.push(base);
                }
            }

            coolingDown.sort((left, right) => left.cooldownUntil - right.cooldownUntil);

            if (coolingDown.length) {
                const suffix = coolingDown
                    .map(({ base, cooldownUntil }) => `${base} (${formatRemainingSeconds(cooldownUntil)}s)`)
                    .join(', ');
                console.log(`  -> endpoint cooldown ${endpointKey}: ${suffix}`);
            }

            if (preferred.length || !coolingDown.length) {
                return [...preferred, ...coolingDown.map((entry) => entry.base)];
            }

            const nextReady = coolingDown[0];
            const waitMs = Math.max(250, nextReady.cooldownUntil - Date.now());
            console.log(
                `  -> endpoint cooldown wait: base=${nextReady.base} endpoint=${endpointKey} remaining=${formatRemainingSeconds(nextReady.cooldownUntil)}s`
            );
            await sleep(waitMs);
        }
    }

    getEndpointKey(relativePath) {
        const match = String(relativePath).match(/^\/([^/?#]+)/u);
        return match ? `/${match[1].toLowerCase()}` : '/';
    }

    getEndpointCooldownUntil(base, endpointKey) {
        return this.instanceEndpointCooldowns.get(`${String(base)}::${endpointKey}`) || 0;
    }

    noteEndpointResponse(base, endpointKey, status, headers = null) {
        const mapKey = `${String(base)}::${endpointKey}`;

        if (status === 429) {
            const retryAfterMs = parseRetryAfterMs(headers?.get?.('retry-after'));
            const cooldownUntil = Date.now() + (retryAfterMs ?? this.instanceCooldownMs);
            this.instanceEndpointCooldowns.set(mapKey, cooldownUntil);
            console.log(
                `  -> endpoint cooldown set: base=${base} endpoint=${endpointKey} ttl=${formatRemainingSeconds(cooldownUntil)}s`
            );
            return;
        }

        if (status >= 200 && status < 300) {
            if (this.instanceEndpointCooldowns.delete(mapKey)) {
                console.log(`  -> endpoint cooldown cleared: base=${base} endpoint=${endpointKey}`);
            }
        }
    }

    async fetchDirectTidalToken(force = false) {
        if (!force && this.tidalToken && Date.now() < this.tidalTokenExpiry) {
            return this.tidalToken;
        }

        const params = new URLSearchParams({
            client_id: TIDAL_BROWSER_CLIENT_ID,
            client_secret: TIDAL_BROWSER_CLIENT_SECRET,
            grant_type: 'client_credentials',
        });

        const response = await fetch('https://auth.tidal.com/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${TIDAL_BROWSER_CLIENT_ID}:${TIDAL_BROWSER_CLIENT_SECRET}`).toString('base64')}`,
            },
            body: params,
        });

        if (!response.ok) {
            throw new Error(`Failed to obtain TIDAL app token: ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        const token = payload?.access_token;
        const expiresIn = Number(payload?.expires_in || 3600);

        if (!token) {
            throw new Error('TIDAL app token response did not include access_token');
        }

        this.tidalToken = token;
        this.tidalTokenExpiry = Date.now() + Math.max(0, expiresIn - 60) * 1000;
        return token;
    }

    async tryDirectTidalTrackManifest(trackId) {
        const params = new URLSearchParams();
        params.append('adaptive', 'true');
        params.append('manifestType', 'MPEG_DASH');
        params.append('uriScheme', 'HTTPS');
        params.append('usage', 'PLAYBACK');
        for (const format of getManifestFormatsForQuality(this.quality)) {
            params.append('formats', format);
        }

        const url = `https://openapi.tidal.com/v2/trackManifests/${encodeURIComponent(trackId)}?${params.toString()}`;
        let token = await this.fetchDirectTidalToken(false);

        for (let attempt = 0; attempt < 2; attempt += 1) {
            console.log(`[request:tidal] ${url}`);
            const response = await fetch(url, {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            });

            if (response.status === 401 && attempt === 0) {
                token = await this.fetchDirectTidalToken(true);
                continue;
            }

            if (!response.ok) {
                throw new Error(`Direct TIDAL trackManifests failed: ${response.status} ${response.statusText}`);
            }

            const payload = await response.json();
            const attributes = payload?.data?.attributes || payload?.data?.data?.attributes || null;
            const uri = attributes?.uri || null;
            const trackPresentation = attributes?.trackPresentation || 'unknown';
            const previewReason = attributes?.previewReason || null;

            console.log(
                `  -> direct TIDAL manifest: presentation=${trackPresentation}${previewReason ? ` previewReason=${previewReason}` : ''} uri=${uri ? 'present' : 'missing'}`
            );

            if (String(trackPresentation).toUpperCase() === 'PREVIEW') {
                console.log('  -> skipping direct TIDAL manifest because it is preview-only');
                return null;
            }

            if (!uri) {
                throw new Error('Direct TIDAL trackManifests response did not include uri');
            }

            return uri;
        }

        return null;
    }

    async tryTrackManifestEndpoint(trackId) {
        const params = new URLSearchParams();
        for (const format of getManifestFormatsForQuality(this.quality)) {
            params.append('formats', format);
        }
        params.append('adaptive', 'true');
        params.append('manifestType', 'MPEG_DASH');
        params.append('uriScheme', 'HTTPS');
        params.append('usage', 'PLAYBACK');

        const payload = await this.request(`/trackManifests/?id=${encodeURIComponent(trackId)}&${params.toString()}`);
        const uri = payload?.data?.data?.attributes?.uri || null;
        console.log(`  -> trackManifests uri: ${uri ? 'present' : 'missing'}`);
        return uri;
    }

    async tryTrackManifestEndpointAcrossInstances(trackId) {
        const bases = await this.getApiBasesForEndpoint('/trackmanifests');
        let lastError = null;

        for (const base of bases) {
            try {
                const params = new URLSearchParams();
                for (const format of getManifestFormatsForQuality(this.quality)) {
                    params.append('formats', format);
                }
                params.append('adaptive', 'true');
                params.append('manifestType', 'MPEG_DASH');
                params.append('uriScheme', 'HTTPS');
                params.append('usage', 'PLAYBACK');

                const payload = await this.requestAgainstBase(
                    base,
                    `/trackManifests/?id=${encodeURIComponent(trackId)}&${params.toString()}`
                );
                const attributes = payload?.data?.data?.attributes || null;
                const uri = attributes?.uri || null;
                const trackPresentation = attributes?.trackPresentation || 'unknown';
                const previewReason = attributes?.previewReason || null;
                console.log(
                    `  -> trackManifests (${base}): presentation=${trackPresentation}${previewReason ? ` previewReason=${previewReason}` : ''} uri=${uri ? 'present' : 'missing'}`
                );

                if (String(trackPresentation).toUpperCase() === 'PREVIEW') {
                    lastError = new Error(
                        `Preview-only trackManifests response on ${base}${previewReason ? `: ${previewReason}` : ''}`
                    );
                    console.log('  -> trackManifests candidate rejected, trying next instance');
                    continue;
                }

                if (!uri) {
                    continue;
                }

                console.log('  -> stream source: trackManifests endpoint fallback');
                return await this.downloadFromResolvedUri(uri);
            } catch (error) {
                lastError = error;
                console.log(
                    `  -> trackManifests failed on ${base}: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        if (lastError) {
            console.log(
                `  -> trackManifests path unavailable: ${lastError instanceof Error ? lastError.message : String(lastError)}`
            );
            throw lastError;
        }
        throw new Error('trackManifests path unavailable');
    }

    async requestAgainstBase(base, relativePath, { type = 'api', raw = false } = {}) {
        const endpointKey = this.getEndpointKey(relativePath);
        const normalizedBase = normalizeApiBase(base);
        const resolvedPath = await this.resolveRelativePathForBase(normalizedBase, relativePath);
        const url = `${normalizedBase}${resolvedPath}`;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            console.log(`[request:${type}] ${url}`);
            const headers = await this.getRequestHeaders(normalizedBase, { forceRefresh: attempt > 0 });
            const response = await fetch(url, {
                headers,
            });

            if (response.status === 401 && attempt === 0) {
                this.instanceAuthRequirements.set(normalizedBase, true);
                this.clearStoredSession(normalizedBase);
                continue;
            }

            if (!response.ok) {
                console.log(`[request:${type}] ${response.status} ${response.statusText}`);
                this.noteEndpointResponse(normalizedBase, endpointKey, response.status, response.headers);
                throw new Error(`${response.status} ${response.statusText} for ${url}`);
            }

            this.noteEndpointResponse(normalizedBase, endpointKey, response.status, response.headers);
            console.log(`[request:${type}] ok`);
            return raw ? response : await response.json();
        }

        throw new Error(`401 Unauthorized for ${url}`);
    }

    async isAcceptableResolvedStream(stream) {
        const buffer = await streamToBuffer(stream);
        const contentType = String(stream?.contentType || '').toLowerCase();

        if (contentType.includes('flac') && buffer.length >= 8 * 1024 * 1024) {
            return true;
        }

        const probe = await probeMediaBuffer(buffer, contentType).catch(() => null);
        const duration = Number(probe?.format?.duration || 0);
        if (duration >= 60) {
            return true;
        }

        return false;
    }

    async getRequestHeaders(base, { forceRefresh = false } = {}) {
        const auth = await this.getAuthorization(base, { forceRefresh });
        if (!auth) {
            return {};
        }
        return {
            authorization: auth,
        };
    }

    async getAuthorization(base, { forceRefresh = false } = {}) {
        const normalizedBase = normalizeApiBase(base);
        const profile = await this.getInstanceProfile(normalizedBase);
        const authRequired = profile.authRequired;
        if (!authRequired) {
            return null;
        }

        if (profile.authMode === 'basic') {
            const credentials = await this.resolveCredentials(normalizedBase, profile);
            if (!credentials?.username || !credentials?.password) {
                throw new Error(
                    `Legacy Basic auth required for ${normalizedBase}. Provide --auth-username and --auth-password, set MONOCHROME_AUTH_USERNAME and MONOCHROME_AUTH_PASSWORD, or run once in an interactive terminal to save credentials.`
                );
            }
            this.authStore?.set(normalizedBase, {
                ...this.authStore?.get(normalizedBase),
                username: credentials.username,
                password: credentials.password,
                authType: 'basic',
            });
            this.authStore?.save().catch(() => {});
            return `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
        }

        const stored = this.authStore?.get(normalizedBase) || null;
        if (!forceRefresh && stored?.sessionToken && !this.isSessionExpired(stored)) {
            const validatedToken = this.instanceValidatedTokens.get(normalizedBase);
            if (validatedToken === stored.sessionToken) {
                return `Bearer ${stored.sessionToken}`;
            }
            const valid = await this.validateSession(normalizedBase, stored.sessionToken);
            if (valid) {
                this.instanceValidatedTokens.set(normalizedBase, stored.sessionToken);
                return `Bearer ${stored.sessionToken}`;
            }
            this.clearStoredSession(normalizedBase);
        }

        const credentials = await this.resolveCredentials(normalizedBase, profile);
        if (!credentials) {
            throw new Error(
                `Authentication required for ${normalizedBase}. Provide --auth-username and --auth-login-key, set MONOCHROME_AUTH_USERNAME and MONOCHROME_AUTH_LOGIN_KEY, or run once in an interactive terminal to save credentials.`
            );
        }

        const sessionToken = await this.loginAgainstBase(normalizedBase, credentials);
        return `Bearer ${sessionToken}`;
    }

    async isAuthRequired(base) {
        const profile = await this.getInstanceProfile(base);
        return profile.authRequired;
    }

    async validateSession(base, sessionToken) {
        try {
            const response = await fetch(`${normalizeApiBase(base)}/auth/me`, {
                headers: {
                    authorization: `Bearer ${sessionToken}`,
                },
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    isSessionExpired(record) {
        const expiresAt = Date.parse(record?.expiresAt || '');
        if (!Number.isFinite(expiresAt)) {
            return false;
        }
        return expiresAt <= Date.now() + 60 * 1000;
    }

    clearStoredSession(base) {
        const normalizedBase = normalizeApiBase(base);
        this.instanceValidatedTokens.delete(normalizedBase);
        this.authStore?.clearSession(normalizedBase);
        this.authStore?.save().catch(() => {});
    }

    async getInstanceProfile(base) {
        const normalizedBase = normalizeApiBase(base);
        if (this.instanceProfiles.has(normalizedBase)) {
            return this.instanceProfiles.get(normalizedBase);
        }

        let payload = null;
        try {
            const response = await fetch(`${normalizedBase}/`);
            if (response.ok) {
                payload = await response.json().catch(() => null);
            }
        } catch {}

        const pyEnabled = Boolean(payload?.py?.enabled);
        const authRequired = Boolean(payload?.auth?.required);
        const authMode = authRequired ? (pyEnabled ? 'bearer' : 'basic') : 'none';
        const profile = {
            pyEnabled,
            authRequired,
            authMode,
            payload,
        };

        this.instanceProfiles.set(normalizedBase, profile);
        this.instanceAuthRequirements.set(normalizedBase, authRequired);
        if (pyEnabled) {
            console.log(`  -> compatibility mode: /py enabled on ${normalizedBase}`);
        }
        if (authRequired) {
            console.log(`  -> auth required: ${normalizedBase} (${authMode})`);
        }
        return profile;
    }

    async resolveRelativePathForBase(base, relativePath) {
        const normalizedBase = normalizeApiBase(base);
        const profile = await this.getInstanceProfile(normalizedBase);
        if (!profile.pyEnabled) {
            return relativePath;
        }
        return relativePath.startsWith('/py/') ? relativePath : `/py${relativePath}`;
    }

    async resolveCredentials(base, profile = null) {
        const normalizedBase = normalizeApiBase(base);
        const resolvedProfile = profile || (await this.getInstanceProfile(normalizedBase));
        const stored = this.authStore?.get(normalizedBase) || null;
        const username = this.authUsername || stored?.username || null;
        const loginKey = this.authLoginKey || stored?.loginKey || null;
        const password = this.authPassword || stored?.password || null;

        if (resolvedProfile.authMode === 'basic' && username && password) {
            return { username, password };
        }

        if (resolvedProfile.authMode !== 'basic' && username && loginKey) {
            return { username, loginKey };
        }

        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            return null;
        }

        const dashboard = globalThis.__MONOCHROME_DASHBOARD__;
        dashboard?.suspendForPrompt?.();
        const rl = readline.createInterface({ input, output });
        try {
            console.log(`Authentication required for ${normalizedBase}`);
            if (resolvedProfile.authMode === 'basic') {
                const promptedUsername = String(await rl.question('Username: ')).trim();
                const promptedPassword = String(await rl.question('Password: ')).trim();
                if (!promptedUsername || !promptedPassword) {
                    return null;
                }
                return {
                    username: promptedUsername,
                    password: promptedPassword,
                };
            }
            const authMode = String(await rl.question('Choose auth mode ([l]ogin / [r]edeem invite): ')).trim().toLowerCase();

            if (authMode.startsWith('r')) {
                const inviteCode = String(await rl.question('Invite code: ')).trim();
                const inviteUsername = String(await rl.question('Username: ')).trim();
                if (!inviteCode || !inviteUsername) {
                    return null;
                }
                return await this.redeemInviteAgainstBase(normalizedBase, {
                    inviteCode,
                    username: inviteUsername,
                });
            }

            const promptedUsername = String(await rl.question('Username: ')).trim();
            const promptedLoginKey = String(await rl.question('Login key: ')).trim();
            if (!promptedUsername || !promptedLoginKey) {
                return null;
            }
            return {
                username: promptedUsername,
                loginKey: promptedLoginKey,
            };
        } finally {
            rl.close();
            dashboard?.resumeAfterPrompt?.();
        }
    }

    async loginAgainstBase(base, credentials) {
        const normalizedBase = normalizeApiBase(base);
        console.log(`  -> logging in: ${normalizedBase} (${credentials.username})`);
        const response = await fetch(`${normalizedBase}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: credentials.username,
                loginKey: credentials.loginKey,
            }),
        });

        if (!response.ok) {
            let detail = `${response.status} ${response.statusText}`;
            try {
                const payload = await response.json();
                if (payload?.detail) {
                    detail = `${detail} - ${payload.detail}`;
                }
            } catch {}
            throw new Error(`Authentication failed for ${normalizedBase}: ${detail}`);
        }

        const payload = await response.json();
        const sessionToken = payload?.sessionToken;
        const expiresAt = payload?.expiresAt || null;
        if (!sessionToken) {
            throw new Error(`Authentication failed for ${normalizedBase}: missing session token`);
        }

        this.authStore?.set(normalizedBase, {
            username: credentials.username,
            loginKey: credentials.loginKey,
            sessionToken,
            expiresAt,
        });
        await this.authStore?.save();
        this.instanceValidatedTokens.set(normalizedBase, sessionToken);
        return sessionToken;
    }

    async redeemInviteAgainstBase(base, invite) {
        const normalizedBase = normalizeApiBase(base);
        console.log(`  -> redeeming invite: ${normalizedBase} (${invite.username})`);
        const response = await fetch(`${normalizedBase}/auth/redeem`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inviteCode: invite.inviteCode,
                username: invite.username,
            }),
        });

        if (!response.ok) {
            let detail = `${response.status} ${response.statusText}`;
            try {
                const payload = await response.json();
                if (payload?.detail) {
                    detail = `${detail} - ${payload.detail}`;
                }
            } catch {}
            throw new Error(`Invite redemption failed for ${normalizedBase}: ${detail}`);
        }

        const payload = await response.json();
        const sessionToken = payload?.sessionToken;
        const loginKey = payload?.loginKey;
        const username = payload?.user?.username || invite.username;
        const expiresAt = payload?.expiresAt || null;
        if (!sessionToken || !loginKey || !username) {
            throw new Error(`Invite redemption failed for ${normalizedBase}: incomplete response`);
        }

        this.authStore?.set(normalizedBase, {
            username,
            loginKey,
            sessionToken,
            expiresAt,
        });
        await this.authStore?.save();
        this.instanceValidatedTokens.set(normalizedBase, sessionToken);
        return {
            username,
            loginKey,
        };
    }

    async downloadFromResolvedUri(uri, metadata = null) {
        if (typeof uri === 'object' && uri.kind === 'mpd-text') {
            console.log('  -> resolved uri kind: inline DASH manifest');
            const result = await downloadDashManifestText(uri.text);
            if (metadata && result.estimatedBytes) {
                metadata.estimatedBytes = result.estimatedBytes;
            }
            return result;
        }

        if (typeof uri !== 'string') {
            throw new Error('Unsupported stream URI');
        }

        if (uri.includes('.m3u8')) {
            console.log(`  -> resolved uri kind: HLS (${uri})`);
            return await downloadHls(uri);
        }

        if (uri.includes('.mpd')) {
            console.log(`  -> resolved uri kind: DASH URL (${uri})`);
            try {
                const manifestResponse = await fetch(uri);
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch DASH manifest: ${manifestResponse.status}`);
                }
                const manifestText = await manifestResponse.text();
                const result = await downloadDashManifestText(manifestText, uri);
                if (metadata && result.estimatedBytes) {
                    metadata.estimatedBytes = result.estimatedBytes;
                }
                return result;
            } catch (error) {
                console.log(`  -> manual DASH download failed, retrying via ffmpeg: ${error instanceof Error ? error.message : String(error)}`);
                return await downloadDashViaFfmpeg(uri);
            }
        }

        console.log(`  -> resolved uri kind: direct file (${uri})`);
        const response = await fetch(uri);
        if (!response.ok) {
            throw new Error(`Failed to fetch stream: ${response.status}`);
        }
        return {
            uri,
            body: response.body,
            contentType: response.headers.get('content-type') || 'audio/flac',
            contentLength: Number(response.headers.get('content-length') || 0),
        };
    }
}

async function downloadHls(masterUrl) {
    const masterResponse = await fetch(masterUrl);
    if (!masterResponse.ok) {
        throw new Error(`Failed to fetch HLS manifest: ${masterResponse.status}`);
    }

    const masterText = await masterResponse.text();
    const variantUrl = resolveBestHlsVariant(masterUrl, masterText);
    const playlistResponse = await fetch(variantUrl);
    if (!playlistResponse.ok) {
        throw new Error(`Failed to fetch HLS playlist: ${playlistResponse.status}`);
    }

    const playlistText = await playlistResponse.text();
    const segmentUrls = playlistText
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => new URL(line, variantUrl).href);

    const chunks = [];
    for (const segmentUrl of segmentUrls) {
        const segmentResponse = await fetch(segmentUrl);
        if (!segmentResponse.ok) {
            throw new Error(`Failed to fetch HLS segment: ${segmentResponse.status}`);
        }
        chunks.push(Buffer.from(await segmentResponse.arrayBuffer()));
    }

    return {
        buffer: Buffer.concat(chunks),
        contentType: 'audio/flac',
    };
}

function resolveBestHlsVariant(masterUrl, masterText) {
    if (!masterText.includes('#EXT-X-STREAM-INF')) {
        return masterUrl;
    }

    const lines = masterText.split(/\r?\n/u);
    const variants = [];
    let currentBandwidth = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
            const match = trimmed.match(/BANDWIDTH=(\d+)/u);
            currentBandwidth = match ? Number(match[1]) : 0;
            continue;
        }
        if (trimmed && !trimmed.startsWith('#')) {
            variants.push({
                bandwidth: currentBandwidth,
                url: new URL(trimmed, masterUrl).href,
            });
            currentBandwidth = 0;
        }
    }

    variants.sort((left, right) => right.bandwidth - left.bandwidth);
    return variants[0]?.url || masterUrl;
}

async function downloadDashViaFfmpeg(manifestUrl) {
    const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.dash-'));
    const probe = await probeMedia(manifestUrl).catch(() => null);
    const bestAudioStream = selectBestAudioStream(probe?.streams || []);
    const outputExt = inferDashOutputExtension(bestAudioStream);
    const outputPath = path.join(tempDir, `dash-output.${outputExt}`);
    const mapTarget = bestAudioStream?.index != null ? `0:${bestAudioStream.index}` : '0:a:0';

    try {
        if (bestAudioStream) {
            const variantBitrate = Number(bestAudioStream.tags?.variant_bitrate || 0);
            const bitRate = Number(bestAudioStream.bit_rate || 0);
            console.log(
                `  -> DASH stream via ffmpeg: codec=${bestAudioStream.codec_name || 'unknown'} sampleRate=${bestAudioStream.sample_rate || 'unknown'} bits=${bestAudioStream.bits_per_raw_sample || bestAudioStream.bits_per_sample || 'unknown'} bitrate=${variantBitrate || bitRate || 'unknown'}`
            );
        }

        const args = ['-y', '-i', manifestUrl, '-map', mapTarget, '-c', 'copy'];

        if (outputExt === 'flac') {
            args.push('-f', 'flac');
        } else if (outputExt === 'm4a' || outputExt === 'mp4') {
            args.push('-f', 'mp4');
        }

        args.push(outputPath);

        await runCommand('ffmpeg', args);
        const buffer = await fs.readFile(outputPath);
        return {
            buffer,
            contentType: outputExt === 'flac' ? 'audio/flac' : 'audio/mp4',
        };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

function selectBestAudioStream(streams) {
    const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
    if (!audioStreams.length) {
        return null;
    }

    const score = (stream) => {
        const variantBitrate = Number(stream.tags?.variant_bitrate || 0);
        const bitRate = Number(stream.bit_rate || 0);
        const bitsPerRawSample = Number(stream.bits_per_raw_sample || 0);
        const sampleRate = Number(stream.sample_rate || 0);
        return variantBitrate || bitRate || bitsPerRawSample * sampleRate || 0;
    };

    return [...audioStreams].sort((left, right) => score(right) - score(left))[0];
}

function inferDashOutputExtension(stream) {
    const codec = String(stream?.codec_name || '').toLowerCase();
    if (codec === 'flac') {
        return 'flac';
    }
    if (codec === 'aac' || codec === 'alac') {
        return 'm4a';
    }
    return 'm4a';
}

async function downloadDashManifestText(manifestText, manifestUrl = null) {
    const manifest = parseDashManifest(manifestText, manifestUrl);
    if (isPreviewDashManifest(manifest)) {
        throw new Error(
            `Preview DASH manifest detected: duration=${formatSeconds(manifest.durationSeconds)} baseUrl=${manifest.baseUrl || 'unknown'}`
        );
    }
    const urls = generateDashSegmentUrls(manifest);

    if (!urls.length) {
        throw new Error('No DASH segment URLs were generated');
    }

    const estimatedBytes = manifest.bandwidth && manifest.durationSeconds 
        ? Math.round((manifest.bandwidth / 8) * manifest.durationSeconds)
        : null;

    console.log(
        `  -> DASH selection: repId=${manifest.repId || 'unknown'} bandwidth=${manifest.bandwidth || 'unknown'} mimeType=${manifest.mimeType || 'unknown'} codecs=${manifest.codecs || 'unknown'} sampleRate=${manifest.audioSamplingRate || 'unknown'} segments=${Math.max(0, urls.length - 1)} duration=${formatSeconds(manifest.durationSeconds)} estimated=${estimatedBytes ? formatFileSize(estimatedBytes) : 'N/A'}${manifest.durationSeconds > 0 && manifest.durationSeconds < 60 ? ' previewLikely=yes' : ''}`
    );

    return {
        uri: manifestUrl,
        body: downloadDashManifestTextStream(manifestText, manifestUrl),
        contentType: inferDashMimeType(manifest),
        estimatedBytes,
    };
}

async function* downloadDashManifestTextStream(manifestText, manifestUrl = null) {
    const manifest = parseDashManifest(manifestText, manifestUrl);
    if (isPreviewDashManifest(manifest)) {
        throw new Error(
            `Preview DASH manifest detected: duration=${formatSeconds(manifest.durationSeconds)} baseUrl=${manifest.baseUrl || 'unknown'}`
        );
    }
    const urls = generateDashSegmentUrls(manifest);

    if (!urls.length) {
        throw new Error('No DASH segment URLs were generated');
    }

    for (let index = 0; index < urls.length; index += 1) {
        const url = urls[index];
        const response = await fetch(url);

        if (!response.ok) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const retry = await fetch(url);
            if (!retry.ok) {
                throw new Error(`Failed to fetch DASH segment ${index + 1}/${urls.length}: ${retry.status}`);
            }
            yield Buffer.from(await retry.arrayBuffer());
            continue;
        }

        yield Buffer.from(await response.arrayBuffer());
    }
}

function parseDashManifest(manifestText, manifestUrl = null) {
    const xml = decodeXmlEntities(String(manifestText || ''));
    if (!xml.includes('<MPD')) {
        throw new Error('Invalid DASH manifest');
    }

    const mpdBaseUrl = extractFirstTagText(xml, 'BaseURL') || '';
    const periodBody = extractFirstTagInner(xml, 'Period') || xml;
    const adaptationSets = extractTagBlocks(periodBody, 'AdaptationSet').map((block) => ({
        attrs: parseXmlAttributes(block.attrs),
        body: block.body,
    }));

    if (!adaptationSets.length) {
        throw new Error('No AdaptationSet found');
    }

    adaptationSets.sort((left, right) => getMaxRepresentationBandwidth(right.body) - getMaxRepresentationBandwidth(left.body));

    let audioSet =
        adaptationSets.find((set) => String(set.attrs.mimeType || '').toLowerCase().startsWith('audio')) || adaptationSets[0];

    const representations = extractTagBlocks(audioSet.body, 'Representation')
        .map((block) => ({
            attrs: parseXmlAttributes(block.attrs),
            body: block.body,
        }))
        .sort((left, right) => Number(right.attrs.bandwidth || 0) - Number(left.attrs.bandwidth || 0));

    if (!representations.length) {
        throw new Error('No Representation found');
    }

    const representation = representations[0];
    const segmentTemplateBlock =
        extractFirstTagBlock(representation.body, 'SegmentTemplate') || extractFirstTagBlock(audioSet.body, 'SegmentTemplate');

    if (!segmentTemplateBlock) {
        throw new Error('No SegmentTemplate found');
    }

    const segmentTemplateAttrs = parseXmlAttributes(segmentTemplateBlock.attrs);
    const baseUrl =
        extractFirstTagText(representation.body, 'BaseURL') ||
        extractFirstTagText(audioSet.body, 'BaseURL') ||
        extractFirstTagText(periodBody, 'BaseURL') ||
        mpdBaseUrl ||
        deriveDashBaseUrl(manifestUrl);

    const timelineBlock = extractFirstTagBlock(segmentTemplateBlock.body, 'SegmentTimeline');
    const startNumber = Number(segmentTemplateAttrs.startNumber || 1);
    const segments = [];

    if (timelineBlock) {
        let currentTime = 0;
        let currentNumber = startNumber;
        const segmentEntries = extractSelfClosingOrOpenTags(timelineBlock.body, 'S');

        for (const entry of segmentEntries) {
            const attrs = parseXmlAttributes(entry.attrs);
            const duration = Number(attrs.d || 0);
            const repeat = Number(attrs.r || 0);

            if (attrs.t != null) {
                currentTime = Number(attrs.t);
            }

            segments.push({ number: currentNumber, time: currentTime });
            currentTime += duration;
            currentNumber += 1;

            for (let index = 0; index < repeat; index += 1) {
                segments.push({ number: currentNumber, time: currentTime });
                currentTime += duration;
                currentNumber += 1;
            }
        }
    }

    return {
        baseUrl,
        initialization: segmentTemplateAttrs.initialization || null,
        media: segmentTemplateAttrs.media || null,
        segments,
        repId: representation.attrs.id || null,
        mimeType: audioSet.attrs.mimeType || representation.attrs.mimeType || null,
        bandwidth: Number(representation.attrs.bandwidth || 0),
        codecs: representation.attrs.codecs || audioSet.attrs.codecs || null,
        audioSamplingRate: representation.attrs.audioSamplingRate || null,
        durationSeconds: computeDashDurationSeconds(segments, segmentTemplateBlock.body, segmentTemplateAttrs.timescale),
    };
}

function generateDashSegmentUrls(manifest) {
    const urls = [];
    const { baseUrl, initialization, media, segments, repId } = manifest;

    const resolveTemplate = (template, number, time) =>
        template
            .replace(/\$RepresentationID\$/gu, repId || '')
            .replace(/\$Number(?:%0([0-9]+)d)?\$/gu, (_match, width) =>
                width ? String(number).padStart(Number(width), '0') : String(number)
            )
            .replace(/\$Time(?:%0([0-9]+)d)?\$/gu, (_match, width) =>
                width ? String(time).padStart(Number(width), '0') : String(time)
            );

    if (initialization) {
        urls.push(resolveDashUrl(baseUrl, resolveTemplate(initialization, 0, 0)));
    }

    if (media && segments.length) {
        for (const segment of segments) {
            urls.push(resolveDashUrl(baseUrl, resolveTemplate(media, segment.number, segment.time)));
        }
    }

    return urls;
}

function inferDashMimeType(manifest) {
    const mimeType = String(manifest?.mimeType || '').toLowerCase();
    const codecs = String(manifest?.codecs || '').toLowerCase();

    if (mimeType.includes('flac') || codecs.includes('flac')) {
        return 'audio/flac';
    }
    if (mimeType.includes('mp4') || codecs.includes('mp4a') || codecs.includes('aac') || codecs.includes('alac')) {
        return 'audio/mp4';
    }
    return 'audio/flac';
}

function resolveDashUrl(base, part) {
    if (!base) {
        return part;
    }
    if (/^https?:\/\//iu.test(part)) {
        return part;
    }
    return new URL(part, base.endsWith('/') ? base : `${base}/`).href;
}

function deriveDashBaseUrl(manifestUrl) {
    if (!manifestUrl) {
        return '';
    }
    try {
        return new URL('.', manifestUrl).href;
    } catch {
        return '';
    }
}

function decodeXmlEntities(value) {
    return String(value)
        .replace(/&amp;/gu, '&')
        .replace(/&quot;/gu, '"')
        .replace(/&apos;/gu, "'")
        .replace(/&lt;/gu, '<')
        .replace(/&gt;/gu, '>');
}

function parseXmlAttributes(attrs) {
    const result = {};
    const pattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/gu;
    let match = pattern.exec(attrs);

    while (match) {
        result[match[1]] = decodeXmlEntities(match[2]);
        match = pattern.exec(attrs);
    }

    return result;
}

function extractTagBlocks(xml, tagName) {
    const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)</${tagName}>`, 'gu');
    const blocks = [];
    let match = pattern.exec(xml);

    while (match) {
        blocks.push({ attrs: match[1] || '', body: match[2] || '' });
        match = pattern.exec(xml);
    }

    return blocks;
}

function extractFirstTagBlock(xml, tagName) {
    return extractTagBlocks(xml, tagName)[0] || null;
}

function extractFirstTagInner(xml, tagName) {
    return extractFirstTagBlock(xml, tagName)?.body || null;
}

function extractFirstTagText(xml, tagName) {
    const block = extractFirstTagBlock(xml, tagName);
    return block ? decodeXmlEntities(block.body.trim()) : null;
}

function extractSelfClosingOrOpenTags(xml, tagName) {
    const pattern = new RegExp(`<${tagName}\\b([^>/]*?)(?:/?>)`, 'gu');
    const tags = [];
    let match = pattern.exec(xml);

    while (match) {
        tags.push({ attrs: match[1] || '' });
        match = pattern.exec(xml);
    }

    return tags;
}

function getMaxRepresentationBandwidth(xml) {
    const representations = extractTagBlocks(xml, 'Representation');
    if (!representations.length) {
        return 0;
    }
    return Math.max(...representations.map((block) => Number(parseXmlAttributes(block.attrs).bandwidth || 0)));
}

function computeDashDurationSeconds(segments, segmentTimelineXml, timescaleValue) {
    const timescale = Number(timescaleValue || 1);
    if (!segments.length || !timescale) {
        return 0;
    }

    const segmentEntries = extractSelfClosingOrOpenTags(segmentTimelineXml, 'S').map((entry) => parseXmlAttributes(entry.attrs));
    let totalUnits = 0;

    for (const entry of segmentEntries) {
        const duration = Number(entry.d || 0);
        const repeat = Number(entry.r || 0);
        totalUnits += duration * (repeat + 1);
    }

    return totalUnits / timescale;
}

function formatSeconds(seconds) {
    if (!seconds || !Number.isFinite(seconds)) {
        return 'unknown';
    }
    return `${seconds.toFixed(2)}s`;
}

function isPreviewDashManifest(manifest) {
    const repId = String(manifest?.repId || '').toLowerCase();
    const likelyPreviewDuration = Number(manifest?.durationSeconds || 0) > 0 && Number(manifest.durationSeconds) <= 35;
    const likelyPreviewRep = repId.includes('preview');

    return likelyPreviewRep || likelyPreviewDuration;
}

function safeJson(value, fallback) {
    if (!value) {
        return fallback;
    }
    if (typeof value !== 'string') {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function isAsyncIterable(value) {
    return value != null && typeof value[Symbol.asyncIterator] === 'function';
}

async function streamToFile(result, outputPath) {
    const fileHandle = await fs.open(outputPath, 'w');
    try {
        if (result.body && typeof result.body.getReader === 'function') {
            const reader = result.body.getReader();
            let first = true;
            let firstChunk = null;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value) continue;
                const chunk = Buffer.from(value);
                if (first) {
                    first = false;
                    firstChunk = chunk;
                }
                await fileHandle.write(chunk);
            }
            return;
        }

        if (isAsyncIterable(result.body)) {
            for await (const chunkOrBuffer of result.body) {
                const chunk = Buffer.isBuffer(chunkOrBuffer) ? chunkOrBuffer : Buffer.from(chunkOrBuffer);
                await fileHandle.write(chunk);
            }
            return;
        }

        if (Buffer.isBuffer(result.buffer)) {
            await fileHandle.write(result.buffer);
            return;
        }

        throw new Error('Unsupported stream object for file download');
    } finally {
        await fileHandle.close();
    }
}

async function streamToBuffer(result) {
    if (Buffer.isBuffer(result?.buffer)) {
        return result.buffer;
    }
    if (result.body && typeof result.body.getReader === 'function') {
        const reader = result.body.getReader();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                chunks.push(Buffer.from(value));
            }
        }
        return Buffer.concat(chunks);
    }
    if (isAsyncIterable(result.body)) {
        const chunks = [];
        for await (const chunkOrBuffer of result.body) {
            chunks.push(Buffer.isBuffer(chunkOrBuffer) ? chunkOrBuffer : Buffer.from(chunkOrBuffer));
        }
        return Buffer.concat(chunks);
    }
    throw new Error('Expected a buffer result from stream download');
}

// Check for interactive mode before installing dashboard - must be done at module level
const __checkInteractive = (process.argv.slice(2).includes('--interactive') || process.argv.slice(2).includes('-i') || (!process.argv.slice(2).some(a => !a.startsWith('--'))));
const __helpRequested = process.argv.slice(2).some(a => ['--help', '-h', 'help'].includes(a));
const __forcePlain = process.argv.slice(2).includes('--plain') || process.argv.slice(2).includes('--no-ui');

if (!__checkInteractive && !__helpRequested && !__forcePlain) {
    installPrettyLogging();
}

async function runInteractiveMode() {
    const dashboard = globalThis.__MONOCHROME_DASHBOARD__;
    const settings = await loadSettings();
    
    while (true) {
        console.log('\nMonochrome Downloader - Interactive Mode');
        console.log('========================================');
        console.log('Enter URLs/links one per line. Empty line to finish queue.');
        console.log('Enter "quit" alone to exit.\n');
        
        const queue = await promptForQueue();
        if (queue === null) {
            console.log('\nGoodbye!');
            return;
        }
        
        for (const source of queue) {
            await runDownloadWithSource(source, settings, dashboard);
        }
    }
}

async function promptForQueue() {
    const rl = readline.createInterface({ input, output });
    try {
        const items = [];
        while (true) {
            const answer = await rl.question(`Queue item (${items.length} queued): `).catch(() => '');
            const source = String(answer || '').trim();
            
            if (!source) {
                if (items.length === 0) {
                    return null;
                }
                return items;
            }
            
            if (source.toLowerCase() === 'quit') {
                return null;
            }
            
            items.push(source);
        }
    } finally {
        rl.close();
    }
}

async function loadSettings() {
    try {
        const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
        return { ...JSON.parse(raw) };
    } catch {
        return {
            ...{
                output: DEFAULT_OUTPUT_ROOT,
                quality: DEFAULT_QUALITY,
                downloadRetries: DEFAULT_DOWNLOAD_RETRIES,
                noLyrics: false,
                noGenres: false,
                genreProviders: DEFAULT_GENRE_PROVIDERS.join(','),
                noBpmDetect: false,
                noZip: false,
                artistFolders: false,
                skipPreflight: false,
            }
        };
    }
}

async function saveSettings(settings) {
    await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}


async function runDownloadWithSource(source, settings, dashboard) {
    dashboard?.suspendForPrompt();
    
    const args = {
        input: source,
        output: settings.output,
        quality: settings.quality,
        'download-retries': settings.downloadRetries,
        'no-lyrics': settings.noLyrics,
        'lyrics-provider': settings.lyricsProviders || 'lrclib',
        'lyrics-synced-only': settings.syncedOnly,
        'lyrics-no-artist': settings.lyricsNoArtist,
        'no-genres': settings.noGenres,
        'genre-providers': settings.genreProviders,
        'no-bpm-detect': settings.noBpm,
        'no-zip': settings.noZip,
        'artist-folders': settings.artistFolders,
        'i-know-it-doesnt-work-but-ill-use-it-anyway': settings.skipPreflight,
    };
    
    dashboard?.resumeAfterPrompt();
    
    const exitCode = await runDownload(args, dashboard);
    return exitCode;
}

async function runDownload(args, dashboard) {
    const sourceValue = (await exists(args.input)) ? path.resolve(args.input) : args.input;
    const outputRoot = path.resolve(args.output || DEFAULT_OUTPUT_ROOT);
    const apiBase = args['api-url'] || process.env.MONOCHROME_API || null;
    const quality = args.quality || DEFAULT_QUALITY;
    const includeLyrics = !args['no-lyrics'];
    const includeGenres = !args['no-genres'];
    const genreProviders = parseGenreProviders(args['genre-providers']);
    const lyricsProvider = args['lyrics-provider'] || DEFAULT_LYRICS_PROVIDER;
    const lyricsOptions = { syncedOnly: args['lyrics-synced-only'], noArtist: args['lyrics-no-artist'] };
    const includeBpm = !args['no-bpm-detect'];
    const createZip = !args['no-zip'];
    const artistFolders = Boolean(args['artist-folders']);
    const downloadRetries = parseNonNegativeInteger(args['download-retries'], DEFAULT_DOWNLOAD_RETRIES);
    const skipPlaybackPreflight = Boolean(args['i-know-it-doesnt-work-but-ill-use-it-anyway']);
    const cache = await PersistentCache.load(CACHE_PATH);
    const authStore = await InstanceAuthStore.load(AUTH_STORE_PATH);
    const client = new MonochromeClient({
        apiBase,
        apiInstances: DEFAULT_API_INSTANCES,
        quality,
        cache,
        authStore,
    });
    
    console.log(`Cache file: ${CACHE_PATH}`);
    console.log(`Auth store: ${AUTH_STORE_PATH}`);
    console.log(
        `Cache stats: search=${Object.keys(cache.data.searchTrack || {}).length}, metadata=${Object.keys(cache.data.trackMetadata || {}).length}, playlists=${Object.keys(cache.data.playlists || {}).length}, albums=${Object.keys(cache.data.albums || {}).length}`
    );
    
    console.log(`Resolving source: ${sourceValue}`);
    const source = await resolveSource(sourceValue, client, { skipPlaybackPreflight });
    if (source.type === 'track' && source.metadata) {
        source.metadata = await hydrateTrackAlbumMetadata(source.metadata, client).catch(() => source.metadata);
    }
    await cache.flush();
    await fs.mkdir(outputRoot, { recursive: true });
    
    let assemblyRoot;
    let flatAlbumDir = false;
    let albumOnlyFolder = false;
    
    if (artistFolders && (source.type === 'album' || source.type === 'track')) {
        const artistName = sanitizeForFilename(getAlbumArtist(source.metadata) || 'Various Artists');
        const albumTitle = sanitizeForFilename(
            source.type === 'album' ? source.title : (source.metadata?.album?.title || source.title)
        );
        const artistDir = await resolvePreferredDirectory(outputRoot, artistName);
        assemblyRoot = await resolvePreferredDirectory(artistDir, albumTitle);
        flatAlbumDir = true;
    } else if (artistFolders && source.type === 'artist') {
        const safeSourceName = sanitizeForFilename(source.title);
        assemblyRoot = await resolvePreferredDirectory(outputRoot, safeSourceName);
        albumOnlyFolder = true;
    } else {
        const safeSourceName = sanitizeForFilename(source.title);
        assemblyRoot = await resolvePreferredDirectory(outputRoot, safeSourceName);
    }
    
    const zipArchivePath = createZip ? path.join(outputRoot, `${path.basename(assemblyRoot)}.zip`) : null;
    
    console.log(`Source type: ${source.type}`);
    console.log(`Tracks discovered: ${source.tracks.length}`);
    if (source.missing?.length) {
        console.log(`Source items skipped: ${source.missing.length}`);
    }
    
    if (!source.metadata?.preflightCompleted) {
        if (skipPlaybackPreflight) {
            console.log('Playback preflight bypassed by user flag.');
        } else {
            await runPlaybackPreflight(source, client);
        }
    }
    
    const recoveredState = await recoverDownloadedState(assemblyRoot, source);
    const downloaded = [...recoveredState.downloaded];
    const failures = [...recoveredState.failures];
    const albumCoverWrites = new Set();
    let currentRunState = new RunState(assemblyRoot, source, downloaded, failures);
    await currentRunState.flush();
    
    let queue = source.tracks
        .filter((track) => !recoveredState.downloadedIds.has(normalizeId(track?.id)))
        .map((track) => ({ track, retryCount: 0 }));
    const pendingTrackCount = queue.length;
    
    if (createZip && zipArchivePath) {
        console.log(`ZIP archive: ${zipArchivePath}`);
    }
    
    while (queue.length > 0) {
        const nextQueue = [];
        
        if (queue[0]?.retryCount > 0) {
            console.log(`Retry pass ${queue[0].retryCount}/${downloadRetries}: ${queue.length} track(s) requeued`);
        }
        
        for (let index = 0; index < queue.length; index += 1) {
            const { track, retryCount } = queue[index];
            const displayTitle = `${getTrackArtists(track)} - ${getTrackTitle(track)}`;
            const trackLabel =
                retryCount > 0
                    ? `[retry ${retryCount}/${downloadRetries}] ${displayTitle}`
                    : `[${index + 1}/${pendingTrackCount} remaining | ${recoveredState.downloadedIds.size + index + 1}/${source.tracks.length} total] ${displayTitle}`;
            console.log(trackLabel);
            
            try {
                const downloadedTrack = await downloadTrack({
                    track,
                    assemblyRoot,
                    client,
                    includeLyrics,
                    lyricsProvider,
                    lyricsOptions,
                    includeGenres,
                    genreProviders,
                    includeBpm,
                    albumCoverWrites,
                    flatAlbumDir,
                    albumOnlyFolder,
                    zipArchivePath,
                });
                removeFailureByTrackId(failures, downloadedTrack.id);
                downloaded.push(downloadedTrack);
                console.log(`  -> completed ${downloaded.length}/${source.tracks.length}: ${downloadedTrack.filePath}`);
                if (zipArchivePath) {
                    console.log(`  -> archive updated: ${zipArchivePath}`);
                }
                await currentRunState.flush();
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                
                if (retryCount < downloadRetries && isRetryableDownloadError(message)) {
                    console.warn(`  Retry queued (${retryCount + 1}/${downloadRetries}): ${message}`);
                    nextQueue.push({ track, retryCount: retryCount + 1 });
                } else {
                    upsertFailure(failures, { id: track.id, title: getTrackTitle(track), artist: getTrackArtists(track), error: message });
                    console.warn(`  Failed: ${message}`);
                }
                
                await currentRunState.flush();
            }
        }
        
        queue = nextQueue;
    }
    
    await writeCollectionArtifacts(assemblyRoot, source, downloaded, failures);
    await cache.flush();
    await currentRunState.flush();
    
    console.log(`Completed: ${downloaded.length} succeeded, ${failures.length} failed.`);
    return failures.length ? 2 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const rawArgv = process.argv.slice(2);
    const helpRequested = rawArgv.includes('--help') || rawArgv.includes('-h') || rawArgv.includes('help');
    const interactive = rawArgv.includes('--interactive') || rawArgv.includes('-i') || (!rawArgv.some(a => !a.startsWith('--')));
    
    if (interactive && !helpRequested) {
        runInteractiveMode().then(() => process.exit(process.exitCode || 0));
    } else {
        main()
            .then(() => {
                if (!helpRequested) {
                    globalThis.__MONOCHROME_DASHBOARD__?.printFinalSummary?.();
                }
                process.exit(process.exitCode || 0);
            })
            .catch((error) => {
                globalThis.__MONOCHROME_DASHBOARD__?.handleLine('error', error instanceof Error ? error.message : String(error));
                if (!helpRequested) {
                    globalThis.__MONOCHROME_DASHBOARD__?.printFinalSummary?.();
                }
                console.error(error instanceof Error ? error.message : error);
                process.exit(1);
            });
    }
}
