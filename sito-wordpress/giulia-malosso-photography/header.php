<?php
/**
 * Header del tema.
 *
 * @package gmph
 */
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<script>document.documentElement.classList.add('js');</script>
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip-link" href="#content"><?php esc_html_e( 'Salta al contenuto', 'gmph' ); ?></a>

<header class="site-header">
	<div class="container site-header__inner">
		<div class="site-brand">
			<?php if ( has_custom_logo() ) : ?>
				<?php the_custom_logo(); ?>
			<?php else : ?>
				<a class="site-brand__link" href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home">Giulia <span>Malosso</span></a>
			<?php endif; ?>
		</div>

		<?php if ( has_nav_menu( 'primary' ) ) : ?>
			<button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" data-label-open="<?php esc_attr_e( 'Apri menu', 'gmph' ); ?>" data-label-close="<?php esc_attr_e( 'Chiudi menu', 'gmph' ); ?>">
				<span class="screen-reader-text"><?php esc_html_e( 'Apri menu', 'gmph' ); ?></span>
				<span class="nav-toggle__bar" aria-hidden="true"></span>
				<span class="nav-toggle__bar" aria-hidden="true"></span>
				<span class="nav-toggle__bar" aria-hidden="true"></span>
			</button>

			<nav class="main-nav" id="primary-nav" aria-label="<?php esc_attr_e( 'Navigazione principale', 'gmph' ); ?>">
				<?php
				wp_nav_menu(
					array(
						'theme_location' => 'primary',
						'container'      => false,
						'menu_class'     => 'menu',
						'fallback_cb'    => false,
						'depth'          => 2,
					)
				);
				?>
			</nav>
		<?php endif; ?>
	</div>
</header>

<main id="content" class="site-main" tabindex="-1">
