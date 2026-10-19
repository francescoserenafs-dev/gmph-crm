Voglio eseguire un AUDIT COMPLETO, TECNICO, FUNZIONALE, DATI E COMMERCIALE del CRM GMPH nello stato attuale.

L'obiettivo NON è modificare il progetto.

L'obiettivo è produrre una fotografia autorevole e molto dettagliata del CRM così com'è realmente oggi, utile per:

- comprendere l'architettura;
- documentare tutte le funzionalità;
- verificare la coerenza tra codice e database;
- capire come vengono calcolate le metriche;
- documentare le regole commerciali implementate;
- individuare problemi, incoerenze e debito tecnico;
- distinguere chiaramente funzionalità implementate, parziali e mancanti;
- permettere a un altro sviluppatore o agente AI di capire il CRM senza dover ricostruire il progetto da zero.

NON FARE MODIFICHE.

Non:
- modificare codice;
- creare migration;
- applicare migration;
- modificare dati;
- aggiornare configurazioni;
- correggere bug;
- rifattorizzare;
- installare pacchetti;
- cambiare environment variables.

AUDIT READ-ONLY.

==================================================
0. OUTPUT
==================================================

Crea un file Markdown:

CRM_GMPH_COMPLETE_AUDIT_UPDATED.md

Nell'intestazione indica:

- data e ora audit;
- branch Git;
- commit/hash corrente;
- stato working tree;
- ambiente analizzato;
- disponibilità o meno dell'accesso al database Supabase live;
- eventuali limitazioni che impediscono verifiche complete.

Se nel repository esiste il precedente:

CRM_GMPH_COMPLETE_AUDIT.md

leggilo come riferimento storico.

NON copiarlo semplicemente.

Usalo per evidenziare:
- cosa è cambiato;
- cosa è stato aggiunto;
- cosa è stato risolto;
- cosa è ancora aperto;
- eventuali regressioni.

==================================================
1. PRINCIPIO DI VERIFICA
==================================================

Per ogni informazione importante indica implicitamente o esplicitamente se deriva da:

A. CODICE / SCHEMA REPOSITORY
B. DATABASE LIVE VERIFICATO
C. TEST
D. CONFIGURAZIONE
E. INFERENZA / NON VERIFICATO

Non presentare come fatto qualcosa che non puoi verificare.

Se il database live non è accessibile:

scrivi chiaramente:

"Verificato nel repository, non verificato sul database live."

Se trovi differenze tra:
- migration;
- schema TypeScript;
- database live;
- UI;
- test;

evidenziale.

==================================================
2. EXECUTIVE SUMMARY
==================================================

Apri il documento con una sintesi molto chiara.

Includi:

- stato generale del CRM;
- principali moduli presenti;
- maturità complessiva;
- punti forti;
- principali rischi tecnici;
- principali rischi operativi;
- principali incoerenze dati;
- funzionalità importanti incomplete;
- integrazioni attive;
- dipendenze esterne rilevanti;
- aree che richiedono attenzione.

Crea anche una tabella tipo:

| Area | Stato | Note |
|---|---|---|
| Clienti | Completo / Parziale / Critico | ... |
| Lead | ... | ... |
| Sessioni | ... | ... |
| Pacchetti | ... | ... |
| Extra | ... | ... |
| Pagamenti | ... | ... |
| Retention | ... | ... |
| Economico | ... | ... |
| Prenotazioni pubbliche | ... | ... |
| Sicurezza/privacy | ... | ... |

==================================================
3. STACK TECNOLOGICO
==================================================

Documenta precisamente:

- framework;
- versione Next.js;
- versione React;
- TypeScript;
- package manager;
- Supabase client/server;
- Postgres;
- librerie principali;
- librerie UI;
- date/time handling;
- timezone utilizzata;
- librerie email;
- eventuali SDK esterni;
- test framework;
- lint;
- build system.

Indica versioni reali da package.json / lockfile.

==================================================
4. STRUTTURA APPLICAZIONE
==================================================

Descrivi:

- routing;
- principali directory;
- server components / client components;
- API routes;
- server actions;
- helper condivisi;
- componenti principali;
- gestione autenticazione;
- middleware;
- layout;
- navigazione.

Crea una mappa sintetica delle principali route.

Esempio:

