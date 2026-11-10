# CRM GMPH: Complete Audit

Audit del repository e del database collegato, 12 ottobre 2026. Lingua: italiano. Destinatari: titolare, consulenti e AI senza accesso al progetto.

## 1. Executive summary

Il CRM GMPH gestisce l'operativita di Giulia Malosso Photography: anagrafiche, appuntamenti fotografici, avanzamento della lavorazione, extra, pagamenti, buoni regalo e prenotazioni pubbliche. Contiene anche sincronizzazioni manuali MailerLite/Calendly, scrittura calendario iCloud e invio email provini tramite Resend. Non e un CRM commerciale completo: non ha entita lead, opportunita, preventivi, campagne, costi o ore di postproduzione.

**Questo documento sostituisce, ai fini dell'audit, il dossier descrittivo dell'8 ottobre, ma non modifica quel file.** I numeri sotto NON derivano dall'export del 4 ottobre. Sono aggregati di letture dirette del database configurato localmente, terminate il **2026-10-12 alle 10:59:47 UTC (12:59:47 Europe/Rome)**. Il progetto Supabase e raggiungibile; non e stata verificata la corrispondenza con il database del deploy pubblico. Le letture di tabelle diverse non costituiscono uno snapshot transazionale unico.

| Evidenza quantitativa | Valore | Interpretazione |
|---|---:|---|
| Clienti in anagrafica | 233 | Non equivalgono a clienti paganti ne a lead |
| Sessioni | 42 | Tutte datate 2026; 3 sono classificate Provini Extra |
| Clienti con almeno una sessione | 38 | Identificati tramite client_id |
| Prezzo base concordato totale | EUR 5.723 | Valore commerciale, non incasso |
| Extra collegati | 3 righe, EUR 143 | Separati dalle 3 sessioni Provini Extra |
| Valore sessioni base + extra | EUR 5.866 | Nessuna annullata nel campione live |
| Pagamenti registrati | 63, EUR 6.651 | Comprendono riscatti buoni non monetari |
| Incassi monetari registrati | EUR 4.846 | 2025: 1.030; 2026: 3.816 |
| Riscatti buoni | 11, EUR 1.805 | Non nuovo denaro; valore inutilizzato EUR 5 |
| Buoni emessi | 15, prezzo acquisto EUR 2.360 | 4 attivi, 11 riscattati |
| Saldi sessioni aperti | 14 sessioni, EUR 1.575 | Tutti su sessioni future alla data di riferimento |
| Pacchetti / email inviate nel registro | 0 / 0 | Funzioni implementate ma non popolate nel DB letto |

Priorita: chiarire consensi marketing, correggere ambiguita economiche e affidabilita dei salvataggi; introdurre richieste commerciali con origine, esito e follow-up; rendere esportabili dati relazionali con ID; raccogliere tempi/costi per decidere pricing e marketing nel 2027.

### Metodo, fonti e limiti

- **C = codice verificato**: route, componenti effettivamente montati, helper e query applicative.
- **M = migrazioni**: schema e regole ricostruiti nell'ordine dei 28 file SQL. Le definizioni successive prevalgono sulle precedenti. Inventario strutturale su tutti i file, lettura delle definizioni determinanti.
- **L = live**: letture REST dirette PostgREST con GET/select e paginazione esplicita, senza RPC, POST, PATCH o DELETE. Nessun accesso alle API applicative che eseguono riconciliazioni in GET. OpenAPI verificata per tutte le 19 tabelle e relativi campi.
- **D = documentazione**: contesto dell'attivita e intenzioni dei piani marketing, non prova di implementazione.
- **P = proposta**: gap, roadmap ed export futuri; non funzionalita presenti.

Tipi, nullabilita e campi sono confrontati con OpenAPI live. CHECK, indici, trigger e RLS sono ricostruiti dalle migrazioni: **non e stata interrogata direttamente pg_catalog**, quindi non si certifica che le funzioni live coincidano byte per byte con il repository. Le SELECT dell'appendice B permettono tale verifica. Nessun segreto o elenco di nominativi e incluso. Non sono state inviate email, effettuate sincronizzazioni, applicate migrazioni o modificate righe. Nessun test funzionale con scritture e stato eseguito.

## 2. Architettura

### Stack e confini

| Livello | Evidenza |
|---|---|
| Applicazione | package name crm-gmph, versione 0.1.0, privata [C: package.json] |
| Frontend | Next.js 16.3.5 App Router, React 19.2.8, TypeScript; pagine che montano componenti client [C] |
| UI | Tailwind CSS 4, CSS globale, componenti condivisi e lucide-react; grafici ECharts 6 [C] |
| Backend | Route handler Next.js in app/api; helper lib; nessun backend separato nel repository [C] |
| Database | PostgreSQL/Supabase via @supabase/supabase-js 2.112.4, senza ORM [C/M/L] |
| Import/export | SheetJS xlsx 0.20.3; CSV e XLSX, import anche XLS/incolla [C] |
| HTML email/booking | sanitize-html 2.17.7 [C] |
| Calendario | CalDAV tramite tsdav 2.3.2 [C] |
| Hosting | README contiene suggerimento generico Vercel; lib/datetime.ts menziona runtime Vercel UTC. Non verificati dominio, deploy attivo, regione o piano [C/D] |

Il browser chiama le route Next.js; queste usano supabaseAdmin con credenziale server privilegiata. Non c'e isolamento per organizzazione/utente nelle tabelle. L'accesso operativo dipende dalla protezione del proxy applicativo, non da identita Supabase individuali.

### Autenticazione e sicurezza

Accesso tramite codice condiviso, non account email/password Supabase. Il login crea un cookie firmato HMAC-SHA256, validita 30 giorni; proxy.ts controlla firma e scadenza. Cookie HttpOnly e Secure in produzione (route login). Logout elimina il cookie. Nessuna tabella utenti, ruoli, MFA, gestione inviti o attribuzione per operatore negli audit.

Percorsi pubblici: /login, /api/login, /prenota e /api/public/booking, comprese sottorotte. Il resto richiede cookie valido, salvo esclusioni matcher per asset. Tutte le tabelle applicative nelle migrazioni hanno RLS abilitata **tranne audit_log**, per cui non compare ENABLE ROW LEVEL SECURITY. Non sono definite policy RLS nel repository. Questo richiede verifica dei grant live; assenza di RLS nella migration non dimostra da sola esposizione effettiva, ma va controllata con priorita dato il contenuto personale degli snapshot. lib/supabase/client.ts esiste per accesso client, mentre le query di gestione analizzate passano da admin.

### Cartelle

| Percorso | Ruolo |
|---|---|
| app | Pagine, layout, metadata e route API |
| components | UI per dominio; shared per ricerca, audit, export, selettori e azioni |
| lib | Regole di calcolo, date, integrazioni, parsing, Supabase |
| supabase/migrations | Evoluzione SQL: 28 migrazioni dal 27 agosto al 10 ottobre 2026 |
| docs | PRD, dossier precedente, piani marketing, guide, un CSV storico |
| sito-wordpress | Tema PHP, anteprima e istruzioni; applicazione distinta dal CRM |
| public | Asset statici |

Script: dev, build, start, lint. Non e definito uno script test in package.json. Configurazioni ambiente locali ed example presenti; non ne vengono riportati valori. Non provati ambienti separati staging/prod, database di test, cron o CI di distribuzione.

Configurazioni rilevanti: codice accesso/firma sessione; connessione Supabase server; token MailerLite/Calendly; credenziali CalDAV e nome calendario; mittente/reply-to e credenziale Resend; chiavi Turnstile; URL sito. Turnstile e attivo solo quando entrambe le configurazioni richieste sono presenti. I flag DB regolano attivazione di servizi, metodi, stati, pacchetti ed eventi; non c'e un sistema generico di feature flag.

## 3. Funzionalita

Stato **completa nel perimetro** significa percorso UI/API presente, non certificazione runtime o assenza di bug. **Parziale** identifica limiti espliciti. **Legacy** identifica comportamenti mantenuti per compatibilita. **Non usata nei dati letti** non significa codice morto.

### Pagine e moduli

| Nome / URL | Dati e azioni realmente disponibili | Filtri, ricerca, ordinamento, trasferimento | Stato e limiti |
|---|---|---|---|
| / | Redirect a /home | Nessuno | Completa |
| /login | Codice accesso; ingresso e redirect | Nessun recupero account | Completa per utente condiviso |
| Dashboard /home | Prossime 6 sessioni, calendario, saldi, stati pagamento, incassi, buoni, budget/grafici | Incassi mese/anno/ultimi 30 giorni/tutto; analytics per anno | Parziale: periodi diversi fra KPI, nessun margine/funnel |
| Clienti /clients | Nome, contatti, nascita, LTV nominale, saldo; nuovo, azioni per cliente e eliminazione selezionati | Ricerca nome/cognome/email; alfabetico, aggiornamento, prossima sessione, LTV; solo saldi aperti; CSV/XLSX | Completa anagrafica, LTV ambiguo; API supporta archiviati ma elenco standard carica attivi |
| /clients/[id] | Modifica dati/consenso privacy; archivio/ripristino; sessioni, pagamenti, buoni acquistati; scorciatoie operative; audit | Storico sessioni/pagamenti ordinato per data | Parziale: overview non include extra nel select sessioni; beneficiario non equivale ad acquirente |
| /clients/import | CSV, XLSX, XLS o incolla, mapping colonne/anteprima e risultato per riga | Max 1.000 righe API; email duplicate respinte | Completa import anagrafiche; nessun batch_id persistente |
| Sessioni /sessions | Lista, board pipeline, calendario; crea/duplica, modifica avanzamento, azioni selezionate, gruppo MailerLite | Cliente, multiselect servizio/stato/pagamento, giorno; future crescenti poi passate decrescenti; 10/25/50/100 per pagina; CSV/XLSX | Parziale: annullate sempre escluse dall'API lista; filtro giorno applicato alla pagina gia ricevuta |
| /sessions/[id] | Orario, durata, luogo, prezzo, note; avanzamento/data/nota; consenso immagini; extra; pagamenti; applicazione buono; gallery/pacchetto/foto; anteprima/invio email; audit | Pagamenti e storico ordinati; nessun upload foto | Completa gestione corrente, con incoerenze elencate sotto |
| /sessions/import | CSV/XLSX/XLS/incolla, cliente per email, servizio per nome o Altro, import con errori riga | Max 1.000 righe | Parziale/legacy: orari inventati dalle 09:00 e durata fissa 60; niente import pagamenti/extra |
| Pagamenti /payments | Registro; crea su sessione, modifica o elimina; acquisti e riscatti buono visibili | Metodo e categoria; date decrescenti; pagine 10/25/50/100; CSV/XLSX | Completa registro, non contabilita: nessun filtro periodo nella pagina e nessun rimborso strutturato |
| Buoni /vouchers | Crea buono con pagamento acquisto; beneficiario, pagamento, apertura dettaglio | Stato; API anche acquirente; acquisto decrescente | Completa emissione/riscatto, senza export dedicato o cancella/annulla esplicito nelle route analizzate |
| /vouchers/[id] | Modifica codice, tipo/importo/servizio, beneficiario, acquisto/scadenza, note; pagamenti; audit | Pagamenti per data | Parziale: modifiche anche su buoni storici senza versionamento dedicato |
| Pacchetti /pacchetti | Catalogo per servizio, nome, foto incluse, descrizione, attivo/ordine; crea/modifica/elimina; editor email | Associazione al servizio; ordinamento catalogo | Implementata; 0 pacchetti live; nessun prezzo del pacchetto |
| Prenotazioni /prenotazioni | Eventi, slug, finestre, prezzi, caparra richiesta, regole/eccezioni, add-on, campi form; anteprima slot e link pubblico | Configurazione per evento | Completa prenotazione semplice, parziale affidabilita transazionale |
| /prenota/[slug] | Giorno, ora, dati/consensi, add-on e conferma; protezione anti-bot condizionale | Slot calcolati; nessun indice eventi, noindex | Completa prenotazione senza pagamento; niente cancellazione/riprogrammazione self-service |
| /mailerlite | Gruppi, configurazione transazionale/marketing, anteprima/esecuzione sync e risultati | Incrementale, forzata, retry errori | Parziale: sincronizza contatti, non campagne o engagement |
| /calendly | Tipi evento remoti, mapping servizio/prezzi, preview/import | Polling manuale, eventi nuovi da 3 giorni prima | Legacy parallelo al booking proprietario; 0 sessioni live con URI Calendly |
| /config | Servizi/add-on, metodi, stati, budget/validita buoni e impostazioni | Attivi/ordine secondo configurazione | Completa configurazione corrente; prezzo suggerito non esposto dalla API; board ha codici hardcoded |
| Ricerca globale | Clienti, sessioni, buoni e pagamenti | Minimo 2 caratteri; email/nome, servizio, codice buono, note/riferimento pagamento; limiti 8 per ramo e dedup ID | Completa ricerca rapida, non motore analitico |
| Audit incorporato | Snapshot prima/dopo e campi cambiati, cronologia record | API ammette solo clients/sessions/gift_vouchers/payments | Parziale: piu tabelle registrate che consultabili; nessun autore |

### Inventario completo route API

I suffissi [id], [extraId], [code], [entity], [slug] sono parametri dinamici. Ogni rotta privata eredita la protezione proxy. Nessuna delle route di scrittura e stata invocata durante l'audit.

| Prefisso e rotte | Metodi | Scopo |
|---|---|---|
| /api/login; /api/logout | POST; POST | Cookie login/logout |
| /api/dashboard; /api/dashboard/analytics | GET; GET | KPI operativi; incassi anno |
| /api/clients | GET, POST | Elenco/calcoli e creazione |
| /api/clients/[id] | GET, PATCH, DELETE | Dettaglio, dati/consenso/archivio, elimina se consentito |
| /api/clients/[id]/overview | GET | Storico sessioni, pagamenti e buoni acquistati |
| /api/clients/import | POST | Import righe anagrafiche |
| /api/sessions | GET, POST | Elenco/filtri e creazione |
| /api/sessions/[id] | GET, PATCH, DELETE | Dati, stage, delivery, consenso, eliminazione |
| /api/sessions/options | GET | Clienti/servizi/stati selezionabili |
| /api/sessions/import | POST | Import storico |
| /api/sessions/[id]/payments | POST | Registra pagamento sessione |
| /api/sessions/[id]/eligible-vouchers | GET | Buoni applicabili |
| /api/sessions/[id]/redeem | POST | Riscatta buono tramite payment |
| /api/sessions/[id]/extras | GET, POST | Leggi/aggiungi extra |
| /api/sessions/[id]/extras/[extraId] | DELETE | Elimina extra; nessun PATCH dedicato |
| /api/sessions/[id]/emails | POST | Preview o invio effettivo |
| /api/payments | GET, POST | Registro e pagamento sessione |
| /api/payments/[id] | PATCH, DELETE | Modifica o elimina movimento |
| /api/payments/options | GET | Opzioni per nuovo pagamento |
| /api/vouchers | GET, POST | Elenco ed emissione con acquisto |
| /api/vouchers/[id] | GET, PATCH | Dettaglio/modifiche |
| /api/vouchers/[id]/payments | POST | Pagamento acquisto buono |
| /api/vouchers/options | GET | Opzioni buoni |
| /api/packages | GET, POST | Catalogo pacchetti |
| /api/packages/[id] | PATCH, DELETE | Modifica/elimina pacchetto |
| /api/email-templates/[code] | GET, PATCH | Modello email |
| /api/booking/event-types | GET, POST | Elenco/nuovo evento |
| /api/booking/event-types/[id] | GET, PATCH, DELETE | Evento, disponibilita, add-on |
| /api/booking/event-types/[id]/slots | GET | Preview disponibilita |
| /api/public/booking/[slug] | GET pubblico | Evento attivo e slot |
| /api/public/booking/[slug]/book | POST pubblico | Prenota |
| /api/calendly/event-types | GET | Tipi remoti |
| /api/calendly/mappings | GET, POST | Mapping locale |
| /api/calendly/mappings/[id] | DELETE | Elimina mapping |
| /api/calendly/sync | POST | Preview/esegui import |
| /api/mailerlite/groups | GET | Gruppi remoti |
| /api/mailerlite/sync | POST | Preview/esegui sync |
| /api/mailerlite/add-to-group | POST | Clienti delle sessioni selezionate al gruppo |
| /api/config | GET | Cataloghi/impostazioni |
| /api/config/[entity] | POST | Nuova voce catalogo |
| /api/config/[entity]/[id] | PATCH | Modifica voce |
| /api/settings | PATCH | Impostazioni singleton |
| /api/search | GET | Ricerca trasversale |
| /api/audit-log | GET | Log per tabella/id |

Sono 46 file route.ts. Non risultano endpoint lead, preventivi, fatture, campagne, costi, Google Calendar, Meta, ManyChat o webhook marketing/pagamenti. La presenza di URL UTM nelle guide non implica persistenza UTM nel CRM.

## 4. Database

### Relazioni reali

```text
clients --< sessions >-- service_types
sessions >-- session_stages (stato corrente)
sessions --< session_stage_history >-- session_stages
service_types --< session_packages --< sessions (facoltativo)
sessions --< session_extras >-- service_types (facoltativo)
booking_event_types --< booking_addons --< session_extras (facoltativo)
booking_event_types --< booking_availability_rules / booking_availability_exceptions
booking_event_types --< sessions (facoltativo)
clients --< gift_vouchers (acquirente; beneficiario separato facoltativo)
gift_vouchers --0..1--> sessions (riscatto; sessione univoca)
sessions --< payments >-- payment_methods
gift_vouchers --< payments (acquisto via voucher_id)
gift_vouchers --< payments (riscatto via applied_voucher_id)
sessions --< session_emails
service_types --< calendly_event_type_map
audit_log: riferimento logico table_name + record_id, nessuna FK
app_settings: singola riga con id=true
```

Una riga payments appartiene a una sessione O a un acquisto buono. Il riscatto usa session_id insieme ad applied_voucher_id, non voucher_id. email_templates.code non e una FK di session_emails.template_code: il registro conserva codice e contenuto inviato anche se il modello cambia.

### Vincoli e cancellazioni

Tutte le tabelle hanno PK UUID con gen_random_uuid(), eccetto app_settings.id boolean default true e CHECK(id). Colonne e default individuali sono in sezione 22.

| Tabella | Vincoli specifici e relazioni |
|---|---|
| clients | Email NOT NULL e unique lower(email); nessuna unicita nome/telefono; revoca privacy richiede concessione precedente |
| service_types | Nome UNIQUE; suggerito >=0 se valorizzato |
| payment_methods | Nome e code UNIQUE; code solo [a-z0-9_] |
| session_stages | Nome e code UNIQUE; code solo [a-z0-9_]; non enum SQL |
| sessions | Cliente/servizio/stato FK RESTRICT; prezzo >=0, durata >0, partecipanti >0 se presenti; foto >=0; gallery nulla o prefisso https://; caparra >=0; consenso immagini temporalmente valido; package FK RESTRICT; evento booking FK SET NULL |
| session_stage_history | Sessione CASCADE; stato RESTRICT; nome stato snapshot |
| session_extras | Sessione CASCADE; servizio RESTRICT nullable; addon SET NULL; prezzo >=0, quantita >0; non c'e CHECK che imponga almeno un riferimento di catalogo |
| gift_vouchers | Code UNIQUE; purchaser RESTRICT; recipient SET NULL; servizio RESTRICT; redeemed_session_id UNIQUE e RESTRICT; forma service/value esclusiva; status redeemed equivale a sessione e redeemed_at non null |
| payments | Sessione, buono acquisto, buono applicato e metodo RESTRICT; XOR session/voucher; amount >0; category voucher_purchase solo per acquisto; applicato solo a sessione; almeno paid_at o paid_date; inutilizzato >=0 |
| session_packages | UNIQUE(service_type_id,name); servizio RESTRICT; nome 1..120, foto >=0 |
| email_templates | Code UNIQUE e regex; subject 1..200 caratteri |
| session_emails | Sessione CASCADE; nessuna FK verso template o provider |
| calendly_event_type_map | URI tipo evento UNIQUE; servizio RESTRICT; entrambi prezzi >=0 |
| booking_event_types | Slug UNIQUE con regex lettere/numeri/trattini; servizio RESTRICT; durata >0; buffer/preavviso/prezzi/caparra >=0; capienze positive se non nulle; finestre fine >= inizio; selezioni single/multiple |
| booking_availability_rules | Evento CASCADE; weekday 0..6; fine > inizio; UNIQUE(evento,giorno,inizio,fine), ma sovrapposizioni di fasce diverse possibili |
| booking_availability_exceptions | Evento CASCADE; chiusa => orari null; aperta => orari entrambi presenti e fine > inizio; una chiusura per data/evento; incompatibilita chiusa/aperta sulla stessa data controllata da API, non completamente da DB |
| booking_addons | Evento CASCADE; categoria digital/print; prezzo >=0; quantita max >0 se presente |
| audit_log | Action insert/update/delete; nessun riferimento FK e nessun autore |
| app_settings | Currency char(3); validita buoni 1..120 mesi; budget >=0 |

