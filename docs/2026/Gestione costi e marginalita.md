# Gestione costi e marginalita

## Ambito

Gestione operativa di costi pagati e marginalita, non contabilita fiscale.
Accesso da Gestione > Costi (`/costs`), anche dal menu Altro mobile.
Le sezioni sono Movimenti, Ricorrenze e Categorie. Home e Piano Economico non acquisiscono nuovi budget o campi.

La sezione Costi e risultati di Analisi > Economico usa lo stesso caricamento, lo stesso calcolo e lo stesso componente della pagina Costi. I filtri categoria, metodo, mese e testo agiscono sull'elenco; il riepilogo resta annuale. La dicitura "Totale elenco" distingue il totale filtrato dai KPI annuali.

## Fonti e formule

Tutti gli importi sono centesimi interi. Per un movimento si salvano solo imponibile e IVA effettiva; il totale e sempre derivato, mai modificabile indipendentemente.

| Voce | Fonte o formula |
|---|---|
| Valore servizio | `sessions.agreed_price_cents + somma(session_extras.line_total_cents)` |
| Cassa incassata | Pagamenti monetari, comprese vendite buoni, esclusi riscatti per categoria o `applied_voucher_id`; helper `isCashPayment` |
| Costo diretto extra | `session_extras.quantity * session_extras.unit_cost_cents` |
| Costo diretto inclusioni | `session_package_inclusion_snapshots.quantity * unit_cost_cents_snapshot` |
| Totale movimento | `net_amount_cents + vat_amount_cents` |
| Costi operativi | Totali pagati dei movimenti con tipo storico `operating` |
| Imposte e contributi | Totali pagati dei movimenti con tipo storico `tax_contribution` |
| Costi gestionali totali | Operativi + imposte e contributi + costi diretti noti delle sessioni svolte |
| Margine diretto | Valore servizi erogati - costi diretti noti |
| Risultato operativo | Margine diretto - costi operativi pagati |
| Risultato finale gestionale | Risultato operativo - imposte e contributi registrati |
| Uscite pagate | Costi operativi + imposte e contributi, senza aggiungere i costi diretti |
| Saldo gestionale di cassa | Cassa incassata - uscite pagate; non sottrae nuovamente i costi diretti |
| Risultato campagna | Valore erogato del servizio nell'anno campagna - costi diretti noti - marketing attribuito a servizio/anno |
| Percentuale margine | Margine / valore servizio; non disponibile se il valore e zero |

L'IVA resta interamente compresa nei costi. Il KPI IVA registrata e informativo e non viene sommato o sottratto nuovamente. Il pulsante di calcolo IVA nel modulo e solo un aiuto: l'importo effettivo resta modificabile. Nessuna ipotesi su detraibilita o deducibilita.

I costi generali non sono ripartiti tra i servizi. I costi diretti non generano movimenti in `expenses`: non esiste un campo costo manuale nella sessione. Non vengono letti i costi correnti del catalogo per ricostruire il passato.

## Date e copertura

- Servizi e costi diretti: data della sessione in Europe/Rome. Sessione svolta se `scheduled_at <= now`, come nell'Economico esistente, non in base allo stato di consegna.
- Sessioni annullate e servizi aggiuntivi legacy sono esclusi da valore e marginalita, in coerenza con il modello economico corrente.
- Sessioni future: valore, costo noto, margine e copertura separati; non entrano nel risultato operativo.
- Costi generali, imposte e IVA: `paid_date`, obbligatoria e non futura. Un abbonamento annuale pagato a gennaio pesa interamente a gennaio; nessun rateo.
- Cassa: `paid_date`, con lo stesso fallback Rome a `paid_at` dei loader economici.
- Anni ammessi: 2000-2100.

Un costo storico `null` e sconosciuto. Un costo esplicitamente zero e noto. La copertura conta le righe extra/inclusioni con quantita positiva, non le singole unita. Se manca almeno un costo, margine e risultati sono marcati parziali e sottraggono solo la quota nota. Non viene imputato alcun costo ai dati storici mancanti.

I risultati gestionali usano deliberatamente basi temporali miste (sessione e pagamento) e non rappresentano utile contabile o fiscale.

## Modello dati

Migrazione additiva: [../../supabase/migrations/20261110102946_expense_management.sql](../../supabase/migrations/20261110102946_expense_management.sql).

### expense_categories

Nome, tipo `operating` / `tax_contribution`, flag stabile `is_marketing`, ordine e stato attivo. Nome univoco senza distinzione maiuscole/minuscole. Tipo e flag marketing non sono modificabili dopo la creazione: una rinomina non deve riclassificare il passato. Nessuna API di cancellazione.

Categorie iniziali:

1. Software e abbonamenti.
2. Sito, dominio e hosting.
3. Commercialista e assicurazioni.
4. Marketing e pubblicita (unica categoria con flag marketing).
5. Materiali, packaging e cancelleria.
6. Attrezzatura e acquisti.
7. Altro.
8. Imposte e contributi.

### expenses

Descrizione, categoria, fornitore facoltativo, data pagamento, imponibile, IVA, metodo, note, eventuale servizio/anno marketing. Conserva snapshot di nome/tipo/flag marketing della categoria, nome metodo e nome servizio marketing. Gli snapshot sono impostati dal trigger DB e non accettati dalle API.

Una correzione che mantiene gli stessi riferimenti conserva gli snapshot. Cambiando esplicitamente categoria, metodo o servizio, il relativo snapshot viene aggiornato. Un riferimento disattivato puo restare su una correzione storica, ma non essere scelto per un nuovo movimento.

Per i movimenti generati: `recurring_rule_id` e `recurring_occurrence_date`, entrambi valorizzati o entrambi nulli, coppia univoca e immutabile. Correggere un movimento generato non modifica la regola.

### recurring_expense_rules

Campi economici del movimento, frequenza `monthly` / `quarterly` / `yearly`, inizio, fine facoltativa, stato e cursore persistente `processed_through`. Non esiste un importo annuale o un budget separato.

### Vincoli, permessi e audit

- Centesimi interi non negativi; totale positivo e massimo 1.000.000.000 centesimi (10.000.000 EUR).
- Descrizione 1-200 caratteri, fornitore massimo 200, note massimo 2000.
- Solo metodi non di sistema: i buoni regalo non pagano i costi.
- Marketing attribuibile solo dalla categoria marketing, con coppia servizio non aggiuntivo + anno valida.
- RLS sulle tre nuove tabelle; accesso e RPC concessi al solo `service_role`, revocati a `public`, `anon`, `authenticated`. Le API sono protette dal proxy di autenticazione esistente.
- Stesso `audit_log` e stesso trigger `record_audit_log` del CRM, non un secondo registro. Creazioni, modifiche, cancellazioni e avanzamento del cursore restano tracciati. Anche la cronologia delle righe eliminate resta nel registro.
- Indici su data, categoria, metodo, attribuzione marketing e coppia ricorrenza/occorrenza. Letture paginate in blocchi da 1000 con ordine stabile; elenco UI in pagine da 50.

## Ricorrenze

