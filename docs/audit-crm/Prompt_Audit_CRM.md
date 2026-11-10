Esegui un **audit tecnico, funzionale, economico, commerciale e di qualità dati completo** del CRM GMPH.

L'obiettivo è produrre una fotografia estremamente accurata dello stato ATTUALE dell'applicazione, del repository e, quando accessibile, del database live.

L'audit deve essere abbastanza dettagliato da poter essere utilizzato in futuro come:

- documentazione tecnica;
- documentazione funzionale;
- riferimento per nuovi sviluppi;
- base per successive revisioni;
- confronto storico tra versioni del CRM;
- mappa delle fonti di verità;
- backlog ragionato di bug, rischi e miglioramenti.

NON limitarti a leggere superficialmente il codice.

Devi verificare concretamente ciò che è verificabile.

---

# 1. REGOLA FONDAMENTALE: NON MODIFICARE IL CRM

Questo task è un AUDIT.

NON devi:

- implementare nuove feature;
- correggere bug;
- modificare codice applicativo;
- modificare dati;
- eseguire INSERT/UPDATE/DELETE sul database;
- eseguire RPC che effettuano scritture;
- creare migrazioni;
- fare commit;
- fare push;
- fare reset;
- fare checkout che possa modificare il working tree.

Sono consentite esclusivamente:

- lettura dei file;
- ricerca nel repository;
- esecuzione test;
- lint;
- TypeScript check;
- build;
- query DB in sola lettura;
- creazione/aggiornamento dei file DOCUMENTALI dell'audit.

---

# 2. PRESERVARE IL WORKING TREE

Prima di qualsiasi altra operazione esegui:

```bash
git status
git branch --show-current
git rev-parse HEAD
git log -1 --format="%H%n%s%n%ci"
git diff --stat
git diff
```

Documenta:

- branch corrente;
- commit corrente;
- data commit;
- working tree pulito/non pulito;
- file modificati;
- file non tracciati;
- eventuali sviluppi presenti ma non ancora committati.

IMPORTANTISSIMO:

l'audit deve descrivere **lo stato reale del working tree**, non soltanto il commit HEAD.

Se esistono modifiche non committate, devono essere considerate nell'analisi.

NON modificarle.

---

# 3. GESTIONE STORICO AUDIT

Prima di creare il nuovo audit:

1. cerca nel repository tutti i file e le cartelle relativi ad audit precedenti;
2. cerca almeno:
   - file con `audit` nel nome;
   - file `CRM_GMPH_COMPLETE_AUDIT*`;
   - file `Prompt per audit*`;
   - cartelle tipo `Audit Ottobre 2026`;
   - documentazione equivalente sotto `docs/`;
3. identifica la cartella più appropriata per conservare gli audit CRM.

## Cartella canonica

Se esiste già una cartella chiaramente dedicata agli audit CRM, utilizza quella.

Se esistono vecchie cartelle frammentate per mese/data, razionalizza la struttura SENZA perdere file.

Se non esiste una cartella canonica, crea:

```text
docs/audit-crm/
```

Se la struttura documentale corrente rende più coerente un'altra posizione, puoi utilizzarla, ma documenta la scelta.

---

# 4. NAMING OBBLIGATORIO DEGLI AUDIT

Tutti gli audit CRM devono seguire questa convenzione:

```text
Audit_CRM_DDMMYYYY.md
```

Esempi:

```text
Audit_CRM_19102026.md
Audit_CRM_10112026.md
Audit_CRM_15122026.md
```

La data deve rappresentare:

**la data in cui l'audit è stato effettivamente eseguito**

nel fuso:

```text
Europe/Rome
```

NON usare:

- timestamp;
- formato ISO nel nome;
- mese scritto in lettere;
- `Complete Audit`;
- `final`;
- `latest`;
- `new`;
- numeri versione.

---

# 5. NORMALIZZAZIONE DEGLI AUDIT PRECEDENTI