Enum SQL: voucher_type = service/value; voucher_status = active/redeemed/expired/cancelled; payment_category = deposit/balance/full_payment/voucher_purchase/voucher_redemption. Il codice non implementa tutte le azioni suggerite dai valori enum: per esempio cancelled dei buoni non ha un'azione dedicata nella PATCH letta.

### Indici espliciti aggiuntivi alle PK/UNIQUE

| Tabella | Indici ricostruiti da M |
|---|---|
| clients | clients_email_unique_idx su lower(email); clients_active_name_idx(last_name,first_name) WHERE not is_archived; clients_mailerlite_subscriber_id_idx |
| sessions | sessions_scheduled_at_idx; sessions_client_id_idx; sessions_scheduled_at_duration_idx; sessions_calendly_event_uri_unique_idx WHERE non null; sessions_icloud_event_url_unique_idx WHERE non null; sessions_booking_event_type_idx(evento,scheduled_at); sessions_package_idx WHERE package non null |
| session_stage_history | session_stage_history_session_id_idx(session_id,changed_at DESC) |
| gift_vouchers | gift_vouchers_status_expires_at_idx |
| payments | payments_session_id_idx; payments_voucher_id_idx |
| audit_log | audit_log_record_idx(table_name,record_id,created_at DESC) |
| calendly_event_type_map | Unique URI oltre alla PK |
| booking_event_types | booking_event_types_active_idx(is_active,window_start_date); booking_event_types_visibility_idx |
| booking_availability_rules | booking_availability_rules_event_idx(event_type_id,weekday) |
| booking_availability_exceptions | booking_availability_exceptions_event_idx(event_type_id,exception_date); booking_availability_exceptions_closed_idx UNIQUE parziale WHERE is_closed |
| booking_addons | booking_addons_event_idx(event_type_id,category,sort_order) |
| session_packages | session_packages_service_idx(service_type_id,sort_order) |
| session_emails | session_emails_session_idx(session_id,sent_at DESC) |

Non compare indice esplicito session_extras.session_id nelle migrazioni. Gli indici non provano da soli prestazioni adeguate; nessun EXPLAIN live eseguito.

### Trigger e dati derivati

- set_updated_at: BEFORE UPDATE per app_settings, clients, service_types, payment_methods, session_stages, sessions, gift_vouchers, payments, session_extras, calendly_event_type_map, booking_event_types, booking_availability_rules, booking_availability_exceptions, booking_addons, session_packages, email_templates.
- record_audit_log: AFTER INSERT/UPDATE/DELETE per clients, sessions, gift_vouchers, payments, session_extras, booking_event_types, booking_addons, session_packages, email_templates. Ignora modifiche solo a created_at/updated_at; conserva JSON completo vecchio/nuovo negli altri casi.
- sessions_validate_schedule: BEFORE insert/update dei campi calendario, servizio/dettaglio/stato; valida sovrapposizione e categoria Altro.
- sessions_record_stage: AFTER inserimento/cambio stato; crea session_stage_history. session_stage_history_snapshot copia il nome dello stato prima dell'inserimento.
- sessions_auto_settle_zero_price: marca is_settled=true per prezzo base 0; non ricalcola saldo e non lo resetta quando il prezzo aumenta.
- payments_snapshot_method: copia nome metodo solo su INSERT, non UPDATE.
- payments_sync_dates: BEFORE insert/update, allinea giorno italiano e timestamp; se data senza ora, mezzogiorno Europe/Rome. Nella migration del 10 ottobre viene eseguito anche un riallineamento storico.
- payments_validate_amount: BEFORE insert/update; verifica prezzo base + somma(prezzo extra * quantita); dal 10 ottobre salta la rivalidazione per aggiornamenti che non aumentano importo e non spostano sessione/buono.
- payments_validate_voucher: BEFORE INSERT; lock del buono, disponibilita/scadenza/importo, aggiornamento al riscatto. Ultima definizione in repository ancora nella migration del 21 settembre: usa somma(price_cents) senza quantity, incoerente con gli extra successivi.
- payments_reactivate_voucher_after_delete: riattiva il buono eliminando il pagamento di riscatto; non implica rimborso monetario.
- gift_vouchers_set_expiry: calcola scadenza solo all'inserimento da purchased_at + mesi configurati.

Snapshot: service_name su sessione/extra/buono; agreed_price_cents; deposit_cents richiesto; prezzo/quantita extra; payment_method_name; stage_name; subject/body/to/sent_at email. Questi campi non sono necessariamente immutabili: le API permettono modifiche a prezzo sessione e dati buono. Nome/descrizione del pacchetto NON sono snapshot sulla sessione; included_photos null usa il catalogo corrente.

## 5. Regole di business

### Economia della sessione

Definizioni in centesimi:

```text
base = sessions.agreed_price_cents
extra = SUM(session_extras.price_cents * session_extras.quantity)
totale_dovuto = base + extra
copertura = SUM(payments.amount_cents WHERE session_id = sessione)
residuo = MAX(totale_dovuto - copertura, 0)
incasso_monetario = SUM(payments.amount_cents esclusi riscatti buoni)
```

Copertura include buoni e denaro; incasso no. Caparra richiesta non entra in copertura. Il prezzo suggerito del servizio esiste nel DB ma non e esposto dalle API correnti di configurazione/opzioni sessione: non va descritto come precompilazione operativa verificata. Il prezzo concordato e indipendente dalle future modifiche del listino; rimane modificabile esplicitamente nella sessione. Molte API manuali accettano euro interi, mentre DB e import storico possono rappresentare centesimi.

Sessione saldata se totale_dovuto=0 oppure copertura>=totale_dovuto; da saldare se copertura=0 e dovuto>0; altrimenti parziale. Formula implementata in helper/UI/query, non tramite is_settled. Una base gratuita con extra a pagamento non e gratuita nel suo totale.

Il trigger impedisce nuovi sovrapagamenti sul pagamento, ma non protegge simmetricamente riduzioni prezzo sessione o eliminazioni extra. Le API che le consentono possono creare eccedenze a posteriori. Nessun campo sconto, imposta, imponibile, fattura, storno o costo. Rimborsi non modellati; eliminare un pagamento modifica il registro e l'audit, non documenta un'uscita di cassa.

### Calendario e avanzamento

DB esclude overlap di sessioni non annullate mediante query di intervalli; il controllo non e un vincolo PostgreSQL EXCLUDE e non rende dimostrata la sicurezza in concorrenza. Backend booking aggiunge buffer e capienze. Nessuna risorsa fotografo/studio multipla. Una sessione annullata libera il calendario, conserva dati/pagamenti e puo essere ripristinata se non genera overlap.

Nuove sessioni manuali/storiche: booked se future, completed se passate. promotePastBookedSessions aggiorna booked a completed quando **l'inizio**, non la fine, e trascorso; viene chiamata durante alcune GET. Non attesta realmente che il servizio sia stato svolto e non e un job schedulato. Cancellazione o cambio stato non rimborso automatico.

### Privacy e immagini

clients mantiene solo consenso privacy con concessione/revoca; immagini spostato su sessions dalla migration del 31 agosto. Backend tratta attivo come concessione non nulla e revoca nulla. Non esistono colonne distinte di consenso marketing, versione informativa, fonte, prova documentale o storico consensi dedicato. L'audit puo conservare variazioni ma non sostituisce una raccolta strutturata.

**Problema verificato:** booking richiede accettazione privacy e la registra; sync MailerLite interpreta quegli stessi campi come consenso marketing. Inoltre add-to-group non legge il consenso. Non considerare questa implementazione prova di autorizzazione a newsletter; separare le finalita e verificare la raccolta con il responsabile privacy.

## 6. Flussi operativi

### Ciclo reale

```text
Creazione manuale / import / Calendly / prenotazione pubblica
  -> cliente nuovo oppure abbinato per email
  -> sessione booked oppure completed
  -> pagamenti ed extra gestiti indipendentemente dallo stato
  -> completed
  -> proofs_sent (manuale o dopo invio email provini)
  -> selection_received (manuale)
  -> delivered (manuale)
```

Da qualunque fase operativa e possibile selezionare altri stati attivi: non c'e una matrice di transizione rigida o obbligo di procedere nell'ordine. cancelled e una diramazione con possibile ripristino. Editing non e uno stato standard autonomo: puo essere implicitamente compreso fra selezione ricevuta e consegna. Nessun workflow di approvazione preventivo, pagamento obbligatorio prima dello shooting, conteggio foto selezionate, gestione file di editing, spedizione stampe o chiusura contabile.

| Stato standard | Significato operativo / attore UI | Transizione e automazione | Timestamp |
|---|---|---|---|
| booked | Appuntamento prenotato; palla a Giulia | Automatico alla creazione futura; diventa completed su lettura dopo l'inizio | scheduled_at; history.changed_at; booked_online_at se pubblico |
| completed | Sessione indicata come svolta; Giulia prepara provini | Automatico come sopra o manuale | History, non vero end_at |
| proofs_sent | Attesa selezione; palla al cliente | Manuale o invio template proofs riuscito | History + session_emails.sent_at se invio dal CRM |
| selection_received | Giulia elabora/consegna | Solo aggiornamento manuale standard | History; nessun elenco strutturato foto selezionate |
| delivered | Consegna registrata | Manuale; esclusa dal caricamento ordinario della board di lavoro | History; nessun link finale dedicato |
| cancelled | Annullata | Manuale, elimina evento iCloud best-effort; niente rimborso | History; assente motivo strutturato |

Gli stati relativi a pagamenti sono disattivati dalla migration del 25 settembre, non cancellati: history rimane. Esistono 9 righe session_stages live, quindi non bisogna confondere i 6 codici standard di lavoro con il numero totale di record configurati. Lo storico puo essere retrodatato manualmente. In inserimento di una sessione passata, la history iniziale usa scheduled_at anziche l'istante reale d'importazione. Non e quindi un log affidabile dei tempi di lavorazione senza filtri di qualita.

### Percorsi accessori

- Import clienti: mapping, validazione, INSERT per riga, duplicate email segnalate; nessun aggiornamento automatico delle anagrafiche esistenti.
- Import sessioni: email cliente, match servizio o Altro, prezzo, note libere con bambino/eta/riferimento import; orario progressivo dalle 09:00 e durata 60. Nessun ID esterno vincolato: riesecuzione non e idempotente.
- Buono: emissione + pagamento acquisto, eventuale beneficiario, riscatto sulla sessione, differenza a carico cliente; inutilizzato registrato ma non riutilizzabile.
- Email: gallery/pacchetto facoltativo/foto, anteprima modificabile, invio, registro, aggiornamento stage proofs_sent. Reinviare proofs puo riportare indietro uno stato piu avanzato: nessun controllo monotono.

## 7. Clienti

Campi effettivi: UUID, nome, cognome, email obbligatoria, telefono, indirizzo testuale, data nascita, note, archivio, date creazione/aggiornamento, consenso privacy attivo/revocato e quattro campi MailerLite (ID subscriber, stato, ultima sync, errore). Nessuna origine lead, referral, tag locali, categoria famiglia, azienda/partita IVA, codice fiscale, fonte acquisizione o next_contact_at. Nomi bambini e eta possono finire in note da import, non in un modello famiglia/figli.

| Domanda | Risposta verificata |
|---|---|
| Nuovo o ricorrente? | Derivabile dalle sessioni storiche per client_id; non dalla data creazione anagrafica. Vale solo per la storia caricata, escludendo annullate e distinguendo appuntamenti futuri ed extra legacy |
| Quante sessioni ha fatto? | COUNT di appuntamenti pertinenti; scheduled_at passata o stage appropriato, ma completed puo essere automatico. Numero righe non sempre numero shooting |
| Quanto ha speso? | Derivare da pagamenti monetari associati alle sue sessioni + acquisti buoni da lui effettuati; non usare direttamente ltv_cents. Non e noto un pagatore terzo per pagamento sessione |
| Chi lo ha portato? | Nessun referrer strutturato; eventualmente note non affidabili |
| Quale canale? | booking/Calendly identificano modalita tecnica, non Instagram/Google/referral; source assente |
| Segmentazione per servizio? | Join sessions/service_types; distinta da gruppi MailerLite esterni |
| Ultima sessione? | MAX scheduled_at tra passate e non annullate; includere/excludere extra legacy esplicitamente |
| Quando ricontattarlo? | Non registrato; possibile regola proposta su ultima sessione/nascita, senza task o reminder automatico esistente |

Anagrafiche con zero sessioni possono essere contatti importati, acquirenti buoni o altro: **non sono automaticamente lead persi**. Email univoca riduce duplicati ma non unifica membri della stessa famiglia, email alternative o errori di indirizzo. Il match pubblico utilizza ILIKE senza neutralizzare i wildcard propri del pattern: non equivale in ogni caso a confronto email case-insensitive esatto.

## 8. Sessioni

Sessione conserva cliente, tipo servizio e nome snapshot, dettaglio Altro, appuntamento con fuso, durata pianificata, luogo, prezzo concordato, stato corrente, note, partecipanti, consenso immagini e collegamenti tecnici online/Calendly/iCloud. Catalogo pacchetto, override foto incluse e URL HTTPS gallery provini sono disponibili.

Non contiene un prezzo suggerito storico, prezzo pacchetto storico, origine commerciale, campagna, UTM, sconto motivato, costo, ore reali, data di fine effettiva, richiesta originaria, scadenza saldo, gallery finale, stato stampa/album o spedizione. Stampe e album possono essere righe extra con nome libero, non un workflow logistico. Il valore pagato/residuo e derivato dai payments, non una colonna saldo. deposit_cents e il richiesto all'atto della prenotazione; la selezione API dettaglio sessione non lo espone attualmente, pur essendo conservato in DB.

La scelta del pacchetto viene validata per stesso service_type_id dalla PATCH updateDelivery, ma una FK semplice non garantisce da sola la coerenza del servizio con il pacchetto se si scrive direttamente al DB. Numero foto in sessione null significa fallback al catalogo, zero significa zero. Modifica futura del catalogo puo cambiare contenuto mostrato/inviato per una vecchia sessione.

## 9. Pacchetti

session_packages e un catalogo N:1 rispetto al servizio. Campi commercialmente rilevanti: nome, foto incluse, descrizione testuale, attivo e ordine. **Nessuna colonna prezzo, durata, costo o deliverable strutturato.** Il prezzo esiste sul servizio come suggerimento, sull'evento booking come tariffa, sulla sessione come accordo. Non e corretto derivare il prezzo corrente di un pacchetto dalla sola tabella pacchetti.

Modificabile dalla UI; eliminazione soggetta ai riferimenti sessione RESTRICT. Audit delle modifiche presente ma nessuna versione catalogo esplicita. Collegamento opzionale sulla sessione, non snapshot completo. Nel database letto: catalogo vuoto e 42 sessioni senza package_id. La presenza di parole come gold nelle note storiche non costituisce assegnazione a session_packages.

I "pacchetti aggiuntivi" del checkout sono booking_addons, entita diversa: non confonderli con session_packages.

## 10. Extra

session_extras contiene righe vendute collegate alla sessione: nome snapshot, prezzo unitario in centesimi, quantita, note, servizio facoltativo e booking_addon_id facoltativo. Extra manuali derivano dal catalogo servizi aggiuntivi; add-on online nascono dal catalogo dell'evento. Costo commerciale della riga = prezzo * quantita. Il prezzo base della sessione **non incorpora automaticamente** gli extra.

Nessun pagamento allocato alla singola riga: incasso "degli extra" non identificabile direttamente quando si paga il saldo complessivo. created_at e data registrazione della riga, non necessariamente data vendita o competenza economica. Le modifiche al catalogo add-on eliminano e reinseriscono le righe: SET NULL puo perdere il collegamento storico agli add-on, mentre nome/prezzo/quantita restano sulla vendita.

Due rappresentazioni oggi convivono: 3 righe session_extras (EUR 143) e 3 sessioni con service_name Provini Extra (EUR 160). Non sommare quest'ultimo importo una seconda volta al valore sessioni: e gia incluso nei EUR 5.723 base. Per la frequenza di ritorno e il ricavo medio shooting, queste righe legacy vanno classificate prima di contare gli appuntamenti.

## 11. Pagamenti

Registro multi-movimento per sessione/acquisto buono. Categorie: deposit (caparra), balance (saldo), full_payment (pagamento intero), voucher_purchase (acquisto), voucher_redemption (riscatto non monetario). Metodi configurabili; seed Contanti/PayPal/Wise/Buono regalo. Nel live risultano 5 metodi configurati e movimenti effettivi solo Contanti, Wise e Buono regalo. Nessun gateway PayPal/Wise o riconciliazione bancaria.

### Regole per un'analisi esterna

1. **Valore commerciale**: agreed_price_cents + extra aggregati; attribuire per scheduled_at se si analizzano servizi del mese. Non e fatturato fiscale.
2. **Denaro registrato**: sum amount_cents escludendo applied_voucher_id non nullo, category voucher_redemption e metodo code gift_voucher. Eventuali incoerenze fra questi tre indicatori vanno isolate, non normalizzate silenziosamente.
3. **Doppi conteggi**: preaggregare extras e payments separatamente per session_id prima delle join. Non sommare acquisto buono e riscatto come due incassi.
4. **Extra**: una volta nel dovuto. Ricavo da extra = valore commerciale delle righe; allocazione dei pagamenti alle righe non disponibile.
5. **Buoni**: acquisto e incasso alla data del pagamento; utilizzo copre sessione e riduce esposizione buoni, senza nuova cassa. Distinguere valore facciale, prezzo vendita, applicato e inutilizzato.
6. **Annullate**: escludere da domanda/servizi attivi e crediti operativi secondo regola attuale; conservare pagamenti incassati finche non esiste rimborso. Non azzerare automaticamente la cassa storica.
7. **Future**: valore del portafoglio prenotato, non ricavo realizzato. Eventuali depositi gia registrati sono cassa prima del servizio.
8. **Parziali**: residuo = max(dovuto - tutti i pagamenti di copertura,0); non saldo - sola caparra richiesta.

paid_date e la data italiana per raggruppamenti giornalieri/mensili; paid_at e timestamp. Il trigger del 10 ottobre assegna mezzogiorno italiano se manca ora; questo orario non e un'informazione reale di transazione. Il DB mantiene entrambe nullable con CHECK almeno una: il fatto che le 63 righe lette abbiano entrambe non sostituisce il vincolo formale.

