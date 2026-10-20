<?php
/**
 * Pagina 404.
 *
 * @package gmph
 */

get_header();

$gmph_services_url = gmph_page_url( 'servizi' );
$gmph_contact_url  = gmph_page_url( 'contatti' );
?>

<section class="page-hero">
	<div class="container">
		<p class="eyebrow">404</p>
		<h1><?php esc_html_e( 'Pagina non trovata', 'gmph' ); ?></h1>
		<p class="lead center"><?php esc_html_e( 'La pagina che cercavi non esiste o è stata spostata. Puoi ripartire da qui:', 'gmph' ); ?></p>
		<p class="error-links">
			<a class="btn btn--primary" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Torna alla home', 'gmph' ); ?></a>
			<?php if ( $gmph_services_url ) : ?>
				<a class="btn btn--ghost" href="<?php echo esc_url( $gmph_services_url ); ?>"><?php esc_html_e( 'Servizi', 'gmph' ); ?></a>
			<?php endif; ?>
			<?php if ( $gmph_contact_url ) : ?>
				<a class="btn btn--ghost" href="<?php echo esc_url( $gmph_contact_url ); ?>"><?php esc_html_e( 'Contatti', 'gmph' ); ?></a>
			<?php endif; ?>
		</p>
	</div>
</section>

<?php
get_footer();