Esamina gli audit già presenti.

Se un file precedente contiene chiaramente la data dell'audit nel proprio contenuto, può essere rinominato usando la convenzione:

```text
Audit_CRM_DDMMYYYY.md
```

Esempio:

```text
CRM_GMPH_COMPLETE_AUDIT_19102026.md
```

può diventare:

```text
Audit_CRM_19102026.md
```

se è inequivocabile che l'audit è del 19/10/2026.

Analogamente, sposta il file nella cartella canonica degli audit.

IMPORTANTE:

NON dedurre una data incerta dal `mtime` del file.

Usare, in ordine di preferenza:

1. data dichiarata all'interno dell'audit;
2. data chiaramente incorporata nel vecchio nome;
3. commit/documentazione che dimostri inequivocabilmente la data.

Se la data non è certa:

NON rinominare automaticamente.

Segnalalo nel report finale.

---

# 6. NON SOVRASCRIVERE AUDIT STORICI

Il nuovo audit deve SEMPRE creare un nuovo file.

Esempio oggi:

```text
Audit_CRM_10112026.md
```

Se il file esiste già:

NON sovrascriverlo alla cieca.

Prima verificane il contenuto.

Se rappresenta già un audit completo della stessa esecuzione, aggiornalo soltanto se questo task rappresenta esplicitamente la continuazione dello stesso audit.

Altrimenti fermati e segnala il conflitto nel report finale.

NON creare:

```text
Audit_CRM_10112026_v2.md
Audit_CRM_10112026_final.md
```

senza una necessità esplicita.

---

# 7. INDICE STORICO DEGLI AUDIT

Nella cartella degli audit crea o aggiorna:

```text
README.md
```

oppure:

```text
INDICE_AUDIT.md
```

Preferire `README.md` se non esiste già una convenzione diversa.

Inserire una tabella:

| Data | Audit | Commit | Note |
|---|---|---|---|
| 19/10/2026 | Audit_CRM_19102026.md | ... | ... |
| 10/11/2026 | Audit_CRM_10112026.md | ... | ... |

Ordinare dal più recente al più vecchio.

Il collegamento deve essere relativo.

NON cancellare riferimenti storici.

---

# 8. CONFRONTO CON L'AUDIT PRECEDENTE

Individua automaticamente l'audit cronologicamente precedente.

Il nuovo documento deve contenere una sezione:

# Cosa è cambiato dall'audit precedente

Confrontare almeno:

- numero migrazioni;
- tabelle;
- schema DB;
- sessioni;
- clienti;
- pagamenti;
- buoni;
- extra;
- lead;
- pacchetti;
- piano economico;
- analytics;
- booking;
- Home;
- integrazioni;
- bug precedenti;
- backlog;
- test;
- build;
- privacy;
- sicurezza.

Distinguere sempre:

- risolto;
- ancora aperto;
- peggiorato;
- cambiato;
- non più rilevante;
- nuovo problema.

NON copiare semplicemente le conclusioni del vecchio audit.

Verificarle nuovamente contro il codice corrente.

---

# 9. FONTI E LIVELLI DI CERTEZZA

Utilizza una legenda coerente.

Per esempio:

```text
[A] codice/schema repository
[B] database live verificato in sola lettura
[C] test automatici
[D] configurazione/package/env
[E] inferenza/non verificato
```

Ogni affermazione importante deve essere distinguibile tra:

- verificata;
- dedotta;
- non verificabile.

Non presentare un'inferenza come fatto certo.

---

# 10. AMBIENTE E STACK

Documenta accuratamente:

- framework;
- versione Next.js;
- React;
- TypeScript;
- Supabase;
- dipendenze principali;
- grafici;
- email;
- calendario;
- export;
- validazione;
- anti-bot;
- testing;
- package manager;
- timezone;
- architettura server/client.

Leggere:

```text
package.json
package-lock.json
```

