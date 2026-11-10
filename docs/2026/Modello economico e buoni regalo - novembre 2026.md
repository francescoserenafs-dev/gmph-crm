# Modello economico e buoni regalo — novembre 2026

Documento di riferimento del modello economico del CRM dopo la revisione del 9–10 novembre 2026.
Per costi pagati, ricorrenze e marginalita, vedere anche [Gestione costi e marginalita.md](Gestione%20costi%20e%20marginalita.md).
Sostituisce, **per questi temi**, le sezioni §20, §21, §24–§30 e §57 dell'audit storico del 19/10/2026 (`Audit Ottobre 2026/CRM_GMPH_COMPLETE_AUDIT_19102026.md`), che resta invariato come fotografia di quella data.

> I valori del CRM sono indicatori gestionali e non sostituiscono la contabilità fiscale.

## 1. Due viste parallele, mai sommate

| Vista | Domanda | Data di riferimento |
|---|---|---|
| **Valore servizi** | Quanto lavoro fotografico ho pianificato / acquisito / svolto? | Data della **sessione** (Europe/Rome) |
| **Cassa** | Quanto denaro è entrato davvero? | Data del **pagamento** (Europe/Rome) |

Un buono regalo genera **cassa** quando viene venduto e **copertura della sessione** quando viene usato, anche in un anno diverso. Sommare valore servizi e vendite buoni in un "fatturato" conterebbe due volte lo stesso buono: il CRM non lo fa e non mostra alcun "fatturato".

Per questo è normale che un anno abbia:

- **più cassa che valore servizi**, se sono stati venduti molti buoni (2025: cassa 8.967 € contro un valore servizi di 7.987 €, con 1.030 € di buoni venduti);
- **più valore servizi che nuova cassa**, se sono stati riscattati buoni venduti negli anni precedenti (2026: 1.030 € di riscatti pregressi, cioè i buoni venduti nel 2025).

## 2. Definizioni

| Termine (UI) | Definizione | Formula |
|---|---|---|
| **Valore servizi** di una sessione | Quanto vale il lavoro, indipendentemente da come è pagato | `agreed_price_cents + Σ session_extras.line_total_cents` |
| **Valore servizi erogati** | Sessioni dell'anno con data ≤ ora | Σ valore sessioni passate |
| **Valore servizi futuri** | Sessioni dell'anno con data > ora | Σ valore sessioni future prenotate |
| **Valore servizi acquisiti** | Erogati + futuri | |
| **Valore servizi pianificato** | Dal Piano Economico | Σ servizi (Σ sessioni dei 12 mesi × ticket medio pianificato) |
| **Copertura del piano** | | Valore servizi acquisiti / valore servizi pianificato (mai la cassa) |
| **Cassa** | Denaro ricevuto | Σ pagamenti dell'anno **esclusi i riscatti** |
| **Cassa da sessioni** | Caparre, saldi, pagamenti completi | Pagamenti di cassa con categoria diversa da `voucher_purchase` |
| **Vendite buoni** | Cassa da acquisto buoni | Pagamenti `voucher_purchase` |
| **Riscatti buoni** | Credito di buoni applicato alle sessioni dell'anno: non è denaro | Σ `payments.amount_cents` dei riscatti |
| **Riscatti buoni pregressi** | Riscatti di buoni incassati in un anno precedente a quello della sessione | Riscatti classificati `prior_year` |
| **Riscatti buoni omaggio** | Riscatti di buoni `is_complimentary` (mai incassati) | Riscatti classificati `complimentary` |
| **Residuo da incassare** | Parte del valore non coperta né da denaro né da buoni | Σ max(valore − pagamenti di cassa − riscatti, 0) |
| **Buoni attivi da erogare** | Credito nominale dei buoni attivi, omaggi inclusi. Indicatore operativo, non debito contabile | Σ credito dei buoni con stato `active` |

