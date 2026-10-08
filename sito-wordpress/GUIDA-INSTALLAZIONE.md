# Sito vetrina & portfolio — Giulia Malosso Photography

Tema WordPress pronto da caricare su Hostinger. È una cartella (`giulia-malosso-photography/`) che va compressa in **.zip** e installata da WordPress.

Resta **separato dal CRM**: non tocca nulla del progetto Next.js.

---

## 1. Creare lo ZIP

Comprimi la cartella `giulia-malosso-photography` (NON la cartella `sito-wordpress`).

Su Windows:
1. Tasto destro sulla cartella `giulia-malosso-photography`
2. *Invia a → Cartella compressa*
3. Ottieni `giulia-malosso-photography.zip`

> Importante: dentro lo ZIP deve esserci direttamente `style.css`, `functions.php`, ecc. — cioè lo ZIP contiene la cartella del tema, non una cartella in più.

## 2. Caricare il tema su WordPress

1. Entra nel pannello WordPress: `https://TUO-DOMINIO/wp-admin`
2. Menu **Aspetto → Temi → Aggiungi nuovo tema → Carica tema**
3. Seleziona `giulia-malosso-photography.zip` → **Installa ora**
4. **Attiva**

In alternativa, da Hostinger puoi caricare la cartella via **hPanel → Gestore file** dentro `wp-content/themes/` ed estrarla lì.

## 3. Impostare la home come vetrina

1. **Impostazioni → Lettura**
2. "La tua home page mostra" → **Una pagina statica**
3. Crea una pagina vuota chiamata *Home* e selezionala come Home page
   (il tema usa automaticamente il file `front-page.php` per la vetrina)

## 4. Inserire contatti reali

**Aspetto → Personalizza → Contatti e social**: email, telefono, città, Instagram, Facebook.
Questi valori compaiono in home, footer e pagina contatti.

## 5. Caricare le foto vere

Le immagini attuali sono segnaposto generati automaticamente. Per sostituirle con foto reali hai due strade:

- **Rapida (consigliata):** apri le sezioni con **Elementor** (già presente) e sostituisci le immagini trascinando le tue foto. Il tema è compatibile con Elementor.
- **Da codice:** sostituisci le chiamate `gmph_placeholder(...)` nei file `front-page.php` con i tuoi URL immagine o `the_post_thumbnail()`.

## 6. Menu di navigazione

**Aspetto → Menu**: crea un menu, assegna le voci (Home, Servizi, Portfolio, Chi sono, Contatti) e impostalo come *Menu principale*. Senza menu, il tema mostra voci di default che puntano alle sezioni della home.

## 7. Pagina Contatti con modulo

1. Crea una pagina **Contatti**
2. In *Attributi pagina → Template* scegli **Contatti**
3. Per ricevere i messaggi via email in modo affidabile, installa un plugin come **Contact Form 7** o **WPForms** (il modulo incluso usa `mailto`, utile come base).

---

## Cosa è incluso

| File | Funzione |
|------|----------|
| `style.css` | Intestazione tema + tutti gli stili (palette crema/terracotta del CRM) |
| `functions.php` | Setup tema, menu, font, opzioni contatti nel Customizer |
| `header.php` / `footer.php` | Intestazione e piè di pagina |
| `front-page.php` | Home vetrina: hero, servizi, portfolio, chi sono, CTA |
| `page.php` / `single.php` | Pagine e articoli standard (editabili con Elementor) |
| `template-contatti.php` | Template pagina Contatti con modulo |
| `index.php` / `404.php` | Fallback e pagina errore |
| `assets/js/main.js` | Menu mobile + filtri portfolio |

## Palette

- Crema sfondo `#fdfbf8` · Crema soft `#efe6dc`
- Terracotta `#9b5d43` (hover `#7f4934`)
- Testo `#27231f` · Testo tenue `#675f57` · Bordi `#d8d0c5`

Font: **Cormorant Garamond** (titoli) + **Inter** (testo), caricati da Google Fonts.

## Note

- Compatibile con WordPress 6.x e PHP 7.4+.
- Nessun plugin obbligatorio: funziona anche senza Elementor.
- Il tema non interferisce con il CRM Next.js: sono due progetti distinti.
