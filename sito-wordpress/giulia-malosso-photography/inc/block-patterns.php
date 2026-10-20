<?php
/**
 * Block pattern del tema: punti di partenza modificabili nel Block Editor.
 * Solo blocchi core; i testi tra [DA INSERIRE] vanno sostituiti con contenuti reali.
 *
 * @package gmph
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* --------------------------------------------------------------------------
 * Helper di markup (stesso output del salvataggio dei blocchi core)
 * ----------------------------------------------------------------------- */

/**
 * Commento di apertura di un blocco.
 *
 * @param string $name  Nome blocco senza "core/".
 * @param array  $attrs Attributi.
 * @return string
 */
function gmph_bo( $name, $attrs = array() ) {
	return '<!-- wp:' . $name . ( $attrs ? ' ' . wp_json_encode( $attrs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) : '' ) . ' -->';
}

/**
 * Attributo class HTML.
 *
 * @param array $classes Classi.
 * @return string
 */
function gmph_class_attr( $classes ) {
	$classes = array_filter( $classes );
	return $classes ? ' class="' . esc_attr( implode( ' ', $classes ) ) . '"' : '';
}

/**
 * Paragrafo.
 *
 * @param string $html  Testo (HTML inline consentito).
 * @param array  $args  align, className.
 * @return string
 */
function gmph_p( $html, $args = array() ) {
	$attrs = array_filter(
		array(
			'align'     => isset( $args['align'] ) ? $args['align'] : null,
			'className' => isset( $args['className'] ) ? $args['className'] : null,
		)
	);
	$class = gmph_class_attr(
		array(
			isset( $attrs['align'] ) ? 'has-text-align-' . $attrs['align'] : '',
			isset( $attrs['className'] ) ? $attrs['className'] : '',
		)
	);
	return gmph_bo( 'paragraph', $attrs ) . '<p' . $class . '>' . $html . '</p><!-- /wp:paragraph -->';
}

/**
 * Titolo.
 *
 * @param string $html  Testo (HTML inline consentito).
 * @param int    $level Livello.
 * @param array  $args  textAlign, className.
 * @return string
 */
function gmph_h( $html, $level = 2, $args = array() ) {
	$attrs = array();
	if ( 2 !== $level ) {
		$attrs['level'] = $level;
	}
	if ( isset( $args['textAlign'] ) ) {
		$attrs['textAlign'] = $args['textAlign'];
	}
	if ( isset( $args['className'] ) ) {
		$attrs['className'] = $args['className'];
	}
	$class = gmph_class_attr(
		array(
			'wp-block-heading',
			isset( $attrs['textAlign'] ) ? 'has-text-align-' . $attrs['textAlign'] : '',
			isset( $attrs['className'] ) ? $attrs['className'] : '',
		)
	);
	return gmph_bo( 'heading', $attrs ) . '<h' . $level . $class . '>' . $html . '</h' . $level . '><!-- /wp:heading -->';
}

/**
 * Link interno a una pagina del sito.
 *
 * @param string $path Percorso relativo.
 * @return string
 */
function gmph_link( $path ) {
	return esc_url( home_url( $path ) );
}

/**
 * Gruppo di pulsanti.
 *
 * @param array  $buttons   Elenco [testo, url, outline?].
 * @param string $className Classe del contenitore.
 * @return string
 */
function gmph_buttons( $buttons, $className = '' ) {
	$out = '';
	foreach ( $buttons as $button ) {
		$outline = ! empty( $button[2] );
		$attrs   = $outline ? array( 'className' => 'is-style-outline' ) : array();
		$out    .= gmph_bo( 'button', $attrs )
			. '<div' . gmph_class_attr( array( 'wp-block-button', $outline ? 'is-style-outline' : '' ) ) . '>'
			. '<a class="wp-block-button__link wp-element-button" href="' . $button[1] . '">' . esc_html( $button[0] ) . '</a>'
			. '</div><!-- /wp:button -->';
	}
	$attrs = $className ? array( 'className' => $className ) : array();
	return gmph_bo( 'buttons', $attrs ) . '<div' . gmph_class_attr( array( 'wp-block-buttons', $className ) ) . '>' . $out . '</div><!-- /wp:buttons -->';
}

/**
 * Immagine vuota da scegliere nella Media Library.
 *
 * @param string $className Classe.
 * @param string $size      Dimensione WordPress.
 * @return string
 */
function gmph_img( $className = '', $size = 'large' ) {
	$attrs = array( 'sizeSlug' => $size );
	if ( $className ) {
		$attrs['className'] = $className;
	}
	return gmph_bo( 'image', $attrs ) . '<figure' . gmph_class_attr( array( 'wp-block-image', 'size-' . $size, $className ) ) . '><img alt=""/></figure><!-- /wp:image -->';
}

/**
 * Gruppo.
 *
 * @param string $inner Contenuto.
 * @param array  $args  tagName, align, className.
 * @return string
 */
