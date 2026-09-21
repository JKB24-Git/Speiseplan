(function () {
  "use strict";
 
  /* ------------------------------------------------------------
     Einstellungen und Texte (hier kannst du alles anpassen)
     ------------------------------------------------------------ */
  var TEXT = {
    loading: "Speiseplan wird geladen …",
    noWeeks: "Es wurde noch kein Speiseplan veröffentlicht.",
    loadError: "Der Speiseplan konnte nicht geladen werden. Bitte später noch einmal versuchen.",
    weekError: "Der Speiseplan für diese Woche kann nicht angezeigt werden.",
    unknownWeek: "Diese Woche wurde nicht gefunden. Angezeigt wird die aktuelle Woche.",
    outdated: "Für die laufende Woche wurde noch kein Speiseplan veröffentlicht. Angezeigt wird der letzte Plan.",
    archive: "Das ist ein Plan aus dem Archiv.",
    toCurrent: "Zur aktuellen Woche",
    noEntries: "Keine Angaben",
    today: "Heute",
    calendarWeek: "Kalenderwoche",
    weekOption: "KW {kw} (ab {date})",
    unknownAllergen: "Unbekannter Code",
    allergensPrefix: "Allergene: "
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
 
  /* ------------------------------------------------------------
     Zustand
     ------------------------------------------------------------ */
  var state = {
    files: [],       // alle Wochen-Dateien, neueste zuerst
    allergens: {},   // Code -> Name
    request: 0       // schützt vor Durcheinander bei schnellem Klicken
  };
 
  var ui = {
    plan: $("plan"),
    notice: $("notice"),
    label: $("week-label"),
    meta: $("week-meta"),
    select: $("week-select"),
    prev: $("prev"),
    next: $("next"),
    legend: $("legend")
  };
 
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
 
  function allergenChips(codes) {
    var wrap = el("div", "allergens");
    wrap.appendChild(el("span", "sr", TEXT.allergensPrefix));
    var seen = {};
    codes
      .map(function (c) { return String(c).trim().toUpperCase(); })
      .filter(function (c) { if (!c || seen[c]) return false; seen[c] = true; return true; })
      .sort()
      .forEach(function (code, i, all) {
        var name = state.allergens[code];
        var chip = el("span", "al" + (name ? "" : " al-unknown"));
        chip.title = name || TEXT.unknownAllergen;
        chip.setAttribute("data-code", code);
        var letter = el("span", "", code);
        letter.setAttribute("aria-hidden", "true");
        chip.appendChild(letter);
        chip.appendChild(el("span", "sr", (name || TEXT.unknownAllergen) + (i < all.length - 1 ? ", " : "")));
        wrap.appendChild(chip);
      });
    return wrap;
  }
 
  function renderMeal(day, meal) {
    var items = Array.isArray(day[meal.key]) ? day[meal.key] : [];
    if (!items.length) return null;   // leere Mahlzeit (z. B. Freitagabend): gar nichts anzeigen
 
    var cell = el("div", "meal meal-" + meal.key);
    cell.appendChild(el("h3", "meal-label", meal.label));
    var list = el("ul", "dishes");
    items.forEach(function (item) {
      if (!item || typeof item.name !== "string") return;
      var li = el("li");
      li.appendChild(el("div", "dish", item.name));
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
 
  function renderControls(currentFile) {
    var i = state.files.indexOf(currentFile);
 
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
    ui.select.disabled = state.files.length < 2;
 
    // Ältere Woche = weiter hinten in der Liste, neuere Woche = weiter vorne.
    // Gibt es keine, wird der Button ganz ausgeblendet.
    var hasOlder = i >= 0 && i < state.files.length - 1;
    var hasNewer = i > 0;
    ui.prev.hidden = !hasOlder;
    ui.next.hidden = !hasNewer;
    ui.prev.dataset.target = hasOlder ? stem(state.files[i + 1]) : "";
    ui.next.dataset.target = hasNewer ? stem(state.files[i - 1]) : "";
  }
 
  function renderLegend() {
    ui.legend.textContent = "";
    Object.keys(state.allergens).sort().forEach(function (code) {
      var li = el("li");
      var chip = el("span", "al", code);
      chip.setAttribute("data-code", code);
      chip.setAttribute("aria-hidden", "true");
      li.appendChild(chip);
      li.appendChild(el("span", "", state.allergens[code]));
      ui.legend.appendChild(li);
    });
  }
 
  /* ------------------------------------------------------------
     Navigation: #2026-09-14 zeigt genau diese Woche, ohne # die neueste
     ------------------------------------------------------------ */
  function route() {
    if (!state.files.length) return;
 
    var newest = state.files[0];
    var raw = location.hash.replace(/^#/, "");
    try { raw = decodeURIComponent(raw); } catch (e) { /* kaputter Link: wird unten als unbekannt behandelt */ }
    var wanted = raw + ".json";
    var file = state.files.indexOf(wanted) >= 0 ? wanted : newest;
    var unknown = location.hash.length > 1 && file !== wanted;
    var id = ++state.request;
 
    renderControls(file);
    showNotice("");
 
    fetchJSON("weeks/" + file).then(function (data) {
      if (id !== state.request) return;
      renderWeek(file, data);
 
      var monday = mondayOf(dateFromFile(file));
      var weekIsOver = new Date() > addDays(monday, 7);   // ab Montag der Folgewoche
      if (unknown) {
        showNotice(TEXT.unknownWeek);
      } else if (file !== newest) {
        showNotice(TEXT.archive, TEXT.toCurrent);
      } else if (weekIsOver) {
        showNotice(TEXT.outdated);
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
 
  /* ------------------------------------------------------------
     Start
     ------------------------------------------------------------ */
  showMessage(TEXT.loading);
 
  // Legende ist optional: fehlt die Datei, funktioniert der Rest trotzdem.
  var legendReady = fetchJSON("allergens.json").then(function (data) {
    if (data && typeof data === "object") state.allergens = data;
    renderLegend();
  }).catch(function () { /* ohne Legende weitermachen */ });
 
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
    return legendReady.then(route);
  }).catch(function (err) {
    if (window.console) console.error(err);
    ui.label.textContent = "";
    showMessage(TEXT.loadError);
  });
})();
 
