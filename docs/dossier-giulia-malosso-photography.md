# Giulia Malosso Photography — Dossier completo

> Documento di sintesi generato il **8 ottobre 2026**.
> Fonti: PRD del CRM, schema del database (migrazioni Supabase), export reale delle sessioni `Sessioni GMPH 04.10.2026.csv`, piani di lancio e guide Meta Ads presenti in `docs/`, codice applicativo (`app/`, `components/`, `lib/`).
> Nota sui numeri: le statistiche quantitative derivano dall'export sessioni del **4 ottobre 2026** (40 sessioni). Non includono clienti senza sessioni, buoni regalo o pagamenti non presenti in quell'export.

---

## 1. L'attività in breve

**Giulia Malosso Photography (GMPH)** è l'attività di una fotografa freelance con studio a **Maser (TV), Via Bassanese 365**. Lavora da sola, gestendo in autonomia tutta la filiera: acquisizione clienti, prenotazione, sessione fotografica, post-produzione, consegna e vendita di stampe/extra.

**Aree di servizio fotografico:**
- Famiglia (in studio ed esterna, con pacchetti)
- Maternità
- Newborn / Kids / Mini Sessione Bambini
- Ritratto (studio ed esterna)
- Mini sessioni stagionali a tema (Autunno, Natale)
- Commerciale
- Provini / foto extra post-sessione

**Posizionamento e tono:** fotografia naturale e autentica, luce calda, momenti veri più che pose costruite. Comunicazione emotiva e intima, senza urgenza artificiale. Target principale: **famiglie della zona di Maser (TV) entro ~25 km**, genitori ~28–45 anni.

**Canali:** Instagram (Reel, Stories, caroselli), Facebook, email marketing (MailerLite), automazioni DM (ManyChat), inserzioni a pagamento (Meta Ads), sito WordPress + pagina pubblica di prenotazione del CRM.

---

## 2. Il CRM: cosa fa e perché esiste

### 2.1 Obiettivo
CRM web **privato e interno** (non un SaaS, non un portale clienti nella sua parte gestionale) che centralizza clienti, sessioni, buoni regalo e pagamenti. Priorità:
1. Visibilità sulle **prossime sessioni** e sul loro **avanzamento** (pipeline di lavorazione).
2. Visibilità su **incassi e crediti** (saldi, caparre, buoni).
3. **Centralizzazione** di informazioni altrimenti sparse tra chat, note e fogli di calcolo.

Utente unico e amministratrice: **Giulia**. Uso prevalentemente desktop, ma interfaccia usabile anche da mobile. Importi gestiti **in centesimi** per evitare errori di arrotondamento (es. 150,00 € = `15000`).

### 2.2 Stack tecnico
- **Next.js** (App Router, TypeScript) + **React** client components.
- **Supabase** (PostgreSQL) come database, con Row Level Security, trigger e vincoli di integrità lato DB.
- Autenticazione a utente singolo (login/logout dedicati).
- Hosting della pagina pubblica di prenotazione (`/prenota/[slug]`) con protezione anti-bot **Turnstile** e rate limiting.
- Deploy e sito vetrina WordPress affiancato (`sito-wordpress/`).

### 2.3 Moduli dell'applicazione
| Area (rotta) | Funzione |
|---|---|
| **Dashboard** (`/home`) | Prossime sessioni, incassi per periodo/metodo, budget annuale, grafici andamento, stato buoni |
| **Clienti** (`/clients`) | Anagrafica, contatti, consensi privacy/immagini, storico sessioni-buoni-pagamenti, import CSV |
| **Sessioni** (`/sessions`) | Agenda, calendario, pipeline a stati, prezzi, saldi, extra, import CSV, viste Lista/Pipeline |
| **Pagamenti** (`/payments`) | Registro movimenti (caparre, saldi, acquisti buono), filtri per metodo/periodo |
| **Buoni regalo** (`/vouchers`) | Emissione, riscatto, stato, scadenze |
| **Pacchetti** (`/pacchetti`) | Pacchetti per tipo di servizio, foto incluse, modelli email |
| **Prenotazioni** (`/prenotazioni`) | Configurazione motore di prenotazione pubblico (tipi evento, disponibilità, add-on) |
| **Prenota pubblico** (`/prenota/[slug]`) | Pagina pubblica dove i clienti scelgono data/slot e prenotano |
| **Calendly** (`/calendly`) | Sincronizzazione eventi Calendly → CRM |
| **MailerLite** (`/mailerlite`) | Sincronizzazione contatti verso gruppi MailerLite |
| **Configurazione** (`/config`) | Tipi servizio, metodi pagamento, stati sessione, validità buoni, budget |