function gmph_group( $inner, $args = array() ) {
	$tag   = isset( $args['tagName'] ) ? $args['tagName'] : 'div';
	$attrs = array();
	if ( 'div' !== $tag ) {
		$attrs['tagName'] = $tag;
	}
	if ( isset( $args['align'] ) ) {
		$attrs['align'] = $args['align'];
	}
	if ( isset( $args['className'] ) ) {
		$attrs['className'] = $args['className'];
	}
	$class = gmph_class_attr(
		array(
			'wp-block-group',
			isset( $attrs['align'] ) ? 'align' . $attrs['align'] : '',
			isset( $attrs['className'] ) ? $attrs['className'] : '',
		)
	);
	return gmph_bo( 'group', $attrs ) . '<' . $tag . $class . '>' . $inner . '</' . $tag . '><!-- /wp:group -->';
}

/**
 * Sezione a tutta larghezza.
 *
 * @param string $inner     Contenuto.
 * @param string $modifier  Classi aggiuntive (es. "gmph-section--soft").
 * @return string
 */
function gmph_section( $inner, $modifier = '' ) {
	return gmph_group(
		$inner,
		array(
			'tagName'   => 'section',
			'align'     => 'full',
			'className' => trim( 'gmph-section ' . $modifier ),
		)
	);
}

/**
 * Colonne.
 *
 * @param array  $columns   Contenuto di ogni colonna.
 * @param string $className Classe.
 * @return string
 */
function gmph_columns( $columns, $className = '' ) {
	$out = '';
	foreach ( $columns as $column ) {
		$out .= gmph_bo( 'column' ) . '<div class="wp-block-column">' . $column . '</div><!-- /wp:column -->';
	}
	$attrs = $className ? array( 'className' => $className ) : array();
	return gmph_bo( 'columns', $attrs ) . '<div' . gmph_class_attr( array( 'wp-block-columns', $className ) ) . '>' . $out . '</div><!-- /wp:columns -->';
}

/**
 * Domanda FAQ (blocco Dettagli).
 *
 * @param string $question Domanda.
 * @param string $answer   Risposta.
 * @return string
 */
function gmph_faq_item( $question, $answer ) {
	return gmph_bo( 'details' ) . '<details class="wp-block-details"><summary>' . esc_html( $question ) . '</summary>' . gmph_p( esc_html( $answer ) ) . '</details><!-- /wp:details -->';
}

/**
 * Sezione FAQ.
 *
 * @param array  $items Elenco [domanda, risposta].
 * @param string $title Titolo.
 * @return string
 */
function gmph_faq( $items, $title = 'Domande frequenti' ) {
	$out = gmph_h( esc_html( $title ), 2, array( 'textAlign' => 'center' ) );
	foreach ( $items as $item ) {
		$out .= gmph_faq_item( $item[0], $item[1] );
	}
	return gmph_section( gmph_group( $out, array( 'className' => 'gmph-faq' ) ) );
}

/**
 * Testimonianza (blocco Citazione).
 *
 * @param string $text Testo.
 * @param string $cite Autore.
 * @return string
 */
function gmph_quote( $text, $cite ) {
	return gmph_bo( 'quote', array( 'className' => 'gmph-testimonial' ) ) . '<blockquote class="wp-block-quote gmph-testimonial">' . gmph_p( esc_html( $text ) ) . '<cite>' . esc_html( $cite ) . '</cite></blockquote><!-- /wp:quote -->';
}

/**
 * Galleria vuota da riempire nell'editor.
 *
 * @return string
 */
function gmph_gallery() {
	return gmph_bo( 'gallery', array( 'linkTo' => 'none' ) ) . '<figure class="wp-block-gallery has-nested-images columns-default is-cropped"></figure><!-- /wp:gallery -->';
}

/**
 * Card cliccabile (immagine, titolo con link, testo).
 *
 * @param string $title Titolo.
 * @param string $url   Destinazione.
 * @param string $text  Testo breve.
 * @return string
 */
function gmph_card( $title, $url, $text ) {
	return gmph_group(
		gmph_img( 'gmph-card__media' )
		. gmph_h( '<a href="' . $url . '">' . esc_html( $title ) . '</a>', 3 )
		. gmph_p( esc_html( $text ) )
		. gmph_p( 'Scopri di più', array( 'className' => 'gmph-card__more' ) ),
		array( 'className' => 'gmph-card' )
	);
}

/**
 * Passaggio numerato.
 *
 * @param string $title Titolo.
 * @param string $text  Testo.
 * @return string
 */
function gmph_step( $title, $text ) {
	return gmph_group( gmph_h( esc_html( $title ), 3 ) . gmph_p( esc_html( $text ) ), array( 'className' => 'gmph-step' ) );
}

/* --------------------------------------------------------------------------
 * Sezioni riutilizzabili
 * ----------------------------------------------------------------------- */

/**
 * Hero con immagine dalla Media Library.
 *
 * @param string $h1       Titolo principale.
 * @param string $text     Sottotitolo.
 * @param array  $buttons  Pulsanti.
 * @param string $eyebrow  Testo sopra il titolo.
 * @return string
 */
