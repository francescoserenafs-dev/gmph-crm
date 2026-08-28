# CRM Giulia Malosso Photography - PRD

## 1. Executive Summary

Realizzare un CRM web privato per Giulia Malosso Photography che centralizzi clienti, sessioni fotografiche, buoni regalo e pagamenti. Il prodotto deve dare prima visibilita sulle prossime sessioni e sul loro avanzamento, poi sul denaro da incassare, riducendo informazioni disperse tra chat, note e fogli di calcolo.

## 2. Problem Statement

**Utente:** Giulia, fotografa freelance che gestisce autonomamente servizi famiglia, newborn, compleanni, maternita e altre tipologie configurabili.

**Problema:** le informazioni operative e finanziarie dei servizi sono distribuite e difficili da seguire: cliente, appuntamento, fase di post-produzione, caparra, saldo e buoni regalo devono restare coerenti.

**Impatto:** rischio di dimenticare attivita, perdere la visione delle sessioni imminenti, non sapere quanto incassare e gestire in modo poco tracciabile buoni e pagamenti.

**Evidenza:** Assunzione: il bisogno deriva dall'attuale necessita operativa descritta, senza interviste o metriche quantitative disponibili.

## 3. Utenti e Job

### Persona primaria: Giulia

- Unica utilizzatrice e amministratrice nella prima versione.
- Deve organizzare velocemente il lavoro quotidiano e sapere cosa fare dopo per ciascuna sessione.
- Deve poter consultare incassi e crediti senza ricostruirli manualmente.

### Job to be done

"Quando gestisco un servizio fotografico, voglio vedere cliente, stato della lavorazione, pagamenti e buoni collegati in un solo posto, cosi posso completare il lavoro e incassare senza dimenticanze."

## 4. Contesto Strategico

Il CRM e uno strumento operativo interno, non un prodotto SaaS o un portale per clienti. La priorita e:

1. Controllo di prossime sessioni e avanzamenti.
2. Visibilita su incassi e crediti.
3. Centralizzazione delle informazioni.

**Perche ora:** la crescita delle sessioni, dei pagamenti frazionati e dei buoni rende insufficiente una gestione non centralizzata.

Assunzione: uso principalmente desktop; l'interfaccia dovra comunque restare utilizzabile da mobile.

## 5. Soluzione

Un'app Next.js con Supabase che include:

- **Clienti:** anagrafica, contatti, data di nascita, note, consensi e storico di sessioni, buoni e pagamenti.
- **Sessioni:** cliente, servizio, data/ora di inizio, durata, luogo facoltativo, prezzo concordato, note, avanzamento e saldo.
- **Avanzamenti configurabili:** almeno prenotata, sessione svolta, pagamento ricevuto, provini inviati, selezione ricevuta, foto finali consegnate, annullata.
- **Pagamenti:** uno o piu movimenti per sessione, classificati almeno come caparra o saldo e pagati in contanti, PayPal o Wise.
- **Buoni regalo:** a sessione o a valore; acquistati da un cliente e riscattati da un beneficiario anche diverso.
- **Configurazione:** tipologie di servizio, metodi di pagamento, avanzamenti di sessione e validita generale dei buoni.
- **Dashboard:** prossime sessioni, importi da incassare, incassi per periodo/metodo, caparre e saldi, stato dei buoni.

Gli importi saranno salvati in centesimi per evitare errori di arrotondamento: EUR 150,00 = `15000`.

## 6. Regole di Business

- Una sessione appartiene a un cliente e conserva il **prezzo concordato** al momento della creazione.
- Cliente, tipo di servizio, data/ora di inizio, durata in minuti e prezzo concordato sono obbligatori; luogo e note sono facoltativi.
- La fine della sessione e calcolata da orario di inizio e durata; sono vietate sovrapposizioni e sono consentite sessioni consecutive.
- Una sessione annullata resta nello storico e non occupa uno slot nel calendario.
- Una sessione puo essere eliminata solo se non ha pagamenti o buoni riscattati collegati; in caso contrario puo essere annullata e successivamente ripristinata dopo un nuovo controllo sovrapposizioni.
- Le sessioni future partono da `Prenotata`; quelle passate da `Sessione svolta`. Gli avanzamenti restano modificabili liberamente.
- La tipologia `Altro` richiede una nota descrittiva, pur restando nella stessa categoria.
- Un cliente ha nome, cognome ed email obbligatori; l'email e univoca senza distinzione tra maiuscole e minuscole.
- Cellulare, data di nascita, indirizzo e note sono facoltativi.
- Un cliente archiviato resta nello storico ma non compare negli elenchi e nelle selezioni predefinite.
- I consensi al trattamento dati e all'utilizzo delle immagini sono separati; per ciascuno sono tracciate concessione ed eventuale revoca.
- L'assenza del consenso privacy non blocca la creazione di una sessione, ma deve risultare visibile nella scheda cliente.
- Una sessione puo avere piu pagamenti; il saldo e pari al prezzo concordato meno i pagamenti validi.
- Pagamenti e avanzamenti operativi restano indipendenti: il saldo non modifica automaticamente lo stato della sessione.
- Importo, data, metodo, causale e riferimento a sessione o buono sono obbligatori; gli importi sono euro interi e le date non possono essere future.
- I pagamenti ordinari sono modificabili, ma il riferimento resta immutabile. Un utilizzo buono non e modificabile: la sua eliminazione riattiva automaticamente il buono.
- Un pagamento salda una sessione oppure l'acquisto di un buono, mai entrambi.
- I buoni hanno scadenza calcolata alla vendita con validita iniziale di 12 mesi, modificabile nelle impostazioni.
- Un buono a sessione e riscattabile una sola volta per una sessione compatibile con il servizio incluso.
- Un buono a valore e riscattabile una sola volta e viene sempre consumato per intero.
- Se il valore del buono supera il prezzo della sessione, non vengono generati resto o credito.
- Se il prezzo supera il valore del buono, la differenza puo essere saldata con uno o piu pagamenti.
- Stati del buono: `active`, `redeemed`, `expired`, `cancelled`.
- Ogni cambio di avanzamento della sessione deve essere storicizzato con data e nota facoltativa.

