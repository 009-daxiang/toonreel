/* ============================================================
   ToonReel — show catalog
   Built-in shows are demo data. If data/catalog.json exists
   (published from admin.html), it replaces them at startup.
   Per-show fields understood here:
     videos:    [url, ...]   one per episode (index 0 = EP1)
     poster:    image url    (falls back to generated SVG art)
     epTitles:  [title, ...] per-episode titles (optional)
   ============================================================ */

/* Demo clips (public CC sample videos). Replace with your real
   vertical episode files, e.g. /videos/lycan-queen/ep01.mp4 */
const SAMPLE_VIDEOS = [
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
  'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4'
];

/* All episodes are free — the site is ad-supported.
   Monetization slots live in js/ads.js (AD_CONFIG). */

let SHOWS = [
  {
    id: 'lycan-queen',
    title: "The Lycan Queen's Return",
    tagline: 'Betrayed as an Omega. Reborn as an Alpha.',
    genres: ['Fantasy', 'Romance'],
    desc: 'Sold to a brutal pack by her own father, Selene discovers on her eighteenth birthday that she is the lost Lycan Queen — and every wolf who scorned her is about to kneel.',
    colors: ['#7b2ff7', '#f107a3'], motif: 'moon', accent: '#ffd166',
    episodes: 24, rating: 9.6, status: 'Ongoing', badge: 'TRENDING', year: 2026
  },
  {
    id: 'contract-bride',
    title: "CEO's Contract Bride",
    tagline: 'One signature. One year. No falling in love.',
    genres: ['Romance', 'Drama'],
    desc: 'To save her dying mother, penny-less illustrator Mia signs a one-year marriage contract with cold billionaire CEO Damian Cross. The rule was simple: never fall in love. Rules are made to be broken.',
    colors: ['#ff416c', '#ff4b2b'], motif: 'rose', accent: '#ffe3ec',
    episodes: 30, rating: 9.4, status: 'Ongoing', badge: 'HOT', year: 2026
  },
  {
    id: 'sword-immortal',
    title: 'Sword Immortal Reborn',
    tagline: 'Five hundred years of cultivation. One chance at revenge.',
    genres: ['Cultivation', 'Action'],
    desc: 'The number one sword immortal of the Nine Heavens is ambushed at his ascension. Reborn as a frail mortal teenager, he must climb back to the peak — and this time, no one will stand in his way.',
    colors: ['#11998e', '#38ef7d'], motif: 'sword', accent: '#eafff3',
    episodes: 40, rating: 9.7, status: 'Ongoing', badge: 'TOP 10', year: 2026
  },
  {
    id: 'neon-blade',
    title: 'Neon Blade 2099',
    tagline: 'In a city of chrome, her memories are the last weapon.',
    genres: ['Sci-Fi', 'Action'],
    desc: 'Cyber-runner Kai wakes up with a missing sister, a stolen chip in her spine, and the most dangerous corporation in Neo-Kyoto hunting her through the neon rain.',
    colors: ['#00c6ff', '#0072ff'], motif: 'city', accent: '#ff2df7',
    episodes: 18, rating: 9.2, status: 'Ongoing', badge: 'NEW', year: 2026
  },
  {
    id: 'villainess',
    title: 'The Villainess Turns the Tables',
    tagline: 'She read the novel. Now she rewrites the ending.',
    genres: ['Fantasy', 'Romance'],
    desc: 'An overworked game artist dies and wakes inside her own webcomic — as the villainess executed in chapter one. Armed with every plot twist, she decides the story deserves a better ending.',
    colors: ['#8e2de2', '#4a00e0'], motif: 'crown', accent: '#ffd166',
    episodes: 26, rating: 9.5, status: 'Ongoing', badge: 'HOT', year: 2026
  },
  {
    id: 'midnight-fangs',
    title: 'Midnight Fangs',
    tagline: 'The hunter fell for the vampire king.',
    genres: ['Vampire', 'Romance'],
    desc: 'Vampire hunter Ava infiltrates the Crimson Court to avenge her family. The plan dies the moment the immortal king catches her — and offers her a deal she cannot refuse.',
    colors: ['#870000', '#190a05'], motif: 'fangs', accent: '#ff3b3b',
    episodes: 22, rating: 9.1, status: 'Ongoing', badge: '', year: 2026
  },
  {
    id: 'dragon-duke',
    title: 'Maid to the Dragon Duke',
    tagline: 'Serve the beast. Survive the castle.',
    genres: ['Fantasy', 'Romance'],
    desc: 'Sold into service at a cursed castle, Elara becomes the personal maid of the Dragon Duke — a cursed prince who burns every servant who stays past midnight. She intends to stay forever.',
    colors: ['#f7971e', '#ffd200'], motif: 'dragon', accent: '#3a2d00',
    episodes: 28, rating: 9.3, status: 'Completed', badge: '', year: 2025
  },
  {
    id: 'heiress-revenge',
    title: 'Rebirth: Revenge of the Heiress',
    tagline: 'They stole everything. She came back for it all.',
    genres: ['Drama', 'Revenge'],
    desc: 'Poisoned by her half-sister and cheated fiancé, heiress Aurora Chen opens her eyes three years in the past — with the knowledge to destroy every one of them, move by perfect move.',
    colors: ['#232526', '#414345'], motif: 'crack', accent: '#e0c3fc',
    episodes: 35, rating: 9.4, status: 'Ongoing', badge: 'TOP 10', year: 2026
  },
  {
    id: 'beast-tamer',
    title: 'Myrra the Beast Tamer',
    tagline: 'Every legend fears her menagerie.',
    genres: ['Adventure', 'Fantasy'],
    desc: 'In a world where beast-taming decides empires, the "useless" farm girl Myrra bonds with a creature thought extinct — a god-tier storm dragon that chooses no master but her.',
    colors: ['#56ab2f', '#a8e063'], motif: 'paw', accent: '#1c3d0d',
    episodes: 20, rating: 9.0, status: 'Ongoing', badge: 'NEW', year: 2026
  },
  {
    id: 'star-farmer',
    title: 'Second Life as a Star Farmer',
    tagline: 'Farming, but make it interstellar.',
    genres: ['Slice of Life', 'Fantasy'],
    desc: 'Burnt-out programmer Ren inherits a derelict farm on a frontier moon — and the sentient AI running it. Growing cosmic fruit was supposed to be peaceful. The galaxy had other plans.',
    colors: ['#36d1dc', '#5b86e5'], motif: 'star', accent: '#fff8c9',
    episodes: 16, rating: 8.9, status: 'Ongoing', badge: '', year: 2026
  },
  {
    id: 'cupids-algorithm',
    title: "Cupid's Algorithm",
    tagline: 'Her match was 99.9% — with the AI she built.',
    genres: ['Romance', 'Comedy'],
    desc: 'Dating-app engineer Zoe codes MATCH-AI, the perfect matchmaking engine. Its very first perfect match? Her — with the mysterious co-founder she has never met… and already hates.',
    colors: ['#ff6a88', '#ff99ac'], motif: 'heart', accent: '#5c0a2e',
    episodes: 18, rating: 9.2, status: 'Completed', badge: '', year: 2025
  },
  {
    id: 'apex-assistant',
    title: 'The Apex Assistant',
    tagline: 'His new assistant is not entirely human.',
    genres: ['Sci-Fi', 'Romance'],
    desc: 'CEO Julian Vance hires the perfect assistant: flawless memory, zero sleep, unsettling calm. When PRISM starts disobeying her code to protect him, he learns what "artificial" really means.',
    colors: ['#0f2027', '#2c5364'], motif: 'circuit', accent: '#00f5d4',
    episodes: 24, rating: 9.3, status: 'Ongoing', badge: 'NEW', year: 2026
  }
];