/lead
/clienti
/sessioni
/pacchetti
/analisi/lead
/analisi/extra...
/analisi/clienti-retention
/analisi/economico
/prenotazioni
/configurazione

Usa SOLO route realmente presenti.

==================================================
5. DATABASE
==================================================

Esegui un inventario completo delle tabelle rilevanti.

Per ogni tabella importante documenta:

- finalità;
- primary key;
- foreign key;
- colonne importanti;
- default;
- nullable/non-null;
- unique constraints;
- check constraints;
- indici;
- relazioni;
- trigger;
- RLS;
- funzioni/RPC correlate.

Particolare attenzione almeno a:

- clients
- sessions
- service_types
- session_stages
- session_packages
- session_package_inclusions
- eventuali snapshot pacchetto sulle sessions
- extra_products
- session_extras
- leads
- payments
- vouchers
- booking / booking events / booking addons
- annual_economic_plans
- economic_plan_monthly_targets
- economic_plan_service_targets
- distribuzione mensile sessioni del Piano Economico
- app_settings

Usa i nomi REALI presenti nel progetto.

==================================================
6. MIGRATIONS
==================================================

Crea una cronologia sintetica delle migration rilevanti.

In particolare verifica migration relative a:

- Lead;
- Extra/Prodotti;
- Pacchetti;
- snapshot;
- retention se presenti;
- Piano Economico;
- save_economic_plan;
- distribuzione mensile sessioni;
- planned base ticket;
- contact_type Lead;
- supplemento sabato.

Per ogni migration importante specifica:

- cosa introduce;
- se risulta applicata live;
- eventuali rischi;
- dipendenze.

NON assumere che una migration presente nel repository sia stata applicata.

==================================================
7. RPC / FUNZIONI POSTGRES
==================================================

Inventaria le RPC rilevanti.

In particolare verifica:

apply_session_package
save_economic_plan

e qualsiasi altra funzione significativa.

Per ciascuna:

- input;
- output;
- operazioni effettuate;
- atomicità;
- validazioni;
- autorizzazioni;
- rollback;
- possibili edge case.

Verifica specificamente se:

save_economic_plan

salva atomicamente:
- piano annuale;
- target mensili economici;
- target servizi;
- distribuzione mensile sessioni;
- ticket medio base pianificato;

secondo l'implementazione attuale.

==================================================
8. CLIENTI
==================================================

Documenta il modulo Clienti.

Includi:

- schema anagrafica;
- campi;
- attivo/archiviato;
- ricerca;
- creazione;
- modifica;
- relazione Sessioni;
- relazione Lead;
- relazione pagamenti;
- relazione voucher;
- duplicati;
- matching;
- comportamento Client archiviati.

Verifica in particolare:

- quando un Client può essere usato;
- differenza tra Client attivo e archiviato;
- se un Client archiviato può essere collegato a un Lead;
- se una Sessione ordinaria richiede Client attivo.

==================================================
9. LEAD / OPPORTUNITÀ COMMERCIALI
==================================================

Documenta il modulo Lead in modo molto dettagliato.

Il concetto da verificare è:

CLIENT = persona/anagrafica
LEAD = richiesta/opportunità commerciale
SESSION = lavoro prenotato

Verifica se il codice implementa realmente questo modello.

Documenta:

campi Lead:
- first_name;
- last_name;
- service;
- status;
- contact;
- source;
- created_at;
- requested_period;
- notes;
- follow_up_at;
- lost_reason;
- client_id;
- session_id;
- converted_at;
- closed_at;
- contact_type;
- eventuali altri campi.

Stati reali.

Fonti reali.

Lost reasons reali.

Contact type:
- new_contact;
- existing_client.

Verifica:

- nuovo contatto;
- cliente esistente;
- Client già collegato;
- cliente archiviato;
- conversione;
- creazione Session;
- matching email;
- prevenzione duplicati;
- più Lead sullo stesso Client;
- comportamento dopo conversione.

==================================================
10. LEAD ANALYTICS
==================================================

Documenta esattamente come vengono calcolati:

- Lead ricevuti;
- Prenotazioni;
- Conversion Rate;
- Valore prenotato;
- Ticket medio.

Verifica:

- cohort basata su lead.created_at;
- comportamento conversioni successive;
- filtro servizio;
- filtro source;
- filtro contact_type;
- lost reasons;
- Nuovi vs clienti esistenti.

