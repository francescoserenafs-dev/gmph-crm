<?php
/**
 * Pagine semplici ed editoriali (privacy, cookie, pagine informative).
 *
 * @package gmph
 */

get_header();

while ( have_posts() ) :
	the_post();
	?>
	<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
		<header class="page-hero">
			<div class="container">
				<h1><?php the_title(); ?></h1>
			</div>
		</header>

		<div class="page-content entry-content">
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
	</article>
	<?php
endwhile;

get_footer();