e i file realmente rilevanti.

---

# 11. STRUTTURA APPLICAZIONE

Ricostruisci la struttura funzionale dell'app.

Documenta almeno:

- routing;
- autenticazione;
- layout;
- navigazione;
- API;
- helper;
- componenti condivisi;
- analytics;
- integrazioni.

Creare una tabella:

| Route | Funzione |
|---|---|

per tutte le pagine principali.

---

# 12. API

Inventaria tutte le route API reali.

Non affidarti all'audit precedente.

Trovale nel repository.

Documenta:

- numero totale;
- aree funzionali;
- endpoint pubblici;
- endpoint autenticati;
- eventuali endpoint critici.

Inserire l'elenco completo in appendice.

---

# 13. DATABASE

Analizza tutte le migrazioni.

Ricostruisci:

- tabelle;
- colonne importanti;
- PK;
- FK;
- CHECK;
- unique;
- trigger;
- RPC;
- RLS;
- policy dichiarate;
- cascade/restrict/set null.

Se hai accesso al Supabase configurato:

eseguire solo query in LETTURA.

NON eseguire scritture.

Confrontare:

**repository vs database live**

per:

- tabelle;
- colonne;
- RPC esposte;
- eventuale schema drift.

---

# 14. MIGRAZIONI

Conta tutte le migrazioni.

Per quelle successive all'audit precedente crea una tabella:

| Migrazione | Introduce | Presente live? | Rischi/dipendenze |
|---|---|---|---|

Non assumere che una migration sia applicata soltanto perché esiste nel repo.

Se possibile verificane gli effetti strutturali nel DB live.

---

# 15. RPC, FUNZIONI E TRIGGER

Documenta tutte le funzioni rilevanti.

In particolare:

- RPC esposte;
- funzioni PostgreSQL;
- trigger economici;
- trigger sessioni;
- trigger voucher;
- audit;
- sincronizzazione date;
- protezioni da sovrapagamento;
- overlap.

Per ogni funzione importante spiegare:

- input;
- comportamento;
- atomicità;
- failure mode;
- autorizzazioni;
- dipendenze.

---

# 16. CLIENTI

Audit completo dell'area Clienti.

Analizzare:

- CRUD;
- ricerca;
- archivio;
- duplicati;
- email univoca;
- overview;
- LTV;
- prossima sessione;
- consenso;
- MailerLite;
- import;
- sessioni associate;
- buoni acquistati.

Verificare che le metriche mostrate abbiano significato coerente.

---

# 17. LEAD

Audit completo del modello:

CLIENTE
vs
LEAD
vs
SESSIONE.

Analizzare:

- creazione;
- modifica;
- stati;
- fonte;
- tipo contatto;
- conversione;
- perdita;
- riapertura;
- duplicati;
- collegamento cliente;
- creazione sessione;
- compensazioni in caso di errore.

Se esistono dati live, fornire conteggi aggregati.

NON riportare nominativi.

---

# 18. LEAD ANALYTICS

Verificare:

- universo;
- filtri;
- coorti;
- conversion rate;
- valore prenotato;
- ticket medio;
- motivi perdita;
- nuovi/esistenti;
- fonte.

Controllare che le formule corrispondano realmente ai dati.

---

# 19. SESSIONI

Audit completo di:

- creazione;
- modifica;
- eliminazione;
- annullamento;
- duplicazione;
- overlap;
- durata;
- prezzo;
- servizio;
- pacchetto;
- inclusioni;
- foto;
- luogo;
- note;
- fasi;
- pipeline;
- lista;
- calendario;
- filtri;
- pagamenti;
- valore.

Verificare anche le modifiche non committate.

---

# 20. FILTRI SESSIONI

Se la pagina `/sessions` utilizza filtri condivisi tra:

- Lista;
- Pipeline;
- Calendario;
- Riepilogo;
- KPI;

verificare specificamente:

- fonte unica dei filtri;
- comportamento AND;
- selectedDate;
- calendarMonth;
- paginazione;
- conteggi calendario;
- coerenza tra Lista e Pipeline;
- reset filtri;
- responsive.

Segnalare qualsiasi divergenza tra i dataset mostrati.

---

# 21. PACCHETTI

Audit di:

- catalogo;
- prezzi;
- durata;
- foto incluse;
- attivazione;
- servizio;
- applicazione alla sessione;
- snapshot;
- inclusioni;
- storico;
- supplementi;
- override.

Verificare se vengono realmente utilizzati nei dati live.

---

# 22. EXTRA

Audit di:

- catalogo prodotti;
- categorie;
- unit/tiered;
- prezzi;
- costi;
- fasce;
- session_extras;
- snapshot;
- line_total;
- costi storici;
- add-on booking.

Verificare:

- valore;
- margine;
- copertura costi;
- righe senza prodotto/categoria/costo.

---

# 23. PAGAMENTI

Questa sezione deve essere particolarmente accurata.

Distinguere sempre:

## Valore servizi

```text
agreed_price_cents + extra
```

## Cassa

pagamenti monetari realmente ricevuti.

## Riscatti buono

copertura non monetaria.

Documentare categorie correnti e comportamento di:

- deposit;
- balance;
- full_payment;
- voucher_purchase;
- voucher_redemption.

Verificare:

- sovrapagamenti;
- residuo;
- metodi;
- date;
- timezone;
- eliminazione;
- rimborsi;
- snapshot nome metodo.

---

# 24. BUONI REGALO

Audit completo.

Analizzare:

- creazione;
- tipo value/service;
- acquisto;
- pagamento;
- omaggio;
- validità;
- scadenza;
- stato;
- riscatto;
- sessione collegata;
- credito applicato;
- credito inutilizzato;
- eliminazione riscatto;
- riattivazione.

Principio fondamentale da verificare:

```text
vendita buono = cassa
riscatto = copertura non monetaria
```

Verificare inoltre la distinzione tra:

- riscatto stesso anno;
- riscatto di buono acquistato in anno precedente;
- buono omaggio.

---

# 25. MODELLO ECONOMICO

IMPORTANTE:

NON usare automaticamente il modello descritto nell'audit precedente.

Analizzare il codice CORRENTE.

Il Piano Economico è stato modificato successivamente all'audit del 19/10/2026.

Verificare il comportamento corrente.

Il modello desiderato/current deve avere una sola fonte di verità.

In particolare controllare che:

### Sessioni pianificate servizio

siano derivate dalla somma dei mesi.

### Ticket medio pianificato

sia modificabile.

### Valore servizio

sia:

```text
sessioni × ticket medio
```

### Valore mensile

sia derivato dalla distribuzione dei servizi.

### Valore annuale

sia la somma automatica.

NON considerare desiderabili vecchi campi indipendenti quali:

- target annuale manuale;
- target mensile manuale;
- extra attesi separati;

se il codice corrente li ha già eliminati.

Descrivere ciò che esiste realmente oggi.

---

# 26. PIANO BUONI REGALO

Se il Piano Economico corrente comprende una previsione distinta delle vendite buoni, verificarla.

I buoni NON devono essere trattati come `service_type`.

Distinguere:

- piano dei servizi;
- vendite buoni previste.

Verificare formule e source of truth.

---

# 27. DASHBOARD ECONOMICO

Analizza `/analisi/economico`.

Distinguere chiaramente:

### Valore servizi pianificato

### Valore servizi erogati

### Valore servizi futuri

### Valore servizi acquisiti

### Cassa

### Cassa da sessioni

### Vendite buoni

### Riscatti buoni

### Riscatti buoni pregressi

### Riscatti omaggio

### Residuo da incassare

Verificare che nessuna metrica mescoli impropriamente:

- valore servizi;
- cassa;
- voucher.

---