### 2.4 Funzionalità trasversali
- **Ricerca globale** su clienti e sessioni.
- **Export CSV** da elenchi (clienti, sessioni, pagamenti).
- **Audit log**: ogni modifica a tabelle chiave è storicizzata (trigger `record_audit_log`).
- **Import CSV** per clienti e sessioni (onboarding dati storici).
- **Consensi separati** per trattamento dati (privacy) e utilizzo immagini, con tracciamento di concessione e revoca.

---

## 3. Modello dati (schema principale)

Entità e relazioni principali (PostgreSQL/Supabase):

- **`clients`** — anagrafica: nome, cognome, email (univoca, case-insensitive), telefono, indirizzo, note, consensi privacy/immagini, stato sync MailerLite.
- **`service_types`** — tipologie di servizio: nome, prezzo suggerito, attivo/ordine.
- **`sessions`** — una sessione per cliente: servizio (con snapshot `service_name`), data/ora, durata, luogo, **prezzo concordato** (congelato alla creazione), stato corrente, note, consenso immagini, deposito, pacchetto, foto incluse, URL gallery provini, collegamenti a Calendly/iCloud/booking.
- **`session_stages`** — stati della pipeline (configurabili).
- **`session_stage_history`** — storico di ogni cambio stato con data e nota.
- **`session_extras`** — provini/foto extra aggiunti a una sessione (prezzo × quantità).
- **`session_packages`** — pacchetti per tipo servizio, con foto incluse.
- **`gift_vouchers`** — buoni regalo: tipo (a servizio / a valore), acquirente, beneficiario, scadenza, stato.
- **`payments`** — movimenti: importo, metodo, categoria (caparra/saldo/pagamento pieno/acquisto buono), riferimento a sessione **oppure** buono.
- **`payment_methods`** — Contanti, PayPal, Wise, Buono regalo (di sistema).
- **`app_settings`** — valuta (EUR), validità buoni (default 12 mesi), budget annuale, parametri integrazioni.
- **`booking_event_types` / `booking_availability_rules` / `booking_availability_exceptions` / booking add-on** — motore di prenotazione pubblico.
- **`email_templates` / `session_emails`** — modelli email transazionali e registro invii.
- **`audit_log`** — registro modifiche.

**Stati sessione (pipeline) di default:**
`Prenotata` → `Sessione svolta` → `Provini inviati` → `Selezione ricevuta` → `Foto finali consegnate`, più `Annullata`.
(Lo stato storico "Pagamento ricevuto" è stato rimosso in una migrazione successiva per tenere separati avanzamento operativo e flusso di pagamento.)

**Metafora "palla" nella pipeline (board sessioni):** ogni stato indica chi deve agire — *palla a te* (Giulia) oppure *palla al cliente* — per capire a colpo d'occhio su cosa intervenire.

### 3.1 Regole di business chiave
- Il **prezzo concordato** è uno snapshot: modifiche successive al listino non lo alterano.
- Una sessione annullata resta nello storico e **non occupa** slot calendario.
- Una sessione si elimina solo se **senza pagamenti o buoni** collegati; altrimenti si annulla.
- Sessioni **future** partono da `Prenotata`, quelle **passate** da `Sessione svolta`; promozione automatica delle "booked" passate.
- Pagamenti e avanzamenti sono **indipendenti**: saldare non cambia lo stato operativo.
- Un pagamento salda **una sessione oppure** l'acquisto di un buono, mai entrambi (vincolo DB).
- Vincolo DB: un pagamento non può **eccedere** il residuo dovuto.
- Sessioni a **prezzo 0** vengono auto-saldate (`is_settled`).
- Buoni: validità 12 mesi (configurabile); stati `active`/`redeemed`/`expired`/`cancelled`; riscattabili **una sola volta**; buono a valore consumato per intero (nessun resto); differenza prezzo-valore saldabile con pagamenti.

---

## 4. Tipologie di sessione e listino (da dati reali)

Prezzi osservati nell'export del 4 ottobre 2026 (prezzo concordato per singola sessione):