Un pagamento è un **riscatto** se `category = 'voucher_redemption'` oppure `applied_voucher_id` non è nullo (`isVoucherRedemption`). **Il nome del metodo di pagamento non è mai usato.** Tutto il resto è cassa (`isCashPayment`). È l'unica definizione di cassa nell'app: Home e Analisi → Economico usano gli stessi helper e lo stesso caricamento dati.

Importi sempre in centesimi interi; nessun calcolo in virgola mobile.

## 3. Buoni regalo

### Vendita
Il pagamento `voucher_purchase` è **cassa** alla sua data (`paid_date`). I buoni omaggio non hanno pagamenti di acquisto e non sono mai vendite.

### Riscatto
Il pagamento `voucher_redemption` (con `applied_voucher_id`) è **copertura non monetaria** della sessione: riduce il residuo, non aumenta la cassa. Il riscatto appartiene sempre al **servizio reale** della sessione (es. Famiglia): i buoni non sono un tipo di servizio.

**Importo**: si usa solo `payments.amount_cents` del riscatto, cioè quanto è stato effettivamente applicato, mai il valore nominale del buono. Il credito non utilizzato (`voucher_unused_cents`) non compare né come valore servizi né come cassa.

La logica di riscatto (applicazione al residuo della sessione, trigger DB) **non è stata modificata**.

### Classificazione dei riscatti (`classifyVoucherRedemption`)

L'anno di incasso del buono è dato dalle date (`paid_date`, in subordine `paid_at` convertito in Europe/Rome) dei suoi pagamenti `voucher_purchase`, non da `gift_vouchers.created_at`. Si confronta con la data della sessione coperta:

| Classe | Condizione |
|---|---|
| `complimentary` | Buono omaggio |
| `prior_year` | Tutti i pagamenti di acquisto sono in anni precedenti all'anno della sessione |
| `same_year` | Tutti i pagamenti di acquisto sono nello stesso anno della sessione (e non dopo la sessione) |
| `unknown` | Riscatto senza buono, buono non omaggio senza pagamenti di acquisto, data di acquisto mancante o successiva alla sessione, pagamenti di acquisto a cavallo di più anni |

I casi `unknown` restano inclusi nel totale riscatti, sono segnalati in Analisi → Economico ("riscatti non classificati") e **non vengono corretti automaticamente**.

Esempio: buono venduto il 20/12/2025 per 200 € e riscattato su una sessione Famiglia del 15/09/2026 da 200 €.
- 2025: cassa +200 € (vendita buono).
- 2026: valore servizi erogati +200 €, riscatti +200 €, di cui pregressi 200 €, nuova cassa 0 €.

## 4. Sessioni legacy "servizio aggiuntivo"

Le sessioni con un servizio `is_addon = true` (es. le 2 sessioni storiche "Provini Extra" del 2026, 128 €) **non contano** come sessioni, né nel valore servizi, nel ticket medio o nella copertura del piano. Il loro valore resta visibile nel riquadro "Copertura del valore servizi" ("di cui sessioni legacy"), così la riconciliazione torna al centesimo. Nessun dato storico è stato modificato. I nuovi extra continuano a usare `session_extras`.

## 5. Piano Economico (stato corrente)

Invariato rispetto alla revisione del 9/11/2026 (migrazione `20261109000000_economic_plan_single_source_of_truth`):

- la **distribuzione mensile delle sessioni** è l'unica fonte delle quantità;
- per servizio si salva solo il **ticket medio pianificato** (extra inclusi);
- sessioni annuali, valore per servizio, valore mensile e valore annuale sono **sempre calcolati** (`computePlanTotals`);
- **non esistono** target annuale manuale, 12 target economici mensili, "Extra attesi" o sessioni target indipendenti;
- il Piano 2027 storico (15.000 € / 81 sessioni ecc.) **non è stato ricreato**; i dati inseriti dopo il reset sono preservati.

Etichetta unica in tutta l'app: **Valore servizi pianificato** (non "fatturato").

### Vendite buoni regalo previste (nuovo, facoltativo)

Sezione separata del Piano:

- **Ticket medio buono** (modificabile) → `annual_economic_plans.planned_voucher_ticket_cents`;
- **Numero di buoni previsti per mese** (12 interi ≥ 0) → `economic_plan_monthly_voucher_targets`.

