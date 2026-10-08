<?php
/**
 * Giulia Malosso Photography - funzioni del tema.
 *
 * @package gmph
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'GMPH_VERSION', '1.0.0' );

/**
 * Impostazioni di base del tema.
 */
function gmph_setup() {
	load_theme_textdomain( 'gmph', get_template_directory() . '/languages' );

	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support(
		'custom-logo',
		array(
			'height'      => 80,
			'width'       => 240,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);

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
	wp_enqueue_style(
		'gmph-fonts',
		'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap',
		array(),
		null
	);

	wp_enqueue_style( 'gmph-style', get_stylesheet_uri(), array( 'gmph-fonts' ), GMPH_VERSION );

	wp_enqueue_script(
		'gmph-main',
		get_template_directory_uri() . '/assets/js/main.js',
		array(),
		GMPH_VERSION,
		true
	);
}
add_action( 'wp_enqueue_scripts', 'gmph_assets' );

/**
 * Aree widget.
 */
function gmph_widgets_init() {
	register_sidebar(
		array(
			'name'          => __( 'Footer', 'gmph' ),
			'id'            => 'footer-1',
			'description'   => __( 'Widget mostrati nel footer.', 'gmph' ),
			'before_widget' => '<div class="footer-widget %2$s">',
			'after_widget'  => '</div>',
			'before_title'  => '<h4>',
			'after_title'   => '</h4>',
		)
	);
}
add_action( 'widgets_init', 'gmph_widgets_init' );

/**
 * Dati di contatto riutilizzabili (modificabili da Aspetto > Personalizza).
 *
 * @param string $key Chiave del dato richiesto.
 * @return string
 */
function gmph_contact( $key ) {
	$defaults = array(
		'email'     => get_theme_mod( 'gmph_email', 'ciao@giuliamalosso.it' ),
		'phone'     => get_theme_mod( 'gmph_phone', '+39 000 000 0000' ),
		'city'      => get_theme_mod( 'gmph_city', 'Maser (TV)' ),
		'instagram' => get_theme_mod( 'gmph_instagram', 'https://instagram.com/' ),
		'facebook'  => get_theme_mod( 'gmph_facebook', 'https://facebook.com/' ),
	);

	return isset( $defaults[ $key ] ) ? $defaults[ $key ] : '';
}

/**
 * Opzioni personalizzabili dal Customizer.
 *
 * @param WP_Customize_Manager $wp_customize Gestore del Customizer.
 */
function gmph_customize_register( $wp_customize ) {
	$wp_customize->add_section(
		'gmph_contact_section',
		array(
			'title'    => __( 'Contatti e social', 'gmph' ),
			'priority' => 30,
		)
	);

	$fields = array(
		'gmph_email'     => array( 'Email', 'ciao@giuliamalosso.it' ),
		'gmph_phone'     => array( 'Telefono', '+39 000 000 0000' ),
		'gmph_city'      => array( 'Città / zona', 'Maser (TV)' ),
		'gmph_instagram' => array( 'URL Instagram', 'https://instagram.com/' ),
		'gmph_facebook'  => array( 'URL Facebook', 'https://facebook.com/' ),
	);

	foreach ( $fields as $id => $data ) {
		$wp_customize->add_setting(
			$id,
			array(
				'default'           => $data[1],
				'sanitize_callback' => 'sanitize_text_field',
			)
		);
		$wp_customize->add_control(
			$id,
			array(
				'label'   => $data[0],
				'section' => 'gmph_contact_section',
				'type'    => 'text',
			)
		);
	}
}
add_action( 'customize_register', 'gmph_customize_register' );

/**
 * Genera un'immagine segnaposto SVG (usata finché non si caricano le foto reali).
 *
 * @param string $label Testo mostrato al centro del segnaposto.
 * @return string Data URI pronto per l'attributo src.
 */
function gmph_placeholder( $label = '' ) {
	$label = $label ? strtoupper( substr( $label, 0, 24 ) ) : 'FOTO';
	$svg   = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">'
		. '<rect width="600" height="800" fill="#efe6dc"/>'
		. '<rect x="1" y="1" width="598" height="798" fill="none" stroke="#d8d0c5"/>'
		. '<text x="50%" y="50%" fill="#9b5d43" font-family="Georgia, serif" font-size="30" '
		. 'letter-spacing="3" text-anchor="middle" dominant-baseline="middle">' . esc_html( $label ) . '</text>'
		. '</svg>';

	return 'data:image/svg+xml;charset=utf-8,' . rawurlencode( $svg );
}

/**
 * Menu di fallback quando non è impostato alcun menu.
 */
function gmph_fallback_menu() {
	echo '<ul>';
	echo '<li><a href="' . esc_url( home_url( '/' ) ) . '">' . esc_html__( 'Home', 'gmph' ) . '</a></li>';
	echo '<li><a href="#servizi">' . esc_html__( 'Servizi', 'gmph' ) . '</a></li>';
	echo '<li><a href="#portfolio">' . esc_html__( 'Portfolio', 'gmph' ) . '</a></li>';
	echo '<li><a href="#chi-sono">' . esc_html__( 'Chi sono', 'gmph' ) . '</a></li>';
	echo '<li><a href="#contatti">' . esc_html__( 'Contatti', 'gmph' ) . '</a></li>';
	echo '</ul>';
}
