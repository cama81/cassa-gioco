// Logica della cassa: carrello, pagamento, prodotti modificabili, incassi,
// scanner QR (con beep) e stampa dei QR.
// Richiede: vendor/jsQR.js, vendor/qrcode.js, js/products.js

var PREFIX = "cassa:"; // ogni QR contiene "cassa:" + id del prodotto
var KEY_PRODUCTS = "cassa.products.v1";
var KEY_SALES = "cassa.sales.v1";
var KEY_SETTINGS = "cassa.settings.v1";

// Scanner
var SCAN_INTERVAL_MS = 100; // ogni quanto analizzare un fotogramma
var SCAN_REARM_MS = 1200;   // il QR deve restare fuori dall'inquadratura per questo tempo
                            // prima che lo stesso prodotto possa essere aggiunto di nuovo
var SCAN_MAX_SIDE = 800;    // lato massimo dell'immagine analizzata (più basso = più veloce)

var $ = function (i) { return document.getElementById(i); };
function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function eur(c) { return (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" }); }

// ---------------------------------------------------------------- archivio locale
var store = {
  get: function (k, fallback) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  },
  set: function (k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  },
  remove: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};

// ---------------------------------------------------------------- stato
var REAL_CATS = CATS.filter(function (c) { return c.k !== "tutti"; });
var settings = Object.assign({ sound: true }, store.get(KEY_SETTINGS, {}));
var products = [];
var byId = {};
var sales = [];
var cart = {}, given = 0, cat = "tutti";

// ---------------------------------------------------------------- prodotti
function firstGlyph(s) {
  s = (s || "").trim();
  if (!s) return "🏷️";
  if (window.Intl && Intl.Segmenter) {
    var it = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)[Symbol.iterator]().next();
    return it.done ? "🏷️" : it.value.segment;
  }
  return Array.from(s).slice(0, 2).join("");
}

// Controlla un prodotto (anche da file importato): restituisce la versione pulita o null.
function cleanProduct(p) {
  if (!p || typeof p !== "object") return null;
  var id = String(p.id || "");
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  var n = String(p.n || "").trim().slice(0, 30);
  if (!n) return null;
  var c = Math.round(Number(p.c));
  if (!(c >= 1 && c <= 9999999)) return null;
  var okCat = REAL_CATS.some(function (x) { return x.k === p.cat; });
  return { id: id, cat: okCat ? p.cat : REAL_CATS[0].k, e: firstGlyph(p.e), n: n, c: c };
}

function cleanList(list) {
  var seen = {}, out = [];
  (Array.isArray(list) ? list : []).forEach(function (raw) {
    var p = cleanProduct(raw);
    if (p && !seen[p.id]) { seen[p.id] = 1; out.push(p); }
  });
  return out;
}

function loadProducts() {
  var saved = store.get(KEY_PRODUCTS, null);
  return Array.isArray(saved) ? cleanList(saved) : cleanList(DEFAULT_PRODUCTS);
}

function reindex() {
  byId = {};
  products.forEach(function (p) { byId[p.id] = p; });
  Object.keys(cart).forEach(function (k) { if (!byId[k]) delete cart[k]; });
}

function find(id) { return byId[id]; }
function visible() { return products.filter(function (p) { return cat === "tutti" || p.cat === cat; }); }

function saveProducts() {
  if (!store.set(KEY_PRODUCTS, products)) {
    $("prodStatus").textContent = "Attenzione: non riesco a salvare su questo dispositivo.";
  }
}

function newId() {
  var id;
  do { id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); } while (byId[id]);
  return id;
}

function refreshAll() {
  reindex();
  buildGrid();
  buildQr();
  renderProdList();
  renderCart();
  renderSales();
}

// ---------------------------------------------------------------- griglia della cassa
function buildGrid() {
  var g = $("shopGrid");
  g.textContent = "";
  var list = visible();
  if (!list.length) {
    var m = el("p", "status", products.length ? "Nessun prodotto in questo genere." : "Nessun prodotto: aggiungili dalla scheda Prodotti.");
    m.style.gridColumn = "1 / -1";
    g.appendChild(m);
    return;
  }
  list.forEach(function (p) {
    var b = el("button", "prod");
    b.type = "button";
    b.dataset.id = p.id;
    b.setAttribute("aria-label", p.n + ", " + eur(p.c) + ", aggiungi al carrello");
    b.append(el("span", "e", p.e), el("span", "n", p.n), el("span", "p", eur(p.c)));
    g.appendChild(b);
  });
}
$("shopGrid").addEventListener("click", function (e) {
  var b = e.target.closest("button.prod");
  var p = b && find(b.dataset.id);
  if (p) addItem(p);
});