function gmph_hero( $h1, $text, $buttons, $eyebrow = '' ) {
	$content = ( $eyebrow ? gmph_p( esc_html( $eyebrow ), array( 'className' => 'gmph-eyebrow' ) ) : '' )
		. gmph_h( esc_html( $h1 ), 1 )
		. gmph_p( esc_html( $text ), array( 'className' => 'gmph-lead' ) )
		. gmph_buttons( $buttons );

	return gmph_group(
		gmph_img( 'gmph-hero__media', 'full' ) . gmph_group( $content, array( 'className' => 'gmph-hero__content' ) ),
		array(
			'tagName'   => 'section',
			'align'     => 'full',
			'className' => 'gmph-hero',
		)
	);
}

/**
 * Introduzione di pagina senza immagine.
 *
 * @param string $h1   Titolo.
 * @param string $text Introduzione.
 * @return string
 */
function gmph_page_intro( $h1, $text ) {
	return gmph_section( gmph_h( esc_html( $h1 ), 1, array( 'textAlign' => 'center' ) ) . gmph_p( esc_html( $text ), array( 'align' => 'center', 'className' => 'gmph-lead' ) ), 'gmph-section--soft gmph-page-intro' );
}

/**
 * CTA finale.
 *
 * @param string $title  Titolo.
 * @param string $text   Testo.
 * @param string $label  Testo pulsante.
 * @param string $url    Destinazione.
 * @return string
 */
function gmph_cta( $title = 'Raccontami cosa vorresti ricordare', $text = 'Scrivimi qualche riga su di voi e sul servizio che avete in mente: ti risponderò con disponibilità e tutte le informazioni.', $label = 'Chiedi informazioni', $url = '' ) {
	$url = $url ? $url : gmph_link( '/contatti/' );
	return gmph_section(
		gmph_group(
			gmph_h( esc_html( $title ), 2, array( 'textAlign' => 'center' ) )
			. gmph_p( esc_html( $text ), array( 'align' => 'center' ) )
			. gmph_buttons( array( array( $label, $url ) ), 'gmph-center' ),
			array( 'className' => 'gmph-cta' )
		)
	);
}

/**
 * Testimonianze segnaposto.
 *
 * @param int $count Numero di testimonianze.
 * @return string
 */
function gmph_testimonials( $count = 3 ) {
	$quotes = array();
	for ( $i = 0; $i < $count; $i++ ) {
		$quotes[] = gmph_quote( '[DA INSERIRE: testo di una recensione reale, ad esempio sull’esperienza rilassata o sui bambini che non stavano fermi]', '[DA INSERIRE: nome e servizio]' );
	}
	return gmph_section(
		gmph_h( 'Cosa dicono le famiglie', 2, array( 'textAlign' => 'center' ) ) . gmph_columns( $quotes, 'gmph-testimonials' ),
		'gmph-section--soft'
	);
}

/**
 * I quattro passaggi del servizio.
 *
 * @return string
 */
function gmph_how_it_works() {
	return gmph_section(
		gmph_h( 'Come funziona', 2, array( 'textAlign' => 'center' ) )
		. gmph_columns(
			array(
				gmph_step( '1. Ci conosciamo', 'Mi scrivi e mi racconti chi siete e cosa vorreste ricordare. Ti rispondo con disponibilità e proposte.' ),
				gmph_step( '2. Prepariamo la sessione', 'Scegliamo insieme data, luogo e abbigliamento, così arrivate tranquilli e senza pensieri.' ),
				gmph_step( '3. Vivete il momento', 'Durante la sessione vi lascio liberi di essere voi stessi. Vi guido solo quando serve.' ),
				gmph_step( '4. Ricevete le vostre fotografie', 'Scegliete le immagini e ricevete le fotografie finali, pronte da custodire. [DA INSERIRE: tempi e modalità di consegna]' ),
			),
			'gmph-steps'
		)
	);
}

/**
 * Card di un pacchetto con prezzo editabile.
 *
 * @param string $url Destinazione del pulsante.
 * @return string
 */
function gmph_price_card( $url ) {
	return gmph_group(
		gmph_h( '[DA INSERIRE: nome pacchetto]', 3 )
		. gmph_p( '[DA INSERIRE] €', array( 'className' => 'gmph-price' ) )
		. gmph_p( 'Durata: [DA INSERIRE] · Foto incluse: [DA INSERIRE]', array( 'className' => 'gmph-price-meta' ) )
		. gmph_p( '[DA INSERIRE: breve descrizione di cosa comprende il pacchetto]' )
		. gmph_buttons( array( array( 'Chiedi informazioni', $url, true ) ) ),
		array( 'className' => 'gmph-price-card' )
	);
}

/**
 * Sezione area servita.
 *
 * @return string
 */
function gmph_area() {
	return gmph_section(
		gmph_h( 'Dove lavoro', 2, array( 'textAlign' => 'center' ) )
		. gmph_p( 'Lo studio si trova a Maser (TV). Lavoro con famiglie di Maser, Montebelluna e della provincia di Treviso, e con chi arriva dai dintorni. [DA VERIFICARE: zone e servizi all’aperto]', array( 'align' => 'center' ) )
	);
}

/**
 * Le quattro card dei servizi principali.
 *
 * @return string
 */
