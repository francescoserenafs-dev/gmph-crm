<?php
/**
 * Template Name: Landing GMPH
 *
 * Pagine costruite a sezioni nel Block Editor (servizi, mini sessioni, buoni regalo, chi sono).
 * Il titolo H1 non viene stampato: va inserito nel contenuto.
 *
 * @package gmph
 */

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