# 28. ANALISI MENSILE

Verificare separatamente:

## Vista servizi

mese determinato dalla data sessione.

## Vista cassa

mese determinato dalla data pagamento.

Controllare che il sistema non presuma erroneamente che debbano coincidere.

È corretto che:

- un mese abbia molto lavoro e poca nuova cassa;
- un mese abbia molte vendite buoni e poche sessioni.

---

# 29. HOME

Audit completo della Home.

Controllare:

- KPI;
- sessioni future;
- calendario;
- stato pagamento;
- cassa;
- target/piano;
- grafici;
- buoni;
- timezone.

Verificare in particolare che:

la copertura del Piano Servizi venga confrontata con:

**valore servizi**

e NON con cassa.

La cassa deve essere KPI distinto.

---

# 30. SOURCE OF TRUTH ECONOMICA

Creare nel documento una sezione esplicita:

# Mappa source of truth

Deve includere almeno:

| Concetto | Fonte |
|---|---|
| Prezzo sessione | ... |
| Prezzo listino | ... |
| Extra storico | ... |
| Valore servizi | ... |
| Cassa | ... |
| Vendita voucher | ... |
| Riscatto voucher | ... |
| Importo riscattato | ... |
| Piano sessioni | ... |
| Ticket pianificato | ... |
| Valore pianificato | ... |

Verificare dal codice corrente, non copiare la tabella storica.

---

# 31. PRENOTAZIONE PUBBLICA

Audit completo:

- configurazione evento;
- disponibilità;
- eccezioni;
- slot;
- durata;
- buffer;
- limiti;
- prezzi;
- weekend;
- add-on;
- cliente;
- sessione;
- caparra;
- iCloud;
- concorrenza;
- Turnstile;
- rate limit;
- conferma.

Verificare atomicità e gestione errori.

---

# 32. PRIVACY

Audit particolarmente rigoroso.

Verificare:

- informativa;
- consenso privacy;
- consenso immagini;
- consenso marketing;
- valori default;
- checkbox;
- prenotazione pubblica;
- clienti;
- MailerLite;
- add-to-group.

Non assumere che problemi precedenti siano ancora presenti.

Controllare il codice attuale.

Classificare eventuali problemi privacy come alta priorità.

---

# 33. MAILERLITE

Verificare:

- sync;
- gruppi;
- logica consensi;
- add-to-group;
- stato cliente;
- error handling;
- env.

NON eseguire sincronizzazioni reali durante l'audit.

---

# 34. EMAIL

Verificare:

- provider;
- template;
- invio;
- preview;
- sanitizzazione;
- log;
- fasi;
- conferma booking;
- idempotenza;
- errori;
- configurazione env.

NON inviare email.

---

# 35. ICLOUD

Verificare:

- creazione evento;
- aggiornamento;
- cancellazione;
- error handling;
- configurazione;
- timezone.

NON effettuare modifiche reali al calendario durante l'audit.

---

# 36. CALENDLY

Verificare:

- token/configurazione;
- mapping;
- prezzi;
- timezone;
- import;
- duplicati.

NON effettuare sync distruttivi o modifiche esterne.

---

# 37. SICUREZZA

Analizzare:

- autenticazione;
- cookie;
- HMAC;
- sessione;
- rate limit;
- redirect;
- route pubbliche;
- service role;
- anon key;
- RLS;
- audit_log;
- CSV injection;
- sanitizzazione HTML;
- segreti.

NON stampare mai segreti nel documento.

Riportare solo il NOME delle variabili d'ambiente.

---

# 38. RLS

Confrontare:

- migrazioni;
- schema live;
- comportamento chiave anon;

solo se è possibile farlo in lettura.

Non tentare accessi distruttivi.

Segnalare eventuale drift.

---

# 39. ANALISI RETENTION

Verificare:

- universo sessioni;
- annullate;
- addon;
- clienti serviti;
- nuovi;
- ritorno;
- repeat rate;
- sessioni medie;
- valore cliente;
- percorsi;
- riattivazione;
- future.

Controllare eventuali differenze di universo rispetto alle altre analytics.

---

# 40. ANALISI EXTRA

Verificare:

- upsell rate;
- ticket base/finale;
- valore extra;
- costo;
- margine;
- filtro categoria;
- denominator;
- add-on legacy.

Segnalare chiaramente quando il margine non è affidabile per dati costo mancanti.

---

# 41. QUALITÀ DATI

Se il database live è accessibile in lettura, eseguire controlli aggregati.

Almeno:

- conteggio tabelle;
- clienti;
- sessioni;
- pagamenti;
- buoni;
- lead;
- extra;
- pacchetti;
- inclusioni;
- piani;
- orfani;
- duplicati;
- prezzi invalidi;
- quantità invalidi;
- pagamenti incoerenti;
- voucher incoerenti;
- sessioni sovrapagate;
- extra senza costo;
- dati legacy.

NON riportare:

- nomi clienti;
- email;
- telefoni;
- note personali.

Solo aggregati.

---

# 42. FOTOGRAFIA ECONOMICA

Produrre una fotografia economica aggregata per anno.

Almeno per gli anni presenti.

Separare:

### Numero sessioni

### Valore base

### Extra

### Valore servizi

### Cassa monetaria

### Cassa su sessioni

### Vendite buoni

### Riscatti buoni

### Residuo

Se il modello corrente permette di distinguere:

### Riscatti pregressi

### Riscatti omaggio

aggiungerli.

---

# 43. RICONCILIAZIONE

Verificare matematicamente, quando applicabile:

```text
valore servizi
=
copertura monetaria
+
riscatti
+
residuo
```

Segnalare eventuali discrepanze.

Utilizzare centesimi interi.

Non float.

---

# 44. SERVIZI

Produrre aggregati per servizio:

- sessioni;
- valore base;
- extra;
- valore totale;
- ticket medio se significativo.

Escludere o segnalare distintamente eventuali servizi legacy/add-on.

---

# 45. LISTINO PACCHETTI

Inserire snapshot del catalogo corrente:

| Servizio | Pacchetto | Prezzo | Durata | Foto | Inclusioni |

Solo dati commerciali/configurativi.

---

# 46. EXTRA CATALOGO

Inserire:

| Prodotto | Categoria | Pricing | Prezzo | Costo | Attivo |

Non includere dati cliente.

---

# 47. PERFORMANCE

Analizzare pragmaticamente.

Cercare:

- PostgREST 1000 righe;
- query senza paginazione;
- filtri dopo paginazione;
- caricamenti completi;
- N+1;
- query duplicate.

Distinguere:

**problema reale oggi**

da:

**problema futuro/potenziale**.

Non raccomandare ottimizzazioni premature.

---

# 48. ERROR HANDLING

Cercare:

- errori ignorati;
- catch vuoti;
- compensazioni;
- falso successo;
- operazioni parziali;
- chiamate esterne best effort.

Documentare i flussi più fragili.

---

# 49. TRANSAZIONALITÀ

Creare tabella:

| Operazione | Transazionale? | Note |
|---|---|---|

Almeno per:

- pacchetti;
- piano economico;
- pagamenti;
- voucher;
- lead conversion;
- booking;
- email;
- cataloghi.

---

# 50. TEST AUTOMATICI

Individuare tutti i test.

Eseguirli.

Documentare:

- file;
- numero test;
- risultato;
- warning;
- aree coperte;
- aree non coperte.

Se non esiste script `npm test`, NON è un motivo per modificare il codice durante l'audit.

Eseguire i test con il comando appropriato attuale.

---

# 51. LINT / TYPESCRIPT / BUILD

Eseguire:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Se uno fallisce:

NON correggere.

Documentare:

- comando;
- errore;
- file;
- possibile causa.