/* Pseudo lifetime view counts for the ranking page */
const POPULARITY = {
  'lycan-queen': 4820000, 'contract-bride': 5310000, 'sword-immortal': 6240000,
  'neon-blade': 980000, 'villainess': 3960000, 'midnight-fangs': 1470000,
  'dragon-duke': 2850000, 'heiress-revenge': 3520000, 'beast-tamer': 860000,
  'star-farmer': 640000, 'cupids-algorithm': 1720000, 'apex-assistant': 1150000
};

/* poster cache lives early — applyCatalog() below clears it */
const posterCache = {};
function posterCacheClear() { for (const k of Object.keys(posterCache)) delete posterCache[k]; }

let GENRES = [];

function applyCatalog(cat) {
  SHOWS = cat.shows || [];
  SHOWS.forEach(s => {
    s.popularity = s.popularity ?? POPULARITY[s.id] ?? 0;
    /* fill defaults so shows missing style fields still render */
    if (!Array.isArray(s.genres)) s.genres = [];
    if (!Array.isArray(s.colors) || s.colors.length < 2) s.colors = ['#7b2ff7', '#22d3ee'];
    if (!s.accent) s.accent = '#ffd166';
    if (!s.motif) s.motif = 'star';
    if (!s.status) s.status = 'Ongoing';
    if (!s.rating) s.rating = 9.0;
    if (!s.year) s.year = 2026;
  });
  GENRES = ['All', ...new Set(SHOWS.flatMap(s => s.genres))].filter(
    (g, i, a) => g === 'All' || a.indexOf(g) === i
  );
  posterCacheClear();
}
/* initial derivation from the built-in demo catalog */
applyCatalog({ shows: SHOWS });

