// odysseus-shell — injected titlebar + boot overlay + smart island + clock
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
    `#ody-boot .ody-boot-word{color:#e06c75;font-size:16px;letter-spacing:.6px;}\n` +
    `#ody-boot .ody-boot-track{width:150px;height:3px;border-radius:999px;background:#31353f;overflow:hidden;}\n` +
    `#ody-boot .ody-boot-fill{width:45%;height:100%;background:#e06c75;border-radius:inherit;animation:ody-boot-slide 1.1s ease-in-out infinite;}\n` +
    `@keyframes ody-boot-slide{0%{transform:translateX(-60%)}50%{transform:translateX(120%)}100%{transform:translateX(220%)}}\n` +
    `#sidebar-brand-btn{display:none!important;}\n` +
    `#ody-clock{display:flex;align-items:center;justify-content:center;gap:6px;margin:8px 10px 0;padding:12px 16px;border:1px solid var(--border,#3a3f4b);border-radius:12px;background:var(--panel,#31353f);color:var(--fg,#abb2bf);font-family:var(--font-family,"Fira Code",monospace);font-size:14px;font-weight:600;line-height:1.2;align-self:stretch;white-space:nowrap;font-variant-numeric:tabular-nums;letter-spacing:.4px;}\n` +
    `#ody-island{display:flex;align-items:center;gap:8px;margin:8px;padding:8px 12px;border:1px solid var(--border,#3a3f4b);border-radius:10px;background:var(--panel,#31353f);color:var(--color-muted,var(--fg,#abb2bf));font-family:var(--font-family,"Fira Code",monospace);font-size:11.5px;line-height:1.4;cursor:pointer;user-select:none;-webkit-user-select:none;max-width:calc(100% - 16px);white-space:nowrap;overflow:hidden;align-self:center;}\n` +
    `#ody-island:hover{border-color:var(--color-muted,var(--fg,#abb2bf));}\n` +
    `#ody-island .ody-isl-dot{width:7px;height:7px;border-radius:50%;background:var(--green,#98c379);flex:0 0 auto;}\n` +
    `#ody-island.warn .ody-isl-dot{background:var(--red,#e06c75);}\n` +
    `#ody-island .ody-isl-txt{overflow:hidden;text-overflow:ellipsis;}\n` +
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
    bootSail.setAttribute("width", "44");
    bootSail.setAttribute("height", "44");
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

  // --- Smart Island + Clock -----------------------------------------------
  function buildIsland() {
    const sb = document.querySelector(".sidebar");
    if (!sb) return;

    if (!document.getElementById("ody-clock")) {
      const clock = document.createElement("div");
      clock.id = "ody-clock";
      const clockTxt = document.createElement("span");
      clockTxt.className = "ody-clock-txt";
      clock.append(clockTxt);
      const target = sb.querySelector(".sidebar-inner");
      if (target) sb.insertBefore(clock, target);
      else sb.prepend(clock);
      const updClock = () => {
        clockTxt.textContent = new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
      };
      updClock();
      setInterval(updClock, 60000);
    }

    if (document.getElementById("ody-island")) return;
    const isl = document.createElement("div");
    isl.id = "ody-island";
    isl.title = "Odysseus Shell — click for settings";
    const dot = document.createElement("span");
    dot.className = "ody-isl-dot";
    const txt = document.createElement("span");
    txt.className = "ody-isl-txt";
    isl.append(dot, txt);
    isl.addEventListener("click", () => {
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
    const target2 = document
      .querySelector(".sidebar")
      ?.querySelector(".sidebar-inner");
    const sb2 = document.querySelector(".sidebar");
    if (sb2) {
      if (target2) sb2.insertBefore(isl, target2);
      else sb2.appendChild(isl);
    }

    let mode = "system";
    let lastStats = null,
      lastHealth = null;

    function render() {
      isl.classList.toggle("warn", false);
      if (mode === "system") {
        if (lastStats) {
          txt.textContent =
            lastStats.rssMb.toFixed(0) +
            " · " +
            lastStats.cpuPct.toFixed(1) +
            "%";
        } else {
          txt.textContent = "\u2026 MB";
        }
      } else if (mode === "clock") {
        txt.textContent = new Date().toTimeString().slice(0, 8);
      } else if (mode === "model") {
        const el = document.getElementById("model-picker-label");
        txt.textContent = el ? el.textContent.trim() || "model" : "model";
      } else if (mode === "health") {
        if (!lastHealth) {
          txt.textContent = "\u2026";
        } else if (lastHealth.ok) {
          txt.textContent = lastHealth.ms + " ms";
        } else {
          txt.textContent = "offline";
          isl.classList.add("warn");
        }
      } else {
        txt.textContent = "";
      }
    }
    function applyMode() {
      isl.style.display = mode === "off" ? "none" : "flex";
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
    render();
    askConfig();
    setInterval(() => {
      if (mode === "clock") render();
    }, 1000);
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