| Servizio | Fascia prezzo | Durata tipica | Note |
|---|---|---|---|
| **Mini Sessione Natale** | 125 € feriale / 145 € sabato | 30 min | Deposito **40 €** alla prenotazione online; set natalizio in studio |
| **Famiglia** | 160 – 295 € | 45–60 min | Pacchetti (es. "gold"), supplemento sabato, gift card, studio/esterna |
| **Maternità** | 180 – 223 € (una gratuita a 0 €) | 30–60 min | Studio |
| **Commerciale** | 200 € | 60 min | |
| **Ritratto** | 90 – 120 € | 40–60 min | Studio o Maser |
| **Kids** | 100 € | 60 min | |
| **Mini Sessione Bambini** | 95 € | 60 min | |
| **Mini Sessione Autunno** | 90 € | 30 min | Mini sessione stagionale |
| **Provini Extra** | 32 – 70 € | 30–60 min | Foto aggiuntive vendute dopo la sessione |

Listino comunicato per la campagna Natale: **foto digitali incluse**, **stampe fine-art facoltative** proposte dopo la consegna (stampa singola, "Set Regalo Natale" da 3 stampe, album/box).

---

## 5. Numeri e andamenti (export 04.10.2026)

**Totale sessioni nell'export: 40** · **Clienti distinti coinvolti: 33** · **Valore concordato complessivo: ~5.513 €**

### 5.1 Distribuzione per tipologia
| Servizio | N. sessioni | Valore concordato |
|---|---:|---:|
| Mini Sessione Natale | 14 | 1.850 € |
| Famiglia | 8 | 1.570 € |
| Maternità | 5 | 833 € |
| Ritratto | 3 | 330 € |
| Provini Extra | 3 | 160 € |
| Mini Sessione Autunno | 2 | 180 € |
| Mini Sessione Bambini | 2 | 190 € |
| Kids | 2 | 200 € |
| Commerciale | 1 | 200 € |
| **Totale** | **40** | **5.513 €** |

### 5.2 Mini Sessione Natale (campagna in corso)
- **14 prenotazioni** già acquisite (export del 4 ottobre, a pochi giorni dal lancio del 5 ottobre → forte traino).
- 9 a 125 € (feriali) + 5 a 145 € (sabato).
- **Deposito 40 € per prenotazione** → **~560 €** di caparre raccolte, con **1.850 €** di valore potenziale a completamento.
- Tutte prenotate **online** tramite il motore di prenotazione del CRM (stesso `booking_event_type`), con sincronizzazione calendario iCloud.
- Date distribuite tra **27 ottobre e 28 novembre 2026**; slot in studio a Maser.
- Partecipanti per sessione: da 2 a 5 persone (dato raccolto in prenotazione per gestione outfit in studio).

### 5.3 Stato di avanzamento (pipeline)
- **~14 sessioni** in stato `Prenotata` (tutte le Natale future).
- **~23 sessioni** in `Sessione svolta` (lavori passati/in post).
- Poche sessioni in stati avanzati (`Selezione ricevuta`, consegna) — es. Maternità e Famiglia recenti.

### 5.4 Clienti ricorrenti
- Più clienti hanno **sessioni multiple**: un cliente con **4 Mini Sessioni Natale**, altri con sessione + provini extra, o Famiglia + Provini, o Kids + Provini. Segnale di **upsell** (provini/foto extra) e **ripetizione** (stesso cliente che prenota più occasioni).

### 5.5 Stagionalità osservata
- Maggio–luglio: Famiglia, Maternità, Ritratto, Kids, Provini (stagione "classica").
- Settembre: Mini Sessione Autunno + Famiglia/Maternità/Ritratto.
- Ottobre–novembre: picco **Mini Sessione Natale** (campagna dedicata).

---

## 6. Clienti e dati personali

Per ogni cliente il CRM conserva: nome, cognome, **email** (obbligatoria e univoca), telefono, indirizzo, data di nascita, note e **due consensi separati** (privacy e immagini) con date di concessione/revoca. Un cliente **archiviato** resta nello storico ma sparisce dagli elenchi predefiniti.

- Il consenso immagini è a livello **sessione** (una migrazione lo ha spostato da cliente a sessione) ed è richiesto in fase di prenotazione pubblica.
- La scheda cliente mostra lo **storico collegato** (sessioni, buoni, pagamenti) e lo **stato di sincronizzazione MailerLite**.
- In prenotazione online, se l'email corrisponde a un cliente esistente si **riusa l'anagrafica**, altrimenti si **crea** un nuovo cliente con i dati del form.

---

## 7. Pagamenti, buoni e pacchetti

