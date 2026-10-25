# Guida operativa — Sito WordPress Giulia Malosso Photography

Questa guida porta dall'installazione del tema fino al sito pronto per essere pubblicato. Seguila **dall'alto verso il basso**: ogni sezione presuppone che le precedenti siano completate.

Tutto si fa dalla bacheca di WordPress (`https://TUO-DOMINIO/wp-admin`). Non serve modificare file del tema.

Convenzioni usate:

- **Aspetto → Menu** = voce del menu laterale di WordPress, poi sottovoce.
- I nomi di template e pattern sono scritti **esattamente** come compaiono in WordPress.
- `[DA INSERIRE…]` e simili = testo segnaposto da sostituire (vedi §4.4).

---

## 0. Ordine di lavoro (checklist principale)

Spunta man mano. Ogni voce rimanda alla sezione della guida.

- [ ] 1. Attivare il tema (§2)
- [ ] 2. Verificare che non ci siano errori (§2.3)
- [ ] 3. Creare le pagine (§5)
- [ ] 4. Verificare i pattern (§6)
- [ ] 5. Home (§7)
- [ ] 6. Menu principale e menu footer (§8)
- [ ] 7. Dati attività, logo e favicon (§9)
- [ ] 8. Pagina Contatti e Privacy (§10, §11)
- [ ] 9. Test del modulo e, se serve, SMTP (§12, §13)
- [ ] 10. Famiglia (§14)
- [ ] 11. Gravidanza (§14)
- [ ] 11b. Newborn (§14)
- [ ] 12. Bambini (§14)
- [ ] 13. Battesimo (§14)
- [ ] 13b. Coppia (§14)
- [ ] 13c. Ritratto (§14)
- [ ] 13d. Commerciale (§14)
- [ ] 14. Mini Sessioni (§15)
- [ ] 15. Buoni regalo (§16)
- [ ] 16. Chi sono (§16)
- [ ] 17. Privacy e Cookie definitive (§18)
- [ ] 18. Plugin SEO (§20)
- [ ] 19. Titoli e descrizioni SEO (§21)
- [ ] 20. Test mobile e accessibilità (§23, §24)
- [ ] 21. Test dei link (§25)
- [ ] 22. Checklist "Pronto a pubblicare" (§27)

---

## 1. Prima di iniziare

### 1.1 Requisiti

