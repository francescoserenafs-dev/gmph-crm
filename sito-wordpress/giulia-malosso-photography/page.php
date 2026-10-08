<?php
/**
 * Pagine statiche (modificabili dall'editor o con Elementor).
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
		</div>
	</section>

	<section class="page-content">
		<div class="container">
			<?php
			the_content();

			wp_link_pages(
				array(
					'before' => '<div class="page-links">' . esc_html__( 'Pagine:', 'gmph' ),
					'after'  => '</div>',
				)
			);
			?>
		</div>
	</section>
	<?php
endwhile;

get_footer();