function gmph_service_cards() {
	return gmph_columns(
		array(
			gmph_card( 'Famiglia', gmph_link( '/servizi/famiglia/' ), 'Genitori, bambini e tutti i piccoli gesti che vi tengono insieme.' ),
			gmph_card( 'Gravidanza', gmph_link( '/servizi/gravidanza/' ), 'L’attesa raccontata con delicatezza, da sola, in coppia o con i figli.' ),
			gmph_card( 'Bambini', gmph_link( '/servizi/bambini/' ), 'Sessioni brevi, giochi e spontaneità: i bambini restano bambini.' ),
			gmph_card( 'Battesimo', gmph_link( '/servizi/battesimo/' ), 'La cerimonia, la famiglia e la festa, raccontate in modo discreto.' ),
		),
		'gmph-cards'
	);
}

/**
 * Sezione sull'approccio.
 *
 * @param string $modifier Classi aggiuntive della sezione.
 * @return string
 */
function gmph_approach( $modifier = '' ) {
	return gmph_section(
		gmph_columns(
			array(
				gmph_img( 'gmph-approach__media' ),
				gmph_p( 'Il mio approccio', array( 'className' => 'gmph-eyebrow' ) )
				. gmph_h( 'Non dovete saper posare' )
				. gmph_p( 'Non vi chiederò sorrisi forzati né pose rigide. Vi lascio muovere, giocare e parlare tra voi: le fotografie più belle nascono quando ci si dimentica della macchina fotografica.' )
				. gmph_p( 'I bambini sono liberi di essere bambini, di correre e di distrarsi. Io vi guido quando serve, con piccoli suggerimenti, per far emergere la vostra naturalezza.' ),
			),
			'gmph-split'
		),
		trim( 'gmph-section--soft ' . $modifier )
	);
}

/* --------------------------------------------------------------------------
 * Pagine
 * ----------------------------------------------------------------------- */

/**
 * Home.
 *
 * @return string
 */
function gmph_pattern_home() {
	$highlight = gmph_group(
		gmph_p( 'In evidenza', array( 'className' => 'gmph-eyebrow' ) )
		. gmph_h( '[DA AGGIORNARE: es. Adesso disponibili le Mini Sessioni di …]', 3 )
		. gmph_p( '[DA AGGIORNARE: due righe sulla campagna attiva. Se non ci sono campagne aperte, elimina questo riquadro.]' )
		. gmph_buttons( array( array( 'Scopri di più', gmph_link( '/mini-sessioni/' ) ) ) ),
		array( 'className' => 'gmph-highlight' )
	);

	return gmph_hero(
		'Fotografa di famiglia, gravidanza e bambini a Maser, Treviso',
		'Fotografie naturali e autentiche per custodire ciò che siete davvero.',
		array( array( 'Scopri i servizi', gmph_link( '/servizi/' ) ), array( 'Chiedi informazioni', gmph_link( '/contatti/' ), true ) )
	)
	. gmph_section(
		gmph_h( 'Il vostro momento, raccontato con naturalezza', 2, array( 'textAlign' => 'center' ) )
		. gmph_p( 'Ogni servizio è pensato per farvi sentire a vostro agio e raccontare chi siete, senza forzature.', array( 'align' => 'center', 'className' => 'gmph-lead' ) )
		. gmph_service_cards()
	)
	. gmph_approach()
	. gmph_how_it_works()
	. gmph_testimonials()
	. gmph_section(
		gmph_h( 'Mini sessioni durante l’anno', 2, array( 'textAlign' => 'center' ) )
		. gmph_p( 'In alcuni periodi dell’anno propongo mini sessioni a tema: un format più breve, in date dedicate, legato a un momento speciale.', array( 'align' => 'center' ) )
		. $highlight
		. gmph_buttons( array( array( 'Scopri le mini sessioni', gmph_link( '/mini-sessioni/' ), true ) ), 'gmph-center' )
	)
	. gmph_section(
		gmph_group(
			gmph_h( 'Un ricordo da regalare', 2, array( 'textAlign' => 'center' ) )
			. gmph_p( 'Un servizio fotografico è un regalo che resta: per una nascita, un anniversario o semplicemente per dire «vi voglio bene».', array( 'align' => 'center' ) )
			. gmph_buttons( array( array( 'Scopri i buoni regalo', gmph_link( '/buoni-regalo/' ), true ) ), 'gmph-center' ),
			array( 'className' => 'gmph-band' )
		)
	)
	. gmph_section(
		gmph_columns(
			array(
				gmph_img( 'gmph-portrait' ),
				gmph_h( 'Ciao, sono Giulia' )
				. gmph_p( 'Sono una fotografa di famiglia con base a Maser, in provincia di Treviso. Amo le immagini naturali, la luce morbida e le emozioni che nascono senza posa.' )
				. gmph_buttons( array( array( 'Conosciamoci', gmph_link( '/chi-sono/' ), true ) ) ),
			),
			'gmph-split'
		),
		'gmph-section--soft'
	)
	. gmph_area()
	. gmph_cta();
}

/**
 * Hub servizi.
 *
 * @return string
 */
