# CRM GMPH — Complete Audit (aggiornamento)

| Voce | Valore |
|---|---|
| Data e ora audit | 2026-10-19, 14:15 Europe/Rome (CEST, UTC+2) |
| Branch Git | `main` |
| Commit corrente | `9be713115cb5412a8988f1ad13dab1290e73164a` ("fix pipeline", 2026-10-16 12:42 +0200) |
| Working tree | **Non pulito.** Modificati e non committati: `components/sessions/session-directory.tsx`, `lib/sessions.ts`, `tests/sessions.test.mjs` (colonna Valore/Extra nella lista Sessioni, sviluppata il 19/10 prima dell'audit). Non tracciati: `docs/2026/Audit Ottobre 2026/Prompt per audit.md`, `docs/2027/Azioni commerciali.md`. L'audit descrive il working tree, non solo il commit |
| Ambiente analizzato | Repository locale Windows + progetto Supabase configurato in `.env.local` |
| Accesso DB live | **Sì**, in sola lettura (PostgREST GET/select con chiave service role, OpenAPI dello schema, un test con chiave anonima). Nessuna scrittura, nessuna RPC chiamata |
| Corrispondenza con produzione | **Non verificata.** Il DB letto è quello di `.env.local`; non è provato che il deploy pubblico usi lo stesso progetto |
| Limitazioni | Nessun accesso SQL diretto a `pg_catalog`: corpi di funzioni/trigger, CHECK, indici, policy e grant live **non** sono confrontabili riga per riga con il repository. Colonne e tabelle live sì (OpenAPI). Nessun test con scritture, nessun test di concorrenza, nessuna verifica UI a schermo, nessun accesso ai provider esterni (Resend, MailerLite, Calendly, iCloud, Cloudflare). Variabili locali assenti: `RESEND_API_KEY`, `MAILERLITE_API_TOKEN`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SITE_URL` |
| Audit precedente | `docs/2026/Audit Ottobre 2026/CRM_GMPH_COMPLETE_AUDIT.md` (12/10/2026), usato come riferimento storico; confronto in §1.2 e §53 |

## 1. Principio di verifica e confronto con l'audit precedente

### 1.1 Legenda delle fonti

- **[A]** codice / schema del repository (migrazioni, route, componenti, helper).
- **[B]** database live verificato in questa sessione (letture aggregate, OpenAPI).
- **[C]** test automatici eseguiti.
- **[D]** configurazione (env, `package.json`, righe di configurazione live).
- **[E]** inferenza o non verificato.

Quando un'informazione deriva solo da [A] lo si dice esplicitamente: *"Verificato nel repository, non verificato sul database live"* vale per tutti i corpi di funzioni/trigger e per le policy.

### 1.2 Cosa è cambiato dal 12 ottobre

| Tema | 12/10 | 19/10 | Fonte |
|---|---|---|---|
| Migrazioni | 28 | **40** (12 nuove: lead, prodotti extra, pacchetti v2, piano economico, buoni omaggio, distribuzione mensile, ticket base, contact_type, fasi stampe, supplemento sabato) | A |
| Schema live | 19 tabelle | **28 tabelle**, tutte le colonne introdotte dalle 12 nuove migrazioni presenti | B |
| Sessioni live | 42, tutte 2026 | **102** (56 nel 2025, 46 nel 2026); 77 inserite nell'ottobre 2026: lo storico 2025 è stato importato | B |
| Clienti live | 233 | 237 (tutti con `created_at` 2026) | B |
| Pagamenti live | 63 | 186 | B |
| Extra (`session_extras`) | 3 righe, EUR 143 | 27 righe, EUR 1.277; catalogo prodotti con tier | A, B |
| Lead | Entità assente | Modulo completo (lista, scheda, conversione, analytics) ma **0 righe live** | A, B |
| Pacchetti | Senza prezzo, catalogo vuoto | Prezzo, durata, inclusioni, snapshot su sessione; **20 pacchetti live**, ma **0 sessioni** con pacchetto | A, B |
| Budget | Singleton `annual_budget_cents` | Piani economici per anno con distribuzione mensile; budget legacy resta fallback della Home | A, B |
| Analytics | Solo cassa in Home | + Lead, Extra & Upsell, Clienti & Retention, Economico | A |
| Trigger riscatto buono senza `quantity` | Aperto | **Risolto nel repository**: usa `line_total_cents` (corpo live non verificabile) | A |
| Fasi stampe | Assenti | 3 fasi `awaiting_print_selection` → `prints_completed`, presenti live | A, B |
| Bug pipeline stampe (scheda che tornava indietro) | — | **Risolto** il 16/10 (commit `fix pipeline`) | A, C |
| Errore Analisi → Economico (colonna mancante) | — | **Risolto**: la migrazione `planned_base_ticket` risulta ora applicata | B |
| Consenso privacy usato come marketing | Aperto | **Ancora aperto e aggravato**: il widget invia il consenso privacy sempre `true` senza mostrarlo (§37) | A |
| `audit_log` senza RLS nel repository | Aperto | Ancora assente nel repository; **live la chiave anonima riceve 0 righe su 3.020** → probabile drift (§53) | A, B |

Le altre 20 anomalie del 12/10 sono rivalutate una per una in §54.1.

## 2. Executive summary

**Stato generale.** Il CRM è un'applicazione interna monoutente, matura sul nucleo operativo (clienti, sessioni, pipeline, pagamenti, buoni, prenotazione pubblica) e molto cresciuta in una settimana sul lato commerciale e analitico (lead, catalogo extra, pacchetti con snapshot, piano economico, tre nuove analisi). Il codice è coerente, compila (`npm run build` ok), il lint è pulito e 36 test unitari passano [C]. Lo schema live corrisponde al repository a livello di tabelle e colonne [B].

**Il limite principale non è tecnico ma di adozione e dati.** Le funzioni nuove sono quasi vuote nel DB: 0 lead, 0 sessioni con pacchetto, 0 snapshot inclusioni, 1 riga extra su 27 con costo, 1 solo piano economico (2027) [B]. Le analytics corrispondenti sono quindi corrette come formule ma oggi poco informative.

**Maturità complessiva.** Operativo: buona. Economico/cassa: buona, con una incoerenza di definizione in Home (§30). Commerciale (funnel, fonti, margini): strumenti pronti, dati assenti. Sicurezza: accettabile per un uso monoutente, con un problema privacy serio (§37).

**Punti forti**
- Separazione netta e coerente tra valore commerciale (`agreed_price_cents + session_extras.line_total_cents`) e cassa (`payments` esclusi i riscatti buono) in Economico [A]; riconciliazione live esatta al centesimo (§39) [B].
- Operazioni economiche critiche atomiche via RPC (`apply_session_package`, `save_economic_plan`) e trigger DB per sovrapagamento e riscatto buoni [A].
- Snapshot storici: prezzo concordato, nome servizio, pacchetto, inclusioni, extra con `line_total_cents` storico [A].
- Fuso Europe/Rome gestito esplicitamente in sessioni, Economico, Extra, Retention [A].
- Accesso con cookie firmato HMAC, chiave service role solo lato server, RPC revocate a `anon`/`authenticated` [A].

**Principali rischi tecnici**
1. Prenotazione pubblica non atomica: errori su inserimento extra e aggiornamento cliente ignorati; nessun lock contro doppie prenotazioni concorrenti [A].
2. API di lista che leggono intere tabelle senza paginazione (limite PostgREST 1.000 righe): oggi irrilevante (102 sessioni), da tenere presente [A, B].
3. Definizioni diverse dello stesso concetto: "incassato" escluso per nome metodo in Home e per categoria in Economico; universo sessioni diverso fra Extra/Economico e Retention [A].
4. `audit_log` senza RLS nel repository (live risulta protetto: drift da codificare) [A, B].

**Principali rischi operativi**
1. **Privacy**: il widget di prenotazione invia `privacyConsent: true` senza mostrare alcuna informativa o casella; quel consenso porta poi il contatto nel gruppo marketing MailerLite [A] (§37).
2. Il messaggio di conferma prenotazione promette un'email con istruzioni per la caparra che il sistema **non invia** automaticamente [A].
3. Margine extra non misurabile: 26 righe su 27 senza costo; gli add-on della prenotazione non portano il costo [B, A].
4. Lead non registrati: le analisi Lead sono vuote [B].

**Principali incoerenze dati**
- Il gauge della Home confronta la **cassa** con un target annuale che nel Piano Economico è definito come **valore commerciale** [A] (§30).
- Piano 2027: 81 sessioni target, 78 distribuite (Battesimo 0/3); ticket pianificato Mini Sessione Autunno (EUR 120) sopra il listino massimo (EUR 115) [B].
- Listini paralleli: prenotazione online Natale EUR 125/145 (sabato e domenica) vs pacchetto Mini Sessione Natale EUR 135 + EUR 25 solo sabato [B].
- 2 sessioni legacy "Provini Extra" contate come sessioni in Economico ed Extra, escluse in Retention [A, B].

**Funzionalità importanti incomplete**: email di conferma prenotazione; versionamento pacchetti (sostituito da snapshot, accettabile); costi extra da prenotazione; rimborsi (solo DELETE pagamento); consenso marketing separato.

**Integrazioni attive**: Supabase; iCloud CalDAV (credenziali presenti in locale); Calendly (token presente, 0 sessioni importate live); MailerLite (228 clienti sincronizzati live, token assente in locale); Resend (codice presente, 0 email registrate, chiave assente in locale); Cloudflare Turnstile (opzionale, chiavi assenti in locale) [A, B, D].

| Area | Stato | Note |
|---|---|---|
| Clienti | Completo | CRUD, archivio logico, email univoca, import. LTV di scheda mescola valori (§8) |
| Lead | Parziale (implementato, non adottato) | Modulo completo, 0 righe live; manca modifica generica e riapertura |
| Sessioni | Completo | Pipeline con fasi stampe, snapshot, pacchetto via RPC, supplemento sabato suggerito |
| Pacchetti | Completo (non adottato) | 20 pacchetti live con prezzi e inclusioni; 0 sessioni collegate |
| Extra | Parziale | Catalogo e tier corretti; costi quasi assenti, add-on booking senza prodotto/costo |
| Pagamenti | Completo con limiti | Trigger anti-sovrapagamento; nessun rimborso; snapshot nome metodo non aggiornato su PATCH |
| Retention | Completo | Formule coerenti e testate; storico 2025 importato solo da ottobre 2026 |
| Economico | Completo | Piano 2027 coerente sul valore (15.000), incoerente sulla distribuzione sessioni (78/81) |
| Prenotazioni pubbliche | Parziale / rischio | Funziona; non atomica, consenso privacy implicito, email di conferma assente |
| Sicurezza/privacy | Critico (privacy) / Accettabile (accesso) | Vedi §36–37 |

## 3. Stack tecnologico

Versioni da `package-lock.json` [D].

| Componente | Versione / dettaglio |
|---|---|
| Framework | Next.js **16.3.5**, App Router, `proxy.ts` (ex middleware) |
| React / React DOM | **19.2.8** |
| TypeScript | ^5 (`tsc --noEmit` pulito) |
| Package manager | npm (`package-lock.json`) |
| Database | Supabase Postgres via `@supabase/supabase-js` **2.112.4**, nessun ORM |
| Client Supabase | `lib/supabase/admin.ts` (service role, solo server). `lib/supabase/client.ts` (anon) esiste ma **non è importato da nessun file** |
| UI | Tailwind CSS 4, `lucide-react` 1.38, componenti propri in `components/shared` |
| Grafici | ECharts 6.1 |
| Import/export | SheetJS `xlsx` 0.20.3 (CSV/XLSX) |
| Sanificazione HTML | `sanitize-html` 2.17.7 |
| Calendario | `tsdav` 2.3.2 (CalDAV iCloud) |
| Email | Resend via `fetch` diretto, nessun SDK |
| Date/ora | Helper propri in `lib/datetime.ts` con `Intl` e fuso **Europe/Rome** esplicito; nessuna libreria date |
| Anti-bot | Cloudflare Turnstile, verifica via `fetch` |
| Test | `node --test` su file `.test.mjs` che importano `.ts` (type stripping nativo). **Nessuno script `test` in `package.json`** |
| Lint | ESLint 9 + `eslint-config-next` 16.3.5 |
| Build | `next build` |

Timezone: tutte le date di sessione e i confini anno/mese di Economico, Extra e Retention sono calcolati in Europe/Rome; la Home (`/api/dashboard/analytics`) e Calendly usano invece il fuso del server (§45).

## 4. Struttura applicazione

- **Routing**: App Router. Le pagine in `app/**/page.tsx` montano componenti client in `components/**`; i dati passano da route handler in `app/api/**` (57 file `route.ts`). **Nessuna server action** (`"use server"` assente).
- **Autenticazione**: `proxy.ts` verifica il cookie `gmph_session` firmato HMAC su tutte le rotte tranne `/login`, `/api/login`, `/prenota/*`, `/api/public/booking/*` e asset.
- **Helper condivisi** (`lib/`): `datetime`, `sessions`, `leads`, `packages`, `extra-products`, `economic-plans`, `client-retention`, `booking`, `email`, `mailerlite`, `calendly`, `icloud-calendar`, `turnstile`, `rate-limit`, `vouchers`, `auth`.
- **Layout**: `app/layout.tsx` con `AppNavigation` (nascosta su `/login` e `/prenota/*`).

| Route pagina | Funzione |
|---|---|
| `/home` | Dashboard |
| `/leads`, `/leads/[id]` | Lead |
| `/leads/analisi` | Analisi Lead |
| `/clients`, `/clients/[id]`, `/clients/import` | Clienti |
| `/sessions`, `/sessions/[id]`, `/sessions/import` | Sessioni (lista, pipeline, scheda, import) |
| `/payments` | Pagamenti |
| `/vouchers`, `/vouchers/[id]` | Buoni regalo |
| `/pacchetti` | Catalogo pacchetti |
| `/analisi/extra` | Extra & Upsell |
| `/analisi/clienti-retention` | Clienti & Retention |
| `/analisi/economico` | Dashboard e Piano economico |
| `/prenotazioni` | Configurazione prenotazione pubblica |
| `/config` | Configurazione |
| `/extra` | Catalogo prodotti extra |
| `/mailerlite`, `/calendly` | Integrazioni |
| `/login` | Accesso |
| `/prenota/[slug]` | Pagina pubblica di prenotazione (noindex) |

Elenco completo API in Appendice D.

## 5. Database

28 tabelle live [B], tutte presenti nelle migrazioni [A]. RLS abilitata in migrazione su tutte tranne `audit_log`; **nessuna policy** definita nel repository: l'accesso avviene solo con service role [A]. Tutte le PK sono UUID `gen_random_uuid()` salvo `app_settings` (boolean singleton).

| Tabella | Finalità | Vincoli e relazioni principali [A] | Righe live [B] |
|---|---|---|---:|
| `clients` | Anagrafica | Email obbligatoria, unique `lower(email)`; `is_archived`; consenso privacy concesso/revocato; stato MailerLite | 237 |
| `service_types` | Tipi di servizio | Nome unique; `is_addon`; `saturday_surcharge_cents ≥ 0` default 0; `suggested_price_cents` legacy | 22 |
| `session_stages` | Fasi pipeline | Codice e nome unique | 12 |
| `sessions` | Lavoro prenotato | FK client/servizio/fase (RESTRICT); `agreed_price_cents NOT NULL ≥ 0`; `duration_minutes > 0`; snapshot pacchetto (`package_name_snapshot`, `package_price_cents_snapshot`, `package_duration_minutes_snapshot`, `package_included_photos_snapshot`, `package_description_snapshot`) con CHECK `package_id` e nome snapshot entrambi null o entrambi valorizzati; `deposit_cents`; trigger overlap, storico fasi, auto-settle, audit | 102 |
| `session_stage_history` | Storico fasi | FK sessione CASCADE; snapshot nome fase | 236 |
| `session_packages` | Catalogo pacchetti | FK servizio RESTRICT; unique (servizio, nome); `price_cents`, `duration_minutes`, `included_photos`, descrizione, attivo, ordine | 20 |
| `session_package_inclusions` | Contenuto pacchetto | FK pacchetto CASCADE, prodotto RESTRICT; quantità > 0; unique (pacchetto, prodotto) | 9 |
| `session_package_inclusion_snapshots` | Inclusioni congelate sulla sessione | FK sessione CASCADE; nome prodotto, categoria, quantità, costo snapshot | **0** |
| `extra_products` | Catalogo extra | Categoria `digital/print/album/other`; `pricing_mode unit/tiered`; prezzo obbligatorio se `unit`; costo opzionale | 10 |
| `extra_product_price_tiers` | Fasce prezzo | FK prodotto CASCADE; unique (prodotto, min); continuità validata solo dall'API | 3 |
| `session_extras` | Extra venduti | FK sessione CASCADE; `extra_product_id` RESTRICT; `booking_addon_id` SET NULL; `category_snapshot`; `price_cents`; `quantity > 0`; **`line_total_cents NOT NULL`** (riempito da trigger solo se null); `unit_cost_cents` | 27 |
| `leads` | Opportunità | Stato `to_handle/info_sent/follow_up/booked/lost`; fonte; `contact_type`; CHECK: `follow_up` richiede data, `lost` richiede motivo, `booked` richiede cliente e sessione, `existing_client` richiede cliente | **0** |
| `payments` | Movimenti | XOR sessione/buono; `applied_voucher_id` solo su sessione; categoria enum 5 valori; importo > 0; `paid_date`/`paid_at` sincronizzati da trigger; trigger anti-sovrapagamento e riscatto | 186 |
| `payment_methods` | Metodi | Codice/nome unique; `is_system` | 5 |
| `gift_vouchers` | Buoni | Tipo `service/value`; stato; `is_complimentary`; unique `redeemed_session_id`; scadenza da trigger se non fornita | 16 |
| `booking_event_types` | Evento prenotabile | Slug unique; prezzi feriale/weekend; finestre; limiti; caparra; campi form JSON | 1 |
| `booking_availability_rules` / `_exceptions` | Disponibilità | FK evento CASCADE | 5 / 4 |
| `booking_addons` | Add-on evento | Categoria `digital/print` | 6 |
| `annual_economic_plans` | Piano per anno | Anno unique 2000–2100; target annuale; Extra attesi; note | 1 |
| `economic_plan_monthly_targets` | Target EUR per mese | Unique (piano, mese) | 12 |
| `economic_plan_service_targets` | Target per servizio | Unique (piano, servizio); `target_sessions`, `planned_base_ticket_cents`, `target_value_cents` | 8 |
| `economic_plan_monthly_service_targets` | Sessioni per servizio × mese | FK composta verso target servizio CASCADE | 84 |
| `app_settings` | Singleton | Valuta, validità buoni, `annual_budget_cents` legacy, gruppi MailerLite | 1 |
| `email_templates` / `session_emails` | Email transazionali | Template `proofs`; registro invii | 1 / 0 |
| `calendly_event_type_map` | Mapping Calendly | Prezzi feriale/weekend | 1 |
| `audit_log` | Storico modifiche | JSON completo old/new; **RLS non abilitata nel repository** | 3.020 |

Configurazioni live rilevanti [B]: 12 fasi (7 standard attive, 3 fasi stampe, 1 custom attiva "Guida Inviata", 2 legacy inattive "Caparra Ricevuta" e "Saldo Ricevuto"); 5 metodi (Buono regalo di sistema, Wise, Contanti, Fineco, PayPal); `annual_budget_cents` = EUR 10.000; validità buoni 12 mesi.

## 6. Migrazioni

40 file dal 27/08 al 15/10/2026 [A]. Per le 12 successive all'audit precedente:

| Migrazione | Introduce | Applicata live? [B] | Rischi / dipendenze |
|---|---|---|---|
| `20261008000000_add_packages_and_transactional_emails` | Pacchetti v1, `email_templates`, `session_emails`, campi consegna su sessione | Sì (tabelle e colonne presenti) | Base dei pacchetti v2 |
| `20261010000000_sync_payment_dates` | Trigger allineamento `paid_date`/`paid_at` Europe/Rome; validazione importi | Probabile (186 pagamenti con entrambe le date) | Corpo trigger non verificabile |
| `20261013000000_add_leads` / `..010000_add_lead_last_name` | Tabella `leads` con CHECK di stato | Sì | Nessuna |
| `20261013020000_add_extra_products` | Catalogo prodotti, tier, nuove colonne `session_extras`, backfill `line_total_cents`, trigger riscatto/pagamenti su `line_total_cents` | Sì (colonne presenti) | Corpo trigger live non verificabile |
| `20261013030000_packages_v2` | Prezzo/durata pacchetto, inclusioni, snapshot su sessione, `apply_session_package` | Sì (RPC esposta) | RPC non controlla `is_active` del pacchetto |
| `20261014000000_add_annual_economic_plans` | Piani, target mensili/servizi, seed 2027 | Sì (piano 2027 presente) | Seed per nome servizio |
| `20261014010000_save_economic_plan_rpc` | Prima versione RPC | Superata | — |
| `20261014020000_voucher_manual_expiry_and_complimentary` | `is_complimentary`, scadenza manuale | Sì (1 buono omaggio) | PATCH scadenza senza controllo vs acquisto |
| `20261014030000_add_economic_plan_monthly_service_targets` | Distribuzione mensile sessioni, nuova firma RPC | Sì (84 righe) | — |
| `20261014040000_add_planned_base_ticket` | `planned_base_ticket_cents`, corpo finale RPC | **Sì** (colonna presente; il 16/10 risultava mancante) | Era la causa dell'errore Economico |
| `20261015000000_add_lead_contact_type` | `contact_type` con CHECK | Sì | — |
| `20261015010000_add_print_fulfillment_stages` | 3 fasi stampe | Sì | — |
| `20261015020000_add_service_saturday_surcharge` | Supplemento sabato, backfill per nome | Sì; valori conformi al backfill (§12) | Backfill per nome esatto |

Nessuna colonna introdotta dalle migrazioni manca live; nessuna colonna live manca nelle migrazioni [A, B]. Non esiste una tabella di tracciamento migrazioni leggibile via PostgREST, quindi "applicata" significa "effetti strutturali presenti".

## 7. RPC e funzioni Postgres

Esposte live via PostgREST: solo `apply_session_package` e `save_economic_plan` [B]. Tutte le funzioni sono `SECURITY INVOKER`; solo le due RPC hanno grant espliciti (`service_role`, revocate a `PUBLIC`, `anon`, `authenticated`) [A]. Corpi verificati nel repository, non sul database live.

**`apply_session_package(p_session_id, p_package_id, p_agreed_price_cents?, p_duration_minutes?, p_included_photos?) → void`** [A]
- Blocca la sessione (`FOR UPDATE`); errore se assente.
- Cancella gli snapshot inclusioni esistenti.
- Con pacchetto: errore se non esiste o se appartiene a un altro servizio; scrive snapshot di nome, prezzo, durata, foto, descrizione; aggiorna prezzo concordato, durata e foto **solo** se l'override è fornito (altrimenti li lascia invariati); inserisce gli snapshot inclusioni (nome prodotto, categoria, quantità, costo unitario, ordine).
- Con pacchetto null: azzera pacchetto e snapshot; mantiene prezzo e durata; `included_photos` resta o prende la foto dello snapshot precedente.
- Atomica: qualunque errore annulla tutto. Non verifica `is_active` del pacchetto.

**`save_economic_plan(p_year, p_create, p_annual_target_cents, p_expected_uplift_cents, p_notes, p_monthly, p_services, p_service_months) → uuid`** [A]
- Valida: array JSON; esattamente 12 mesi distinti (errore `22023`).
- Crea il piano o lo blocca per anno (`P0002` se assente).
- Upsert dei 12 target mensili.
- Elimina i target servizio non più presenti (la distribuzione segue in CASCADE), upsert dei servizi con `target_value_cents = target_sessions × planned_base_ticket_cents` calcolato **nel DB** (bigint, overflow → `22003`).
- Cancella e reinserisce tutta la distribuzione mensile; righe per servizi non presenti in `p_services` falliscono sulla FK composta.
- **Salva atomicamente** piano, target mensili, target servizi, ticket base e distribuzione. Non verifica che la distribuzione sommi ai target (è solo un avviso UI).

Altri trigger [A]: `validate_session_schedule` (overlap e "Altro" con dettaglio; nessun lock), `record_session_stage_change`, `validate_payment_amount` (dovuto = prezzo + somma `line_total_cents`), `validate_voucher_redemption` (credito vs residuo; non controlla che l'acquisto del buono sia stato pagato), `reactivate_deleted_voucher_payment`, `sync_payment_dates`, `default_session_extra_line_total`, `auto_settle_zero_price_sessions`, `set_voucher_expiry`, `snapshot_payment_method` (solo INSERT), `record_audit_log`.

## 8. Clienti

[A] salvo indicazione.
- Campi: nome, cognome, email (obbligatoria, salvata in minuscolo, unique case-insensitive), telefono, data di nascita, indirizzo, note, consenso privacy (concesso/revocato), archivio, stato MailerLite.
- Ricerca: sottostringa case-insensitive su nome, cognome, email. Ordinamenti: alfabetico, aggiornamento, prossima sessione, LTV.
- Archivio: flag logico; la lista principale mostra solo attivi e **non ha un selettore archiviati** nella UI. Eliminazione bloccata (409) se ci sono sessioni o buoni acquistati.
- Duplicati: impediti solo sull'email esatta. Live: 0 email duplicate, **5 coppie con nome e cognome identici** (omonimi o duplicati con email diverse, da controllare a mano) [B].
- LTV in lista: prezzo + extra di **tutte** le sessioni (comprese future e annullate) + prezzo dei buoni acquistati non omaggio. Non è cassa né valore realizzato. Saldo: somma dei residui positivi delle sessioni non annullate.
- "Prossima sessione" non esclude le annullate.

| Uso di un cliente | Attivo | Archiviato |
|---|---|---|
| Nuova sessione manuale | Sì | **No** (API richiede cliente attivo) |
| Lead `existing_client` | Sì | **Sì**: l'API verifica solo l'esistenza (il messaggio d'errore parla di "cliente attivo") |
| Conversione lead `existing_client` | Sì | Sì, usa il cliente già collegato |
| Conversione lead `new_contact` con email già presente | Proposto | Mostrato ma non collegabile: la UI propone un nuovo cliente, che poi fallisce per email duplicata (inferenza [E], non testato) |
| Prenotazione pubblica | Riusato | **Riusato** senza filtro archivio, con aggiornamento contatti |

Live: 237 clienti, 0 archiviati, 88 con almeno una sessione, 101 con consenso privacy attivo [B].

## 9. Lead / opportunità

Il modello **CLIENT = persona, LEAD = richiesta, SESSION = lavoro prenotato è implementato** [A]: `leads.client_id` e `leads.session_id` sono nullable e non unique, più lead per lo stesso cliente sono ammessi, la sessione nasce solo alla conversione.

| Campo | Note |
|---|---|
| `name`, `last_name` | Nome obbligatorio; cognome opzionale (il campo si chiama `name`, non `first_name`) |
| `contact` | Testo libero obbligatorio (telefono, handle, email) |
| `service_type_id` | Obbligatorio |
| `status` | `to_handle` Da gestire · `info_sent` Info inviate · `follow_up` Da ricontattare · `booked` Prenotato · `lost` Perso |
| `source` | `instagram` · `meta_ads` · `google` · `referral` Passaparola · `existing_client` Cliente precedente · `other` · `unknown` Non noto |
| `contact_type` | `new_contact` Nuovo contatto · `existing_client` Cliente esistente (richiede `client_id`) |
| `lost_reason` | `price` · `availability` · `no_response` · `chose_other_photographer` · `postponed` · `service_not_suitable` · `distance` · `other` |
| `requested_period`, `notes`, `follow_up_at`, `info_sent_at` | Opzionali; `follow_up` richiede la data |
| `client_id`, `session_id`, `converted_at`, `closed_at` | Valorizzati alla conversione |

Flussi [A]:
- **Creazione**: nome, contatto, servizio, fonte e tipo contatto obbligatori; per `existing_client` la UI precompila dal cliente scelto.
- **Modifica**: non esiste una modifica generica. La PATCH permette cambio tipo contatto/collegamento cliente e le azioni `info_sent`, `follow_up`, `lost`. Errori di battitura nel nome o nel contatto non sono correggibili da UI.
- **Conversione**: apre la creazione sessione precompilata. `new_contact`: ricerca cliente per email esatta case-insensitive, altrimenti crea un nuovo cliente. `existing_client`: usa il cliente collegato. La POST sessione accetta solo lead aperti; dopo l'inserimento aggiorna il lead a `booked` con cliente, sessione, `converted_at`, `closed_at`; se l'aggiornamento fallisce **cancella la sessione appena creata** (compensazione, non transazione).
- **Dopo la conversione**: il lead è chiuso; **non esiste riapertura** (né per `booked` né per `lost`).
- **Duplicati**: nessun controllo di lead duplicati.

Live: **0 lead** [B]. Il tracciamento lead non è ancora iniziato.

## 10. Lead analytics

`/api/leads/analytics` [A]:
- Coorte: anno di `leads.created_at` in Europe/Rome; una conversione successiva resta nella coorte di ingresso.
- Filtri: anno, servizio, tipo contatto. La fonte è una **ripartizione**, non un filtro.
- **Lead ricevuti** = lead della coorte filtrata.
- **Prenotazioni** = lead con stato attuale `booked`.
- **Conversion rate** = prenotazioni / lead ricevuti.
- **Valore prenotato** = somma `sessions.agreed_price_cents` delle sessioni collegate. **Esclude extra e pagamenti.** Differisce quindi dal "Valore" sessione usato altrove (prezzo + extra).
- **Ticket medio** = valore prenotato / prenotazioni.
- Motivi di perdita: conteggio dei lead `lost` per motivo, quota sul totale persi. Nuovi vs esistenti: ripartizione per `contact_type`, con bucket "non classificato" se null.

Con 0 lead live tutte le metriche sono vuote [B].

## 11. Sessioni

[A] salvo indicazione.
- **Creazione manuale**: cliente attivo, servizio attivo non add-on, data/ora Europe/Rome (`parseLocalDateTime`), durata intera > 0, prezzo in euro interi ≥ 0, pacchetto opzionale (applicato via RPC dopo l'insert; se fallisce la sessione viene cancellata). Fase iniziale `booked` se futura, `completed` se passata. Overlap → 409 dal trigger.
- **Modifica**: data, durata, prezzo, luogo, note, dettaglio; nessun ricalcolo automatico del prezzo.
- **Duplicazione**: solo precompilazione UI; copia cliente, servizio, durata, prezzo, luogo, dettaglio, note; azzera data, pacchetto, foto e consenso immagini.
- **Eliminazione**: bloccata se ci sono pagamenti; altrimenti cancella anche l'evento iCloud. **Annullamento** = fase `cancelled` (rimuove evento iCloud).
- **Fasi**: pipeline con fasi standard + fasi stampe, ammesse solo con un extra di categoria `print` a quantità > 0 e dopo la consegna (controllo in API e UI). Le sessioni `booked` passate vengono promosse a `completed` in modo lazy alla lettura (nessun job).
- **Pipeline**: colonne fisse nel codice; la fase custom live "Guida Inviata" non ha una colonna. Le sessioni in "Foto consegnate" senza stampe e in "Stampe completate" spariscono dalla board.
- **Lista**: dal 19/10 (working tree) mostra **Valore** = prezzo concordato + somma `line_total_cents` e badge **Extra** se esiste almeno una riga.
- **Foto incluse**: `included_photos` modificabile; null = usa lo snapshot pacchetto.

Live [B]: 102 sessioni, 0 annullate, 21 future `booked`, 80 `delivered`, 1 `prints_completed`; 20 prenotate online, 0 da Calendly; 3 a prezzo zero; 16 di sabato; 0 sovrapposizioni stesso cliente/stessa ora; 0 sovrapagate.

## 12. Supplemento sabato

[A] `sessionSaturdaySurchargeCents` applica `service_types.saturday_surcharge_cents` solo se il giorno in Europe/Rome è sabato; `suggestedSessionPrice = prezzo pacchetto + supplemento`. Test con casi sabato/venerdì, confine UTC e Natale [C].

| Contesto | Comportamento |
|---|---|
| Nuova sessione manuale e conversione lead | Prezzo suggerito ricalcolato a ogni cambio di pacchetto/data/servizio, finché l'utente non modifica a mano il prezzo |
| Override manuale | Prevale; l'API salva il valore inviato senza ricalcoli |
| Sessione salvata: cambio data | Avviso + pulsante "Applica prezzo suggerito" (basato sullo snapshot prezzo pacchetto); nessun ricalcolo automatico |
| Sessione salvata: cambio pacchetto | Mantiene il prezzo; la UI offre il prezzo suggerito |
| Prenotazione pubblica | **Non usa** il supplemento: usa i prezzi feriale/weekend dell'evento (weekend = sabato **e** domenica) |
| Calendly | Usa prezzi feriale/weekend del mapping, giorno calcolato nel fuso del server |
| Doppio supplemento | Non possibile: nessun flusso somma il supplemento a un prezzo che già lo contiene. Il valore salvato in `agreed_price_cents` è sempre la fonte |

Valori live [B]: Famiglia 15 · Maternità 15 · Ritratto 15 · Mini Sessione Autunno 15 · **Mini Sessione Natale 25** · tutti gli altri 0.

## 13. Pacchetti

[A] `session_packages`: servizio, nome (unique per servizio), prezzo, durata, foto incluse, descrizione, attivo, ordine (assegnato automaticamente, non modificabile da UI). Creazione e modifica con validazione; disattivazione tramite checkbox; eliminazione bloccata (409) se usato da sessioni. La PATCH permette di cambiare il servizio del pacchetto.

**Nessun versionamento** del catalogo. Lo storico è garantito dagli snapshot su ciascuna sessione. Duplicando una sessione il pacchetto non viene copiato.

## 14. Snapshot pacchetti

Quando si applica un pacchetto (RPC, §7) la sessione riceve [A]: `package_id`, `package_name_snapshot`, `package_price_cents_snapshot`, `package_duration_minutes_snapshot`, `package_included_photos_snapshot`, `package_description_snapshot` + righe `session_package_inclusion_snapshots`.

- **`package_price_cents_snapshot`** = prezzo di listino del pacchetto al momento dell'applicazione (riferimento).
- **`agreed_price_cents`** = prezzo realmente concordato (può includere supplemento sabato o sconti). È **l'unico** che entra nel valore commerciale.
- Modificare il catalogo non altera gli snapshot esistenti.

Live: **0 sessioni con pacchetto, 0 snapshot** [B]. Il meccanismo è implementato e testato solo a livello di codice.

## 15. Inclusioni pacchetto

[A] `session_package_inclusions` collega un pacchetto a `extra_products` con quantità e ordine. Sulla sessione diventano `session_package_inclusion_snapshots` (nome, categoria, quantità, costo unitario congelati).

**Inclusione ≠ extra venduto**: le inclusioni non creano righe `session_extras`, non entrano nel valore, nel dovuto, nei pagamenti né nelle analisi Extra [A].

Live: 9 inclusioni su 5 pacchetti (Famiglia e Maternità Ricordi/Collezione, Ritratto Identità), 0 orfane [B].

## 16. Catalogo extra / prodotti

[A] Categorie `digital`, `print`, `album`, `other`. Modalità `unit` (prezzo unitario obbligatorio) o `tiered` (fasce cumulative per unità: le prime N unità al prezzo della prima fascia, le successive alla fascia successiva; fasce contigue da 1, solo l'ultima aperta; quantità 1–999). Costo unitario opzionale. Nessuna eliminazione: solo disattivazione.

Live: 10 prodotti, 1 tiered (Provini aggiuntivi: 1–5 a EUR 8, 6–10 a EUR 6, 11+ a EUR 5). Dettaglio in §43 [B].

## 17. `session_extras`

[A] Creazione manuale da catalogo: salva `extra_product_id`, nome (o descrizione per `other`), `category_snapshot`, `price_cents` (per i tiered è la **media arrotondata** per unità), `quantity`, `line_total_cents`, `unit_cost_cents`, note. L'utente può forzare totale e costo. Nessuna modifica: solo aggiunta ed eliminazione.

**`line_total_cents` è la fonte storica del valore venduto** e la usano dovuto, trigger pagamenti, riscatto buoni, Economico, Extra, Retention e la lista Sessioni. Cambiare il catalogo non modifica le righe esistenti.

Add-on della prenotazione pubblica: diventano `session_extras` con `booking_addon_id`, categoria, prezzo, quantità, totale; **senza `extra_product_id` né costo** [A].

Live [B]: 27 righe su 27 sessioni, EUR 1.277; 22 da catalogo, 1 da add-on, 1 legacy da servizio, 3 senza categoria (EUR 143, righe storiche pre-catalogo); **26 su 27 senza costo**; 20 con quantità > 1; 7 con `line_total ≠ price × quantity` (coerente con la media dei tier, non un errore); 0 a valore zero; 0 orfane.

## 18. Legacy "Provini Extra"

[B] Il servizio "Provini Extra" esiste ed è marcato `is_addon = true`; 2 sessioni live lo usano (EUR 128 base). [A] Trattamento:
- **Retention**: escluso (per nome e per `is_addon`).
- **Economico** ed **Extra & Upsell**: **inclusi** come sessioni normali (contano nel numero sessioni e nel ticket medio; nessun doppio conteggio di importi, ma il denominatore è gonfiato di 2).
- Nuova sessione manuale: i servizi add-on non sono selezionabili.

Non convertiti in `session_extras` (corretto non farlo automaticamente).

## 19. Extra & Upsell analytics

`/api/analytics/extras` [A]:
- Universo: sessioni dell'anno (data sessione Europe/Rome), escluse solo le annullate. Incluse future, servizi add-on e Provini Extra.
- **Sessioni con extra**: somma degli extra (filtrati) **> 0**. Diverso dal badge della lista Sessioni, che considera la sola presenza di una riga.
- **Upsell rate** = sessioni con extra / sessioni analizzate.
- **Valore extra totale** = Σ `line_total_cents`.
- **Extra medio/sessione** = valore extra / sessioni; **extra medio acquirenti** = valore extra / sessioni con extra.
- **Ticket base** = Σ prezzo concordato / sessioni; **ticket finale** = (Σ prezzo + extra) / sessioni; **aumento** = differenza assoluta e percentuale.
- **Costi** = Σ `unit_cost_cents × quantity` solo dove il costo esiste; **margine diretto** = ricavi − costi registrati; **copertura costi** = ricavi delle righe con costo / ricavi totali.
- **Filtro categoria**: filtra le **righe** extra, non le sessioni: il denominatore resta tutte le sessioni del perimetro.
- **Costo mancante**: la riga entra nei ricavi e conta zero nei costi, quindi **il margine è sovrastimato**; la copertura lo segnala. Live la copertura è vicina a zero (1 riga su 27).

## 20. Pagamenti

[A] Categorie `deposit`, `balance`, `full_payment` (sessione), `voucher_purchase` (buono), `voucher_redemption` (riscatto, metodo `gift_voucher`). Importo > 0; trigger anti-sovrapagamento sul dovuto (prezzo + extra) o sul prezzo del buono. Modificabili (non i riscatti); eliminazione fisica, **nessun rimborso**; eliminare un riscatto riattiva il buono. La PATCH del metodo non aggiorna `payment_method_name`.

- **Valore commerciale**: quanto vale il lavoro (prezzo concordato + extra), indipendente dai pagamenti.
- **Cassa**: pagamenti esclusi i riscatti buono. Due regole diverse nel codice: Economico esclude per `applied_voucher_id` o categoria `voucher_redemption`; Home esclude per nome metodo `"Buono regalo"`. Live le tre marcature sono coerenti (0 discrepanze) [B].

I pagamenti non entrano nelle analytics commerciali (Lead, Extra, Retention); entrano solo come "Incassato" e "Residuo" in Economico e nella Home.

## 21. Buoni

[A]
- **Acquisto**: crea il buono e un pagamento `voucher_purchase` per l'intero prezzo; se il pagamento fallisce tenta di cancellare il buono (compensazione). Omaggi (`is_complimentary`) senza pagamento.
- **Riscatto** (`/api/sessions/[id]/redeem`): pagamento `voucher_redemption` pari a `min(credito, residuo)`; la parte non usata va in `voucher_unused_cents` e si perde. Il trigger blocca il buono e lo marca riscattato. Non controlla il servizio del buono né il pagamento completo dell'acquisto.
- **Scadenza**: riconciliata lazy alla lettura delle liste buoni.

Il codice implementa effettivamente **acquisto = cassa** (pagamento contato come incasso) e **riscatto = copertura non monetaria** (escluso dalla cassa, riduce il residuo).

Live [B]: 16 buoni: 4 attivi (EUR 550), 11 riscattati (credito EUR 1.810, applicato EUR 1.805, inutilizzato EUR 5), 1 omaggio attivo (EUR 50). 0 buoni non omaggio non interamente pagati, 0 attivi scaduti.

## 22. Prenotazione pubblica

[A] salvo indicazione.
- **Struttura**: `/prenotazioni` configura eventi; `/prenota/[slug]` è la pagina pubblica (noindex); API pubbliche `/api/public/booking/[slug]` (slot) e `.../book`.
- **Disponibilità**: regole settimanali + eccezioni (chiusura o fasce alternative); slot ogni durata + buffer; preavviso minimo; orizzonte 120 giorni; esclude sessioni CRM non annullate (non gli impegni esterni su iCloud). Con limite giornaliero gli slot proposti vengono compattati.
- **Prezzo**: feriale o weekend (**sabato e domenica**); nessun prezzo festivo; nessun uso di `session_packages` né di `saturday_surcharge_cents` → **nessun rischio di doppio supplemento**, ma listino parallelo a quello dei pacchetti.
- **Add-on**: validati e prezzati lato server; diventano `session_extras` senza prodotto/costo; **errore di inserimento ignorato**.
- **Cliente**: ricerca con `ilike(email)` senza escape di `%`/`_`, archiviati inclusi; se esiste aggiorna i contatti (errore ignorato) e riattiva il consenso privacy; altrimenti crea il cliente (resta anche se la sessione poi fallisce).
- **Sessione**: `booked`, prezzo base in `agreed_price_cents`, caparra richiesta in `deposit_cents` (min tra caparra evento e totale), consenso immagini se scelto.
- **Nessun pagamento online, nessuna email di conferma**: il messaggio finale dice "A breve riceverai un'email con le istruzioni per pagare la caparra", ma l'invio non è automatizzato.
- **Concorrenza**: ricontrollo dello slot prima dell'insert e trigger overlap senza lock: due richieste simultanee possono passare entrambe. Limite totale conta anche le annullate.
- **Protezioni**: Turnstile solo se configurato; rate limit in memoria per processo (60 slot/min, 5 prenotazioni/10 min per IP).
- Modificare l'evento cancella e ricrea gli add-on: gli extra storici perdono `booking_addon_id` (conservano gli snapshot).

Live [B]: 1 evento attivo "Mini Sessioni di Natale 2026" (30 min + 30 buffer, EUR 125/145, caparra EUR 40, 26/10–30/11, max 2 al giorno, nessun limite totale), 5 regole, 4 eccezioni, 6 add-on; 20 sessioni prenotate online.

## 23. Clienti & Retention

`lib/client-retention.ts`, testato [A, C].
- **Universo valido**: esclude annullate, servizi `is_addon` e "Provini Extra"; rimuove duplicati esatti (cliente + servizio + istante); **realizzata** = data ≤ adesso (indipendentemente dalla fase); future tenute separate.
- **Clienti serviti** = clienti distinti con ≥ 1 sessione valida realizzata nell'anno.
- **Nuovi** = serviti la cui prima sessione valida nel CRM cade nell'anno.
- **Clienti di ritorno** = serviti con una sessione **non prima** nell'anno (un cliente può essere nuovo e di ritorno nello stesso anno).
- **Repeat Client Rate** = serviti nell'anno con > 1 sessione valida realizzata **in tutto lo storico** / serviti. Differenza: "di ritorno" guarda l'anno; il Repeat Rate guarda tutta la storia, anche successiva all'anno scelto.
- **Sessioni medie/cliente** = sessioni realizzate dell'anno / serviti. **Valore medio cliente** = Σ (prezzo + extra) dell'anno / serviti.
- **Valore cumulato** = per i serviti dell'anno, somma storica di tutte le sessioni valide realizzate; confronto clienti con 1 sessione vs più sessioni. Non è un LTV predittivo.
- **Percorsi**: coppie consecutive di servizi su tutta la storia, clienti distinti.
- **Riattivazione**: clienti senza prenotazioni future e con ultima sessione da ≥ 6/12/18/24 mesi (default 6).
- **Future**: clienti con prenotazioni future; "ritorni già prenotati" se hanno anche una sessione realizzata. Non entrano nel Repeat Rate.

Live [B]: tra le sessioni non annullate, 75 clienti con 1 sessione, 12 con 2, 1 con 3 o più. Lo storico parte dal 2025 ed è stato importato a ottobre 2026: i "nuovi" 2025 sono tali rispetto al CRM, non all'attività.

## 24. Piano economico

[A] Un piano per anno (`annual_economic_plans.year` unique), senza copia da anni precedenti (un nuovo piano parte da zero). Ogni piano contiene: target annuale, **Extra attesi** (`expected_uplift_cents`), note, 12 target mensili in euro, target per servizio (sessioni + ticket medio base pianificato → valore), distribuzione mensile delle sessioni per servizio. Salvataggio unico via `save_economic_plan` (§7, §28).

Live [B]: solo il piano **2027**. Per il 2026 non esiste un piano: Economico mostra il target come assente, la Home usa il budget legacy.

## 25. Target economici

[A] **Valore pianificato = Σ valore target servizi + Extra attesi.** Non imposta il target annuale: viene confrontato con esso. Avvisi di coerenza (`planCoherence`):
1. Σ target mensili − target annuale ≠ 0;
2. Σ valore servizi + Extra attesi − target annuale ≠ 0;
3. per ogni servizio, Σ sessioni distribuite ≠ sessioni target;
4. totale distribuito ≠ totale sessioni target.

Nessun controllo tra target mensili in euro e matrice delle sessioni. Gli Extra attesi non sono distribuiti né per mese né per servizio.

Piano 2027 live [B]: target EUR 15.000; Σ mesi EUR 15.000 ✔; Σ servizi EUR 14.235 + Extra attesi EUR 765 = EUR 15.000 ✔; **sessioni 78 distribuite su 81 target ✘** (Battesimo 0/3; l'avviso compare, ed è coperto da test [C]).

## 26. Target per servizio

[A] `target_value_cents = target_sessions × planned_base_ticket_cents`, calcolato in anteprima dal client e dal parser server, ma **persistito dal DB** dentro la RPC (il valore inviato dal client non viene usato). "Listino attuale": solo riferimento, min/max dei pacchetti attivi con prezzo per servizio; avviso se il ticket pianificato supera il massimo del listino. Non modifica il piano. **Il Piano non è un listino** e non va usato come fonte prezzi.

Piano 2027 live [B] (tutti con valore = sessioni × ticket ✔):

| Servizio | Sessioni | Ticket base | Valore | Listino pacchetti live | Note |
|---|---:|---:|---:|---|---|
| Famiglia | 15 | 240 | 3.600 | 170–390 | |
| Maternità | 10 | 230 | 2.300 | 180–390 | |
| Mini Sessione Natale | 25 | 135 | 3.375 | 135 | |
| Ritratto | 6 | 200 | 1.200 | 160–300 | |
| Kids | 8 | 125 | 1.000 | 110–145 | |
| Mini Sessione Autunno | 8 | 120 | 960 | 115 | **Ticket sopra il listino massimo** → avviso |
| Mini Sessione Festa della Mamma | 6 | 125 | 750 | 115–145 | |
| Battesimo | 3 | 350 | 1.050 | 290–550 | Non distribuito nei mesi |

## 27. Distribuzione mensile sessioni

[A] Matrice servizio × mese. **La lista servizi è derivata dai target per servizio**: aggiungere un servizio crea 12 celle a zero, rimuoverlo elimina la riga (UI e CASCADE DB). Al caricamento i mesi mancanti diventano 0 e le righe orfane sono ignorate; live 0 righe orfane [B]. Avvisi per servizio e totale (§25). Salvataggio nella stessa RPC del piano.

## 28. Salvataggio piano

[A] Un'unica chiamata RPC, transazionale. Salva atomicamente: anagrafica piano (target, Extra attesi, note), 12 target mensili, target servizi con ticket base e valore derivato, distribuzione mensile completa. Qualunque errore (formato, FK, CHECK, overflow) annulla tutto. Validazioni extra **fuori** dalla RPC (`parsePlanPayload`): range importi, 12 mesi unici, servizi unici, servizi esistenti e non add-on (non richiede servizio attivo), note ≤ 2.000 caratteri.

Limiti residui: la coerenza (somme) resta un avviso, non un vincolo; salvataggi concorrenti sullo stesso anno si serializzano sul lock ma l'ultimo vince (accettabile per un utente singolo).

## 29. Dashboard economico

`/api/analytics/economic` + `computeEconomicDashboard` [A], testato [C]:
- **Universo**: sessioni dell'anno (Europe/Rome), escluse annullate; incluse future, add-on e Provini Extra. Valore sessione = prezzo concordato + Σ `line_total_cents`.
- **Realizzato** = valore delle sessioni con data ≤ adesso; **Futuro** = data > adesso; **Acquisito** = realizzato + futuro.
- **Target annuale** = piano dell'anno; **nessun fallback legacy** qui (senza piano: target, copertura e da generare sono vuoti).
- **Copertura** = acquisito / target; **Da generare** = max(target − acquisito, 0).
- **Ticket medio** = acquisito / numero sessioni.
- **Incassato** = pagamenti con `paid_date` nell'anno esclusi i riscatti (per `applied_voucher_id` o categoria). Include gli acquisti buono.
- **Residuo da incassare** = Σ max(valore − tutti i pagamenti collegati, 0) sulle sessioni dell'anno (i riscatti riducono il residuo).
- **Tabella mensile**: sessioni target (dalla matrice), sessioni acquisite, target euro, realizzato/futuro/acquisito, gap = acquisito − target, copertura. **Nessuna colonna cumulata.**
- **Tabella servizi**: sessioni e valore target vs acquisiti, gap; servizi venduti ma assenti dal piano marcati "fuori piano".
- **Base vs extra**: Σ prezzi concordati, Σ extra, quota extra.

## 30. Home

[A] salvo indicazione.
- KPI di sintesi, sempre su tutto lo storico: valore sessioni (prezzo + extra, non annullate), da incassare, conteggi saldate/parziali/non pagate, sessioni in ritardo (`booked` passate: di fatto sempre 0 perché le promuove la lettura stessa).
- Prossime 6 sessioni con stato pagamento corretto (include extra).
- **Calendario**: stato pagamento calcolato sul **solo prezzo concordato** (ignora extra; una sessione a prezzo zero senza pagamenti risulta "da saldare").
- Incassi per periodo e grafici mensili/cumulati per servizio e metodo: esclusione riscatti per **nome metodo** `"Buono regalo"`; confini e mesi nel **fuso del server**.
- Buoni: emessi, attivi, riscattati, scaduti, in scadenza a 30 giorni, valore attivo.
- **Target annuale** = `getAnnualTargetForYear`: piano economico dell'anno se esiste, altrimenti `app_settings.annual_budget_cents`; restituisce `annualTargetSource: "plan" | "legacy_budget"`. Live 2026: nessun piano → **budget legacy EUR 10.000** [B].
- **Incoerenza di definizione**: il gauge confronta il target con la **cassa** dell'anno (comprensiva degli acquisti buono), mentre nel Piano economico lo stesso target è un obiettivo di **valore commerciale**, misurato in Economico come "acquisito". Nel 2027 Home ed Economico mostreranno due percentuali diverse dello stesso target.

## 31. Configurazione

[A] `/config`: tipi di servizio (crea, rinomina, attiva/disattiva, ordina, flag add-on, **supplemento sabato** in euro interi), metodi di pagamento (quelli di sistema non modificabili), fasi sessione, validità buoni (1–120 mesi), **budget annuale legacy** (descritto come fallback del gauge Home). `/extra`: catalogo prodotti. `/mailerlite`: gruppi transazionale/marketing. `/calendly`: mapping e sync. `/prenotazioni`: eventi pubblici. `/pacchetti`: catalogo pacchetti. `suggested_price_cents` dei servizi è legacy: vuoto per tutti i 22 servizi live e non più esposto [B].

## 32. InfoTooltip

[A] `components/shared/info-tooltip.tsx`: bottone icona con `aria-label`, `aria-describedby`, `aria-expanded`; apertura su hover, focus e tap (toggle), chiusura su blur ed Esc; `role="tooltip"`; larghezza `w-64` limitata a `100vw − 2rem`.

Usato in: dashboard Home, Lead (lista, scheda, analisi), Extra & Upsell, Clienti & Retention, Economico, Configurazione. Tutte le pagine di analisi lo usano. Non lo usano: i componenti grafico (gauge, trend incassi, grafici mensili extra/retention) e la lista Sessioni (che per Valore/Extra usa l'attributo `title`).

## 33. Navigazione

Menu reale [A], tutte le route esistono:

- **Home** → `/home`
- **Contatti** → Lead `/leads` · Clienti `/clients`
- **Gestione** → Sessioni `/sessions` · Pagamenti `/payments` · Buoni regalo `/vouchers`
- **Pacchetti** → `/pacchetti`
- **Analisi** → Lead `/leads/analisi` · Extra & Upsell `/analisi/extra` · Clienti & Retention `/analisi/clienti-retention` · Economico `/analisi/economico`
- **Prenotazioni** → `/prenotazioni`
- **Configurazione** → Configurazione `/config` · Extra `/extra` · MailerLite `/mailerlite` · Calendly `/calendly`

Differenza rispetto alla struttura attesa: Configurazione è un sottomenu che include anche Extra, MailerLite e Calendly. Sottomenu apribili al passaggio del mouse (desktop) e al clic. Mobile: barra con Home, Clienti, Sessioni, Pagamenti + "Altro".

## 34. Integrazioni esterne

| Integrazione | Finalità e direzione | File | Variabili (solo nome) | Stato [B/D] | Rischi |
|---|---|---|---|---|---|
| Supabase | DB unico, server → DB | `lib/supabase/admin.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (non usata) | Attivo | Service role bypassa RLS: sicurezza affidata al proxy |
| MailerLite | CRM → MailerLite, manuale | `lib/mailerlite.ts`, `app/api/mailerlite/*` | `MAILERLITE_API_TOKEN` (assente in locale) | 228 clienti `synced`, 9 `pending` | Gruppo marketing deciso dal consenso privacy (§37) |
| Calendly | Calendly → CRM, polling manuale | `lib/calendly.ts`, `app/api/calendly/*` | `CALENDLY_API_TOKEN` | 1 mapping, 0 sessioni importate | Weekend calcolato nel fuso del server |
| iCloud CalDAV | CRM → calendario | `lib/icloud-calendar.ts` | `ICLOUD_CALDAV_USERNAME`, `ICLOUD_CALDAV_APP_PASSWORD`, `ICLOUD_CALENDAR_NAME` | Configurato in locale | Best-effort, errori solo in console, nessun retry |
| Resend | CRM → email | `lib/email.ts`, `app/api/sessions/[id]/emails` | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` (assenti in locale) | 0 email registrate | Log e cambio fase non controllati |
| Cloudflare Turnstile | Anti-bot booking | `lib/turnstile.ts` | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (assenti in locale) | Opzionale: senza chiavi la verifica passa | Protezione disattivata se non configurata in produzione (non verificabile) |
| Meta / ManyChat / pixel | — | Nessuna implementazione trovata | — | Assente | Nessuna attribuzione campagne |

Altre variabili: `ACCESS_CODE`, `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NODE_ENV`.

## 35. Email

[A] Provider Resend via `fetch`. Template modificabili (`email_templates`, live 1: `proofs`) con variabili escapate, HTML sanificato, link gallery solo HTTPS. Unico trigger: invio manuale dei provini dalla scheda sessione, con anteprima. Dopo l'invio: registra `session_emails` e porta la sessione a `proofs_sent`; **entrambi gli errori sono ignorati**, nessun retry né idempotenza; un nuovo invio può riportare indietro una sessione già in fase successiva. **Nessuna email di prenotazione** né altri automatismi. Live: 0 invii registrati [B].

## 36. Autenticazione e sicurezza

[A] salvo indicazione.
- Accesso con **codice condiviso** (`ACCESS_CODE`, confronto stringa non timing-safe), cookie `gmph_session` firmato HMAC-SHA256 (`SESSION_SECRET`, confronto `timingSafeEqual`), HttpOnly, SameSite=Lax, Secure in produzione, 30 giorni, stateless (logout cancella il cookie ma non invalida copie rubate).
- **Login senza rate limit**.
- **Redirect dopo login non validato**: `router.replace(searchParams.get("next") ?? "/home")` accetta qualunque valore passato in `/login?next=...` (rischio open redirect, da verificare a runtime [E]).
- Rotte pubbliche: `/login`, `/api/login`, `/prenota/*`, `/api/public/booking/*`. Tutte le altre API richiedono il cookie.
- Service role solo lato server; il client anon non è usato. RPC revocate ad `anon`/`authenticated`.
- **RLS**: abilitata in migrazione su 27 tabelle senza policy (accesso diretto anon negato), **non su `audit_log`**. Test live: con la chiave anonima `audit_log`, `clients`, `sessions`, `payments`, `leads` restituiscono 0 righe senza errore [B] → nessuna esposizione osservata.
- Export CSV/XLSX senza neutralizzazione delle formule (`=`, `+`, `-`, `@`): rischio CSV injection se un dato inserito dal pubblico (es. nome in prenotazione) viene aperto in Excel.
- HTML di email e descrizioni evento sanificato lato server.

## 37. Privacy e consensi

[A] Campi: `clients.privacy_consent_granted_at/revoked_at`; `sessions.image_consent_granted_at/revoked_at`. **Nessun consenso marketing/newsletter separato.**

**Problema P0.** Nel widget pubblico `privacyConsent` è inizializzato a `true` e **non esiste né una casella né un testo d'informativa privacy**; l'unica casella visibile è quella facoltativa per l'uso delle immagini. Il server richiede `privacyConsent === true` e lo registra sul cliente (riattivandolo anche se revocato). La sincronizzazione MailerLite usa poi lo stesso consenso privacy per inserire il contatto nel gruppo **marketing**. Risultato: chi prenota online finisce nel gruppo newsletter senza aver visto né accettato alcuna informativa o consenso marketing. Inoltre `add-to-group` aggiunge clienti a un gruppo qualsiasi senza verificare alcun consenso.

Live [B]: 101 clienti con consenso privacy attivo; 228 sincronizzati su MailerLite.

## 38. Qualità dati (live, sola lettura)

| Controllo | Esito [B] |
|---|---|
| Conteggi | 237 clienti · 102 sessioni (2025: 56, 2026: 46) · 88 clienti con sessioni · 0 lead · 27 extra · 186 pagamenti · 16 buoni · 20 pacchetti · 9 inclusioni · 10 prodotti · 1 piano |
| Orfani | 0 extra senza sessione · 0 inclusioni orfane · 0 pacchetti senza servizio · 0 righe distribuzione orfane |
| Duplicati | 0 email duplicate · **5 coppie nome+cognome identici** · 0 sessioni duplicate (stesso cliente e istante) |
| Prezzi e quantità | Nessun prezzo negativo possibile (CHECK); 3 sessioni a prezzo zero; 0 quantità non valide |
| Pagamenti | 0 senza data · 0 nomi metodo non allineati · 0 incoerenze tra categoria, buono applicato e metodo · 0 sessioni sovrapagate |
| Buoni | 0 non omaggio non interamente pagati · 0 attivi già scaduti |
| Extra | 3 righe senza categoria (EUR 143) · 26/27 senza costo · 7 con totale ≠ prezzo × quantità (media dei tier, atteso) |
| Pacchetti | 20 attivi, tutti con prezzo e durata; 0 usati da sessioni |
| Pipeline | 0 sessioni `booked` nel passato; 1 in `prints_completed` |
| Storico | Tutti i clienti creati nel 2026; 77 sessioni inserite a ottobre 2026 (import storico) |

## 39. Fotografia economica del database

Lettura live 19/10/2026 [B]. Valori in EUR. Valore per anno della sessione; pagamenti per `paid_date`. Annullate: nessuna.

| | 2025 | 2026 | Totale |
|---|---:|---:|---:|
| Sessioni | 56 | 46 (21 future) | 102 |
| **A. Valore base sessioni** | 6.960 | 6.336 | 13.296 |
| **B. Extra** | 1.027 | 250 | 1.277 |
| **C. Valore commerciale (A+B)** | 7.987 | 6.586 | 14.573 |
| di cui futuro | 0 | 2.865 | 2.865 |
| **D. Pagamenti lordi** | 8.967 | 5.831 | 14.798 |
| **E. Cassa monetaria** (D − F) | 8.967 | 4.026 | 12.993 |
| — cassa su sessioni | 7.937 | 2.696 | 10.633 |
| — cassa acquisto buoni | 1.030 | 1.330 | 2.360 |
| **F. Riscatti buono** (non cassa) | 0 | 1.805 | 1.805 |
| **G. Residuo da incassare** | 0 | 2.135 | 2.135 |

Riconciliazione esatta: cassa su sessioni 10.633 + riscatti 1.805 = 12.438 di copertura; 14.573 − 12.438 = **2.135** residuo. La cassa 2025 supera il valore 2025 perché comprende EUR 1.030 di buoni venduti; inoltre cassa (per data pagamento) e valore (per data sessione) non hanno lo stesso perimetro temporale.

Valore per servizio, tutte le sessioni [B]:

| Servizio | Sessioni | Base | Extra |
|---|---:|---:|---:|
| Mini Sessione Natale | 49 | 5.280 | 910 |
| Maternità | 12 | 2.048 | 98 |
| Famiglia | 11 | 1.995 | 75 |
| Commerciale | 4 | 1.000 | 24 |
| Battesimo | 3 | 720 | 0 |
| Mini Sessione Festa della Mamma | 6 | 580 | 56 |
| Mini Sessione Autunno | 5 | 555 | 0 |
| Ritratto | 4 | 480 | 82 |
| Mini Sessione Bambini | 4 | 310 | 32 |
| Kids | 2 | 200 | 0 |
| Provini Extra (legacy) | 2 | 128 | 0 |

Extra per categoria: digitale 1.070 · stampe 54 · altro 10 · senza categoria 143.

## 40. Copertura storica 2025 / 2026 / 2027

- **2025**: 56 sessioni, tutte importate a posteriori (ottobre 2026). Pagamenti presenti e coerenti. Copertura completa **non dimostrabile**: assenza di sessioni in un mese non significa assenza di attività [E].
- **2026**: 46 sessioni (25 realizzate, 21 future quasi tutte Natale). Dati inseriti in corso d'anno.
- **2027**: solo il piano economico; nessuna sessione.
- **Lead**: tabella creata il 13/10/2026, **0 righe**. Non esiste alcun funnel storico: tasso di conversione 2025/2026 non calcolabile.
- Prima dell'import di ottobre, l'audit del 12/10 vedeva solo 42 sessioni 2026: i confronti con quel documento vanno fatti sapendo che lo storico è cambiato.

## 41. Logiche commerciali in parole semplici

| Termine | Cosa significa nel CRM |
|---|---|
| **Lead** | Una richiesta di informazioni o un'opportunità: qualcuno ha chiesto un servizio. Non è ancora un lavoro. Può finire "Prenotato" o "Perso" |
| **Cliente** | Una persona in anagrafica, identificata dall'email. Può avere più richieste e più sessioni nel tempo |
| **Sessione** | Un lavoro fotografico fissato in calendario, con prezzo concordato. È quello che occupa l'agenda e genera valore |
| **Pacchetto** | Un'offerta di listino (es. Famiglia "Racconto": 60 minuti, 18 foto, EUR 220). Quando lo si applica a una sessione, i suoi dati vengono fotografati sulla sessione e non cambiano più |
| **Extra** | Qualcosa venduto **in più** sulla sessione (provini aggiuntivi, stampe, album). Aumenta il valore |
| **Inclusione** | Qualcosa che è **già compreso** nel prezzo del pacchetto (es. stampe del pacchetto Ricordi). Non aumenta il valore e non è un extra |
| **Valore commerciale** | Quanto vale il lavoro: prezzo concordato + extra venduti. Indipendente da quanto è stato pagato |
| **Incassato (cassa)** | Il denaro effettivamente ricevuto: caparre, saldi, buoni venduti. Non comprende l'uso di un buono |
| **Buono regalo** | Quando viene venduto è denaro incassato; quando viene usato copre una sessione ma non è nuovo denaro |
| **Target** | L'obiettivo annuale di valore commerciale nel Piano economico (in Home oggi confrontato con la cassa) |
| **Extra attesi** | La parte del target che si pensa di raggiungere con gli extra, oltre al valore base delle sessioni |
| **Ticket medio base pianificato** | Il prezzo medio per sessione che si prevede di ottenere per un servizio, senza extra. Sessioni × ticket = valore target del servizio |
| **Cliente di ritorno** | Nell'anno scelto ha fatto una sessione che non era la sua prima |
| **Repeat Client Rate** | Tra i clienti serviti nell'anno, quota di chi ha fatto più di una sessione in tutta la sua storia |

## 42. Listino pacchetti live

Catalogo `session_packages` al 19/10/2026 [B]. Tutti attivi.

| Servizio | Pacchetto | Prezzo | Durata | Foto | Inclusioni |
|---|---|---:|---:|---:|---|
| Battesimo | Cerimonia | 290 | 90 | 30 | — |
| Battesimo | Cerimonia e Festa | 450 | 240 | 45 | — |
| Battesimo | La Giornata | 550 | 300 | 60 | — |
| Famiglia | Momenti | 170 | 45 | 12 | — |
| Famiglia | Racconto | 220 | 60 | 18 | — |
| Famiglia | Ricordi | 290 | 60 | 25 | 1 Ingrandimento 30x40 · 1 "3 stampe 15x21" |
| Famiglia | Collezione | 390 | 90 | 30 | 30 "1 Stampa 10x15" · 1 Album 21x21 20 pagine |
| Kids | Dolcezza | 110 | 30 | 8 | — |
| Kids | Tenerezza | 145 | 30 | 15 | — |
| Maternità | Momenti | 180 | 45 | 12 | — |
| Maternità | Racconto | 225 | 60 | 18 | — |
| Maternità | Ricordi | 290 | 60 | 25 | 1 Ingrandimento 30x40 · 1 "3 stampe 15x21" |
| Maternità | Collezione | 390 | 120 | 30 | 30 "1 Stampa 10x15" · 1 Album 21x21 20 pagine |
| Mini Sessione Autunno | Mini Sessione Autunno | 115 | 30 | 8 | — |
| Mini Sessione Festa della Mamma | Abbraccio | 115 | 30 | 8 | — |
| Mini Sessione Festa della Mamma | Legami | 145 | 30 | 15 | — |
| Mini Sessione Natale | Mini Sessione Natale | 135 | 30 | 8 | — |
| Ritratto | Presenza | 160 | 40 | 8 | — |
| Ritratto | Racconto | 210 | 60 | 20 | — |
| Ritratto | Identità | 300 | 90 | 30 | 1 Set 10 stampe professionali + presentazione/supporto ecopelle |

Servizi attivi senza pacchetti: Commerciale, Mini Sessione Bambini, Mini Sessione Festa del Papà, Newborn, Servizio a Domicilio, Smash Cake, Stampe Extra, Altro, Comunione, Compleanno, Coppia, Lilliput, Matrimonio (e Provini Extra, add-on). Il prezzo Natale del catalogo (135, +25 il sabato) differisce dall'evento online 2026 (125 feriale / 145 sabato e domenica).

## 43. Prodotti extra live

[B]

| Prodotto | Categoria | Pricing | Prezzo | Costo | Attivo |
|---|---|---|---:|---:|---|
| 10 stampe 10x15 | print | unit | 35,00 | 3,00 | Sì |
| 5 stampe 10x15 | print | unit | 20,00 | 1,50 | Sì |
| 30 stampe 10x15 | print | unit | 95,00 | 9,00 | Sì |
| Album 21x21 - 20 pagine | album | unit | 65,00 | 30,00 | Sì |
| Ingrandimento 30x40 | print | unit | 40,00 | 3,49 | Sì |
| 3 stampe 15x21 | print | unit | 18,00 | 1,47 | Sì |
| 1 Stampa 10x15 | print | unit | 5,00 | 0,30 | Sì |
| Provini aggiuntivi | digital | tiered | 1–5: 8,00 · 6–10: 6,00 · 11+: 5,00 | — | Sì |
| Set 10 stampe professionali + presentazione/supporto ecopelle | print | unit | 20,00 | — | Sì |
| Altro | other | unit | 0,00 | — | No |

I costi esistono nel catalogo per i prodotti di stampa e album, ma le vendite storiche sono quasi tutte di provini digitali (senza costo) o precedenti al catalogo: per questo la copertura costi live è bassissima.

## 44. Test

[C] Eseguiti il 19/10/2026 sul working tree.

| File | Test | Copertura |
|---|---:|---|
| `tests/client-retention.test.mjs` | 5 | Coorti, future, annullate, Provini Extra, percorsi, duplicati |
| `tests/economic-plan-draft.test.mjs` | 5 | Bozza piano: aggiunta/rimozione servizi, distribuzione |
| `tests/economic-plans.test.mjs` | 8 | Valore target, listino di riferimento, coerenza, dashboard, cassa |
| `tests/leads.test.mjs` | 3 | Ripartizione per tipo contatto |
| `tests/sessions.test.mjs` | 7 top-level + 8 sotto-casi | Fasi stampe, API cambio fase (mock), pipeline, Valore sessione, supplemento sabato, prezzi 2027 |

- **36 test, 36 superati, 0 falliti** (35 sul commit HEAD; 1 aggiunto nel working tree).
- Avvisi: `MODULE_TYPELESS_PACKAGE_JSON` per l'import diretto di `.ts`; nessun impatto.
- **Nessuno script `test`** in `package.json`; nessun test DB, PGlite o E2E. Trigger, RPC, booking, pagamenti e buoni non sono coperti da test automatici.
- `npm run lint`: pulito. `npm run build`: riuscito. `tsc --noEmit`: pulito.

## 45. Performance

Problemi **reali ma latenti** [A]:
- API che leggono intere tabelle senza `range` (clienti, sessioni, lead, buoni, Home, Extra analytics, sync MailerLite, export pagamenti `all=1`): oltre 1.000 righe PostgREST tronca **in silenzio**. Oggi le tabelle più grandi sono 237 clienti e 186 pagamenti [B]: nessun impatto per anni.
- `/api/sessions` carica tutte le sessioni e pagina in memoria; la pipeline richiede fino a 20 pagine da 100, ma ognuna riparte dall'intera tabella.
- Filtro "giorno" della lista applicato dopo la paginazione (mostra solo i risultati della pagina corrente).

Corretti: Economico e Retention paginano esplicitamente a blocchi di 1.000. Nessun N+1: le relazioni sono caricate in una query (inclusa la nuova colonna Valore).

**Ottimizzazioni premature da evitare**: indici aggiuntivi, viste materializzate, cache. Con ~100 sessioni l'anno non servono.

## 46. Gestione errori

[A]
- Le API restituiscono messaggi italiani e codici coerenti (400/404/409/500); le RPC mappano i codici Postgres a messaggi utente (`save_economic_plan`).
- **Errori ignorati**: inserimento extra e aggiornamento cliente nel booking, log email e cambio fase dopo invio, salvataggio URL iCloud, scritture stato MailerLite, alcune compensazioni (cancellazione buono/sessione dopo errore).
- Aggiornamenti ottimistici solo nello spostamento in pipeline, con rollback in caso di errore.
- Caricamenti con stato "Caricamento…" e messaggi d'errore inline. Nessun retry automatico.
- Nessun falso "salvato" individuato: i messaggi di successo seguono risposte `ok`. Eccezione semantica: la conferma della prenotazione pubblica promette un'email che non parte.

## 47. Transazionalità

| Operazione | Transazionale? | Note [A] |
|---|---|---|
| Applicare/rimuovere pacchetto + snapshot inclusioni | **Sì** (RPC) | |
| Salvare piano economico completo | **Sì** (RPC) | |
| Pagamento sessione / riscatto buono | **Sì** (insert + trigger nella stessa istruzione) | |
| Creazione sessione con pacchetto | No | Insert poi RPC; compensazione cancellando la sessione |
| Conversione lead | No | Sessione → RPC pacchetto → update lead; compensazione con DELETE sessione (errore della compensazione ignorato) |
| Prenotazione pubblica | **No** | Cliente → sessione → extra → iCloud; cliente nuovo resta se la sessione fallisce; extra possono mancare |
| Acquisto buono | No | Buono → pagamento; compensazione best-effort |
| Catalogo prodotti con tier / pacchetti con inclusioni / evento con regole e add-on | No | Delete + insert multipli; ripristini best-effort |
| Invio email | No | Invio esterno → log → cambio fase, errori ignorati |

Rischio principale di salvataggio parziale: la prenotazione pubblica (unico flusso esposto a utenti esterni).

## 48. Debito tecnico / backlog

| ID | Pri | Problema | Impatto | Probabilità | Complessità | Raccomandazione |
|---|---|---|---|---|---|---|
| T1 | **P0** | Consenso privacy implicito nel booking usato come consenso marketing | Iscrizione newsletter senza base giuridica | Certa a ogni prenotazione online | Bassa | Mostrare informativa e casella privacy non preselezionata; aggiungere un consenso marketing separato e usarlo per MailerLite; controllo consenso in `add-to-group` |
| T2 | P1 | Booking non atomico, errori extra/cliente ignorati | Prenotazione confermata senza add-on o con dati non aggiornati | Bassa | Media | Controllare gli errori; idealmente RPC unica cliente+sessione+extra |
| T3 | P1 | Email di conferma promessa ma non inviata | Cliente in attesa, lavoro manuale non tracciato | Certa | Bassa | Cambiare il testo oppure inviare la conferma via Resend |
| T4 | P1 | Gauge Home: cassa vs target di valore | KPI principale ambiguo dal 2027 | Certa con piano | Bassa | Decidere cosa misura il target e allineare Home a Economico (o mostrare entrambe le metriche con etichette distinte) |
| T5 | P1 | Costi extra assenti, add-on booking senza prodotto/costo | Margine diretto sovrastimato | Certa | Bassa | Collegare gli add-on ai prodotti del catalogo; valorizzare i costi |
| T6 | P2 | RLS `audit_log` assente nel repository, presente di fatto live | Ricostruendo il DB dalle migrazioni l'audit sarebbe leggibile in anonimo | Bassa | Bassa | Migrazione con `enable row level security` |
| T7 | P2 | Login senza rate limit e redirect `next` non validato | Brute force del codice condiviso; open redirect | Bassa | Bassa | Limite tentativi; accettare solo percorsi interni |
| T8 | P2 | Esclusione riscatti per nome metodo in Home; snapshot nome non aggiornato su PATCH | Cassa Home errata se il metodo viene rinominato | Bassa | Bassa | Usare categoria/`applied_voucher_id` come in Economico |
| T9 | P2 | Fuso del server in Home e Calendly | Pagamenti di fine mese/anno nel mese sbagliato se il server è in UTC | Media su Vercel | Bassa | Usare gli helper Europe/Rome già esistenti |
| T10 | P2 | Calendario Home ignora extra e sessioni gratuite | Stato pagamento errato sul calendario | Media | Bassa | Riutilizzare `calculateSessionDue` |
| T11 | P2 | Universo sessioni diverso tra Economico/Extra e Retention (Provini Extra, add-on) | Ticket medio e upsell rate leggermente distorti | Certa (2 sessioni) | Bassa | Escludere `is_addon` anche nei conteggi sessioni di Economico ed Extra |
| T12 | P2 | Riduzione prezzo o eliminazione extra non rivalidano i pagamenti | Sovrapagamenti silenziosi | Bassa (0 live) | Bassa | Controllo in API |
| T13 | P2 | Nessun rimborso: solo cancellazione pagamento | Storico cassa alterabile | Bassa | Media | Categoria rimborso con importo negativo, quando serve davvero |
| T14 | P2 | CSV/XLSX senza neutralizzazione formule | CSV injection da dati inseriti dal pubblico | Bassa | Bassa | Prefisso apostrofo per celle che iniziano con `= + - @` |
| T15 | P2 | Invio provini può far regredire la fase | Pipeline incoerente | Bassa | Bassa | Cambiare fase solo se precedente a `proofs_sent` |
| T16 | P3 | Lead: niente modifica generica né riapertura | Errori di inserimento non correggibili | Media all'adozione | Bassa | Aggiungere modifica campi base |
| T17 | P3 | Pipeline con colonne fisse (fase custom "Guida Inviata" invisibile) | Fasi custom non gestibili da board | Bassa | Bassa | Disattivare la fase custom o mapparla |
| T18 | P3 | API senza paginazione (limite 1.000) | Troncamento silenzioso a lungo termine | Molto bassa | Media | Rimandare |
| T19 | P3 | Nessuno script `test`, nessun test su trigger/RPC/booking | Regressioni non intercettate | Media | Bassa | Script `test`; eventuali test DB solo per booking e buoni |
| T20 | P3 | Concorrenza booking senza lock | Doppia prenotazione stesso slot | Molto bassa (pochi utenti) | Media | Constraint di esclusione su intervallo, solo se il volume cresce |

## 49. Cosa NON vale la pena complicare oggi

- **Versionamento del catalogo pacchetti**: gli snapshot sulla sessione bastano per lo storico.
- **Integrazioni automatiche pagamenti (PayPal/Wise/Fineco) e riconciliazione bancaria**: ~180 movimenti l'anno si registrano a mano in pochi minuti.
- **Webhook MailerLite/Resend, tracking aperture e click**: nessuna decisione oggi ne dipende.
- **Attribuzione campagne con UTM, pixel, CAC/ROAS automatici**: prima serve registrare con costanza i lead con la fonte dichiarata; un foglio con la spesa mensile per canale basta.
- **Time tracking dettagliato**: un consuntivo grezzo per tipo di servizio, una volta, vale più di un modulo.
- **Multiutente, ruoli, MFA**: un solo utente.
- **Paginazione server-side e ottimizzazioni**: volumi di centinaia di righe.
- **Più analytics**: le quattro analisi esistenti coprono le domande principali; vanno alimentate, non moltiplicate.
- **Constraint di esclusione per la concorrenza delle prenotazioni**: probabilità trascurabile con il volume attuale.
- **Gestione stampe come magazzino/spedizioni**: le tre fasi stampe sono sufficienti.

## 50. Rischi operativi

| Rischio | Evidenza | Mitigazione minima |
|---|---|---|
| Lead non registrati | 0 lead [B] | Registrare ogni richiesta, anche brevemente, con fonte |
| Costi prodotti mancanti | 26/27 extra senza costo [B] | Completare il catalogo; costo sugli add-on |
| Consenso marketing | §37 | Correggere prima della prossima campagna di prenotazione |
| Prezzi non sincronizzati | Booking Natale 125/145 vs pacchetto 135 (+25 sabato) [B] | Allineare l'evento 2027 al catalogo pacchetti |
| Pacchetti non usati | 0 sessioni con pacchetto [B] | Applicare il pacchetto alle sessioni 2027 per avere ticket per pacchetto |
| Booking vs CRM | Email di conferma non automatica; slot liberi non considerano impegni esterni iCloud [A] | Bloccare a mano con eccezioni di disponibilità |
| Doppio conteggio | Provini Extra legacy come sessioni (2) [B] | Lasciarli, ma non crearne di nuovi: usare `session_extras` |
| Storico incompleto | 2025 importato a posteriori [B] | Indicare nei report da quando i dati sono completi |
| Dipendenza da inserimento manuale | Pagamenti, fasi, extra, lead tutti manuali | Accettabile: è un CRM monoutente |
| Duplicati anagrafici | 5 omonimie [B] | Verifica manuale una tantum |

## 51. Audit commerciale

| Domanda | Oggi si può sapere? |
|---|---|
| Quanti lead arrivano | **No**: strumento pronto, 0 dati |
| Quanti prenotano / conversion rate | **No** (stesso motivo) |
| Nuovi vs clienti esistenti | Sì per clienti serviti (Retention), no per richieste |
| Da dove arrivano | **No**: la fonte esiste solo sui lead |
| Perché vengono persi | **No** |
| Quali servizi vendono | **Sì**, affidabile (§39) |
| Valore medio | **Sì** per sessione e cliente |
| Extra | **Sì** su valore e upsell; **no** sul margine |
| Ritorno clienti | Sì, con storico che parte dal 2025 |
| Target annuale | Sì per il 2027 (piano); per il 2026 solo il budget legacy confrontato con la cassa |
| Target mensili | Sì per il 2027 |
| Capacità | Parziale: solo per l'evento online; nessuna capacità complessiva |
| Distribuzione servizi | Sì (piano + consuntivo per servizio) |

## 52. KPI affidabili vs non affidabili

| KPI | Affidabilità | Motivazione |
|---|---|---|
| Fatturato commerciale (valore) | **Alta** | Prezzo concordato + extra storici, riconciliato al centesimo; non è fatturato fiscale |
| Cassa | **Alta** in Economico, **Media** in Home | Economico esclude i riscatti per categoria; Home per nome e nel fuso del server |
| Lead | **Non misurabile** | 0 lead registrati |
| Conversion rate | **Non misurabile** | Nessun lead |
| Retention | **Media** | Formula solida e testata; storico limitato al 2025, importato a posteriori |
| Ticket medio | **Alta** (per servizio) / **Media** (globale) | Il globale include 2 sessioni Provini Extra |
| Extra (valore) | **Alta** | `line_total_cents` storico |
| Upsell rate | **Media** | Denominatore con legacy; "con extra" = valore > 0 |
| Costo diretto | **Bassa** | 1 riga su 27 con costo |
| Margine diretto | **Bassa** | Sovrastimato dai costi mancanti |
| CAC | **Non misurabile** | Nessuna spesa marketing tracciata |
| ROAS | **Non misurabile** | Nessuna spesa né attribuzione |

## 53. Repository vs database live

| Aspetto | Esito |
|---|---|
| Migrazioni presenti ma non applicate | **Nessuna rilevata**: tutte le tabelle e colonne delle 40 migrazioni esistono live [A, B]. Il 16/10 mancava `planned_base_ticket_cents` (errore Economico); oggi è presente |
| Colonne live mancanti nel repository | Nessuna [B] |
| Tabelle live non nel repository | Nessuna (28 = 28) [B] |
| RLS `audit_log` | **Drift probabile**: il repository non abilita RLS; live la chiave anonima riceve 0 righe su 3.020 senza errore, comportamento tipico di RLS attiva senza policy [B, E]. Da codificare in una migrazione |
| Corpi funzioni e trigger | **Non verificabili** senza accesso a `pg_catalog`; si assume corrispondenza [E]. Indizi coerenti: 0 incoerenze date pagamenti, 0 sovrapagamenti, riscatti coerenti [B] |
| RPC | Esposte live solo `apply_session_package` e `save_economic_plan`, come nel repository [B] |
| Dati di seed | Fasi stampe, supplementi sabato, piano 2027 con distribuzione (Battesimo escluso) e tier provini: tutti presenti con i valori delle migrazioni [B] |
| Configurazioni non rappresentate nel repository | Fase custom "Guida Inviata" (`guida_inviata_mtct09vd`), fasi legacy inattive "Caparra Ricevuta" e "Saldo Ricevuto", metodo "Fineco", 20 pacchetti, 9 inclusioni, 9 prodotti, evento Natale 2026: dati di configurazione inseriti da UI (normale) [B] |
| Variabili d'ambiente | In locale mancano Resend, MailerLite, Turnstile e URL sito; lo stato MailerLite live (228 sincronizzati) prova che la sincronizzazione è stata eseguita da un ambiente con token [B, D] |
| Ambiente di produzione | Non verificato: non è dimostrato che il deploy usi questo stesso progetto Supabase [E] |

## 54. Problemi / bug concreti

| ID | Titolo | Area | Severità | Evidenza | Impatto | Come riprodurlo | Possibile soluzione |
|---|---|---|---|---|---|---|---|
| B01 | Consenso privacy preimpostato e usato come marketing | Privacy | **Critica** | `booking-widget.tsx` riga 106: `privacyConsent: true`, nessuna casella o informativa; `mailerlite/sync` instrada al gruppo marketing chi ha privacy attiva | Contatti iscritti alla newsletter senza consenso | Prenotare da `/prenota/[slug]`, poi sync MailerLite: il cliente va nel gruppo marketing | Informativa + casella privacy non preselezionata; consenso marketing separato |
| B02 | Aggiunta a gruppo MailerLite senza controllo consenso | Privacy | Alta | `app/api/mailerlite/add-to-group/route.ts` | Invio marketing a chi non ha consentito | Selezionare sessioni → "Aggiungi a gruppo" | Filtrare per consenso marketing |
| B03 | Conferma prenotazione promette email non inviata | Booking | Media | `booking-widget.tsx` riga 393; nessun invio nella route `book` | Aspettativa del cliente disattesa | Completare una prenotazione | Cambiare il testo o inviare l'email |
| B04 | Errori di inserimento extra/aggiornamento cliente ignorati nel booking | Booking | Media | `app/api/public/booking/[slug]/book/route.ts` | Prenotazione senza add-on scelti | Errore DB durante l'insert extra (non riprodotto) | Controllare l'errore e annullare |
| B05 | Gauge Home confronta cassa con target di valore | Home | Media | `dashboard/analytics/route.ts` (`total` dai pagamenti) vs `computeEconomicDashboard` (acquisito) | Due percentuali diverse dello stesso target | Con un piano dell'anno, confrontare Home ed Economico | Allineare la metrica o rinominare il gauge "Incassato vs target" |
| B06 | Add-on booking senza prodotto e costo | Extra | Media | Route `book`: `extra_product_id` e `unit_cost_cents` non valorizzati | Margine e copertura costi falsati | Prenotare con un add-on | Mappare gli add-on ai prodotti |
| B07 | Calendario Home ignora extra e prezzo zero | Home | Bassa | `app/api/dashboard/route.ts` stato calendario | Stato pagamento errato in calendario | Sessione con extra pagata solo per la base: appare saldata | Usare `calculateSessionDue` |
| B08 | Cassa Home esclusa per nome metodo | Home | Bassa | `payment_method_name !== "Buono regalo"`; snapshot non aggiornato su PATCH | Errore se si rinomina il metodo | Rinominare "Buono regalo" | Escludere per categoria |
| B09 | Fuso del server in Home e Calendly | Home, Calendly | Bassa | `new Date(year,0,1)`, `getMonth()`, `getDay()` | Pagamento del 31/12 sera nel mese/anno sbagliato su server UTC | Pagamento alle 23:30 del 31/12 | Helper Europe/Rome |
| B10 | Redirect post-login non validato | Sicurezza | Bassa | `login-form.tsx` riga 25 | Possibile open redirect | `/login?next=https://esempio.org` (da verificare a runtime) | Accettare solo percorsi che iniziano con `/` e non con `//` |
| B11 | Login senza limite tentativi | Sicurezza | Bassa | `app/api/login/route.ts` | Brute force del codice | Richieste ripetute | Rate limit |
| B12 | Lead `existing_client` accetta clienti archiviati | Lead | Bassa | `app/api/leads/route.ts` verifica solo l'esistenza; messaggio dice "attivo" | Incoerenza con la sessione manuale | Creare lead su cliente archiviato | Decidere la regola e allineare il messaggio |
| B13 | Invio provini può far regredire la fase | Email | Bassa | `app/api/sessions/[id]/emails/route.ts` | Pipeline indietro | Inviare i provini a una sessione consegnata | Cambio fase condizionato |
| B14 | Universo sessioni incoerente tra analisi | Analytics | Bassa | Retention esclude add-on/Provini Extra, Economico ed Extra no | Ticket medio/upsell leggermente distorti | Confrontare i conteggi sessioni 2025 | Escludere `is_addon` ovunque |
| B15 | "Sessioni con extra" diversa tra lista e analisi | Analytics | Informativa | Lista: esiste una riga; Analisi: valore > 0 | Solo con extra a valore zero (0 live) | — | Documentare; nessuna azione |
| B16 | `apply_session_package` non verifica pacchetto attivo | Pacchetti | Bassa | Corpo RPC [A] | Pacchetto disattivato applicabile se l'UI lo propone | Non riprodotto | Controllo nella RPC o nell'API |
| B17 | Export senza neutralizzazione formule | Sicurezza | Bassa | `components/shared/export-button.tsx` | CSV injection | Cliente con nome che inizia con `=` | Prefisso apostrofo |
| B18 | Piano 2027: Battesimo non distribuito, ticket Autunno sopra listino | Dati | Informativa | §25–26 [B] | Avvisi visibili in UI | Aprire Piano 2027 | Decisione di business |

### 54.1 Stato delle anomalie del 12/10

| # | Anomalia 12/10 | Stato 19/10 |
|---|---|---|
| 1 | Privacy booking usata come marketing; add-to-group senza consenso | **Aperta**, aggravata (B01, B02) |
| 2 | Trigger riscatto senza `quantity` | **Risolta** nel repository (usa `line_total_cents`) |
| 3 | Booking ignora errori extra e cliente | Aperta (B04) |
| 4 | Overlap e limiti senza protezione concorrente | Aperta (T20) |
| 5 | LTV cliente misto | Aperta |
| 6 | Calendario Home ignora extra e gratuite | Aperta (B07) |
| 7 | Snapshot nome metodo non aggiornato; filtro per nome | Aperta (B08) |
| 8 | Riduzione prezzo/eliminazione extra senza rivalidazione | Aperta (T12) |
| 9 | Import con orari sintetici e senza ID esterno | Aperta |
| 10 | Modifica evento ricrea add-on | Aperta |
| 11 | Limite totale conta annullate | Aperta (nessun limite totale configurato live) |
| 12 | Log email/cambio fase non controllati | Aperta (B13) |
| 13 | Pacchetti non versionati | **Cambiata**: snapshot su sessione; versioning non necessario |
| 14 | Fusi orari non Europe/Rome | **Parzialmente risolta**: nuove analisi corrette; Home e Calendly no (B09) |
| 15 | KPI ritardo azzerato dalla promozione lazy | Aperta |
| 16 | Liste/export senza range | Aperta (T18) |
| 17 | Filtro giorno post-paginazione; fasi custom fuori board | Aperta (T17) |
| 18 | DELETE invece di rimborso | Aperta (T13) |
| 19 | Riscatto senza verifica pagamento acquisto | Aperta (0 casi live; omaggi gestiti) |
| 20 | Login senza rate limit | Aperta (B11) |
| 21 | Prossima sessione cliente include annullate | Aperta |
| 22 | Match email booking con `ilike` senza escape | Aperta |
| — | Assenza lead, pacchetti senza prezzo, budget singleton | **Risolte** a livello di funzionalità; non ancora adottate nei dati |

## 55. Funzionalità implementate

| Funzionalità | Stato |
|---|---|
| Clienti | Completa |
| Lead | Completa nel perimetro (manca modifica generica/riapertura), non adottata |
| Conversione lead → sessione | Completa (compensazione, non transazione) |
| Sessioni | Completa |
| Pacchetti | Completa, non adottata |
| Inclusioni pacchetto | Completa, non adottata |
| Extra (catalogo + vendite) | Completa; costi parziali |
| Pagamenti | Completa (senza rimborsi) |
| Buoni | Completa (con omaggi) |
| Prenotazione pubblica | Parziale (non atomica, consenso, email) |
| Analisi Lead | Completa, senza dati |
| Analisi Extra & Upsell | Completa; margine poco affidabile |
| Retention | Completa |
| Economico (piano + dashboard) | Completa |
| Configurazione | Completa |
| Home | Completa, con incoerenza target/cassa |
| Email transazionali | Parziale (solo provini, manuale) |
| MailerLite | Parziale (consensi) |
| Calendly | Completa ma inutilizzata (0 import) |
| iCloud | Completa (best-effort) |
| "Provini Extra" come sessione | Legacy |
| `annual_budget_cents`, `suggested_price_cents`, `is_settled`, `voucher_overage_confirmed` | Legacy |

## 56. Flussi end-to-end

**A. Nuovo contatto → Lead → Cliente → Sessione → Extra → Pagamento**
1. `/leads`: nuovo lead `new_contact` (nome, contatto, servizio, fonte) → `to_handle`.
2. Azioni `info_sent` / `follow_up` / `lost`.
3. "Converti": ricerca cliente per email; se assente si crea il cliente; si crea la sessione (prezzo suggerito da pacchetto + sabato, modificabile), pacchetto via RPC; lead → `booked` con `client_id`, `session_id`, `converted_at`, `closed_at`.
4. Scheda sessione: extra dal catalogo (`line_total_cents` storico).
5. Pagamenti `deposit`/`balance`/`full_payment`, bloccati oltre il dovuto (prezzo + extra).

Nota: la prenotazione **online** non crea né collega lead.

**B. Cliente esistente → nuovo lead → nuova sessione**: lead `existing_client` con `client_id` obbligatorio (anche archiviato); conversione con quel cliente; più lead per cliente ammessi.

**C. Prenotazione pubblica → cliente → sessione → prezzo concordato**: slot → form → controllo Turnstile (se configurato) → cliente trovato per email (o creato) con privacy implicita → sessione `booked` con prezzo feriale/weekend dell'evento in `agreed_price_cents`, caparra richiesta in `deposit_cents` → add-on come `session_extras` → evento iCloud. Nessun pagamento, nessuna email.

**D. Pacchetto → snapshot sessione → snapshot inclusioni**: scelta pacchetto (creazione o scheda) → RPC: snapshot di nome, prezzo, durata, foto, descrizione + righe `session_package_inclusion_snapshots`; prezzo concordato modificato solo se inviato esplicitamente. Le inclusioni non diventano extra.

**E. Acquisto buono → cassa → riscatto → sessione**: `/vouchers` nuovo buono → pagamento `voucher_purchase` (cassa nella data di pagamento) → sulla sessione "Usa buono" → pagamento `voucher_redemption` = min(credito, residuo) con metodo Buono regalo → buono `redeemed`; il residuo della sessione scende, la cassa no.

**F. Piano economico → target → acquisito → cassa**: `/analisi/economico` → Piano: target annuale, mesi, servizi (sessioni × ticket), distribuzione, Extra attesi → RPC → Dashboard: acquisito (realizzato + futuro) vs target per anno, mese e servizio; incassato e residuo mostrati a parte. In Home lo stesso target è confrontato con la cassa.

## 57. Mappa source of truth

| Concetto | Source of truth (verificata) |
|---|---|
| Prezzo di listino pacchetto (oggi) | `session_packages.price_cents` |
| Prezzo di listino pacchetto applicato a una sessione | `sessions.package_price_cents_snapshot` |
| Prezzo reale della sessione | `sessions.agreed_price_cents` (include l'eventuale supplemento sabato) |
| Supplemento sabato (configurazione) | `service_types.saturday_surcharge_cents` (solo suggerimento) |
| Prezzo online | `booking_event_types.weekday_price_cents` / `weekend_price_cents` |
| Foto incluse correnti del pacchetto | `session_packages.included_photos` |
| Foto incluse della sessione | `sessions.included_photos`, altrimenti `package_included_photos_snapshot` |
| Inclusioni storiche | `session_package_inclusion_snapshots` |
| Valore storico di un extra venduto | `session_extras.line_total_cents` |
| Costo di un extra venduto | `session_extras.unit_cost_cents × quantity` |
| Valore commerciale sessione | `agreed_price_cents + Σ session_extras.line_total_cents` (`calculateSessionDue`) |
| Cassa | `payments` esclusi `applied_voucher_id` non null / categoria `voucher_redemption` (Economico); in Home per nome metodo |
| Copertura non monetaria | `payments` categoria `voucher_redemption` |
| Stato buono | `gift_vouchers.status` (scadenza riconciliata alla lettura) |
| Fase sessione | `sessions.current_stage_id`; storico in `session_stage_history` |
| Target annuale (Economico) | `annual_economic_plans.annual_target_cents` |
| Target annuale (Home) | Piano dell'anno, altrimenti `app_settings.annual_budget_cents` |
| Valore target servizio | `economic_plan_service_targets.target_value_cents` (calcolato nel DB) |
| Consenso privacy | `clients.privacy_consent_granted_at/revoked_at` (usato anche, impropriamente, come marketing) |
| Consenso immagini | `sessions.image_consent_granted_at/revoked_at` |
| Origine di una richiesta | `leads.source` (solo per i lead) |

## 58. Conclusioni

**A. Stato del CRM oggi.** Strumento operativo solido e coerente per una fotografa freelance, con un'architettura semplice (Next.js + Supabase, nessun backend separato) e definizioni economiche corrette. In una settimana ha acquisito gli strumenti commerciali che mancavano; manca ora l'uso costante di quegli strumenti.

**B. Cosa funziona bene.** Separazione valore/cassa e riconciliazione esatta; snapshot storici; RPC atomiche per pacchetti e piano; fuso Europe/Rome nelle nuove analisi; pipeline con fasi stampe; supplemento sabato come suggerimento senza doppi conteggi; test sulle formule chiave; schema live allineato al repository.

**C. Cosa è fragile.** Prenotazione pubblica (consenso, atomicità, email); definizione di "target raggiunto" diversa tra Home ed Economico; costi extra; flussi multi-step con compensazioni non controllate; nessun test su trigger e booking.

**D. Da sistemare prima di nuove funzionalità.** 1) Consensi privacy/marketing nel booking e in MailerLite. 2) Testo o invio della conferma di prenotazione. 3) Allineare il gauge Home alla definizione di target. 4) Controllare gli errori nel booking. 5) RLS `audit_log` in migrazione.

**E. Può restare così.** Codice condiviso di accesso; inserimento manuale dei pagamenti; snapshot invece di versioning; API senza paginazione; rate limit in memoria; assenza di rimborsi formali finché non servono.

**F. Top 5 priorità tecniche.**
1. Consenso privacy esplicito nel widget + consenso marketing separato (T1).
2. Atomicità e controllo errori del booking (T2).
3. Home: target vs metrica corretta, esclusione riscatti per categoria, fuso Europe/Rome (T4, T8, T9).
4. Add-on booking collegati a prodotti e costi (T5).
5. Migrazione RLS `audit_log` + validazione `next` e rate limit al login (T6, T7).

**G. Top 5 priorità operative/business.**
1. Registrare ogni richiesta come lead con fonte (base per conversione e canali).
2. Applicare i pacchetti alle nuove sessioni (ticket per pacchetto).
3. Completare i costi nel catalogo extra (margine).
4. Chiudere le incoerenze del piano 2027 (Battesimo, ticket Autunno) e creare un piano 2026 o accettare il budget legacy per l'anno in corso.
5. Allineare il prezzo dell'evento Natale 2027 al catalogo pacchetti e al supplemento sabato.

**H. Da non sviluppare ora.** Integrazioni bancarie e pagamenti online; attribuzione automatica Meta/UTM e calcolo CAC/ROAS; portale cliente; time tracking; previsioni; nuove dashboard; versionamento catalogo; multiutente.

## 59. Appendici

### A. Tabelle (28)

`app_settings`, `audit_log`, `annual_economic_plans`, `booking_addons`, `booking_availability_exceptions`, `booking_availability_rules`, `booking_event_types`, `calendly_event_type_map`, `clients`, `economic_plan_monthly_service_targets`, `economic_plan_monthly_targets`, `economic_plan_service_targets`, `email_templates`, `extra_product_price_tiers`, `extra_products`, `gift_vouchers`, `leads`, `payment_methods`, `payments`, `service_types`, `session_emails`, `session_extras`, `session_package_inclusion_snapshots`, `session_package_inclusions`, `session_packages`, `session_stage_history`, `session_stages`, `sessions`.

### B. Migrazioni (40)

`20260827000000_initial_crm_schema` · `20260827000100_extend_clients` · `20260827000200_extend_sessions` · `20260827000300_extend_payments` · `20260828000000_add_annual_budget` · `20260828000100_allow_partial_service_voucher_topup` · `20260828000200_service_vouchers_any_session_type` · `20260828000300_add_audit_log` · `20260831000000_add_session_extras` · `20260831000100_move_image_consent_to_sessions` · `20260831000200_optional_payment_timestamp` · `20260831000300_auto_settle_zero_price_sessions` · `20260903000000_allow_voucher_overage` · `20260903010000_add_mailerlite_sync` · `20260903020000_repair_voucher_overage` · `20260905000000_add_calendly_sync` · `20260905010000_add_calendly_mapping_price` · `20260905020000_split_calendly_mapping_price` · `20260907000000_add_icloud_calendar_sync` · `20260911000000_add_booking_engine` · `20260914000000_add_booking_form_configuration` · `20260921000000_apply_vouchers_to_remaining_balance` · `20260922000000_add_booking_visibility_window` · `20260925000000_remove_payment_received_stage` · `20260929000000_add_booking_addons` · `20260930000000_add_booking_addon_tooltip` · `20261008000000_add_packages_and_transactional_emails` · `20261010000000_sync_payment_dates` · `20261013000000_add_leads` · `20261013010000_add_lead_last_name` · `20261013020000_add_extra_products` · `20261013030000_packages_v2` · `20261014000000_add_annual_economic_plans` · `20261014010000_save_economic_plan_rpc` · `20261014020000_voucher_manual_expiry_and_complimentary` · `20261014030000_add_economic_plan_monthly_service_targets` · `20261014040000_add_planned_base_ticket` · `20261015000000_add_lead_contact_type` · `20261015010000_add_print_fulfillment_stages` · `20261015020000_add_service_saturday_surcharge`

### C. RPC

`apply_session_package`, `save_economic_plan` (esposte). Trigger: vedi §7.

### D. API (57 route)

`analytics/economic`, `analytics/extras`, `analytics/retention`, `audit-log`, `booking/event-types`, `booking/event-types/[id]`, `booking/event-types/[id]/slots`, `calendly/event-types`, `calendly/mappings`, `calendly/mappings/[id]`, `calendly/sync`, `clients`, `clients/[id]`, `clients/[id]/overview`, `clients/import`, `config`, `config/[entity]`, `config/[entity]/[id]`, `dashboard`, `dashboard/analytics`, `economic-plans`, `economic-plans/[year]`, `email-templates/[code]`, `extra-products`, `extra-products/[id]`, `leads`, `leads/[id]`, `leads/analytics`, `leads/client-match`, `login`, `logout`, `mailerlite/add-to-group`, `mailerlite/groups`, `mailerlite/sync`, `packages`, `packages/[id]`, `payments`, `payments/[id]`, `payments/options`, `public/booking/[slug]`, `public/booking/[slug]/book`, `search`, `sessions`, `sessions/[id]`, `sessions/[id]/eligible-vouchers`, `sessions/[id]/emails`, `sessions/[id]/extras`, `sessions/[id]/extras/[extraId]`, `sessions/[id]/payments`, `sessions/[id]/redeem`, `sessions/import`, `sessions/options`, `settings`, `vouchers`, `vouchers/[id]`, `vouchers/[id]/payments`, `vouchers/options` (tutte sotto `/api/`).

### E. Variabili d'ambiente (solo nomi)

`ACCESS_CODE`, `SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CALENDLY_API_TOKEN`, `ICLOUD_CALDAV_USERNAME`, `ICLOUD_CALDAV_APP_PASSWORD`, `ICLOUD_CALENDAR_NAME`, `MAILERLITE_API_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NODE_ENV`. Presenti in `.env.local`: le prime nove.

### F. Integrazioni

Supabase, MailerLite, Calendly, iCloud CalDAV, Resend, Cloudflare Turnstile (§34).

### G. Test

`tests/client-retention.test.mjs`, `tests/economic-plan-draft.test.mjs`, `tests/economic-plans.test.mjs`, `tests/leads.test.mjs`, `tests/sessions.test.mjs` (§44).

### H. Letture live eseguite (sola lettura)

Tutte via `@supabase/supabase-js` con `select` paginato a blocchi da 1.000 (nessun INSERT/UPDATE/DELETE/RPC):
1. `GET /rest/v1/` (OpenAPI): elenco tabelle, colonne, RPC esposte.
2. `select('*', { count: 'exact', head: true })` su ognuna delle 28 tabelle.
3. Con chiave **anonima**: `select('id').limit(1)` su `audit_log`, `clients`, `sessions`, `payments`, `leads`.
4. Lettura delle colonne necessarie di: `service_types`, `session_stages`, `sessions`, `session_extras`, `payments`, `payment_methods`, `gift_vouchers`, `clients` (solo per conteggi e duplicati, nessun dato stampato), `session_packages`, `session_package_inclusions`, `extra_products`, `extra_product_price_tiers`, `annual_economic_plans`, `economic_plan_*`, `booking_event_types`, `app_settings`; aggregazioni in memoria (anno Europe/Rome, servizio, categoria, metodo).

Nessun nominativo, contatto, nota o segreto è riportato in questo documento.
