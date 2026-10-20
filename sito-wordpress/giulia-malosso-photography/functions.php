<?php
/**
 * Giulia Malosso Photography - funzioni del tema.
 *
 * @package gmph
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'GMPH_VERSION', '2.0.0' );
define( 'GMPH_FONTS_URL', 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap' );

require get_template_directory() . '/inc/contact-form.php';
require get_template_directory() . '/inc/block-patterns.php';

/**
 * Impostazioni di base del tema.
 */
function gmph_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script', 'navigation-widgets' ) );
	add_theme_support(
		'custom-logo',
		array(
			'height'      => 80,
			'width'       => 240,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);
	add_theme_support( 'align-wide' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'editor-styles' );
	add_editor_style( array( GMPH_FONTS_URL, 'assets/css/editor.css' ) );

	register_nav_menus(
		array(
			'primary' => __( 'Menu principale', 'gmph' ),
			'footer'  => __( 'Menu footer', 'gmph' ),
		)
	);
}
add_action( 'after_setup_theme', 'gmph_setup' );

/**
 * Larghezza contenuto per gli embed.
 */
function gmph_content_width() {
	$GLOBALS['content_width'] = 1200;
}
add_action( 'after_setup_theme', 'gmph_content_width', 0 );

/**
 * Caricamento stili e script.
 */
function gmph_assets() {
	// Font ancora da Google: vedi GUIDA-INSTALLAZIONE.md per l'hosting locale.
	wp_enqueue_style( 'gmph-fonts', GMPH_FONTS_URL, array(), null );
	wp_enqueue_style( 'gmph-style', get_stylesheet_uri(), array( 'gmph-fonts' ), GMPH_VERSION );
	wp_enqueue_script( 'gmph-main', get_template_directory_uri() . '/assets/js/main.js', array(), GMPH_VERSION, true );
}
add_action( 'wp_enqueue_scripts', 'gmph_assets' );

/**
 * Preconnect verso i server dei font.
 *
 * @param array  $urls          URL dei resource hints.
 * @param string $relation_type Tipo di hint.
 * @return array
 */
function gmph_resource_hints( $urls, $relation_type ) {
	if ( 'preconnect' === $relation_type && wp_style_is( 'gmph-fonts', 'queue' ) ) {
		$urls[] = 'https://fonts.googleapis.com';
		$urls[] = array(
			'href'        => 'https://fonts.gstatic.com',
			'crossorigin' => 'anonymous',
		);
	}
	return $urls;
}
add_filter( 'wp_resource_hints', 'gmph_resource_hints', 10, 2 );

/**
 * Impostazioni attività modificabili da Aspetto > Personalizza.
 *
 * @return array<string, array{0: string, 1: string, 2: callable}>
 */
function gmph_setting_fields() {
	return array(
		'email'     => array( __( 'Email (riceve anche le richieste del modulo)', 'gmph' ), 'email', 'sanitize_email' ),
		'phone'     => array( __( 'Telefono', 'gmph' ), 'text', 'sanitize_text_field' ),
		'whatsapp'  => array( __( 'Numero WhatsApp (con prefisso, es. +39…)', 'gmph' ), 'text', 'gmph_sanitize_phone' ),
		'city'      => array( __( 'Località (es. Maser, Treviso)', 'gmph' ), 'text', 'sanitize_text_field' ),
		'address'   => array( __( 'Indirizzo studio', 'gmph' ), 'text', 'sanitize_text_field' ),
		'vat'       => array( __( 'Partita IVA', 'gmph' ), 'text', 'sanitize_text_field' ),
		'instagram' => array( __( 'URL Instagram', 'gmph' ), 'url', 'gmph_sanitize_url' ),
		'facebook'  => array( __( 'URL Facebook', 'gmph' ), 'url', 'gmph_sanitize_url' ),
		'maps'      => array( __( 'URL Google Business / Maps', 'gmph' ), 'url', 'gmph_sanitize_url' ),
	);
}

/**
 * Sanitizza un URL (il Customizer passa anche l'oggetto setting, non accettato da esc_url_raw).
 *
 * @param string $value URL inserito.
 * @return string
 */
function gmph_sanitize_url( $value ) {
	return esc_url_raw( (string) $value );
}

/**
 * Mantiene solo cifre e "+" iniziale.
 *
 * @param string $value Numero inserito.
 * @return string
 */