// ---------------------------------------------------------------- carrello
function addItem(p) {
  cart[p.id] = (cart[p.id] || 0) + 1;
  renderCart();
  notifyCartChange();
  return cart[p.id];
}

function removeItem(p) {
  if (cart[p.id]) {
    cart[p.id]--;
    if (cart[p.id] <= 0) delete cart[p.id];
    renderCart();
    notifyCartChange();
  }
}

function notifyCartChange() {
  var b = $("topCartBadge");
  b.classList.remove("badge-pop");
  void b.offsetWidth;
  b.classList.add("badge-pop");
}

function sum() { return Object.keys(cart).reduce(function (s, k) { return s + find(k).c * cart[k]; }, 0); }
function countItems() { return Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0); }

function renderCart() {
  var ul = $("items");
  ul.textContent = "";
  var keys = Object.keys(cart);
  if (!keys.length) ul.appendChild(el("li", "empty", "Il carrello è vuoto."));
  keys.forEach(function (k) {
    var p = find(k);
    var li = document.createElement("li");
    var ctl = el("div", "qty-controls");
    var dec = el("button", "qty-btn", "-");
    dec.type = "button"; dec.dataset.act = "dec"; dec.dataset.id = k;
    dec.setAttribute("aria-label", "Togli " + p.n);
    var inc = el("button", "qty-btn", "+");
    inc.type = "button"; inc.dataset.act = "inc"; inc.dataset.id = k;
    inc.setAttribute("aria-label", "Aggiungi " + p.n);
    var tot = el("span", "", eur(p.c * cart[k]));
    tot.style.cssText = "min-width:60px;text-align:right";
    ctl.append(dec, el("span", "", String(cart[k])), inc, tot);
    li.append(el("span", "", p.e + " " + p.n), ctl);
    ul.appendChild(li);
  });

  var totalStr = eur(sum());
  $("total").textContent = totalStr;
  $("topCartTotal").textContent = totalStr;
  $("topCartBadge").textContent = countItems();
  $("topCartBar").setAttribute("aria-label", "Apri il carrello: " + countItems() + " articoli, " + totalStr);
  $("payBtn").disabled = sum() === 0;
  $("clearBtn").disabled = sum() === 0;
  if (sum() === 0) $("payCard").classList.add("hidden");
  renderPay();
}

$("items").addEventListener("click", function (e) {
  var b = e.target.closest("button[data-act]");
  var p = b && find(b.dataset.id);
  if (!p) return;
  if (b.dataset.act === "inc") addItem(p); else removeItem(p);
});

// ---------------------------------------------------------------- pagamento
function renderPay() {
  var t = sum();
  $("given").textContent = "Dato: " + eur(given);
  var d = given - t, ch = $("change");
  if (given === 0) ch.textContent = "";
  else if (d < 0) ch.textContent = "Mancano " + eur(-d);
  else ch.textContent = "Resto: " + eur(d);
  $("doneBtn").disabled = !(t > 0 && given >= t);
  $("exactBtn").disabled = t === 0;
  $("cardBtn").disabled = t === 0;
}

[1, 2, 5, 10, 20, 50, 100].forEach(function (n) {
  var b = el("button", "btn", n + " €");
  b.type = "button";
  b.onclick = function () { given += n * 100; renderPay(); };
  $("notes").appendChild(b);
});
[1, 2, 5, 10, 20, 50].forEach(function (n) {
  var b = el("button", "btn sun", n + " cent");
  b.type = "button";
  b.onclick = function () { given += n; renderPay(); };
  $("notes").appendChild(b);
});

