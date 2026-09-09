use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::utils::config::Color;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Emitter, Listener, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

/// No baked-in server: on first launch the user connects their own instance
/// through the setup prompt. Nothing here points at anyone in particular.
const TITLEBAR_JS: &str = include_str!("titlebar.js");
const MAIN_LABEL: &str = "main";
const SETTINGS_LABEL: &str = "settings";
const TRAY_ID: &str = "odysseus-shell-tray";

// ---------------------------------------------------------------------------
// Config: a small JSON file in the OS config dir
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppConfig {
    #[serde(default)]
    instance_url: String,
    /// Opt-in: hide to tray on window close instead of exiting.
    #[serde(default)]
    minimize_to_tray: bool,
    /// Smart-island widget mode: off | system | model | health.
    #[serde(default)]
    island_mode: String,
}

fn island_mode_of(cfg: &AppConfig) -> String {
    match cfg.island_mode.as_str() {
        "off" | "system" | "model" | "health" => cfg.island_mode.clone(),
        // Unknown or retired modes (e.g. legacy "clock") fall back.
        _ => "system".to_string(),
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            instance_url: String::new(),
            minimize_to_tray: false,
            island_mode: "system".to_string(),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    Some(app.path().app_config_dir().ok()?.join("config.json"))
}

fn load_config(app: &tauri::AppHandle) -> AppConfig {
    config_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_config(app: &tauri::AppHandle, cfg: &AppConfig) {
    if let Some(p) = config_path(app) {
        if let Some(dir) = p.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(json) = serde_json::to_string_pretty(cfg) {
            let _ = fs::write(p, json);
        }
    }
}

// ---------------------------------------------------------------------------
// URL normalization + instance validation
// ---------------------------------------------------------------------------

fn normalize_instance_url(raw: &str) -> Result<String, String> {
    let mut s = raw.trim().to_string();
    if s.is_empty() {
        return Err("Enter a URL.".into());
    }
    if !s.contains("://") {
        // Self-hosted instances are almost always HTTPS (Tailscale ts.net,
        // reverse proxies); default to it rather than plain http.
        s = format!("https://{s}");
    }
    let parsed = Url::parse(&s).map_err(|_| format!("Not a valid URL: {s}"))?;
    match parsed.scheme() {
        "http" | "https" => {}
        other => return Err(format!("Unsupported scheme “{other}” — use http(s).")),
    }
    if parsed.host_str().is_none_or(str::is_empty) {
        return Err("URL has no host.".into());
    }
    Ok(parsed.to_string().trim_end_matches('/').to_string())
}

/// GET a URL, returning the body or a friendly error.
fn fetch_text(url: &str) -> Result<String, String> {
    match ureq::get(url).timeout(Duration::from_secs(8)).call() {
        Ok(resp) => {
            if resp.status() == 200 {
                resp.into_string()
                    .map_err(|e| format!("unreadable response ({e})"))
            } else {
                Err(format!("HTTP {}", resp.status()))
            }
        }
        Err(e) => Err(friendly_ureq_error(e)),
    }
}

fn friendly_ureq_error(e: ureq::Error) -> String {
    use ureq::ErrorKind;
    match e.kind() {
        ErrorKind::Dns => "host not found (DNS) — check the address".into(),
        ErrorKind::ConnectionFailed => {
            "connection failed — is the host up and are you on the tailnet?".into()
        }
        _ => {
            let s = format!("{e}");
            s.chars().take(160).collect()
        }
    }
}

/// Does this server look like an Odysseus instance?
/// Primary signal: `/static/manifest.json` (unauthenticated, self-identifying).
/// Fallback: the login page served at the root mentions Odysseus.
/// Returns the instance display name on success.
fn check_instance(base: &str) -> Result<String, String> {
    let lower = |b: &str| b.to_ascii_lowercase().contains("odysseus");

    let mut first_err: Option<String> = None;
    match fetch_text(&format!("{base}/static/manifest.json")) {
        Ok(body) if lower(&body) => {
            return Ok(extract_json_name(&body).unwrap_or_else(|| "Odysseus".into()));
        }
        Ok(_) => {} // reachable but not the manifest we know → try fallback
        Err(e) => first_err = Some(e),
    }

    match fetch_text(base) {
        Ok(body) if lower(&body) => Ok("Odysseus".into()),
        Ok(_) => Err(
            "Server responded, but nothing identifies it as Odysseus \
             (no manifest marker, no Odysseus login page)."
                .into(),
        ),
        Err(e2) => Err(match first_err {
            Some(e1) => format!("Unreachable — {e1}; {e2}"),
            None => format!("Unreachable — {e2}"),
        }),
    }
}

/// Pull the "name" value out of the PWA manifest JSON.
fn extract_json_name(body: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v.get("name").and_then(|n| n.as_str()).map(String::from))
        .filter(|s| !s.is_empty())
}

fn validate(raw: String) -> Result<(String, String), String> {
    normalize_instance_url(&raw).and_then(|u| check_instance(&u).map(|n| (u, n)))
}

// ---------------------------------------------------------------------------
// Events (JS ⇄ Rust over core events; no custom ACL needed)
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InitPayload<'a> {
    url: &'a str,
    minimize_to_tray: bool,
    island_mode: &'a str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IslandConfigPayload {
    mode: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StatsPayload {
    rss_mb: f64,
    cpu_pct: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthPayload {
    ok: bool,
    ms: u64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IslandPref {
    mode: String,
}

#[derive(Clone, Serialize)]
struct ResultPayload {
    ok: bool,
    message: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrefPayload {
    minimize_to_tray: bool,
}

fn emit_result(handle: &tauri::AppHandle, ok: bool, message: impl Into<String>) {
    let _ = handle.emit_to(
        SETTINGS_LABEL,
        "settings://result",
        ResultPayload { ok, message: message.into() },
    );
}

/// Holder so we can show/hide the tray at runtime.
struct TrayHolder(Mutex<Option<TrayIcon>>);

impl TrayHolder {
    fn lock_slot(&self) -> std::sync::MutexGuard<'_, Option<TrayIcon>> {
        self.0.lock().unwrap()
    }
}

fn apply_tray(app: &tauri::AppHandle, on: bool) {
    let holder = app.state::<TrayHolder>();
    let mut slot = holder.lock_slot();

    if !on {
        if let Some(tray) = slot.take() {
            let _ = tray.set_visible(false);
        } // dropping removes the icon
        return;
    }

    if slot.is_some() {
        if let Some(tray) = slot.as_ref() {
            let _ = tray.set_visible(true);
        }
        return;
    }

    let open =
        MenuItem::with_id(app, "tray-open", "Open Odysseus", true, None::<&str>)
            .expect("tray menu item");
    let settings_item =
        MenuItem::with_id(app, "tray-settings", "Settings…", true, None::<&str>)
            .expect("tray menu item");
    let quit = MenuItem::with_id(app, "tray-quit", "Quit", true, None::<&str>)
        .expect("tray menu item");
    let menu = match Menu::new(app) {
        Ok(m) => {
            let _ = m.append(&open);
            let _ = m.append(&settings_item);
            let _ = m.append(&quit);
            m
        }
        Err(e) => {
            eprintln!("tray menu build failed: {e}");
            return;
        }
    };

    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Odysseus")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-open" => show_main(app),
            "tray-settings" => open_settings(app),
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    let builder =
        builder.icon(tauri::include_image!("icons/32x32.png"));

    match builder.build(app) {
        Ok(tray) => *slot = Some(tray),
        Err(e) => eprintln!("tray build failed: {e}"),
    }
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(main) = app.get_webview_window(MAIN_LABEL) {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    } else {
        // No window yet (first run): the settings wizard IS the entry point.
        open_settings(app);
    }
}

fn open_settings(app: &tauri::AppHandle) {
    if let Some(existing) = app.get_webview_window(SETTINGS_LABEL) {
        let _ = existing.set_focus();
        return;
    }
    if let Err(e) =
        WebviewWindowBuilder::new(app, SETTINGS_LABEL, WebviewUrl::App("settings.html".into()))
            .title("Odysseus · Settings")
            .inner_size(600.0, 700.0)
            .min_inner_size(520.0, 560.0)
            .resizable(false)
            .center()
            .background_color(Color(40, 44, 52, 255))
            .build()
    {
        eprintln!("failed to open settings window: {e}");
    }
}

fn build_main_window(app: &tauri::AppHandle, instance_url: &str) -> Result<(), String> {
    // Single-window boot: show local splash instantly (no network), then
    // navigate to the remote instance. No second window, no clipping.
    let url = instance_url.to_string();
    // Validate URL before we commit to building the window
    Url::parse(&url).map_err(|e| e.to_string())?;

    let window = WebviewWindowBuilder::new(app, MAIN_LABEL, WebviewUrl::App("splash.html".into()))
        .title("Odysseus")
        .inner_size(1280.0, 840.0)
        .min_inner_size(420.0, 320.0)
        .decorations(false)
        .background_color(Color(40, 44, 52, 255))
        .initialization_script(TITLEBAR_JS)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;

    // Give the splash a moment to paint, then navigate to the real instance.
    // Using eval keeps everything in the single window.
    let win = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(200));
        let _ = win.eval(format!("location.replace({:?})", url));
    });
    Ok(())
}

