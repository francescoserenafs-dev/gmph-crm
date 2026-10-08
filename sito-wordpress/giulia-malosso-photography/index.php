<?php
/**
 * Fallback principale (archivi, blog, risultati di ricerca).
 *
 * @package gmph
 */

get_header();
?>

<section class="page-hero">
	<div class="container">
		<h1>
			<?php
			if ( is_search() ) {
				/* translators: %s: termine cercato. */
				printf( esc_html__( 'Risultati per: %s', 'gmph' ), '<em>' . esc_html( get_search_query() ) . '</em>' );
			} elseif ( is_archive() ) {
				the_archive_title();
			} else {
				esc_html_e( 'Dal blog', 'gmph' );
			}
			?>
		</h1>
	</div>
</section>

<section class="page-content">
	<div class="container">
		<?php if ( have_posts() ) : ?>
			<div class="grid grid--3">
				<?php
				while ( have_posts() ) :
					the_post();
					?>
					<article <?php post_class( 'service-card' ); ?>>
						<?php if ( has_post_thumbnail() ) : ?>
							<a href="<?php the_permalink(); ?>"><?php the_post_thumbnail( 'medium' ); ?></a>
						<?php endif; ?>
						<h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
						<p><?php echo esc_html( wp_trim_words( get_the_excerpt(), 22 ) ); ?></p>
					</article>
				<?php endwhile; ?>
			</div>

			<div style="margin-top:2.5rem; text-align:center;">
				<?php the_posts_pagination( array( 'mid_size' => 1 ) ); ?>
			</div>
		<?php else : ?>
			<p class="text-center"><?php esc_html_e( 'Nessun contenuto trovato.', 'gmph' ); ?></p>
		<?php endif; ?>
	</div>
</section>

<?php
get_footer();