function gmph_pattern_services_hub() {
	return gmph_page_intro( 'Servizi fotografici', 'Famiglia, gravidanza, bambini e battesimo: scegli il servizio più vicino al momento che volete ricordare.' )
		. gmph_section( gmph_service_cards() )
		. gmph_approach()
		. gmph_cta();
}

/**
 * Pagina servizio.
 *
 * @param array $s Dati del servizio.
 * @return string
 */
function gmph_pattern_service( $s ) {
	$contact = gmph_link( '/contatti/?servizio=' . $s['slug'] );
	$faq     = array();
	foreach ( $s['faq'] as $question ) {
		$faq[] = array( $question[0], isset( $question[1] ) ? $question[1] : '[DA INSERIRE: risposta]' );
	}

	return gmph_hero( $s['h1'], $s['lead'], array( array( 'Chiedi informazioni', $contact ) ) )
		. gmph_section( gmph_h( esc_html( $s['intro_title'] ) ) . gmph_p( '[DA INSERIRE: due o tre frasi sul desiderio e sul momento che le persone vogliono ricordare.]' ) )
		. gmph_section(
			gmph_h( 'Com’è l’esperienza', 2, array( 'textAlign' => 'center' ) )
			. gmph_columns(
				array_map(
					function ( $item ) {
						return gmph_step( $item[0], $item[1] );
					},
					$s['experience']
				),
				'gmph-features'
			),
			'gmph-section--soft'
		)
		. gmph_how_it_works()
		. gmph_section(
			gmph_h( 'Pacchetti', 2, array( 'textAlign' => 'center' ) )
			. gmph_p( '[DA INSERIRE: breve nota sui pacchetti. Aggiorna prezzi e contenuti qui quando cambia il listino.]', array( 'align' => 'center' ) )
			. gmph_columns( array( gmph_price_card( $contact ), gmph_price_card( $contact ), gmph_price_card( $contact ) ), 'gmph-prices' ),
			'gmph-section--soft'
		)
		. gmph_section( gmph_h( 'Alcune fotografie', 2, array( 'textAlign' => 'center' ) ) . gmph_gallery() )
		. gmph_testimonials( 2 )
		. gmph_faq( $faq )
		. gmph_area()
		. gmph_cta( 'Raccontami cosa vorresti ricordare', 'Scrivimi qualche riga: ti risponderò con disponibilità, pacchetti e tutte le informazioni.', 'Chiedi informazioni', $contact );
}

/**
 * Dati dei quattro servizi principali.
 *
 * @return array
 */
function gmph_services_data() {
	return array(
		'famiglia'   => array(
			'title'       => 'Pagina Servizio: Famiglia',
			'slug'        => 'famiglia',
			'h1'          => 'Servizio fotografico di famiglia a Maser, Treviso',
			'lead'        => 'Fotografie spontanee di genitori e bambini, in studio o all’aperto, senza dover stare fermi.',
			'intro_title' => 'Ricordare com’eravate, proprio adesso',
			'experience'  => array(
				array( 'Fotografie spontanee', 'Abbracci, risate e piccoli gesti tra genitori e bambini, così come vengono.' ),
				array( 'In studio o all’aperto', '[DA INSERIRE: opzioni disponibili e come scegliere il luogo.]' ),
				array( 'Nessuno deve stare fermo', 'I bambini si muovono, giocano e si distraggono: fa parte del racconto.' ),
			),
			'faq'         => array(
				array( 'E se i bambini non collaborano?', 'È normalissimo. La sessione segue i loro tempi: pause, giochi e momenti di distrazione fanno parte del servizio.' ),
				array( 'Come ci vestiamo?' ),
				array( 'Quanto dura il servizio?' ),
				array( 'Meglio in studio o all’aperto?' ),
				array( 'Quando riceviamo le fotografie?' ),
			),
		),
		'gravidanza' => array(
			'title'       => 'Pagina Servizio: Gravidanza',
			'slug'        => 'gravidanza',
			'h1'          => 'Servizio fotografico gravidanza a Maser, Treviso',
			'lead'        => 'Fotografie di maternità delicate e naturali, per ricordare l’attesa così com’è.',
			'intro_title' => 'L’attesa, raccontata con delicatezza',
			'experience'  => array(
				array( 'Il periodo ideale', '[DA INSERIRE: settimane consigliate per il servizio.]' ),
				array( 'Da sola, in coppia o con i figli', 'Potete scegliere chi coinvolgere: solo la mamma, la coppia o tutta la famiglia.' ),
				array( 'Abiti e studio', '[DA INSERIRE: abiti disponibili in studio e come prepararsi.]' ),
			),
			'faq'         => array(
				array( 'In quale settimana conviene fare il servizio?' ),
				array( 'Posso coinvolgere il partner e i figli?', 'Sì, potete scegliere voi chi coinvolgere nella sessione.' ),
				array( 'Cosa indosso? Ci sono abiti disponibili?' ),
				array( 'Dove si svolge il servizio?' ),
				array( 'Quanto dura?' ),
			),
		),
		'bambini'    => array(
			'title'       => 'Pagina Servizio: Bambini',
			'slug'        => 'bambini',
			'h1'          => 'Servizio fotografico bambini a Maser, Treviso',
			'lead'        => 'Sessioni brevi e giocose, senza pose rigide: i bambini restano liberi di essere se stessi.',
			'intro_title' => 'Com’è adesso, prima che cresca',
			'experience'  => array(
				array( 'Sessioni brevi', '[DA INSERIRE: durata indicativa, pensata sui tempi dei bambini.]' ),
				array( 'Niente pose rigide', 'Giochi, movimento e spontaneità al posto di sorrisi forzati.' ),
				array( 'In studio, con calma', '[DA INSERIRE: com’è organizzato lo studio per i bambini.]' ),
			),
			'faq'         => array(
				array( 'Mio figlio non sta mai fermo: è un problema?', 'No, anzi: il movimento rende le fotografie più vere. La sessione segue i suoi tempi.' ),
				array( 'Da che età si può fare?' ),
				array( 'Come lo vesto?' ),
				array( 'Possono esserci anche fratelli o genitori?' ),
				array( 'Quanto dura la sessione?' ),
			),
		),
		'battesimo'  => array(
			'title'       => 'Pagina Servizio: Battesimo',
			'slug'        => 'battesimo',
			'h1'          => 'Fotografo per battesimi a Maser e Treviso',
			'lead'        => 'La cerimonia, la famiglia e la festa raccontate con un reportage discreto e naturale.',
			'intro_title' => 'Un giorno da ricordare in famiglia',
			'experience'  => array(
				array( 'La cerimonia', '[DA INSERIRE: come lavori in chiesa, nel rispetto della celebrazione.]' ),
				array( 'La famiglia', 'Ritratti spontanei con genitori, padrini, nonni e parenti.' ),
				array( 'La festa', '[DA INSERIRE: copertura della festa e durate disponibili.]' ),
			),
			'faq'         => array(
				array( 'Fotografi anche durante la cerimonia in chiesa?' ),
				array( 'Segui anche la festa?' ),
				array( 'Quanto tempo resti?' ),
				array( 'Con quanto anticipo conviene prenotare?' ),
				array( 'Quando riceviamo le fotografie?' ),
			),
		),
	);
}