Open question: definire se un buono a sessione copre anche eventuali extra/prestazioni aggiuntive o soltanto la tariffa base del servizio.

## 7. Requisiti e User Stories

### Ipotesi epic

Crediamo che un CRM unico per sessioni, avanzamenti, pagamenti e buoni permettera a Giulia di gestire il lavoro quotidiano con meno controlli manuali e maggiore visibilita sui crediti.

### Gestire clienti

Come Giulia, voglio creare, cercare e aggiornare clienti, cosi posso collegare ogni attivita alla persona corretta.

**Criteri di accettazione:** ricerca per nome/contatto; scheda con storico collegato.

### Pianificare sessioni

Come Giulia, voglio associare una sessione a cliente, servizio, data e prezzo concordato.

**Criteri di accettazione:** sessione modificabile; prezzo non dipendente da successive modifiche al listino.

### Aggiornare la lavorazione

Come Giulia, voglio registrare gli avanzamenti della sessione.

**Criteri di accettazione:** stato corrente visibile; storico completo; stati gestibili nelle impostazioni.

### Registrare caparre e saldi

Come Giulia, voglio aggiungere pagamenti parziali o completi.

**Criteri di accettazione:** metodo, data, importo e causale; saldo ricalcolato automaticamente.

### Vendere e riscattare buoni

Come Giulia, voglio emettere un buono per un acquirente e applicarlo una volta sola a una sessione.

**Criteri di accettazione:** controllo di stato, scadenza, compatibilita servizio e consumo totale.

### Configurare dati operativi

Come Giulia, voglio gestire servizi, metodi, avanzamenti e validita dei buoni.

**Criteri di accettazione:** disattivare una voce non deve alterare i dati storici.

### Consultare la dashboard

Come Giulia, voglio vedere le prossime sessioni e il riepilogo finanziario.

**Criteri di accettazione:** nessuna sezione "sessioni in ritardo" nella prima versione; filtri temporali per gli incassi.

## 8. Fuori Scope

- Autenticazione, gestione utenti, ruoli e collaborazione.
- Portale clienti, prenotazione autonoma, notifiche email o WhatsApp.
- Integrazione automatica con PayPal o Wise: nella prima versione i movimenti sono registrati manualmente.
- Emissione di fatture, gestione fiscale, rimborsi e report contabili avanzati.
- Calendario esterno e sincronizzazione con Google Calendar.

## 9. Metriche, Dipendenze e Rischi

### Metriche

- Primaria: Assunzione: almeno il 90% delle sessioni future ha un avanzamento aggiornato.
- Secondarie: saldo visibile per ogni sessione; tutti gli incassi registrati con metodo; nessun buono riscattato piu di una volta.
- Operativa: prossime sessioni consultabili dalla dashboard senza ricerche manuali.

### Dipendenze

- Progetto Supabase configurato tramite variabili locali.
- Definizione dei servizi, metodi e avanzamenti iniziali da inserire come dati di configurazione.

### Rischi e mitigazioni

- **Regole finanziarie ambigue:** vincoli nel database e conferme esplicite nel flusso di riscatto.
- **Cambi di listino/configurazione:** snapshot di nome e prezzo nei record storici.
- **Accesso ai dati:** autenticazione e Row Level Security prima dell'uso oltre l'ambiente locale.

## 10. Domande Aperte

- I buoni a sessione coprono esclusivamente il servizio base o anche gli extra?
- Esistono condizioni speciali per buoni annullati, scaduti o non utilizzati?
- Quali sono le tipologie di servizio e gli avanzamenti iniziali da preconfigurare?
- Quali dati personali, note e consensi devono essere salvati per ciascun cliente?
- Assunzione: il CRM operera inizialmente in una sola valuta, EUR.

## Autovalutazione

Il flusso operativo, i vincoli su buoni e pagamenti e lo scope della prima versione sono definiti con buona precisione. Il punto piu da validare e la gestione delle eccezioni commerciali, in particolare la copertura degli extra da parte dei buoni a sessione.

Il prossimo artefatto tecnico e una migrazione SQL Supabase con tabelle, vincoli e dati iniziali di configurazione coerenti con questo PRD.