Calcolati (`computeVoucherPlanTotals`): valore mese = buoni × ticket medio buono; valore anno = Σ mesi = buoni totali × ticket.

Le vendite buoni previste **non si sommano** al valore servizi pianificato: sono mostrate affiancate, con tooltip. Non esiste una "cassa prevista": servirebbe un modello esplicito dei tempi di pagamento delle sessioni, che il CRM non ha.

### Salvataggio
Un'unica RPC atomica `save_economic_plan(p_year, p_create, p_notes, p_services, p_service_months, p_voucher_ticket_cents, p_voucher_months)`: note, servizi, distribuzione sessioni e piano buoni vengono salvati insieme oppure non viene salvato nulla.

## 6. Analisi → Economico

**Piano e servizi** (data sessione):
- KPI: valore servizi pianificato, acquisiti, copertura del piano, da generare, erogati, futuri, sessioni, ticket medio sessione;
- tabella "Performance servizi per mese": sessioni pianificate/acquisite, valore pianificato, erogati, futuri, acquisiti, scostamento, copertura;
- tabella "Servizi: piano vs acquisiti" (servizi fuori piano marcati);
- riquadro "Copertura del valore servizi": copertura monetaria registrata + copertura tramite buoni + residuo = valore da coprire;
- riquadro "Base vs extra".

**Cassa e buoni** (data pagamento):
- KPI: cassa anno, cassa da sessioni, vendite buoni, vendite buoni previste, riscatti, riscatti pregressi, riscatti omaggio, buoni attivi da erogare;
- avviso per eventuali riscatti non classificati;
- tabella "Cassa e buoni per mese": cassa da sessioni, vendite buoni, cassa totale (= sessioni + vendite, mai riscatti), riscatti, di cui pregressi, di cui omaggio, vendite buoni previste.

**Scelta delle date per i riscatti.** I KPI annuali dei riscatti si riferiscono alle **sessioni dell'anno** (copertura del lavoro svolto). La tabella mensile di cassa mostra i riscatti per **data di registrazione** del riscatto, come tutti i movimenti di quella tabella. Nessuna colonna mescola i due criteri; i totali possono differire di poco se un riscatto viene registrato in un mese o anno diverso da quello della sessione.

La nuova sezione Costi e risultati dell'Economico riusa `loadCostAnalytics` e `computeCostAnalytics`, come `/costs`. Legge i costi diretti storici da extra e inclusioni del pacchetto, senza ricostruirli dal catalogo. Spese operative e imposte sono separate, IVA inclusa, per data di pagamento; risultato operativo e finale usano il valore dei soli servizi erogati. Il saldo di cassa sottrae solo le uscite registrate, non nuovamente i costi diretti. Un costo storico mancante rende il margine parziale. Home e Piano restano invariati.

## 7. Home

- Gauge **"Valore servizi vs piano"**: valore servizi acquisiti dell'anno corrente (Europe/Rome) / valore servizi pianificato. Non usa mai la cassa.
- Senza Piano per l'anno: il gauge non viene mostrato. Compaiono il valore servizi acquisiti e un link al Piano. **Nessun ripiego** sul budget legacy.
- **Cassa** (con periodo) e **Analisi cassa** (per mese, origine, metodo): stessa definizione dell'Economico, filtro per categoria, date `paid_date` Europe/Rome (niente `getMonth()` o `new Date(year, …)` lato server).
- Calendario e prossime sessioni: stato pagamento calcolato con `calculateSessionDue` (prezzo + extra); una sessione coperta da un buono risulta saldata anche senza nuova cassa.
- Buoni: "Emessi" (comprende gli omaggi), attivi, riscattati, scaduti, in scadenza, valore attivo. Il dettaglio di vendite e riscatti è in Analisi → Economico.

## 8. Altre schermate