function finishSale(method) {
  var t = sum();
  if (t <= 0 || (method === "contanti" && given < t)) return;
  var lines = Object.keys(cart).map(function (k) {
    var p = find(k);
    return { id: p.id, e: p.e, n: p.n, c: p.c, q: cart[k] };
  });
  var change = method === "contanti" ? given - t : 0;
  sales.push({ t: Date.now(), method: method, total: t, given: method === "carta" ? t : given, lines: lines });
  store.set(KEY_SALES, sales);
  cart = {}; given = 0;
  renderCart();
  renderSales();
  notifyCartChange();
  closeDialog();
  $("scanStatus").textContent = "Grazie e arrivederci! Prossimo cliente." + (change > 0 ? " Resto dato: " + eur(change) + "." : "");
}

$("payBtn").onclick = function () { $("payCard").classList.remove("hidden"); $("payCard").scrollIntoView({ behavior: "smooth" }); };
$("resetGiven").onclick = function () { given = 0; renderPay(); };
$("exactBtn").onclick = function () { given = sum(); renderPay(); };
$("cardBtn").onclick = function () { finishSale("carta"); };
$("doneBtn").onclick = function () { finishSale("contanti"); };
$("clearBtn").onclick = function () {
  if (!sum()) return;
  if (!confirm("Svuotare il carrello?")) return;
  cart = {}; given = 0;
  renderCart();
  notifyCartChange();
};

// ---------------------------------------------------------------- finestre (carrello, filtri, prodotto)
// Quando una finestra è aperta il resto della pagina è "inert": niente focus con Tab
// e niente lettura da parte degli screen reader. Esc chiude, il focus torna dov'era.
var DLG = {
  drawer: { els: ["cartDrawer", "drawerOverlay"], focus: "closeDrawer" },
  cats: { els: ["catModal"], focus: "closeCatModal" },
  prod: { els: ["prodModal"], focus: "pName" }
};
var openDlg = null, opener = null;

function openDialog(name) {
  if (openDlg) closeDialog(true);
  var d = DLG[name];
  opener = document.activeElement;
  d.els.forEach(function (id) { var e = $(id); e.inert = false; e.classList.add("open"); });
  $("app").inert = true;
  openDlg = name;
  var f = $(d.focus);
  if (f) f.focus();
}

function closeDialog(skipFocus) {
  if (!openDlg) return;
  DLG[openDlg].els.forEach(function (id) { var e = $(id); e.classList.remove("open"); e.inert = true; });
  $("app").inert = false;
  openDlg = null;
  if (!skipFocus && opener && document.contains(opener) && opener.focus) opener.focus();
  opener = null;
}

document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDialog(); });

$("topCartBar").onclick = function () { openDialog("drawer"); };
$("closeDrawer").onclick = function () { closeDialog(); };
$("drawerOverlay").onclick = function () { closeDialog(); };
$("catMenuBtn").onclick = function () { openDialog("cats"); };
$("closeCatModal").onclick = function () { closeDialog(); };
$("catModal").onclick = function (e) { if (e.target === $("catModal")) closeDialog(); };
$("closeProdModal").onclick = function () { closeDialog(); };
$("cancelProd").onclick = function () { closeDialog(); };
$("prodModal").onclick = function (e) { if (e.target === $("prodModal")) closeDialog(); };

function buildModalChips() {
  var box = $("modalChips");
  box.textContent = "";
  CATS.forEach(function (c) {
    var b = el("button", "chip", c.e + " " + c.n);
    b.type = "button";
    b.setAttribute("aria-pressed", cat === c.k ? "true" : "false");
    b.onclick = function () {
      cat = c.k;
      $("activeCatLabel").textContent = c.n;
      buildModalChips();
      buildGrid();
      buildQr();
      closeDialog();
    };
    box.appendChild(b);
  });
}

// ---------------------------------------------------------------- schede (tab)
var TABS = ["shop", "prod", "sales", "qr"];
function showTab(t) {
  if (t !== "shop") stopCam();
  TABS.forEach(function (k) {
    $(k).classList.toggle("hidden", k !== t);
    $("tab" + k.charAt(0).toUpperCase() + k.slice(1)).setAttribute("aria-pressed", String(k === t));
  });
  $("catMenuBtn").classList.toggle("hidden", t === "prod" || t === "sales");
  if (t === "sales") renderSales();
}
$("tabShop").onclick = function () { showTab("shop"); };
$("tabProd").onclick = function () { showTab("prod"); };
$("tabSales").onclick = function () { showTab("sales"); };
$("tabQr").onclick = function () { showTab("qr"); };
$("printBtn").onclick = function () { window.print(); };

