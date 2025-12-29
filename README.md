<p align="center">
  <img src="app/tauri/icons/icon.png" alt="Church Hub Logo" width="128" height="128">
</p>

<h1 align="center">Church Hub</h1>

<p align="center">
  <strong>A modern, feature-rich church presentation and livestream management system</strong>
</p>

<p align="center">
  <a href="#-download">Download</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a>
</p>

---

## 🎯 Overview

Church Hub is a comprehensive church presentation software designed to streamline worship services. It combines song lyrics management, Bible verse display, service scheduling, multi-screen presentation, and YouTube/OBS livestream integration into a single, elegant application.

Built with modern web technologies and powered by Tauri, Church Hub runs as a native desktop application on Windows and macOS, while also being accessible via web browser.

---

## 📥 Download

Download the latest version for your operating system:

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/radio-crestin/church-hub/releases/latest/download/church-hub_windows_x64.msi">
        <img src="https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows"/>
        <br/>
        <sub><b>Windows (x64)</b></sub>
        <br/>
        <sub>.msi installer</sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/radio-crestin/church-hub/releases/latest/download/church-hub_macos_universal.dmg">
        <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS"/>
        <br/>
        <sub><b>macOS (Apple Silicon)</b></sub>
        <br/>
        <sub>.dmg installer</sub>
      </a>
    </td>
  </tr>
</table>

<p align="center">
  <a href="https://github.com/radio-crestin/church-hub/releases/latest">
    <img src="https://img.shields.io/github/v/release/radio-crestin/church-hub?style=flat-square&label=Latest%20Release" alt="Latest Release"/>
  </a>
  <a href="https://github.com/radio-crestin/church-hub/releases">
    <img src="https://img.shields.io/github/downloads/radio-crestin/church-hub/total?style=flat-square&label=Downloads" alt="Downloads"/>
  </a>
</p>

---

## 📸 Screenshots

<details open>
<summary><b>🎛️ Control Room</b> - Main presentation interface with live preview and queue</summary>
<br/>
<img src="docs/screenshots/control-room.png" alt="Control Room" width="100%">
</details>

<details open>
<summary><b>🎵 Songs Library</b> - Browse and search 40,000+ songs</summary>
<br/>
<img src="docs/screenshots/songs-list.png" alt="Songs Library" width="100%">
</details>

<details>
<summary><b>📝 Song Viewer</b> - View lyrics with slide navigation</summary>
<br/>
<img src="docs/screenshots/songs-view.png" alt="Song Viewer" width="100%">
</details>

<details>
<summary><b>📖 Bible</b> - Search verses with multiple translations</summary>
<br/>
<img src="docs/screenshots/bible.png" alt="Bible" width="100%">
</details>

<details>
<summary><b>📋 Service Programs</b> - Create and manage schedules</summary>
<br/>
<img src="docs/screenshots/schedules.png" alt="Schedules" width="100%">
</details>

<details>
<summary><b>🔴 Live Stream</b> - YouTube & OBS integration</summary>
<br/>
<img src="docs/screenshots/livestream.png" alt="Live Stream" width="100%">
</details>

<details>
<summary><b>⚙️ Settings</b> - Configure screens, users & preferences</summary>
<br/>
<img src="docs/screenshots/settings.png" alt="Settings" width="100%">
</details>

---

## ✨ Features

### 🎵 Song Management

| Feature | Description |
|---------|-------------|
| 📚 **Massive Library** | Store and manage **40,000+ songs** with lightning-fast full-text search |
| ✏️ **Slide Editor** | Create lyrics with verse, chorus, and bridge markers |
| 📥 **Smart Import** | Import from **OpenSong** and **PowerPoint** formats |
| 🔍 **Duplicate Detection** | AI-powered content comparison prevents duplicates |
| 🏷️ **Categories** | Organize with custom tags and categories |
| 📋 **CCLI Support** | Track license numbers, authors & copyright |

### 📖 Bible Integration

| Feature | Description |
|---------|-------------|
| 🌐 **Multiple Translations** | Support for various Bible versions |
| 🔎 **Smart Search** | Find by reference (`Gen 1:1`) or keyword |
| 📑 **Quick Navigation** | Browse Old & New Testament books |
| 👁️ **Live Preview** | See verses exactly as they'll appear on screen |

### 📋 Service Programs

| Feature | Description |
|---------|-------------|
| 📝 **Schedule Builder** | Create programs with songs, verses & custom slides |
| 🖱️ **Drag & Drop** | Intuitive reordering of service items |
| 💾 **Import/Export** | Share programs as ZIP files |
| ⚡ **Quick Load** | One-click import to presentation queue |

### 🖥️ Multi-Screen Presentation

| Screen Type | Resolution | Purpose |
|-------------|------------|---------|
| 🖥️ **Primary** | 1920×1080 | Main congregation display |
| 🎭 **Stage** | 1920×1080 | Confidence monitor for worship team |
| 📺 **Livestream** | 1080×420 | Dedicated streaming output |
| 📱 **Kiosk** | 1080×1920 | Lobby information display |

### 🔴 YouTube Livestream

| Feature | Description |
|---------|-------------|
| ▶️ **One-Click Start** | Launch broadcasts directly from the app |
| 📋 **Templates** | Save & reuse broadcast configurations |
| 📅 **Scheduled Events** | Support for pre-scheduled broadcasts |
| 🔒 **Privacy Controls** | Public, unlisted, or private streaming |
| 📊 **History** | Track all past broadcasts |