Modifica metodo pagamento: la PATCH aggiorna payment_method_id ma non payment_method_name; il trigger snapshot lavora solo in inserimento. Dashboard/export che usano il nome snapshot possono divergere dal metodo corrente referenziato. Eliminazione di movimento e consentita; nessun identificatore esterno univoco protegge da duplicati bancari. reference esiste, ma i POST manuali letti non lo popolano.

## 12. Buoni

Tipo service: servizio/nome e prezzo acquisto, value_cents null. Tipo value: valore nominale >0, servizio/nome null. UI creazione value imposta prezzo acquisto pari al valore, ma il DB distingue i campi. Acquirente obbligatorio; beneficiario facoltativo. Scadenza iniziale purchased_at + validita configurata, default 12 mesi; cambiando purchased_at successivamente non si ricalcola automaticamente expires_at.

Il riscatto finale in codice e **per credito economico**: value usa value_cents; service usa purchase_price_cents, anche per un tipo sessione diverso. API calcola min(credito,residuo); differenza inutilizzata in voucher_unused_cents. Non c'e portafoglio a utilizzi multipli o resto riutilizzabile. redeemed_session_id UNIQUE impedisce anche che due buoni diversi risultino riscattati sulla stessa sessione.

Emissione inserisce buono e pagamento separatamente; se payment fallisce viene tentata eliminazione compensativa del buono, non una transazione unica. Riscatto DB blocca il buono FOR UPDATE e ne muta lo stato durante il pagamento. Non c'e nel trigger finale un controllo che il prezzo d'acquisto sia interamente incassato prima del riscatto: dopo eliminazioni/modifiche dei pagamenti acquisto puo nascere un buono non finanziato. Stato expired viene riconciliato su letture applicative; GET diretta PostgREST non lo aggiorna.

voucher_overage_confirmed e residuo di precedenti regole: la logica finale usa amount applicato e voucher_unused_cents. Non usarlo come indicatore di un attuale consenso commerciale o ricavo. Nessun annullamento buono con rimborso integrato rilevato.

## 13. Prenotazioni

### Evento e disponibilita

booking_event_types definisce servizio, slug, nome/descrizione HTML sanificata, durata, buffer, luogo, prezzi feriale/weekend, caparra richiesta, visibilita prezzo, finestra appuntamenti, finestra pubblicazione, preavviso, massimo al giorno e totale, flag attivo, richiesta consenso immagini, form e modalita di scelta add-on. Weekend significa sabato **e domenica**, non soltanto sabato.

Regole settimanali: 0 domenica..6 sabato, piu fasce possibili. Eccezione chiusa annulla il giorno; eccezioni aperte sostituiscono le fasce ordinarie. Gli slot avanzano di durata+buffer, rispettano preavviso e fine fascia. Si sottraggono tutte le sessioni CRM non annullate, non gli impegni inseriti esternamente in iCloud. Se max_bookings_per_day e definito e ci sono prenotazioni, il motore propone solo combinazioni contigue con passo durata+buffer: e una regola di compattazione aggiuntiva, non solo un limite numerico.

Il conteggio massimo giornaliero usa attive; il conteggio massimo totale usa tutte le sessioni dell'evento, comprese annullate. Capienza indica numero appuntamenti per evento, non posti nello stesso slot. participants_count non viene confrontato con una capienza persone. Non ci sono slot prenotabili contemporaneamente da piu clienti.

### Dal click alla sessione

1. Pagina pubblica monta BookingWidget; GET carica evento attivo nel periodo visibilita e slot. Rate limit slot 60/minuto/IP; prenotazioni 5/10 minuti/IP, in memoria per istanza.
2. Cliente sceglie giorno/ora, compila nome/cognome/email obbligatori e campi opzionali/configurati, consensi e add-on. Form configurabile come lista ordinata JSON; compatibile con vecchio oggetto. Massimo 12 campi custom, etichette 80 caratteri.
3. POST verifica anti-bot se configurato, campi, email, nascita/partecipanti e privacy obbligatoria. Ricalcola disponibilita server-side; 409 se slot non piu disponibile.
4. Add-on ricaricati dal catalogo attivo; server valida ID, duplicati, quantita, massimi e single/multiple. Prezzi presi dal server; caparra richiesta = min(caparra evento,base+extra).
5. Cerca cliente per email. Se esiste aggiorna nome/cognome e contatti valorizzati, riattiva consenso privacy; altrimenti crea anagrafica. Non richiede OTP/prova possesso email. Non impedisce riuso di anagrafica archiviata.
6. Crea sessione booked con data/durata/luogo, prezzo base, caparra richiesta, consenso immagini, evento, timestamp online, partecipanti e note. Le risposte custom diventano testo nelle note (singola risposta fino a 1.000, totale note fino a 2.000 caratteri), non colonne analitiche.
7. Inserisce extra selezionati come righe snapshot. L'errore di questo inserimento non e controllato: possibile conferma con extra mancanti.
8. Prova scrittura iCloud e salva URL se riuscita. Risponde 201 con data/durata/luogo. **Non crea payments, non addebita, non manda email di conferma dal codice letto.**

Lettura disponibilita e insert separati; query trigger overlap non prova protezione da race concurrent. Nessuna chiave idempotenza richiesta o lock slot. Cliente aggiornato/creato prima di fallimento sessione puo restare senza prenotazione. Questi sono rischi di implementazione, non incidenti dimostrati sui 42 record.

Evento live: Mini Sessioni di Natale 2026, attivo, 30 minuti + 30 buffer, EUR 125 feriale / 145 weekend, caparra richiesta EUR 40, periodo 26 ottobre-30 novembre, massimo 2 al giorno, nessun massimo totale. Cinque regole, tre eccezioni, sei add-on. Non dedurre occupazione percentuale dividendo prenotazioni per tutti gli slot alternativi visualizzati: con limite giornaliero 2 il denominatore e diverso.

## 14. Email e marketing

Resend invia email transazionali da modello editabile; codice template seed proofs. Variabili: nome, cognome, servizio, data_sessione, pacchetto, foto_incluse, contenuto_pacchetto, extra, link_gallery. Sanificazione HTML e escaping variabili; link gallery HTTPS. Anteprima con avvisi, oggetto/testo modificabili; per proofs serve gallery. Sessione annullata respinta. Dopo successo provider, registra snapshot e tenta cambio stage.

Inserimento session_emails e update stage non verificano gli errori restituiti; nessuna transazione con il provider, idempotency key o retry persistente. Il registro prova un invio registrato/accettazione provider, non consegna, lettura o click. Nel live letto: 1 template, **0 session_emails**; nessuna prova di utilizzo reale del nuovo invio.

MailerLite: mapping a due gruppi configurati, sync manuale incrementale su updated_at/ultimo sync o errori, preview/forzatura; batch da 50, upsert per email, rimozione dal gruppo opposto, stato/errore salvati sul cliente. Lo stato subscribed/unsubscribed remoto non viene modellato localmente come consenso storico. Le newsletter/campagne sono gestite fuori dal CRM. Aggiunta manuale a gruppo dai clienti delle sessioni selezionate: dedup per client_id ma nessun controllo privacy nel percorso.

| Domanda | Risposta |
|---|---|
| Sa quali email sono state inviate? | Solo transazionali registrate in session_emails; log puo mancare se salvataggio fallisce. Non lista completa newsletter |
| Sa se aperte? | No, nessun evento apertura persistito |
| Sa se cliccate? | No, nessun click tracking persistito |
| Sa quale campagna genera prenotazione? | No: nessuna FK campagna/UTM/referrer nel booking |
| Distingue marketing da solo transazionale? | Si nel routing dei due gruppi, ma usa impropriamente lo stesso consenso privacy; non una distinzione giuridica affidabile |

ManyChat, guide outfit, Meta Ads e UTM compaiono come strumenti/piani nella documentazione; non sono integrazioni CRM verificate. Assenza dei dati impedisce funnel e attribuzione; una prenotazione online non prova una conversione pubblicitaria.

## 15. Integrazioni

| Sistema | Direzione / trigger / metodo | Dati, deduplica | Errori, retry, log e limiti |
|---|---|---|---|
| Supabase | Backend -> PostgREST, ogni operazione | Tutte le entita, FK/unique/trigger | Errori gestiti in modo non uniforme; audit parziale; nessuna coda generale |
| MailerLite | CRM -> provider, manuale; GET gruppi/subscriber, POST upsert/batch, rimozioni gruppo | Email/nome/cognome/telefono/gruppo; match email e ID subscriber | Batch 50, stato errore cliente, riprocessamento manuale; nessun backoff/coda/webhook campagne |
| Calendly | Provider -> CRM, manuale polling API | Tipi evento, primo invitato, email/nome/telefono, ora/durata, mapping prezzo; URI evento UNIQUE | Anteprima/errori per evento; reimport prova quelli non creati nella finestra; niente aggiornamento eventi gia importati/cancellazioni; non importa tutta la storia |
| iCloud | CRM -> calendario, creazione/modifica/annullo sessione nei percorsi che lo chiamano; CalDAV | UID deterministico da session_id, URL unico, titolo cliente/servizio, orari, luogo, note | Best-effort console; nessun job retry o stato sync; non legge busy esterni. Import CSV/Calendly non chiama direttamente upsert |
| Resend | CRM -> email, azione manuale; API HTTP | Destinatario, subject, HTML/testo; provider_message_id | Errori invio 502; nessun webhook delivery/open/click; registro successi non atomico |
| Turnstile | Browser -> backend -> Cloudflare a prenotazione | Token e IP per verifica | Condizionale a configurazione; non sostituisce rate limit condiviso |
| PayPal / Wise | Nessuna integrazione API trovata | Nomi metodo nel registro | Inserimento manuale, nessuna conferma gateway/banca |
| Google Calendar | Nessuna integrazione trovata | Nessuno | Non confondere con iCloud |
| Meta / ManyChat | Solo riferimenti documentali | Nessun dato campagne/DM/ads nel modello | Nessun pixel/webhook/Conversions API rilevato nel CRM |
| WordPress | Tema separato; non connettore DB | Sito/contatti; template contatti usa mailto | Nessun lead inserito nel CRM; plugin del sito realmente installati non ispezionati |

Calendly guarda eventi attivi da now-3 giorni e prende solo il primo invitato, ignorando quelli gia importati. Mapping prezzo weekend usa getDay() nel fuso server, diverso dal calcolo Europe/Rome del booking. Il testo Importata da Calendly viene salvato in note. Un mapping ad Altro senza service_detail entra in conflitto con il trigger: import non lo valorizza.

## 16. Analytics esistenti

| KPI/UI | Formula effettiva / origine | Periodo e limitazione |
|---|---|---|
| Incassi dashboard | SUM payments.amount_cents con payment_method_name != Buono regalo | Solo limite inferiore del periodo, non superiore; pagamenti futuri impropriamente registrati possono entrare |
| Incassi analytics | Stessa esclusione per nome; raggruppamento mese/metodo/service_name o Buoni regalo | paid_at nell'anno; confini e getMonth nel fuso del server, non esplicitamente Roma |
| Cumulato annuale | Somma progressiva 12 totali mensili | Non cumulato di servizi svolti |
| Budget | Totale monetario anno confrontato con annual_budget_cents | Budget singleton, non storicizzato per anno |
| Totale valore sessioni | Somma prezzo+extra delle non annullate | Tutta la storia, indipendente da filtro incassi |
| Da incassare | Somma max(prezzo+extra-copertura,0), non annullate | Include appuntamenti futuri; non include crediti acquisto buoni |
| Conteggi pagamento | Gratuita/saldata, non pagata, parziale sul totale incluso extra | Non usa is_settled |
| Prossime sessioni | Prime 6 attive future ordinate per scheduled_at | Stato pagamento include extra |
| Calendario dashboard | Stato con confronto paid vs solo agreed_price_cents | BUG: ignora extra, e gratuita senza movimenti marcata da saldare |
| Sessioni in ritardo | booked con scheduled_at passato | GET promuove prima a completed, quindi KPI tendenzialmente azzerato; non misura ritardo consegna |
| Buoni venduti | Numero totale gift_vouchers | Include eventuali cancelled; non richiede pagamento incassato |
| Buoni attivi/riscattati/scaduti | Conteggio status | Riconciliazione scadenza su GET, non job |
| Valore buoni attivi | SUM(value_cents oppure purchase_price_cents) | Credito nominale attivo, non cassa ne utile |
| In scadenza | Attivi con expires_at <= now+30 giorni | Dipende da riconciliazione delle gia scadute |
| LTV clienti | Valore tutte le sessioni + extra + prezzo di tutti i buoni acquistati | Include future e annullate; possibile doppio conteggio economico acquisto/riscatto; non cassa o margine |
| Saldo clienti | Residui delle sessioni non annullate | Extra corretti; non saldo acquisto buoni |
| Pipeline palla a te/cliente | Conteggi su codici hardcoded | Nuovi stati configurabili non automaticamente rappresentati; selezione/giorno non applicati come nella lista |

Non risultano report dedicati retention, cohort, sorgenti, redditivita, prestazioni ads o lead. Anno piu remoto analytics derivato dal primo paid_at; prima del riallineamento eventuali null potevano falsare selezione periodo. Nelle 63 righe lette oggi nessuna data mancante/incoerente.

### Controllo incrociato dei totali

Dashboard principale e lista sessioni moltiplicano correttamente extra per quantita. Analytics di cassa non aggiunge extra al pagamento: corretto per evitare duplicazione. Riscatti esclusi per **nome** metodo e non per identita/categoria: fragile rispetto a rinomina/snapshot incoerenti. Sessioni annullate escluse dal valore e crediti, non dagli incassi monetari: quest'ultimo comportamento e corretto in assenza di rimborso. Overview cliente e calendario hanno formule diverse dal totale completo. Nessuna somma dell'interfaccia deve essere automaticamente chiamata fatturato fiscale.

## 17. Dati reali disponibili

### Perimetro e aggiornamento

Fonte primaria quantitativa: GET/select PostgREST sul database configurato localmente, 12 ottobre 2026; lettura principale alle 12:59 Europe/Rome e successivi controlli di riconciliazione nella stessa sessione. Pagine da 500 righe, fino a esaurimento; per audit_log e app_settings solo conteggio esatto, non contenuti. Sono stati estratti in memoria soltanto i campi necessari, senza pubblicare ID personali, contatti, note o corpi email. Non e un export completo dell'attivita esterna al CRM.

| Tabella | Righe | Nota |
|---|---:|---|
| clients | 233 | 0 archiviate; 97 con privacy attiva, non automaticamente marketing autorizzato |
| sessions | 42 | Tutte 2026, tutte non annullate |
| session_extras | 3 | Quantita totale 3 |
| payments | 63 | 52 monetari e 11 riscatti |
| gift_vouchers | 15 | 12 acquirenti distinti |
| service_types | 22 | Catalogo, non 22 tipi effettivamente venduti |
| payment_methods | 5 | Contanti, PayPal, Wise, Fineco, Buono regalo |
| session_stages | 9 | 7 attivi, 2 legacy inattivi |
| session_stage_history | 111 | Include retrodatazioni/aggiornamenti |
| session_packages | 0 | Nessun pacchetto assegnato |
| email_templates | 1 | Modello proofs |
| session_emails | 0 | Nessuna email registrata nel nuovo modulo |
| booking_event_types | 1 | Evento Natale attivo |
| booking_addons | 6 | Catalogo evento |
| booking_availability_rules | 5 | Fasce settimanali |
| booking_availability_exceptions | 3 | Eccezioni |
| calendly_event_type_map | 1 | Nessuna sessione con calendly_event_uri |
| app_settings | 1 | Singleton |
| audit_log | 2.228 | Conteggio, nessuna estrazione di snapshot personali |

### Sessioni, servizi e anno di esecuzione

| Anno sessione | Sessioni | Base EUR | Extra EUR | Totale EUR | Copertura incl. buoni EUR | Residui EUR |
|---|---:|---:|---:|---:|---:|---:|
| 2024 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026 | 42 | 5.723 | 143 | 5.866 | 4.291 | 1.575 |

Zero righe 2024/2025 NON significa che Giulia non lavorasse in quegli anni. Non e presente quella storia sessioni nel database letto. Tutte le 42 righe sono state create nel 2026; created_at non permette di assegnare anno commerciale a un acquisto storico.

| Servizio snapshot | Sessioni | Base EUR | Extra collegati EUR | Valore totale EUR |
|---|---:|---:|---:|---:|
| Commerciale | 1 | 200 | 0 | 200 |
| Famiglia | 9 | 1.780 | 0 | 1.780 |
| Kids | 2 | 200 | 0 | 200 |
| Maternita (etichetta live con accento) | 5 | 833 | 0 | 833 |
| Mini Sessione Autunno | 2 | 180 | 0 | 180 |
| Mini Sessione Bambini | 2 | 190 | 0 | 190 |
| Mini Sessione Natale | 15 | 1.850 | 85 | 1.935 |
| Provini Extra, righe legacy sessione | 3 | 160 | 0 | 160 |
| Ritratto | 3 | 330 | 58 | 388 |
| Totale | 42 | 5.723 | 143 | 5.866 |

Media per riga sessione: EUR 136,26 base; EUR 139,67 incluso extra. Extra medio sulle 42 sessioni: EUR 3,40; su 3 righe extra: EUR 47,67. Queste medie non rappresentano margine, incasso medio o necessariamente prezzo medio shooting (tre righe sono extra legacy). Due sessioni hanno base e totale pari a zero.

### Distribuzione per mese, senza confondere cassa e servizi

| Mese sessione 2026 | Sessioni | Base EUR | Extra EUR | Totale EUR | Residuo EUR |
|---|---:|---:|---:|---:|---:|
| Gennaio-aprile | 0 | 0 | 0 | 0 | 0 |
| Maggio | 3 | 498 | 0 | 498 | 0 |
| Giugno | 7 | 1.168 | 0 | 1.168 | 0 |
| Luglio | 5 | 382 | 0 | 382 | 0 |
| Agosto | 2 | 190 | 0 | 190 | 0 |
| Settembre | 9 | 1.425 | 58 | 1.483 | 0 |
| Ottobre | 2 | 210 | 0 | 210 | 0 |
| Novembre | 14 | 1.850 | 85 | 1.935 | 1.575 |
| Dicembre | 0 | 0 | 0 | 0 | 0 |

Riferimento temporale: mezzanotte italiana del 12 ottobre 2026; bucket futuro include quel giorno. Passate: 26, EUR 3.721 inclusi extra, tutte coperte. Quel giorno/future: 16, EUR 2.145 inclusi extra, EUR 570 copertura, EUR 1.575 residuo. Stato operativo: 26 delivered e 16 booked. Nessuna cancelled o booked gia passata nei dati letti.

Online: 15 sessioni con booked_online_at; zero con URI Calendly. Snapshot caparre richieste: EUR 600. Le caparre realmente registrate nella categoria deposit sono **19 movimenti, EUR 780** su tutte le sessioni: non vanno comparate come lo stesso insieme. Il totale pagato sulle future (EUR 570) include ogni categoria/copertura e non soltanto deposit.

### Pagamenti e buoni per anno

| Anno pagamento italiano | Incassi sessioni EUR | Incassi acquisto buoni EUR | Cassa registrata EUR | Movimenti monetari |
|---|---:|---:|---:|---:|
| 2025 | 0 | 1.030 | 1.030 | 7 |
| 2026 | 2.486 | 1.330 | 3.816 | 45 |
| Totale | 2.486 | 2.360 | 4.846 | 52 |

| Mese pagamento | Movimenti monetari | Incasso EUR |
|---|---:|---:|
| 2025-01 | 1 | 160 |
| 2025-05 | 1 | 160 |
| 2025-08 | 1 | 160 |
| 2025-09 | 1 | 90 |
| 2025-10 | 2 | 260 |
| 2025-12 | 1 | 200 |
| 2026-05 | 7 | 725 |
| 2026-06 | 6 | 971 |
| 2026-07 | 6 | 380 |
| 2026-08 | 7 | 692 |
| 2026-09 | 10 | 688 |
| 2026-10 | 9 | 360 |