/**
 * Hub mini sessioni.
 *
 * @return string
 */
function gmph_pattern_mini_hub() {
	return gmph_page_intro( 'Mini sessioni fotografiche a Maser, Treviso', 'Brevi esperienze fotografiche in date dedicate, legate a momenti speciali dell’anno.' )
		. gmph_section(
			gmph_columns(
				array(
					gmph_h( 'Cosa sono' ) . gmph_p( 'Le mini sessioni sono esperienze fotografiche più brevi, con un format definito: durata, numero di fotografie e allestimento sono stabiliti in anticipo e uguali per tutti.' ),
					gmph_h( 'Quando vengono proposte' ) . gmph_p( 'Solo in alcuni periodi dell’anno, legati a un momento particolare, e in un numero limitato di date. [DA INSERIRE: periodi indicativi]' ),
				),
				'gmph-split'
			)
		)
		. gmph_section(
			gmph_h( 'Mini sessione o servizio completo?', 2, array( 'textAlign' => 'center' ) )
			. gmph_columns(
				array(
					gmph_step( 'Mini sessione', 'Un format breve e già definito, in date specifiche, pensato per un ricordo legato a una stagione o a una ricorrenza.' ),
					gmph_step( 'Servizio completo', 'Un servizio costruito su di voi: più tempo, scelta del luogo e del momento, racconto più ampio.' ),
				),
				'gmph-features'
			)
			. gmph_p( 'A chi sono adatte: [DA INSERIRE: famiglie, bambini, mamme…]', array( 'align' => 'center' ) ),
			'gmph-section--soft'
		)
		. gmph_section(
			gmph_h( 'Le mini sessioni', 2, array( 'textAlign' => 'center' ) )
			. gmph_columns(
				array(
					gmph_card( 'Festa della Mamma', gmph_link( '/mini-sessioni/festa-della-mamma/' ), '[DA INSERIRE: breve descrizione]' ),
					gmph_card( 'Autunno', gmph_link( '/mini-sessioni/autunno/' ), '[DA INSERIRE: breve descrizione]' ),
					gmph_card( 'Natale', gmph_link( '/mini-sessioni/natale/' ), '[DA INSERIRE: breve descrizione]' ),
				),
				'gmph-cards'
			)
		)
		. gmph_faq(
			array(
				array( 'Quanto dura una mini sessione?' ),
				array( 'Quante fotografie sono incluse?' ),
				array( 'Come si prenota una data?' ),
				array( 'Posso trasformarla in un servizio completo?' ),
			)
		)
		. gmph_cta();
}

/**
 * Pagina mini sessione.
 *
 * @param string $h1 Titolo principale della mini sessione.
 * @return string
 */
