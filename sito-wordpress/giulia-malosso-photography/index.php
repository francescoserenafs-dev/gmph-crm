<?php
/**
 * Elenco articoli (pagina Guide), archivi e risultati di ricerca.
 *
 * @package gmph
 */

get_header();
?>

<header class="page-hero">
	<div class="container">
		<h1>
			<?php
			if ( is_search() ) {
				/* translators: %s: termine cercato. */
				printf( esc_html__( 'Risultati per: %s', 'gmph' ), '<em>' . esc_html( get_search_query() ) . '</em>' );
			} elseif ( is_archive() ) {
				the_archive_title();
			} elseif ( is_home() && get_option( 'page_for_posts' ) ) {
				echo esc_html( get_the_title( (int) get_option( 'page_for_posts' ) ) );
			} else {
				esc_html_e( 'Guide', 'gmph' );
			}
			?>
		</h1>
	</div>
</header>

<section class="page-content">
	<div class="container">
		<?php if ( have_posts() ) : ?>
			<div class="post-grid">
				<?php
				while ( have_posts() ) :
					the_post();
					?>
					<article <?php post_class( 'post-card' ); ?>>
						<?php if ( has_post_thumbnail() ) : ?>
							<a class="post-card__media" href="<?php the_permalink(); ?>" tabindex="-1" aria-hidden="true">
								<?php the_post_thumbnail( 'medium_large', array( 'sizes' => '(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 380px' ) ); ?>
							</a>
						<?php endif; ?>
						<h2 class="post-card__title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
						<p><?php echo esc_html( wp_trim_words( get_the_excerpt(), 22 ) ); ?></p>
					</article>
				<?php endwhile; ?>
			</div>

			<div class="pagination">
				<?php the_posts_pagination( array( 'mid_size' => 1 ) ); ?>
			</div>
		<?php else : ?>
			<p class="text-center"><?php esc_html_e( 'Nessun contenuto trovato.', 'gmph' ); ?></p>
		<?php endif; ?>
	</div>
</section>

<?php
get_footer();
