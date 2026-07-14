# NEXORA IPTV — GLOBAL PREMIUM (v2.5.0)

NEXORA is an elite, high-performance, client-side IPTV streaming terminal built using Next.js 15, React 19, Tailwind CSS, and `motion` (Framer Motion). It is engineered specifically for pristine catalog organization, rapid-load stream playback, live sports scheduling, and high-performance stream hygiene.

---

## 🌟 Elite Premium Features

### 📡 1. Dynamic Stream Engine
Powered by `HLS.js` with direct Native video player fallbacks, NEXORA features:
*   **Adaptive Watchdog Timers**: Intelligent loading detection that automatically detects and flags stalled, silent, or broken streams.
*   **Alternative Station Fallbacks**: Automatically cycle through available backup channels or secondary streams when a track goes offline.
*   **Smart Fullscreen & Controls**: Responsive gesture controls, adaptive aspect ratio stretching, custom volume levels, and automatic fullscreen toggling on play.

### 🧪 2. Active Catalog Hygiene & Rescan
*   **Continuous Background Verification**: Active, low-footprint background health-check verifies channels asynchronously without degrading streaming performance.
*   **Manual Catalog Rescan**: Initiate full-catalog status checks with live batch-progress tracking, providing transparent stream diagnostics.
*   **Automatic Catalog Pruning**: Dynamically removes confirmed dead channels from the interface while preserving the master list in cache.

### 🏆 3. Global Sports Calendar Integration
*   **Live Match Calendars**: Dynamic curation of international sports, leagues, and high-impact match events.
*   **One-Click Tune In**: Instant stream redirection directly from scheduled matches to the matching live channel in your active playlists.

### 🛠️ 4. Personal TV Proxies & Backups
*   **Multi-Proxy Configuration**: Route restricted streams through personal proxy chains (e.g., custom CORS proxies, AllOrigins, or user-defined relays).
*   **Database Export/Import**: Export personalized collections, favorites, and custom playlist configurations into standard JSON database files for multi-device synchronization.

### 🛡️ 5. Resilient Local State & Fallbacks
*   **Fault-Tolerant Cache Wrapping**: All local storage state reads are wrapped in robust, defensive `try-catch` structures.
*   **Data Normalization**: Automatic array and object pattern validation ensures the player remains 100% stable even if cached storage values are corrupted.

---

## 🏗️ Architectural Overview

```
.
├── app/                  # Next.js App Router root (Pages & Layout)
│   ├── globals.css       # Global styles with Tailwind CSS integrations
│   ├── layout.tsx        # Base Document & Theme injector
│   └── page.tsx          # Main entry route
├── components/           # UI & Feature Components
│   ├── ChannelList.tsx   # Catalog display, search, groups & active diagnostics
│   ├── ErrorBoundary.tsx # Top-level React fallback and cache restoration controls
│   ├── HomeClient.tsx    # Core orchestrator, state manager & sync engine
│   ├── LivePlayer.tsx    # HLS playback interface, watchdogs & alternative router
│   ├── PersonalTVManager.tsx # Proxy management and custom M3U integrations
│   ├── PlaylistManager.tsx   # Playlist catalog listing and switching
│   ├── SettingsManager.tsx   # System settings, backup imports & layout styles
│   └── SportsSchedule.tsx    # Sports schedule matching and automatic tuner
├── lib/                  # Parsers & Utilities
│   └── iptv-parser.ts    # Secure M3U/M3U8 parsing and normalizer
├── public/               # Static assets & localized playlists
└── metadata.json         # Platform configuration & metadata
```

---

## 🚀 Production Building & Static Deployment

NEXORA compiles to a highly-optimized, single-page application (SPA) designed to run serverlessly on CDN architectures such as GitHub Pages.

### Local Development
```bash
npm run dev
```

### Static Build compilation
To build the static export:
```bash
npm run build
```
This outputs optimized, production-ready HTML, CSS, and JS in the `/out` directory.

### GitHub Pages Configuration
For GitHub Pages deployment, ensure:
1.  **Repository Path Compatibility**: Ensure the Next.js `basePath` inside `next.config.ts` aligns with your repository name (e.g., `/nexora-iptv-global-2.5`).
2.  **Asset Handling**: Reference static assets relatively using prefix helpers or explicit base URLs to prevent resource loading failures.
