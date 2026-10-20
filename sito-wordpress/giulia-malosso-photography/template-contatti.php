<?php
/**
 * Template Name: Contatti
 *
 * Pagina contatti: il contenuto dell'editor (rassicurazione, tempi di risposta) seguito da
 * recapiti configurati in Personalizza e dal modulo, inviato con wp_mail().
 *
 * @package gmph
 */

get_header();

$gmph_email     = gmph_setting( 'email' );
$gmph_phone     = gmph_setting( 'phone' );
$gmph_whatsapp  = gmph_whatsapp_url();
$gmph_instagram = gmph_setting( 'instagram' );
$gmph_address   = gmph_setting( 'address' );
$gmph_city      = gmph_setting( 'city' );
$gmph_maps      = gmph_setting( 'maps' );
$gmph_has_info  = $gmph_email || $gmph_phone || $gmph_whatsapp || $gmph_instagram || $gmph_address || $gmph_city;

while ( have_posts() ) :
	the_post();
	?>
	<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
		<header class="page-hero">
			<div class="container">
				<h1><?php the_title(); ?></h1>
			</div>
		</header>

		<?php if ( '' !== trim( get_the_content() ) ) : ?>
			<div class="page-content page-content--intro entry-content">
				<?php the_content(); ?>
			</div>
		<?php endif; ?>

		<section class="page-content" aria-label="<?php esc_attr_e( 'Modulo e recapiti', 'gmph' ); ?>">
			<div class="container contact<?php echo $gmph_has_info ? '' : ' contact--single'; ?>">
				<?php gmph_contact_form(); ?>

				<?php if ( $gmph_has_info ) : ?>
					<aside class="contact__info">
						<h2><?php esc_html_e( 'Altri modi per contattarmi', 'gmph' ); ?></h2>
						<?php if ( $gmph_whatsapp ) : ?>
							<p><a class="btn btn--ghost" href="<?php echo esc_url( $gmph_whatsapp ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Scrivimi su WhatsApp', 'gmph' ); ?></a></p>
						<?php endif; ?>
						<ul>
							<?php if ( $gmph_email ) : ?>
								<?php $gmph_email_obf = antispambot( sanitize_email( $gmph_email ) ); ?>
								<li>
									<strong><?php esc_html_e( 'Email', 'gmph' ); ?></strong>
									<a href="mailto:<?php echo $gmph_email_obf; // phpcs:ignore WordPress.Security.EscapeOutput -- email sanitizzata, solo entità HTML. ?>"><?php echo $gmph_email_obf; // phpcs:ignore WordPress.Security.EscapeOutput ?></a>
								</li>
							<?php endif; ?>
							<?php if ( $gmph_phone ) : ?>
								<li>
									<strong><?php esc_html_e( 'Telefono', 'gmph' ); ?></strong>
									<a href="tel:<?php echo esc_attr( preg_replace( '/[^\d+]/', '', $gmph_phone ) ); ?>"><?php echo esc_html( $gmph_phone ); ?></a>
								</li>
							<?php endif; ?>
							<?php if ( $gmph_instagram ) : ?>
								<li>
									<strong><?php esc_html_e( 'Instagram', 'gmph' ); ?></strong>
									<a href="<?php echo esc_url( $gmph_instagram ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Seguimi su Instagram', 'gmph' ); ?></a>
								</li>
							<?php endif; ?>
							<?php if ( $gmph_address || $gmph_city ) : ?>
								<li>
									<strong><?php esc_html_e( 'Studio', 'gmph' ); ?></strong>
									<address><?php echo esc_html( $gmph_address ? $gmph_address : $gmph_city ); ?></address>
									<?php if ( $gmph_maps ) : ?>
										<a href="<?php echo esc_url( $gmph_maps ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Apri in Google Maps', 'gmph' ); ?></a>
									<?php endif; ?>
								</li>
							<?php endif; ?>
						</ul>
					</aside>
				<?php endif; ?>
			</div>
		</section>
	</article>
	<?php
endwhile;

get_footer();