### 7.1 Pagamenti
- Metodi: **Contanti, PayPal, Wise, Buono regalo**.
- Categorie: **caparra (deposit)**, **saldo (balance)**, **pagamento pieno (full_payment)**, **acquisto buono (voucher_purchase)**.
- Più pagamenti per sessione; il **saldo** = prezzo concordato + extra − pagamenti validi.
- Integrazione PayPal/Wise **non automatica**: i movimenti si registrano manualmente.

### 7.2 Buoni regalo
- Due tipi: **a servizio** (copre uno specifico tipo di sessione) e **a valore** (importo in €).
- Acquistati da un cliente, riscattabili da un beneficiario anche diverso.
- Scadenza calcolata alla vendita (12 mesi, configurabile); un buono a valore è sempre consumato per intero; se il prezzo supera il valore, la differenza si salda con pagamenti.
- Applicabili anche al **residuo** della sessione (migrazione dedicata) e con gestione dell'**overage**.

### 7.3 Pacchetti ed email transazionali (ultima evoluzione)
Migrazione `20261008000000` (pacchetti + email transazionali):
- **`session_packages`**: N pacchetti per ciascun tipo di servizio, con **foto incluse** e descrizione.
- Sulla sessione: `package_id`, `included_photos`, `proofs_gallery_url` (URL gallery provini, solo HTTPS).
- **`email_templates`**: modelli email modificabili (es. **"Invio provini"**) con variabili dinamiche: `{{nome}}`, `{{servizio}}`, `{{data_sessione}}`, `{{link_gallery}}`, `{{pacchetto}}`, `{{foto_incluse}}`, `{{contenuto_pacchetto}}`, `{{extra}}`.
- **`session_emails`**: registro delle email transazionali inviate (destinatario, oggetto, corpo, id provider, data).

---

## 8. Motore di prenotazione online

Pagina pubblica `/prenota/[slug]` che permette ai clienti di prenotare in autonomia.

Configurazione (`booking_event_types`):
- Slug pubblico, nome, descrizione, tipo servizio collegato.
- Durata, **buffer** tra sessioni (default 30 min), luogo.
- **Prezzo feriale / weekend** separati, con possibilità di mostrarlo o meno.
- **Finestra di prenotazione** (data inizio/fine) e **finestra di visibilità**.
- Preavviso minimo (ore), **massimo prenotazioni al giorno** e **totale**.
- Richiesta consenso immagini on/off.
- **Add-on** configurabili con tooltip esplicativo.

Disponibilità:
- **Regole settimanali** per giorno (fasce orarie, convenzione JS 0=domenica…6=sabato).
- **Eccezioni per data**: chiusura totale oppure ridefinizione fasce.

Protezioni: **Cloudflare Turnstile** (anti-bot) e **rate limiting** sulle API pubbliche. Le prenotazioni creano la sessione, raccolgono partecipanti/consenso e registrano il **deposito** (es. 40 € per la Mini Sessione Natale).

---

## 9. Integrazioni

| Integrazione | Direzione | Cosa fa |
|---|---|---|
| **Calendly** | Calendly → CRM | Sync manuale via polling (piano Free, no webhook): mappa gli eventi ai tipi servizio, crea/collega clienti per email, dedup via `calendly_event_uri` |
| **iCloud Calendar** | CRM → iCloud (CalDAV) | Ogni sessione genera un evento `.ics` nel calendario "work" di iCloud |
| **MailerLite** | CRM → MailerLite | Sync contatti verso due gruppi (transazionale / marketing) in base al consenso; batch upsert; **aggiunta a gruppo dei clienti delle sessioni selezionate** dalla pagina Sessioni |
| **Email transazionali** | CRM → cliente | Invio provini e altre comunicazioni da modelli con variabili; registro invii |
| **Turnstile** | Pubblico | Anti-abuso sulla prenotazione pubblica |

Il gruppo MailerLite viene scelto in base al **consenso marketing**: chi ha concesso privacy marketing finisce nel gruppo "Iscritti Newsletter", gli altri nel gruppo "Solo Transazionali". L'operazione di aggiunta al gruppo è **idempotente** (nessun duplicato, deduplica per email).

---

## 10. Marketing e inserzioni