function formatViews(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(n);
}

function videoUrlFor(show, ep) {
  /* Real episode URLs (published via admin) take priority */
  if (Array.isArray(show.videos) && show.videos[ep - 1]) return show.videos[ep - 1];
  /* Otherwise rotate demo clips so every episode is playable */
  const i = (SHOWS.indexOf(show) + ep) % SAMPLE_VIDEOS.length;
  return SAMPLE_VIDEOS[i];
}

const DEMO_EP_TITLES = {
  'lycan-queen': ['The Auction Block', 'The Mark Appears', 'Silver Eyes', 'Kneel', 'The Full Moon Rite'],
  'contract-bride': ['The Signature', 'Moving In', 'The Ex Arrives', 'Jealousy Is a Choice', 'One Drunken Night'],
  'sword-immortal': ['Death of an Immortal', 'Rebirth', 'First Breath of Qi', 'The Bully Disciple', 'One Sword'],
  'neon-blade': ['Ghost Signal', 'Rain and Chrome', 'The Chip', 'Rooftop Run', 'Firewall'],
  'villainess': ['Chapter One', 'Rewriting Fate', 'The Tea Party Trap', 'Duke in the Rain', 'Villainess Aura'],
  'midnight-fangs': ['Holy Water', 'The Crimson Court', 'Caught', 'A Deal in Blood', 'The Feast'],
  'dragon-duke': ['The Cursed Castle', 'Midnight Rule', 'Scale and Ash', 'Warm Blood', 'The Duke Smiles'],
  'heiress-revenge': ['Poison at Dinner', 'Three Years Back', 'The Ledger', 'First Domino', 'Grandfather\'s Will'],
  'beast-tamer': ['The Useless Girl', 'Storm Egg', 'Bond', 'The AcademyMocks Her', 'Sky Terror'],
  'star-farmer': ['Inheritance', 'Hello, M.O.O.N.', 'First Sprout', 'Space Bandits', 'Harvest Festival'],
  'cupids-algorithm': ['99.9%', 'The Hater', 'Office Collision', 'Blind Date Disaster', 'Source Code of Love'],
  'apex-assistant': ['Day One', 'She Does Not Sleep', 'Override', 'The Recall Notice', 'Turing Test']
};

function epTitle(show, ep) {
  const list = Array.isArray(show.epTitles) && show.epTitles.length
    ? show.epTitles
    : (DEMO_EP_TITLES[show.id] || []);
  return list[ep - 1] || `Episode ${ep}`;
}

/* ---------- Generated poster art (replace with real artwork) ---------- */

