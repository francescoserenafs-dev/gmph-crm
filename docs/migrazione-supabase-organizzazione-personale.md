# Migrazione del progetto Supabase a un'organizzazione personale

Questa guida descrive come trasferire il progetto Supabase esistente dall'organizzazione aziendale a una nuova organizzazione personale, senza creare un nuovo progetto e senza migrare manualmente il database.

## Prima di iniziare

Il trasferimento deve essere autorizzato dall'organizzazione aziendale. Verifica di poter trasferire dati, configurazioni e integrazioni fuori dall'organizzazione aziendale.

Non eliminare il progetto attuale e non creare un nuovo progetto personale prima di aver verificato se il trasferimento diretto e' disponibile.

## 1. Crea l'account personale

1. Apri Supabase in una finestra anonima o in un browser separato.
2. Crea un account usando la mail personale.
3. Verifica la mail.
4. Accedi con il nuovo account personale.

E' preferibile usare una finestra anonima per evitare di confondere l'account aziendale con quello personale.

## 2. Invita l'account personale nell'organizzazione aziendale

Con l'account aziendale:

1. Apri il progetto `CRM Giulia Malosso PH`.
2. Apri il selettore dell'organizzazione.
3. Entra nelle impostazioni dell'organizzazione aziendale.
4. Cerca `Team`, `Members` o `People`.
5. Seleziona `Invite member`.
6. Inserisci la mail dell'account personale.
7. Assegna il ruolo piu' alto disponibile, preferibilmente `Owner` se autorizzato.

Il trasferimento puo' richiedere privilegi di owner nell'organizzazione di origine. Se l'organizzazione e' controllata da un'altra persona, chiedi l'autorizzazione o l'intervento dell'owner.

## 3. Accetta l'invito

1. Apri la mail di invito con l'account personale.
2. Accetta l'invito.
3. Accedi a Supabase con l'account personale.
4. Dal selettore delle organizzazioni, verifica di vedere l'organizzazione aziendale.
5. Verifica di poter aprire il progetto `CRM Giulia Malosso PH`.
6. Verifica di poter accedere alle impostazioni del progetto.

Non rimuovere ancora l'account personale e non eliminare l'account aziendale.

## 4. Crea l'organizzazione personale

Con l'account personale:

1. Apri il selettore delle organizzazioni.
2. Seleziona `New organization` o `Create organization`.
3. Scegli un nome, ad esempio `Francesco Serena` o `CRM personale`.
4. Seleziona il piano richiesto.

Controlla prima di confermare:

- limiti del piano gratuito;
- costi del piano a pagamento;
- disponibilita' dei backup;
- limiti di database, storage e traffico;
- responsabilita' della fatturazione.

Non inserire una carta personale senza aver verificato costi e piano scelto.

## 5. Controlli prima del trasferimento

Annota o verifica dal progetto attuale:

- Project URL;
- Project reference ID;
- piano e regione;
- stato dei backup;
- domini personalizzati;
- utenti Auth;
- bucket e file Storage;
- eventuali Edge Functions;
- webhook e integrazioni;
- membri autorizzati;
- impostazioni di billing.

Nel CRM verifica in particolare:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- MailerLite;
- Calendly;
- iCloud Calendar;
- Cloudflare Turnstile;
- eventuali webhook;
- eventuali domini personalizzati.

Le chiavi segrete non devono essere copiate nel repository, in chat o negli screenshot.

Se disponibili, verifica che esista un backup recente in:

```text
Project Settings -> Database -> Backups
```

## 6. Trasferisci il progetto

Con l'account personale, oppure con l'account owner autorizzato:

1. Apri `CRM Giulia Malosso PH`.
2. Vai in `Project Settings -> General`.
3. Cerca `Transfer project`, eventualmente dentro `Danger Zone`.
4. Avvia il trasferimento.
5. Seleziona l'organizzazione personale come destinazione.
6. Leggi il riepilogo e le conseguenze sulla fatturazione.
7. Se richiesto, digita esattamente il nome del progetto.
8. Conferma il trasferimento.

Il trasferimento puo' richiedere:

- ruolo owner nell'organizzazione di origine;
- ruolo owner nell'organizzazione di destinazione;
- piani compatibili;
- conferma esplicita del nome del progetto;
- accettazione del cambio di responsabile della fatturazione.