function gmph_pattern_mini( $h1 ) {
	$contact = gmph_link( '/contatti/?servizio=mini-sessioni' );
	$status  = gmph_group(
		gmph_p( 'Stato prenotazioni', array( 'className' => 'gmph-eyebrow' ) )
		. gmph_h( '[DA AGGIORNARE: Prenotazioni aperte / Prenotazioni chiuse]', 3 )
		. gmph_p( 'Date: [DA AGGIORNARE: date dell’edizione in corso]' )
		. gmph_p( '[NOTA EDITORIALE, da eliminare: con prenotazioni aperte collega il pulsante «Scegli la tua data» alla pagina di prenotazione online; a campagna chiusa cambia il testo in «Avvisami per la prossima edizione» e collegalo a Contatti.]', array( 'className' => 'gmph-note' ) ),
		array( 'className' => 'gmph-highlight' )
	);

	return gmph_hero(
		$h1,
		'[DA INSERIRE: una frase sull’atmosfera di questa mini sessione.]',
		array( array( 'Scegli la tua data', $contact ) )
	)
	. gmph_section( $status . gmph_h( 'Di cosa si tratta' ) . gmph_p( '[DA INSERIRE: introduzione alla mini sessione e al momento dell’anno a cui è legata.]' ) )
	. gmph_section(
		gmph_h( 'Cosa include', 2, array( 'textAlign' => 'center' ) )
		. gmph_columns(
			array(
				gmph_step( 'Durata', '[DA INSERIRE]' ),
				gmph_step( 'Fotografie incluse', '[DA INSERIRE]' ),
				gmph_step( 'Prezzo', '[DA INSERIRE]' ),
			),
			'gmph-features'
		),
		'gmph-section--soft'
	)
	. gmph_section( gmph_h( 'Alcune fotografie', 2, array( 'textAlign' => 'center' ) ) . gmph_gallery() )
	. gmph_section(
		gmph_h( 'Come funziona', 2, array( 'textAlign' => 'center' ) )
		. gmph_columns(
			array(
				gmph_step( '1. Scegli la data', 'Prenoti uno degli orari disponibili.' ),
				gmph_step( '2. Vieni in studio', 'Ci vediamo per una sessione breve e rilassata.' ),
				gmph_step( '3. Ricevi le fotografie', '[DA INSERIRE: tempi e modalità di consegna.]' ),
			),
			'gmph-steps'
		),
		'gmph-section--soft'
	)
	. gmph_faq(
		array(
			array( 'Chi può partecipare?' ),
			array( 'Come ci vestiamo?' ),
			array( 'Cosa succede se dobbiamo spostare la data?' ),
			array( 'Si possono acquistare fotografie in più?' ),
		)
	)
	. gmph_cta( 'Scegli la tua data', '[DA AGGIORNARE: invito a prenotare oppure, a campagna chiusa, a ricevere un avviso per la prossima edizione.]', 'Scegli la tua data', $contact );
}

/**
 * Buoni regalo.
 *
 * @return string
 */
function gmph_pattern_gift() {
	$contact = gmph_link( '/contatti/?servizio=buono-regalo' );
	return gmph_hero( 'Regala un servizio fotografico', 'Un ricordo da custodire negli anni, da regalare a chi ami.', array( array( 'Richiedi un buono regalo', $contact ) ) )
		. gmph_section( gmph_h( 'Perché regalare fotografie' ) . gmph_p( '[DA INSERIRE: perché un servizio fotografico è un regalo speciale.]' ) )
		. gmph_section(
			gmph_h( 'Come funziona', 2, array( 'textAlign' => 'center' ) )
			. gmph_columns(
				array(
					gmph_step( '1. Mi scrivi', 'Mi racconti a chi vuoi fare il regalo e quale buono preferisci.' ),
					gmph_step( '2. Prepariamo il buono', '[DA INSERIRE: come viene preparato e consegnato il buono.]' ),
					gmph_step( '3. Si prenota la sessione', 'Chi riceve il buono mi contatta per scegliere la data.' ),
				),
				'gmph-steps'
			),
			'gmph-section--soft'
		)
		. gmph_section(
			gmph_h( 'Due tipi di buono', 2, array( 'textAlign' => 'center' ) )
			. gmph_columns(
				array(
					gmph_step( 'Buono a valore', 'Un importo da usare per il servizio preferito. [DA INSERIRE: importi disponibili]' ),
					gmph_step( 'Buono per un servizio', 'Un servizio specifico già scelto, ad esempio una sessione di famiglia.' ),
				),
				'gmph-features'
			)
			. gmph_p( 'Validità: [DA INSERIRE] · A chi può essere regalato: [DA INSERIRE]', array( 'align' => 'center' ) )
		)
		. gmph_faq(
			array(
				array( 'Quanto dura la validità del buono?' ),
				array( 'Come viene consegnato?' ),
				array( 'Chi riceve il buono può scegliere il servizio?' ),
				array( 'Posso aggiungere un messaggio personale?' ),
			)
		)
		. gmph_cta( 'Un regalo che resta', 'Scrivimi per chiedere informazioni su importi, servizi e consegna del buono.', 'Richiedi un buono regalo', $contact );
}

/**
 * Chi sono.
 *
 * @return string
 */
