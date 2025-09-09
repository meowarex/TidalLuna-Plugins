# Luna Plugins Collection

A collection of Luna plugins for Tidal, ported from Neptune framework.

## Plugins

### 🎨 Obsidian
**Location:** `plugins/obsidian-theme-luna/`

A dark OLED-friendly theme that transforms Tidal Luna's appearance.

**Features:**
- Applies a dark, OLED-optimized theme
- Reduces battery consumption on OLED displays.. i guess <3
- Modern, sleek dark interface

### 🎵 Radiant Lyrics
**Location:** `plugins/radiant-lyrics-luna/`

A radiant and beautiful lyrics view for TIDAL with dynamic visual effects.

**Features:**
- Dynamic cover art backgrounds with blur and rotation effects
- Glowing Animated Lyrics with clean scrolling

### 📋 Copy Lyrics
**Location:** `plugins/copy-lyrics-luna/`

Allows users to copy song lyrics by selecting them directly in the interface.

**Features:**
- Enables text selection on lyrics
- Automatic clipboard copying of selected lyrics
- Smart lyric span detection

### 🧽 Element Hider
**Location:** `plugins/element-hider-luna/`

Allows users to hide/remove UI elements by right clicking on them.

**Features:**
- Remove/Hide ANY UI element
- Automagically saves hidden elements
- Allows for elements to be restored

### 🎶 Audio Visualizer
**Location:** `plugins/audio-visualizer-luna/`

⚠️ **Work in Progress** - Audio visualization plugin that displays real-time audio frequency data.

**Features:**
- Real-time audio frequency visualization with bars
- Animated effect when no audio is detected
- Configurable options.. like allot of em
- Theme frienly (Wont clash with your themes style)

**Note:** This plugin is currently in development and may have stability issues.

## Installation

### Installing from URL
### (They are in the store by default now)
1. Open TidalLuna after Building & Serving
2. Navigate to Luna Settings (Top right of Tidal)
3. Click "Plugin Store" Tab
4. Paste in the "Install from URL" Bar `https://github.com/meowarex/tidalluna-plugins/releases/download/latest/store.json`

## Installation from Source

### Building All Plugins
```bash
# Git Clone the Repo
git clone https://github.com/meowarex/tidalluna-plugins

# Change Folder to the Repo
cd tidalluna-plugins

# Install dependencies
pnpm install

# Build & Serve all plugins
pnpm run watch
```

### Installing Plugins in TidalLuna
1. Open TidalLuna after Building & Serving
2. Navigate to Luna Settings (Top right of Tidal)
3. Click "Plugin Store" Tab
4. Click Install on the Plugins at the top Labeled with "[Dev]"
5. Enjoy <3

## Development

This project is made for:
- **TidalLuna** - Modern plugin framework for Tidal | Inrixia

## GitHub Actions

- **Automated builds** on every push (to main)
- **Release automation** for distributing plugins
- **Artifact uploads** for easy plugin distribution

## Based On <3

- **itzzexcel** - [GitHub](https://github.com/ItzzExcel)

## Credits

Original Neptune versions by itzzexcel. Ported to Luna framework following the Luna plugin template structure by meowarex with help from Inrixia <3 
