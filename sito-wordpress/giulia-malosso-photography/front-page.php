<?php
/**
 * Home: contenuto della pagina impostata come Home statica, costruito nel Block Editor.
 *
 * @package gmph
 */

// Se la Home mostra gli ultimi articoli, usa l'elenco standard.
if ( 'page' !== get_option( 'show_on_front' ) ) {
	get_template_part( 'index' );
	return;
}

get_header();

while ( have_posts() ) :
	the_post();
	?>
	<article id="post-<?php the_ID(); ?>" <?php post_class( 'landing entry-content' ); ?>>
		<?php the_content(); ?>
	</article>
	<?php
endwhile;

get_footer();