function gmph_pattern_about() {
	return gmph_section(
		gmph_columns(
			array(
				gmph_img( 'gmph-portrait' ),
				gmph_p( 'Chi sono', array( 'className' => 'gmph-eyebrow' ) )
				. gmph_h( 'Ciao, sono Giulia', 1 )
				. gmph_p( 'Sono una fotografa di famiglia con base a Maser, in provincia di Treviso. Amo le immagini naturali, la luce morbida e le emozioni che nascono senza posa.', array( 'className' => 'gmph-lead' ) ),
			),
			'gmph-split'
		),
		'gmph-section--soft'
	)
	. gmph_section(
		gmph_h( 'La mia storia' ) . gmph_p( '[DA INSERIRE: breve storia, poche righe.]' )
		. gmph_h( 'Perché fotografo le famiglie' ) . gmph_p( '[DA INSERIRE]' )
		. gmph_h( 'Il mio modo di lavorare' ) . gmph_p( 'Durante ogni servizio il mio obiettivo è farvi sentire a vostro agio, così da raccontare la vostra storia in modo sincero. Con i bambini seguo i loro tempi: il gioco e il movimento fanno parte del racconto.' )
		. gmph_h( 'Lo studio e il territorio' ) . gmph_p( '[DA INSERIRE: lo studio a Maser e la zona in cui lavori.]' )
	)
	. gmph_cta( 'Conosciamoci', 'Raccontami di voi e di cosa vorreste ricordare.', 'Chiedi informazioni' );
}

/**
 * CTA per la fine delle guide (larghezza del testo).
 *
 * @return string
 */
function gmph_pattern_guide_cta() {
	return gmph_group(
		gmph_h( '[DA ADATTARE: es. Vi piacerebbe un servizio fotografico di famiglia?]', 3 )
		. gmph_p( '[DA ADATTARE: una frase che colleghi la guida al servizio.]' )
		. gmph_buttons( array( array( 'Chiedi informazioni', gmph_link( '/contatti/' ) ), array( 'Scopri il servizio', gmph_link( '/servizi/' ), true ) ) ),
		array( 'className' => 'gmph-cta-box' )
	);
}

/* --------------------------------------------------------------------------
 * Registrazione
 * ----------------------------------------------------------------------- */

/**
 * Registra categoria e pattern.
 */
function gmph_register_patterns() {
	register_block_pattern_category( 'gmph', array( 'label' => __( 'Giulia Malosso', 'gmph' ) ) );

	$page = function ( $title, $content, $description = '' ) {
		return array(
			'title'       => $title,
			'description' => $description,
			'categories'  => array( 'gmph' ),
			'postTypes'   => array( 'page' ),
			'blockTypes'  => array( 'core/post-content' ),
			'content'     => $content,
		);
	};
	$section = function ( $title, $content ) {
		return array(
			'title'      => $title,
			'categories' => array( 'gmph' ),
			'content'    => $content,
		);
	};

	register_block_pattern( 'gmph/home', $page( 'Home GMPH', gmph_pattern_home(), 'Struttura completa della Home.' ) );
	register_block_pattern( 'gmph/hub-servizi', $page( 'Hub Servizi', gmph_pattern_services_hub() ) );
	foreach ( gmph_services_data() as $slug => $service ) {
		register_block_pattern( 'gmph/servizio-' . $slug, $page( $service['title'], gmph_pattern_service( $service ) ) );
	}
	register_block_pattern( 'gmph/hub-mini-sessioni', $page( 'Hub Mini Sessioni', gmph_pattern_mini_hub() ) );
	$minis = array(
		'natale'            => array( 'Natale', 'Mini sessioni di Natale a Maser, Treviso' ),
		'autunno'           => array( 'Autunno', 'Mini sessioni d’autunno a Maser, Treviso' ),
		'festa-della-mamma' => array( 'Festa della Mamma', 'Mini sessioni per la Festa della Mamma a Maser, Treviso' ),
	);
	foreach ( $minis as $slug => $mini ) {
		register_block_pattern( 'gmph/mini-sessione-' . $slug, $page( 'Pagina Mini Sessione: ' . $mini[0], gmph_pattern_mini( $mini[1] ) ) );
	}
	register_block_pattern( 'gmph/buoni-regalo', $page( 'Buoni regalo', gmph_pattern_gift() ) );
	register_block_pattern( 'gmph/chi-sono', $page( 'Chi sono', gmph_pattern_about() ) );

	register_block_pattern( 'gmph/cta-finale', $section( 'CTA finale', gmph_cta() ) );
	register_block_pattern( 'gmph/testimonianze', $section( 'Testimonianze', gmph_testimonials() ) );
	register_block_pattern(
		'gmph/faq',
		$section(
			'FAQ',
			gmph_faq(
				array(
					array( '[DA INSERIRE: domanda]' ),
					array( '[DA INSERIRE: domanda]' ),
					array( '[DA INSERIRE: domanda]' ),
				)
			)
		)
	);
	register_block_pattern( 'gmph/cta-guida', $section( 'CTA fine guida', gmph_pattern_guide_cta() ) );
}
add_action( 'init', 'gmph_register_patterns' );
