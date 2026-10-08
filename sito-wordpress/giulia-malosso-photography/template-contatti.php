<?php
/**
 * Template Name: Contatti
 *
 * Assegna questo template a una pagina (Pagine > Attributi > Template) per
 * mostrare informazioni di contatto e un modulo. Il modulo invia via email
 * del browser (mailto); per un invio professionale usa un plugin come
 * Contact Form 7 o WPForms.
 *
 * @package gmph
 */

get_header();
?>

<section class="page-hero">
	<div class="container">
		<span class="eyebrow"><?php esc_html_e( 'Contatti', 'gmph' ); ?></span>
		<h1><?php the_title(); ?></h1>
		<p class="lead center"><?php esc_html_e( 'Raccontami cosa hai in mente: ti risponderò con disponibilità e pacchetti.', 'gmph' ); ?></p>
	</div>
</section>

<section class="page-content">
	<div class="container">
		<?php
		while ( have_posts() ) :
			the_post();
			the_content();
		endwhile;
		?>

		<div class="contact">
			<div class="contact__info">
				<ul>
					<li>
						<strong><?php esc_html_e( 'Email', 'gmph' ); ?></strong>
						<a href="mailto:<?php echo esc_attr( gmph_contact( 'email' ) ); ?>"><?php echo esc_html( gmph_contact( 'email' ) ); ?></a>
					</li>
					<li>
						<strong><?php esc_html_e( 'Telefono', 'gmph' ); ?></strong>
						<a href="tel:<?php echo esc_attr( preg_replace( '/\s+/', '', gmph_contact( 'phone' ) ) ); ?>"><?php echo esc_html( gmph_contact( 'phone' ) ); ?></a>
					</li>
					<li>
						<strong><?php esc_html_e( 'Zona', 'gmph' ); ?></strong>
						<?php echo esc_html( gmph_contact( 'city' ) ); ?>
					</li>
					<li>
						<strong><?php esc_html_e( 'Social', 'gmph' ); ?></strong>
						<a href="<?php echo esc_url( gmph_contact( 'instagram' ) ); ?>" target="_blank" rel="noopener">Instagram</a>
						&nbsp;·&nbsp;
						<a href="<?php echo esc_url( gmph_contact( 'facebook' ) ); ?>" target="_blank" rel="noopener">Facebook</a>
					</li>
				</ul>
			</div>

			<form class="contact__form" action="mailto:<?php echo esc_attr( gmph_contact( 'email' ) ); ?>" method="post" enctype="text/plain">
				<div class="form-field">
					<label for="cf-nome"><?php esc_html_e( 'Nome e cognome', 'gmph' ); ?></label>
					<input type="text" id="cf-nome" name="nome" required>
				</div>
				<div class="form-field">
					<label for="cf-email"><?php esc_html_e( 'Email', 'gmph' ); ?></label>
					<input type="email" id="cf-email" name="email" required>
				</div>
				<div class="form-field">
					<label for="cf-servizio"><?php esc_html_e( 'Servizio di interesse', 'gmph' ); ?></label>
					<select id="cf-servizio" name="servizio">
						<option><?php esc_html_e( 'Famiglia', 'gmph' ); ?></option>
						<option><?php esc_html_e( 'Maternità', 'gmph' ); ?></option>
						<option><?php esc_html_e( 'Bambini / Newborn', 'gmph' ); ?></option>
						<option><?php esc_html_e( 'Mini session', 'gmph' ); ?></option>
						<option><?php esc_html_e( 'Matrimonio', 'gmph' ); ?></option>
						<option><?php esc_html_e( 'Business / Branding', 'gmph' ); ?></option>
					</select>
				</div>
				<div class="form-field">
					<label for="cf-messaggio"><?php esc_html_e( 'Messaggio', 'gmph' ); ?></label>
					<textarea id="cf-messaggio" name="messaggio" rows="5" required></textarea>
				</div>
				<button type="submit" class="btn btn--primary"><?php esc_html_e( 'Invia richiesta', 'gmph' ); ?></button>
			</form>
		</div>
	</div>
</section>

<?php
get_footer();
