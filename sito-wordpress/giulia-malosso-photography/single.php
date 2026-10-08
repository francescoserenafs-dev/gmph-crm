<?php
/**
 * Articolo singolo.
 *
 * @package gmph
 */

get_header();

while ( have_posts() ) :
	the_post();
	?>
	<section class="page-hero">
		<div class="container">
			<h1><?php the_title(); ?></h1>
			<p class="lead center"><?php echo esc_html( get_the_date() ); ?></p>
		</div>
	</section>

	<section class="page-content">
		<div class="container">
			<?php
			if ( has_post_thumbnail() ) {
				the_post_thumbnail( 'large' );
			}
			the_content();
			?>
		</div>
	</section>
	<?php
endwhile;

get_footer();