Mesi non elencati: nessun pagamento monetario letto. Totale categorie: deposit 19/EUR 780; balance 12/EUR 1.078; full_payment 6/EUR 628; voucher_purchase 15/EUR 2.360; voucher_redemption 11/EUR 1.805. Metodi: Contanti 10/EUR 895, Wise 42/EUR 3.951, Buono regalo 11/EUR 1.805; PayPal/Fineco senza movimenti nel campione.

| Anno purchased_at buono | Buoni | Prezzo acquisto EUR | Nota |
|---|---:|---:|---|
| 2025 | 8 | 1.190 | Diverso da cassa 2025: un pagamento ricade nel 2026 |
| 2026 | 7 | 1.170 | Gli acquisti incassati nel 2026 ammontano invece a 1.330 |
| Totale | 15 | 2.360 | Prezzo e facciale coincidono nel complesso osservato |

Quattro buoni attivi: EUR 550. Undici riscattati: credito originario EUR 1.810, applicato EUR 1.805, inutilizzato EUR 5. Nessun expired/cancelled presente. Una differenza d'anno fra acquisto dichiarato del buono e relativo pagamento e osservata: non e necessariamente errore, ma richiede riconciliazione con ricevute/banca prima di confrontare annualita.

Riconciliazioni:

```text
2.486 cassa sessioni + 1.805 riscatti = 4.291 copertura sessioni
4.291 copertura + 1.575 residuo = 5.866 valore sessioni
2.486 cassa sessioni + 2.360 cassa buoni = 4.846 cassa totale
4.846 cassa totale + 1.805 riscatti = 6.651 somma grezza payments
550 attivi + 1.805 applicati + 5 inutilizzati = 2.360 credito buoni
```

### Ricorrenza e completezza cliente

| Numero righe sessione per cliente | Clienti |
|---|---:|
| 0 | 195 |
| 1 | 34 |
| 2 | 4 |
| 3 o piu | 0 |

Quattro clienti su 38 con sessioni hanno piu di una riga: 10,53%. Escludendo **solo per questa analisi esplorativa** service_name=Provini Extra, rimangono 39 appuntamenti e un cliente ricorrente su 38: 2,63%. Non e un tasso di retention affidabile dell'attivita: storia breve, sessioni future e possibili dati mancanti. Non sono pubblicati nominativi. 12 acquirenti buoni; 189 anagrafiche non hanno ne sessioni ne buoni acquistati nel dataset. Non classificabili come prospect o persi senza dati aggiuntivi.

Nel 2026 tutti i 38 clienti con sessioni risultano "nuovi rispetto alla prima sessione registrata", zero ricorrenti da un anno precedente: e un effetto della copertura storica, non prova di nuova acquisizione nel 2026. MailerLite: 228 synced, 5 pending, zero error. Zero package_id, override foto e gallery valorizzati. Il modulo consegna/email esiste, ma i nuovi dati non sono ancora adottati nel DB letto.

### Controlli di qualita eseguiti e limiti storici

Nessun sovrapagamento sessione rispetto a base+extra; 28 saldate (incluse 2 gratuite), 9 parziali, 5 senza copertura. Nessun paid_at/paid_date mancante e nessun disallineamento giorno italiano; nessuna differenza fra nome snapshot metodo e nome metodo corrente nei 63 movimenti. Quantita extra tutte 1: il bug del trigger riscatto con quantity>1 non si manifesta su questi dati. Nessun buono attivo gia scaduto alla data di riferimento.

L'export locale del 4 ottobre e una fonte storica separata; il dossier precedente riporta 40 sessioni, 33 clienti e EUR 5.513 base. Non si somma al live e non serve a ricostruire incassi/extra/buoni mancanti. Gli Excel successivi citati dall'utente non sono nel workspace: **non e possibile certificare la riconciliazione con quegli Excel**. Le differenze rispetto al dossier precedente non sono automaticamente crescita netta: possono includere correzioni, deduplicazioni e riclassificazioni.

## 18. KPI calcolabili

**A** = direttamente calcolabile sui record disponibili. **B** = richiede join/elaborazione/definizione coerente. **C** = solo proxy o copertura parziale. **D** = dati necessari assenti. La classe riguarda il dato del CRM, non garantisce completezza della storia reale. "Ricavo" va sempre qualificato come cassa o valore servizi; fatturato fiscale non ricostruibile senza documenti fiscali.

| KPI richiesto | Classe | Formula o base disponibile | Elaborazione / dati mancanti |
|---|:---:|---|---|
| Fatturato annuale fiscale | D | Nessuna fattura/imponibile/IVA | Aggiungere documenti fiscali, regime/data competenza; cassa annuale e una metrica diversa |
| Fatturato mensile fiscale | D | Come sopra | Non denominare fatturato la somma dei payments |
| Incasso annuale registrato | A | Payments monetari per paid_date/anno | Esclusione riscatti con identificatori stabili; copertura storica da verificare |
| Incasso mensile registrato | A | Payments monetari per paid_date/mese | Stessa cautela su storicita e rimborsi assenti |
| Valore commerciale annuale/mensile | B | Base + extra per data sessione | Preaggregazione, annullate escluse, futuro separato |
| Valore prenotazioni future | B | Totale dovuto non annullate con scheduled_at futuro | Include extra, distinguere residuo e copertura gia ricevuta |
| Ricavo per servizio | B | Totale commerciale per service_type_id e snapshot | Cassa da join payments; acquisto buoni non attribuibile al servizio fruito senza convenzione separata |
| Ricavo per pacchetto | C | Session package_id + base/extra | Catalogo vuoto e storico non mappato; non ricostruibile da nomi nelle note con certezza |
| Ricavo medio sessione | B | Totale commerciale / sessioni pertinenti | Separare gratuite, annullate, future e sessioni-extra legacy |
| Extra medio | B | Somma righe extra / sessioni o / sessioni con extra | Definire denominatore; integrare/rimappare vendite extra legacy |
| Percentuale clienti ricorrenti | C | Clienti con >=2 shooting / clienti con >=1 | Storia incompleta, righe Provini, futuri; dato grezzo calcolabile ma non retention reale |
| Lifetime value cliente | C | Cassa registrata cliente o valore fruito | Manca storia completa, pagatore reale terzo, rimborsi e costi; ltv_cents UI non e LTV monetario |
| Sessioni per cliente | B | COUNT per client_id | Filtrare veri shooting e periodo/stato |
| Frequenza di ritorno | C | LAG scheduled_at per cliente | Pochi ritorni e storia parziale; eliminare upsell come falso ritorno |
| Clienti nuovi vs ricorrenti | C | Prima sessione osservata e successivi acquisti | Distinguere nuovi nel CRM da nuovi dell'attivita; manca storico pre-2026 |
| Stagionalita | C | Sessioni/valore/cassa per mese separati | Un anno parziale sessioni, campagne/futuri; non trend multiannuale |
| Tasso di occupazione | C | Booking effettivi / capacita evento ricalcolata | Solo eventi configurati, niente ore totali studio o versione disponibilita storica |
| Capacita disponibile | C | Regole/eccezioni/limiti e sessioni | Copre evento, non ferie/risorse/attivita non fotografiche/intero anno |
| Durata media sessione | C | AVG duration_minutes | Durata pianificata; import assegna 60; nessuna durata reale |
| Numero sessioni per mese | A | COUNT per scheduled_at locale | Scegliere perimetro shooting vs righe; non conteggio clienti |
| Margine | D | Mancano costi diretti e attribuzioni | Costi produzione, stampe, commissioni, outsourcing; per utile anche costi fissi |
| Ricavo per ora | C | Totale / ore pianificate shooting | Proxy; mancano preparazione, viaggio, selezione, editing, comunicazione |
| Conversion rate | D | Nessun denominatore lead/visite/sessioni funnel | Non usare 38/233 come conversione; creare lead e outcome |
| Richieste commerciali | D | Nessuna tabella richieste | Registro dedicato, timestamp, servizio/interesse, stato |
| Lead persi | D | Nessuno stato lost | Motivo/data esito, gestione duplicati e follow-up |
| Provenienza lead | D | Nessun source strutturato | Canale dichiarato, UTM/referrer, fonte first/last touch |
| Costo acquisizione cliente | D | Nessuna spesa marketing o attribuzione | Costi per periodo/campagna, nuovi clienti definibili e collegati |
| ROI advertising | D | Nessuna spesa/attribuzione/margine | Costi e conversioni attribuite; distinguere ROAS ricavi da ROI margine |
| Referral | D | Nessun referrer_client_id/codice | Fonte referral e referente facoltativo |
| Prestazioni campagne | D | Nessuna entita campaign, invio/apertura/click | Collegamenti a provider/campagne, eventi e spesa; dati esterni necessari |
| Saldi aperti | B | Dovuto meno copertura per sessione | Preaggregare; rivedere trattamento cancellazioni ed eccedenze |
| Vendite buoni | A | Numero e purchase_price_cents per purchased_at | Non cassa; distinguere stati e pagamenti |
| Credito buoni attivo | B | Valore nominale/credito service per stato/scadenza | Riconciliare senza GET mutante; non utile da buoni scaduti automatico |
| Tasso di adozione extra | C | Sessioni con extra / shooting | Extra legacy senza parent; categorizzazione e storia incompleta |
| Tempi attraversamento pipeline | C | Differenze history.changed_at | Retrodatazioni, automazioni e salti; non ore di lavoro effettivo |

## 19. Gap analysis

Importanza e difficolta sono valutazioni proposte per una piccola attivita locale, non stime di sviluppo contrattuali. Alta difficolta indica anche riconciliazione dati/integrazione, non solo numero di colonne.

| Gap | Importanza | Difficolta | Dati necessari | Implementazione minima proposta |
|---|---|---|---|---|
| Registro lead/richieste | Alta | Media | Richiesta, contatto, data, servizio, canale, stato | Nuova leads collegabile a client, lista e scheda, inserimento manuale rapido |
| Preventivo commerciale | Alta | Media | Importo proposto, invio, validita, esito/versione | Quote collegata a lead, senza confonderla con agreed_price della sessione |
| Follow-up e lead persi | Alta | Bassa/media | next_action_at, responsabile, outcome/lost_reason | Task elementare e viste scaduti; esito esplicito, non cancellazione record |
| Conversione lead->sessione | Alta | Media | Lead_id sulla sessione, data vinta/persa | Collegamento alla prenotazione e chiusura idempotente |
| Fonte Instagram/Google/newsletter | Alta | Bassa | source_code con unknown, fonte dichiarata | Select standard su lead/manuale/booking; non inferire dal nome cliente |
| UTM/Meta Ads | Alta | Media | source/medium/campaign/content/term, referrer, click id se lecito | Persistenza primo/ultimo contatto e trasmissione al booking; gestione cross-domain |
| Referral | Media | Bassa | referrer_client_id o testo normalizzato | Campo lead distinto dalla modalita tecnica online |
| Consenso marketing separato | Alta | Media | Scopo, granted/revoked, fonte, versione informativa | Consents per finalita e revisione sync/gruppi; riconciliare dati esistenti senza auto-consenso |
| Spesa marketing e CAC/ROAS | Alta | Media | Campaign_id, giorno, costo, fonte costo | Tabella campaign_spend e import mensile piattaforme prima di API automatiche |
| Costi diretti / margine | Alta | Media | Stampe, spedizioni, commissioni, esterni, materiali | Session_costs e costo riga extra; report contributo, separato dai costi fissi |
| Ore totali / margine ora | Alta | Bassa/media | Minuti per shooting, editing, viaggio, amministrazione | Time_entries anche a consuntivo manuale; confronti per servizio |
| LTV affidabile | Alta | Media | Definizione cassa/fruitore, storicita, rimborsi | Correggere formula, importare storico con provenienza; rollup cliente |
| Prima/ultima sessione e ritorno | Media | Bassa | Shooting reali, data valida, cliente risolto | Derivati e segmenti senza extra legacy; follow-up ricorrenza |
| Pacchetti con prezzi/versioni | Alta | Media | Prezzo, inclusioni, decorrenza e snapshot accordo | Versioni catalogo e snapshot sessione, backfill solo validato |
| Extra tipizzati e collegati | Alta | Media | categoria/SKU, parent session legacy, costo | Normalizzazione guidata, non nuova sessione per ogni upsell |
| Capacita studio e saturazione | Media | Media | Calendario ore, ferie, risorse, limiti mensili, versioni | Availability per risorsa e snapshot mensile; unione intervalli senza doppi conteggi |
| Rimborso e rettifica contabile | Alta | Media | Movimento origine, importo segno, data, motivo | Registro refund/storno immutabile, non delete come rimborso |
| Export relazionale completo | Alta | Bassa/media | ID, timezone, importi integer, origine/versione | CSV/XLSX separati per entita con manifest e filtri espliciti |
| Tracciamento email/funnel | Media | Media/alta | Provider events, message/campaign/lead/session IDs | Webhook validati/idempotenti, policy privacy e retention |
| Prenotazione affidabile | Alta | Media | Idempotency key, esito salvataggi, job sync | Operazione DB atomica, controllo concorrenza, outbox email/calendario |
| Provenienza import/qualita | Alta | Media | batch, source_id, source_date, confidence flags | Import idempotente, report scarti, data_quality per orari sintetici |
| Protezione audit e operatori | Alta | Media | Grant/RLS, actor, retention | Verificare RLS audit, protezione login, identita e accesso minimo |

### Lead: cosa manca davvero e cosa non fare

L'anagrafica clients rappresenta un contatto identificato, non una richiesta. Una persona puo chiedere Famiglia in gennaio, rinunciare per prezzo, poi prenotare Natale: servono due opportunita sotto lo stesso contatto. sessions rappresenta un appuntamento, quindi creare una sessione fittizia per ogni DM altererebbe calendario, disponibilita, conteggi e valore futuro.

Modello minimo proposto: leads(id, client_id nullable, received_at, source_code, campaign_id nullable, service_type_id nullable, status, quoted_amount_cents, next_follow_up_at, closed_at, lost_reason_code, converted_session_id nullable, notes). I dettagli di contatto per lead non ancora convertito richiedono campi dedicati o contatto associato; non imporre email per un primo DM se non disponibile. Stati consigliati: new, contacted, qualified, quote_sent, won, lost, disqualified. Stato cliente non deve diventare stato lead.

Deduplica: ID messaggio/modulo esterno quando esiste, poi verifica manuale; non fondere tutte le richieste dello stesso cliente. Conversione: distinguere richiesta qualificata, preventivo accettato, sessione prenotata e pagamento ricevuto. Lead annullato dopo prenotazione non e uguale a lead perso prima della vendita. Considerare conversioni per coorte received_at e finestra maturazione, con lead ancora aperti separati.

Niente ricostruzione inventata: le 189 anagrafiche senza sessione o acquisto buono non devono essere importate come 189 lead persi. Storico DM/email e advertising va eventualmente integrato da sorgenti autorizzate e marcato come ricostruito/incompleto.

## 20. Roadmap suggerita

Proposta funzionale, **nessun codice sviluppato**. Obiettivo 2027: scegliere servizi/prezzi e canali usando cassa riconciliata, conversione osservabile e redditivita per ora. Sequenza guidata da affidabilita dei dati: integrita -> definizioni/export -> raccolta lead/costi -> analisi. Nessuna previsione quantitativa di crescita e presentata come certa.

### Must have

| Intervento | Perche | Dati/tabelle | UI necessaria | Metriche abilitate / criterio di riuscita |
|---|---|---|---|---|
| M1 Integrita economica e booking | Evitare conferme incomplete, saldi diversi e riscatti errati | payments, sessions, session_extras, buoni; operazioni atomiche e idempotenza | Errori recuperabili, controllo residui, riconciliazione | Stesso saldo in lista/scheda/dashboard/query; test quantita>1 e concorrenza |
| M2 Consensi e sicurezza | Non equiparare privacy a newsletter; proteggere audit | clients, nuova consents, audit_log; configurazione accessi | Consenso per finalita e prova, stato sync chiaro | Nessuna iscrizione marketing senza evidenza specifica |
| M3 Report/export cassa, valore e credito | Rendere verificabile ogni decisione economica | Tabelle esistenti + eventuale reporting view; annual_budgets | Periodo, filtri annullate/futuri, export con ID | Totali riconciliabili con registro e buoni, non con somme miste |
| M4 Lead, preventivi, follow-up | Misurare domanda e perdite prima della sessione | Nuove leads, quotes; sessions.lead_id o relation equivalente | Inbox richieste, pipeline vendite, follow-up scaduti/esito | Tasso conversione per coorte; motivo perdita; tempo risposta |
| M5 Origini/campagne/spesa minima | Decidere dove investire | leads attribution; campaigns, campaign_spend; booking capture | Fonte dichiarata, UTM nascosti, import costi | CAC nuovi clienti e ROAS con quota unknown esplicita |
| M6 Pacchetti e storico vendite | Confrontare offerte e upsell | session_packages/versioni; snapshot sessione; extra tipizzati | Prezzo catalogo, override motivato, riclassifica storico assistita | Valore per pacchetto, upsell e prezzo realizzato |
| M7 Tempo/costi minimi | Pricing sostenibile, non soltanto ricavi | time_entries, session_costs, costi extra/commissioni | Consuntivo breve per sessione | Margine di contribuzione e margine per ora totale |

Ordine indicativo: M1-M3 prima di fidarsi dei numeri; M4-M5 prima delle nuove campagne 2027; M6-M7 prima della revisione listino. Criteri di qualita prima di lanciare i KPI: quota source unknown visibile, preventivi collegati, importi riconciliati, tempi realmente registrati. Soglie e target di business vanno concordati, non inventati dal dataset attuale.

### Should have

| Intervento | Perche | Dati/tabelle | UI | Metriche |
|---|---|---|---|---|
| S1 Segmenti cliente e ritorno | Sostenere ricontatto pertinente | Rollup clients/sessions, follow_up_tasks | Prima/ultima sessione, cohort, task | Ritorno 6/12 mesi, frequenza, LTV monetario osservato |
| S2 Capacita per risorsa | Pianificare saturazione e carico editing | Resource_availability, eccezioni/versioni, time_entries | Calendario ore e limite mensile | Occupazione, ore residue, produttivita |
| S3 Refund e riconciliazione | Evitare cancellazione di storia economica | Refunds/ledger, external_transaction_id | Storno motivato, import estratto conto | Incasso netto, insoluti, eccedenze |
| S4 Stato consegna/stampe | Ridurre lavori sospesi | Delivery_items, deadline, shipped_at | Coda consegne e prodotti | Tempo consegna, arretrato e costi prodotti |
| S5 Import storico affidabile | Rendere utili confronti annuali | Import_batches/source_records; mapping clienti/servizi | Preview riconciliazione, no duplicati | Cohort storiche con copertura esplicita |
| S6 Reminder transazionali | Ridurre mancati appuntamenti e attese | Outbox/jobs, eventi invio, preferenze | Pianificazione e annulla invio | Conferme, no-show (da aggiungere), tempo selezione |

### Nice to have

| Intervento | Perche | Dati/tabelle | UI | Metriche |
|---|---|---|---|---|
| N1 Ads/MailerLite analytics automatici | Ridurre import manuali quando processo stabile | Integration_events/campaigns/spend | Monitor sincronizzazioni | Prestazioni campagne aggiornate e riconciliate |
| N2 Portale cliente | Selezioni e consegne strutturate | Gallery selections, delivery/download events | Accesso cliente protetto | Selezione, conversione extra, completamento consegna |
| N3 Pagamento online | Semplificare riscossione | Provider transactions/webhooks/refunds/idempotency | Checkout e gestione esiti | Abbandono checkout, caparre ricevute, rimborsi |
| N4 Forecast e simulazioni prezzi | Supportare scenari dopo adeguata storia | Dataset pulito costi/ore/capacita/lead | Scenari con ipotesi esplicite | Valore atteso, contributo per slot, intervalli di incertezza |