- WordPress **6.3 o successivo** (verifica in *Bacheca → Aggiornamenti*). Serve per il blocco "Dettagli" usato nelle FAQ.
- PHP 7.4 o successivo (lo indica l'hosting).
- Nessun plugin obbligatorio. **Non** servono Elementor o altri page builder.

### 1.2 Copia del tema

Conserva sul tuo computer una copia della cartella `giulia-malosso-photography` (o dello ZIP) che stai caricando. Se qualcosa va storto puoi ricaricarla.

### 1.3 Durante la costruzione

> **Attenzione:** mentre lavori, in *Impostazioni → Lettura* lascia spuntato **"Scoraggia i motori di ricerca dall'indicizzare questo sito"**. Va tolto solo alla pubblicazione (§27).

### 1.4 Cosa preparare (contenuti da fornire)

Puoi iniziare a configurare anche senza tutto pronto: i pattern contengono segnaposto. Ma prima della pubblicazione servono:

**Foto** (misure esatte nel §19.1)
- [ ] Hero della Home — orizzontale **2400 × 1350 px**
- [ ] 8 foto per le card dei servizi (Famiglia, Gravidanza, Newborn, Bambini, Battesimo, Coppia, Ritratto, Commerciale) — verticali **1200 × 1500 px**
- [ ] Famiglia: hero 2400 × 1350 + 6–12 foto galleria (1800 × 1200 o 1200 × 1800)
- [ ] Gravidanza: hero 2400 × 1350 + 6–12 foto galleria
- [ ] Newborn: hero 2400 × 1350 + 6–12 foto galleria
- [ ] Bambini: hero 2400 × 1350 + 6–12 foto galleria
- [ ] Battesimo: hero 2400 × 1350 + 6–12 foto galleria
- [ ] Coppia: hero 2400 × 1350 + 6–12 foto galleria
- [ ] Ritratto: hero 2400 × 1350 + 6–12 foto galleria
- [ ] Commerciale: hero 2400 × 1350 + 6–12 foto galleria (prodotti, spazi, persone al lavoro, con il permesso dell'attività)
- [ ] Mini sessioni: per ognuna hero 2400 × 1350 e galleria; 3 foto per le card dell'hub 1200 × 1500
- [ ] Buoni regalo: hero 2400 × 1350
- [ ] Chi sono: ritratto di Giulia 1200 × 1500 (usato anche in Home)
- [ ] Sezione "Non dovete saper posare" (Home e Hub Servizi): 1200 × 1500
- [ ] Logo (§9.2), icona del sito 512 × 512, immagine per i social 1200 × 630

**Testi**
- [ ] Home (introduzioni brevi, area servita)
- [ ] Chi sono (breve storia, perché fotografi le famiglie, studio e territorio)
- [ ] Otto servizi (intro, esperienza)
- [ ] Mini sessioni (descrizioni, a chi sono adatte)
- [ ] Buoni regalo
- [ ] Risposte alle FAQ
- [ ] Recensioni **reali** (con il permesso dei clienti)

**Business**
- [ ] Prezzi e nomi dei pacchetti
- [ ] Durate
- [ ] Foto incluse
- [ ] Date stagionali delle mini sessioni
- [ ] URL della prenotazione online delle mini sessioni
- [ ] Tempi e modalità di consegna delle fotografie
- [ ] Validità e importi dei buoni regalo

**Dati attività**
- [ ] Email
- [ ] Telefono
- [ ] Numero WhatsApp
- [ ] Indirizzo dello studio
- [ ] Partita IVA
- [ ] Link Instagram e Facebook
- [ ] Link della scheda Google Business

---

## 2. Installare il tema

### 2.1 Creare lo ZIP

Comprimi la cartella **`giulia-malosso-photography`** (non la cartella `sito-wordpress` che la contiene).

Su Windows: tasto destro sulla cartella `giulia-malosso-photography` → *Invia a → Cartella compressa*. Ottieni `giulia-malosso-photography.zip`.

> **Attenzione:** aprendo lo ZIP devi vedere la cartella `giulia-malosso-photography` e, al suo interno, `style.css`, `functions.php` e le altre cartelle. Non ci devono essere cartelle in più.

### 2.2 Caricare e attivare

1. *Aspetto → Temi → Aggiungi nuovo tema → Carica tema*.
2. Seleziona `giulia-malosso-photography.zip` → **Installa ora**.
3. Se il tema era già installato in una versione precedente, WordPress mostra un confronto: scegli **"Sostituisci la versione installata con quella caricata"**.
4. **Attiva**.

### 2.3 Controlli subito dopo l'attivazione

- [ ] Il sito si apre senza la scritta "C'è stato un errore critico in questo sito".
- [ ] In *Aspetto → Personalizza* compare la sezione **"Dati attività e contatti"**.
- [ ] In *Pagine → Aggiungi nuova*, nel pannello laterale, l'elenco **Template** contiene **"Landing GMPH"** e **"Contatti"**.
- [ ] Nell'editor, aprendo l'inseritore (§4.3) → scheda **Pattern**, esiste la categoria **"Giulia Malosso"**.

È normale, in questa fase, che:

- l'header mostri solo il nome "Giulia Malosso" (o il logo), **senza menu**: il menu compare quando viene assegnato (§8);
- il footer mostri solo il nome e una breve descrizione: contatti, social e P.IVA compaiono quando vengono compilati (§9);
- la Home mostri solo un elenco di articoli con il titolo **"Guide"** (spesso con il solo articolo "Ciao mondo!" o vuoto) finché non imposti la Home statica (§7).

> **Se il dominio è già raggiungibile dal pubblico**, da questo momento i visitatori vedono il sito in costruzione. Valuta di attivare la modalità manutenzione o "coming soon" dell'hosting (o un plugin dedicato) fino alla pubblicazione.

> **Se compare un errore critico:** in *Aspetto → Temi* riattiva il tema precedente. Se non riesci ad accedere alla bacheca, dal gestore file dell'hosting rinomina la cartella `wp-content/themes/giulia-malosso-photography`: WordPress tornerà a un tema predefinito. Annota il messaggio d'errore e fai correggere il tema.

### 2.4 Dati del vecchio tema

Il tema usa gli stessi campi del prototipo per email, telefono, città, Instagram e Facebook. In *Aspetto → Personalizza → Dati attività e contatti* controlla che non siano rimasti valori di prova (ad esempio `+39 000 000 0000`): se ci sono, cancellali o sostituiscili con dati reali.

---

## 3. Come è organizzato il sito

| Tipo | Uso | Come si crea |
|---|---|---|
| **Pagine** | Home, servizi, mini sessioni, buoni regalo, chi sono, contatti, privacy, cookie | *Pagine → Aggiungi nuova* |
| **Articoli** | Guide evergreen (poche) | *Articoli → Aggiungi nuovo* |
| **Template** | Struttura della pagina | Pannello laterale della pagina |
| **Pattern** | Contenuto di partenza, modificabile | Inseritore blocchi → Pattern → Giulia Malosso |

Template disponibili:

| Template | Quando usarlo | Note |
|---|---|---|
| **Template predefinito** | Privacy, Cookie, Guide, pagine informative | Mostra il titolo della pagina come H1 |
| **Landing GMPH** | Servizi, mini sessioni, buoni regalo, chi sono | **Non** mostra il titolo: l'H1 è dentro il pattern |
| **Contatti** | Solo la pagina Contatti | Aggiunge modulo e recapiti |

La Home usa automaticamente la propria impaginazione (§7): il template scelto per la pagina Home non ha effetto.

---

## 4. Come usare i pattern

### 4.1 Pattern disponibili (categoria "Giulia Malosso")

**Pattern di pagina intera**

| Nome esatto | Per la pagina |
|---|---|
| Home GMPH | Home |
| Hub Servizi | Servizi |
| Pagina Servizio: Famiglia | Famiglia |
| Pagina Servizio: Gravidanza | Gravidanza |
| Pagina Servizio: Newborn | Newborn |
| Pagina Servizio: Bambini | Bambini |
| Pagina Servizio: Battesimo | Battesimo |
| Pagina Servizio: Coppia | Coppia |
| Pagina Servizio: Ritratto | Ritratto |
| Pagina Servizio: Commerciale | Commerciale |
| Hub Mini Sessioni | Mini Sessioni |
| Pagina Mini Sessione: Natale | Natale |
| Pagina Mini Sessione: Autunno | Autunno |
| Pagina Mini Sessione: Festa della Mamma | Festa della Mamma |
| Buoni regalo | Buoni regalo |
| Chi sono | Chi sono |

**Pattern di sezione** (da aggiungere dentro una pagina o un articolo)

| Nome esatto | Uso |
|---|---|
| CTA finale | Invito finale "Raccontami cosa vorresti ricordare" con pulsante verso Contatti |
| Testimonianze | Tre recensioni affiancate |
| FAQ | Domande frequenti con risposte apribili |
| CTA fine guida | Riquadro finale per gli articoli Guide |

### 4.2 Procedura per ogni pagina

1. *Pagine → Aggiungi nuova*.
2. WordPress apre subito la finestra **"Scegli un pattern"**: clicca il pattern indicato in tabella (es. **Pagina Servizio: Famiglia**). Viene inserito e la finestra si chiude.
   - Se la finestra non compare, o l'hai chiusa con la **X**, inserisci il pattern dopo: pulsante **+** in alto a sinistra (inseritore blocchi) → scheda **Pattern** → categoria **"Giulia Malosso"** → clicca il pattern.
3. Scrivi il **titolo** (es. "Famiglia"). Serve per menu, elenco pagine e titolo del browser. Nelle pagine "Landing GMPH" non compare sulla pagina.
4. Apri la barra laterale destra (icona **Impostazioni** in alto a destra, accanto a "Pubblica") → scheda **Pagina** (non "Blocco"). Nella parte alta del pannello:
   - **Template**: clicca "Template predefinito" e scegli il template indicato (es. **Landing GMPH**);
   - **Link / URL**: imposta lo **slug** (es. `famiglia`), solo l'ultima parte dell'indirizzo, senza barre;
   - **Genitore** (es. "Servizi").
   In alcune versioni di WordPress Template e Genitore si trovano nella sezione **"Attributi pagina"**, più in basso nello stesso pannello.
5. Sostituisci immagini e segnaposto (§4.4).
6. **Salva bozza**; quando la pagina è pronta, **Pubblica**.

> Se nell'elenco dei template non compaiono **Landing GMPH** e **Contatti**, il tema installato non è la versione aggiornata: ripeti §2.2 scegliendo "Sostituisci la versione installata con quella caricata".

> **Attenzione:** le pagine devono essere **pubblicate** perché il tema ne mostri i link (footer, pagina 404) e perché il menu funzioni. Finché il motore di ricerca è scoraggiato (§1.3) e il sito non è annunciato, pubblicare non lo rende "pubblico" in senso pratico.

### 4.3 Strumenti utili dell'editor

- **Vista elenco** (icona con tre righe in alto a sinistra): mostra la struttura della pagina e permette di selezionare un blocco annidato, ad esempio l'immagine dentro l'hero.
- **Sostituisci** (barra del blocco immagine): cambia la foto con una della Libreria Media.
- **Anteprima** (in alto a destra): mostra la pagina come la vedranno i visitatori. Alcuni effetti (immagine dietro il testo nell'hero, card cliccabili) si vedono **solo in anteprima**, non nell'editor.
- Per eliminare una sezione intera: selezionala nella Vista elenco → menu "⋮" → **Elimina**.

### 4.4 Segnaposto

I pattern contengono testi tra parentesi quadre da sostituire o eliminare:

| Segnaposto | Significato |
|---|---|
| `[DA INSERIRE: …]` | Contenuto mancante (prezzi, durate, risposte FAQ, recensioni…) |
| `[DA AGGIORNARE: …]` | Dato che cambia nel tempo (stato campagna, date) |
| `[DA VERIFICARE: …]` | Testo già scritto da confermare |
| `[DA ADATTARE: …]` | Testo da personalizzare (CTA delle guide) |
| `[NOTA EDITORIALE …]` | Istruzione per chi modifica: **da eliminare** |

Trucco: nell'**Anteprima** premi `Ctrl+F` (Mac: `Cmd+F`) e cerca `[DA` e `[NOTA`. Prima della pubblicazione non devono esserci risultati.

I blocchi Immagine e Galleria lasciati vuoti **non vengono mostrati** sul sito, ma restano visibili nell'editor come promemoria.

### 4.5 Link dei pulsanti

I pulsanti e le card dei pattern puntano già agli indirizzi della sitemap (es. `/servizi/famiglia/`, `/contatti/`). Funzionano solo se gli **slug sono identici** a quelli della tabella in §5.

I pulsanti verso Contatti delle pagine servizio aggiungono il servizio all'indirizzo (es. `/contatti/?servizio=famiglia`): il modulo si apre con il servizio già selezionato.

> **Attenzione:** i link vengono scritti con l'indirizzo del sito **al momento dell'inserimento del pattern**. Se costruisci il sito su un dominio provvisorio e poi passi a quello definitivo, i link interni vanno aggiornati con lo strumento di cambio dominio dell'hosting o di un plugin di migrazione.

---

## 5. Creare le pagine

Crea tutte le pagine della tabella, anche se il contenuto non è ancora pronto: servono per menu e link. Crea prima le pagine **genitore** (Servizi, Mini Sessioni), poi le figlie.

| Pagina (titolo) | Indirizzo finale | Slug da scrivere | Genitore | Template | Pattern |
|---|---|---|---|---|---|
| Home | `/` | `home` | — | Template predefinito | Home GMPH |
| Servizi | `/servizi/` | `servizi` | — | Landing GMPH | Hub Servizi |
| Famiglia | `/servizi/famiglia/` | `famiglia` | Servizi | Landing GMPH | Pagina Servizio: Famiglia |
| Gravidanza | `/servizi/gravidanza/` | `gravidanza` | Servizi | Landing GMPH | Pagina Servizio: Gravidanza |
| Newborn | `/servizi/newborn/` | `newborn` | Servizi | Landing GMPH | Pagina Servizio: Newborn |
| Bambini | `/servizi/bambini/` | `bambini` | Servizi | Landing GMPH | Pagina Servizio: Bambini |
| Battesimo | `/servizi/battesimo/` | `battesimo` | Servizi | Landing GMPH | Pagina Servizio: Battesimo |
| Coppia | `/servizi/coppia/` | `coppia` | Servizi | Landing GMPH | Pagina Servizio: Coppia |
| Ritratto | `/servizi/ritratto/` | `ritratto` | Servizi | Landing GMPH | Pagina Servizio: Ritratto |
| Commerciale | `/servizi/commerciale/` | `commerciale` | Servizi | Landing GMPH | Pagina Servizio: Commerciale |
| Mini Sessioni | `/mini-sessioni/` | `mini-sessioni` | — | Landing GMPH | Hub Mini Sessioni |
| Natale | `/mini-sessioni/natale/` | `natale` | Mini Sessioni | Landing GMPH | Pagina Mini Sessione: Natale |
| Autunno | `/mini-sessioni/autunno/` | `autunno` | Mini Sessioni | Landing GMPH | Pagina Mini Sessione: Autunno |
| Festa della Mamma | `/mini-sessioni/festa-della-mamma/` | `festa-della-mamma` | Mini Sessioni | Landing GMPH | Pagina Mini Sessione: Festa della Mamma |
| Buoni regalo | `/buoni-regalo/` | `buoni-regalo` | — | Landing GMPH | Buoni regalo |
| Chi sono | `/chi-sono/` | `chi-sono` | — | Landing GMPH | Chi sono |
| Contatti | `/contatti/` | `contatti` | — | Contatti | nessuno (§10) |
| Privacy Policy | `/privacy-policy/` | `privacy-policy` | — | Template predefinito | nessuno (§11) |
| Cookie Policy | `/cookie-policy/` | `cookie-policy` | — | Template predefinito | nessuno (§18) |
| Guide | `/guide/` | `guide` | — | Template predefinito | nessuno, resta vuota (§17) |

> **Non creare** pagine per Matrimonio o altri servizi presenti solo nel gestionale: non fanno parte del sito pubblico.

> **Attenzione agli slug duplicati:** se una pagina con lo stesso slug esiste già (anche nel **Cestino**), WordPress aggiunge `-2` (es. `contatti-2`) e i link si rompono. Prima di creare le pagine:
> - riusa le pagine esistenti con lo stesso nome cambiando template e contenuto;
> - svuota il Cestino delle pagine (*Pagine → Cestino → Svuota cestino*);
> - WordPress crea di solito una **"Privacy Policy"** in bozza e una **"Pagina di esempio"**: usa la prima, elimina la seconda.

Gli slug `servizi`, `contatti` e `cookie-policy` sono usati anche dal tema (pagina 404 e footer): se vengono cambiati, quei link non compaiono.

### 5.1 Pagina per pagina

Segui le schede **in questo ordine**: prima le pagine semplici, poi le pagine genitore (Servizi, Mini Sessioni), infine le figlie. In questa fase basta **creare la struttura**: i contenuti si completano nelle sezioni indicate in fondo a ogni scheda.

Promemoria valido per tutte le schede:

- **Finestra pattern**: compare appena crei la pagina. Se la scheda dice "nessun pattern", chiudila con la **X**.
- **Barra laterale**: icona **Impostazioni** in alto a destra → scheda **Pagina**. Lì trovi **Template**, **Link/URL** (slug) e **Genitore**. In alcune versioni Template e Genitore sono in "Attributi pagina".
- **Slug**: WordPress lo ricava dal titolo (es. "Festa della Mamma" diventa `festa-della-mamma`). Controlla sempre che sia **identico** a quello della scheda. Se il campo non compare, premi **Salva bozza** e riprova.
- **Verifica**: dopo la pubblicazione, clicca **Visualizza pagina** e controlla l'indirizzo nella barra del browser.

> **Consiglio:** prima di creare tutte le pagine, prova il controllo del §6 con un pattern (es. "Pagina Servizio: Famiglia"). Se il pattern dà errore, è meglio saperlo subito.

---

#### Pagina 1 — Home

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Home GMPH**
- [ ] Titolo: `Home`
- [ ] Template: lascia **Template predefinito** (la Home usa comunque la sua impaginazione)
- [ ] Slug: `home` · Genitore: nessuno
- [ ] **Pubblica**
- [ ] Imposta la Home statica: §7.1 (puoi farlo dopo aver creato anche la pagina Guide)

Contenuti: §7.2.

#### Pagina 2 — Guide

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **nessun pattern** (chiudi con la X)
- [ ] Titolo: `Guide`
- [ ] Contenuto: **lascia vuoto**
- [ ] Template: **Template predefinito**
- [ ] Slug: `guide` · Genitore: nessuno
- [ ] **Pubblica**
- [ ] Ora completa §7.1: *Impostazioni → Lettura* → Una pagina statica → Homepage **Home**, Pagina articoli **Guide** → Salva
- [ ] Verifica: l'indirizzo principale del sito mostra la Home (non più "Guide")

Impostazione degli indirizzi delle guide: §17.

#### Pagina 3 — Privacy Policy

WordPress di solito ha già una pagina **"Privacy Policy"** in bozza: usa quella.

- [ ] *Pagine* → apri **Privacy Policy** (se non esiste: *Pagine → Aggiungi nuova*, nessun pattern)
- [ ] Titolo: `Privacy Policy`
- [ ] Template: **Template predefinito**
- [ ] Slug: `privacy-policy` · Genitore: nessuno
- [ ] Contenuto: per ora può restare il testo provvisorio di WordPress, da sostituire prima della pubblicazione del sito (§11)
- [ ] **Pubblica**
- [ ] *Impostazioni → Privacy* → seleziona **Privacy Policy** → **Usa questa pagina**

#### Pagina 4 — Cookie Policy

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **nessun pattern**
- [ ] Titolo: `Cookie Policy`
- [ ] Template: **Template predefinito**
- [ ] Slug: `cookie-policy` · Genitore: nessuno
- [ ] Contenuto: anche solo una riga provvisoria; testo definitivo al §18
- [ ] **Pubblica**
- [ ] Verifica: in fondo al footer compare il link "Cookie policy"

#### Pagina 5 — Contatti

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **nessun pattern**
- [ ] Titolo: `Contatti`
- [ ] Contenuto: 2–3 righe di rassicurazione ed eventuali tempi di risposta
- [ ] Template: **Contatti**
- [ ] Slug: `contatti` · Genitore: nessuno
- [ ] **Pubblica**
- [ ] Verifica: la pagina mostra il modulo con i campi Nome, Email, Telefono, Servizio di interesse, Periodo desiderato, Messaggio e la casella privacy

Recapiti e test: §9, §10, §12.

#### Pagina 6 — Servizi (genitore)

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Hub Servizi**
- [ ] Titolo: `Servizi`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `servizi` · Genitore: nessuno
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/servizi/`; titolo grande "Servizi fotografici" e il titolo della pagina **non** ripetuto sopra

Contenuti: §14.1.

#### Pagina 7 — Famiglia

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Pagina Servizio: Famiglia**
- [ ] Titolo: `Famiglia`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `famiglia` · Genitore: **Servizi**
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/servizi/famiglia/`; titolo grande "Servizio fotografico di famiglia a Maser, Treviso"

Contenuti: §14.2.

#### Pagina 8 — Gravidanza

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Pagina Servizio: Gravidanza**
- [ ] Titolo: `Gravidanza`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `gravidanza` · Genitore: **Servizi**
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/servizi/gravidanza/`

Contenuti: §14.2.

#### Pagina 8b — Newborn

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Pagina Servizio: Newborn**
- [ ] Titolo: `Newborn`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `newborn` · Genitore: **Servizi**
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/servizi/newborn/`

Contenuti: §14.2.

#### Pagina 9 — Bambini

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Pagina Servizio: Bambini**
- [ ] Titolo: `Bambini`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `bambini` · Genitore: **Servizi**
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/servizi/bambini/`

Contenuti: §14.2.

#### Pagina 10 — Battesimo

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Pagina Servizio: Battesimo**
- [ ] Titolo: `Battesimo`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `battesimo` · Genitore: **Servizi**
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/servizi/battesimo/`

Contenuti: §14.2.

#### Pagine 10b, 10c, 10d — Coppia, Ritratto, Commerciale

Stessa procedura per ciascuna, sempre con genitore **Servizi** e template **Landing GMPH**:

| Titolo | Pattern | Slug | Verifica indirizzo |
|---|---|---|---|
| `Coppia` | Pagina Servizio: Coppia | `coppia` | `/servizi/coppia/` |
| `Ritratto` | Pagina Servizio: Ritratto | `ritratto` | `/servizi/ritratto/` |
| `Commerciale` | Pagina Servizio: Commerciale | `commerciale` | `/servizi/commerciale/` |

- [ ] Coppia creata e pubblicata
- [ ] Ritratto creata e pubblicata
- [ ] Commerciale creata e pubblicata

Contenuti: §14.2.

#### Pagina 11 — Mini Sessioni (genitore)

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Hub Mini Sessioni**
- [ ] Titolo: `Mini Sessioni`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `mini-sessioni` · Genitore: nessuno
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/mini-sessioni/`

Contenuti: §15.1.

#### Pagina 12 — Natale

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Pagina Mini Sessione: Natale**
- [ ] Titolo: `Natale`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `natale` · Genitore: **Mini Sessioni**
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/mini-sessioni/natale/`

Contenuti e gestione campagna: §15.2.

#### Pagina 13 — Autunno

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Pagina Mini Sessione: Autunno**
- [ ] Titolo: `Autunno`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `autunno` · Genitore: **Mini Sessioni**
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/mini-sessioni/autunno/`

Contenuti: §15.2.

#### Pagina 14 — Festa della Mamma

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Pagina Mini Sessione: Festa della Mamma**
- [ ] Titolo: `Festa della Mamma`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `festa-della-mamma` · Genitore: **Mini Sessioni**
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/mini-sessioni/festa-della-mamma/`

Contenuti: §15.2.

#### Pagina 15 — Buoni regalo

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Buoni regalo**
- [ ] Titolo: `Buoni regalo`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `buoni-regalo` · Genitore: nessuno
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/buoni-regalo/`; titolo grande "Regala un servizio fotografico"

Contenuti: §16.1.

#### Pagina 16 — Chi sono

- [ ] *Pagine → Aggiungi nuova*
- [ ] Finestra pattern: **Chi sono**
- [ ] Titolo: `Chi sono`
- [ ] Template: **Landing GMPH**
- [ ] Slug: `chi-sono` · Genitore: nessuno
- [ ] **Pubblica**
- [ ] Verifica: indirizzo `/chi-sono/`; titolo grande "Ciao, sono Giulia"

Contenuti: §16.2.

---

#### Controllo finale delle pagine

- [ ] In *Pagine* le figlie compaiono indentate sotto il genitore (es. "— Famiglia" sotto "Servizi").
- [ ] Nessuno slug termina con `-2`.
- [ ] La "Pagina di esempio" di WordPress è stata eliminata e il Cestino svuotato.
- [ ] Le pagine con template **Landing GMPH** non mostrano il titolo della pagina sopra l'hero.
- [ ] Prosegui con il **§6 Controllo dei pattern**, poi con i **menu (§8)**.

---

## 6. Controllo dei pattern

Il tema non è ancora stato provato dentro WordPress: prima di riempire le pagine, verifica che ogni pattern sia valido.

Procedura consigliata: crea una pagina di prova in **bozza** (es. "Prova pattern"), inserisci un pattern alla volta, poi elimina la pagina.

Per **ogni** pattern dell'elenco in §4.1:

- [ ] Inserirlo.
- [ ] **Salvare la bozza.**
- [ ] **Ricaricare** la pagina dell'editor (F5) e riaprirla.
- [ ] Verificare che non compaia il messaggio **"Il blocco contiene contenuto inatteso o non valido"**.
- [ ] Verificare i blocchi **Immagine**: si può scegliere una foto dalla Libreria Media.
- [ ] Verificare il blocco **Galleria** (pagine servizio e mini sessione): si possono aggiungere foto.
- [ ] Verificare i blocchi **Dettagli** delle FAQ: domanda e risposta modificabili, apertura e chiusura in anteprima.
- [ ] Aprire l'**Anteprima** e controllare che la pagina si veda correttamente.

> **Attenzione:** se compare l'errore di blocco non valido **non usare "Tenta il recupero"** come soluzione definitiva. Annota il nome del pattern e il blocco coinvolto e fai correggere il codice del tema. Le pagine già create con quel pattern andranno ricontrollate dopo la correzione.

---

## 7. Home

### 7.1 Impostazione

1. Crea la pagina **Home** (slug `home`) e inserisci il pattern **Home GMPH**.
2. Pubblica.
3. *Impostazioni → Lettura* → "La tua homepage mostra": **Una pagina statica**.
   - Homepage: **Home**
   - Pagina articoli: **Guide**
4. **Salva le modifiche**.
5. Apri l'indirizzo principale del sito: deve comparire il contenuto della pagina Home.

> **Attenzione:** non impostare "Gli ultimi articoli" come homepage. Il tema mostrerebbe un elenco di articoli al posto della Home.

### 7.2 Contenuti da completare (dall'alto)

- [ ] **Hero**: foto principale (§19), H1 "Fotografa di famiglia, gravidanza e bambini a Maser, Treviso", sottotitolo, pulsanti "Scopri i servizi" e "Chiedi informazioni".
- [ ] **Servizi** ("Il vostro momento, raccontato con naturalezza"): una foto per ciascuna delle 8 card. Testi brevi già presenti, modificabili. Se la Home era già stata creata con meno card, vedi §14.1.
- [ ] **Approccio** ("Non dovete saper posare"): foto e testo.
- [ ] **Come funziona**: 4 passaggi. Nel quarto sostituisci `[DA INSERIRE: tempi e modalità di consegna]`.
- [ ] **Testimonianze** ("Cosa dicono le famiglie"): sostituisci i 3 segnaposto con recensioni reali, oppure **elimina la sezione** finché non le hai.
- [ ] **Mini sessioni**: il riquadro "In evidenza" va aggiornato con la campagna attiva o **eliminato** se non ce ne sono.
- [ ] **Buono regalo** ("Un ricordo da regalare"): testo già presente.
- [ ] **Chi sono** ("Ciao, sono Giulia"): ritratto.
- [ ] **Area servita** ("Dove lavoro"): verifica il testo ed elimina `[DA VERIFICARE: …]`.
- [ ] **CTA finale** ("Raccontami cosa vorresti ricordare").

---

## 8. Menu

Il tema registra due posizioni: **"Menu principale"** (fino a 2 livelli) e **"Menu footer"** (1 livello). Senza un menu assegnato, l'header non mostra la navigazione e il footer non mostra la colonna "Esplora".

### 8.1 Menu principale

1. *Aspetto → Menu* → **crea un nuovo menu**, nome "Menu principale" → **Crea menu**.
2. Lascia **non spuntata** l'opzione "Aggiungi automaticamente nuove pagine di primo livello".
3. Nel riquadro **Pagine** (scheda "Mostra tutte") seleziona: Home, Servizi, Famiglia, Gravidanza, Newborn, Bambini, Battesimo, Coppia, Ritratto, Commerciale, Mini Sessioni, Natale, Autunno, Festa della Mamma, Buoni regalo, Chi sono, Contatti → **Aggiungi al menu**.
4. Trascina le voci nell'ordine indicato sotto. Per creare un **sottomenu** trascina la voce leggermente **verso destra** sotto la voce padre: apparirà indentata con la dicitura "sottovoce".
5. In **Impostazioni menu → Posizione del tema** spunta **"Menu principale"**.
6. **Salva menu**.

```
Home
Servizi
    Famiglia
    Gravidanza
    Newborn
    Bambini
    Battesimo
    Coppia
    Ritratto
    Commerciale
Mini Sessioni
    Natale
    Autunno
    Festa della Mamma
Buoni regalo
Chi sono
Contatti
```

Comportamento atteso:

- **Computer**: "Servizi" e "Mini Sessioni" sono cliccabili (portano alle pagine hub) e aprono il sottomenu al passaggio del mouse o con la tastiera.
- **Smartphone e tablet** (schermi fino a 1000 px): il menu si apre con il pulsante a tre linee e mostra le sottovoci già aperte, rientrate.

### 8.2 Menu footer

1. *Aspetto → Menu* → **crea un nuovo menu**, nome "Menu footer".
2. Aggiungi, **tutte allo stesso livello** (il footer non mostra sottovoci): Servizi, Mini Sessioni, Buoni regalo, Chi sono, Contatti, Guide.
3. **Posizione del tema**: spunta **"Menu footer"** → **Salva menu**.

> **Non aggiungere** Privacy e Cookie al menu footer: il tema le mostra già in fondo al footer, accanto al copyright (§11, §18). Inserirle anche qui le duplicherebbe.

In alternativa, le posizioni si assegnano anche dalla scheda **Gestisci posizioni** in *Aspetto → Menu*.

---

## 9. Dati attività, logo e favicon

### 9.1 Dati attività

*Aspetto → Personalizza → **Dati attività e contatti*** → compila → **Pubblica**.

| Campo (nome esatto) | Dove compare | Note |
|---|---|---|
| Email (riceve anche le richieste del modulo) | Footer, pagina Contatti | **Destinatario del modulo**. Se vuoto, il modulo invia all'email dell'amministratore WordPress |
| Telefono | Footer, pagina Contatti | Cliccabile da smartphone |
| Numero WhatsApp (con prefisso, es. +39…) | Footer e Contatti come "Scrivimi su WhatsApp" | Con prefisso internazionale, es. `+39 333 1234567` |
| Località (es. Maser, Treviso) | Footer e Contatti **solo se l'indirizzo è vuoto** | |
| Indirizzo studio | Footer, Contatti (voce "Studio") | |
| Partita IVA | Fondo del footer, dopo il copyright | |
| URL Instagram | Footer, Contatti | URL completo con `https://` |
| URL Facebook | Footer | Non compare nella pagina Contatti |
| URL Google Business / Maps | Footer ("Trovami su Google"), Contatti ("Apri in Google Maps", sotto l'indirizzo) | |

> **Se un campo resta vuoto, il tema non lo mostra.** Non inserire valori di prova o finti: verrebbero pubblicati così come sono.

### 9.2 Logo

*Aspetto → Personalizza → **Identità del sito*** → **Seleziona logo**. File **PNG con sfondo trasparente, alto 112 px** (larghezza proporzionale, indicativamente 300–500 px). Nell'header viene mostrato alto al massimo 56 px: i 112 px servono per una resa nitida sugli schermi ad alta densità. Se WordPress propone di ritagliare l'immagine, scegli **Salta ritaglio**. Senza logo l'header mostra il testo "Giulia Malosso".

### 9.3 Icona del sito (favicon)

Nella stessa sezione *Identità del sito* → **Icona del sito**: PNG quadrato **512 × 512 px**. È l'icona mostrata nelle schede del browser e sullo smartphone.

---

## 10. Pagina Contatti

### 10.1 Creazione

1. *Pagine → Aggiungi nuova* → titolo **"Contatti"**, slug `contatti`, template **Contatti**.
2. Nel contenuto scrivi solo **poche righe di rassicurazione** ed eventualmente i **tempi di risposta** (es. entro quanto rispondi). Nessun pattern: modulo e recapiti li aggiunge il template.
3. Pubblica.

La pagina mostra, nell'ordine:

1. il titolo della pagina (H1);
2. il tuo testo;
3. il modulo;
4. il riquadro **"Altri modi per contattarmi"**, solo con i dati compilati in §9: pulsante "Scrivimi su WhatsApp", Email, Telefono, Instagram, Studio (indirizzo o località, con "Apri in Google Maps").

### 10.2 Campi del modulo

| Campo | Obbligatorio | Note |
|---|---|---|
| Nome | Sì | |
| Email | Sì | Deve essere valida |
| Telefono | No | |
| Servizio di interesse | Sì | Famiglia, Gravidanza, Newborn, Bambini, Battesimo, Coppia, Ritratto, Commerciale / attività, Mini sessioni, Buono regalo, Altro |
| Periodo desiderato | No | Testo libero |
| Messaggio | Sì | Max 5.000 caratteri |
| Privacy | Sì | Casella non preselezionata (§11) |

Il modulo:

- invia un'email al destinatario (§9.1) con oggetto "Nuova richiesta dal sito: [servizio] – [nome]";
- imposta come **"Rispondi a"** l'email del visitatore: puoi rispondere direttamente dalla tua casella;
- **non salva** i messaggi in WordPress e **non iscrive** a newsletter;
- ha una protezione antispam invisibile (campo trappola).

### 10.3 Verifiche

- [ ] Il pulsante "Scrivimi su WhatsApp" apre la chat con il numero corretto.
- [ ] Il link email apre il programma di posta con l'indirizzo corretto.
- [ ] Il link Instagram apre il profilo corretto.
- [ ] "Apri in Google Maps" apre la scheda corretta.

---

## 11. Privacy Policy

Una bozza da completare è nel file **`sito-wordpress/privacy-policy.md`** (fuori dalla cartella del tema).

**Prima di inserirla**

- [ ] Sostituisci tutti i `[DA INSERIRE]` e `[DA VERIFICARE]` (titolare, indirizzo, P.IVA, email, fornitori, tempi di conservazione, data).
- [ ] Elimina le sezioni marcate `[DA MANTENERE SOLO SE…]` che non ti riguardano (prenotazione online, newsletter, Cloudflare Turnstile), oppure togli solo la dicitura se le mantieni.
- [ ] Falla verificare da un consulente privacy: è una bozza basata sul funzionamento del sito, non una consulenza legale.

**Inserimento in WordPress**

1. Apri il file `privacy-policy.md` con un editor di testo (anche VS Code o Blocco note), seleziona tutto **dalla riga "Informativa sul trattamento…" in poi** e copia. Il titolo "Privacy Policy" non serve: lo mostra già la pagina.
2. *Pagine* → apri **Privacy Policy** (la bozza creata da WordPress, oppure una nuova pagina con slug `privacy-policy`, nessun pattern, **Template predefinito**).
3. Cancella il testo di esempio di WordPress: clicca nel contenuto, `Ctrl+A` due volte, `Canc`.
4. Clicca nel primo paragrafo vuoto e incolla con `Ctrl+V`. L'editor converte automaticamente titoli (`##`), grassetti ed elenchi in blocchi.
5. Controlla il risultato:
   - le sezioni "1. Titolare del trattamento", "2. Quali dati raccolgo"… devono essere **Titoli H2**, le sottosezioni "2.1…" **Titoli H3**;
   - non devono comparire simboli `#`, `**` o `*`: se ci sono, il blocco non è stato convertito. Seleziona il blocco → icona di trasformazione → **Titolo** o **Elenco**;
   - il link alla Cookie Policy deve puntare alla pagina reale: seleziona le parole "Cookie Policy" → icona link → cerca **Cookie Policy**.
6. **Pubblica** (o **Aggiorna**).
7. *Impostazioni → Privacy* → seleziona **Privacy Policy** → **Usa questa pagina**.

**Verifiche**

- [ ] in fondo al footer compare il link alla Privacy Policy;
- [ ] nel modulo Contatti, le parole "informativa privacy" sono un link che apre la pagina corretta (in una nuova scheda);
- [ ] nella pagina pubblicata non restano `[DA INSERIRE]` né `[DA MANTENERE…]` (`Ctrl+F` → cerca `[DA`).

> **Attenzione:** il tema **non contiene** un testo legale. La bozza descrive il sito come è oggi: se aggiungi plugin o servizi (statistiche, mappe incorporate, video, chat, newsletter), l'informativa va aggiornata. Il link nel modulo compare solo se la pagina è **pubblicata e impostata** in *Impostazioni → Privacy*.

Il consenso del modulo serve **solo** a rispondere alla richiesta: non è un consenso marketing.

---

## 12. Test del modulo contatti

Da fare **prima** di considerare il sito pronto, e di nuovo dopo ogni modifica alla configurazione email.

1. Apri `/contatti/` in una **finestra anonima** del browser (senza essere connessa a WordPress).
2. **Campo obbligatorio vuoto**: prova a inviare lasciando vuoto Nome. Il **browser** blocca l'invio con un suo avviso. È corretto.
3. **Controllo del sito**: scrivi nel campo Nome **solo degli spazi**, compila il resto e invia. Deve comparire in alto il messaggio "Controlla i campi indicati e invia di nuovo la richiesta." e, sotto il campo, "Inserisci il tuo nome.".
   - Nota: dopo un errore il modulo si ripresenta **vuoto** e va ricompilato.
4. Compila tutto correttamente, spunta la privacy e invia.
5. Deve comparire: "Grazie, la tua richiesta è stata inviata. Ti risponderò il prima possibile." e il modulo scompare.
6. **Controlla che l'email arrivi davvero** nella casella del destinatario (§9.1), **anche nello spam**.
7. Clicca "Rispondi" nell'email ricevuta: il destinatario deve essere l'indirizzo inserito nel modulo.
8. Prova un pulsante "Chiedi informazioni" di una pagina servizio: il campo Servizio deve essere già selezionato.

Possibili esiti:

| Cosa vedi | Significato | Cosa fare |
|---|---|---|
| "Grazie…" ed email arrivata | Funziona | Nulla |
| "Grazie…" ma l'email non arriva | WordPress ha consegnato il messaggio al server, che non lo recapita | Configura SMTP (§13) |
| "Non è stato possibile inviare la richiesta…" | L'invio email del server non funziona | Configura SMTP (§13) |
| "Il modulo è scaduto…" | Il token di sicurezza della pagina è scaduto, spesso per la cache | Ricarica la pagina; se si ripete vedi §13.2 |

---

## 13. SMTP (invio email affidabile)

### 13.1 Configurazione

L'invio standard di WordPress dipende dal server dell'hosting e spesso finisce in spam o non parte. Per un sito pubblico è consigliato un plugin SMTP, che invia le email tramite un servizio di posta autenticato.

1. *Plugin → Aggiungi nuovo* → installa **un solo** plugin SMTP affidabile (cerca "SMTP").
2. Collegalo al servizio di posta scelto (la casella dell'hosting o un servizio di invio), seguendo la procedura guidata del plugin.
3. Esegui il **test email** del plugin.
4. Ripeti il test del modulo Contatti (§12).

### 13.2 Cache

> **Attenzione:** se il sito usa un plugin o un servizio di **cache di pagina** e compare il messaggio "Il modulo è scaduto…", escludi la pagina **Contatti** dalla cache. Il modulo contiene un token di sicurezza con scadenza che non deve essere memorizzato.

---

## 14. Servizi

### 14.1 Hub Servizi (`/servizi/`)

Pattern **Hub Servizi**: introduzione con H1 "Servizi fotografici", 8 card (Famiglia, Gravidanza, Newborn, Bambini, Battesimo, Coppia, Ritratto, Commerciale), sezione "Non dovete saper posare", CTA finale. Su computer le card sono disposte 4 per riga.

- [ ] Foto delle 8 card.
- [ ] Foto della sezione sull'approccio.
- [ ] Verifica dei testi brevi.

> **Home o Servizi create con meno card?** Le pagine già create non si aggiornano da sole: il pattern viene copiato nella pagina al momento dell'inserimento.
>
> **Se non le hai ancora personalizzate** (solo segnaposto), la via più semplice è reinserire il pattern: apri la pagina → **Vista elenco** → seleziona il primo blocco, tieni premuto **Maiusc** e seleziona l'ultimo → menu "⋮" → **Elimina** → inserisci di nuovo il pattern (**Home GMPH** o **Hub Servizi**) dal pulsante **+** → **Pattern** → "Giulia Malosso" → **Aggiorna**.
>
> **Se le hai già personalizzate**, aggiungi a mano le card mancanti, in **Home** e in **Servizi**:
> 1. Apri la pagina → **Vista elenco** → espandi la sezione delle card (Gruppo → Colonne) e seleziona una voce **Colonna** (non il "Gruppo" che sta dentro: duplicando il Gruppo la nuova card finisce nella stessa colonna, sotto l'altra).
> 2. Menu "⋮" della barra del blocco → **Duplica**: la copia compare subito dopo. Per spostarla usa le frecce della barra del blocco.
> 3. Nella copia: **Sostituisci** l'immagine, cambia il titolo (es. `Coppia`) e la frase sotto.
> 4. Seleziona il titolo → icona **Link** → imposta l'indirizzo della pagina (`/servizi/newborn/`, `/servizi/coppia/`, `/servizi/ritratto/`, `/servizi/commerciale/`).
> 5. Ripeti per ogni servizio mancante, poi **Aggiorna** e controlla in **Anteprima** che ogni card porti alla pagina giusta.
>
> In Servizi aggiorna anche la frase introduttiva con l'elenco completo dei servizi.

### 14.2 Pagine servizio

| Pagina | Pattern | H1 già presente |
|---|---|---|
| Famiglia | Pagina Servizio: Famiglia | Servizio fotografico di famiglia a Maser, Treviso |
| Gravidanza | Pagina Servizio: Gravidanza | Servizio fotografico gravidanza a Maser, Treviso |
| Newborn | Pagina Servizio: Newborn | Servizio fotografico newborn a Maser, Treviso |
| Bambini | Pagina Servizio: Bambini | Servizio fotografico bambini a Maser, Treviso |
| Battesimo | Pagina Servizio: Battesimo | Fotografo per battesimi a Maser e Treviso |
| Coppia | Pagina Servizio: Coppia | Servizio fotografico di coppia a Maser, Treviso |
| Ritratto | Pagina Servizio: Ritratto | Servizio fotografico ritratto a Maser, Treviso |
| Commerciale | Pagina Servizio: Commerciale | Fotografia commerciale per attività a Maser e Treviso |

> **Commerciale**: "Come funziona", titolo delle recensioni e CTA finale sono già scritti per le attività. Adatta però la sezione "Dove lavoro", che parla di famiglie (es. "Lavoro con negozi e attività di…"), e completa nelle FAQ l'uso consentito delle foto e la fatturazione.

Ogni pagina ha la stessa struttura. Da completare:

- [ ] **Hero**: foto (§19), sottotitolo, pulsante "Chiedi informazioni" (porta a Contatti con il servizio già selezionato).
- [ ] **Intro**: titolo già presente + 2–3 frasi al posto di `[DA INSERIRE]`.
- [ ] **Esperienza** ("Com'è l'esperienza"): 3 punti; completa quelli con `[DA INSERIRE]`.
- [ ] **Processo** ("Come funziona"): 4 passaggi; completa i tempi di consegna.
- [ ] **Pacchetti**: 3 card con nome, prezzo, durata, foto incluse, descrizione. Duplica o elimina card secondo il listino reale. I prezzi sono testo modificabile: quando cambia il listino si aggiornano qui.
- [ ] **Galleria** ("Alcune fotografie"): 6–12 foto del servizio.
- [ ] **Testimonianze**: 2 recensioni reali oppure elimina la sezione.
- [ ] **FAQ**: 5 domande già impostate; completa le risposte `[DA INSERIRE: risposta]`. Per aggiungere una domanda duplica un blocco Dettagli; per toglierla eliminalo.
- [ ] **Zona** ("Dove lavoro"): verifica il testo ed elimina `[DA VERIFICARE: …]`.
- [ ] **CTA finale**: verifica il testo.

---

## 15. Mini Sessioni

### 15.1 Hub Mini Sessioni (`/mini-sessioni/`)

Pattern **Hub Mini Sessioni**: H1 "Mini sessioni fotografiche a Maser, Treviso"; cosa sono e quando vengono proposte; confronto "Mini sessione o servizio completo?"; 3 card (Festa della Mamma, Autunno, Natale); FAQ; CTA.

- [ ] Periodi indicativi e "A chi sono adatte" (`[DA INSERIRE]`).
- [ ] Foto e breve descrizione delle 3 card.
- [ ] Risposte alle FAQ.

### 15.2 Pagine Natale, Autunno, Festa della Mamma

Pattern: **Pagina Mini Sessione: Natale**, **…: Autunno**, **…: Festa della Mamma**. Struttura: hero, riquadro "Stato prenotazioni", "Di cosa si tratta", "Cosa include" (durata, fotografie incluse, prezzo), galleria, "Come funziona", FAQ, CTA.

> **Gli indirizzi sono evergreen.** Esiste **una sola pagina** per ogni mini sessione (es. `/mini-sessioni/natale/`), aggiornata ogni anno. **Non creare** pagine come `/natale-2027/`.

Da aggiornare **ogni anno**:

- [ ] Stato prenotazioni (titolo del riquadro).
- [ ] Date.
- [ ] Prezzo, durata, fotografie incluse.
- [ ] Foto (hero e galleria) dell'edizione più recente.
- [ ] Testo e link dei pulsanti.
- [ ] Riquadro "In evidenza" della Home (§7.2).

**Con prenotazioni aperte**

- Riquadro: "Prenotazioni aperte" + date.
- Pulsanti dell'hero e della CTA finale: testo **"Scegli la tua data"**, link alla **pagina di prenotazione online**.

Il pattern li collega inizialmente alla pagina Contatti: sostituisci il link con l'URL della prenotazione (seleziona il pulsante → icona del link → incolla l'URL).

**Con prenotazioni chiuse**

- La pagina **resta online**.
- Riquadro: "Prenotazioni chiuse" (o data della prossima edizione, se nota).
- Pulsanti: testo come "Avvisami per la prossima edizione" o "Chiedimi informazioni", link a `/contatti/`.

> Elimina sempre il paragrafo `[NOTA EDITORIALE …]` del riquadro stato: è un'istruzione, non un testo per i visitatori.

---

## 16. Buoni regalo e Chi sono

### 16.1 Buoni regalo (`/buoni-regalo/`)

Pattern **Buoni regalo**: hero con H1 "Regala un servizio fotografico" e pulsante "Richiedi un buono regalo" (porta a Contatti con "Buono regalo" già selezionato); "Perché regalare fotografie"; "Come funziona"; "Due tipi di buono" (a valore, per un servizio); validità e destinatari; FAQ; CTA.

- [ ] Foto dell'hero.
- [ ] Perché regalare fotografie.
- [ ] Come viene preparato e consegnato il buono.
- [ ] Importi disponibili.
- [ ] Validità e a chi può essere regalato.
- [ ] Risposte alle FAQ.

### 16.2 Chi sono (`/chi-sono/`)

Pattern **Chi sono**: ritratto + H1 "Ciao, sono Giulia" + breve presentazione; "La mia storia", "Perché fotografo le famiglie", "Il mio modo di lavorare", "Lo studio e il territorio"; CTA "Conosciamoci".

- [ ] Ritratto.
- [ ] Breve storia (poche righe).
- [ ] Perché fotografi le famiglie.
- [ ] Lo studio e il territorio.

---

## 17. Guide

Le guide sono normali **Articoli** WordPress: poche, utili e durature (es. come vestirsi per un servizio di famiglia).

### 17.1 Pagina Guide

- La pagina **Guide** (slug `guide`) resta **vuota**: WordPress la usa per mostrare l'elenco degli articoli.
- È già impostata come "Pagina articoli" in §7.1. Il titolo dell'elenco sarà il titolo della pagina ("Guide").

### 17.2 Indirizzi tipo `/guide/nome-articolo/`

WordPress lo consente con la struttura dei permalink personalizzata:

1. *Impostazioni → Permalink* → **Struttura personalizzata**.
2. Scrivi: `/guide/%postname%/`
3. **Salva le modifiche**.

Effetti:

- gli articoli avranno indirizzi tipo `/guide/come-vestirsi-servizio-famiglia/`;
- **le pagine non cambiano** indirizzo;
- anche gli archivi di categorie, tag e date avranno il prefisso `/guide/` (es. `/guide/category/…`): è normale.

> **Attenzione:** imposta i permalink **prima** di pubblicare articoli, così i loro indirizzi non cambiano dopo. Dopo il salvataggio verifica che `/guide/` mostri l'elenco e che un articolo si apra al suo indirizzo. Se compare "Pagina non trovata", torna in *Impostazioni → Permalink* e premi di nuovo **Salva le modifiche**.

### 17.3 Scrivere una guida

1. *Articoli → Aggiungi nuovo*.
2. Imposta un'**immagine in evidenza** (pannello laterale): compare in alto nell'articolo e nell'elenco Guide.
3. Nel testo collega la pagina servizio pertinente.
4. In fondo inserisci il pattern **CTA fine guida** e adatta i testi `[DA ADATTARE]`.
5. Elimina l'articolo di esempio "Ciao mondo!" creato da WordPress.

---

## 18. Cookie Policy

1. Pagina **Cookie Policy**, slug `cookie-policy`, template predefinito.
2. Inserisci il testo e **pubblica**: il link compare automaticamente in fondo al footer.

> **Attenzione:** il tema non fornisce un testo legale. Il contenuto va **finalizzato prima della pubblicazione** in base ai servizi e ai plugin realmente attivi (es. plugin SEO, SMTP, statistiche, incorporamenti di contenuti esterni). Ricorda anche i font caricati da Google (§19.5).

---

## 19. Immagini

### 19.1 Misure esatte per ogni posizione

Esporta ogni foto **già nella proporzione e nella misura della tabella**. Così il ritaglio fatto dal sito è prevedibile e il file non è più pesante del necessario. Le misure sono il doppio della dimensione massima a cui la foto viene mostrata, per essere nitide anche sugli schermi ad alta densità (smartphone, Mac).

| Posizione | Dove | Orientamento e proporzione | Misura da esportare (px) | Peso massimo indicativo |
|---|---|---|---|---|
| **Hero** | Prima sezione di Home, servizi, mini sessioni, buoni regalo | Orizzontale **16:9** | **2400 × 1350** | 400 KB |
| **Card** | Card dei servizi (Home, Hub Servizi), card dell'Hub Mini Sessioni | Verticale **4:5** | **1200 × 1500** | 250 KB |
| **Ritratto e foto affiancate al testo** | "Ciao, sono Giulia" (Home, Chi sono), "Non dovete saper posare" (Home, Hub Servizi) | Verticale **4:5** | **1200 × 1500** | 250 KB |
| **Galleria** | "Alcune fotografie" (servizi e mini sessioni) | **Tutte uguali nella stessa galleria**: orizzontali **3:2** oppure verticali **2:3** | **1800 × 1200** oppure **1200 × 1800** | 300 KB |
| **Immagine in evidenza delle guide** | In cima all'articolo e nell'elenco Guide | Orizzontale **3:2** | **1800 × 1200** | 300 KB |
| **Immagine per i social** | Condivisioni su Facebook/WhatsApp (plugin SEO, §20) | Orizzontale **1,91:1** | **1200 × 630** | 300 KB |
| **Logo** | Header | Orizzontale, PNG trasparente | **altezza 112**, larghezza proporzionale | 50 KB |
| **Icona del sito** | Scheda del browser | Quadrata, PNG | **512 × 512** | 50 KB |

Impostazioni di esportazione uguali per tutte le foto:

- formato **JPG**, qualità **75–82** (in Lightroom: "Qualità 80");
- profilo colore **sRGB** (con Adobe RGB o ProPhoto i colori sul web risultano spenti);
- nitidezza in uscita "per schermo", livello basso o standard;
- se il peso supera quello indicato, abbassa la qualità di qualche punto, non la misura;
- nome file descrittivo, minuscolo, con trattini: `famiglia-prato-maser.jpg`.

Perché queste proporzioni:

- **Card**: il sito le ritaglia sempre in 4:5. Una foto in un'altra proporzione verrebbe tagliata automaticamente al centro, con risultati poco controllabili.
- **Galleria**: le foto vengono affiancate in righe di uguale altezza e ritagliate. Mescolando orizzontali e verticali i tagli diventano casuali.
- **Elenco Guide**: le immagini in evidenza vengono ritagliate in 3:2.
- **Ritratto e foto affiancate**: non vengono ritagliate, quindi la proporzione 4:5 serve ad avere un aspetto uniforme tra Home e Chi sono.

Cosa fa WordPress dopo il caricamento:

- crea automaticamente versioni più piccole (larghe 300, 768, 1024, 1536 e 2048 px quando la foto è abbastanza grande) e il tema fa scegliere al browser quella adatta allo schermo;
- riduce le foto più larghe di 2560 px ma **conserva comunque l'originale** sul server: con le misure della tabella questo non succede;
- **WebP**: WordPress accetta file WebP ma **non converte** i JPG in WebP. Puoi caricare direttamente WebP esportati alle stesse misure, se il tuo programma lo permette.

> **Non caricare gli originali della fotocamera** (6000 px, 10–20 MB): rallentano il sito e occupano spazio senza alcun beneficio visibile.

### 19.2 Caricamento e sostituzione

1. *Media → Aggiungi nuovo file multimediale* (caricamento di più foto insieme), oppure direttamente dal blocco.
2. Nella pagina, seleziona il blocco **Immagine** vuoto → **Libreria multimediale** (o **Sostituisci** se c'è già una foto) → scegli la foto.
3. Per una **Galleria**: seleziona il blocco → **Libreria multimediale** → seleziona più foto → **Crea una nuova galleria** / **Inserisci galleria**.

Le card ritagliano le foto in verticale 4:5 e l'hero le adatta a tutta la larghezza: se rispetti le misure del §19.1 il ritaglio è minimo e prevedibile.

### 19.3 Testo alternativo (alt)

- Compilalo per ogni foto che mostra un contenuto (praticamente tutte le foto del sito). Si trova nel pannello laterale del blocco Immagine o nella Libreria Media.
- Descrivi in modo semplice ciò che si vede: "Mamma e bambina che ridono sul prato".
- **Non** inserire elenchi di parole chiave ("fotografa famiglia Treviso Maser…").

### 19.4 Immagine principale (hero)

L'hero è la prima sezione delle pagine **Home, servizi, mini sessioni e buoni regalo**. La sua foto è la più importante per la velocità percepita: il tema la carica subito e con priorità alta, le altre immagini vengono caricate quando servono.

**Misura: 2400 × 1350 px (16:9), massimo circa 400 KB.**

L'hero occupa tutta la larghezza dello schermo e ha un'altezza fissa (al massimo 760 px), quindi la foto viene ritagliata in modo diverso secondo lo schermo:

| Schermo | Cosa resta visibile della foto 16:9 |
|---|---|
| Computer grande (1920 px) | Tutta la larghezza, circa il **70% centrale dell'altezza** (tagli sopra e sotto) |
| Portatile (1366–1440 px) | Tutta la larghezza, circa l'**80–90% centrale dell'altezza** |
| Smartphone verticale | Tutta l'altezza, solo il **terzo centrale della larghezza** (tagli ai lati) |

Scelta della foto:

- tieni il **soggetto nel terzo centrale** della foto, sia in orizzontale sia in verticale;
- lascia margine sopra e sotto il soggetto: niente teste o mani vicine ai bordi;
- su computer il titolo e i pulsanti sono **a sinistra**, sopra la foto con una velatura scura: preferisci una zona sinistra calma (cielo, prato, sfondo uniforme);
- l'editor a blocchi non permette di scegliere il punto focale di questa immagine: il ritaglio parte sempre dal centro.

Per sostituirla:

1. Apri la pagina nell'editor.
2. Apri la **Vista elenco** (§4.3) e seleziona il blocco **Immagine** dentro la prima sezione.
3. **Sostituisci** → scegli la foto → compila il testo alternativo.
4. Controlla con **Anteprima**: nell'editor foto e testo appaiono uno sotto l'altro, sul sito il testo è sopra la foto con una velatura scura.

> **Attenzione:** non spostare la sezione hero più in basso e non aggiungere immagini sopra di essa: la priorità di caricamento è legata a quella foto. Se la foto non viene scelta, l'hero resta visibile su fondo scuro.

### 19.5 Google Fonts (stato attuale)

- I font (Cormorant Garamond e Inter) sono ancora caricati dai **server di Google**.
- Il tema include già un collegamento anticipato (`preconnect`) per ridurre l'attesa.
- Nel tema **non** ci sono file di font locali.

Effetti: il browser dei visitatori contatta Google (aspetto da considerare nelle policy) e c'è una piccola attesa in più al primo caricamento. **Non blocca la configurazione del sito**: si può affrontare più avanti con un aggiornamento del tema.

---

## 20. Plugin SEO

Da fare **dopo** aver creato le pagine e inserito i contenuti principali.

1. *Plugin → Aggiungi nuovo* → installa **un solo** plugin SEO, ad esempio **SEOPress** oppure **Rank Math**.

> **Attenzione:** non installarne due insieme: genererebbero titoli, metadati e sitemap duplicati.

2. Configura:
   - **Title** di ogni pagina (§21);
   - **Meta description** di ogni pagina: una frase unica, circa 150 caratteri, che descrive il contenuto e invita a cliccare;
   - **Open Graph**: immagine predefinita per le condivisioni social (una foto rappresentativa) e immagine specifica per le pagine principali;
   - **Sitemap XML** attiva (da inviare a Google Search Console);
   - **Schema LocalBusiness** (o "Attività locale"): nome, indirizzo, telefono, area servita, link ai profili. Gli stessi dati di §9.1, identici a quelli della scheda Google.
   - **Breadcrumb**: il tema **non li mostra** sulla pagina. Attivali solo se decidi di inserirli con il blocco del plugin; non sono necessari.
3. Non attivare schema per recensioni o FAQ.

Il tema non scrive titoli, descrizioni, Open Graph, sitemap né schema: è tutto gestito dal plugin.

## 21. Titoli SEO

Sono **suggerimenti editoriali** da inserire nel plugin SEO. Non sono scritti nel tema e si possono cambiare in qualsiasi momento.

| Pagina | Titolo SEO suggerito |
|---|---|
| Home | Fotografa Famiglia e Gravidanza a Treviso \| Giulia Malosso |
| Famiglia | Servizio Fotografico di Famiglia a Treviso \| Giulia Malosso |
| Gravidanza | Servizio Fotografico Gravidanza a Treviso \| Giulia Malosso |
| Newborn | Servizio Fotografico Newborn a Treviso \| Giulia Malosso |
| Bambini | Servizio Fotografico Bambini a Treviso \| Giulia Malosso |
| Battesimo | Fotografo Battesimo a Treviso \| Giulia Malosso |
| Coppia | Servizio Fotografico di Coppia a Treviso \| Giulia Malosso |
| Ritratto | Ritratti Fotografici a Treviso \| Giulia Malosso |
| Commerciale | Fotografia Commerciale per Attività a Treviso \| Giulia Malosso |
| Mini Sessioni | Mini Sessioni Fotografiche a Treviso \| Giulia Malosso |
| Natale | Mini Sessioni di Natale a Treviso \| Giulia Malosso |

Per le altre pagine (Autunno, Festa della Mamma, Buoni regalo, Chi sono, Contatti) segui lo stesso schema, senza ripetere le stesse parole in ogni titolo. Non creare pagine duplicate per singoli comuni: Maser, Montebelluna e la provincia di Treviso sono già citati nelle pagine.

## 22. Google Business

- [ ] URL della scheda Google Business / Maps inserito in *Personalizza → Dati attività e contatti* (§9.1).
- [ ] **Nome attività** identico su scheda, sito e plugin SEO.
- [ ] **Indirizzo** identico su scheda, Personalizza e plugin SEO.
- [ ] Nella scheda Google Business, il **sito web** punta al dominio del sito.
- [ ] Sul sito il link "Trovami su Google" (footer) e "Apri in Google Maps" (Contatti) aprono la scheda corretta.

---

## 23. Controllo mobile

Su uno smartphone reale, oppure nel browser del computer con gli strumenti per sviluppatori (`F12` → icona dispositivi), dimensioni circa 390 px e 768 px:

- [ ] **Header**: logo o nome leggibile, pulsante menu visibile.
- [ ] **Apertura menu**: il pulsante apre il menu.
- [ ] **Sottomenu**: Famiglia, Gravidanza… e Natale, Autunno… compaiono rientrati sotto le voci padre.
- [ ] **Chiusura**: il pulsante chiude il menu; toccando una voce il menu si chiude e si apre la pagina.
- [ ] **Scorrimento**: con il menu aperto e molte voci, il menu scorre.
- [ ] **Hero**: testo leggibile sopra la foto; pulsanti uno sotto l'altro, a tutta larghezza.
- [ ] **Card**: una sotto l'altra, foto non deformate, tutta la card cliccabile.
- [ ] **Galleria**: foto ben disposte, nessuna uscita dallo schermo.
- [ ] **Pacchetti**: card una sotto l'altra, prezzi leggibili.
- [ ] **FAQ**: domande apribili con un tocco.
- [ ] **Modulo**: campi comodi da compilare, tastiera corretta per email e telefono, casella privacy toccabile.
- [ ] **Footer**: colonne una sotto l'altra, link toccabili.
- [ ] Nessuna pagina scorre in orizzontale.

## 24. Test di accessibilità minimo

Dal computer, usando solo la tastiera:

- [ ] **Tab** dall'inizio della pagina: il primo elemento è il link **"Salta al contenuto"**; premendo Invio si salta oltre il menu.
- [ ] **Menu**: con Tab si raggiungono tutte le voci; arrivando su "Servizi" o "Mini Sessioni" si apre il sottomenu.
- [ ] **Sottomenu**: con Tab si raggiungono le sottovoci; **Esc** chiude il sottomenu e riporta su "Servizi" o "Mini Sessioni".
- [ ] **Menu mobile** (finestra stretta): il pulsante si apre con Invio; **Esc** lo chiude e riporta il focus sul pulsante; a menu chiuso le voci non vengono raggiunte con Tab.
- [ ] **Focus visibile**: ogni elemento raggiunto con Tab mostra un contorno terracotta.
- [ ] **Modulo**: ogni campo ha la sua etichetta; la casella privacy si spunta con la barra spaziatrice.
- [ ] **Messaggi del modulo**: dopo l'invio (errore o successo) il messaggio è visibile in alto e riceve il focus.
- [ ] **Pulsanti e card**: si raggiungono con Tab e si aprono con Invio.

## 25. Test dei link

Prima della pubblicazione, clicca ognuno di questi elementi su ogni pagina:

- [ ] Tutte le **card servizi** (Home, Hub Servizi) → pagina servizio corretta.
- [ ] Card dell'**Hub Mini Sessioni** → Natale, Autunno, Festa della Mamma.
- [ ] Tutti i pulsanti **CTA** ("Chiedi informazioni", "Scopri i servizi", "Scopri le mini sessioni", "Scopri i buoni regalo", "Conosciamoci", "Richiedi un buono regalo").
- [ ] Pulsanti **"Scegli la tua data"** → prenotazione online (se aperta) o Contatti.
- [ ] Pagina **Contatti**, **WhatsApp**, **email**, **telefono**.
- [ ] **Social** (Instagram, Facebook).
- [ ] **Google Business**.
- [ ] **Privacy** e **Cookie** dal footer e dal modulo.
- [ ] Menu principale e menu footer.
- [ ] Un indirizzo inesistente (es. `/prova-404/`) mostra "Pagina non trovata" con i pulsanti Home, Servizi, Contatti funzionanti.

> Nessun link e nessun testo devono ancora contenere `[DA INSERIRE]` o altri segnaposto (§4.4).

## 26. Cosa non fare

- Non installare page builder (Elementor e simili): il sito è pensato per l'editor a blocchi.
- Non installare due plugin per la stessa funzione (due SEO, due SMTP, due cache).
- Non creare pagine per singoli comuni o servizi non pubblicizzati.
- Non creare una nuova pagina per ogni edizione delle mini sessioni.
- Non pubblicare recensioni, prezzi o date di prova.

---

## 27. Checklist "Pronto a pubblicare"

- [ ] Nessun `[DA INSERIRE]`, `[DA AGGIORNARE]`, `[DA VERIFICARE]`, `[DA ADATTARE]` o `[NOTA EDITORIALE]` visibile
- [ ] Home completa
- [ ] Menu principale e menu footer funzionanti
- [ ] Otto servizi completi (Famiglia, Gravidanza, Newborn, Bambini, Battesimo, Coppia, Ritratto, Commerciale)
- [ ] Mini Sessioni configurate (hub + 3 pagine, stato campagne corretto)
- [ ] Buoni regalo e Chi sono completi
- [ ] Contatti funzionante
- [ ] Mail ricevuta realmente (anche controllando lo spam)
- [ ] SMTP verificato, se necessario
- [ ] Privacy Policy pubblicata e collegata (*Impostazioni → Privacy*)
- [ ] Cookie Policy presente
- [ ] P.IVA presente nel footer
- [ ] Contatti reali (email, telefono, indirizzo)
- [ ] Social corretti
- [ ] WhatsApp corretto
- [ ] Google Business corretto
- [ ] Immagini ottimizzate (nessun originale della fotocamera)
- [ ] Alt text verificati
- [ ] Nessun errore nei pattern (§6)
- [ ] Mobile verificato
- [ ] Menu mobile verificato
- [ ] CTA verificate
- [ ] Nessun link rotto
- [ ] Pagine e articoli di esempio di WordPress eliminati
- [ ] Permalink delle guide impostati (§17.2)
- [ ] Plugin SEO configurato
- [ ] Sitemap generata
- [ ] Titoli e meta description inseriti
- [ ] Favicon presente
- [ ] *Impostazioni → Lettura*: tolta la spunta **"Scoraggia i motori di ricerca dall'indicizzare questo sito"**