// ---------------------------------------------------------------- gestione prodotti
var editingId = null;

function renderProdList() {
  var box = $("prodList");
  box.textContent = "";
  if (!products.length) {
    box.appendChild(el("p", "status", "Nessun prodotto. Tocca “Nuovo” per crearne uno."));
    return;
  }
  REAL_CATS.forEach(function (c) {
    var items = products.filter(function (p) { return p.cat === c.k; });
    if (!items.length) return;
    box.appendChild(el("h3", "cat-head", c.e + " " + c.n));
    var ul = el("ul", "plist");
    items.forEach(function (p) {
      var li = document.createElement("li");
      var ed = el("button", "icon-btn", "✏️");
      ed.type = "button"; ed.dataset.act = "edit"; ed.dataset.id = p.id;
      ed.setAttribute("aria-label", "Modifica " + p.n);
      var del = el("button", "icon-btn", "🗑️");
      del.type = "button"; del.dataset.act = "del"; del.dataset.id = p.id;
      del.setAttribute("aria-label", "Elimina " + p.n);
      li.append(el("span", "pe", p.e), el("span", "pn", p.n), el("span", "pp", eur(p.c)), ed, del);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  });
}

$("prodList").addEventListener("click", function (e) {
  var b = e.target.closest("button[data-act]");
  var p = b && find(b.dataset.id);
  if (!p) return;
  if (b.dataset.act === "edit") openProdForm(p);
  else deleteProduct(p);
});

function fillCatSelect() {
  var s = $("pCat");
  s.textContent = "";
  REAL_CATS.forEach(function (c) {
    var o = el("option", "", c.e + " " + c.n);
    o.value = c.k;
    s.appendChild(o);
  });
}

function priceToInput(c) { return (c / 100).toFixed(2).replace(".", ","); }
function parsePrice(str) {
  var s = String(str).replace(/[€\s]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return 0;
  return Math.round(parseFloat(s) * 100);
}

function openProdForm(p) {
  editingId = p ? p.id : null;
  $("prodTitle").textContent = p ? "Modifica prodotto" : "Nuovo prodotto";
  $("pEmoji").value = p ? p.e : "";
  $("pName").value = p ? p.n : "";
  $("pPrice").value = p ? priceToInput(p.c) : "";
  $("pCat").value = p ? p.cat : (cat !== "tutti" ? cat : REAL_CATS[0].k);
  $("pNote").classList.toggle("hidden", !p);
  $("pError").textContent = "";
  openDialog("prod");
}
$("newProdBtn").onclick = function () { openProdForm(null); };

$("prodForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var n = $("pName").value.trim();
  var c = parsePrice($("pPrice").value);
  if (!n) { $("pError").textContent = "Scrivi il nome del prodotto."; $("pName").focus(); return; }
  if (!c) { $("pError").textContent = "Scrivi un prezzo valido, per esempio 1,50."; $("pPrice").focus(); return; }
  if (c > 9999999) { $("pError").textContent = "Il prezzo è troppo alto."; $("pPrice").focus(); return; }
  var data = { cat: $("pCat").value, e: firstGlyph($("pEmoji").value), n: n.slice(0, 30), c: c };
  var p = editingId && find(editingId);
  if (p) {
    Object.assign(p, data);
  } else {
    p = Object.assign({ id: newId() }, data);
    products.push(p);
  }
  saveProducts();
  refreshAll();
  closeDialog();
  $("prodStatus").textContent = "Salvato: " + p.e + " " + p.n + " (" + eur(p.c) + ").";
});

function deleteProduct(p) {
  if (!confirm("Eliminare «" + p.n + "»?\nI QR già stampati per questo prodotto non funzioneranno più.")) return;
  products = products.filter(function (x) { return x.id !== p.id; });
  saveProducts();
  refreshAll();
  $("prodStatus").textContent = "Eliminato: " + p.e + " " + p.n + ".";
}

$("exportBtn").onclick = function () {
  var blob = new Blob([JSON.stringify({ versione: 1, products: products }, null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cassa-prodotti.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  $("prodStatus").textContent = "File cassa-prodotti.json creato.";
};

$("importBtn").onclick = function () { $("importFile").click(); };
$("importFile").addEventListener("change", function () {
  var f = this.files && this.files[0];
  var input = this;
  if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    var list = null;
    try { var j = JSON.parse(r.result); list = cleanList(Array.isArray(j) ? j : j.products); } catch (e) {}
    if (!list || !list.length) {
      $("prodStatus").textContent = "Il file non contiene prodotti validi.";
    } else if (confirm("Sostituire i " + products.length + " prodotti attuali con i " + list.length + " del file?")) {
      products = list;
      saveProducts();
      refreshAll();
      $("prodStatus").textContent = "Importati " + list.length + " prodotti.";
    }
    input.value = "";
  };
  r.onerror = function () { $("prodStatus").textContent = "Non riesco a leggere il file."; input.value = ""; };
  r.readAsText(f);
});

$("resetProdBtn").onclick = function () {
  if (!confirm("Ripristinare i prodotti originali? Le tue modifiche ai prodotti andranno perse.")) return;
  store.remove(KEY_PRODUCTS);
  products = loadProducts();
  refreshAll();
  $("prodStatus").textContent = "Prodotti originali ripristinati.";
};

// ---------------------------------------------------------------- incassi
function loadSales() {
  var s = store.get(KEY_SALES, []);
  return (Array.isArray(s) ? s : []).filter(function (x) {
    return x && typeof x.total === "number" && Array.isArray(x.lines);
  });
}

function summarize() {
  var s = { n: sales.length, total: 0, cash: 0, card: 0, items: 0, by: {} };
  sales.forEach(function (v) {
    s.total += v.total;
    if (v.method === "carta") s.card += v.total; else s.cash += v.total;
    v.lines.forEach(function (l) {
      s.items += l.q;
      var r = s.by[l.id] || (s.by[l.id] = { e: l.e, n: l.n, q: 0, tot: 0 });
      r.q += l.q;
      r.tot += l.c * l.q;
    });
  });
  return s;
}

function renderSales() {
  var s = summarize();
  var box = $("stats");
  box.textContent = "";
  [["Vendite", String(s.n)], ["Incassato", eur(s.total)], ["In contanti", eur(s.cash)],
   ["Con carta", eur(s.card)], ["Articoli venduti", String(s.items)]].forEach(function (r) {
    var d = el("div", "stat");
    d.append(el("span", "", r[0]), el("b", "", r[1]));
    box.appendChild(d);
  });
  var ul = $("salesList");
  ul.textContent = "";
  var rows = Object.keys(s.by).map(function (k) { return s.by[k]; })
    .sort(function (a, b) { return b.q - a.q; });
  if (!rows.length) ul.appendChild(el("li", "empty", "Ancora nessuna vendita."));
  rows.forEach(function (r) {
    var li = document.createElement("li");
    li.append(el("span", "pe", r.e), el("span", "pn", r.n + " × " + r.q), el("span", "pp", eur(r.tot)));
    ul.appendChild(li);
  });
  $("resetSalesBtn").disabled = !sales.length;
}

$("resetSalesBtn").onclick = function () {
  if (!sales.length) return;
  if (!confirm("Azzerare gli incassi? Perderai il riepilogo di " + sales.length + " vendite.")) return;
  sales = [];
  store.set(KEY_SALES, sales);
  renderSales();
};

// ---------------------------------------------------------------- suoni
var audioCtx = null;
function initAudio() {
  try {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {}
}

function beep(kind) {
  if (!settings.sound || !audioCtx) return;
  try {
    var ok = kind !== "error", t = audioCtx.currentTime, dur = ok ? 0.12 : 0.28;
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = ok ? "square" : "sawtooth";
    o.frequency.value = ok ? 1500 : 300;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) {}
}

function updateSoundBtn() {
  var b = $("soundBtn");
  b.textContent = settings.sound ? "🔊" : "🔇";
  b.setAttribute("aria-pressed", String(settings.sound));
  b.setAttribute("aria-label", settings.sound ? "Suono dello scanner attivo" : "Suono dello scanner spento");
}
$("soundBtn").onclick = function () {
  settings.sound = !settings.sound;
  store.set(KEY_SETTINGS, settings);
  updateSoundBtn();
  if (settings.sound) { initAudio(); beep("ok"); }
};

// ---------------------------------------------------------------- scanner QR
var camStream = null, camOn = false;
var scan = { code: "", seen: 0 }; // codice attualmente inquadrato e ultima volta che l'ho visto

function setScanStatus(msg) { $("scanStatus").textContent = msg; }

function stopCam() {
  camOn = false;
  scan.code = "";
  if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
  $("cam").classList.add("hidden");
  $("qrBtn").textContent = "Fotocamera QR";
}

$("qrBtn").onclick = async function () {
  initAudio(); // il suono può partire solo dopo un tocco dell'utente
  if (camOn) { stopCam(); setScanStatus("Fotocamera spenta."); return; }
  if (!navigator.mediaDevices) { setScanStatus("Questo browser non permette la fotocamera qui."); return; }
  if (!window.jsQR && !window.BarcodeDetector) { setScanStatus("Lettore QR non caricato."); return; }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    var v = $("cam");
    v.srcObject = camStream;
    v.classList.remove("hidden");
    await v.play();
    camOn = true;
    scan.code = "";
    $("qrBtn").textContent = "Spegni fotocamera";
    setScanStatus("Fotocamera attiva: inquadra il QR del prodotto.");
    tick();
  } catch (e) {
    stopCam();
    setScanStatus("Non riesco ad aprire la fotocamera: controlla il permesso.");
  }
};

// Un QR viene letto UNA volta sola finché resta inquadrato. Per aggiungere lo stesso
// prodotto una seconda volta bisogna allontanare il QR per un istante (SCAN_REARM_MS).
function handleScan(data, now) {
  if (data) {
    if (data === scan.code) { scan.seen = now; return; } // è ancora lo stesso QR: ignoro
    scan.code = data;
    scan.seen = now;
    if (data.indexOf(PREFIX) !== 0) {
      beep("error");
      setScanStatus("QR non riconosciuto.");
      return;
    }
    var p = find(data.slice(PREFIX.length));
    if (!p) {
      beep("error");
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setScanStatus("Prodotto non trovato: forse il QR è vecchio o il prodotto è stato eliminato.");
      return;
    }
    var q = addItem(p);
    beep("ok");
    if (navigator.vibrate) navigator.vibrate(60);
    setScanStatus("Bip! " + p.e + " " + p.n + " aggiunto" + (q > 1 ? " (" + q + " nel carrello)." : "."));
  } else if (scan.code && now - scan.seen > SCAN_REARM_MS) {
    scan.code = "";
    setScanStatus("Pronto: inquadra il prossimo prodotto.");
  }
}

async function tick() {
  if (!camOn) return;
  var v = $("cam"), data = null;
  if (v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth) {
    try {
      if (window.jsQR) {
        var k = Math.min(1, SCAN_MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
        var w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k);
        var c = $("cv");
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
        var x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(v, 0, 0, w, h);
        var q = jsQR(x.getImageData(0, 0, w, h).data, w, h);
        data = q ? q.data : null;
      } else if (window.BarcodeDetector) {
        var r = await new BarcodeDetector({ formats: ["qr_code"] }).detect(v);
        data = r.length ? r[0].rawValue : null;
      }
    } catch (e) {}
    if (camOn) handleScan(data, Date.now());
  }
  if (camOn) setTimeout(tick, SCAN_INTERVAL_MS);
}

// ---------------------------------------------------------------- stampa QR
function buildQr() {
  var g = $("qrGrid");
  g.textContent = "";
  if (!window.qrcode) { g.textContent = "Generatore QR non disponibile."; return; }
  visible().forEach(function (p) {
    var q = qrcode(0, "M");
    q.addData(PREFIX + p.id);
    q.make();
    var d = el("div", "qrc");
    var holder = document.createElement("div");
    holder.innerHTML = q.createSvgTag(4, 2); // SVG generato dalla libreria, senza testo dell'utente
    var em = el("div", "", p.e);
    em.style.fontSize = "30px";
    var lab = document.createElement("div");
    lab.append(el("b", "", p.n), " · " + eur(p.c));
    d.append(holder, em, lab);
    g.appendChild(d);
  });
}

// ---------------------------------------------------------------- avvio
fillCatSelect();
products = loadProducts();
sales = loadSales();
updateSoundBtn();
buildModalChips();
refreshAll();

// Service worker: rende l'app utilizzabile offline e installabile
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  });
}