### 🎬 OBS Studio Integration

| Feature | Description |
|---------|-------------|
| 🎬 **Scene Control** | Switch OBS scenes from Church Hub |
| 🤖 **Auto-Switch** | Automatic scenes based on content type |
| 📡 **Live Status** | Real-time streaming/recording indicators |
| ⌨️ **Hotkeys** | Custom keyboard shortcuts for scenes |

### 🎚️ Audio & MIDI

| Feature | Description |
|---------|-------------|
| 🎛️ **Mixer Control** | Network-connected audio mixers (16+ channels) |
| 🔇 **Per-Scene Audio** | Automatic mute/unmute per OBS scene |
| 🎹 **MIDI Controllers** | Use hardware controllers with LED feedback |
| ⚡ **Custom Shortcuts** | Map any MIDI button to app actions |

### 👥 User Management

| Feature | Description |
|---------|-------------|
| 🎭 **Roles** | Admin, Presenter, Viewer, Queue Manager |
| 🔐 **34+ Permissions** | Granular access control |
| 📱 **QR Login** | Easy mobile device authentication |
| 👀 **Sessions** | Track active user sessions |

### 🌐 Additional Features

| Feature | Description |
|---------|-------------|
| 🌙 **Dark Mode** | Beautiful dark interface |
| 🌍 **Multi-Language** | English & Romanian support |
| 💾 **Database Backup** | Export/import your data |
| 📚 **API Docs** | Built-in Scalar documentation |

---

## 🛠️ Tech Stack

<table>
  <tr>
    <td valign="top">
      <h4>🎨 Frontend</h4>
      <ul>
        <li><b>React 19</b> - UI Framework</li>
        <li><b>TypeScript</b> - Type Safety</li>
        <li><b>Vite</b> - Build Tool</li>
        <li><b>TailwindCSS 4</b> - Styling</li>
        <li><b>TanStack Router</b> - Routing</li>
        <li><b>TanStack Query</b> - Data Fetching</li>
        <li><b>i18next</b> - i18n</li>
      </ul>
    </td>
    <td valign="top">
      <h4>⚙️ Backend</h4>
      <ul>
        <li><b>Bun</b> - Runtime</li>
        <li><b>Drizzle ORM</b> - Database</li>
        <li><b>SQLite</b> - Storage</li>
        <li><b>WebSocket</b> - Real-time</li>
        <li><b>OpenAPI 3.1</b> - API Docs</li>
      </ul>
    </td>
    <td valign="top">
      <h4>🖥️ Desktop</h4>
      <ul>
        <li><b>Tauri 2.9</b> - Framework</li>
        <li><b>Rust</b> - Performance</li>
        <li><b>Custom Plugins</b> - Extensions</li>
      </ul>
    </td>
    <td valign="top">
      <h4>🔌 Integrations</h4>
      <ul>
        <li><b>YouTube API</b> - Streaming</li>
        <li><b>OBS WebSocket</b> - Scene Control</li>
        <li><b>MIDI</b> - Hardware</li>
        <li><b>LibreOffice</b> - Conversion</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) (v1.0+)
- [Rust](https://rustup.rs/) (for Tauri builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/radio-crestin/church-hub.git
cd church-hub/app

# Install dependencies
npm install

# Start development (web only)
npm run dev:web

# Start development (desktop app)
npm run dev
```

### Access

- 🌐 **Web**: http://localhost:3000
- 📚 **API Docs**: http://localhost:3000/api/docs

### Build

```bash
# Build web apps
npm run build:apps

# Build desktop app
npm run tauri:build
```

---

## 📁 Project Structure

```
church-hub/
├── 📁 app/
│   ├── 📁 apps/
│   │   ├── 📁 client/         # 🎨 React frontend
│   │   │   └── 📁 src/
│   │   │       ├── 📁 features/   # Feature modules
│   │   │       ├── 📁 routes/     # File-based routes
│   │   │       ├── 📁 ui/         # Components
│   │   │       └── 📁 i18n/       # Translations
│   │   └── 📁 server/         # ⚙️ Bun backend
│   │       └── 📁 src/
│   │           ├── 📁 db/         # Database
│   │           ├── 📁 service/    # Business logic
│   │           └── 📁 openapi/    # API docs
│   ├── 📁 tauri/              # 🖥️ Desktop app
│   └── 📁 tauri-plugins/      # 🔌 Custom plugins
├── 📁 youtube-oauth-worker/   # ☁️ OAuth handler
└── 📁 docs/screenshots/       # 📸 Screenshots
```

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | 🖥️ Start Tauri desktop development |
| `npm run dev:web` | 🌐 Start web development |
| `npm run dev:server` | ⚙️ Start backend only |
| `npm run dev:client` | 🎨 Start frontend only |
| `npm run build:apps` | 📦 Build for production |
| `npm run tauri:build` | 🖥️ Build desktop app |
| `npm run lint` | 🔍 Run linter |
| `npm run lint:fix` | 🔧 Auto-fix issues |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. 🍴 Fork the repository
2. 🌿 Create your feature branch (`git checkout -b feature/amazing-feature`)
3. 💾 Commit your changes (`git commit -m 'Add amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/amazing-feature`)
5. 🔃 Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ for churches everywhere
</p>