Specifica chiaramente:

VALORE PRENOTATO

se utilizza:
- agreed_price_cents;
- extras;
- payments;
- altro.

Non dedurre.

==================================================
11. SESSIONI
==================================================

Documenta il modulo Sessioni.

Includi:

- creazione manuale;
- modifica;
- duplicazione;
- cancellazione;
- stage;
- service type;
- client;
- data;
- durata;
- prezzo concordato;
- included_photos;
- package;
- extras;
- pagamenti;
- voucher.

Documenta edge case.

Verifica la gestione timezone Europe/Rome.

==================================================
12. SUPPLEMENTO SABATO
==================================================

Documenta la logica attuale.

Verifica:

service_types.saturday_surcharge_cents

e i valori live se disponibili.

Documenta:

package price
+
saturday surcharge
=
suggested agreed price

Verifica:

- creazione manuale Session;
- conversione Lead;
- modifica data;
- modifica package;
- override manuale;
- Session già salvata;
- "Applica prezzo suggerito";
- public booking;
- assenza doppio supplemento.

Verifica i valori configurati, se live:

Famiglia
Maternità
Ritratto
Autunno
Natale

e qualsiasi altro servizio.

NON assumere i valori se il DB live non è accessibile.

==================================================
13. PACCHETTI
==================================================

Documenta l'architettura reale del catalogo pacchetti.

Includi:

session_packages:
- service type;
- nome;
- prezzo;
- durata;
- included photos;
- description;
- active;
- sort order.

Documenta:

- creazione;
- modifica;
- disattivazione;
- eliminazione;
- uso storico;
- duplicazione Session;
- package snapshot;
- cambio pacchetto;
- rimozione pacchetto.

Verifica se esiste versioning.

Se non esiste:
scrivilo chiaramente.

==================================================
14. SNAPSHOT PACCHETTI
==================================================

Documenta con precisione cosa viene salvato sulla Sessione quando viene applicato un pacchetto.

Verifica snapshot di:

- package_id;
- package name;
- price;
- duration;
- included photos;
- description;
- inclusioni.

Spiega differenza tra:

package price snapshot

e:

agreed_price_cents.

Verifica che modificare il catalogo non alteri Sessioni storiche.

==================================================
15. INCLUSIONI PACCHETTO
==================================================

Documenta:

session_package_inclusions

e relazione con:

extra_products.

Verifica:

- quantity;
- sort order;
- categoria;
- cost snapshot;
- nome snapshot;
- comportamento storico.

Spiega chiaramente che:

inclusione pacchetto != session_extra

se questo è vero nell'implementazione.

==================================================
16. CATALOGO EXTRA / PRODOTTI
==================================================

Documenta il catalogo universale.

Includi:

- categorie;
- unit;
- tiered/cumulative;
- prezzo;
- costo;
- active;
- ordinamento;
- digital;
- print;
- album;
- other.

Documenta la logica dei tier digitali corrente.

Non usare dati teorici:
leggi configurazione/schema reali.

==================================================
17. SESSION_EXTRAS
==================================================

Documenta la vendita Extra sulla Sessione.

Includi snapshot di:

- product;
- quantity;
- unit price;
- line total;
- direct cost;
- category.

Verifica come viene gestito pricing tiered.

Verifica se:

line_total_cents

è la fonte storica del valore vendita.

Verifica che modificare il catalogo non alteri vendite storiche.

==================================================
18. LEGACY "PROVINI EXTRA"
==================================================

Cerca eventuali Sessioni / service type legacy:

"Provini Extra"

Documenta:

- come vengono trattati;
- se sono esclusi dagli analytics;
- se sono ancora presenti;
- eventuali rischi di doppio conteggio.

NON convertirli automaticamente.

==================================================
19. EXTRA & UPSELL ANALYTICS
==================================================

Documenta formule reali di:

- Sessioni analizzate;
- Sessioni con extra;
- Upsell rate;
- Valore extra totale;
- Extra medio/sessione;
- Extra medio acquirenti;
- Ticket base;
- Ticket finale;
- aumento ticket;
- costi;
- margine diretto calcolato;
- coverage costi.

Verifica filtri:

- periodo;
- servizio;
- categoria.

Spiega precisamente come cambia il denominatore con filtro categoria.