## 21. Export consigliati

**Stato attuale:** i pulsanti condivisi esportano CSV e XLSX per clienti, sessioni e pagamenti. Mancano ID e molte dimensioni; non sono backup relazionali. Export sessioni include Cliente, Servizio, Data/ora formattata, Durata, Prezzo concordato, Extra, Totale dovuto, Pagato, Avanzamento; Pagato include buoni. Export clienti include nome/cognome/email/telefono/nascita/LTV/saldo. Export pagamenti include cliente/data/riferimento/causale/metodo/importo. Non risultano export dedicati lead, pacchetti, extra, buoni o log email.

**Contratto proposto:** una riga per entita, ID stabili e FK, importi integer centesimi + currency_code, timestamp ISO 8601 UTC e data locale derivata, intestazioni tecniche stabili, UTF-8 e protezione formula injection CSV. Manifest con exported_at, ambiente logico, timezone Europe/Rome, filtri, row_count, periodo/copertura e versione schema. Non includere note/PII per default negli export analitici; ID pseudonimi coerenti fra file per AI esterna. XLSX con fogli separati e stesso contratto del CSV.

Legenda colonne proposte: [E] esistente DB; [D] derivata; [N] nuova, non disponibile oggi. Una colonna per riga di seguito. Un export operativo interno puo aggiungere contatti personali sotto autorizzazione; quello analitico non ne ha bisogno.

### Export Sessioni

```text
session_id [E: sessions.id, PK]
client_id [E: FK clients]
service_type_id [E: FK service_types]
service_name_snapshot [E: service_name]
service_detail [E, opzionale]
package_id [E: FK session_packages, oggi null]
package_name_snapshot [N]
package_version_id [N]
scheduled_at [E]
scheduled_date_rome [D]
scheduled_year [D]
scheduled_month [D]
duration_minutes_planned [E: duration_minutes]
location [E, opzionale]
participants_count [E]
current_stage_id [E: FK session_stages]
current_stage_code [D: join]
is_cancelled [D]
is_future_at_export [D]
agreed_price_cents [E]
extras_total_cents [D: righe preaggregate]
total_due_cents [D]
cash_paid_cents [D: esclusi riscatti]
voucher_applied_cents [D]
total_covered_cents [D]
balance_cents [D]
deposit_requested_cents [E: deposit_cents]
deposit_recorded_cents [D: category deposit]
currency_code [D: app_settings]
included_photos_override [E: included_photos]
included_photos_effective [D]
booking_event_type_id [E: FK evento]
booked_online_at [E]
technical_origin [D: online/Calendly/unknown, non canale marketing]
lead_id [N: FK lead]
campaign_id [N: FK campaign]
import_batch_id [N]
is_legacy_extra [D: classificazione validata]
created_at [E]
updated_at [E]
```

### Export Clienti

```text
client_id [E: clients.id, PK]
is_archived [E]
created_at [E]
updated_at [E]
privacy_consent_active [D, accesso limitato]
marketing_consent_active [N]
mailerlite_sync_status [E]
first_session_date [D: shooting]
last_completed_session_date [D]
next_session_date [D]
session_count_completed [D]
session_count_future [D]
commercial_value_cents [D: perimetro esplicito]
session_cash_paid_cents [D]
voucher_purchase_cash_cents [D]
observed_cash_ltv_cents [D: non sommare riscatti]
open_session_balance_cents [D]
is_repeat_observed [D]
service_segments [D]
acquisition_source [N]
referrer_client_id [N: FK clients]
next_follow_up_at [N]
history_coverage_start [N]
```

### Export Pagamenti

```text
payment_id [E: payments.id, PK]
session_id [E: FK sessions, XOR voucher_id]
voucher_id [E: FK gift_vouchers, acquisto]
applied_voucher_id [E: FK gift_vouchers, riscatto]
attributed_client_id [D: cliente sessione oppure acquirente buono]
payment_method_id [E: FK payment_methods]
payment_method_code [D: join]
payment_method_name_snapshot [E: payment_method_name]
category [E]
amount_cents [E]
currency_code [D]
is_cash_movement [D]
voucher_unused_cents [E]
paid_at [E]
paid_date [E]
reference [E, se valorizzato]
external_transaction_id [N]
refund_of_payment_id [N]
created_at [E]
updated_at [E]
```

### Export Lead/Richieste

Non producibile oggi: tutte le colonne seguenti sono [N], incluse eventuali join al contatto. Un foglio vuoto con queste intestazioni sarebbe un template futuro, non un export di dati esistenti.

```text
lead_id [N: PK leads]
client_id [N: FK clients nullable]
received_at [N]
service_type_id [N: FK service_types]
source_code [N]
source_declared [N]
campaign_id [N: FK campaigns]
utm_source [N]
utm_medium [N]
utm_campaign [N]
utm_content [N]
utm_term [N]
referrer_client_id [N: FK clients]
status [N]
qualified_at [N]
quote_id [N: FK quotes]
quoted_amount_cents [N]
quote_sent_at [N]
next_follow_up_at [N]
closed_at [N]
lost_reason_code [N]
converted_session_id [N: FK sessions]
external_source_id [N]
created_at [N]
updated_at [N]
```

### Export Pacchetti

```text
package_id [E: session_packages.id, PK]
service_type_id [E: FK service_types]
name [E]
description [E]
included_photos [E]
is_active [E]
sort_order [E]
list_price_cents [N]
version_id [N]
valid_from [N]
valid_to [N]
created_at [E]
updated_at [E]
```

### Export Extra

```text
extra_id [E: session_extras.id, PK]
session_id [E: FK sessions]
client_id [D: join sessions]
service_type_id [E: FK service_types nullable]
booking_addon_id [E: FK booking_addons nullable]
service_name_snapshot [E: service_name]
unit_price_cents [E: price_cents]
quantity [E]
line_total_cents [D]
category_snapshot [N]
unit_cost_cents [N]
sold_at [N: non equivalente a created_at]
session_date_rome [D]
created_at [E]
updated_at [E]
```

### Export Buoni

```text
voucher_id [E: gift_vouchers.id, PK]
code [E: opzionale per export esterno]
voucher_type [E]
purchaser_client_id [E: FK clients]
recipient_client_id [E: FK clients nullable]
service_type_id [E: FK service_types nullable]
service_name_snapshot [E: service_name]
value_cents [E]
purchase_price_cents [E]
purchased_at [E]
expires_at [E]
status_stored [E: status]
status_effective_at_export [D]
redeemed_session_id [E: FK sessions]
redeemed_at [E]
purchase_cash_paid_cents [D: payments.voucher_id]
applied_cents [D: payments.applied_voucher_id]
unused_cents [D]
outstanding_purchase_cents [D]
created_at [E]
updated_at [E]
```

Export complementari consigliati: service_types/payment_methods/session_stages come lookup; session_stage_history per tempi (con warning); disponibilita/eventi per capacita; costs/time_entries/campaign_spend quando introdotti. Non esportare audit JSON completo a un'AI generica: puo contenere dati personali eliminati o note sensibili.

## 22. Data dictionary

Dizionario dello schema **esistente**, non dello schema proposto. La tabella e identificata dall'intestazione; ogni riga descrive una singola colonna. "Obbligatorio Si" = NOT NULL nel DB, non necessariamente input utente (puo esserci un default). "No" = nullable. `-` nei default significa nessun default esplicito; nei riferimenti significa nessuna FK. Tz = timestamptz, UUID = uuid, int = integer, bool = boolean. Gli importi sono centesimi EUR nell'uso corrente. Tipi/nullabilita verificati anche nell'OpenAPI live; default complessi e vincoli riferiti alle migrazioni quando OpenAPI non li dettaglia.

Origine: DB = default/trigger; UI = gestione manuale; BK = prenotazione; IMP = import; CAL = Calendly; ML = MailerLite; EM = invio email. Analytics: Si = misura/dimensione/chiave utile; Tecnico = qualita/audit, non KPI commerciale; No = non necessario per analisi quantitativa. I timestamp updated_at non rappresentano da soli eventi commerciali.

### 22.1 clients

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita contatto | DB | Si | PK, parent sessioni/buoni | Si | gen_random_uuid() |
| first_name | text | Nome | UI/BK/IMP/CAL | Si | - | No | -; dato personale |
| last_name | text | Cognome | UI/BK/IMP/CAL | Si | - | No | -; dato personale |
| email | text | Email abbinamento | UI/BK/IMP/CAL | Si | Unique lower(email) | Tecnico | -; email obbligatoria, non lead anonimo |
| phone | text | Telefono | UI/BK/IMP/CAL | No | - | No | - |
| address | text | Indirizzo libero | UI/IMP | No | - | No | -; non geografia normalizzata |
| notes | text | Note contatto | UI/IMP | No | - | No | -; non usare come attribuzione certa |
| created_at | Tz | Inserimento anagrafica | DB | Si | - | Tecnico | now(); non prima acquisizione reale |
| updated_at | Tz | Ultima modifica | DB | Si | - | Tecnico | now(), trigger aggiornamento |
| birth_date | date | Nascita cliente | UI/BK/IMP | No | - | Si | -; non nascita figli |
| is_archived | bool | Archivio logico | UI | Si | - | Si | false |
| privacy_consent_granted_at | Tz | Concessione privacy | UI/BK/IMP | No | - | Tecnico | -; riutilizzata da ML, problema di finalita |
| privacy_consent_revoked_at | Tz | Revoca privacy | UI | No | - | Tecnico | -; >= concessione se presente |
| mailerlite_subscriber_id | text | Identificatore remoto | ML | No | Logica, non FK | Tecnico | -; indice non unique |
| mailerlite_sync_status | text | Stato sincronizzazione | ML/DB | Si | - | Tecnico | pending; pending/synced/error |
| mailerlite_synced_at | Tz | Ultimo invio riuscito | ML | No | - | Tecnico | - |
| mailerlite_last_error | text | Errore integrazione | ML | No | - | Tecnico | -; non esportare messaggi senza sanitizzazione |

Le colonne image_consent_granted_at/image_consent_revoked_at originariamente in clients sono state eliminate dalla migration di spostamento: NON fanno parte del dizionario corrente del cliente.

### 22.2 service_types

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita servizio | DB | Si | PK | Si | gen_random_uuid() |
| name | text | Nome catalogo | UI | Si | UNIQUE | Si | -; snapshot distinti sulle vendite |
| suggested_price_cents | int | Prezzo suggerito opzionale | DB/storico | No | - | Si | -; >=0, non esposto nel flusso config corrente |
| is_active | bool | Selezionabile | UI | Si | - | Si | true |
| sort_order | int | Ordine elenco | UI/DB | Si | - | No | 0 |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |
| is_addon | bool | Servizio extra | UI | Si | - | Si | false; non riclassifica automaticamente vecchie sessions |

### 22.3 payment_methods

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita metodo | DB | Si | PK | Si | gen_random_uuid() |
| code | text | Codice stabile | Seed/UI | Si | UNIQUE | Si | -; regex [a-z0-9_]+; gift_voucher identifica non-cassa |
| name | text | Nome visualizzato | UI | Si | UNIQUE | Si | -; separato da snapshot payments |
| is_active | bool | Disponibile per inserimento | UI | Si | - | Si | true |
| is_system | bool | Voce protetta da PATCH config | Seed | Si | - | Tecnico | false; true per buono seed |
| sort_order | int | Ordinamento | UI/DB | Si | - | No | 0 |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |

### 22.4 session_stages

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita stato | DB | Si | PK | Si | gen_random_uuid() |
| code | text | Codice automazioni/pipeline | Seed/UI | Si | UNIQUE | Si | -; regex [a-z0-9_]+; codici custom con suffisso generato |
| name | text | Etichetta configurabile | UI | Si | UNIQUE | Si | -; history conserva snapshot |
| is_active | bool | Stato utilizzabile | UI/Migration | Si | - | Si | true; stati pagamento disattivati |
| sort_order | int | Ordine | UI/DB | Si | - | No | 0 |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |

### 22.5 sessions

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita appuntamento/riga storica | DB | Si | PK | Si | gen_random_uuid() |
| client_id | UUID | Cliente fruitore | UI/BK/IMP/CAL | Si | clients.id RESTRICT | Si | - |
| service_type_id | UUID | Servizio catalogo | UI/BK/IMP/CAL | Si | service_types.id RESTRICT | Si | - |
| service_name | text | Nome servizio snapshot | API | Si | Logica rispetto servizio | Si | -; non automaticamente rinominato col catalogo |
| scheduled_at | Tz | Inizio pianificato | UI/BK/IMP/CAL | Si | - | Si | -; import puo assegnare ora sintetica |
| agreed_price_cents | int | Prezzo base concordato | UI/BK/IMP/CAL | Si | - | Si | -; >=0, esclusi extra |
| current_stage_id | UUID | Stato attuale | API/DB/UI/EM | Si | session_stages.id RESTRICT | Si | - |
| notes | text | Note/risposte custom/import | UI/BK/IMP/CAL | No | - | No | -; contiene possibili dati personali |
| created_at | Tz | Inserimento | DB | Si | - | Tecnico | now(); non data servizio |
| updated_at | Tz | Ultima modifica | DB | Si | - | Tecnico | now(), trigger |
| duration_minutes | int | Durata prevista | UI/BK/IMP/CAL | Si | - | Si | Nessun default finale; >0 |
| location | text | Luogo libero | UI/BK | No | - | Si | -; nessuna risorsa strutturata |
| service_detail | text | Descrizione specifica Altro | UI/BK/IMP | No | - | Si | -; trigger obbliga per Altro e vieta per altri |
| image_consent_granted_at | Tz | Consenso immagini sessione | UI/BK | No | - | Tecnico | - |
| image_consent_revoked_at | Tz | Revoca immagini | UI | No | - | Tecnico | -; >= concessione |
| is_settled | bool | Flag storico gratuita | DB | Si | - | Tecnico | false; trigger true se base=0, non saldo affidabile |
| calendly_event_uri | text | Evento importato | CAL | No | Unique parziale | Tecnico | -; chiave dedup |
| icloud_event_url | text | Evento CalDAV | API/iCloud | No | Unique parziale | Tecnico | -; non prova allineamento completo |
| booking_event_type_id | UUID | Evento booking originario | BK | No | booking_event_types.id SET NULL | Si | - |
| booked_online_at | Tz | Istante prenotazione pubblica | BK | No | - | Si | -; non fonte marketing |
| participants_count | int | Numero persone previsto | BK | No | - | Si | -; >0, nessuna capienza persone |
| deposit_cents | int | Caparra richiesta snapshot | BK/DB | Si | - | Si | 0; >=0, non pagamento |
| package_id | UUID | Pacchetto associato | UI | No | session_packages.id RESTRICT | Si | -; catalogo corrente, non versione |
| included_photos | int | Override foto incluse | UI | No | - | Si | -; >=0; null fallback, zero valore esplicito |
| proofs_gallery_url | text | Link gallery provini | UI | No | - | Tecnico | -; HTTPS, nessuna gallery interna |

### 22.6 session_stage_history

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita passaggio | DB | Si | PK | Si | gen_random_uuid() |
| session_id | UUID | Sessione | DB | Si | sessions.id CASCADE | Si | - |
| stage_id | UUID | Stato raggiunto | DB/API | Si | session_stages.id RESTRICT | Si | - |
| stage_name | text | Nome stato snapshot | Trigger | Si | - | Si | - |
| changed_at | Tz | Data dichiarata passaggio | DB/API/UI | Si | - | Si | now(); puo essere retrodatata |
| notes | text | Nota avanzamento | UI/API | No | - | No | - |

### 22.7 session_extras

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita riga venduta | DB | Si | PK | Si | gen_random_uuid() |
| session_id | UUID | Sessione parent | UI/BK | Si | sessions.id CASCADE | Si | - |
| service_type_id | UUID | Extra da catalogo servizi | UI | No | service_types.id RESTRICT | Si | -; nullable dal booking addons |
| service_name | text | Nome extra snapshot | API/BK | Si | - | Si | - |
| price_cents | int | Prezzo unitario | UI/BK | Si | - | Si | -; >=0 |
| notes | text | Dettagli extra | UI | No | - | No | - |
| created_at | Tz | Registrazione riga | DB | Si | - | Si | now(); non venduto_at storico |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |
| quantity | int | Quantita | UI/BK/DB | Si | - | Si | 1; >0; API manuale max 999 |
| booking_addon_id | UUID | Add-on catalogo originario | BK | No | booking_addons.id SET NULL | Si | -; puo perdersi modificando evento |

### 22.8 gift_vouchers

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita buono | DB | Si | PK | Si | gen_random_uuid() |
| code | text | Codice buono | UI | Si | UNIQUE | Tecnico | - |
| voucher_type | voucher_type | Tipo service/value | UI | Si | Enum | Si | - |
| purchaser_client_id | UUID | Acquirente | UI | Si | clients.id RESTRICT | Si | - |
| recipient_client_id | UUID | Beneficiario facoltativo | UI | No | clients.id SET NULL | Si | - |
| service_type_id | UUID | Servizio del buono service | UI | No | service_types.id RESTRICT | Si | -; obbligatorio se service, null se value |
| service_name | text | Nome servizio snapshot | API | No | - | Si | -; vincolo forma come sopra |
| value_cents | int | Valore facciale buono value | UI | No | - | Si | -; >0 se value, null se service |
| purchase_price_cents | int | Prezzo acquisto/credito service | UI/API | Si | - | Si | -; >=0 DB, >0 API |
| purchased_at | Tz | Data acquisto dichiarata | UI/DB | Si | - | Si | now(); non necessariamente data pagamento |
| expires_at | Tz | Scadenza | Trigger/UI | Si | - | Si | -; calcolata all'inserimento, poi modificabile |
| status | voucher_status | Stato buono | DB/API | Si | Enum | Si | active; active/redeemed/expired/cancelled |
| redeemed_session_id | UUID | Sessione coperta | Trigger | No | sessions.id UNIQUE RESTRICT | Si | -; non null iff redeemed |
| redeemed_at | Tz | Data riscatto | Trigger | No | - | Si | -; non null iff redeemed |
| notes | text | Note | UI | No | - | No | - |
| created_at | Tz | Registrazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |

### 22.9 payments

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita movimento | DB | Si | PK | Si | gen_random_uuid() |
| session_id | UUID | Sessione coperta | UI/API | No | sessions.id RESTRICT | Si | -; XOR voucher_id |
| voucher_id | UUID | Acquisto buono | UI/API | No | gift_vouchers.id RESTRICT | Si | -; XOR session_id |
| applied_voucher_id | UUID | Buono riscattato, non acquisto | API | No | gift_vouchers.id RESTRICT | Si | -; richiede session_id |
| payment_method_id | UUID | Metodo referenziato | UI/API | Si | payment_methods.id RESTRICT | Si | - |
| payment_method_name | text | Nome metodo snapshot | Trigger INSERT | Si | - | Si | -; non aggiornato col metodo in PATCH |
| category | payment_category | Causale | UI/API | Si | Enum 5 valori | Si | -; vincoli acquisto/sessione |
| amount_cents | int | Importo copertura/cassa | UI/API | Si | - | Si | -; >0; riscatto non e cassa |
| paid_at | Tz | Timestamp pagamento | UI/DB | No | - | Si | now(); almeno una fra data/ora |
| reference | text | Riferimento libero | Storico/DB | No | - | Tecnico | -; letto/ricercato, non popolato dai POST manuali letti |
| notes | text | Nota movimento | UI | No | - | No | - |
| created_at | Tz | Registrazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Ultima modifica | DB | Si | - | Tecnico | now(), trigger |
| paid_date | date | Giorno italiano | UI/Trigger | No | - | Si | -; sincronizzato da trigger corrente |
| voucher_overage_confirmed | bool | Flag regola precedente | Legacy/DB | Si | - | Tecnico | false; non parte della formula finale |
| voucher_unused_cents | int | Credito consumato ma non applicato | API | Si | - | Si | 0; >=0; non pagamento o credito residuo spendibile |

