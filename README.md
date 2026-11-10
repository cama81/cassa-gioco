# La mia cassa POS

Una cassa per giocare al negozio: si aggiungono i prodotti al carrello (toccandoli o inquadrando il loro QR con la fotocamera), si sceglie quanto dà il cliente e l'app calcola il resto. Funziona **offline** e si può **installare** su telefono e tablet come una vera app.

## Struttura

```
index.html              pagina principale
css/style.css           stile (tema chiaro/scuro automatico)
js/products.js          categorie e prodotti (qui si cambiano i prezzi)
js/app.js               logica: carrello, pagamento, scanner QR, stampa QR
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

Apri `js/products.js` e cambia nome, emoji o prezzo (in **centesimi**: `150` = 1,50 €).
Non cambiare gli `id` dei prodotti se hai già stampato i QR, perché nei codici c'è scritto l'id.

## Aggiornare l'app dopo una modifica

Ogni volta che cambi un file dell'app, incrementa `VERSION` in `sw.js` (`v1` → `v2`). Così i dispositivi scaricano la versione nuova invece di usare la copia in cache.

## Pubblicarla online (GitHub Pages)

1. Su GitHub: **Settings → Pages**.
2. **Source**: *Deploy from a branch*, branch `main` (o `master`), cartella `/ (root)`.
3. Dopo un minuto l'app è su `https://<utente>.github.io/cassa-gioco/`. Da lì il telefono propone "Aggiungi a schermata Home".
