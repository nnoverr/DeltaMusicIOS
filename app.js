// Register Service Worker for offline capability
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// UI and Player logic
document.addEventListener('DOMContentLoaded', () => {
    // Basic mock track list for demonstration
    const tracks = [
        { id: 1, title: 'Chill Lo-Fi Beat', artist: 'Producer Boy', url: '', color: '#ff2d55' },
        { id: 2, title: 'Synthwave Drive', artist: 'Neon Night', url: '', color: '#0a84ff' },
        { id: 3, title: 'Acoustic Memories', artist: 'Guitarist', url: '', color: '#30d158' },
        { id: 4, title: 'Epic Orchestral', artist: 'Composer', url: '', color: '#ff9f0a' },
        { id: 5, title: 'Summer Vibes', artist: 'DJ Sunshine', url: '', color: '#bf5af2' }
    ];

    const trackList = document.getElementById('track-list');
    let isPlaying = false;
    let currentTrackIndex = -1;
    
    // UI Elements
    const playBtn = document.getElementById('btn-play');
    const playIcon = document.getElementById('icon-play');
    const pauseIcon = document.getElementById('icon-pause');
    const currentTitle = document.getElementById('current-title');
    const currentArtist = document.getElementById('current-artist');
    const trackArtwork = document.querySelector('.track-artwork');
    
    // Render tracks
    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'track-item';
        item.innerHTML = `
            <div class="track-item-art" style="background: linear-gradient(135deg, ${track.color}, #222)"></div>
            <div class="track-item-info">
                <h4>${track.title}</h4>
                <p>${track.artist}</p>
            </div>
        `;
        
        item.addEventListener('click', () => {
            playTrack(index);
        });
        
        trackList.appendChild(item);
    });

    function playTrack(index) {
        currentTrackIndex = index;
        const track = tracks[index];
        
        // Update UI
        currentTitle.textContent = track.title;
        currentArtist.textContent = track.artist;
        trackArtwork.style.background = `linear-gradient(135deg, ${track.color}, #8a2387)`;
        
        // Mock Play
        isPlaying = true;
        updatePlayBtnState();
        
        // Setup Media Session API for iOS Lockscreen
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artist,
                album: 'DeltaMusic PWA'
                // artwork: [{src: '...', sizes: '512x512', type: 'image/png'}]
            });
        }
    }

    function togglePlay() {
        if (currentTrackIndex === -1) {
            if (tracks.length > 0) playTrack(0);
            return;
        }
        isPlaying = !isPlaying;
        updatePlayBtnState();
    }

    function updatePlayBtnState() {
        if (isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    playBtn.addEventListener('click', togglePlay);
    
    document.getElementById('btn-prev').addEventListener('click', () => {
        if (currentTrackIndex > 0) playTrack(currentTrackIndex - 1);
    });
    
    document.getElementById('btn-next').addEventListener('click', () => {
        if (currentTrackIndex < tracks.length - 1) playTrack(currentTrackIndex + 1);
    });
});
