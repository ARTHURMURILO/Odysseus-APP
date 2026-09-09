// odysseus-shell — injected titlebar + boot overlay + sidebar status widget
(() => {
  if (document.getElementById("ody-titlebar")) return;

  const BAR_H = "38px";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const style = document.createElement("style");
  style.id = "ody-titlebar-style";
  style.textContent =
    `html{--ody-bar-h:${BAR_H};}\n` +
    `body{box-sizing:border-box!important;padding-top:var(--ody-bar-h)!important;height:100%!important;height:100dvh!important;}\n` +
    `:root.ui-scale-125 body{height:calc(100dvh / 1.25)!important;}\n` +
    `body .toast{top:calc(var(--ody-bar-h) + 16px)!important;}\n` +
    `#ody-boot{position:fixed;inset:0;z-index:2147483647;background:#282c34;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:var(--font-family,"Fira Code",monospace);}\n` +
    `#ody-boot .ody-boot-word{color:#e06c75;font-size:20px;letter-spacing:.6px;}\n` +
    `#ody-boot .ody-boot-track{width:170px;height:3px;border-radius:999px;background:#31353f;overflow:hidden;}\n` +
    `#ody-boot .ody-boot-fill{width:45%;height:100%;background:#e06c75;border-radius:inherit;animation:ody-boot-slide 1.1s ease-in-out infinite;}\n` +
    `@keyframes ody-boot-slide{0%{transform:translateX(-60%)}50%{transform:translateX(120%)}100%{transform:translateX(220%)}}\n` +
    `@media (prefers-reduced-motion:reduce){#ody-boot .ody-boot-fill{animation:none;}}\n` +
    `#sidebar-brand-btn{display:none!important;}\n` +
    `#ody-status{align-self:stretch;margin:10px 10px 8px;padding:10px 12px 9px;display:flex;flex-direction:column;gap:7px;border:1px solid var(--border,#3a3f4b);border-radius:10px;background:var(--panel,#31353f);color:var(--fg,#abb2bf);font-family:var(--font-family,"Fira Code",monospace);cursor:pointer;user-select:none;-webkit-user-select:none;min-width:0;box-sizing:border-box;}\n` +
    `#ody-status:hover{border-color:var(--color-muted,var(--fg,#abb2bf));}\n` +
    `#ody-status .ody-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}\n` +
    `#ody-status .ody-time{font-size:15px;font-weight:600;letter-spacing:.3px;line-height:1.1;font-variant-numeric:tabular-nums;}\n` +
    `#ody-status .ody-date{font-size:11px;color:var(--color-muted,var(--fg,#abb2bf));opacity:.75;white-space:nowrap;}\n` +
    `#ody-status .ody-div{height:1px;background:var(--border,#3a3f4b);opacity:.7;}\n` +
    `#ody-status .ody-sub{display:flex;align-items:center;gap:7px;min-width:0;}\n` +
    `#ody-status .ody-isl-dot{width:7px;height:7px;border-radius:50%;background:var(--green,#98c379);flex:0 0 auto;}\n` +
    `#ody-status.warn .ody-isl-dot{background:var(--red,#e06c75);}\n` +
    `#ody-status .ody-isl-txt{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;color:var(--color-muted,var(--fg,#abb2bf));font-variant-numeric:tabular-nums;}\n` +
    `#ody-status .ody-tag{flex:0 0 auto;font-size:9px;letter-spacing:1px;opacity:.55;text-transform:uppercase;}\n` +
    `#ody-titlebar{position:fixed;top:0;left:0;right:0;height:var(--ody-bar-h);display:flex;align-items:center;gap:8px;padding-right:2px;background:var(--bg,#282c34);border-bottom:1px solid var(--border,#3a3f4b);z-index:2147483646;user-select:none;-webkit-user-select:none;font-family:var(--font-family,"Fira Code",monospace);}\n` +
    `#ody-titlebar .ody-brand{display:flex;align-items:center;gap:7px;height:100%;padding:0 12px;color:var(--color-muted,var(--fg,#abb2bf));font-size:12px;letter-spacing:.4px;cursor:pointer;}\n` +
    `#ody-titlebar .ody-brand:hover{background:var(--panel,#31353f);color:var(--fg,#abb2bf);}\n` +
    `#ody-titlebar .ody-btn{width:42px;height:100%;margin:0;border:0;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;color:var(--fg,#abb2bf);opacity:.72;cursor:pointer;}\n` +
    `#ody-titlebar .ody-btn:first-of-type{margin-left:auto;}\n` +
    `#ody-titlebar .ody-btn:hover{background:var(--panel,#31353f);opacity:1;}\n` +
    `#ody-titlebar .ody-btn.close:hover{background:#e0434b;color:#fff;}`;

  function svgEl(tag, attrs) {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  }
  function svgIcon(children) {
    const s = svgEl("svg", {
      width: 15,
      height: 15,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    for (const c of children) s.appendChild(c);
    return s;
  }
  function svgPath(d, extra) {
    return svgEl("path", Object.assign({ d }, extra || {}));
  }

  const SAIL = (() => {
    const s = svgEl("svg", { width: 14, height: 14, viewBox: "0 0 32 32" });
    s.appendChild(svgPath("M16 4L16 22L6 22Z", { fill: "#e06c75" }));
    s.appendChild(
      svgPath("M16 8L16 22L24 22Z", { fill: "#e06c75", opacity: "0.6" }),
    );
    s.appendChild(
      svgPath("M4 24Q10 20 16 24Q22 28 28 24", {
        stroke: "#e06c75",
        "stroke-width": "2.5",
        fill: "none",
        "stroke-linecap": "round",
      }),
    );
    return s;
  })();

  function makeButton(id, cls, title, children) {
    const b = document.createElement("button");
    b.id = id;
    b.className = cls;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.appendChild(svgIcon(children));
    return b;
  }
  const btnMin = makeButton("ody-min", "ody-btn", "Minimize", [
    svgEl("line", { x1: 5, y1: 12, x2: 19, y2: 12 }),
  ]);
  const btnMax = makeButton("ody-max", "ody-btn", "Maximize / restore", [
    svgEl("rect", { x: 6, y: 6, width: 12, height: 12, rx: 1.5 }),
  ]);
  const btnClose = makeButton("ody-close", "ody-btn close", "Close", [
    svgEl("line", { x1: 6, y1: 6, x2: 18, y2: 18 }),
    svgEl("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
  ]);

  const brand = document.createElement("span");
  brand.className = "ody-brand";
  const brandText = document.createElement("span");
  brandText.textContent = "Odysseus";
  brand.appendChild(SAIL.cloneNode(true));
  brand.appendChild(brandText);
  brand.title = "Odysseus Shell — settings";
  brand.addEventListener("click", () => {
    try {
      window.__TAURI_INTERNALS__.invoke("plugin:event|emit_to", {
        target: { kind: "Any" },
        event: "shell://open-settings",
        payload: "null",
      });
    } catch {
      /* shell unavailable */
    }
  });

  const bar = document.createElement("div");
  bar.id = "ody-titlebar";
  bar.setAttribute("data-tauri-drag-region", "");
  bar.append(brand, btnMin, btnMax, btnClose);

  function inv(cmd) {
    try {
      window.__TAURI_INTERNALS__.invoke(cmd);
    } catch {
      /* shell went away mid-click */
    }
  }
  btnMin.addEventListener("click", () => inv("plugin:window|minimize"));
  btnMax.addEventListener("click", () =>
    inv("plugin:window|internal_toggle_maximize"),
  );
  btnClose.addEventListener("click", () => inv("plugin:window|close"));

  document.documentElement.appendChild(style);
  document.documentElement.appendChild(bar);

  // --- in-page boot overlay (only for the remote page, not local splash.html) --
  if (!location.pathname.includes("splash.html")) {
    const boot = document.createElement("div");
    boot.id = "ody-boot";
    const bootSail = SAIL.cloneNode(true);
    bootSail.setAttribute("width", "64");
    bootSail.setAttribute("height", "64");
    const bootWord = document.createElement("div");
    bootWord.className = "ody-boot-word";
    bootWord.textContent = "Odysseus";
    const bootTrack = document.createElement("div");
    bootTrack.className = "ody-boot-track";
    const bootFill = document.createElement("div");
    bootFill.className = "ody-boot-fill";
    bootTrack.appendChild(bootFill);
    boot.append(bootSail, bootWord, bootTrack);
    document.documentElement.appendChild(boot);
    let bootDismissed = false;
    function dismissBoot() {
      if (bootDismissed) return;
      bootDismissed = true;
      boot.remove();
    }
    window.addEventListener("load", () => setTimeout(dismissBoot, 250));
    setTimeout(dismissBoot, 10000);
  }

  // --- Shell status widget (clock + smart island, unified) ------------------
  // One compact card pinned to the top of the sidebar: a persistent clock row
  // (time + date) above a hairline, then a mode-dependent status row
  // (system / model / health) with a micro label. The clock/date header is always shown.
  function buildIsland() {
    // Drop legacy split widgets from older shell versions, if present.
    const legacyClock = document.getElementById("ody-clock");
    if (legacyClock) legacyClock.remove();
    const legacyIsle = document.getElementById("ody-island");
    if (legacyIsle) legacyIsle.remove();

    const sb = document.querySelector(".sidebar");
    if (!sb) return;
    if (document.getElementById("ody-status")) return;

    const widget = document.createElement("div");
    widget.id = "ody-status";
    widget.title = "Odysseus Shell — click for settings";

    const top = document.createElement("div");
    top.className = "ody-top";
    const timeEl = document.createElement("span");
    timeEl.className = "ody-time";
    const dateEl = document.createElement("span");
    dateEl.className = "ody-date";
    top.append(timeEl, dateEl);

    const div = document.createElement("div");
    div.className = "ody-div";

    const sub = document.createElement("div");
    sub.className = "ody-sub";
    const dot = document.createElement("span");
    dot.className = "ody-isl-dot";
    const txt = document.createElement("span");
    txt.className = "ody-isl-txt";
    const tag = document.createElement("span");
    tag.className = "ody-tag";
    sub.append(dot, txt, tag);

    widget.append(top, div, sub);
    widget.setAttribute("tabindex", "0");
    widget.setAttribute("role", "button");
    widget.setAttribute("aria-label", "Odysseus Shell — open settings");
    function openSettings() {
      try {
        window.__TAURI_INTERNALS__.invoke("plugin:event|emit_to", {
          target: { kind: "Any" },
          event: "shell://open-settings",
          payload: "null",
        });
      } catch {
        /* shell unavailable */
      }
    }
    widget.addEventListener("click", openSettings);
    widget.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openSettings();
      }
    });
    const anchor = sb.querySelector(".sidebar-inner");
    if (anchor) sb.insertBefore(widget, anchor);
    else sb.prepend(widget);

    let mode = "system";
    let lastStats = null,
      lastHealth = null;

    function tickClock() {
      const now = new Date();
      timeEl.textContent = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      dateEl.textContent = now
        .toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
        .replace(/,/g, "");
    }

    function render() {
      widget.classList.toggle("warn", false);
      dot.style.display = "";
      txt.removeAttribute("title");
      if (mode === "system") {
        tag.textContent = "local";
        txt.textContent = lastStats
          ? lastStats.rssMb.toFixed(0) +
            " MB \u00B7 " +
            lastStats.cpuPct.toFixed(1) +
            "%"
          : "\u2026";
      } else if (mode === "model") {
        tag.textContent = "model";
        dot.style.display = "none";
        const el = document.getElementById("model-picker-label");
        const name = el ? el.textContent.trim() : "";
        txt.textContent = name || "model";
        txt.title = txt.textContent;
      } else if (mode === "health") {
        tag.textContent = "server";
        if (!lastHealth) {
          txt.textContent = "\u2026";
        } else if (lastHealth.ok) {
          txt.textContent = lastHealth.ms + " ms";
        } else {
          txt.textContent = "offline";
          widget.classList.add("warn");
        }
      } else {
        txt.textContent = "";
        tag.textContent = "";
      }
    }
    function applyMode() {
      widget.style.display = mode === "off" ? "none" : "flex";
      render();
    }

    function on(ev, cb) {
      try {
        const h = window.__TAURI_INTERNALS__.transformCallback(cb);
        window.__TAURI_INTERNALS__.invoke("plugin:event|listen", {
          event: ev,
          target: { kind: "Any" },
          handler: h,
        });
      } catch {
        /* shell unavailable */
      }
    }
    on("island://stats", (e) => {
      lastStats = e.payload || e;
      if (mode === "system") render();
    });
    on("island://health", (e) => {
      lastHealth = e.payload || e;
      if (mode === "health") render();
    });
    on("island://config", (e) => {
      const pl = e.payload || e;
      cfgArrived = true;
      mode = (pl && pl.mode) || "system";
      if (["off", "system", "model", "health"].indexOf(mode) === -1) mode = "system";
      applyMode();
    });

    let cfgArrived = false;
    let tries = 0;
    const askConfig = () => {
      if (cfgArrived || tries++ > 24) return;
      try {
        window.__TAURI_INTERNALS__.invoke("plugin:event|emit_to", {
          target: { kind: "Any" },
          event: "island://ready",
          payload: "null",
        });
      } catch {
        /* shell unavailable */
      }
      setTimeout(askConfig, 250);
    };
    tickClock();
    render();
    askConfig();
    setInterval(tickClock, 10000);
    setInterval(() => {
      if (mode === "model") render();
    }, 3000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildIsland);
  } else {
    buildIsland();
  }
})();
