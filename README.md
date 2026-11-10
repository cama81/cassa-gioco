# La mia cassa POS

Una cassa per giocare al negozio: si aggiungono i prodotti al carrello (toccandoli o inquadrando il loro QR con la fotocamera, con un beep a ogni lettura), si sceglie quanto dà il cliente e l'app calcola il resto. Funziona **offline** e si può **installare** su telefono e tablet come una vera app.

## Cosa può fare

- **Cassa**: carrello, pagamento in contanti (banconote e monete, tasto *Esatto*, calcolo del resto) o con carta.
- **Scanner QR**: ogni QR viene letto una sola volta finché resta inquadrato; per aggiungere lo stesso prodotto di nuovo si allontana il QR per un istante. Il suono si può spegnere con il tasto 🔊.
- **Prodotti**: crea, modifica ed elimina prodotti dall'app (nome, emoji, prezzo, genere). Esporta un file di backup e importa file di prodotti (*Aggiungi da file* unisce, *Sostituisci da file* rimpiazza tutto).
- **Incassi**: riepilogo della sessione (vendite, totale, contanti/carta, articoli venduti e cosa è stato venduto). Si azzera solo con il tasto *Azzera incassi*.
- **Stampa QR**: fogli di QR da ritagliare, filtrabili per genere.

## Struttura

```
index.html              pagina principale
css/style.css           stile (tema chiaro/scuro automatico)
js/products.js          categorie e prodotti iniziali
js/app.js               logica: carrello, pagamento, prodotti, incassi, scanner QR, stampa QR
sw.js                   service worker (cache e modalità offline)
manifest.webmanifest    dati per l'installazione come app
icons/                  icone dell'app
fonts/                  font Baloo 2 (licenza OFL)
vendor/                 librerie incluse: jsQR (Apache-2.0) e qrcode-generator (MIT)
```

## Provarlo in locale

Il service worker e la fotocamera richiedono `http://localhost` o HTTPS (non basta aprire il file con doppio clic).

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Modificare i prodotti

Dall'app: scheda **Prodotti**. Le modifiche, gli incassi e le impostazioni sono salvati **sul dispositivo** (`localStorage`): su un altro telefono si parte dai prodotti iniziali, a meno di usare *Esporta* / *Importa*.

Ogni prodotto ha un `id` che resta uguale anche se cambi nome o prezzo: i QR già stampati continuano a funzionare. Se elimini un prodotto, il suo QR non funziona più.

I prodotti iniziali (quelli che compaiono la prima volta o dopo *Ripristina originali*) sono in `js/products.js`; lì i prezzi sono in **centesimi** (`150` = 1,50 €).

### Prodotti pronti da importare

In `esempi/` ci sono file `.json` da importare con **Prodotti → Aggiungi da file**:

- `principesse.json`: 14 principesse, castello, carrozza, corona e bacchetta magica (genere *Principesse*).

Formato di un file: `{ "products": [ { "id": "pizza", "cat": "alimentari", "e": "🍕", "n": "Pizza", "c": 450 } ] }`.
`cat` è uno tra `alimentari`, `elettronica`, `libri`, `giocattoli`, `vestiti`, `principesse`; `c` è il prezzo in centesimi; `id` può contenere solo lettere, numeri, `-` e `_`.

## Regolare lo scanner

In cima a `js/app.js`:

- `SCAN_REARM_MS` (predefinito 1200): per quanto tempo il QR deve restare fuori dall'inquadratura prima di poter aggiungere di nuovo lo stesso prodotto.
- `SCAN_INTERVAL_MS` (100): ogni quanto viene analizzato un fotogramma.

## Aggiornare l'app dopo una modifica

Ogni volta che cambi un file dell'app, incrementa `VERSION` in `sw.js` (`v1` → `v2`). Così i dispositivi scaricano la versione nuova invece di usare la copia in cache.

## Pubblicarla online (GitHub Pages)

1. Su GitHub: **Settings → Pages**.
2. **Source**: *Deploy from a branch*, branch `main` (o `master`), cartella `/ (root)`.
3. Dopo un minuto l'app è su `https://<utente>.github.io/cassa-gioco/`. Da lì il telefono propone "Aggiungi a schermata Home".