### 10.1 Campagna faro: Christmas Mini Session 2026
- **Offerta:** sessioni dal **26 ottobre**, 15–20 min, foto digitali incluse, **125 € feriali / 145 € sabato**, stampe fine-art facoltative proposte dopo la consegna.
- **Idea guida:** "Il Natale passa, ma le fotografie restano." Tono caldo e intimo, niente urgenza finta.
- **Lancio prenotazioni a tutti:** **5 ottobre, ore 17:00 CEST**.
- **Landing:** "Il Natale da vivere insieme" — descrizione, durata, foto incluse, prezzi, date, CTA "Scegli la tua data" + FAQ.

**Funnel a tre fasi:**
1. **Riscaldamento (28 set – 4 ott):** Reel teaser, Stories sondaggio/box domande, carosello mood, raccolta iscritti alla **guida outfit** via form + automazione **ManyChat** (keyword `NATALE` in DM/commenti).
2. **Lancio (5 ott):** email MailerLite + Reel + Stories con link pubblico di prenotazione.
3. **Vendita continua (dal 6 ott):** FAQ, caroselli informativi ed emozionali, aggiornamenti disponibilità (solo slot reali), reminder email a chi non ha aperto/prenotato, countdown 22–25 ott, BTS dopo ogni sessione, email di chiusura a novembre, follow-up stampe dopo la consegna.

**KPI monitorati:** iscritti guida, aperture/click email, DM, prenotazioni reali, slot liberi per data, provenienza e **costo per lead/prenotazione**.

### 10.2 Meta Ads (guida operativa dedicata)
- **Riscaldamento (28 set – 4 ott):** pubblico locale **Maser (TV), raggio 25 km**, budget **5–8 €/giorno**, obiettivo awareness verso la guida; max 3 copy (A "crescita", B "atmosfera", C "tempo insieme").
- **Prenotazioni (dal 5 ott):** struttura Campagna → Gruppo → Inserzione.
  - **Scenario A (consigliato):** obiettivo **Vendite/Conversioni** con **Meta Pixel** ed evento prenotazione (Lead/Purchase).
  - **Scenario B (avvio rapido):** obiettivo **Traffico** ottimizzato sui clic al link di prenotazione.
- **Pubblici:** freddo locale (Maser 25 km, 28–45 anni); **retargeting caldo** (interazioni IG/FB 365 gg, visitatori landing 30 gg se Pixel); **esclusione** di chi ha già prenotato.
- **Budget consigliato:** ~**13–15 €/giorno** (10 € freddo + 5 € retargeting); lasciar girare **4–5 giorni** senza modifiche (fase di apprendimento).
- **Copy prenotazione:** A "data specifica", B "consegna in tempo", C "prova sociale" — CTA **Prenota ora** verso `/prenota/...` con **UTM** (`utm_source=meta&utm_campaign=christmas_conversion_2026&utm_content=copy_A/B/C`).
- **Metriche da guardare:** costo per risultato, CTR, **prenotazioni reali** nel gestionale.
- **Errori da evitare:** pulsante "Metti in evidenza", urgenza finta, traffico alla home invece che alla pagina di prenotazione, modifiche continue che azzerano l'apprendimento, UTM dimenticati.

### 10.3 Altri asset marketing
- Sito **WordPress** vetrina (`sito-wordpress/`) con guida di installazione.
- Email marketing e segmentazione via **MailerLite** (gruppi transazionale/marketing).
- Automazioni DM via **ManyChat**.

---

## 11. Stato e prossimi passi

- **Fatto:** CRM operativo (clienti, sessioni, pagamenti, buoni, pipeline, dashboard, audit, import/export), motore di prenotazione pubblico, integrazioni Calendly/iCloud/MailerLite, consenso immagini a livello sessione, extra/provini, pagamenti con data flessibile, auto-settle prezzo 0, add-on prenotazione.
- **In corso / ultima migrazione:** **pacchetti per servizio** + **email transazionali** (modelli "Invio provini" con variabili, gallery provini, registro invii) — migrazione `20261008000000` (da applicare/verificare in produzione).
- **Fuori scope (v1):** gestione multiutente/ruoli, fatturazione/fiscale, integrazione pagamenti automatica, portale clienti completo.

---

### Appendice — Glossario rapido
- **Provini / Provini Extra:** foto di anteprima; le "extra" sono foto aggiuntive vendute dopo la sessione (upsell).
- **Palla a te / al cliente:** indicatore della pipeline su chi deve agire.
- **Caparra (deposit):** acconto alla prenotazione (es. 40 € Natale); **saldo (balance):** pagamento a completamento.
- **Buono a servizio / a valore:** gift card legata a un tipo di sessione o a un importo in €.