### 22.10 session_packages

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita pacchetto | DB | Si | PK | Si | gen_random_uuid() |
| service_type_id | UUID | Servizio parent | UI | Si | service_types.id RESTRICT | Si | - |
| name | text | Nome pacchetto | UI | Si | Unique con service_type_id | Si | -; 1..120 caratteri |
| included_photos | int | Foto incluse standard | UI | Si | - | Si | 0; >=0 DB, max 1000 API |
| description | text | Contenuto testuale | UI | No | - | No | -; API tronca a 2000 |
| is_active | bool | Selezionabile | UI | Si | - | Si | true |
| sort_order | int | Ordine catalogo | DB | Si | - | No | 0; parser edit non gestisce sortOrder |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |

### 22.11 email_templates

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita modello | DB | Si | PK | Tecnico | gen_random_uuid() |
| code | text | Codice modello | Seed/DB | Si | UNIQUE; link logico emails | Si | -; regex; proofs implementato |
| name | text | Nome modello | Seed/DB | Si | - | No | - |
| subject | text | Oggetto con variabili | UI | Si | - | No | -; 1..200 |
| body_html | text | Corpo modello | UI | Si | - | No | -; sanificato API |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |

### 22.12 session_emails

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita invio registrato | DB | Si | PK | Si | gen_random_uuid() |
| session_id | UUID | Sessione comunicata | EM | Si | sessions.id CASCADE | Si | - |
| template_code | text | Codice template al momento invio | EM | Si | Solo logica, non FK | Si | - |
| to_email | text | Destinatario snapshot | EM | Si | - | No | -; personale |
| subject | text | Oggetto effettivo snapshot | EM | Si | - | No | - |
| body_html | text | Corpo effettivo snapshot | EM | Si | - | No | -; non esportare per default |
| provider_message_id | text | Identificatore Resend | EM | No | Nessuna FK/unique | Tecnico | - |
| sent_at | Tz | Registrazione invio accettato | DB/EM | Si | - | Si | now(); non delivered/opened/clicked |

### 22.13 booking_event_types

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita evento prenotabile | DB | Si | PK | Si | gen_random_uuid() |
| slug | text | Identificatore URL pubblico | UI | Si | UNIQUE | Si | -; regex lettere/numeri/trattini |
| name | text | Nome evento | UI | Si | - | Si | - |
| description | text | Presentazione HTML | UI | No | - | No | -; sanificata |
| service_type_id | UUID | Servizio da creare | UI | Si | service_types.id RESTRICT | Si | - |
| duration_minutes | int | Durata slot | UI | Si | - | Si | -; >0 |
| buffer_minutes | int | Pausa/fascia protezione | UI | Si | - | Si | 30; >=0 |
| location | text | Luogo standard | UI | No | - | Si | - |
| weekday_price_cents | int | Prezzo base feriale | UI | Si | - | Si | 0; >=0 |
| weekend_price_cents | int | Prezzo base sabato/domenica | UI | Si | - | Si | 0; >=0 |
| show_price | bool | Mostra prezzo pubblico | UI | Si | - | Tecnico | true |
| window_start_date | date | Primo giorno appuntamenti | UI | Si | - | Si | - |
| window_end_date | date | Ultimo giorno appuntamenti | UI | Si | - | Si | -; >= inizio |
| min_notice_hours | int | Anticipo minimo | UI | Si | - | Si | 24; >=0 |
| max_bookings_per_day | int | Massimo eventi giornalieri | UI | No | - | Si | -; >0; abilita anche compattazione slot |
| max_bookings_total | int | Massimo complessivo | UI | No | - | Si | -; >0; conteggio attuale include annullate |
| ask_image_consent | bool | Mostra domanda consenso immagini | UI | Si | - | Tecnico | true; non implica accettazione |
| is_active | bool | Pubblicazione abilitata | UI | Si | - | Si | false |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Ultima modifica | DB | Si | - | Tecnico | now(), trigger |
| form_fields | jsonb | Ordine/obblighi/etichette campi | UI | Si | - | Tecnico | M: oggetto default con nome/cognome/email attivi; C salva array; OpenAPI non dettaglia default JSON |
| visibility_start_date | date | Inizio visibilita pagina | UI | Si | - | Si | -; migration backfill da window_start_date |
| visibility_end_date | date | Fine visibilita pagina | UI | Si | - | Si | -; >= inizio; backfill da window_end_date |
| addons_digital_mode | text | Selezione opzioni digitali | UI | Si | - | Si | single; single/multiple |
| addons_print_mode | text | Selezione stampe | UI | Si | - | Si | multiple; single/multiple |
| deposit_cents | int | Caparra standard richiesta | UI | Si | - | Si | 0; >=0; non incasso |

form_fields array: ogni elemento ha key, custom, label, enabled, required. Predefiniti firstName/lastName/email/phone/birthDate/participantsCount/notes; i primi tre bloccati attivi e obbligatori. I custom hanno key custom_*. Non esiste tabella risposte; il backend concatena testo in sessions.notes. Le vecchie configurazioni a oggetto vengono normalizzate in lettura.

### 22.14 booking_availability_rules

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita fascia | DB | Si | PK | Si | gen_random_uuid() |
| event_type_id | UUID | Evento parent | UI | Si | booking_event_types.id CASCADE | Si | - |
| weekday | smallint | Giorno della settimana | UI | Si | Unique composto | Si | -; 0 domenica..6 sabato |
| start_time | time | Inizio fascia locale | UI | Si | Unique composto | Si | -; interpretata Europe/Rome |
| end_time | time | Fine fascia locale | UI | Si | Unique composto | Si | -; >start_time |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |

### 22.15 booking_availability_exceptions

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita eccezione | DB | Si | PK | Si | gen_random_uuid() |
| event_type_id | UUID | Evento parent | UI | Si | booking_event_types.id CASCADE | Si | - |
| exception_date | date | Giorno sostituito/chiuso | UI | Si | Unique parziale chiusura | Si | - |
| is_closed | bool | Chiusura intera giornata | UI | Si | - | Si | false |
| start_time | time | Inizio alternativo | UI | No | - | Si | -; richiesto quando aperta |
| end_time | time | Fine alternativa | UI | No | - | Si | -; >inizio quando aperta |
| note | text | Motivo libero | UI | No | - | No | - |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |

### 22.16 booking_addons

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita add-on catalogo | DB | Si | PK | Si | gen_random_uuid(); puo essere rigenerato su edit evento |
| event_type_id | UUID | Evento parent | UI | Si | booking_event_types.id CASCADE | Si | - |
| category | text | Categoria checkout | UI | Si | - | Si | -; digital/print |
| name | text | Nome opzione | UI | Si | - | Si | -; snapshot sulle extras |
| price_cents | int | Prezzo unitario catalogo | UI | Si | - | Si | -; >=0 |
| max_quantity | int | Quantita massima acquistabile | UI | No | - | Si | -; >0 se presente |
| is_active | bool | Selezionabile | UI | Si | - | Si | true |
| sort_order | int | Ordine presentazione | UI/API | Si | - | No | 0 |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |
| tooltip | text | Spiegazione opzione | UI | No | - | No | - |

### 22.17 calendly_event_type_map

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita mapping | DB | Si | PK | Tecnico | gen_random_uuid() |
| calendly_event_type_uri | text | Tipo evento remoto | CAL/UI | Si | UNIQUE | Tecnico | - |
| calendly_event_type_name | text | Nome remoto salvato | CAL/UI | Si | - | Si | - |
| service_type_id | UUID | Servizio CRM destinazione | UI | Si | service_types.id RESTRICT | Si | - |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |
| weekday_price_cents | int | Prezzo import feriale | UI | Si | - | Si | 0; >=0; rinominato da agreed_price_cents |
| weekend_price_cents | int | Prezzo import weekend | UI | Si | - | Si | 0; >=0 |

### 22.18 app_settings

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | bool | Singleton applicazione | DB | Si | PK con CHECK(id) | Tecnico | true |
| currency_code | char(3) | Valuta | DB | Si | - | Si | EUR; UI prevalentemente hardcoded EUR |
| voucher_validity_months | int | Mesi scadenza nuovi buoni | UI | Si | - | Si | 12; da 1 a 120 |
| created_at | Tz | Creazione | DB | Si | - | Tecnico | now() |
| updated_at | Tz | Modifica | DB | Si | - | Tecnico | now(), trigger |
| annual_budget_cents | int | Obiettivo incassi | UI | Si | - | Si | 0; >=0; non per anno |
| mailerlite_transactional_group_id | text | Gruppo transazionale | UI/ML | No | Remota, non FK | Tecnico | - |
| mailerlite_marketing_group_id | text | Gruppo marketing | UI/ML | No | Remota, non FK | Tecnico | - |
| mailerlite_last_sync_at | Tz | Ultima esecuzione sync | ML | No | - | Tecnico | -; non prova successo di tutti i contatti |
| calendly_last_sync_at | Tz | Ultima importazione tentata | CAL | No | - | Tecnico | -; non usata come cursore storico esaustivo |

### 22.19 audit_log

| Campo | Tipo | Descrizione | Origine | Obbligatorio | Relazione | Analytics? | Default / note |
|---|---|---|---|---|---|---|---|
| id | UUID | Identita evento log | DB | Si | PK | Tecnico | gen_random_uuid() |
| table_name | text | Tabella modificata | Trigger | Si | Logica, non FK | Tecnico | - |
| record_id | UUID | Record modificato | Trigger | Si | Logica, non FK | Tecnico | -; conserva riferimento dopo delete |
| action | text | Operazione | Trigger | Si | - | Tecnico | -; insert/update/delete |
| changed_fields | jsonb | Mappa campo -> from/to | Trigger | No | - | Tecnico | -; su update significativo |
| old_data | jsonb | Snapshot precedente | Trigger | No | - | Tecnico | -; dati personali possibili |
| new_data | jsonb | Snapshot successivo | Trigger | No | - | Tecnico | -; dati personali possibili |
| created_at | Tz | Istante log | DB | Si | - | Tecnico | now(); nessun actor/user_id |

### 22.20 Campi derivati, legacy e assenze

ltv_cents e balance_cents del cliente; totals/payments statuses; extras total; prezzo totale evento; foto effettive; gruppi marketing/transazionale; palla a te/cliente sono derivati nel codice, **non colonne delle tabelle**. Slot disponibili sono calcolati, non salvati in booking_slots. Non esistono tabelle leads, campaigns, tags, quotes, invoices, costs, time_entries, consent_events o booking_requests nello schema live esposto.

Legacy: consenso immagini cliente eliminato; prezzo unico mapping Calendly rinominato; stati pagamento inattivi mantenuti; voucher_overage_confirmed residuo; is_settled non contabile; reference disponibile ma sottoutilizzato; suggested_price_cents non usato dai flussi correnti analizzati; form_fields accetta due forme. Duplicazione intenzionale: nomi snapshot non vanno sostituiti indiscriminatamente con nomi correnti. Duplicazione problematica: extra come sessions e come session_extras, pacchetti testuali in note vs catalogo, stato saldato persistito vs formula attuale.

## 23. Anomalie / dubbi / dati da verificare

| Priorita | Evidenza e conseguenza | Stato della verifica / fonte |
|---|---|---|
| Alta | Privacy obbligatoria booking usata come marketing nel sync; add-to-group non controlla consenso | C: route pubblica book, mailerlite/sync, add-to-group. Verificare informativa/finalita, non presumere consenso valido |
| Alta | RLS non abilitata per audit_log nelle migrazioni | M: add_audit_log. Grant/policy live non interrogati; query B1. Potenziale esposizione da verificare, non incidente dimostrato |
| Alta | Trigger voucher finale somma price_cents senza quantity; API usa price*quantity | M21 settembre vs M29 settembre e API redeem. Rischio rifiuto/correttezza con quantita>1; live quantita tutte 1, funzione live non ispezionata |
| Alta | Booking ignora errori insert extras e update cliente; conferma possibile senza tutti i dati | C: book. Nessun incidente dimostrato, flusso non atomico |
| Alta | Overlap e limite prenotazioni non protetti da transazione/vincolo esclusione concorrente nel codice letto | C/M. Non eseguito test concorrenza per rispettare sola lettura |
| Alta | LTV UI mescola valori servizi e buoni, future/annullate | C: clients GET. Non usarlo per redditivita/cassa o CAC |
| Media | Calendario dashboard ignora extra e gratuite nel calcolo stato | C: dashboard route. Altre sezioni hanno formula diversa |
| Media | Cambio metodo payment non aggiorna snapshot nome, e analytics filtra per nome | C/M. Zero mismatch attuali, rischio futuro verificato staticamente |
| Media | Riduzione prezzo o delete extra puo lasciare pagamenti eccedenti | C: sessions PATCH/extras DELETE; trigger solo payments. Zero casi live |
| Media | is_settled true su base zero anche con extra; non torna false aumentando prezzo | M auto_settle. Non usare come fonte saldo |
| Media | Import assegna ore artificiali/durata60 e non ID esterno vincolato | C import. Distorsione tempi/capacita; rischio duplicati, non provati |
| Media | Modifica booking ricrea add-on, perde FK storiche tramite SET NULL | C replaceAddons/M FK. Dati snapshot economici restano, segmentazione catalogo puo rompersi |
| Media | Max totale evento conta annullate; max giornaliero esclude | C booking-server. Nel live nessun max totale configurato |
| Media | Log email/cambio stato dopo invio non controllano errori; reinvio puo regredire pipeline | C emails route. Zero invii live, rischio non osservato |
| Media | Pacchetti non versionati, descrizione/foto fallback cambiano retroattivamente; PATCH package puo cambiarne servizio | C packages PATCH/updateDelivery. Coerenza servizio controllata solo quando si associa sessione |
| Media | Date analytics/server e Calendly non sempre Europe/Rome | C analytics e calendly/sync vs datetime. Le date payments lette sono allineate, ma confini query restano sensibili al fuso |
| Media | KPI ritardo azzerato dalla promozione lazy; completed alla partenza, non conclusione | C sessions-server/dashboard. Non misura consegne in ritardo |
| Media | Liste/export senza range esaustivo in alcune API: eventuale limite PostgREST | C clients, sessions, dashboard, export payments. Campione attuale piccolo; audit ha usato paginazione propria |
| Media | Filtro giorno dopo paginazione lista; stati custom non presenti nella board hardcoded | C session-directory. Live ha Guida Inviata attivo oltre ai 6 standard, nessuna sessione in quel codice |
| Media | Acquisto buono 2025 vs pagamento 2026 in un caso | L: differenza EUR160 fra tabelle annuali. Verificare se differimento reale o data corretta solo su una tabella |
| Media | UI registro permette DELETE, non un rimborso contabile | C payments. Necessaria separazione rettifica/rimborso |
| Media | Riscatto buono non verifica pagamento acquisto completo nel trigger finale | M. Creazione normale lo incassa, ma successive rettifiche possono alterarlo |
| Media | Login condiviso senza rate limit esplicito nel handler | C login. Nessuna prova di protezioni esterne; audit non attribuisce operatore |
| Bassa | Prossima sessione ordinamento clienti non esclude annullate | C clients GET. Nessuna annullata live, impatto potenziale |
| Bassa | Match pubblico email ILIKE tratta wildcard e non verifica possesso email | C book. Protezione/dedup da irrobustire, nessun abuso dimostrato |
| Da verificare | Ambiente locale e deploy pubblico potrebbero divergere | Nessuna certificazione del deploy o degli Excel successivi disponibili |

### Correzioni rispetto al dossier precedente

- 40 sessioni del CSV non sono il live: letti oggi 42; clienti totali 233, non il numero di clienti del vecchio export.
- EUR 560 di "caparre raccolte" del vecchio dossier non e dimostrabile dallo snapshot deposit_cents. I pagamenti reali vanno letti in payments.
- Consenso immagini non esiste piu sulla tabella clients; consenso marketing separato non esiste affatto.
- Nessun prezzo pacchetto strutturato; nessun pacchetto popolato nel live letto. Email implementate non significa email effettivamente inviate.
- Export supporta sia CSV sia XLSX, ma gli export UI non contengono chiavi relazionali complete.
- ManyChat/Meta/UTM sono piani o strumenti esterni, non integrazioni verificate.
- Il ritorno grezzo di 4 clienti si riduce a 1 se si escludono le sessioni Provini Extra: upsell non e necessariamente riacquisto shooting.
- Stato buono a servizio finale non impone stesso servizio: credito economico applicato al residuo, con inutilizzato.

La checklist finale incrocia schema M/L, selezioni API, UI montata, formule di query e aggregati L. Dove manca prova del trigger live, delle policy, delle ricevute o dei dati esterni, l'incertezza rimane esplicita e non viene colmata con supposizioni.

**Esito del controllo documentale finale:** 19 tabelle e 217 colonne confrontate automaticamente con OpenAPI live, senza omissioni o differenze di nullabilita nel dizionario; 23 sezioni, 35 KPI classificati A/B/C/D, 65 link locali validi; 15 blocchi SQL con 31 istruzioni SELECT/CTE di sola lettura controllate staticamente. Appendice C circa 1.200 parole, sotto il limite di 3.000. Nessuna esecuzione SQL diretta: per catalogo/trigger e piano query rimane necessaria la verifica indicata in B1. Il solo file nuovo del repository e questo dossier.

# APPENDICE A - File analizzati

Elenco delle fonti principali effettivamente consultate. "Inventario" indica ricerca strutturale, non lettura integrale di ogni riga; "lettura mirata" indica le porzioni pertinenti. Nessun file di credenziali e stato riportato nel documento.

