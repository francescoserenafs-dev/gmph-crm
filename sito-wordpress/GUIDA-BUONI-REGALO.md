# Guida — Aggiornare la pagina Buoni Regalo

Questa guida spiega, passo passo e senza toccare codice, come applicare la nuova struttura alla pagina **Buoni Regalo** (`/buoni-regalo/`) e come modificarne testi, foto, FAQ e pulsanti dall'editor di WordPress.

Vale per il tema **Giulia Malosso Photography versione 2.2.0 o successiva**. Per installare o aggiornare il tema vedi `GUIDA-INSTALLAZIONE.md`, §2.5.

---

## 1. Cosa è cambiato e cosa NON cambia da solo

La nuova pagina ha queste sezioni, dall'alto verso il basso:

1. **Hero fotografico** — titolo, frase, pulsante "Richiedi un buono regalo", foto a lato (sopra il testo su smartphone) e la riga "Digitale o cartaceo · Validità 12 mesi · Personalizzabile".
2. **Un regalo che diventa un ricordo** — foto + breve testo.
3. **Scegli il tuo buono** — due riquadri: *Buono a valore* e *Buono per un servizio*.
4. **Come funziona** — tre passaggi numerati 01, 02, 03.
5. **Pronto da regalare** — foto del buono + *Cartaceo* e *Digitale*.
6. **Per chi è perfetto** — quattro idee di destinatario.
7. **Domande frequenti** — otto domande apribili.
8. **Un regalo che resta** — riquadro terracotta finale con pulsante.

> **Importante:** aggiornare il tema **non modifica** la pagina Buoni Regalo già pubblicata. Il contenuto della pagina è salvato nel database di WordPress; il tema contiene solo il **modello** (pattern) "Buoni regalo". La nuova struttura va applicata **a mano, una volta sola**, con la procedura del §2. L'indirizzo `/buoni-regalo/` resta lo stesso.

Il tema aggiornato porta comunque subito gli **stili** nuovi (colori, impaginazione, riquadri): la pagina attuale continua a funzionare e a mostrarsi come prima finché non applichi la nuova struttura.

---

## 2. Applicare la nuova struttura alla pagina esistente

Prima di iniziare:

- [ ] Il tema è aggiornato alla versione 2.2.0 (*Aspetto → Temi*: la scheda del tema riporta la versione).
- [ ] Hai pronte le foto (§4) — puoi anche aggiungerle dopo: le foto non scelte non compaiono sul sito.
- [ ] Hai fatto un backup del sito (SiteGround → *Sicurezza → Backup*), consigliato.

### Metodo consigliato: preparare in una bozza e poi copiare

Così la pagina pubblicata non cambia finché non è tutto pronto.

1. *Pagine → Aggiungi nuova*. Nella finestra "Scegli un pattern" clicca **Buoni regalo** (se non compare: pulsante **+** in alto a sinistra → scheda **Pattern** → categoria **Giulia Malosso** → **Buoni regalo**).
2. Titolo: `Buoni regalo – bozza`. **Non** pubblicare: usa solo **Salva bozza**.
3. Scegli le foto e controlla i testi (§3 e §4). Usa **Anteprima** per vedere il risultato reale.
4. Quando la bozza è pronta: menu **⋮** in alto a destra → **Copia tutti i blocchi** (in alcune versioni: *Strumenti → Copia tutti i blocchi*).
5. Apri la pagina pubblicata **Buoni regalo** (*Pagine → Tutte le pagine → Buoni regalo → Modifica*).
6. Apri la **Vista elenco** (icona con tre righe in alto a sinistra), clicca il primo blocco, poi tieni premuto **Maiusc** e clicca l'ultimo: sono selezionati tutti. Premi **Canc** (o menu ⋮ → **Elimina**).
7. Clicca nell'area vuota della pagina e incolla (**Ctrl+V**, su Mac **Cmd+V**).
8. Nel pannello a destra, scheda **Pagina**, verifica: **Template = Landing GMPH**, slug `buoni-regalo`. Non cambiarli.
9. **Aggiorna**. Controlla la pagina pubblicata (§6).
10. Elimina la bozza `Buoni regalo – bozza` (*Pagine → Cestino*).

### Metodo rapido: sostituire direttamente nella pagina

1. Apri la pagina **Buoni regalo** → **Modifica**.
2. Vista elenco → seleziona tutti i blocchi (passo 6 sopra) → **Elimina**.
3. Pulsante **+** → **Pattern** → **Giulia Malosso** → **Buoni regalo**.
4. Scegli le foto e controlla i testi, poi **Aggiorna**.

