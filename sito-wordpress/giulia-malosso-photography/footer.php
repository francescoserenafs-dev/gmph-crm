<?php
/**
 * Footer del tema.
 *
 * @package gmph
 */
?>
</main><!-- #content -->

<?php
$gmph_email     = gmph_setting( 'email' );
$gmph_phone     = gmph_setting( 'phone' );
$gmph_whatsapp  = gmph_whatsapp_url();
$gmph_address   = gmph_setting( 'address' );
$gmph_city      = gmph_setting( 'city' );
$gmph_maps      = gmph_setting( 'maps' );
$gmph_instagram = gmph_setting( 'instagram' );
$gmph_facebook  = gmph_setting( 'facebook' );
$gmph_vat       = gmph_setting( 'vat' );
$gmph_cookie    = gmph_page_url( 'cookie-policy' );
?>
<footer class="site-footer">
	<div class="container">
		<div class="site-footer__grid">
			<div>
				<p class="site-footer__brand">Giulia Malosso Photography</p>
				<p class="site-footer__text">
					<?php esc_html_e( 'Fotografia di famiglia, coppia, ritratto e per attività a Maser, in provincia di Treviso.', 'gmph' ); ?>
				</p>
				<?php if ( $gmph_instagram || $gmph_facebook ) : ?>
					<ul class="social-links">
						<?php if ( $gmph_instagram ) : ?>
							<li><a href="<?php echo esc_url( $gmph_instagram ); ?>" target="_blank" rel="noopener">Instagram</a></li>
						<?php endif; ?>
						<?php if ( $gmph_facebook ) : ?>
							<li><a href="<?php echo esc_url( $gmph_facebook ); ?>" target="_blank" rel="noopener">Facebook</a></li>
						<?php endif; ?>
					</ul>
				<?php endif; ?>
			</div>

			<?php if ( has_nav_menu( 'footer' ) ) : ?>
				<nav aria-labelledby="footer-nav-title">
					<h2 class="site-footer__title" id="footer-nav-title"><?php esc_html_e( 'Esplora', 'gmph' ); ?></h2>
					<?php
					wp_nav_menu(
						array(
							'theme_location' => 'footer',
							'container'      => false,
							'depth'          => 1,
						)
					);
					?>
				</nav>
			<?php endif; ?>

			<div>
				<h2 class="site-footer__title"><?php esc_html_e( 'Contatti', 'gmph' ); ?></h2>
				<ul class="site-footer__contacts">
					<?php if ( $gmph_email ) : ?>
						<?php $gmph_email_obf = antispambot( sanitize_email( $gmph_email ) ); ?>
						<li><a href="mailto:<?php echo $gmph_email_obf; // phpcs:ignore WordPress.Security.EscapeOutput -- email sanitizzata, solo entità HTML. ?>"><?php echo $gmph_email_obf; // phpcs:ignore WordPress.Security.EscapeOutput ?></a></li>
					<?php endif; ?>
					<?php if ( $gmph_phone ) : ?>
						<li><a href="tel:<?php echo esc_attr( preg_replace( '/[^\d+]/', '', $gmph_phone ) ); ?>"><?php echo esc_html( $gmph_phone ); ?></a></li>
					<?php endif; ?>
					<?php if ( $gmph_whatsapp ) : ?>
						<li><a href="<?php echo esc_url( $gmph_whatsapp ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Scrivimi su WhatsApp', 'gmph' ); ?></a></li>
					<?php endif; ?>
					<?php if ( $gmph_address || $gmph_city ) : ?>
						<li>
							<address><?php echo esc_html( $gmph_address ? $gmph_address : $gmph_city ); ?></address>
						</li>
					<?php endif; ?>
					<?php if ( $gmph_maps ) : ?>
						<li><a href="<?php echo esc_url( $gmph_maps ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Trovami su Google', 'gmph' ); ?></a></li>
					<?php endif; ?>
					<?php $gmph_contact_page = gmph_page_url( 'contatti' ); ?>
					<?php if ( $gmph_contact_page ) : ?>
						<li><a href="<?php echo esc_url( $gmph_contact_page ); ?>"><?php esc_html_e( 'Chiedi informazioni', 'gmph' ); ?></a></li>
					<?php endif; ?>
				</ul>
			</div>
		</div>

		<div class="site-footer__bottom">
			<span>&copy; <?php echo esc_html( date_i18n( 'Y' ) ); ?> Giulia Malosso Photography<?php echo $gmph_vat ? ' · ' . esc_html__( 'P.IVA', 'gmph' ) . ' ' . esc_html( $gmph_vat ) : ''; ?></span>
			<span class="site-footer__legal">
				<?php the_privacy_policy_link(); ?>
				<?php if ( $gmph_cookie ) : ?>
					<a href="<?php echo esc_url( $gmph_cookie ); ?>"><?php esc_html_e( 'Cookie policy', 'gmph' ); ?></a>
				<?php endif; ?>
			</span>
		</div>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
