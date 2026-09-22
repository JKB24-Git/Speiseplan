(function () {
  "use strict";

  /* ------------------------------------------------------------
     Einstellungen und Texte (hier kannst du alles anpassen)
     Zum Ändern einer Zeile: Datei auf GitHub öffnen, Stift-Symbol klicken,
     Zeile ändern, "Commit changes". Die ganze Datei ersetzen ist nicht nötig.
     ------------------------------------------------------------ */
  var TEXT = {
    loading: "Speiseplan wird geladen …",
    noWeeks: "Es wurde noch kein Speiseplan veröffentlicht.",
    loadError: "Der Speiseplan konnte nicht geladen werden. Bitte später noch einmal versuchen.",
    weekError: "Der Speiseplan für diese Woche kann nicht angezeigt werden.",
    unknownWeek: "Diese Woche wurde nicht gefunden. Angezeigt wird die aktuelle Woche.",
    outdated: "Für die laufende Woche wurde noch kein Speiseplan veröffentlicht. Angezeigt wird der letzte Plan.",
    notCurrent: "Dieser Plan ist nicht mehr aktuell.",
    toCurrent: "Zur aktuellen Woche",
    noEntries: "Keine Angaben",
    today: "Heute",
    calendarWeek: "Kalenderwoche",
    weekOption: "KW {kw} (ab {date})",
    unknownAllergen: "Unbekannter Code",
    allergensPrefix: "Allergene: ",
    detailHint: "Foto und Beschreibung ansehen",
    detailClose: "Schließen"
  };

  var MEALS = [
    { key: "lunch", label: "Mittagessen" },
    { key: "dinner", label: "Abendessen" }
  ];

  var DAY_NAMES = ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"];
  var FILE_RE = /^\d{4}-\d{2}-\d{2}\.json$/;

  /* ------------------------------------------------------------
     Hilfsfunktionen
     ------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    // Immer textContent, nie innerHTML: Inhalte aus den Dateien können so keinen Code einschleusen.
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function canHover() {
    return !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function formatDate(d) { return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear(); }
  function formatShort(d) { return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "."; }

  function dateFromFile(file) {
    var p = file.slice(0, 10).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function mondayOf(d) {
    var m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  }

  function addDays(d, n) {
    var r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() + n);
    return r;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // Kalenderwoche nach ISO 8601: Es gibt keine Woche 0. Die Woche mit dem ersten Donnerstag
  // des Jahres ist KW 1. Der 28.12.2026 bis 03.01.2027 ist noch KW 53, KW 1 2027 beginnt am 04.01.2027.
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
    var firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((t - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  }

  function stem(file) { return file.replace(/\.json$/, ""); }

  function fetchJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(url + ": " + res.status);
      return res.json();
    });
  }

  function fetchText(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(url + ": " + res.status);
      return res.text();
    });
  }

  /* ---------- Farben ---------- */

  // Nur #rgb oder #rrggbb erlaubt; alles andere wird ignoriert.
  function validColor(value) {
    if (typeof value !== "string") return null;
    var v = value.trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(v)) v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return /^#[0-9a-f]{6}$/.test(v) ? v : null;
  }

  // Schwarze oder weiße Schrift, je nachdem was auf der Farbe besser lesbar ist.
  function inkFor(hex) {
    var n = parseInt(hex.slice(1), 16);
    function lin(c) { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    var whiteContrast = 1.05 / (L + 0.05);
    var blackContrast = (L + 0.05) / 0.05;
    return whiteContrast >= blackContrast ? "#ffffff" : "#111111";
  }

  /* ---------- Kleines Kamera-Symbol (zeigt Foto+Beschreibung an) ---------- */
  function dishIcon() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.classList.add("dish-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var body = document.createElementNS(NS, "rect");
    body.setAttribute("x", "2"); body.setAttribute("y", "5.4");
    body.setAttribute("width", "16"); body.setAttribute("height", "11.6");
    body.setAttribute("rx", "2");
    body.setAttribute("fill", "none"); body.setAttribute("stroke", "currentColor"); body.setAttribute("stroke-width", "1.5");
    var bump = document.createElementNS(NS, "rect");
    bump.setAttribute("x", "7"); bump.setAttribute("y", "3"); bump.setAttribute("width", "6"); bump.setAttribute("height", "2.4");
    bump.setAttribute("rx", "1"); bump.setAttribute("fill", "currentColor");
    var lens = document.createElementNS(NS, "circle");
    lens.setAttribute("cx", "10"); lens.setAttribute("cy", "11.4"); lens.setAttribute("r", "3.1");
    lens.setAttribute("fill", "none"); lens.setAttribute("stroke", "currentColor"); lens.setAttribute("stroke-width", "1.5");
    svg.appendChild(body); svg.appendChild(bump); svg.appendChild(lens);
    return svg;
  }

  /* ------------------------------------------------------------
     Zustand
     ------------------------------------------------------------ */
  var state = {
    files: [],        // alle Wochen-Dateien, neueste zuerst
    allergens: [],    // Liste in der Reihenfolge von allergens.json
    allergenByCode: {},
    dishes: {},        // Name (getrimmt) -> { image, description } aus dishes.json
    request: 0,        // schützt vor Durcheinander bei schnellem Klicken
    firstView: true    // nur beim ersten Aufbau nicht animieren / zum heutigen Tag scrollen
  };

  var ui = {
    plan: $("plan"),
    notice: $("notice"),
    label: $("week-label"),
    meta: $("week-meta"),
    select: $("week-select"),
    prev: $("prev"),
    next: $("next"),
    legend: $("legend"),
    panel: document.querySelector(".panel")
  };

  function setAllergens(data) {
    var list = [];
    if (Array.isArray(data)) {
      data.forEach(function (a) {
        if (a && typeof a.code === "string" && a.code.trim()) {
          list.push({ code: a.code.trim().toUpperCase(), name: String(a.name || ""), color: validColor(a.color) });
        }
      });
    } else if (data && typeof data === "object") {
      // Altes Format {"A": "Gluten", ...}: alphabetisch, ohne Farben
      Object.keys(data).sort().forEach(function (code) {
        list.push({ code: code.toUpperCase(), name: String(data[code]), color: null });
      });
    }
    state.allergens = list;
    state.allergenByCode = {};
    list.forEach(function (a, i) { a.order = i; state.allergenByCode[a.code] = a; });
  }

  // dishes.json: { "Genauer Gerichtename": { "image": "images/….jpg", "description": "…" }, … }
  function setDishes(data) {
    var map = {};
    if (data && typeof data === "object" && !Array.isArray(data)) {
      Object.keys(data).forEach(function (name) {
        var entry = data[name];
        if (!entry || typeof entry !== "object") return;
        var image = typeof entry.image === "string" && entry.image.trim() ? entry.image.trim() : null;
        var description = typeof entry.description === "string" && entry.description.trim() ? entry.description.trim() : null;
        var key = name.trim();
        if (key && (image || description)) map[key] = { image: image, description: description };
      });
    }
    state.dishes = map;
  }

  /* ------------------------------------------------------------
     Anzeige
     ------------------------------------------------------------ */
  function showNotice(message, linkText) {
    ui.notice.textContent = "";
    if (!message) { ui.notice.hidden = true; return; }
    ui.notice.appendChild(document.createTextNode(message));
    if (linkText) {
      ui.notice.appendChild(document.createTextNode(" "));
      var a = el("a", "", linkText);
      a.href = "#";
      ui.notice.appendChild(a);
    }
    ui.notice.hidden = false;
  }

  function showMessage(message) {
    ui.plan.textContent = "";
    ui.plan.appendChild(el("p", "empty day", message));
  }

  // Ein Allergen-Kästchen; Farbe und Name kommen aus allergens.json
  function makeChip(code, options) {
    var info = state.allergenByCode[code];
    var chip = el("span", "al" + (info ? "" : " al-unknown"));
    chip.setAttribute("data-code", code);
    if (info && info.color) {
      // Über die Style-Eigenschaften (nicht per HTML-Attribut), damit die Sicherheitsregel in index.html nicht stört.
      chip.style.backgroundColor = info.color;
      chip.style.color = inkFor(info.color);
    }
    var letter = el("span", "", code);
    if (options && options.hidden) {
      chip.title = info ? info.name : TEXT.unknownAllergen;
      letter.setAttribute("aria-hidden", "true");
    }
    chip.appendChild(letter);
    return chip;
  }

  function allergenChips(codes) {
    var wrap = el("div", "allergens");
    wrap.appendChild(el("span", "sr", TEXT.allergensPrefix));
    var seen = {};
    var list = codes
      .map(function (c) { return String(c).trim().toUpperCase(); })
      .filter(function (c) { if (!c || seen[c]) return false; seen[c] = true; return true; });

    // Reihenfolge wie in allergens.json (also wie auf dem Aushang); unbekannte Codes ans Ende
    function rank(c) { return state.allergenByCode[c] ? state.allergenByCode[c].order : 1000 + c.charCodeAt(0); }
    list.sort(function (a, b) { return rank(a) - rank(b); });

    list.forEach(function (code, i) {
      var info = state.allergenByCode[code];
      var chip = makeChip(code, { hidden: true });
      chip.appendChild(el("span", "sr", (info ? info.name : TEXT.unknownAllergen) + (i < list.length - 1 ? ", " : "")));
      wrap.appendChild(chip);
    });
    return wrap;
  }

  /* ---------- Foto/Beschreibung: Vorschau beim Überfahren mit der Maus ---------- */
  var hoverBox = null;
  var hoverTimer = null;

  function ensureHoverBox() {
    if (hoverBox) return hoverBox;
    hoverBox = el("div", "hover-preview");
    hoverBox.appendChild(el("img"));
    hoverBox.hidden = true;
    document.body.appendChild(hoverBox);
    return hoverBox;
  }

  function positionHoverBox(trigger) {
    var box = ensureHoverBox();
    var r = trigger.getBoundingClientRect();
    var left = r.left + window.scrollX;
    var maxLeft = window.scrollX + document.documentElement.clientWidth - 176;   // Vorschau bleibt im Bild
    if (left > maxLeft) left = Math.max(window.scrollX + 8, maxLeft);
    box.style.left = left + "px";
    box.style.top = (r.top + window.scrollY) + "px";
  }

  function showHoverBox(trigger, src) {
    var box = ensureHoverBox();
    box.querySelector("img").src = src;
    positionHoverBox(trigger);
    box.hidden = false;
    void box.offsetWidth;   // Reflow erzwingen, damit die folgende Klasse den Übergang auslöst
    box.classList.add("is-visible");
  }

  function hideHoverBox() {
    if (!hoverBox) return;
    hoverBox.classList.remove("is-visible");
  }

  function attachHoverPreview(trigger, image) {
    if (!image || !canHover()) return;   // nur auf Geräten mit Maus, und nur wenn ein Foto vorhanden ist
    trigger.addEventListener("mouseenter", function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { showHoverBox(trigger, image); }, 120);
    });
    trigger.addEventListener("mouseleave", function () {
      clearTimeout(hoverTimer);
      hideHoverBox();
    });
    trigger.addEventListener("blur", hideHoverBox);
  }

  /* ---------- Foto/Beschreibung: Dialog beim Anklicken ---------- */
  var detail = null;
  var detailTrigger = null;

  function ensureDetail() {
    if (detail) return detail;

    var overlay = el("div", "detail-overlay");
    overlay.hidden = true;

    var dialog = el("div", "detail-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "detail-title");
    dialog.tabIndex = -1;

    var closeBtn = el("button", "detail-close", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", TEXT.detailClose);
    closeBtn.addEventListener("click", closeDetail);

    var title = el("h3", "detail-title");
    title.id = "detail-title";

    var content = el("div", "detail-content");
    var media = el("div", "detail-media");
    var img = el("img");
    img.loading = "lazy";
    media.appendChild(img);

    var body = el("div", "detail-body");
    var desc = el("p", "detail-description");
    var allergenWrap = el("div", "detail-allergens");

    body.appendChild(desc);
    body.appendChild(allergenWrap);
    content.appendChild(media);
    content.appendChild(body);

    dialog.appendChild(closeBtn);
    dialog.appendChild(title);
    dialog.appendChild(content);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeDetail(); });

    detail = { overlay: overlay, dialog: dialog, closeBtn: closeBtn, title: title, media: media, img: img, desc: desc, allergenWrap: allergenWrap, closeTimer: null };
    return detail;
  }

  function onDetailKeydown(e) {
    if (e.key === "Escape") { closeDetail(); return; }
    if (e.key === "Tab") {
      // Im Dialog gibt es nur den Schließen-Button als Ziel: Fokus dort festhalten.
      e.preventDefault();
      detail.closeBtn.focus();
    }
  }

  function openDetail(name, info, allergens, triggerEl) {
    hideHoverBox();
    var d = ensureDetail();
    clearTimeout(d.closeTimer);

    d.title.textContent = name;

    if (info.image) {
      d.img.onerror = function () { d.media.hidden = true; };
      d.img.src = info.image;
      d.img.alt = "";
      d.media.hidden = false;
    } else {
      d.media.hidden = true;
    }

    d.desc.textContent = info.description || "";
    d.desc.hidden = !info.description;

    d.allergenWrap.textContent = "";
    if (allergens && allergens.length) {
      d.allergenWrap.appendChild(allergenChips(allergens));
      d.allergenWrap.hidden = false;
    } else {
      d.allergenWrap.hidden = true;
    }

    detailTrigger = triggerEl || null;
    document.body.classList.add("detail-open");
    d.overlay.hidden = false;
    void d.overlay.offsetWidth;   // Reflow erzwingen, damit die Klasse unten einen Übergang auslöst statt sofort umzuspringen
    d.overlay.classList.add("is-visible");
    document.addEventListener("keydown", onDetailKeydown);
    d.dialog.focus();
  }

  function closeDetail() {
    var d = detail;
    if (!d || d.overlay.hidden) return;
    d.overlay.classList.remove("is-visible");
    document.body.classList.remove("detail-open");
    document.removeEventListener("keydown", onDetailKeydown);
    var wait = reduceMotion() ? 0 : 220;
    d.closeTimer = setTimeout(function () { d.overlay.hidden = true; }, wait);
    if (detailTrigger) { detailTrigger.focus(); detailTrigger = null; }
  }

  /* ---------- Ein Gericht (mit oder ohne Foto/Beschreibung) ---------- */
  function renderDish(item, isMain) {
    var name = item.name;
    var info = isMain ? state.dishes[name.trim()] : null;

    if (!info) return el("div", "dish", name);

    var trigger = el("button", "dish dish-detail");
    trigger.type = "button";
    trigger.appendChild(document.createTextNode(name));
    trigger.appendChild(dishIcon());
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.title = TEXT.detailHint;

    var allergens = Array.isArray(item.allergens) ? item.allergens : [];
    trigger.addEventListener("click", function () { openDetail(name, info, allergens, trigger); });
    attachHoverPreview(trigger, info.image);

    return trigger;
  }

  function renderMeal(day, meal) {
    var items = Array.isArray(day[meal.key]) ? day[meal.key] : [];
    if (!items.length) return null;   // leere Mahlzeit (z. B. Freitagabend): gar nichts anzeigen

    // Das Hauptgericht ist immer das vorletzte Gericht der Mahlzeit (danach kommt nur noch der Nachtisch/Obst).
    var mainIndex = items.length >= 2 ? items.length - 2 : -1;

    var cell = el("div", "meal meal-" + meal.key);
    cell.appendChild(el("h3", "meal-label", meal.label));
    var list = el("ul", "dishes");
    items.forEach(function (item, idx) {
      if (!item || typeof item.name !== "string") return;
      var li = el("li");
      li.appendChild(renderDish(item, idx === mainIndex));
      if (Array.isArray(item.allergens) && item.allergens.length) {
        li.appendChild(allergenChips(item.allergens));
      }
      list.appendChild(li);
    });
    cell.appendChild(list);
    return cell;
  }

  function renderDay(day, monday, today) {
    var name = String(day.day || "").trim();
    var idx = DAY_NAMES.indexOf(name.toLowerCase());
    var date = idx >= 0 ? addDays(monday, idx) : null;
    var isToday = !!date && sameDay(date, today);

    var section = el("section", "day" + (isToday ? " is-today" : ""));
    if (isToday) section.setAttribute("aria-current", "date");

    var head = el("div", "day-head");
    var title = el("div", "day-title");
    title.appendChild(el("h2", "day-name", name));
    if (date) title.appendChild(el("span", "day-date", formatShort(date)));
    head.appendChild(title);
    if (isToday) head.appendChild(el("span", "today-tag", TEXT.today));
    section.appendChild(head);

    MEALS.forEach(function (meal) {
      var cell = renderMeal(day, meal);
      if (cell) section.appendChild(cell);
    });
    return section;
  }

  function renderWeek(file, data) {
    var monday = mondayOf(dateFromFile(file));
    var today = new Date();
    var weekLabel = typeof data.week === "string" && data.week.trim()
      ? data.week.trim().replace(/\s+-\s+/, " – ")
      : formatShort(monday) + " – " + formatShort(addDays(monday, 4));

    ui.label.textContent = weekLabel;
    ui.meta.textContent = TEXT.calendarWeek + " " + isoWeek(monday);
    document.title = "Speiseplan " + weekLabel;

    ui.plan.textContent = "";
    var days = Array.isArray(data.days) ? data.days : [];
    if (!days.length) {
      showMessage(TEXT.noEntries);
      return;
    }
    days.forEach(function (day) {
      if (day && typeof day === "object") ui.plan.appendChild(renderDay(day, monday, today));
    });
  }

  // Kurzes Überblenden beim Wechsel der Woche. Wird beim allerersten Aufbau
  // und bei "Bewegung reduzieren" übersprungen.
  function renderWeekAnimated(file, data, animate) {
    if (!animate || !ui.panel || reduceMotion()) { renderWeek(file, data); return; }
    ui.panel.classList.add("is-changing");
    setTimeout(function () {
      renderWeek(file, data);
      requestAnimationFrame(function () { ui.panel.classList.remove("is-changing"); });
    }, 160);
  }

  function renderControls(currentFile) {
    var i = state.files.indexOf(currentFile);
    var several = state.files.length > 1;

    ui.select.textContent = "";
    state.files.forEach(function (file) {
      var monday = mondayOf(dateFromFile(file));
      var label = TEXT.weekOption
        .replace("{kw}", isoWeek(monday))
        .replace("{date}", formatDate(monday));
      var opt = el("option", "", label);
      opt.value = stem(file);
      if (file === currentFile) opt.selected = true;
      ui.select.appendChild(opt);
    });

    // Nur eine Woche: Dropdown ohne Pfeil, keine Buttons.
    ui.select.disabled = !several;
    ui.select.classList.toggle("is-single", !several);
    ui.prev.hidden = !several;
    ui.next.hidden = !several;

    // Mehrere Wochen: Buttons behalten ihren Platz und werden nur unsichtbar,
    // damit das Dropdown in der Mitte nie verrutscht.
    var hasOlder = i >= 0 && i < state.files.length - 1;   // ältere Woche = weiter hinten in der Liste
    var hasNewer = i > 0;                                  // neuere Woche = weiter vorne
    ui.prev.classList.toggle("is-off", !hasOlder);
    ui.next.classList.toggle("is-off", !hasNewer);
    ui.prev.dataset.target = hasOlder ? stem(state.files[i + 1]) : "";
    ui.next.dataset.target = hasNewer ? stem(state.files[i - 1]) : "";
  }

  function renderLegend() {
    ui.legend.textContent = "";
    state.allergens.forEach(function (a) {
      var li = el("li");
      var chip = makeChip(a.code, { hidden: true });
      chip.removeAttribute("title");
      li.appendChild(chip);
      li.appendChild(el("span", "", a.name));
      ui.legend.appendChild(li);
    });
  }

  /* ------------------------------------------------------------
     Navigation: #2026-09-14 zeigt genau diese Woche, ohne # die neueste
     ------------------------------------------------------------ */
  function route() {
    if (!state.files.length) return;
    closeDetail();

    var newest = state.files[0];
    var raw = location.hash.replace(/^#/, "");
    try { raw = decodeURIComponent(raw); } catch (e) { /* kaputter Link: wird unten als unbekannt behandelt */ }
    var wanted = raw + ".json";
    var file = state.files.indexOf(wanted) >= 0 ? wanted : newest;
    var unknown = location.hash.length > 1 && file !== wanted;
    var id = ++state.request;
    var animate = !state.firstView;

    renderControls(file);
    showNotice("");

    fetchJSON("weeks/" + file).then(function (data) {
      if (id !== state.request) return;
      renderWeekAnimated(file, data, animate);

      var monday = mondayOf(dateFromFile(file));
      var weekIsOver = new Date() > addDays(monday, 7);   // ab Montag der Folgewoche
      if (unknown) {
        showNotice(TEXT.unknownWeek);
      } else if (file !== newest) {
        showNotice(TEXT.notCurrent, TEXT.toCurrent);
      } else if (weekIsOver) {
        showNotice(TEXT.outdated);
      }

      // Beim ersten Öffnen den heutigen Tag ins Bild holen (falls er nicht schon sichtbar ist)
      if (state.firstView) {
        state.firstView = false;
        var todayRow = ui.plan.querySelector(".is-today");
        if (todayRow && file === newest && !location.hash) todayRow.scrollIntoView({ block: "nearest" });
      }
    }).catch(function (err) {
      if (id !== state.request) return;
      if (window.console) console.error(err);
      ui.label.textContent = "";
      ui.meta.textContent = "";
      showMessage(TEXT.weekError + " (" + file + ")");
    });
  }

  function go(target) {
    if (target) location.hash = target;
  }

  ui.prev.addEventListener("click", function () { go(ui.prev.dataset.target); });
  ui.next.addEventListener("click", function () { go(ui.next.dataset.target); });
  ui.select.addEventListener("change", function () { go(ui.select.value); });
  window.addEventListener("hashchange", route);
  window.addEventListener("scroll", hideHoverBox, { passive: true });
  window.addEventListener("resize", hideHoverBox);

  /* ------------------------------------------------------------
     Start
     ------------------------------------------------------------ */
  showMessage(TEXT.loading);

  // Legende, Allergenfarben und Gericht-Fotos sind optional: fehlen die Dateien,
  // funktioniert der Rest der Seite trotzdem.
  var legendReady = fetchJSON("allergens.json").then(function (data) {
    setAllergens(data);
    renderLegend();
  }).catch(function () { /* ohne Legende weitermachen */ });

  var dishesReady = fetchJSON("dishes.json").then(function (data) {
    setDishes(data);
  }).catch(function () { /* ohne Fotos/Beschreibungen weitermachen */ });

  fetchText("weeks/index.txt").then(function (text) {
    var seen = {};
    state.files = text.split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(function (line) {
        if (!FILE_RE.test(line) || seen[line]) return false;   // Kommentare (#) und Leerzeilen fallen hier raus
        seen[line] = true;
        return true;
      })
      .sort()
      .reverse();

    if (!state.files.length) {
      ui.label.textContent = "";
      showMessage(TEXT.noWeeks);
      return;
    }
    return Promise.all([legendReady, dishesReady]).then(route);
  }).catch(function (err) {
    if (window.console) console.error(err);
    ui.label.textContent = "";
    showMessage(TEXT.loadError);
  });
})();