### Se qualcosa non va: tornare alla versione precedente

Nella pagina, pannello a destra → scheda **Pagina** → **Revisioni** → scegli la revisione precedente alla modifica → **Ripristina questa revisione**. L'URL non cambia.

---

## 3. Modificare i testi

Regola generale: **clicca sul testo nell'editor e scrivi**. Poi **Aggiorna**. Non serve altro.

Le parti da **non toccare** sono indicate nella tabella del §7.

### 3.1 Hero (prima sezione)

| Elemento | Come si modifica |
|---|---|
| Riga piccola sopra il titolo ("Buono regalo fotografico") | Clic e scrivi |
| Titolo "Regala un servizio fotografico" | Clic e scrivi. **Deve restare l'unico titolo grande (H1) della pagina** |
| Frase sotto il titolo | Clic e scrivi |
| Pulsante "Richiedi un buono regalo" | Clic sul testo del pulsante per cambiarlo. **Non cambiare il link** (§5) |
| Riga "Digitale o cartaceo · Validità 12 mesi · Personalizzabile" | Clic e scrivi. Separa le voci con " · " (spazio, punto centrale, spazio) |
| Foto | Vedi §4 |

### 3.2 Un regalo che diventa un ricordo

- **Titolo** e **paragrafi**: clic e scrivi. Tieni 2–3 paragrafi brevi.
- **Foto**: vedi §4.

### 3.3 Scegli il tuo buono

**Buono a valore** (riquadro di sinistra):

- **Descrizione**: clic sul paragrafo e scrivi.
- **Importi** (100 €, 150 €…): sono un normale **elenco puntato**, mostrato a "etichette". Sono solo esempi, non pulsanti di pagamento.
  - Modificare un importo: clic sulla voce e scrivi.
  - Aggiungerne uno: clic alla fine di una voce e premi **Invio**.
  - Rimuoverne uno: cancella il testo della voce e premi **Backspace** fino a eliminarla.
- **Condizioni** (paragrafo in piccolo in fondo al riquadro): clic e scrivi.

**Buono per un servizio** (riquadro di destra):

- **Descrizione** e **frase finale** ("Se non sai quale soluzione scegliere…"): clic e scrivi.
- **Elenco servizi** (Famiglia, Gravidanza…): come gli importi. Non inserire Ritratto: non è tra i servizi principali pubblicizzati.

Le voci "Per esempio" e "Alcune idee" sono piccole etichette: puoi cambiarle o cancellarle.

### 3.4 Come funziona

Ogni passaggio ha: **numero** (01, 02, 03), **titolo** e **testo**. Tutti si modificano con un clic. Mantieni i numeri a due cifre per coerenza.

### 3.5 Pronto da regalare

- **Titolo** e **frase introduttiva**: clic e scrivi.
- Riquadri **Cartaceo** e **Digitale**: titolo e testo con un clic.
- **Foto**: vedi §4. Se vuoi mostrare anche la versione digitale, puoi aggiungere una seconda foto: clic alla fine del testo "Digitale" → **+** → **Immagine**. Usa la stessa proporzione (4:5).

### 3.6 Per chi è perfetto

Quattro blocchi, ciascuno con **titolo** e **descrizione**: clic e scrivi. Per non appesantire la pagina mantieni testi di una sola frase.

### 3.7 Domande frequenti (FAQ)

Ogni domanda è un blocco **Dettagli**: la domanda è la riga sempre visibile, la risposta compare cliccandola.

- **Modificare una risposta:** nell'editor clicca la domanda per aprirla, poi clicca il testo della risposta e scrivi.
- **Modificare una domanda:** clic sulla riga della domanda e scrivi.
- **Aggiungere una FAQ:** seleziona una domanda esistente → menu **⋮** del blocco → **Duplica**. Cambia domanda e risposta della copia. Per spostarla usa le frecce ▲▼ della barra del blocco.
- **Rimuovere una FAQ:** seleziona il blocco Dettagli (in Vista elenco: "Dettagli") → menu **⋮** → **Elimina**.

Le FAQ funzionano anche da tastiera (Tab per spostarsi, Invio per aprire): non servono plugin.

### 3.8 CTA finale (riquadro terracotta)

- **Titolo** ("Un regalo che resta") e **testo**: clic e scrivi.
- **Pulsante**: clic sul testo per cambiarlo. **Non cambiare il link** (§5).

---

## 4. Foto

La pagina ha **tre foto**. Una foto non scelta **non compare** sul sito e la sezione si adatta (il testo resta centrato).