---

# 52. BUG CONCRETI

Creare una sezione:

# Problemi / bug concreti

Con tabella:

| ID | Titolo | Area | Severità | Evidenza | Impatto | Come riprodurlo | Possibile soluzione |
|---|---|---|---|---|---|---|---|

Classificazione suggerita:

- Critica
- Alta
- Media
- Bassa
- Informativa

NON gonfiare la severità.

---

# 53. DEBITO TECNICO / BACKLOG

Separare bug da debito tecnico.

Tabella:

| ID | Priorità | Problema | Impatto | Probabilità | Complessità | Raccomandazione |
|---|---|---|---|---|---|---|

Priorità:

- P0
- P1
- P2
- P3

---

# 54. COSA NON VALE LA PENA SVILUPPARE

Inserire una sezione esplicita:

# Cosa NON vale la pena complicare oggi

Considerare il contesto reale:

CRM monoutente, piccolo business fotografico, volumi limitati.

Evitare raccomandazioni enterprise non giustificate.

---

# 55. RISCHI OPERATIVI

Tabella:

| Rischio | Evidenza | Mitigazione minima |
|---|---|---|

Includere solo rischi concreti.

---

# 56. AUDIT COMMERCIALE

Rispondere almeno:

- quanti lead arrivano?
- quanti prenotano?
- conversion rate?
- nuovi vs esistenti?
- provenienza?
- motivi perdita?
- servizi più venduti?
- valore medio?
- extra?
- ritorno clienti?
- target?
- capacità?
- vendite buoni?
- riscatti?

Se non esistono dati sufficienti:

scrivere chiaramente:

**non misurabile**

e perché.

---

# 57. KPI AFFIDABILI VS NON AFFIDABILI

Creare:

| KPI | Affidabilità | Motivazione |
|---|---|---|

Usare:

- Alta
- Media
- Bassa
- Non misurabile

---

# 58. FLUSSI END-TO-END

Documentare in linguaggio semplice almeno:

### Lead → Cliente → Sessione → Extra → Pagamento

### Cliente esistente → nuova sessione

### Prenotazione pubblica

### Pacchetto → snapshot

### Acquisto buono → cassa → riscatto

### Piano economico → valore pianificato → acquisito

### Cassa → pagamenti

Aggiungere eventuali nuovi flussi presenti oggi.

---

# 59. SOURCE OF TRUTH

Creare una tabella completa:

| Concetto | Source of truth |
|---|---|

È una delle parti più importanti dell'audit.

Verificare ogni riga contro il codice attuale.

---

# 60. FUNZIONALITÀ IMPLEMENTATE

Creare tabella:

| Funzionalità | Stato | Note |
|---|---|---|

Usare categorie:

- Completa
- Parziale
- Non adottata
- Legacy
- Assente

---

# 61. REPOSITORY VS DATABASE LIVE

Creare una sezione specifica.

Verificare:

- migrazioni presenti;
- schema;
- tabelle;
- colonne;
- RPC;
- RLS;
- configurazioni;
- environment.

Non dichiarare corrispondenza con produzione se non è realmente verificabile.

---

# 62. COPERTURA STORICA DATI

Documentare da quando i dati possono essere considerati completi.

Distinguere:

- dati nativi;
- dati importati a posteriori;
- periodi parziali.

Questo è fondamentale per interpretare analytics e retention.

---

# 63. EXECUTIVE SUMMARY

All'inizio dell'audit inserire una sintesi leggibile anche senza competenze tecniche.

Deve indicare:

### Stato generale

### Punti forti

### Limiti principali

### Rischi tecnici

### Rischi operativi

### Incoerenze dati

### Funzionalità incomplete

### Integrazioni

### Top priorità

Non deve essere generica.

Deve derivare dall'audit appena eseguito.

---

# 64. CONCLUSIONI

Alla fine rispondere chiaramente:

## A. Stato del CRM oggi