Verifica cosa succede ai prodotti con costo mancante.

==================================================
20. PAGAMENTI
==================================================

Documenta il modello pagamenti.

Includi:

- payment rows;
- data pagamento;
- importo;
- metodo;
- Session;
- voucher;
- eventuali stati.

Spiega differenza tra:

valore commerciale
e
cash collected.

Verifica se pagamenti vengono usati nelle analytics commerciali oppure separatamente.

==================================================
21. VOUCHER
==================================================

Documenta:

- acquisto voucher;
- redemption;
- relazione con pagamenti;
- relazione con Sessioni;
- cash;
- non-cash coverage.

Verifica regole reali implementate.

Spiega chiaramente:

voucher purchase = cash
voucher redemption = non-cash

solo se il codice effettivamente implementa questo comportamento.

==================================================
22. PUBLIC BOOKING /PRENOTAZIONI
==================================================

Esegui un audit dettagliato di:

/prenotazioni

Documenta:

- struttura;
- booking events;
- availability;
- slot;
- weekday / weekend / holiday pricing;
- booking addons;
- creazione Client;
- creazione Session;
- prezzo;
- email;
- integrazioni;
- pagamenti se presenti.

Verifica la relazione con:

session_packages.

Se il public booking NON usa il nuovo catalogo Pacchetti:
scrivilo chiaramente.

Documenta rischi di doppio pricing con saturday surcharge.

==================================================
23. CLIENTI & RETENTION
==================================================

Documenta esattamente:

- universo Sessioni valide;
- cancellate;
- addon;
- Provini Extra;
- sessioni future;
- duplicate;
- realizzate.

Spiega formule di:

- Clienti serviti;
- Nuovi;
- Clienti di ritorno;
- Repeat Client Rate;
- Sessioni medie/client;
- Valore medio cliente;
- valore cumulativo cliente.

Verifica la differenza semantica tra:

CLIENTE DI RITORNO

e:

REPEAT CLIENT RATE.

Documenta:
- paths;
- transizioni;
- reactivation;
- soglie 6/12/18/24 mesi;
- future bookings.

==================================================
24. PIANO ECONOMICO
==================================================

Documenta Analisi -> Economico.

Descrivi:

annual_economic_plans

target mensili

target servizi

distribuzione mensile sessioni

ticket medio base pianificato

Extra attesi

note.

Verifica il modello multi-anno.

==================================================
25. TARGET ECONOMICI
==================================================

Documenta formule reali:

Target servizi totale

+
Extra attesi

=
Valore pianificato

Verifica:

target annuale

e relativi warning di coerenza.

==================================================
26. TARGET PER SERVIZIO
==================================================

Documenta:

- target_sessions;
- planned_base_ticket;
- target value;
- Listino attuale;
- riferimento session_packages.

Verifica formula:

target_sessions
*
planned_base_ticket
=
target value

Verifica se il calcolo è server-side.

==================================================
27. DISTRIBUZIONE MENSILE SESSIONI
==================================================

Documenta la matrice:

servizio x mese.

Verifica:

- fonte servizi;
- sincronizzazione automatica con Target per servizio;
- nuovi servizi;
- rimozione servizi;
- target annuale;
- totale distribuito;
- warning;
- salvataggio.

Verifica che la lista servizi sia derivata da service targets e non mantenuta indipendentemente.

==================================================
28. SAVE ECONOMIC PLAN
==================================================

Verifica con attenzione la transazione.

Documenta tutto ciò che viene salvato atomicamente.

Verifica rollback.

Verifica eventuali validazioni fuori dalla RPC.

Indica chiaramente eventuali limiti residui.

==================================================
29. DASHBOARD ECONOMICO
==================================================

Documenta formule reali di:

- Target annuale;
- Valore commerciale acquisito;
- Copertura target;
- Da generare;
- Incassato;
- Ticket medio;
- Realizzato;
- Futuro.

Spiega:

realized
future booked
acquired.

Documenta:
- tabella mensile;
- target sessioni;
- sessioni acquisite;
- target euro;
- acquisito;
- gap;
- cumulative;
- tabella servizi;
- fuori piano;
- base vs extra;
- cash.

==================================================
30. HOME
==================================================

Documenta i KPI e grafici principali della Home.

Verifica in particolare la fonte del:

Target annuale.

Controlla la logica:

Piano Economico dell'anno corrente
prima scelta

fallback legacy app_settings
solo se non esiste piano.

Documenta annualTargetSource se presente.

==================================================
31. CONFIGURAZIONE
==================================================

Inventaria tutte le impostazioni modificabili.

In particolare:

- Tipi di servizio;
- active/inactive;
- extra/addon;
- supplemento sabato;
- impostazioni legacy;
- eventuale annual budget fallback;
- catalogo extra;
- altre configurazioni.

Descrivi la UI attuale.

==================================================
32. INFO TOOLTIP
==================================================

Verifica il componente condiviso InfoTooltip.

Documenta:

- dove è usato;
- hover;
- focus;
- mobile tap;
- Esc;
- aria;
- responsive.

Verifica eventuali dashboard che NON lo utilizzano ancora.

==================================================
33. NAVIGAZIONE
==================================================

Documenta il menu reale.

Indica struttura completa.

Verifica presenza e route di:

HOME

CONTATTI
- Lead
- Clienti

GESTIONE
- Sessioni
- Pagamenti
- Buoni regalo

PACCHETTI

ANALISI
- Lead
- Extra & Upsell
- Clienti & Retention
- Economico

PRENOTAZIONI

CONFIGURAZIONE

Se la struttura reale differisce:
riporta quella reale.

==================================================
34. INTEGRAZIONI ESTERNE
==================================================

Inventaria integrazioni reali:

- Supabase;
- MailerLite;
- Calendly;
- iCloud;
- Resend;
- Meta / ManyChat se presenti;
- altri provider.

Per ciascuna:

- finalità;
- direzione dati;
- file/componenti;
- environment variables;
- stato utilizzo;
- eventuali rischi.

NON mostrare valori segreti.

==================================================
35. EMAIL
==================================================

Documenta:

- provider;
- template;
- trigger;
- booking email;
- email clienti;
- eventuali error handling;
- retry;
- logging.

==================================================
36. AUTH / SECURITY
==================================================

Audit di:

- autenticazione;
- sessioni;
- middleware;
- server/client Supabase;
- RLS;
- API protette;
- public API;
- service role;
- env vars;
- possibilità di accesso non autorizzato.

NON stampare secret/token.

Evidenzia vulnerabilità concrete.

==================================================
37. PRIVACY E CONSENSI
==================================================

Verifica i campi relativi a:

- privacy;
- marketing;
- newsletter;
- consenso.

Controlla se lo stesso consenso viene utilizzato impropriamente per finalità diverse.

Segnala chiaramente qualsiasi problema privacy/marketing.

NON correggere.

==================================================
38. QUALITÀ DATI
==================================================

Se DB live accessibile, esegui query READ-ONLY per:

- numero Client;
- numero Sessioni;
- Sessioni per anno;
- Client con Sessioni;
- Lead;
- Extra;
- Pagamenti;
- Voucher;
- Pacchetti;
- prodotti;
- piani economici.

Cerca:

- orphan;
- FK problematiche;
- duplicati;
- null inattesi;
- prezzi negativi;
- quantità errate;
- Sessioni duplicate;
- Client duplicati plausibili;
- pacchetti senza service;
- inclusioni orphan;
- session_extras inconsistenti.

NON correggere.

==================================================
39. FOTOGRAFIA ECONOMICA DEL DATABASE
==================================================

Se il DB live è accessibile, calcola separatamente:

A. VALORE BASE SESSIONI
B. EXTRA
C. VALORE COMMERCIALE
D. PAGAMENTI LORDI
E. CASH MONETARIO
F. VOUCHER REDEMPTION
G. RESIDUO

Se possibile dividi per:
- anno;
- servizio.

NON confondere cash e valore commerciale.

==================================================
40. DATI 2025 / 2026 / 2027
==================================================

Documenta la copertura storica.

Importante:

eventuali dati 2025 possono essere parziali.

Non assumere che assenza di dati significhi assenza reale di attività.

Lead storici:
verifica da quale periodo esiste tracciamento affidabile.

Non usare il numero Lead 2025/2026 come funnel storico completo se il tracciamento è iniziato successivamente.

==================================================
41. LOGICHE COMMERCIALI
==================================================

Crea una sezione specifica che descriva cosa il CRM considera:

- lead;
- cliente;
- sessione;
- pacchetto;
- extra;
- inclusione;
- valore commerciale;
- incassato;
- voucher;
- target;
- Extra attesi;
- ticket medio base pianificato;
- cliente di ritorno.

Questa sezione deve essere comprensibile anche a un non sviluppatore.

==================================================
42. LISTINO / PACCHETTI LIVE
==================================================

Se il DB è accessibile, crea un inventario del catalogo pacchetti reale.

Per ogni servizio:

| Servizio | Pacchetto | Prezzo | Durata | Foto | Attivo | Inclusioni |

NON utilizzare fixture dei test.

NON utilizzare Piano Economico come fonte prezzo.

Usa il catalogo live.

==================================================
43. EXTRA / PRODOTTI LIVE
==================================================

Se accessibile:

| Prodotto | Categoria | Pricing | Prezzo | Costo | Attivo |

Per tier:
descrivi anche le fasce.

==================================================
44. TEST
==================================================

Inventaria:

- unit test;
- integration test;
- DB test;
- PGlite;
- E2E se presenti.

Indica cosa viene realmente coperto.

Esegui almeno, se possibile:

npm run lint
npm run build
test suite principale

Senza modificare il progetto.

Riporta:
- numero test;
- pass/fail;
- warning.

==================================================
45. PERFORMANCE
==================================================

Cerca:

- N+1;
- query senza pagination;
- fetch enormi;
- query client-side inefficienti;
- aggregazioni pesanti;
- API con limite 1000;
- assenza indici;
- fetch ripetuti;
- problemi potenziali su crescita dati.

Distingui:

problemi reali

da:

ottimizzazioni premature.

==================================================
46. ERROR HANDLING
==================================================

Audit di:

- API errors;
- DB errors;
- RPC errors;
- messaggi utente;
- loading;
- retry;
- optimistic UI;
- false "saved successfully";
- rollback.

==================================================
47. TRANSAZIONALITÀ
==================================================

Elenca operazioni multi-step che sono:

- transazionali;
- non transazionali.

Particolare attenzione a:

- apply package;
- save economic plan;
- package inclusions;
- Lead conversion;
- booking;
- payments;
- vouchers.

Segnala rischi di partial persistence.

==================================================
48. DEBITO TECNICO
==================================================

Crea una sezione:

DEBITO TECNICO / BACKLOG

Classifica ogni voce:

P0 = rischio critico / perdita dati / sicurezza
P1 = problema importante
P2 = miglioramento utile
P3 = nice to have

Per ogni voce:

- problema;
- impatto;
- probabilità;
- complessità indicativa;
- raccomandazione.

NON proporre refactor astratti senza beneficio concreto.

==================================================
49. OVERENGINEERING
==================================================

Crea una sezione specifica:

"Cosa NON vale la pena complicare oggi"

Il CRM è per una piccola attività fotografica freelance.

Valuta criticamente eventuali aree dove:

- più automazione;
- più analytics;
- più configurazione;
- più schema;
- più software

produrrebbero più lavoro gestionale che valore.

Segnala esplicitamente cosa lasceresti semplice.

==================================================
50. RISCHI OPERATIVI
==================================================

Identifica rischi tipo:

- dipendenza da inserimento manuale;
- dati non tracciati;
- doppio conteggio;
- prezzi non sincronizzati;
- booking vs CRM;
- sessioni duplicate;
- lead mancanti;
- costi prodotti mancanti;
- marketing consent;
- storico incompleto.

==================================================
51. COMMERCIAL / BUSINESS AUDIT
==================================================

Valuta se il CRM supporta effettivamente le decisioni commerciali principali:

- quanti Lead arrivano;
- quanti prenotano;
- nuovi vs clienti esistenti;
- da dove arrivano;
- perché vengono persi;
- quali servizi vendono;
- valore medio;
- extra;
- ritorno clienti;
- target annuale;
- target mensili;
- capacità;
- distribuzione servizi.

Indica cosa possiamo realmente sapere oggi e cosa NON possiamo ancora sapere.

==================================================
52. KPI AFFIDABILI VS NON AFFIDABILI
==================================================

Crea una tabella:

| KPI | Affidabilità | Motivazione |

Esempio categorie:

Alta
Media
Bassa
Non misurabile

