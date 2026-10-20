<?php
/**
 * Articolo singolo (guide).
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
				<p class="post-meta"><time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time></p>
			</div>
		</header>

		<?php if ( has_post_thumbnail() ) : ?>
			<figure class="post-thumbnail container">
				<?php
				the_post_thumbnail(
					'large',
					array(
						'loading'       => 'eager',
						'fetchpriority' => 'high',
						'sizes'         => '(max-width: 1200px) 100vw, 1200px',
					)
				);
				?>
			</figure>
		<?php endif; ?>

		<div class="page-content entry-content">
			<?php the_content(); ?>
		</div>
	</article>
	<?php
endwhile;

get_footer();