- **Scheda buono**: valore nominale, prezzo, incassato, anno di incasso (dai pagamenti di acquisto), data di acquisto, scadenza, stato, omaggio; sezione **Riscatto** con sessione, data, importo applicato e credito non utilizzato.
- **Pagamenti / Cliente / Sessione**: la categoria `voucher_purchase` è mostrata come "Vendita buono regalo" (prima "Pagamento completo").
- **Sessioni**: "Incassato" rinominato in "Pagato (denaro + buoni)" / "Coperto (denaro + buoni)", perché include i riscatti.
- **Configurazione**: rimosso il campo "Budget anno corrente".

## 9. `app_settings.annual_budget_cents` (legacy)

Non è più letto né scritto dall'app (Home, Configurazione, API). La colonna **resta nel database** e non viene eliminata; la migrazione `20261110000000` la marca come legacy tramite un commento. Il riferimento annuale è il valore servizi pianificato del Piano Economico.

## 10. Mappa delle fonti di verità

| Concetto | Fonte |
|---|---|
| Prezzo reale sessione | `sessions.agreed_price_cents` |
| Extra storico | `session_extras.line_total_cents` |
| Valore servizi | prezzo + extra (`calculateSessionCommercialValue`, `calculateSessionDue`) |
| Cassa | `payments` esclusi i riscatti (`isCashPayment`), per `paid_date` |
| Vendita buono | `payments.category = 'voucher_purchase'` |
| Riscatto buono | `payments.category = 'voucher_redemption'` / `applied_voucher_id` |
| Importo riscattato | `payments.amount_cents` del riscatto |
| Credito non utilizzato | `payments.voucher_unused_cents` (solo informativo) |
| Origine temporale del buono | `paid_date` / `paid_at` dei pagamenti `voucher_purchase` |
| Buono omaggio | `gift_vouchers.is_complimentary` |
| Piano sessioni | `economic_plan_monthly_service_targets` |
| Ticket pianificato servizio | `economic_plan_service_targets.planned_ticket_cents` |
| Valore servizi pianificato | quantità × ticket (calcolato) |
| Ticket medio buono pianificato | `annual_economic_plans.planned_voucher_ticket_cents` |
| Buoni previsti per mese | `economic_plan_monthly_voucher_targets.target_count` |
| Vendite buoni previste | quantità mensile × ticket medio buono (calcolato) |
| Date e mesi | Europe/Rome (`romeDateKey`, `paymentDateKey`, `lib/datetime.ts`) |
| Costi pagati | `expenses.net_amount_cents + expenses.vat_amount_cents`, per `paid_date` |
| Classificazione storica costi | Snapshot di categoria/tipo/marketing e metodo su `expenses` |
| Ricorrenze | `recurring_expense_rules`, cursore `processed_through` e coppia univoca regola/occorrenza |
| Costi diretti storici | `session_extras.unit_cost_cents` e `session_package_inclusion_snapshots.unit_cost_cents_snapshot`, per quantita |
| Margini e risultati | `computeCostAnalytics` in `lib/expenses.ts`, nessuna allocazione delle spese generali ai servizi |

## 11. Codice

| File | Ruolo |
|---|---|
| `lib/economic-plans.ts` | Helper puri e testati: `isVoucherRedemption`, `isCashPayment`, `calculateSessionCommercialValue`, `calculateSessionCoverage`, `voucherCreditCents`, `classifyVoucherRedemption`, `paymentDateKey`, `romeDateKey`, `computePlanTotals`, `computeVoucherPlanTotals`, `computeEconomicDashboard` e i tipi `EconomicServiceSummary`, `EconomicCashSummary`, `VoucherRedemptionSummary`, `MonthlyServicePerformance`, `MonthlyCashPerformance` |
| `lib/economic-plans-server.ts` | Caricamento dati (`loadEconomicDataset`: sessioni per data sessione, pagamenti per `paid_date`, buoni con pagamenti di acquisto), parser e salvataggio atomico del Piano, `getPlannedServiceValueForYear` |
| `app/api/analytics/economic` | Dashboard Economico |
| `app/api/dashboard`, `app/api/dashboard/analytics` | Home (stessi helper e loader) |
| `lib/expenses.ts`, `lib/expenses-server.ts` | Calcoli e validazioni costi, RPC ricorrenze, analisi condivisa con il dataset economico |
| `components/costs/cost-analysis.tsx` | Unico componente per il riepilogo in Costi ed Economico |