`materialize_due_recurring_expenses` materializza solo scadenze <= oggi in Europe/Rome. Viene chiamata dalle letture di movimenti, ricorrenze e analisi costi (anche nell'Economico), senza cron, code o worker.

Ogni regola viene bloccata con `FOR UPDATE`; inserimenti e avanzamento del cursore avvengono nella stessa transazione. La coppia univoca regola/occorrenza protegge da duplicati. Richieste ripetute non creano nuovi movimenti per la stessa scadenza.

Le date sono sempre calcolate dalla data iniziale: 31 gennaio -> ultimo giorno di febbraio -> 31 marzo, senza deriva al giorno 28. La fine e inclusiva. Nessuna scadenza futura diventa un movimento pagato.

`save_recurring_expense_rule`:

1. In creazione, se l'inizio e arretrato e ci sono scadenze maturate, restituisce la conferma richiesta con il numero esatto. Senza conferma non salva neppure la regola.
2. Con conferma valida salva regola e movimenti in modo atomico.
3. In modifica, consolida prima le scadenze gia maturate con i vecchi valori e poi aggiorna la regola. Solo le date future usano i nuovi valori.
4. Se la modifica fallisce, anche gli eventuali inserimenti maturati e il cursore vengono annullati.
5. Disattivare non elimina lo storico. Riattivare riparte dalle scadenze future: non recupera il periodo di pausa.

Eliminare una singola occorrenza non la fa ricomparire alla lettura successiva: il cursore rimane avanzato. La regola resta attiva, salvo disattivazione esplicita. Una categoria/metodo disattivati non annullano automaticamente regole gia autorizzate; per interromperle occorre disattivare la regola.

Le date opzionali delle RPC consentono i test isolati del ciclo storico; le API non inoltrano date di sistema dal client. Il DB rifiuta materializzazioni future.

## Marketing e campagne

Nessuna tabella campagna separata. Il collegamento e `marketing_service_type_id + marketing_campaign_year`, facoltativo e disponibile solo per marketing.

Marketing generico: entra esclusivamente nei costi operativi dell'anno di pagamento. Marketing attribuito: entra anche nel risultato del servizio/anno indicato, senza ripartire altre spese.

Un pagamento del 2026 per la campagna Natale 2027 entra nei costi operativi 2026 e nel risultato campagna 2027. Il loader legge sia i movimenti dell'anno pagato sia quelli attribuiti all'anno campagna, deduplicando per ID; non raddoppia i costi quando gli anni coincidono.

## API

| Endpoint | Operazioni |
|---|---|
| `/api/expenses?year=...` | GET movimenti e opzioni; POST nuovo costo |
| `/api/expenses/[id]` | PATCH correzione; DELETE cancellazione |
| `/api/expense-categories` | GET categorie; POST nuova categoria |
| `/api/expense-categories/[id]` | PATCH nome, ordine e stato; nessuna cancellazione |
| `/api/recurring-expenses` | GET regole e materializzazione; POST regola atomica |
| `/api/recurring-expenses/[id]` | PATCH modifica/stato; DELETE equivale a disattivazione, non distruzione |
| `/api/analytics/costs?year=...` | GET analisi condivisa |
| `/api/analytics/economic?year=...` | Include `costs` e `costsError`, riusando il dataset economico gia caricato |
| `/api/audit-log` | Esteso alle tre nuove tabelle |

Conferma arretrati: HTTP 409 con `confirmationCount`; il client ripete il POST solo dopo conferma esplicita. Validazione 400, elemento assente 404, conflitto 409, migrazione non disponibile 503. Nessun errore DB viene trasformato in costi zero. In Economico un errore della nuova sezione non nasconde i dati economici precedenti.

## Interfaccia e accessibilita

Elenco con data, descrizione, categoria, fornitore, imponibile, IVA, totale, metodo, origine, campagna e note. Azioni modifica/cancellazione a destra, conferma distruttiva, stato di salvataggio, errori e cronologia. Filtri anno, mese, categoria, metodo e ricerca per descrizione/fornitore/note.

Modale condiviso basato su `dialog`: focus confinato, ripristino del focus, chiusura Escape e blocco durante il salvataggio. I tooltip restano entro i bordi disponibili e Escape chiude prima il tooltip. Tab di Costi accessibili con frecce, Home/End; tabelle scorrevoli da tastiera; controlli nominati e icone Lucide.

Analisi annuale: KPI, copertura, separazione futuri, grafico uscite a 12 mesi, dettaglio mensile, categorie con incidenza operativa, margini per servizio e redditivita campagne. Nessuna allocazione automatica delle spese generali.

## Rilascio e storico

**La migrazione non e stata applicata al database live durante l'implementazione.**

Applicare la nuova migrazione una sola volta, dopo le migrazioni prerequisite del CRM, prima di abilitare l'uso operativo dei costi. Non eseguire reset o riapplicazioni delle vecchie migrazioni. Questa migrazione crea solo nuove strutture e categorie iniziali: non inserisce spese storiche.

Non vengono modificati sessioni, extra, snapshot pacchetti, pagamenti, buoni o piani esistenti. Nessun backfill di costi nulli, nessuna ricostruzione dello storico dal catalogo. Non sono stati aggiunti costi demo al database. Le fixture dei test sono esclusivamente effimere.

Fuori ambito: fatture, registri IVA, deducibilita, anagrafica fornitori, allegati, ammortamenti, cespiti, banche, budget costi, ore/km, costi manuali per sessione e import/export.

## Verifiche

- Test puri: IVA, imposte, snapshot, null/zero, copertura, campagne, date Rome, futuri, cassa, ricorrenze e validazioni.
- Test API/server: whitelist, errori, conferme, date future, riferimenti inattivi, deduplicazione e assenza di falsi successi.
- Test SQL con `@electric-sql/pglite` (solo dipendenza di sviluppo): applicazione reale della migrazione in PostgreSQL effimero, audit, vincoli, permessi anonimi, rollback e ciclo ricorrenze.
- Le richieste parallele PGlite sono accodate nello stesso motore; non equivalgono a una prova multi-connessione su Supabase live. La protezione SQL combina lock e vincolo univoco.
- Test del dialogo condiviso: Escape, precedenza tooltip, blocco salvataggio e altri tasti.
- Browser: build di produzione locale, credenziali QA e chiave DB fittizia, API sostituite da fixture. Queste prove verificano UI e payload, non il collegamento al database live.
- Gate: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

### Esito della verifica di consegna

- `npm test`: 130 test superati, zero fallimenti.
- `npm run lint`: zero errori; restano quattro warning preesistenti per variabili inutilizzate nel JavaScript del sito WordPress.
- `npx tsc --noEmit`: superato.
- `npm run build`: superato; pagina e API costi presenti nella build.
- Edge headless con Playwright: creazione/modifica/eliminazione costo, annullamento della cancellazione, importi e IVA, conferma/annullamento arretrati, disattivazione ricorrenza, creazione/rinomina/disattivazione categoria, tipo immutabile, ricerca, anno vuoto, errore e riprova, tooltip, Escape, ripristino focus e menu mobile verificati.
- Riepilogo Costi/Economico identico con lo stesso dataset sintetico, generato dalle funzioni economiche reali.
- Desktop 1440x900, laptop 1280x800, tablet 768x1024, mobile 390x844: nessun overflow orizzontale della pagina o dei titoli/KPI; otto screenshot acquisiti. Controllo visivo effettuato sulle quattro dimensioni.
- Zero errori JavaScript e zero chiamate API inattese nella prova browser indipendente. Strumenti e screenshot QA sono temporanei, fuori dal repository.
- Collegamenti locali della documentazione verificati; modifiche preesistenti ai due audit conservate. Nessun commit, push o scrittura sul database live.

Durante l'installazione della dipendenza di test, npm ha segnalato 14 vulnerabilita nel dependency tree complessivo (1 bassa, 8 moderate, 4 alte, 1 critica). Non e stata effettuata un'analisi di dettaglio ne un aggiornamento automatico delle dipendenze fuori ambito; la segnalazione non viene attribuita alla nuova dipendenza senza verifica.

## File nuovi

- [../../app/costs/page.tsx](../../app/costs/page.tsx)
- [../../components/costs/costs-manager.tsx](../../components/costs/costs-manager.tsx)
- [../../components/costs/expense-editor.tsx](../../components/costs/expense-editor.tsx)
- [../../components/costs/cost-analysis.tsx](../../components/costs/cost-analysis.tsx)
- [../../lib/expenses.ts](../../lib/expenses.ts)
- [../../lib/expenses-server.ts](../../lib/expenses-server.ts)
- [../../lib/money.ts](../../lib/money.ts)
- [../../app/api/expenses/route.ts](../../app/api/expenses/route.ts)
- [../../app/api/expenses/[id]/route.ts](../../app/api/expenses/%5Bid%5D/route.ts)
- [../../app/api/expense-categories/route.ts](../../app/api/expense-categories/route.ts)
- [../../app/api/expense-categories/[id]/route.ts](../../app/api/expense-categories/%5Bid%5D/route.ts)
- [../../app/api/recurring-expenses/route.ts](../../app/api/recurring-expenses/route.ts)
- [../../app/api/recurring-expenses/[id]/route.ts](../../app/api/recurring-expenses/%5Bid%5D/route.ts)
- [../../app/api/analytics/costs/route.ts](../../app/api/analytics/costs/route.ts)
- [../../supabase/migrations/20261110102946_expense_management.sql](../../supabase/migrations/20261110102946_expense_management.sql)
- [../../tests/expenses.test.mjs](../../tests/expenses.test.mjs)
- [../../tests/expenses-api.test.mjs](../../tests/expenses-api.test.mjs)
- [../../tests/expenses-db.test.mjs](../../tests/expenses-db.test.mjs)
- [../../tests/expenses-ui.test.mjs](../../tests/expenses-ui.test.mjs)
- Questo documento.

## File modificati

- [../../lib/economic-plans.ts](../../lib/economic-plans.ts): componenti costo opzionali nel tipo sessione; formule esistenti invariate.
- [../../lib/economic-plans-server.ts](../../lib/economic-plans-server.ts): lettura costi snapshot e ordine stabile delle sessioni.
- [../../app/api/analytics/economic/route.ts](../../app/api/analytics/economic/route.ts): sezione costi condivisa.
- [../../app/api/audit-log/route.ts](../../app/api/audit-log/route.ts): nuove tabelle ammesse.
- [../../components/economic/economic-analysis.tsx](../../components/economic/economic-analysis.tsx): componente analisi costi e formatter condiviso, Piano invariato.
- [../../components/app-navigation.tsx](../../components/app-navigation.tsx): voce Gestione > Costi desktop/mobile.
- [../../components/shared/modal.tsx](../../components/shared/modal.tsx): focus, dialogo nativo, Escape e stato busy.
- [../../components/shared/info-tooltip.tsx](../../components/shared/info-tooltip.tsx): posizionamento entro i bordi e chiusura Escape.
- [../../components/shared/audit-log-panel.tsx](../../components/shared/audit-log-panel.tsx): etichette dei campi costi.
- [../../package.json](../../package.json) e [../../package-lock.json](../../package-lock.json): PGlite esclusivamente per test.
- [Modello economico e buoni regalo - novembre 2026.md](Modello%20economico%20e%20buoni%20regalo%20-%20novembre%202026.md): aggiornamento architetturale.

Le modifiche preesistenti nei due documenti di audit del working tree non fanno parte di questo intervento e non sono state modificate. Nessun commit o push eseguito.