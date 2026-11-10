// Unico posto dove si cambiano nome, versione e autore: li leggono sia l'app
// (menu ⋮ → informazioni) sia il service worker (nome della cache).
// Ad ogni rilascio incrementa APP_VERSION: così i dispositivi scaricano la versione nuova.
var APP_NAME = "La mia cassa POS";
var APP_VERSION = "3.0.0";
var APP_AUTHOR = "Luigi Antonucci";
