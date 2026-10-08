<?php
/**
 * Footer del tema.
 *
 * @package gmph
 */
?>
</main><!-- #content -->

<footer class="site-footer" id="contatti">
	<div class="container">
		<div class="site-footer__grid">
			<div>
				<div class="site-footer__brand">Giulia Malosso Photography</div>
				<p>
					<?php esc_html_e( 'Fotografia di famiglia, maternità, bambini e mini session. Immagini autentiche che raccontano chi siete.', 'gmph' ); ?>
				</p>
				<div class="social-links">
					<a href="<?php echo esc_url( gmph_contact( 'instagram' ) ); ?>" target="_blank" rel="noopener" aria-label="Instagram">IG</a>
					<a href="<?php echo esc_url( gmph_contact( 'facebook' ) ); ?>" target="_blank" rel="noopener" aria-label="Facebook">FB</a>
				</div>
			</div>

			<div>
				<h4><?php esc_html_e( 'Esplora', 'gmph' ); ?></h4>
				<?php
				if ( has_nav_menu( 'footer' ) ) {
					wp_nav_menu(
						array(
							'theme_location' => 'footer',
							'container'      => false,
							'depth'          => 1,
						)
					);
				} else {
					echo '<ul>';
					echo '<li><a href="' . esc_url( home_url( '/' ) ) . '">' . esc_html__( 'Home', 'gmph' ) . '</a></li>';
					echo '<li><a href="' . esc_url( home_url( '/#servizi' ) ) . '">' . esc_html__( 'Servizi', 'gmph' ) . '</a></li>';
					echo '<li><a href="' . esc_url( home_url( '/#portfolio' ) ) . '">' . esc_html__( 'Portfolio', 'gmph' ) . '</a></li>';
					echo '<li><a href="' . esc_url( home_url( '/#chi-sono' ) ) . '">' . esc_html__( 'Chi sono', 'gmph' ) . '</a></li>';
					echo '</ul>';
				}
				?>
			</div>

			<div>
				<h4><?php esc_html_e( 'Contatti', 'gmph' ); ?></h4>
				<ul>
					<li><a href="mailto:<?php echo esc_attr( gmph_contact( 'email' ) ); ?>"><?php echo esc_html( gmph_contact( 'email' ) ); ?></a></li>
					<li><a href="tel:<?php echo esc_attr( preg_replace( '/\s+/', '', gmph_contact( 'phone' ) ) ); ?>"><?php echo esc_html( gmph_contact( 'phone' ) ); ?></a></li>
					<li><?php echo esc_html( gmph_contact( 'city' ) ); ?></li>
				</ul>
			</div>
		</div>

		<div class="site-footer__bottom">
			<span>&copy; <?php echo esc_html( date_i18n( 'Y' ) ); ?> Giulia Malosso Photography</span>
			<span><?php esc_html_e( 'P.IVA — da inserire', 'gmph' ); ?></span>
		</div>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