Volumi piccoli: query dirette e paginate a blocchi da 1.000, nessuna cache né vista materializzata.

## 12. Migrazioni

| Migrazione | Scopo |
|---|---|
| `20261109000000_economic_plan_single_source_of_truth` | (9/11) Piano con unica fonte di verità; reset del Piano 2027 |
| `20261110000000_economic_plan_voucher_sales` | Additiva: `planned_voucher_ticket_cents`, tabella `economic_plan_monthly_voucher_targets` (mese 1–12, `target_count ≥ 0`, unique per piano/mese, trigger audit e `updated_at`, RLS), RPC `save_economic_plan` estesa al piano buoni, commento legacy su `annual_budget_cents`. Nessun dato esistente modificato o pre-compilato |

> **Ordine di rilascio:** applicare `20261110000000` **prima** di pubblicare il codice. Senza la nuova colonna e la nuova tabella il caricamento del Piano fallisce, e con esso Analisi → Economico e il gauge della Home.

La gestione costi richiede inoltre `20261110102946_expense_management.sql`: nuove tabelle `expense_categories`, `expenses`, `recurring_expense_rules`, snapshot, RLS, audit e RPC atomiche. Nessun backfill o modifica di dati precedenti. Non e stata applicata al database live durante l'implementazione. Senza questa migrazione, Costi restituisce un errore esplicito; l'Economico mantiene disponibili le sezioni precedenti e segnala l'assenza dell'analisi costi.

## 13. Test

`npm test` (= `node --test tests/*.test.mjs`). In `tests/economic-plans.test.mjs`:

- A sessione normale · B buono anno precedente · C buono stesso anno (200 € di cassa e 200 € di valore, mai 400 €) · D buono + integrazione · E buono omaggio · F credito inutilizzato · G sessione futura · H confine d'anno 31/12 23:30 Europe/Rome · I Home = Economico (valore acquisiti e cassa) · J piano servizi 15 sessioni / 3.600 € · K piano buoni 8 / 1.200 €, separato dai servizi;
- classificazione dei riscatti e dati anomali (riscatto senza buono, buono senza acquisto, data mancante, acquisto dopo la sessione, pagamenti a cavallo d'anno);
- riconciliazione al centesimo (valore = denaro + buoni + residuo), compreso il caso con extra pagati su una sessione coperta da buono;
- cassa = Σ pagamenti di cassa (vendite buoni incluse, riscatti esclusi per categoria anche se il metodo è rinominato);
- sessioni legacy add-on escluse dai conteggi ma riconciliabili;
- gauge Home solo contro il Piano, senza ripiego legacy;
- loader (confini Europe/Rome, flag add-on, date di acquisto dei buoni) e parser del Piano (solo dati canonici).

## 14. Verifica sui dati storici (sola lettura, 10/11/2026)

| | 2025 | 2026 | 2027 |
|---|---:|---:|---:|
| Valore servizi acquisiti | 7.987 € | 8.290 € (erogati 4.425, futuri 3.865) | 0 € |
| Sessioni (escluse legacy) | 56 | 29 + 26 | 0 |
| Sessioni legacy add-on | 0 | 2 (128 €) | 0 |
| Cassa | 8.967 € | 5.176 € | 0 € |
| di cui vendite buoni | 1.030 € (7) | 1.630 € (10) | 0 € |
| Riscatti buoni | 0 € | 1.805 € | 0 € |
| di cui pregressi | — | 1.030 € | — |
| di cui stesso anno | — | 775 € | — |
| Non classificati | 0 | 0 | 0 |
| Riconciliazione valore = denaro + buoni + residuo | scarto 0 | scarto 0 | scarto 0 |

Buoni attivi da erogare a oggi: 1.000 € (8 buoni). Nessun dato storico è stato modificato.