// --- island data helpers ----------------------------------------------------
fn read_rss_mb() -> f64 {
    fs::read_to_string("/proc/self/statm")
        .ok()
        .and_then(|s| s.split_whitespace().nth(1).and_then(|p| p.parse::<u64>().ok()))
        .map(|pages| pages as f64 * 4096.0 / 1_048_576.0)
        .unwrap_or(0.0)
}

fn read_cpu_ticks() -> u64 {
    if let Ok(s) = fs::read_to_string("/proc/self/stat") {
        if let Some(close) = s.rfind(')') {
            let fields: Vec<&str> = s[close + 1..].split_whitespace().collect();
            let utime: u64 = fields.get(11).and_then(|v| v.parse().ok()).unwrap_or(0);
            let stime: u64 = fields.get(12).and_then(|v| v.parse().ok()).unwrap_or(0);
            return utime + stime;
        }
    }
    0
}

fn read_cpu_pct(last: &mut Option<(u64, std::time::Instant)>) -> f64 {
    let ticks = read_cpu_ticks();
    let now = std::time::Instant::now();
    let pct = match *last {
        Some((prev, prev_at)) => {
            let dt = now.duration_since(prev_at).as_secs_f64();
            if dt > 0.0 {
                ((ticks as f64 - prev as f64) / 100.0 / dt * 100.0).clamp(0.0, 999.0)
            } else {
                0.0
            }
        }
        None => 0.0,
    };
    *last = Some((ticks, now));
    pct
}