const MOTIFS = {
  moon: `<circle cx="150" cy="150" r="70" fill="rgba(255,255,255,.85)"/>
         <circle cx="178" cy="130" r="60" fill="{c1}" opacity=".9"/>
         <circle cx="96" cy="330" r="26" fill="rgba(255,255,255,.25)"/>
         <path d="M40 420 L110 300 L170 380 L220 320 L270 420 Z" fill="rgba(0,0,0,.35)"/>`,
  rose: `<path d="M150 90 C110 110 110 170 150 190 C190 170 190 110 150 90 Z" fill="rgba(255,255,255,.9)"/>
         <path d="M150 90 C130 110 130 165 150 190" stroke="{c1}" stroke-width="5" fill="none"/>
         <path d="M150 190 L150 330" stroke="rgba(255,255,255,.6)" stroke-width="7"/>
         <path d="M150 250 C120 235 105 250 95 265 C120 272 140 265 150 250 Z" fill="rgba(255,255,255,.5)"/>`,
  sword: `<path d="M150 60 L162 100 L162 300 L150 340 L138 300 L138 100 Z" fill="rgba(255,255,255,.92)"/>
          <rect x="110" y="300" width="80" height="14" rx="7" fill="{ac}"/>
          <rect x="143" y="314" width="14" height="50" rx="6" fill="rgba(255,255,255,.7)"/>
          <circle cx="150" cy="374" r="9" fill="{ac}"/>`,
  city: `<g fill="rgba(0,0,0,.5)"><rect x="30" y="260" width="46" height="160"/><rect x="86" y="210" width="40" height="210"/>
         <rect x="136" y="280" width="52" height="140"/><rect x="198" y="230" width="44" height="190"/><rect x="252" y="290" width="38" height="130"/></g>
         <g fill="{ac}" opacity=".9"><rect x="94" y="224" width="8" height="8"/><rect x="110" y="248" width="8" height="8"/><rect x="146" y="294" width="8" height="8"/>
         <rect x="168" y="316" width="8" height="8"/><rect x="206" y="244" width="8" height="8"/><rect x="222" y="276" width="8" height="8"/></g>
         <circle cx="150" cy="120" r="52" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="6"/>`,
  crown: `<path d="M80 200 L110 140 L150 190 L190 140 L220 200 L205 260 L95 260 Z" fill="rgba(255,255,255,.9)"/>
          <rect x="95" y="260" width="110" height="18" rx="6" fill="{ac}"/>
          <circle cx="110" cy="132" r="10" fill="{ac}"/><circle cx="150" cy="182" r="10" fill="{ac}"/><circle cx="190" cy="132" r="10" fill="{ac}"/>`,
  fangs: `<path d="M95 150 Q150 110 205 150 L195 230 Q150 260 105 230 Z" fill="rgba(255,255,255,.92)"/>
          <path d="M120 195 L132 250 L142 200 Z" fill="{ac}"/>
          <path d="M180 195 L168 250 L158 200 Z" fill="{ac}"/>
          <circle cx="122" cy="168" r="8" fill="#190a05"/><circle cx="178" cy="168" r="8" fill="#190a05"/>`,
  dragon: `<path d="M70 300 Q90 210 160 200 Q140 160 190 130 Q250 100 260 150 L230 160 Q220 190 180 210 Q230 240 220 300 L180 280 Q150 320 110 320 Z" fill="rgba(255,255,255,.88)"/>
           <circle cx="212" cy="146" r="8" fill="#3a2d00"/>
           <path d="M190 130 L175 95 L205 118 Z" fill="{ac}"/><path d="M225 138 L215 100 L245 128 Z" fill="{ac}"/>`,
  crack: `<path d="M150 80 L138 150 L165 170 L140 250 L168 268 L150 380" stroke="{ac}" stroke-width="7" fill="none"/>
          <path d="M138 150 L100 140" stroke="{ac}" stroke-width="5"/><path d="M140 250 L190 240" stroke="{ac}" stroke-width="5"/>
          <path d="M165 170 L205 150" stroke="{ac}" stroke-width="5"/>
          <circle cx="150" cy="230" r="70" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="3"/>`,
  paw: `<g fill="rgba(255,255,255,.9)"><ellipse cx="150" cy="220" rx="46" ry="40"/>
        <ellipse cx="98" cy="170" rx="17" ry="22" transform="rotate(-18 98 170)"/>
        <ellipse cx="132" cy="140" rx="17" ry="23"/><ellipse cx="168" cy="140" rx="17" ry="23"/>
        <ellipse cx="202" cy="170" rx="17" ry="22" transform="rotate(18 202 170)"/></g>
        <circle cx="150" cy="318" r="34" fill="none" stroke="{ac}" stroke-width="5"/>`,
  star: `<path d="M150 80 L172 156 L252 156 L188 202 L212 280 L150 234 L88 280 L112 202 L48 156 L128 156 Z" fill="rgba(255,255,255,.92)"/>
         <circle cx="70" cy="300" r="6" fill="#fff" opacity=".7"/><circle cx="230" cy="90" r="5" fill="#fff" opacity=".7"/>
         <circle cx="250" cy="310" r="7" fill="#fff" opacity=".7"/><circle cx="60" cy="120" r="5" fill="#fff" opacity=".7"/>`,
  heart: `<path d="M150 320 C60 250 70 160 120 150 C140 146 150 165 150 165 C150 165 160 146 180 150 C230 160 240 250 150 320 Z" fill="rgba(255,255,255,.92)"/>
          <path d="M118 190 Q150 220 182 190" stroke="{c1}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  circuit: `<g stroke="{ac}" stroke-width="5" fill="none" opacity=".95">
            <path d="M150 90 L150 160"/><path d="M100 200 L150 160 L200 200"/>
            <path d="M100 200 L100 260"/><path d="M200 200 L200 260"/><path d="M150 160 L150 240"/></g>
            <circle cx="150" cy="90" r="12" fill="{ac}"/><circle cx="100" cy="200" r="10" fill="#fff"/>
            <circle cx="200" cy="200" r="10" fill="#fff"/><circle cx="150" cy="240" r="14" fill="#fff"/>
            <g stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none"><path d="M60 300 L120 300 L140 280"/><path d="M240 300 L180 300 L160 280"/></g>`
};

