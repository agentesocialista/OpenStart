# OpenStart

Pagina di partenza personale ispirata ai principali servizi di start page: pagine multiple, griglia di widget trascinabili, ricerca web, collegamenti, note, attività, meteo, feed RSS, calendario e condivisione pubblica.

Il progetto è **statico** (HTML/CSS/JavaScript vanilla, nessun framework e nessuna dipendenza del servizio originale) e usa solo:

- **Supabase** per i profili e la sincronizzazione dati;
- **GitHub** come sorgente del codice;
- **Netlify** per hosting, deploy continuo e la function proxy dei feed RSS.

## Funzionalità

- Primo accesso: inserimento del nome → generazione di un **codice personale di 6 caratteri** (lettere maiuscole e numeri, senza caratteri ambigui). Lo stesso codice su un altro dispositivo ripristina tutti i dati.
- Pagine laterali: creazione, rinominazione (doppio clic), eliminazione e riordino tramite trascinamento.
- Widget: collegamenti, orologio, note, da fare, meteo, feed RSS, calendario, citazione, timer. Aggiunta, modifica, duplicazione, rimozione, ridimensionamento e riordino con drag & drop.
- Aspetto: tema chiaro/scuro, 8 colori principali, 6 sfondi, densità comoda/compatta, layout a 6 o 12 colonne.
- Ricerca web con Google, Bing, DuckDuckGo o YouTube (scorciatoia `/`).
- Importazione/esportazione JSON, rimozione account, logout dal dispositivo.
- Condivisione di una pagina tramite link pubblico in sola lettura (`?share=CODICE8`).
- Salvataggio automatico debounced su Supabase con fallback locale quando offline.

## Struttura

```
public/                  sito statico (publish directory di Netlify)
  index.html
  css/styles.css
  js/config.js           URL e publishable key Supabase
  js/utils.js
  js/api.js              wrapper delle RPC Supabase
  js/store.js            stato, default e salvataggio
  js/widgets.js          rendering e logica dei widget
  js/app.js              UI, modali, eventi
netlify/functions/rss.mjs   proxy RSS ( /.netlify/functions/rss?url=… )
supabase/migrations/      schema SQL
netlify.toml
```

## Supabase

Progetto: `OpenStart` — `https://jswodjghmnxxlugickrc.supabase.co` (regione `eu-central-1`).
La chiave inserita in `public/js/config.js` è una **publishable key**, pensata per essere esposta nel browser. Le tabelle non sono accessibili direttamente: l'API anonima può eseguire solo le funzioni RPC `os_*`, che controllano il codice. Lo schema è in `supabase/migrations/001_openstart_initial.sql`.

### Nota di sicurezza

Il codice di 6 caratteri è l'unica credenziale: chi lo conosce può leggere e modificare il profilo. È un compromesso voluto per evitare email/password; per un uso pubblico sarebbe opportuno aggiungere un PIN, un rate limiting e/o un'autenticazione vera.

## Deploy

Sito live: **https://open-start.netlify.app** (progetto Netlify `open-start`, team `cano`).

Il repository è collegato a Netlify: ogni `git push` sul branch `main` genera un nuovo deploy (publish `public`, functions `netlify/functions`).

Per lavorare in locale:

```bash
git clone https://github.com/agentesocialista/OpenStart.git
cd OpenStart
python3 -m http.server 8080 --directory public
# http://localhost:8080
```

La function RSS richiede Netlify (o `netlify dev`); in locale i feed mostreranno un messaggio di indisponibilità.

Dati meteo: Open-Meteo (servizio pubblico senza chiave). Favicon dei collegamenti: monogramma generato localmente, nessuna richiesta esterna.
