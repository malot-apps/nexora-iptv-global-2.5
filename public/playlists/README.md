# NEXORA — GitHub Playlist Manager Instruction Guide

Welcome! This folder allows you to manage public playlists and stream categories on NEXORA directly from your phone or GitHub interface without touching any code.

## 📁 Source Files & Fallsback Categories
Use these files to organize your playlist URLs. The filename acts as a fallback category when the stream source lacks metadata:
* **sports.txt** → Sports
* **bangla.txt** → Bangla / Bangladesh
* **movies.txt** → Movies
* **kids.txt** → Kids
* **news.txt** → News
* **international.txt** → International
* **music.txt** → Music
* **radio.txt** → Radio

---

## 📝 Format Rules
Each `.txt` file is structured to be simple to edit from a mobile device:
1. **One source URL per line** (e.g. `https://example.com/playlist.m3u` or HLS stream link `https://example.com/stream.m3u8`).
2. **Blank lines are ignored**.
3. **Lines starting with `#` are comments** and are ignored.
4. **Duplicate source URLs are ignored** and deduplicated automatically.

### Example TXT Format:
```text
# Sports Playlist Source
https://example.com/sports-channels.m3u

# Single Stream Source
https://example.com/live-match-hls.m3u8
```

---

## 🛠️ How to Add or Remove a Source

### To Add a Source:
1. Open GitHub on your computer or phone.
2. Navigate to this folder (`public/playlists/`).
3. Tap on the relevant `.txt` file (e.g., `news.txt`).
4. Click the **Edit** (pencil) button.
5. Paste your authorized M3U or M3U8 URL on a new line.
6. Commit the changes. Vercel automatically deploys the update.

### To Remove a Source:
1. Edit the file, delete or comment out (`#`) the line containing the URL.
2. Commit the changes.

---

## 🏷️ Category Priority & overrides
Each parsed channel is automatically categorized based on the following priority:
1. **Manual Override**: Defined in `category-overrides.json` for exact channel names.
2. **Valid M3U group-title**: If the channel metadata has a valid group-title.
3. **Existing channel category metadata**: Any pre-configured category metadata.
4. **Keyword Detection**: Conservative keyword search in the channel name.
5. **Fallback Category**: The fallback category of the `.txt` file where it was found.
6. **Other / Uncategorized**: Default fallback.

### Manual Overrides (`category-overrides.json`):
You can force any specific channel to appear in a custom category using the following format:
```json
{
  "Exact Channel Name": "Sports",
  "Another Channel Name": "News"
}
```

---

## 🔒 Public Playlists vs. Personal TV
* **Public/GitHub Playlists**: Loaded for all website visitors. Managed by the repository owner under `public/playlists/`.
* **Personal TV**: Private/local playlists added by individual visitors. These are stored locally in the visitor's browser (localStorage) and never committed to GitHub or shared.

⚠️ **WARNING: Do not commit any private credentials, passwords, or personal keys in this repository.**
