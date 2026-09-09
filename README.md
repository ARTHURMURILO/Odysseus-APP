# Odysseus Shell

A lightweight **native desktop shell** for any self-hosted [Odysseus](https://github.com/odysseus-dev/odysseus) AI workspace instance. Built with [Tauri 2](https://v2.tauri.app) + Rust — no Electron was a deliberate choice for performance.

Point it at your own server — home lab, VPS, NAS — reachable over [Tailscale](https://tailscale.com), LAN, or localhost, and it becomes a real desktop app: own window, theme-matched chrome, tray support, per-instance logins.

> This project ships **no server and no default URL**. On first launch a setup wizard asks for your instance address and verifies it before connecting. The shell itself is MIT; it is a front-end interface to whatever Odysseus-compatible back end you connect it to.

---

## Download

Go to the [Releases](https://github.com/ARTHURMURILO/Odysseus-APP/releases) page and download the package for your platform.

| Platform          | File          |
| ----------------- | ------------- |
| Fedora / RHEL / openSUSE | `*.rpm` |
| Debian / Ubuntu / Mint   | `*.deb` |
| Anything else     | `*.AppImage` (portable, just run it) |

## Requirements

You need a running Odysseus-compatible instance. Odysseus Shell is a launcher — it connects to your own self-hosted server and keeps no data of its own.

## Features

- **Animated splash screen** with a drifting constellation backdrop
- **Smart setup wizard** — paste any instance URL (Tailscale `*.ts.net`, LAN address, or localhost), with per-field guidance
  - Tooltips on every field explaining what to enter
  - **Silent connection probing** — the server is fingerprinted (PWA manifest → login-page fallback) before switching, so typos never strand you on a browser error page
- **Real native window** — frameless titlebar drawn inside the page using *your* theme's CSS variables, so the chrome always matches whatever theme is active
- **Sidebar status widget** — clock + date header with a smart island underneath: live system load, active model, or server latency
- **Opt-in system tray** — enable "keep running in the tray" in settings; left-click restores, menu has Open / Settings / Quit
- **Global hotkey** — <kbd>Ctrl+Shift+O</kbd> opens Settings from anywhere
- **Single-instance** — launching twice focuses the running window
- **Window state memory** — size and position restored across restarts
- **Least-privilege IPC** — remote pages get only window-drag/resize/close controls over `https://` origins; nothing else

## Setup

1. Download and run the installer for your platform
2. On first launch the **Welcome aboard** wizard appears
3. Paste your instance URL — e.g. `https://your-host.tailXXXX.ts.net`, `http://192.168.1.10:7000`, or `http://localhost:7000` — and hit **Check**
4. Hit **Save & connect** — done. Your logins stay per-instance

Your address is saved — future launches connect automatically without showing the setup screen. To switch servers later, press <kbd>Ctrl+Shift+O</kbd>, click the ⛵ label in the titlebar, or right-click the tray icon.

## Building from source

Prerequisites: Rust toolchain, Node.js (for the Tauri CLI), and on Linux WebKitGTK 4.1 + friends:

```bash
# Fedora
sudo dnf install cargo webkit2gtk4.1-devel gtk3-devel librsvg2-devel \
  patchelf gst-libav libayatana-appindicator-gtk3-devel

# Debian/Ubuntu
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

```bash
git clone https://github.com/ARTHURMURILO/Odysseus-APP.git
cd Odysseus-APP
npx --yes @tauri-apps/cli@2 build            # debug run: replace build with dev
# packages land in src-tauri/target/release/bundle/
```

## Usage notes

- **Settings**: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>, click the ⛵ label in the titlebar, or right-click the tray icon.
- **Titlebar**: drag empty areas to move; double-click toggles maximize; buttons on the right.
- **Config**: stored at `~/.config/app.odysseus.desktop/config.json` (Linux). Delete it to re-run the wizard.
- **Troubleshooting rendering** (older Intel iGPUs): try `WEBKIT_DISABLE_DMABUF_RENDERER=1 odysseus-shell`.

## Security model

The shell grants remote pages the minimum needed to behave like window chrome: start-dragging, maximize toggle, minimize, close, and event emission — restricted to `https://` origins. It reads no page data, injects no credentials, phones nobody. All traffic goes directly from the embedded webview to *your* server.

## License

MIT — see [LICENSE](LICENSE).