| Posizione | Proporzione | Misura da esportare | Peso indicativo | Consiglio |
|---|---|---|---|---|
| **Hero** (accanto al titolo) | Verticale **4:5** | **1600 × 2000 px** | 350 KB | Soggetto al centro: su smartphone la foto viene mostrata più bassa (4:3), quindi si perde una parte sopra e sotto |
| **Un regalo che diventa un ricordo** | Verticale **4:5** | **1200 × 1500 px** | 250 KB | Un momento insieme: famiglia, abbraccio, mani |
| **Pronto da regalare** | Verticale **4:5** | **1200 × 1500 px** | 250 KB | Il buono reale: busta, confezione, biglietto |

Esporta in JPG qualità 75–82, profilo sRGB (vedi anche `GUIDA-INSTALLAZIONE.md`, §19.1). **Non** usare foto con testo importante scritto sopra (ad esempio il prezzo stampato sulla foto): i testi devono restare nella pagina.

### Sostituire o scegliere una foto

1. Apri la pagina nell'editor.
2. Clicca la foto (o il riquadro vuoto "Immagine"). Se è difficile selezionarla, usa la **Vista elenco** e clicca il blocco **Immagine** della sezione.
3. Nella barra del blocco: **Sostituisci** (o **Libreria multimediale** se è vuota) → scegli o carica la foto → **Seleziona**.
4. Compila il **Testo alternativo** (pannello a destra, scheda Blocco) — vedi sotto.
5. **Aggiorna** e controlla con **Anteprima**.

Non serve fare altro: il sito sceglie da solo la misura giusta per ogni schermo, carica subito la foto dell'hero e solo quando servono le altre.

### Testo alternativo (alt)

Descrivi in modo semplice cosa si vede, come lo diresti a voce a qualcuno che non vede la foto:

- Hero: "Mamma e bambina che aprono un buono regalo fotografico"
- Sezione emozionale: "Nonni che abbracciano i nipoti sul prato"
- Pronto da regalare: "Buono regalo cartaceo in busta color crema con nastro"

Non elencare parole chiave ("buono regalo fotografo Treviso…").

---

## 5. Pulsanti: il link da non cambiare

Entrambi i pulsanti (hero e riquadro finale) portano al modulo Contatti con **Buono regalo già selezionato**:

```
/contatti/?servizio=buono-regalo
```

La parte `?servizio=buono-regalo` è quella che preseleziona il buono e mostra subito i campi dedicati (tipo di buono, importo, consegna, messaggio personale). **Non cancellarla.** Se devi ricreare un pulsante, imposta il link copiando esattamente l'indirizzo completo del pulsante esistente.

---

## 6. Controllo dopo ogni modifica

- [ ] **Aggiorna** premuto (in alto a destra).
- [ ] Pagina aperta in una finestra anonima (o dopo *SiteGround → Svuota cache*): le modifiche sono visibili.
- [ ] Il pulsante dell'hero e quello finale aprono Contatti con "Buono regalo" già selezionato.
- [ ] Le FAQ si aprono e chiudono.
- [ ] Da smartphone: foto sopra il testo, riquadri uno sotto l'altro, nessun testo tagliato.
- [ ] Nessun segnaposto `[DA …]` rimasto (`Ctrl+F` in Anteprima).

Se dopo l'aggiornamento non vedi le modifiche: SiteGround → **Velocità → Caching → Svuota cache** (o dal plugin *Speed Optimizer* → **Purge SG Cache**), poi ricarica la pagina.

---

## 7. Cosa non toccare

| Elemento | Perché |
|---|---|
| Link dei due pulsanti | Preseleziona "Buono regalo" nel modulo (§5) |
| Template **Landing GMPH** e slug `buoni-regalo` | Cambiandoli cambiano aspetto e indirizzo della pagina |
| Nomi delle classi nel pannello **Avanzate** dei blocchi (es. `gmph-hero gmph-hero--split`, `gmph-chips`, `gmph-gift-option`) | Collegano i blocchi agli stili del tema: senza, la sezione perde l'impaginazione |
| Ordine delle sezioni, in particolare l'hero in cima | La foto dell'hero è caricata con priorità: se la sposti in basso la pagina si apre più lentamente |
| Livelli dei titoli (H1, H2, H3) | Servono a Google e ai lettori di schermo: un solo H1 (l'hero) |

Puoi invece liberamente: modificare testi, sostituire foto, aggiungere o togliere FAQ, voci degli elenchi e importi.