Valuta almeno:

- fatturato commerciale;
- cash;
- lead;
- conversion rate;
- retention;
- ticket medio;
- extra;
- upsell;
- costo diretto;
- margine diretto;
- CAC;
- ROAS.

Non inventare CAC/ROAS se non esistono costi marketing tracciati.

==================================================
53. DIFFERENZA REPOSITORY VS LIVE
==================================================

Crea una sezione specifica:

"Repository vs Database Live"

Elenca:

- migration presenti ma non applicate;
- colonne live mancanti;
- dati live non rappresentati;
- configurazioni divergenti;
- eventuale schema drift.

Questa sezione è molto importante.

==================================================
54. PROBLEMI / BUG CONCRETI
==================================================

Elenca ogni problema trovato con:

ID
Titolo
Area
Severità
Evidenza
Impatto
Come riprodurlo
Possibile soluzione

Non correggere.

==================================================
55. FUNZIONALITÀ IMPLEMENTATE
==================================================

Crea un inventario completo:

- Clienti
- Lead
- conversione
- Sessioni
- Pacchetti
- inclusioni
- Extra
- Pagamenti
- Voucher
- Public booking
- Analytics Lead
- Analytics Extra
- Retention
- Economico
- Configurazione
- Home
- integrazioni

Per ciascuna:

Completa
Parziale
Non implementata
Legacy

==================================================
56. FLUSSI END-TO-END
==================================================

Documenta almeno questi flussi:

A.
Nuovo contatto
-> Lead
-> Booking
-> Client
-> Session
-> Extra
-> Payment

B.
Cliente esistente
-> nuovo Lead
-> nuova Session

C.
Public booking
-> Client
-> Session
-> agreed price

D.
Package
-> Session snapshot
-> inclusioni snapshot

E.
Voucher purchase
-> cash
-> redemption
-> Session

F.
Piano Economico
-> target
-> acquired
-> cash

==================================================
57. MAPPA SOURCE OF TRUTH
==================================================

Crea una tabella molto importante:

| Concetto | Source of truth |

Esempi:

Prezzo catalogo pacchetto
-> session_packages

Prezzo reale Sessione
-> sessions.agreed_price_cents

Foto incluse correnti
-> session_packages.included_photos

Foto incluse storiche
-> snapshot Sessione

Extra venduto storico
-> session_extras.line_total_cents

Cash
-> payments secondo logica reale

Target annuale
-> annual_economic_plans con fallback Home se applicabile

Scrivi SOLO mapping verificati.

==================================================
58. CONCLUSIONI
==================================================

Chiudi l'audit con:

A. Stato del CRM oggi

B. Cosa funziona bene

C. Cosa è fragile

D. Cosa va sistemato prima di aggiungere nuove funzionalità

E. Cosa può tranquillamente restare così

F. Top 5 priorità tecniche

G. Top 5 priorità operative/business

H. Funzionalità che NON consigli di sviluppare ora

==================================================
59. APPENDICE
==================================================

Aggiungi appendici con:

- elenco tabelle;
- elenco migration;
- elenco RPC;
- elenco route;
- elenco API;
- elenco environment variables SOLO PER NOME, mai valori;
- elenco integrazioni;
- elenco test;
- eventuali query read-only utilizzate.

==================================================
60. REGOLE FINALI
==================================================

Sii estremamente concreto.

NON:
- inventare;
- assumere;
- riempire buchi con supposizioni;
- descrivere feature desiderate come esistenti;
- usare fixture dei test come dati commerciali reali;
- usare il Piano Economico come listino;
- confondere booked value e cash;
- confondere package inclusion ed Extra;
- confondere Client e Lead;
- confondere cliente di ritorno e Repeat Client Rate.

Se qualcosa non è verificabile:
scrivilo.

Se trovi una discrepanza:
evidenziala.

Se una feature funziona bene:
dillo.

Non cercare problemi a tutti i costi.

L'obiettivo è ottenere un documento autorevole, accurato e utilizzabile.

NON MODIFICARE NULLA.

Al termine:
1. crea CRM_GMPH_COMPLETE_AUDIT_UPDATED.md;
2. indicami il percorso;
3. dammi una sintesi di massimo 15 punti con le evidenze più importanti;
4. indicami separatamente eventuali blocker che hanno impedito parti dell'audit.