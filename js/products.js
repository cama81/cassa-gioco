// Dati del negozio: categorie e prodotti.
// Sono i prodotti iniziali: dalla scheda "Prodotti" dell'app li puoi modificare (le modifiche restano sul dispositivo).
// I prezzi (c) sono in centesimi. Gli id sono scritti nei QR stampati: non cambiarli
// se hai già stampato i codici.
var CATS = [
  { k: "tutti", e: "🛍️", n: "Tutti" },
  { k: "alimentari", e: "🍎", n: "Alimentari" },
  { k: "elettronica", e: "🎧", n: "Elettronica" },
  { k: "libri", e: "📚", n: "Libri" },
  { k: "giocattoli", e: "🧸", n: "Giocattoli" },
  { k: "vestiti", e: "👕", n: "Vestiti" }
];

var DEFAULT_PRODUCTS = [
  { cat: "alimentari", id: "mela", e: "🍎", n: "Mela", c: 50 },
  { cat: "alimentari", id: "pane", e: "🍞", n: "Pane", c: 120 },
  { cat: "alimentari", id: "latte", e: "🥛", n: "Latte", c: 150 },
  { cat: "alimentari", id: "formaggio", e: "🧀", n: "Formaggio", c: 250 },
  { cat: "alimentari", id: "gelato", e: "🍦", n: "Gelato", c: 200 },
  { cat: "alimentari", id: "biscotti", e: "🍪", n: "Biscotti", c: 180 },
  { cat: "alimentari", id: "banana", e: "🍌", n: "Banana", c: 70 },
  { cat: "alimentari", id: "succo", e: "🧃", n: "Succo", c: 100 },
  { cat: "elettronica", id: "torcia", e: "🔦", n: "Torcia", c: 800 },
  { cat: "elettronica", id: "cuffie", e: "🎧", n: "Cuffie", c: 2500 },
  { cat: "elettronica", id: "orologio", e: "⌚", n: "Orologio", c: 4000 },
  { cat: "elettronica", id: "telefono", e: "📱", n: "Telefono", c: 9000 },
  { cat: "libri", id: "fiabe", e: "📕", n: "Fiabe", c: 900 },
  { cat: "libri", id: "fumetto", e: "📗", n: "Fumetto", c: 500 },
  { cat: "libri", id: "atlante", e: "📘", n: "Atlante", c: 1500 },
  { cat: "libri", id: "quaderno", e: "📓", n: "Quaderno", c: 300 },
  { cat: "giocattoli", id: "orsetto", e: "🧸", n: "Orsetto", c: 1200 },
  { cat: "giocattoli", id: "pallone", e: "⚽", n: "Pallone", c: 800 },
  { cat: "giocattoli", id: "puzzle", e: "🧩", n: "Puzzle", c: 1000 },
  { cat: "giocattoli", id: "macchinina", e: "🚗", n: "Macchinina", c: 600 },
  { cat: "giocattoli", id: "bambola", e: "🪆", n: "Bambola", c: 1500 },
  { cat: "giocattoli", id: "console", e: "🕹️", n: "Console", c: 12000 },
  { cat: "giocattoli", id: "costruzioni", e: "🧱", n: "Costruzioni", c: 1400 },
  { cat: "giocattoli", id: "robot", e: "🤖", n: "Robot", c: 2500 },
  { cat: "vestiti", id: "maglietta", e: "👕", n: "Maglietta", c: 1000 },
  { cat: "vestiti", id: "pantaloni", e: "👖", n: "Pantaloni", c: 2000 },
  { cat: "vestiti", id: "calzini", e: "🧦", n: "Calzini", c: 400 },
  { cat: "vestiti", id: "cappello", e: "🧢", n: "Cappello", c: 700 }
];
