// --- DATABASE LAYER (IndexedDB) ---
const DB_NAME = 'DeltaMusicDB';
const STORE_NAME = 'tracks';
const DB_VERSION = 1;

let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (e) => reject("DB Error: " + e.target.error);

        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
    });
}

function saveTrack(trackInfo, blob) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        // Use URL as ID for uniqueness (safe hash alternative for demo)
        const id = btoa(trackInfo.url).substring(0, 32);

        const trackData = {
            id: id,
            title: trackInfo.title,
            artist: trackInfo.artist,
            duration: trackInfo.duration,
            blob: blob,
            savedAt: Date.now()
        };

        store.put(trackData);
        tx.oncomplete = () => resolve(id);
        tx.onerror = (e) => reject(e);
    });
}

function deleteTrackLocal(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject();
    });
}

function getAllSavedTracks() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject([]);
    });
}

// --- AUDIO PLAYER ---
const audio = new Audio();
let currentPlayingId = null;

// UI Elements
const playBtn = document.getElementById('btn-play');
const playIcon = document.getElementById('icon-play');
const pauseIcon = document.getElementById('icon-pause');
const currentTitle = document.getElementById('current-title');
const currentArtist = document.getElementById('current-artist');
const playerLoader = document.getElementById('player-loader');

audio.addEventListener('play', () => updatePlayState(true));
audio.addEventListener('pause', () => updatePlayState(false));
audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        playerLoader.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    }
});
audio.addEventListener('ended', () => {
    updatePlayState(false);
    playerLoader.style.width = '0%';
});

function updatePlayState(isPlaying) {
    playBtn.disabled = false;
    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

playBtn.addEventListener('click', () => {
    if (audio.src) {
        if (audio.paused) audio.play();
        else audio.pause();
    }
});

function playStream(url, title, artist, id, isLocal = false) {
    // Release previous blob URL if needed to avoid memory leaks
    if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
    }

    currentPlayingId = id;
    audio.src = url;
    audio.play().catch(e => console.error("Playback error:", e));

    currentTitle.textContent = title;
    currentArtist.textContent = artist;
    playerLoader.style.width = '0%';

    // Update active UI
    document.querySelectorAll('.track-item').forEach(el => el.classList.remove('playing'));
    const trackEl = document.getElementById(`track-${id}`);
    if (trackEl) trackEl.classList.add('playing');

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: artist,
            album: isLocal ? 'РЎРѕС…СЂР°РЅРµРЅРЅС‹Рµ (Offline)' : 'Hitmotop Search'
        });
    }
}


// --- API / UI LOGIC ---
const CORS_PROXY = "https://corsproxy.io/?";

const elements = {
    searchBtn: document.getElementById('search-btn'),
    searchInput: document.getElementById('search-input'),
    searchLoading: document.getElementById('search-loading'),
    searchTrackList: document.getElementById('search-track-list'),
    savedTrackList: document.getElementById('saved-track-list'),
    emptyState: document.getElementById('empty-state')
};

function renderTrackItem(track, isLocal, containerElement) {
    const el = document.createElement('div');
    // Using base64 encoding of URL or local DB ID
    const uniqueId = isLocal ? track.id : btoa(track.url).substring(0, 32);
    el.className = 'track-item';
    el.id = `track-${uniqueId}`;
    if (currentPlayingId === uniqueId) el.classList.add('playing');

    // Random color gradient based on string length for aesthetics
    const colors = ['#ff2d55', '#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f'];
    const idx = (track.title.length + track.artist.length) % colors.length;

    // Action Icon based on state
    let actionHtml = '';
    if (isLocal) {
        actionHtml = `<button class="action-btn" onclick="deleteLocal('${track.id}')" aria-label="РЈРґР°Р»РёС‚СЊ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>`;
    } else {
        actionHtml = `<button class="action-btn" id="dl-${uniqueId}" onclick="downloadTrack('${uniqueId}', '${track.url}', '${track.title.replace(/'/g, "\\'")}', '${track.artist.replace(/'/g, "\\'")}', '${track.duration}')" aria-label="РЎРєР°С‡Р°С‚СЊ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </button>`;
    }

    el.innerHTML = `
        <div class="track-item-art" style="background: linear-gradient(135deg, ${colors[idx]}, #222)">
            ${track.title.substring(0, 1).toUpperCase()}
        </div>
        <div class="track-item-info" onclick="play${isLocal ? 'Local' : 'Remote'}('${uniqueId}', '${isLocal ? track.id : track.url}', '${track.title.replace(/'/g, "\\'")}', '${track.artist.replace(/'/g, "\\'")}')">
            <h4>${track.title}</h4>
            <p>${track.artist}  вЂў  ${track.duration || '0:00'}</p>
        </div>
        ${actionHtml}
    `;

    containerElement.appendChild(el);
}