| File/cartella | Evidenza usata |
|---|---|
| [package.json](package.json) | Versioni e script |
| [AGENTS.md](AGENTS.md) e [CLAUDE.md](CLAUDE.md) | Istruzioni repository fornite nel contesto |
| [README.md](README.md) | Boilerplate, non descrizione funzionale affidabile |
| [proxy.ts](proxy.ts) e [lib/auth.ts](lib/auth.ts) | Confine autenticazione, cookie e firma |
| [app/api/login/route.ts](app/api/login/route.ts) | Login reale e attributi cookie |
| [lib/supabase/admin.ts](lib/supabase/admin.ts) | Accesso server privilegiato |
| [lib/supabase/client.ts](lib/supabase/client.ts) | Ricerca riferimenti client e configurazione, non query operative |
| [app](app) | Inventario di tutte le pagine montate e 46 route handler |
| [supabase/migrations](supabase/migrations) | Inventario strutturale di tutti i 28 SQL: tabelle/ALTER/indici/trigger |
| [20260827000000_initial_crm_schema.sql](supabase/migrations/20260827000000_initial_crm_schema.sql) | Schema base completo, enum, trigger e RLS |
| [20260827000100_extend_clients.sql](supabase/migrations/20260827000100_extend_clients.sql) | Email, consensi e anagrafica |
| [20260827000200_extend_sessions.sql](supabase/migrations/20260827000200_extend_sessions.sql) | Durata, overlap, Altro e history |
| [20260827000300_extend_payments.sql](supabase/migrations/20260827000300_extend_payments.sql) | Categoria riscatto, riattivazione buono |
| [20260828000300_add_audit_log.sql](supabase/migrations/20260828000300_add_audit_log.sql) | Snapshot audit e assenza RLS nella migration |
| [20260831000000_add_session_extras.sql](supabase/migrations/20260831000000_add_session_extras.sql) | Extra e prima estensione totale |
| [20260831000200_optional_payment_timestamp.sql](supabase/migrations/20260831000200_optional_payment_timestamp.sql) | Data/ora pagamenti |
| [20260831000300_auto_settle_zero_price_sessions.sql](supabase/migrations/20260831000300_auto_settle_zero_price_sessions.sql) | Flag gratuita |
| [20260905000000_add_calendly_sync.sql](supabase/migrations/20260905000000_add_calendly_sync.sql) e [20260905020000_split_calendly_mapping_price.sql](supabase/migrations/20260905020000_split_calendly_mapping_price.sql) | Mapping Calendly finale |
| [20260911000000_add_booking_engine.sql](supabase/migrations/20260911000000_add_booking_engine.sql) | Eventi, fasce, eccezioni |
| [20260914000000_add_booking_form_configuration.sql](supabase/migrations/20260914000000_add_booking_form_configuration.sql) | Form JSON e partecipanti |
| [20260921000000_apply_vouchers_to_remaining_balance.sql](supabase/migrations/20260921000000_apply_vouchers_to_remaining_balance.sql) | Ultimo trigger riscatto e inutilizzato |
| [20260922000000_add_booking_visibility_window.sql](supabase/migrations/20260922000000_add_booking_visibility_window.sql) | Finestra pubblicazione |
| [20260925000000_remove_payment_received_stage.sql](supabase/migrations/20260925000000_remove_payment_received_stage.sql) | Stati pagamento disattivati |
| [20260929000000_add_booking_addons.sql](supabase/migrations/20260929000000_add_booking_addons.sql) | Quantita extra e caparra richiesta |
| [20261008000000_add_packages_and_transactional_emails.sql](supabase/migrations/20261008000000_add_packages_and_transactional_emails.sql) | Pacchetti, gallery, template e invii |
| [20261010000000_sync_payment_dates.sql](supabase/migrations/20261010000000_sync_payment_dates.sql) | Trigger date e validazione finale importo, anche selezione fornita dall'utente |
| [app/api/clients](app/api/clients) | Elenco/LTV, dettaglio, overview, import letti |
| [app/api/sessions](app/api/sessions) | Elenco, dettaglio, options, import, extra, riscatto ed email letti; inventario altri handler |
| [app/api/payments/route.ts](app/api/payments/route.ts) e [app/api/payments/[id]/route.ts](app/api/payments/[id]/route.ts) | Formule/filtri e modifica/eliminazione |
| [app/api/vouchers/route.ts](app/api/vouchers/route.ts) e [app/api/vouchers/[id]/route.ts](app/api/vouchers/[id]/route.ts) | Emissione e modifica |
| [app/api/dashboard/route.ts](app/api/dashboard/route.ts) e [app/api/dashboard/analytics/route.ts](app/api/dashboard/analytics/route.ts) | Tutte le formule KPI principali |
| [app/api/public/booking/[slug]/book/route.ts](app/api/public/booking/[slug]/book/route.ts) | Flusso prenotazione completo |
| [app/api/booking/event-types/[id]/route.ts](app/api/booking/event-types/[id]/route.ts) | Sostituzione disponibilita/add-on |
| [lib/booking.ts](lib/booking.ts) e [lib/booking-server.ts](lib/booking-server.ts) | Slot, limiti, form, tariffe, salvataggi |
| [lib/sessions.ts](lib/sessions.ts), [lib/sessions-server.ts](lib/sessions-server.ts), [lib/vouchers.ts](lib/vouchers.ts) | Economia e riconciliazioni lazy |
| [lib/packages.ts](lib/packages.ts) e [app/api/packages/[id]/route.ts](app/api/packages/[id]/route.ts) | Validazioni/modifiche pacchetto |
| [lib/email.ts](lib/email.ts) | Resend, rendering, variabili, sanificazione |
| [lib/mailerlite.ts](lib/mailerlite.ts), [app/api/mailerlite/sync/route.ts](app/api/mailerlite/sync/route.ts), [app/api/mailerlite/add-to-group/route.ts](app/api/mailerlite/add-to-group/route.ts) | Sync e consensi |
| [app/api/calendly/sync/route.ts](app/api/calendly/sync/route.ts) | Import, finestra e deduplica |
| [lib/icloud-calendar.ts](lib/icloud-calendar.ts) | CalDAV outbound best-effort |
| [app/api/config](app/api/config) e [lib/config.ts](lib/config.ts) | Operazioni catalogo e campi realmente esposti |
| [app/api/search/route.ts](app/api/search/route.ts) e [app/api/audit-log/route.ts](app/api/audit-log/route.ts) | Ricerca e visibilita log |
| [components/clients/client-directory.tsx](components/clients/client-directory.tsx) | Ricerca/ordinamento/export, lettura mirata |
| [components/sessions/session-directory.tsx](components/sessions/session-directory.tsx) | Board, filtri/paginazione/export, lettura mirata |
| [components/payments/payment-directory.tsx](components/payments/payment-directory.tsx) | Filtri e colonne export, lettura mirata |
| [components/shared/export-button.tsx](components/shared/export-button.tsx) | CSV e XLSX reali |
| [components](components) | Ricerche trasversali su importatori, profili, dashboard, config e voucher UI |
| [docs/dossier-giulia-malosso-photography.md](docs/dossier-giulia-malosso-photography.md) | Confronto con dossier precedente e fonte storica dichiarata |
| [docs/Sessioni GMPH 04.10.2026.csv](docs/Sessioni%20GMPH%2004.10.2026.csv) | Export storico individuato, non fonte dei numeri live di questo audit |
| [sito-wordpress/giulia-malosso-photography/template-contatti.php](sito-wordpress/giulia-malosso-photography/template-contatti.php) | Form mailto, nessun lead CRM |
| [sito-wordpress](sito-wordpress) | Ricerca riferimenti tracking/integratori; non audit completo del sito installato |

Fonte esterna al filesystem: OpenAPI PostgREST del database configurato, metadati di 19 tabelle; SELECT REST paginate delle entita statistiche e conteggi esatti app_settings/audit_log. Consultate anche note operative di repository come orientamento, ma le affermazioni del dossier sono basate su C/M/L e non considerate vere solo perche presenti nelle note.

# APPENDICE B - Query di verifica

**Solo SELECT** PostgreSQL, nessuna funzione applicativa con effetti collaterali. Non creare viste/tabelle e non lanciare le migrazioni per eseguire queste query. Le query SQL sotto sono fornite per riproducibilita: non sono state eseguite come SQL in questa sessione, che disponeva di lettura PostgREST e non di console SQL PostgreSQL. I conteggi/formule principali sono stati verificati con SELECT REST paginate e aggregazione in memoria. Eseguire B1 per accertare schema/trigger effettivi, poi le altre; verificare il progetto corretto. Ogni blocco e indipendente. Importi convertiti in EUR solo alla fine; timezone sempre esplicita.

## B1. Schema, vincoli, indici, trigger, RLS e privilegi

```sql
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

SELECT relation.relname AS table_name, constraint_row.conname,
       constraint_row.contype,
       pg_get_constraintdef(constraint_row.oid) AS definition
FROM pg_constraint AS constraint_row
JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
WHERE schema_row.nspname = 'public'
ORDER BY relation.relname, constraint_row.conname;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

SELECT relation.relname AS table_name, trigger_row.tgname,
       pg_get_triggerdef(trigger_row.oid) AS definition
FROM pg_trigger AS trigger_row
JOIN pg_class AS relation ON relation.oid = trigger_row.tgrelid
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
WHERE schema_row.nspname = 'public' AND NOT trigger_row.tgisinternal
ORDER BY relation.relname, trigger_row.tgname;

SELECT function_row.proname, pg_get_functiondef(function_row.oid) AS definition
FROM pg_proc AS function_row
JOIN pg_namespace AS schema_row ON schema_row.oid = function_row.pronamespace
WHERE schema_row.nspname = 'public'
  AND function_row.proname IN (
    'validate_payment_amount', 'validate_voucher_redemption',
    'sync_payment_dates', 'validate_session_schedule',
    'record_session_stage_change', 'auto_settle_zero_price_sessions',
    'snapshot_payment_method', 'set_voucher_expiry', 'record_audit_log'
  )
ORDER BY function_row.proname;

SELECT relation.relname, relation.relrowsecurity, relation.relforcerowsecurity
FROM pg_class AS relation
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
WHERE schema_row.nspname = 'public' AND relation.relkind = 'r'
ORDER BY relation.relname;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT type_row.typname, enum_row.enumlabel, enum_row.enumsortorder
FROM pg_type AS type_row
JOIN pg_enum AS enum_row ON enum_row.enumtypid = type_row.oid
JOIN pg_namespace AS schema_row ON schema_row.oid = type_row.typnamespace
WHERE schema_row.nspname = 'public'
ORDER BY type_row.typname, enum_row.enumsortorder;
```

## B2. Incassi monetari annuali e mensili

Non e fatturato fiscale. Include acquisti buoni, esclude riscatti; non elimina denaro incassato su sessioni poi annullate.

```sql
WITH cash AS (
  SELECT payment.amount_cents, payment.session_id, payment.voucher_id,
         COALESCE(payment.paid_date,
           (payment.paid_at AT TIME ZONE 'Europe/Rome')::date) AS economic_date
  FROM public.payments AS payment
  JOIN public.payment_methods AS method ON method.id = payment.payment_method_id
  WHERE payment.applied_voucher_id IS NULL
    AND payment.category <> 'voucher_redemption'
    AND method.code <> 'gift_voucher'
)
SELECT EXTRACT(YEAR FROM economic_date)::int AS year,
       COUNT(*) AS movements,
       SUM(amount_cents)::numeric / 100 AS cash_eur,
       COALESCE(SUM(amount_cents) FILTER (WHERE session_id IS NOT NULL), 0)::numeric / 100 AS session_cash_eur,
       COALESCE(SUM(amount_cents) FILTER (WHERE voucher_id IS NOT NULL), 0)::numeric / 100 AS voucher_cash_eur
FROM cash GROUP BY 1 ORDER BY 1;

WITH cash AS (
  SELECT payment.amount_cents,
         COALESCE(payment.paid_date,
           (payment.paid_at AT TIME ZONE 'Europe/Rome')::date) AS economic_date
  FROM public.payments AS payment
  JOIN public.payment_methods AS method ON method.id = payment.payment_method_id
  WHERE payment.applied_voucher_id IS NULL
    AND payment.category <> 'voucher_redemption' AND method.code <> 'gift_voucher'
)
SELECT date_trunc('month', economic_date)::date AS month,
       COUNT(*) AS movements, SUM(amount_cents)::numeric / 100 AS cash_eur
FROM cash GROUP BY 1 ORDER BY 1;
```

## B3. Valore, extra, copertura e saldi per mese sessione

Le due CTE impediscono moltiplicazione di righe extra x pagamenti. Per l'annuale sostituire month con year; per il servizio raggruppare service_type_id/service_name invece della data.

```sql
WITH extras AS (
  SELECT session_id, SUM(price_cents::bigint * quantity) AS cents
  FROM public.session_extras GROUP BY session_id
), paid AS (
  SELECT session_id, SUM(amount_cents::bigint) AS cents
  FROM public.payments WHERE session_id IS NOT NULL GROUP BY session_id
), valued AS (
  SELECT session.id, session.scheduled_at, session.agreed_price_cents,
         COALESCE(extras.cents, 0) AS extra_cents,
         session.agreed_price_cents + COALESCE(extras.cents, 0) AS due_cents,
         COALESCE(paid.cents, 0) AS covered_cents
  FROM public.sessions AS session
  JOIN public.session_stages AS stage ON stage.id = session.current_stage_id
  LEFT JOIN extras ON extras.session_id = session.id
  LEFT JOIN paid ON paid.session_id = session.id
  WHERE stage.code <> 'cancelled'
)
SELECT date_trunc('month', scheduled_at AT TIME ZONE 'Europe/Rome')::date AS month,
       COUNT(*) AS sessions,
       SUM(agreed_price_cents)::numeric / 100 AS base_eur,
       SUM(extra_cents)::numeric / 100 AS extras_eur,
       SUM(due_cents)::numeric / 100 AS commercial_value_eur,
       SUM(covered_cents)::numeric / 100 AS covered_eur,
       SUM(GREATEST(due_cents - covered_cents, 0))::numeric / 100 AS balance_eur,
       AVG(due_cents)::numeric / 100 AS mean_value_eur
FROM valued GROUP BY 1 ORDER BY 1;
```

## B4. Sessioni per servizio, gratuite, annullate e future

```sql
WITH extras AS (
  SELECT session_id, SUM(price_cents::bigint * quantity) AS cents
  FROM public.session_extras GROUP BY session_id
)
SELECT session.service_type_id, session.service_name,
       EXTRACT(YEAR FROM session.scheduled_at AT TIME ZONE 'Europe/Rome')::int AS year,
       COUNT(*) AS all_rows,
       COUNT(*) FILTER (WHERE stage.code = 'cancelled') AS cancelled,
       COUNT(*) FILTER (WHERE stage.code <> 'cancelled') AS active,
       COUNT(*) FILTER (WHERE stage.code <> 'cancelled'
         AND session.scheduled_at >= TIMESTAMPTZ '2026-10-12 00:00:00 Europe/Rome') AS today_and_future,
       COUNT(*) FILTER (WHERE stage.code <> 'cancelled'
         AND session.scheduled_at < TIMESTAMPTZ '2026-10-12 00:00:00 Europe/Rome') AS past,
       COUNT(*) FILTER (WHERE stage.code <> 'cancelled'
         AND session.agreed_price_cents + COALESCE(extras.cents,0) = 0) AS free_total,
       COALESCE(SUM(session.agreed_price_cents + COALESCE(extras.cents,0))
         FILTER (WHERE stage.code <> 'cancelled'),0)::numeric / 100 AS value_eur
FROM public.sessions AS session
JOIN public.session_stages AS stage ON stage.id = session.current_stage_id
LEFT JOIN extras ON extras.session_id = session.id
GROUP BY 1,2,3 ORDER BY 3,2;
```

## B5. Distribuzione clienti e ricorrenza osservata

Il primo blocco include future e righe legacy, per replicare la distribuzione grezza 195/34/4. Il secondo le filtra per un'analisi di ritorno piu restrittiva. Il cutoff e esplicito e modificabile.

```sql
WITH session_counts AS (
  SELECT session.client_id, COUNT(*) AS session_count
  FROM public.sessions AS session
  JOIN public.session_stages AS stage ON stage.id = session.current_stage_id
  WHERE stage.code <> 'cancelled'
  GROUP BY session.client_id
)
SELECT COALESCE(session_counts.session_count,0) AS session_count, COUNT(*) AS clients
FROM public.clients AS client
LEFT JOIN session_counts ON session_counts.client_id = client.id
GROUP BY 1 ORDER BY 1;

WITH shooting AS (
  SELECT session.client_id, session.scheduled_at,
         LAG(session.scheduled_at) OVER (
           PARTITION BY session.client_id ORDER BY session.scheduled_at, session.id
         ) AS previous_at
  FROM public.sessions AS session
  JOIN public.session_stages AS stage ON stage.id = session.current_stage_id
  WHERE stage.code <> 'cancelled'
    AND session.service_name <> 'Provini Extra'
    AND session.scheduled_at < TIMESTAMPTZ '2026-10-12 00:00:00 Europe/Rome'
)
SELECT COUNT(DISTINCT client_id) AS observed_clients,
       COUNT(DISTINCT client_id) FILTER (WHERE previous_at IS NOT NULL) AS repeat_clients,
       AVG(EXTRACT(EPOCH FROM scheduled_at - previous_at) / 86400)
         FILTER (WHERE previous_at IS NOT NULL) AS mean_days_between_shootings
FROM shooting;
```

## B6. Nuovi e ricorrenti per anno osservato

Nuovo significa prima sessione nell'archivio, non prima sessione assoluta dell'attivita. Si includono qui future per coerenza con tabella live, esplicitamente; aggiungere cutoff per consuntivo.

```sql
WITH observed AS (
  SELECT session.client_id,
         EXTRACT(YEAR FROM session.scheduled_at AT TIME ZONE 'Europe/Rome')::int AS year
  FROM public.sessions AS session
  JOIN public.session_stages AS stage ON stage.id = session.current_stage_id
  WHERE stage.code <> 'cancelled'
), first_year AS (
  SELECT client_id, MIN(year) AS first_year FROM observed GROUP BY client_id
)
SELECT observed.year, COUNT(DISTINCT observed.client_id) AS clients,
       COUNT(DISTINCT observed.client_id) FILTER (
         WHERE first_year.first_year = observed.year) AS new_in_observed_history,
       COUNT(DISTINCT observed.client_id) FILTER (
         WHERE first_year.first_year < observed.year) AS returning_from_prior_year
FROM observed JOIN first_year USING (client_id)
GROUP BY observed.year ORDER BY observed.year;
```

## B7. Spesa monetaria osservata per cliente, senza nominativi

Non dimostra chi abbia materialmente pagato una sessione: attribuisce il movimento al suo cliente. Non aggiunge il riscatto al denaro dell'acquirente buono.

```sql
WITH attributed_cash AS (
  SELECT COALESCE(session.client_id, voucher.purchaser_client_id) AS client_id,
         payment.amount_cents
  FROM public.payments AS payment
  JOIN public.payment_methods AS method ON method.id = payment.payment_method_id
  LEFT JOIN public.sessions AS session ON session.id = payment.session_id
  LEFT JOIN public.gift_vouchers AS voucher ON voucher.id = payment.voucher_id
  WHERE payment.applied_voucher_id IS NULL
    AND payment.category <> 'voucher_redemption' AND method.code <> 'gift_voucher'
), total_cash AS (
  SELECT client_id, SUM(amount_cents::bigint) AS cents
  FROM attributed_cash GROUP BY client_id
)
SELECT client.id AS client_id, COALESCE(total_cash.cents,0)::numeric / 100 AS observed_cash_ltv_eur
FROM public.clients AS client
LEFT JOIN total_cash ON total_cash.client_id = client.id
ORDER BY observed_cash_ltv_eur DESC, client.id;
```

## B8. Extra normalizzati e legacy, separati

```sql
SELECT EXTRACT(YEAR FROM extra.created_at AT TIME ZONE 'Europe/Rome')::int AS recorded_year,
       EXTRACT(YEAR FROM session.scheduled_at AT TIME ZONE 'Europe/Rome')::int AS session_year,
       extra.service_name, COUNT(*) AS lines, SUM(extra.quantity) AS units,
       SUM(extra.price_cents::bigint * extra.quantity)::numeric / 100 AS extra_value_eur
FROM public.session_extras AS extra
JOIN public.sessions AS session ON session.id = extra.session_id
JOIN public.session_stages AS stage ON stage.id = session.current_stage_id
WHERE stage.code <> 'cancelled'
GROUP BY 1,2,3 ORDER BY 2,1,3;

SELECT EXTRACT(YEAR FROM session.scheduled_at AT TIME ZONE 'Europe/Rome')::int AS year,
       COUNT(*) AS legacy_extra_session_rows,
       SUM(session.agreed_price_cents)::numeric / 100 AS already_in_session_base_eur
FROM public.sessions AS session
JOIN public.session_stages AS stage ON stage.id = session.current_stage_id
WHERE session.service_name = 'Provini Extra' AND stage.code <> 'cancelled'
GROUP BY 1 ORDER BY 1;
```

## B9. Copertura pacchetti e valore commerciale

```sql
WITH extras AS (
  SELECT session_id, SUM(price_cents::bigint * quantity) AS cents
  FROM public.session_extras GROUP BY session_id
)
SELECT session.package_id, package.name AS package_name,
       COUNT(*) AS sessions,
       SUM(session.agreed_price_cents + COALESCE(extras.cents,0))::numeric / 100 AS value_eur,
       COUNT(*) FILTER (WHERE session.included_photos IS NOT NULL) AS explicit_photo_overrides
FROM public.sessions AS session
JOIN public.session_stages AS stage ON stage.id = session.current_stage_id
LEFT JOIN public.session_packages AS package ON package.id = session.package_id
LEFT JOIN extras ON extras.session_id = session.id
WHERE stage.code <> 'cancelled'
GROUP BY session.package_id, package.name ORDER BY package.name NULLS LAST;
```