Se non compare `Transfer project`, non creare subito un progetto alternativo. Verifica prima ruolo, piano, billing e autorizzazione dell'owner aziendale.

## 7. Cosa dovrebbe rimanere invariato

Il trasferimento del progetto esistente normalmente conserva:

- database PostgreSQL;
- tabelle e dati;
- migration gia' applicate;
- policy RLS;
- funzioni e trigger;
- utenti Supabase Auth;
- bucket e file Storage;
- URL Supabase;
- project reference;
- schema `public`.

La protezione applicata alla tabella `public.audit_log` deve quindi rimanere attiva. Non e' necessario rieseguire la migration:

```sql
alter table public.audit_log enable row level security;
```

Il file della migration resta nel repository come tracciamento dello stato atteso del database.

## 8. Verifiche subito dopo il trasferimento

1. Verifica che il progetto compaia nell'organizzazione personale.
2. Apri il database e controlla che tabelle e dati siano presenti.
3. Apri `Advisors -> Security Advisor`.
4. Seleziona `Refresh`.
5. Verifica che gli errori critici siano ancora a zero.
6. Controlla RLS con:

```sql
select
	schemaname,
	tablename,
	rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Per `audit_log`, il valore `rowsecurity` deve essere `true`.

Puoi anche verificare direttamente:

```sql
select relname, relrowsecurity
from pg_class
where relname = 'audit_log';
```

## 9. Variabili dell'hosting

Controlla le variabili dell'ambiente production dell'hosting:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Se URL e chiavi restano invariati, normalmente non devi modificare il deploy. Non rigenerare le chiavi senza motivo. Se una chiave viene rigenerata, aggiorna subito l'hosting e ridistribuisci l'applicazione.

La `SUPABASE_SERVICE_ROLE_KEY` deve restare solo lato server e non deve mai essere esposta al browser.

## 10. Test dell'applicazione

Dopo il trasferimento prova in produzione:

1. Login.
2. Dashboard.
3. Elenco e dettaglio clienti.
4. Apertura di una sessione.
5. Pagamenti.
6. Voucher.
7. Ricerca globale.
8. Booking pubblico.
9. Una modifica o creazione di un record di test, se possibile.
10. Un'operazione che genera una voce nell'audit log.

Controlla anche i log dell'hosting. Le API server-side del progetto usano `SUPABASE_SERVICE_ROLE_KEY`, quindi continuano ad accedere alle tabelle protette da RLS.

## 11. Verifica delle integrazioni

### MailerLite

Controlla API key, gruppi marketing, gruppo transazionale ed eventuali webhook.

### Calendly

Controlla token, URL degli eventi, mapping dei tipi di evento ed eventuali webhook.

### iCloud Calendar

Controlla credenziali, calendario selezionato e variabili server-side.

### Cloudflare Turnstile

Controlla che il dominio dell'app sia ancora autorizzato nella configurazione Turnstile.

### OAuth

Se usi Google, Apple o altri provider, verifica redirect URL e login reale. Se il Project URL e' rimasto invariato, i redirect normalmente non devono cambiare.

## 12. Rimozione degli accessi aziendali

Non rimuovere subito gli accessi aziendali. Mantieni temporaneamente gli accessi necessari per verificare:

- progetto nell'organizzazione personale;
- database e dati;
- login e applicazione;
- deploy;
- integrazioni;
- variabili production;
- billing.

Solo dopo la verifica rimuovi i membri non piu' autorizzati dalla nuova organizzazione personale.

## Checklist finale

- [x] ~~Account personale creato e verificato.~~
- [x] ~~Account personale invitato nell'organizzazione aziendale.~~
- [x] ~~Invito accettato.~~
- [x] ~~Permessi sufficienti verificati.~~
- [ ] Organizzazione personale creata.
- [ ] Piano e billing controllati.
- [ ] Backup e configurazioni verificati.
- [ ] Progetto trasferito.
- [ ] Database e dati verificati.
- [ ] RLS di `audit_log` verificato.
- [ ] Security Advisor controllato.
- [ ] Variabili dell'hosting controllate.
- [ ] Login e flussi principali testati.
- [ ] Integrazioni testate.
- [ ] Accessi aziendali rimossi solo dopo la verifica finale.
