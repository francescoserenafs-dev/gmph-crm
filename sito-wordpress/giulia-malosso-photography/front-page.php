<?php
/**
 * Home / vetrina.
 *
 * @package gmph
 */

get_header();
?>

<!-- HERO -->
<section class="hero" id="home"
	style="background-image: linear-gradient(180deg, rgba(39,35,31,0.28), rgba(39,35,31,0.5)), url('<?php echo esc_url( gmph_placeholder( 'La tua foto di apertura' ) ); ?>');">
	<div class="container hero__content">
		<span class="eyebrow"><?php esc_html_e( 'Fotografa di famiglia · Maser (TV)', 'gmph' ); ?></span>
		<h1><?php esc_html_e( 'Ricordi autentici, luce naturale, emozioni vere', 'gmph' ); ?></h1>
		<p><?php esc_html_e( 'Racconto la vostra famiglia così com’è: gli abbracci, le risate, i primi giorni di un bimbo e l’attesa della maternità. Fotografie da custodire negli anni.', 'gmph' ); ?></p>
		<div class="hero__actions">
			<a class="btn btn--primary" href="#contatti"><?php esc_html_e( 'Prenota un servizio', 'gmph' ); ?></a>
			<a class="btn btn--ghost" href="#portfolio"><?php esc_html_e( 'Guarda il portfolio', 'gmph' ); ?></a>
		</div>
	</div>
</section>

<!-- SERVIZI -->
<section class="section" id="servizi">
	<div class="container">
		<div class="section__head">
			<span class="eyebrow"><?php esc_html_e( 'Servizi', 'gmph' ); ?></span>
			<h2><?php esc_html_e( 'Cosa fotografo', 'gmph' ); ?></h2>
			<p class="lead center"><?php esc_html_e( 'Ogni servizio è pensato per mettervi a vostro agio e catturare momenti spontanei.', 'gmph' ); ?></p>
		</div>

		<div class="grid grid--3">
			<?php
			$services = array(
				array( '👨‍👩‍👧', __( 'Famiglia', 'gmph' ), __( 'Servizi in studio o all’aperto che raccontano i legami e la quotidianità della vostra famiglia.', 'gmph' ) ),
				array( '🤰', __( 'Maternità', 'gmph' ), __( 'L’attesa diventa immagine: ritratti delicati per celebrare questo momento unico.', 'gmph' ) ),
				array( '👶', __( 'Bambini e newborn', 'gmph' ), __( 'Dai primi giorni ai primi passi: scatti teneri, sicuri e pieni di dettagli da ricordare.', 'gmph' ) ),
				array( '🎄', __( 'Mini session', 'gmph' ), __( 'Sessioni brevi a tema (come le Christmas Mini Session) perfette per un ricordo speciale.', 'gmph' ) ),
				array( '💍', __( 'Matrimoni', 'gmph' ), __( 'Per chi cerca uno stile naturale e discreto nel giorno più importante.', 'gmph' ) ),
				array( '💼', __( 'Business & branding', 'gmph' ), __( 'Ritratti professionali e immagini per raccontare la vostra attività con autenticità.', 'gmph' ) ),
			);

			foreach ( $services as $service ) :
				?>
				<article class="service-card">
					<div class="service-card__icon"><?php echo esc_html( $service[0] ); ?></div>
					<h3><?php echo esc_html( $service[1] ); ?></h3>
					<p><?php echo esc_html( $service[2] ); ?></p>
				</article>
			<?php endforeach; ?>
		</div>
	</div>
</section>