## B. Cosa funziona bene

## C. Cosa è fragile

## D. Cosa sistemare prima di nuove feature

## E. Cosa può restare così

## F. Top 5 priorità tecniche

## G. Top 5 priorità operative/business

## H. Cosa NON sviluppare ora

---

# 65. APPENDICI

Inserire almeno:

## A. Tabelle DB

## B. Migrazioni

## C. RPC

## D. API

## E. Variabili ambiente — SOLO NOMI

## F. Integrazioni

## G. Test

## H. Letture live eseguite

---

# 66. PRIVACY DELL'AUDIT

NON inserire nel documento:

- nominativi clienti;
- email;
- telefoni;
- indirizzi;
- note cliente;
- password;
- token;
- chiavi API;
- cookie;
- secret;
- valori delle env sensibili.

Sono consentiti:

- conteggi;
- aggregati;
- nomi servizi;
- nomi pacchetti;
- prezzi;
- configurazioni non sensibili;
- nomi delle variabili ambiente.

---

# 67. FILE FINALE

Salvare il nuovo audit usando ESATTAMENTE:

```text
Audit_CRM_DDMMYYYY.md
```

nella cartella audit canonica individuata.

Esempio per il 10 novembre 2026:

```text
Audit_CRM_10112026.md
```

Il file deve essere completo e autosufficiente.

Non creare un documento breve che rimanda genericamente al precedente.

Ogni nuovo audit deve poter essere letto da solo.

---

# 68. AGGIORNARE L'INDICE

Dopo aver creato il nuovo audit:

aggiornare l'indice degli audit.

Verificare che:

- tutti i link funzionino;
- non vi siano duplicati;
- ordinamento cronologico corretto;
- nomi file coerenti.

---

# 69. NON ELIMINARE IL PROMPT DI AUDIT

Se esiste un file storico:

`Prompt per audit.md`

o equivalente, NON eliminarlo.

Puoi:

- spostarlo nella cartella audit;
- rinominarlo in modo più chiaro;

ad esempio:

```text
PROMPT_AUDIT_CRM.md
```

Questo file è una procedura, non un audit datato.

NON rinominarlo:

`Audit_CRM_DDMMYYYY.md`.

---

# 70. REPORT DELLE OPERAZIONI DOCUMENTALI

Alla fine, oltre all'audit, restituisci un breve report con:

## Audit creato
Percorso completo.

## Audit precedenti trovati
Elenco.

## File rinominati
Da → A.

## File spostati
Da → A.

## File lasciati invariati
con motivazione.

## Indice aggiornato
Percorso.

## Repository
Conferma che nessun file applicativo è stato modificato.

---

# 71. QUALITY CHECK FINALE

Prima di terminare verifica:

- il nuovo audit esiste;
- nome corretto `Audit_CRM_DDMMYYYY.md`;
- data corretta Europe/Rome;
- file non vuoto;
- nessun secret;
- nessun nominativo cliente;
- indice aggiornato;
- vecchi audit preservati;
- nessun audit sovrascritto;
- nessuna modifica applicativa;
- git diff finale coerente con sole modifiche documentali dovute all'audit.

---

# OBIETTIVO FINALE

Ogni volta che questo prompt viene eseguito deve produrre una nuova fotografia storica del CRM.

Nel tempo la cartella deve assumere una struttura ordinata simile a:

```text
docs/
└── audit-crm/
    ├── README.md
    ├── PROMPT_AUDIT_CRM.md
    ├── Audit_CRM_19102026.md
    ├── Audit_CRM_10112026.md
    └── Audit_CRM_DDMMYYYY.md
```

Non utilizzare file chiamati:

```text
latest
final
new
complete
v2
```

La DATA è la versione dell'audit.

Il nuovo audit deve descrivere sempre lo stato corrente, confrontarlo con il precedente e permettere di ricostruire nel tempo l'evoluzione reale del CRM.