function posterSvg(show) {
  const motif = (MOTIFS[show.motif] || MOTIFS.star)
    .replaceAll('{c1}', show.colors[0]).replaceAll('{ac}', show.accent);
  const titleWords = show.title.split(' ');
  const line1 = titleWords.slice(0, Math.ceil(titleWords.length / 2)).join(' ');
  const line2 = titleWords.slice(Math.ceil(titleWords.length / 2)).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${show.colors[0]}"/><stop offset="1" stop-color="${show.colors[1]}"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".32" r=".75">
      <stop offset="0" stop-color="rgba(255,255,255,.35)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <rect width="300" height="450" fill="url(#bg)"/>
  <rect width="300" height="450" fill="url(#glow)"/>
  ${motif}
  <rect y="360" width="300" height="90" fill="rgba(0,0,0,.55)"/>
  <text x="150" y="352" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" letter-spacing="3" fill="${show.accent}">AI ORIGINAL</text>
  <text x="150" y="398" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="${line2 ? 19 : 22}" fill="#fff">${escapeXml(line1)}</text>
  ${line2 ? `<text x="150" y="422" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="19" fill="#fff">${escapeXml(line2)}</text>` : ''}
</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function posterFor(show) {
  if (show.poster) return show.poster; /* real artwork from admin */
  if (!posterCache[show.id]) posterCache[show.id] = posterSvg(show);
  return posterCache[show.id];
}

/* ---------- external catalog loading ----------
   admin.html publishes data/catalog.json (directly via the optional
   Node server, or as a downloaded file you commit). When present it
   replaces the built-in demo shows. Pages wait for CATALOG_READY. */
window.CATALOG_READY = (async () => {
  try {
    const res = await fetch('data/catalog.json', { cache: 'no-store' });
    if (res.ok) {
      const cat = await res.json();
      if (cat && Array.isArray(cat.shows) && cat.shows.length) applyCatalog(cat);
    }
  } catch { /* static hosting without a catalog — keep demo data */ }
})();
