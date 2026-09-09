# Odysseus Shell

A lightweight **native desktop shell** for any [Odysseus](https://github.com/odysseus-dev/odysseus) self-hosted AI workspace instance. Built with [Tauri 2](https://v2.tauri.app) + Rust.

Point it at your own server — home lab, VPS, NAS — ideally reachable over [Tailscale](https://tailscale.com) or LAN, and it becomes a real desktop app: own window, theme-matched chrome, tray support, per-instance logins.

> This project ships **no server and no default URL**. On first launch a setup wizard asks for your instance address and verifies it before connecting.

## Features

- 🪟 **Real native window** — frameless titlebar drawn inside the page using *your* theme's CSS variables, so the chrome always matches whatever theme is active
- 🧭 **First-run wizard** — paste your instance URL, hit **Check**, connect. The shell fingerprints the server (unauthenticated PWA manifest → login-page fallback) so typos don't slide through
- 🔁 **Multi-instance** — switch servers anytime; logins persist per-origin
- 🖥️ **Opt-in system tray** — enable "keep running in the tray" in settings; left-click restores, menu has Open / Settings / Quit
- ⌨️ **Global hotkey** — <kbd>Ctrl+Shift+O</kbd> opens Settings from anywhere
- 📌 **Single-instance** — launching twice focuses the running window
- 📐 **Window state memory** — size and position restored across restarts
- 🔒 **Least-privilege IPC** — remote pages get only window-drag/resize/close controls over HTTPS origins; nothing else

## Install

Grab a package from Releases:

| File | For |
| --- | --- |
| `*.rpm` | Fedora / openSUSE / RHEL |
| `*.deb` | Debian / Ubuntu / Mint |
| `*.AppImage` | Anything else (portable, just run it) |

Flatpak packaging is tracked as a future item.

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
git clone <this-repo>
cd odysseus-shell
npx --yes @tauri-apps/cli@2 build            # debug run: replace build with dev
# packages land in src-tauri/target/release/bundle/
```

## Usage notes

- **Settings**: <kbd>Ctrl</kbd>+<kbd>Shift</kbd><kbd>O</kbd>, click the ⛵ label in the titlebar, or right-click the tray icon.
- **Titlebar**: drag empty areas to move; double-click toggles maximize; buttons on the right.
- **Config**: stored at `~/.config/app.odysseus.desktop/config.json` (Linux). Delete it to re-run the wizard.
- **Troubleshooting rendering** (older Intel iGPUs): try `WEBKIT_DISABLE_DMABUF_RENDERER=1 odysseus-shell`.

## Security model

The shell grants remote pages the minimum needed to behave like window chrome: start-dragging, maximize toggle, minimize, close, and event emission — restricted to `https://` origins. It reads no page data, injects no credentials, phones nobody. All traffic goes directly from the embedded webview to *your* server.

## License

MIT — see [LICENSE](LICENSE).