// Global scope functions for inline onclick handlers inside generated HTML
window.playRemote = function (id, url, title, artist) {
    playStream(url, title, artist, id, false);
};

window.playLocal = async function (id, dbId, title, artist) {
    try {
        const all = await getAllSavedTracks();
        const trk = all.find(t => t.id === dbId);
        if (trk && trk.blob) {
            const blobUrl = URL.createObjectURL(trk.blob);
            playStream(blobUrl, title, artist, id, true);
        }
    } catch (e) {
        alert("РћС€РёР±РєР° С‡С‚РµРЅРёСЏ С„Р°Р№Р»Р°");
    }
};

window.deleteLocal = async function (id) {
    if (confirm("РЈРґР°Р»РёС‚СЊ СЌС‚РѕС‚ С‚СЂРµРє?")) {
        await deleteTrackLocal(id);
        loadSavedTracks();
    }
}

window.downloadTrack = async function (btnId, url, title, artist, duration) {
    const btn = document.getElementById(`dl-${btnId}`);
    if (!btn) return;

    // Change to spinner (rudimentary)
    btn.innerHTML = `<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>`;
    btn.disabled = true;

    try {
        const response = await fetch(CORS_PROXY + encodeURIComponent(url));
        if (!response.ok) throw new Error("Download failed");

        const blob = await response.blob();

        await saveTrack({ url, title, artist, duration }, blob);

        // Success mark
        btn.classList.add('downloaded');
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

    } catch (e) {
        alert("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ");
        btn.disabled = false;
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
    }
};

// Hitmotop search scraper
async function performSearch(query) {
    if (!query) return;
    elements.searchTrackList.innerHTML = '';
    elements.searchLoading.style.display = 'block';

    try {
        const searchUrl = `https://rus.hitmotop.com/search?q=${encodeURIComponent(query)}`;
        const response = await fetch(CORS_PROXY + encodeURIComponent(searchUrl));
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const trackNodes = doc.querySelectorAll('.track__info');
        const results = [];

        trackNodes.forEach(node => {
            const titleEl = node.querySelector('.track__title');
            const artistEl = node.querySelector('.track__desc');
            const linkEl = node.querySelector('.track__download-btn');
            const durEl = node.querySelector('.track__fulltime');

            if (titleEl && artistEl && linkEl) {
                results.push({
                    title: titleEl.textContent.trim(),
                    artist: artistEl.textContent.trim(),
                    url: linkEl.getAttribute('href'),
                    duration: durEl ? durEl.textContent.trim() : ''
                });
            }
        });

        elements.searchLoading.style.display = 'none';

        if (results.length === 0) {
            elements.searchTrackList.innerHTML = '<div class="empty-state">РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ</div>';
        } else {
            // Deduplicate URLs
            const seen = new Set();
            results.filter(r => {
                const dup = seen.has(r.url);
                seen.add(r.url);
                return !dup;
            }).forEach(track => {
                renderTrackItem(track, false, elements.searchTrackList);
            });
        }

    } catch (e) {
        console.error(e);
        elements.searchLoading.style.display = 'none';
        elements.searchTrackList.innerHTML = `<div class="empty-state">РћС€РёР±РєР° РїРѕРёСЃРєР°. Р’РѕР·РјРѕР¶РЅРѕ РїСЂРѕРєСЃРё РЅРµРґРѕСЃС‚СѓРїРµРЅ.</div>`;
    }
}

elements.searchBtn.addEventListener('click', () => performSearch(elements.searchInput.value));
elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch(elements.searchInput.value);
});


// Tab Navigation
const navItems = document.querySelectorAll('.nav-item');
const tabs = document.querySelectorAll('.tab-content');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        tabs.forEach(t => t.style.display = 'none');

        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).style.display = 'block';

        if (targetId === 'tab-home') {
            document.getElementById('header-title').textContent = 'РњРѕСЏ РјСѓР·С‹РєР°';
            loadSavedTracks(); // Refresh DB view every time we open tab
        } else {
            document.getElementById('header-title').textContent = 'РџРѕРёСЃРє РјСѓР·С‹РєРё';
        }
    });
});

async function loadSavedTracks() {
    elements.savedTrackList.innerHTML = '';
    const tracks = await getAllSavedTracks();

    // Reverse to show newest first
    tracks.reverse();

    if (tracks.length === 0) {
        elements.emptyState.style.display = 'block';
    } else {
        elements.emptyState.style.display = 'none';
        tracks.forEach(track => {
            renderTrackItem(track, true, elements.savedTrackList);
        });
    }
}

// Init
window.addEventListener('load', async () => {
    try {
        await initDB();
        loadSavedTracks();
    } catch (e) {
        console.error("Failed to init DB", e);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(e => console.log(e));
    }
});