## B10. Buoni: emissione, acquisto, credito e riscatti

```sql
WITH purchases AS (
  SELECT voucher_id, SUM(amount_cents::bigint) AS cents
  FROM public.payments WHERE voucher_id IS NOT NULL GROUP BY voucher_id
), redemptions AS (
  SELECT applied_voucher_id, SUM(amount_cents::bigint) AS cents,
         SUM(voucher_unused_cents::bigint) AS unused_cents
  FROM public.payments WHERE applied_voucher_id IS NOT NULL GROUP BY applied_voucher_id
)
SELECT EXTRACT(YEAR FROM voucher.purchased_at AT TIME ZONE 'Europe/Rome')::int AS purchase_year,
       voucher.voucher_type, voucher.status, COUNT(*) AS vouchers,
       SUM(voucher.purchase_price_cents)::numeric / 100 AS purchase_value_eur,
       SUM(COALESCE(voucher.value_cents,voucher.purchase_price_cents))::numeric / 100 AS face_credit_eur,
       SUM(COALESCE(purchases.cents,0))::numeric / 100 AS paid_for_these_vouchers_eur,
       SUM(COALESCE(redemptions.cents,0))::numeric / 100 AS applied_eur,
       SUM(COALESCE(redemptions.unused_cents,0))::numeric / 100 AS unused_eur
FROM public.gift_vouchers AS voucher
LEFT JOIN purchases ON purchases.voucher_id = voucher.id
LEFT JOIN redemptions ON redemptions.applied_voucher_id = voucher.id
GROUP BY 1,2,3 ORDER BY 1,2,3;

SELECT COUNT(*) AS payments_with_different_purchase_year,
       SUM(payment.amount_cents)::numeric / 100 AS amount_eur
FROM public.payments AS payment
JOIN public.gift_vouchers AS voucher ON voucher.id = payment.voucher_id
WHERE EXTRACT(YEAR FROM voucher.purchased_at AT TIME ZONE 'Europe/Rome')
   <> EXTRACT(YEAR FROM COALESCE(payment.paid_date,
       (payment.paid_at AT TIME ZONE 'Europe/Rome')::date));
```

## B11. Registro per categoria/metodo e coerenza delle date

```sql
SELECT payment.category, method.code, payment.payment_method_name,
       COUNT(*) AS movements, SUM(payment.amount_cents)::numeric / 100 AS amount_eur
FROM public.payments AS payment
JOIN public.payment_methods AS method ON method.id = payment.payment_method_id
GROUP BY 1,2,3 ORDER BY 1,2,3;

SELECT COUNT(*) FILTER (WHERE payment.paid_at IS NULL) AS missing_timestamp,
       COUNT(*) FILTER (WHERE payment.paid_date IS NULL) AS missing_date,
       COUNT(*) FILTER (WHERE payment.paid_at IS NOT NULL
         AND payment.paid_date IS DISTINCT FROM
           (payment.paid_at AT TIME ZONE 'Europe/Rome')::date) AS date_mismatch,
       COUNT(*) FILTER (WHERE payment.payment_method_name IS DISTINCT FROM method.name) AS method_snapshot_mismatch,
       COUNT(*) FILTER (WHERE
         (payment.applied_voucher_id IS NOT NULL) <> (payment.category = 'voucher_redemption')
         OR (payment.applied_voucher_id IS NOT NULL) <> (method.code = 'gift_voucher')
       ) AS voucher_classification_mismatch
FROM public.payments AS payment
JOIN public.payment_methods AS method ON method.id = payment.payment_method_id;
```

## B12. Saldi aperti, gratuite, eccedenze e futuri

```sql
WITH extras AS (
  SELECT session_id, SUM(price_cents::bigint * quantity) AS cents
  FROM public.session_extras GROUP BY session_id
), paid AS (
  SELECT session_id, SUM(amount_cents::bigint) AS cents
  FROM public.payments WHERE session_id IS NOT NULL GROUP BY session_id
), valued AS (
  SELECT session.id, session.is_settled, session.scheduled_at,
         session.agreed_price_cents + COALESCE(extras.cents,0) AS due,
         COALESCE(paid.cents,0) AS covered
  FROM public.sessions AS session
  JOIN public.session_stages AS stage ON stage.id = session.current_stage_id
  LEFT JOIN extras ON extras.session_id = session.id
  LEFT JOIN paid ON paid.session_id = session.id
  WHERE stage.code <> 'cancelled'
)
SELECT CASE WHEN scheduled_at >= TIMESTAMPTZ '2026-10-12 00:00:00 Europe/Rome'
         THEN 'today_and_future' ELSE 'past' END AS bucket,
       COUNT(*) AS sessions,
       COUNT(*) FILTER (WHERE due = 0) AS free,
       COUNT(*) FILTER (WHERE due > 0 AND covered = 0) AS unpaid,
       COUNT(*) FILTER (WHERE covered > 0 AND covered < due) AS partial,
       COUNT(*) FILTER (WHERE covered >= due) AS settled,
       COUNT(*) FILTER (WHERE covered > due) AS overpaid,
       SUM(due)::numeric / 100 AS commercial_value_eur,
       SUM(covered)::numeric / 100 AS coverage_eur,
       SUM(GREATEST(due-covered,0))::numeric / 100 AS receivable_eur,
       SUM(GREATEST(covered-due,0))::numeric / 100 AS overpayment_eur,
       COUNT(*) FILTER (WHERE is_settled AND covered < due) AS unreliable_settled_flag
FROM valued GROUP BY 1 ORDER BY 1;
```

## B13. Completezza cliente e contatti non classificabili come lead

```sql
SELECT COUNT(*) AS clients,
       COUNT(*) FILTER (WHERE client.is_archived) AS archived,
       COUNT(*) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM public.sessions AS session WHERE session.client_id = client.id
       )) AS without_session,
       COUNT(*) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM public.sessions AS session WHERE session.client_id = client.id
       ) AND NOT EXISTS (
         SELECT 1 FROM public.gift_vouchers AS voucher WHERE voucher.purchaser_client_id = client.id
       )) AS without_session_or_voucher_purchase,
       COUNT(*) FILTER (WHERE client.privacy_consent_granted_at IS NOT NULL
         AND client.privacy_consent_revoked_at IS NULL) AS privacy_active_not_marketing_proof
FROM public.clients AS client;
```

## B14. Riconciliazione aggregata anti-doppio-conteggio

```sql
SELECT
  (SELECT SUM(agreed_price_cents)::numeric / 100 FROM public.sessions) AS all_session_base_eur,
  (SELECT SUM(price_cents::bigint * quantity)::numeric / 100 FROM public.session_extras) AS all_extras_eur,
  (SELECT SUM(amount_cents)::numeric / 100 FROM public.payments WHERE session_id IS NOT NULL) AS session_coverage_eur,
  (SELECT SUM(amount_cents)::numeric / 100 FROM public.payments WHERE applied_voucher_id IS NOT NULL) AS redemptions_not_cash_eur,
  (SELECT SUM(amount_cents)::numeric / 100 FROM public.payments WHERE voucher_id IS NOT NULL) AS voucher_purchase_payments_eur,
  (SELECT SUM(voucher_unused_cents)::numeric / 100 FROM public.payments) AS unused_credit_eur,
  (SELECT SUM(payment.amount_cents)::numeric / 100
   FROM public.payments AS payment
   JOIN public.payment_methods AS method ON method.id = payment.payment_method_id
   WHERE payment.applied_voucher_id IS NULL AND payment.category <> 'voucher_redemption'
     AND method.code <> 'gift_voucher') AS cash_total_eur;
```

Questa query include tutte le sessioni per riconciliazione grezza; B3/B12 sono il riferimento operativo che esclude annullate. SUM su una tabella vuota restituisce NULL: per report di produzione usare COALESCE(...,0), senza confondere NULL da errore caricamento con zero vendite.

## B15. Qualita storico e difetti potenziali

```sql
SELECT COUNT(*) FILTER (WHERE session.notes ILIKE '%Rif. import:%') AS marked_import,
       COUNT(*) FILTER (WHERE session.notes ILIKE '%Importata da Calendly%') AS marked_calendly,
       COUNT(*) FILTER (WHERE session.package_id IS NULL) AS no_package,
       COUNT(*) FILTER (WHERE session.proofs_gallery_url IS NULL) AS no_gallery,
       COUNT(*) FILTER (WHERE session.booked_online_at IS NOT NULL) AS online,
       COUNT(*) FILTER (WHERE stage.code = 'booked' AND session.scheduled_at < now()) AS stale_booked
FROM public.sessions AS session
JOIN public.session_stages AS stage ON stage.id = session.current_stage_id;

SELECT COUNT(*) AS redemptions_on_sessions_with_quantity_gt_one
FROM public.payments AS payment
WHERE payment.applied_voucher_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.session_extras AS extra
  WHERE extra.session_id = payment.session_id AND extra.quantity > 1
);

SELECT COUNT(*) AS service_package_mismatch
FROM public.sessions AS session
JOIN public.session_packages AS package ON package.id = session.package_id
WHERE session.service_type_id <> package.service_type_id;

SELECT EXTRACT(YEAR FROM scheduled_at AT TIME ZONE 'Europe/Rome')::int AS session_year,
       EXTRACT(YEAR FROM created_at AT TIME ZONE 'Europe/Rome')::int AS recorded_year,
       COUNT(*) AS rows
FROM public.sessions GROUP BY 1,2 ORDER BY 1,2;
```

Le ricerche di stringhe nelle note sono indicatori incompleti: assenza del marcatore non prova creazione nativa. Non producono un attributo commerciale source affidabile.

# APPENDICE C - Informazioni che l'AI dovrebbe sapere

## Contesto autonomo

Il CRM GMPH e un gestionale privato per Giulia Malosso Photography, attivita fotografica locale. Gestisce clienti, appuntamenti, lavorazione, extra, pagamenti, buoni e booking pubblico; non e un CRM completo per lead e marketing. Il codice usa Next.js 16.3.5, React 19.2.8, TypeScript, Supabase/PostgreSQL, route API server e autenticazione con codice condiviso/cookie firmato. Non ci sono utenti/ruoli o multi-tenancy nelle tabelle. Il deploy pubblico non e stato confrontato con il progetto DB configurato localmente.

Audit del 12 ottobre 2026: numeri da letture dirette PostgREST paginate, non dal CSV del 4 ottobre. Sono verificate le 19 tabelle esposte e tutte le colonne via OpenAPI; trigger/CHECK/RLS ricostruiti dalle 28 migrazioni, non direttamente verificati nel catalogo SQL live. Nessuna scrittura, migrazione, sync o email eseguita. Il dossier precedente era descrittivo e riportava 40 sessioni storiche, non il database attuale. Gli Excel successivi citati dalla titolare non sono disponibili nel workspace; non sono stati riconciliati.

## Modello

clients contiene anagrafica con email obbligatoria unique case-insensitive, telefono/indirizzo/nascita/note opzionali, archivio, consenso privacy e stato MailerLite. Una anagrafica non e una richiesta commerciale. sessions appartiene a un cliente e un service_type, conserva nome servizio snapshot, data/durata prevista, luogo, prezzo base concordato, stato, note, consenso immagini, partecipanti, eventuale evento online/Calendly/iCloud, caparra richiesta, pacchetto/foto/gallery. session_stage_history conserva i cambi di stato; puo essere retrodatata.

session_extras sono righe con prezzo unitario e quantita; riferimento opzionale al servizio extra o booking_addon. session_packages e catalogo nome/foto/descrizione per servizio, senza prezzo; nome e contenuto non sono snapshot completi sulla sessione. booking_event_types con regole settimanali/eccezioni/add-on definisce disponibilita pubblica. Nessuna booking_slots persistita.

payments registra amount_cents, metodo, categoria, paid_at/paid_date: session_id oppure voucher_id per acquisto. applied_voucher_id significa riscatto sulla sessione, non acquisto. gift_vouchers ha acquirente, beneficiario facoltativo, tipo service/value, prezzo/credito, acquisto/scadenza/stato e un solo riscatto; una sessione non puo risultare riscattata da due buoni a causa dell'unicita. Le altre tabelle sono service_types, payment_methods, session_stages, calendly_event_type_map, email_templates, session_emails, app_settings e audit_log.

## Regole economiche da non sbagliare

Tutti gli importi sono centesimi. Dovuto sessione = agreed_price_cents + SUM(extra.price_cents * quantity). Copertura = SUM(payments.amount_cents della sessione), compresi i buoni. Residuo = MAX(dovuto-copertura,0). Denaro incassato = pagamenti monetari, esclusi riscatti identificati da applied_voucher_id/categoria voucher_redemption/metodo code gift_voucher. Preaggregare extras e payments prima delle join: altrimenti si moltiplicano le righe.

La caparra richiesta sessions.deposit_cents NON e incasso. Booking non addebita e non crea pagamenti. Acquisto buono e cassa quando pagato, riscatto non e nuova cassa. Service voucher usa purchase_price_cents come credito economico, value usa value_cents; applicato=min(credito,residuo), resto inutilizzato perso/registrato e non riutilizzabile. Buoni non sono ricavo aggiuntivo da sommare indiscriminatamente al valore della sessione.

Valore commerciale per data appuntamento, cassa per data pagamento e fatturato fiscale sono tre concetti diversi. Non esistono fatture/IVA/costi/rimborsi strutturati. Annullata esclude servizio e credito operativo, ma non elimina denaro gia ricevuto. Future rappresentano portafoglio prenotato, non servizi gia svolti. is_settled e un flag storico impostato per base zero, non un saldo affidabile. paid_date usa Europe/Rome; paid_at puo essere sintetico a mezzogiorno quando noto solo il giorno.

## Flussi e integrazioni

Sessione nasce manualmente, da import, Calendly o booking; cliente abbinato per email. Pipeline standard booked -> completed -> proofs_sent -> selection_received -> delivered, con cancelled e ripristino. Gli stati possono essere scelti liberamente. booked diventa completed automaticamente su alcune letture quando inizio e passato, non quando lo shooting e realmente concluso. Non esistono lead/preventivo/editing/spedizione come workflow completo. Pagamenti separati dall'avanzamento.

Booking pubblico: slug attivo e visibile, fasce/chiusure, durata+buffer, preavviso, limiti, prezzo feriale/weekend, campi custom concatenati nelle note, anti-bot condizionale e rate limit per istanza. Crea cliente/sessione/extra, prova iCloud, conferma senza pagamento ne email automatica. Calcolo slot sottrae sessioni CRM, non impegni esterni iCloud. Nessuna riprogrammazione/cancellazione self-service.

MailerLite invia contatti a gruppi via sync manuale; non importa statistiche campagne. Resend invia email provini da modello e conserva registro; niente open/click/delivery tracking. Calendly importa nuovi eventi attivi da tre giorni prima, primo invitato, dedup URI; non sincronizza aggiornamenti/cancellazioni di gia importati. iCloud e un'uscita CalDAV best-effort, senza retry persistente. PayPal/Wise sono metodi manuali, non gateway. Google Calendar/Meta/ManyChat non integrati nel CRM; documentazione marketing non prova implementazione. Tema WordPress separato, contatti via mailto, niente lead CRM.

## Numeri principali e storia

Al 12 ottobre: 233 clienti, 42 sessioni tutte 2026, 3 righe extra, 63 pagamenti, 15 buoni. Valore base EUR5.723, extra EUR143, totale EUR5.866. Copertura sessioni EUR4.291 = cassa sessioni EUR2.486 + riscatti EUR1.805. Residui EUR1.575 su 14 sessioni. Cassa totale EUR4.846 = EUR2.486 sessioni + EUR2.360 acquisti buoni. Sommare tutti i payments darebbe EUR6.651, erroneo come incasso perche comprende riscatti.

Cassa 2025 EUR1.030, tutta acquisti buoni; cassa 2026 EUR3.816 (EUR2.486 sessioni, EUR1.330 acquisti buoni). Buoni per data acquisto dichiarata: 8/2025 EUR1.190, 7/2026 EUR1.170; un pagamento di EUR160 ha anno diverso dall'acquisto buono. Quattro buoni attivi EUR550; undici riscattati, credito originario EUR1.810, applicato EUR1.805 e inutilizzato EUR5.

26 sessioni passate delivered, valore EUR3.721 interamente coperto; 16 booked dal giorno di riferimento in poi, valore EUR2.145, copertura EUR570 e residuo EUR1.575. Nessuna annullata. 28 saldate incluse due gratuite, nove parziali, cinque senza pagamento. 15 prenotate online; caparre richieste snapshot EUR600, mentre deposit registrati sull'intero archivio sono 19/EUR780: insiemi diversi. Zero pacchetti, zero gallery/override foto, zero email registrate nel nuovo modulo; una funzionalita implementata non e necessariamente usata.

38 clienti con sessioni: 34 con una, quattro con due; 195 senza sessioni. Tre righe sessions sono Provini Extra (EUR160 gia nei prezzi base): togliendole rimangono 39 appuntamenti e solo un cliente con due. Non chiamare upsell ritorno. 12 acquirenti buoni; 189 contatti senza sessione o acquisto buono non possono essere classificati come lead persi. 228 contatti synced MailerLite, cinque pending. Nessuna storia sessioni pre-2026: tutti i clienti risultano nuovi solo rispetto all'archivio, non necessariamente all'attivita.

## Analytics e limiti

Calcolabili: cassa per periodo/metodo, valore per servizio, portfolio futuro, saldi, buoni e conteggi. Con elaborazione: extra, medie, clienti/servizi, date ultima sessione. Parziali: LTV osservato, ritorno/stagionalita, capacita evento, valore per pacchetto oggi non popolato, ricavo per ora pianificata. Non calcolabili: fatturato fiscale, conversione richieste, lead persi, canale acquisizione, CAC, ROI ads, prestazioni campagne e margine reale.

LTV UI e una somma nominale di sessioni+extra+buoni, include future/annullate e puo doppiare valore: non usarlo per decisioni finanziarie. Dashboard calendario ignora extra/gratuite nello stato pagamento; gli altri totali li includono. Analytics usa nome Buono regalo per escludere riscatti, fragile se snapshot/metodo divergono. Budget singleton non per anno. Rischio limiti PostgREST in query senza paginazione esaustiva. Import storico assegna ore sintetiche e durata60: niente margine/ora affidabile da quei tempi.

Rischi prioritari: privacy booking utilizzata come consenso marketing senza campo separato; percorso add-to-group senza filtro consenso; audit_log senza RLS nelle migrazioni (verificare grant live); salvataggi booking/email non atomici con errori ignorati; trigger riscatto finale repository ignora quantity, pur usata dall'API; concorrenza slot non garantita dal semplice check overlap. Nei dati letti nessun sovrapagamento o incoerenza date/metodo; quantita extra tutte1, quindi non prova del comportamento con quantita maggiori.

## Decisioni 2027

Prima correggere integrita, consensi e definizioni; poi export CSV/XLSX con ID e dataset separati. Introdurre leads collegati ai contatti, fonte/campagna, preventivo, follow-up, stato won/lost e motivo; collegare conversione alla sessione. Raccogliere spesa campagne, ore effettive e costi diretti per pricing/margine/ora. Versionare pacchetti/prezzi e normalizzare extra legacy. Successivamente segmenti/retention, capacita studio, rimborsi, consegne e import storico; automazioni ads, portale e gateway solo dopo basi affidabili. Mai inventare fonti marketing dai booking online o lead persi dalle anagrafiche inattive.