function gmph_sanitize_phone( $value ) {
	$value  = trim( (string) $value );
	$plus   = 0 === strpos( $value, '+' ) ? '+' : '';
	$digits = preg_replace( '/\D+/', '', $value );
	return $digits ? $plus . $digits : '';
}

/**
 * Valore di un'impostazione attività ('' se non configurata).
 *
 * @param string $key Chiave (email, phone, whatsapp, city, address, vat, instagram, facebook, maps).
 * @return string
 */
function gmph_setting( $key ) {
	return (string) get_theme_mod( 'gmph_' . $key, '' );
}

/**
 * Link WhatsApp, oppure '' se il numero non è configurato.
 *
 * @return string
 */
function gmph_whatsapp_url() {
	$digits = preg_replace( '/\D+/', '', gmph_setting( 'whatsapp' ) );
	return $digits ? 'https://wa.me/' . $digits : '';
}

/**
 * Registra le impostazioni nel Customizer.
 *
 * @param WP_Customize_Manager $wp_customize Gestore del Customizer.
 */
function gmph_customize_register( $wp_customize ) {
	$wp_customize->add_section(
		'gmph_contact_section',
		array(
			'title'       => __( 'Dati attività e contatti', 'gmph' ),
			'description' => __( 'I campi vuoti non vengono mostrati sul sito.', 'gmph' ),
			'priority'    => 30,
		)
	);

	foreach ( gmph_setting_fields() as $key => $field ) {
		$wp_customize->add_setting(
			'gmph_' . $key,
			array(
				'default'           => '',
				'sanitize_callback' => $field[2],
			)
		);
		$wp_customize->add_control(
			'gmph_' . $key,
			array(
				'label'   => $field[0],
				'section' => 'gmph_contact_section',
				'type'    => $field[1],
			)
		);
	}
}
add_action( 'customize_register', 'gmph_customize_register' );

/**
 * Permalink di una pagina per percorso, oppure '' se non esiste.
 *
 * @param string $path Percorso della pagina (es. "servizi" o "mini-sessioni/natale").
 * @return string
 */
function gmph_page_url( $path ) {
	$page = get_page_by_path( $path );
	return ( $page && 'publish' === $page->post_status ) ? get_permalink( $page ) : '';
}

/**
 * Immagini dei pattern: niente output se l'immagine non è stata scelta;
 * l'immagine dell'hero viene caricata subito e con priorità alta.
 *
 * @param string $content Markup del blocco.
 * @param array  $block   Dati del blocco.
 * @return string
 */
function gmph_render_image_blocks( $content, $block ) {
	if ( 'core/gallery' === $block['blockName'] && empty( $block['innerBlocks'] ) ) {
		return '';
	}
	if ( 'core/image' !== $block['blockName'] ) {
		return $content;
	}
	if ( false === stripos( $content, ' src=' ) ) {
		return '';
	}

	$class = isset( $block['attrs']['className'] ) ? $block['attrs']['className'] : '';
	if ( false !== strpos( $class, 'gmph-hero__media' ) ) {
		$tags = new WP_HTML_Tag_Processor( $content );
		if ( $tags->next_tag( 'img' ) ) {
			$tags->add_class( 'gmph-hero__img' );
			$tags->set_attribute( 'loading', 'eager' );
			$tags->set_attribute( 'fetchpriority', 'high' );
			$tags->set_attribute( 'decoding', 'async' );
			$content = $tags->get_updated_html();
		}
	}
	return $content;
}
add_filter( 'render_block', 'gmph_render_image_blocks', 10, 2 );

/**
 * L'immagine dell'hero occupa tutta la larghezza: sizes adeguato al srcset generato da WordPress.
 *
 * @param string $image Tag img filtrato.
 * @return string
 */
function gmph_hero_image_sizes( $image ) {
	if ( false === strpos( $image, 'gmph-hero__img' ) ) {
		return $image;
	}
	$tags = new WP_HTML_Tag_Processor( $image );
	if ( $tags->next_tag( 'img' ) && $tags->get_attribute( 'srcset' ) ) {
		$tags->set_attribute( 'sizes', '100vw' );
		return $tags->get_updated_html();
	}
	return $image;
}
add_filter( 'wp_content_img_tag', 'gmph_hero_image_sizes' );
