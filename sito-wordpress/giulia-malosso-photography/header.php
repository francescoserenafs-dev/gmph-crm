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
	<link rel="profile" href="https://gmpg.org/xfn/11">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="site-header">
	<div class="container site-header__inner">
		<a class="site-brand" href="<?php echo esc_url( home_url( '/' ) ); ?>">
			<?php
			if ( has_custom_logo() ) {
				the_custom_logo();
			} else {
				echo 'Giulia <span>Malosso</span>';
			}
			?>
		</a>

		<nav class="main-nav" aria-label="<?php esc_attr_e( 'Navigazione principale', 'gmph' ); ?>">
			<?php
			wp_nav_menu(
				array(
					'theme_location' => 'primary',
					'container'      => false,
					'fallback_cb'    => 'gmph_fallback_menu',
					'depth'          => 1,
				)
			);
			?>
		</nav>

		<button class="nav-toggle" aria-label="<?php esc_attr_e( 'Apri menu', 'gmph' ); ?>" aria-expanded="false">
			<span></span><span></span><span></span>
		</button>
	</div>
</header>

<main id="content" class="site-main">