<!-- PORTFOLIO -->
<section class="section section--soft" id="portfolio">
	<div class="container">
		<div class="section__head">
			<span class="eyebrow"><?php esc_html_e( 'Portfolio', 'gmph' ); ?></span>
			<h2><?php esc_html_e( 'Alcuni scatti recenti', 'gmph' ); ?></h2>
			<p class="lead center"><?php esc_html_e( 'Una selezione dei servizi realizzati. Filtra per categoria.', 'gmph' ); ?></p>
		</div>

		<div class="filters" role="tablist">
			<button class="filter-btn is-active" data-filter="all"><?php esc_html_e( 'Tutti', 'gmph' ); ?></button>
			<button class="filter-btn" data-filter="famiglia"><?php esc_html_e( 'Famiglia', 'gmph' ); ?></button>
			<button class="filter-btn" data-filter="maternita"><?php esc_html_e( 'Maternità', 'gmph' ); ?></button>
			<button class="filter-btn" data-filter="bambini"><?php esc_html_e( 'Bambini', 'gmph' ); ?></button>
			<button class="filter-btn" data-filter="mini"><?php esc_html_e( 'Mini session', 'gmph' ); ?></button>
		</div>

		<div class="gallery">
			<?php
			$gallery = array(
				array( 'famiglia', __( 'Famiglia · al parco', 'gmph' ) ),
				array( 'maternita', __( 'Maternità · in studio', 'gmph' ) ),
				array( 'bambini', __( 'Newborn · primi giorni', 'gmph' ) ),
				array( 'mini', __( 'Christmas mini', 'gmph' ) ),
				array( 'famiglia', __( 'Famiglia · a casa', 'gmph' ) ),
				array( 'bambini', __( 'Bambini · gioco', 'gmph' ) ),
				array( 'maternita', __( 'Maternità · outdoor', 'gmph' ) ),
				array( 'mini', __( 'Mini session · autunno', 'gmph' ) ),
			);

			foreach ( $gallery as $item ) :
				?>
				<figure class="gallery__item" data-category="<?php echo esc_attr( $item[0] ); ?>">
					<img src="<?php echo esc_url( gmph_placeholder( $item[1] ) ); ?>" alt="<?php echo esc_attr( $item[1] ); ?>" loading="lazy">
					<figcaption><?php echo esc_html( $item[1] ); ?></figcaption>
				</figure>
			<?php endforeach; ?>
		</div>
	</div>
</section>

<!-- CHI SONO -->
<section class="section" id="chi-sono">
	<div class="container about">
		<div class="about__photo">
			<img src="<?php echo esc_url( gmph_placeholder( 'Ritratto di Giulia' ) ); ?>" alt="<?php esc_attr_e( 'Giulia Malosso', 'gmph' ); ?>">
		</div>
		<div>
			<span class="eyebrow"><?php esc_html_e( 'Chi sono', 'gmph' ); ?></span>
			<h2><?php esc_html_e( 'Ciao, sono Giulia', 'gmph' ); ?></h2>
			<p><?php esc_html_e( 'Sono una fotografa di famiglia con base a Maser, in provincia di Treviso. Amo le immagini naturali, la luce morbida e le emozioni che nascono senza posa.', 'gmph' ); ?></p>
			<p><?php esc_html_e( 'Durante ogni servizio il mio obiettivo è farvi sentire a vostro agio, così da raccontare la vostra storia in modo sincero. Il risultato sono fotografie che potrete guardare tra vent’anni emozionandovi come oggi.', 'gmph' ); ?></p>
			<blockquote><?php esc_html_e( '«Le fotografie più belle nascono quando ci si dimentica della macchina fotografica.»', 'gmph' ); ?></blockquote>
		</div>
	</div>
</section>

<!-- CTA -->
<section class="section section--soft">
	<div class="container">
		<div class="cta">
			<h2><?php esc_html_e( 'Prenotiamo il vostro servizio', 'gmph' ); ?></h2>
			<p><?php esc_html_e( 'Raccontatemi cosa avete in mente: vi risponderò con disponibilità, pacchetti e tutti i dettagli.', 'gmph' ); ?></p>
			<a class="btn btn--primary" href="mailto:<?php echo esc_attr( gmph_contact( 'email' ) ); ?>"><?php esc_html_e( 'Scrivimi ora', 'gmph' ); ?></a>
		</div>
	</div>
</section>

<?php
get_footer();