fn wire_settings_events(handle: tauri::AppHandle) {
    // Clone BEFORE each move-closure: listen_any's `move` captures the whole
    // AppHandle, and we still need it for the listeners below.
    let h_ready = handle.clone();
    handle.listen_any("settings://ready", move |_| {
        let cfg = load_config(&h_ready);
        let mode = island_mode_of(&cfg);
        let _ = h_ready.emit_to(
            SETTINGS_LABEL,
            "settings://init",
            InitPayload {
                url: &cfg.instance_url,
                minimize_to_tray: cfg.minimize_to_tray,
                island_mode: &mode,
            },
        );
    });

    let h_val = handle.clone();
    handle.listen_any("settings://validate", move |evt| {
        let raw = event_url(evt.payload());
        let h = h_val.clone();
        tauri::async_runtime::spawn(async move {
            let checked =
                tauri::async_runtime::spawn_blocking(move || validate(raw)).await;
            match flatten(checked) {
                Ok((_, name)) => emit_result(&h, true, format!("Valid Odysseus instance — {name}")),
                Err(msg) => emit_result(&h, false, msg),
            }
        });
    });

    let h_save = handle.clone();
    handle.listen_any("settings://save", move |evt| {
        let raw = event_url(evt.payload());
        let h = h_save.clone();
        tauri::async_runtime::spawn(async move {
            let checked =
                tauri::async_runtime::spawn_blocking(move || validate(raw)).await;
            match flatten(checked) {
                Ok((url, name)) => {
                    let mut cfg = load_config(&h);
                    cfg.instance_url = url.clone();
                    save_config(&h, &cfg);
                    if let Some(main) = h.get_webview_window(MAIN_LABEL) {
                        // Switching instances: navigate in place.
                        let _ = main.eval(&format!("location.replace('{url}')"));
                        let _ = main.set_focus();
                    } else {
                        // First run: bring the shell to life.
                        if let Err(e) = build_main_window(&h, &cfg.instance_url) {
                            eprintln!("main window build failed: {e}");
                        }
                    }
                    let _ = h.emit_to(
                        SETTINGS_LABEL,
                        "settings://result",
                        ResultPayload {
                            ok: true,
                            message: format!("Connected to {name}"),
                        },
                    );
                    let _ = h.emit_to(SETTINGS_LABEL, "settings://saved", ());
                }
                Err(msg) => emit_result(&h, false, msg),
            }
        });
    });

    let h_pref = handle.clone();
    // Clicking the ⛵ Odysseus label in our injected titlebar opens Settings.
    // (Emitted from the remote page via core:event — allowed in caps.)
    handle.listen_any("shell://open-settings", move |_| {
        open_settings(&h_pref);
    });

    // Final listener takes ownership of the handle outright (receiver is a
    // throwaway clone so the borrow checker is happy).
    handle
        .clone()
        .listen_any("settings://pref", move |evt| {
        let payload: Option<PrefPayload> = serde_json::from_str(evt.payload()).ok();
        if let Some(pref) = payload {
            let mut cfg = load_config(&handle);
            cfg.minimize_to_tray = pref.minimize_to_tray;
            save_config(&handle, &cfg);
            apply_tray(&handle, cfg.minimize_to_tray);
            emit_result(
                &handle,
                true,
                if cfg.minimize_to_tray {
                    "Tray minimized-close enabled"
                } else {
                    "Closing the window now exits the shell"
                },
            );
        }
    });
}

