<?php
/**
 * Pagina 404.
 *
 * @package gmph
 */

get_header();
?>

<section class="page-hero">
	<div class="container">
		<span class="eyebrow">404</span>
		<h1><?php esc_html_e( 'Pagina non trovata', 'gmph' ); ?></h1>
		<p class="lead center"><?php esc_html_e( 'La pagina che cercavi non esiste o è stata spostata.', 'gmph' ); ?></p>
		<p style="margin-top:1.5rem;">
			<a class="btn btn--primary" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Torna alla home', 'gmph' ); ?></a>
		</p>
	</div>
</section>

<?php
get_footer();