fn wire_island_events(handle: tauri::AppHandle) {
    // Island asks for its configuration as soon as it injects itself.
    let h_cfg = handle.clone();
    handle.listen_any("island://ready", move |_| {
        let mode = island_mode_of(&load_config(&h_cfg));
        let _ = h_cfg.emit_to(MAIN_LABEL, "island://config", IslandConfigPayload { mode });
    });

    // Settings changed the island mode: persist + broadcast.
    handle.clone().listen_any("settings://island", move |evt| {
        let parsed: Option<IslandPref> = serde_json::from_str(evt.payload()).ok();
        if let Some(pref) = parsed {
            let mut cfg = load_config(&handle);
            cfg.island_mode = pref.mode.clone();
            save_config(&handle, &cfg);
            let _ = handle.emit(
                "island://config",
                IslandConfigPayload { mode: pref.mode.clone() },
            );
            emit_result(&handle, true, format!("Island: {}", pref.mode));
        }
    });
}

fn event_url(payload: &str) -> String {
    serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .and_then(|v| v.get("url").and_then(|u| u.as_str()).map(String::from))
        .unwrap_or_default()
}

fn flatten(res: Result<Result<(String, String), String>, tauri::Error>) -> Result<(String, String), String> {
    res.map_err(|_| "internal error".to_string())?
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

pub fn run() {
    // Desktop-only plugins; we never target mobile here. Single-instance MUST
    // be the very first registered plugin (per its docs).
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Second launch: focus what's already running — or open Settings
            // when the second launch asked for it (`odysseus-shell --settings`).
            if argv.iter().any(|a| a == "--settings") {
                open_settings(app);
            } else if load_config(app).instance_url.is_empty() {
                open_settings(app);
            } else {
                show_main(app);
            }
        }));
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
        builder = builder
            .plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    // Opt-in close-to-tray: intercept the main window's close request.
    // Reads the flag fresh each time so toggling applies immediately.
    // SAFETY VALVE: only hide if the tray icon actually exists — a failed
    // tray build + hidden window used to make the app unreachable.
    builder = builder.on_window_event(|window, event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            if window.label() == MAIN_LABEL
                && load_config(window.app_handle()).minimize_to_tray
            {
                let tray_ok = window
                    .app_handle()
                    .try_state::<TrayHolder>()
                    .map(|h| h.lock_slot().is_some())
                    .unwrap_or(false);
                if tray_ok {
                    let _ = window.hide();
                    api.prevent_close();
                }
                // else: fall through and close for real — never strand the user.
            }
        }
    });

    builder
        .setup(|app| {
            // Manage tray state up-front so apply_tray can use it anywhere.
            app.manage(TrayHolder(Mutex::new(None)));

            #[cfg(desktop)]
            {
                // Ctrl+Shift+O anywhere → settings prompt.
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
                app.global_shortcut()
                    .on_shortcut("Ctrl+Shift+O", |app, _shortcut, event| {
                        if event.state() == ShortcutState::Pressed {
                            open_settings(app);
                        }
                    })?;
            }

            let handle = app.handle().clone();
            wire_settings_events(handle.clone());
            wire_island_events(handle);

            // Smart-island data broadcasters: cheap /proc reads + health ping.
            {
                let h = app.handle().clone();
                std::thread::spawn(move || {
                    let mut last_cpu: Option<(u64, std::time::Instant)> = None;
                    loop {
                        let rss_mb = read_rss_mb();
                        let cpu_pct = read_cpu_pct(&mut last_cpu);
                        let _ = h.emit("island://stats", StatsPayload { rss_mb, cpu_pct });
                        std::thread::sleep(Duration::from_millis(2000));
                    }
                });
            }
            {
                let h = app.handle().clone();
                std::thread::spawn(move || loop {
                    let cfg = load_config(&h);
                    let (ok, ms) = if cfg.instance_url.trim().is_empty() {
                        (false, 0)
                    } else {
                        let started = std::time::Instant::now();
                        let res = ureq::get(&format!("{}/api/health", cfg.instance_url))
                            .timeout(Duration::from_secs(5))
                            .call();
                        (matches!(&res, Ok(r) if r.status() == 200),
                         started.elapsed().as_millis() as u64)
                    };
                    let _ = h.emit("island://health", HealthPayload { ok, ms });
                    std::thread::sleep(Duration::from_millis(15000));
                });
            }

            // `odysseus-shell --settings` opens the Settings window directly.
            if std::env::args().any(|a| a == "--settings") {
                open_settings(app.handle());
            }

            let cfg = load_config(app.handle());
            let first_run = cfg.instance_url.trim().is_empty();

            if first_run {
                // No instance yet: skip the main window entirely and greet the
                // user with the connect wizard.
                open_settings(app.handle());
            } else if let Err(e) = build_main_window(app.handle(), &cfg.instance_url) {
                eprintln!("saved instance URL invalid ({e}); starting over");
                open_settings(app.handle());
            }

            if cfg.minimize_to_tray {
                apply_tray(app.handle(), true);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Odysseus shell");
}
