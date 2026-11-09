<?php
/**
 * Modulo contatti: invio via admin-post.php e wp_mail(), senza salvataggio dei messaggi.
 *
 * @package gmph
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Servizi selezionabili nel modulo.
 *
 * @return array<string, string>
 */
function gmph_contact_services() {
	return array(
		'famiglia'      => __( 'Famiglia', 'gmph' ),
		'gravidanza'    => __( 'Gravidanza', 'gmph' ),
		'newborn'       => __( 'Newborn', 'gmph' ),
		'bambini'       => __( 'Bambini', 'gmph' ),
		'battesimo'     => __( 'Battesimo', 'gmph' ),
		'coppia'        => __( 'Coppia', 'gmph' ),
		'ritratto'      => __( 'Ritratto', 'gmph' ),
		'commerciale'   => __( 'Commerciale / attività', 'gmph' ),
		'mini-sessioni' => __( 'Mini sessioni', 'gmph' ),
		'buono-regalo'  => __( 'Buono regalo', 'gmph' ),
		'altro'         => __( 'Altro', 'gmph' ),
	);
}

/**
 * Messaggi d'errore per campo.
 *
 * @return array<string, string>
 */
function gmph_contact_field_errors() {
	return array(
		'name'          => __( 'Inserisci il tuo nome.', 'gmph' ),
		'email'         => __( 'Inserisci un indirizzo email valido.', 'gmph' ),
		'phone'         => __( 'Il numero di telefono è troppo lungo.', 'gmph' ),
		'service'       => __( 'Scegli il servizio di interesse.', 'gmph' ),
		'period'        => __( 'Il periodo indicato è troppo lungo.', 'gmph' ),
		'message'       => __( 'Scrivi un messaggio (massimo 5.000 caratteri).', 'gmph' ),
		'voucher_type'  => __( 'Scegli il tipo di buono.', 'gmph' ),
		'gift_service'  => __( 'Scegli il servizio da regalare.', 'gmph' ),
		'amount'        => __( 'L’importo indicativo non può superare 40 caratteri.', 'gmph' ),
		'delivery'      => __( 'Scegli come preferisci ricevere il buono.', 'gmph' ),
		'personal_message' => __( 'Il messaggio personale non può superare 5.000 caratteri.', 'gmph' ),
		'privacy'       => __( 'Per inviare la richiesta è necessario accettare l’informativa privacy.', 'gmph' ),
	);
}

/**
 * Opzioni dedicate alle richieste di buoni regalo.
 *
 * @return array<string, array<string, string>>
 */
function gmph_contact_gift_options() {
	return array(
		'types' => array(
			'valore'    => __( 'Buono a valore', 'gmph' ),
			'servizio'  => __( 'Buono per un servizio', 'gmph' ),
			'consiglio' => __( 'Non lo so, vorrei un consiglio', 'gmph' ),
		),
		'services' => array(
			'famiglia'       => __( 'Famiglia', 'gmph' ),
			'gravidanza'     => __( 'Gravidanza', 'gmph' ),
			'bambini'        => __( 'Bambini', 'gmph' ),
			'coppia'         => __( 'Coppia', 'gmph' ),
			'primi-ricordi'  => __( 'Primi Ricordi', 'gmph' ),
			'consiglio'      => __( 'Non lo so, vorrei un consiglio', 'gmph' ),
		),
		'deliveries' => array(
			'digitale'            => __( 'Digitale', 'gmph' ),
			'cartaceo'            => __( 'Cartaceo', 'gmph' ),
			'nessuna-preferenza'  => __( 'Non ho preferenze', 'gmph' ),
		),
	);
}

/**
 * Gestisce l'invio del modulo (utenti anonimi e loggati).
 */
function gmph_handle_contact() {
	$redirect = wp_get_referer();
	if ( ! $redirect ) {
		$redirect = gmph_page_url( 'contatti' ) ? gmph_page_url( 'contatti' ) : home_url( '/' );
	}
	$redirect = remove_query_arg( array( 'gmph_contact', 'gmph_errors' ), $redirect );

	$finish = function ( $status, $errors = array(), $service = '' ) use ( $redirect ) {
		$args = array( 'gmph_contact' => $status );
		if ( $errors ) {
			$args['gmph_errors'] = implode( ',', $errors );
		}
		if ( '' !== $service ) {
			$args['servizio'] = $service;
		}
		wp_safe_redirect( add_query_arg( $args, $redirect ) . '#gmph-contact' );
		exit;
	};

	$nonce = isset( $_POST['gmph_contact_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['gmph_contact_nonce'] ) ) : '';
	if ( ! wp_verify_nonce( $nonce, 'gmph_contact' ) ) {
		$finish( 'expired' );
	}

	// Honeypot: i bot ricevono la stessa risposta di un invio riuscito, senza email.
	if ( ! empty( $_POST['gmph_website'] ) ) {
		$finish( 'sent' );
	}

	$field = function ( $key, $callback = 'sanitize_text_field' ) {
		if ( ! isset( $_POST[ $key ] ) || ! is_string( $_POST[ $key ] ) ) {
			return '';
		}
		return trim( call_user_func( $callback, wp_unslash( $_POST[ $key ] ) ) );
	};

	$services = gmph_contact_services();
	$gift_options = gmph_contact_gift_options();
	$data     = array(
		'name'             => $field( 'gmph_name' ),
		'email'            => $field( 'gmph_email', 'sanitize_email' ),
		'phone'            => $field( 'gmph_phone' ),
		'service'          => $field( 'gmph_service', 'sanitize_key' ),
		'period'           => $field( 'gmph_period' ),
		'message'          => $field( 'gmph_message', 'sanitize_textarea_field' ),
		'voucher_type'     => $field( 'gmph_voucher_type', 'sanitize_key' ),
		'gift_service'     => $field( 'gmph_gift_service', 'sanitize_key' ),
		'amount'           => $field( 'gmph_amount' ),
		'delivery'         => $field( 'gmph_delivery', 'sanitize_key' ),
		'recipient'        => $field( 'gmph_recipient' ),
		'personal_message' => $field( 'gmph_personal_message', 'sanitize_textarea_field' ),
		'privacy'          => ! empty( $_POST['gmph_privacy'] ),
	);
	$data['amount'] = preg_replace( '/\s+/u', ' ', preg_replace( '/[^0-9,.€ ]/u', '', $data['amount'] ) );

	$is_gift = 'buono-regalo' === $data['service'];
	if ( ! $is_gift ) {
		$data['voucher_type']     = '';
		$data['gift_service']     = '';
		$data['amount']           = '';
		$data['delivery']         = '';
		$data['recipient']        = '';
		$data['personal_message'] = '';
	} else {
		$data['period'] = '';
		if ( 'valore' !== $data['voucher_type'] ) {
			$data['amount'] = '';
		}
		if ( 'servizio' !== $data['voucher_type'] ) {
			$data['gift_service'] = '';
		}
	}

	$errors = array();
	if ( '' === $data['name'] || mb_strlen( $data['name'] ) > 100 ) {
		$errors[] = 'name';
	}
	if ( ! is_email( $data['email'] ) ) {
		$errors[] = 'email';
	}
	if ( mb_strlen( $data['phone'] ) > 40 ) {
		$errors[] = 'phone';
	}
	if ( ! isset( $services[ $data['service'] ] ) ) {
		$errors[] = 'service';
	}
	if ( ! $is_gift && mb_strlen( $data['period'] ) > 100 ) {
		$errors[] = 'period';
	}
	if ( ( ! $is_gift && '' === $data['message'] ) || mb_strlen( $data['message'] ) > 5000 ) {
		$errors[] = 'message';
	}
	if ( $is_gift ) {
		if ( ! isset( $gift_options['types'][ $data['voucher_type'] ] ) ) {
			$errors[] = 'voucher_type';
		}
		if ( 'servizio' === $data['voucher_type'] && ! isset( $gift_options['services'][ $data['gift_service'] ] ) ) {
			$errors[] = 'gift_service';
		}
		if ( 'valore' === $data['voucher_type'] && mb_strlen( $data['amount'] ) > 40 ) {
			$errors[] = 'amount';
		}
		if ( ! isset( $gift_options['deliveries'][ $data['delivery'] ] ) ) {
			$errors[] = 'delivery';
		}
		if ( mb_strlen( $data['personal_message'] ) > 5000 ) {
			$errors[] = 'personal_message';
		}
	}
	if ( ! $data['privacy'] ) {
		$errors[] = 'privacy';
	}
	if ( $errors ) {
		$finish( 'error', $errors, $data['service'] );
	}

	$to = gmph_setting( 'email' );
	if ( ! is_email( $to ) ) {
		$to = get_option( 'admin_email' );
	}

	$service_label = $services[ $data['service'] ];
	/* translators: 1: servizio, 2: nome. */
	$subject = sprintf( __( 'Nuova richiesta dal sito: %1$s – %2$s', 'gmph' ), $service_label, $data['name'] );
	$body_lines = array(
			__( 'Nome:', 'gmph' ) . ' ' . $data['name'],
			__( 'Email:', 'gmph' ) . ' ' . $data['email'],
			__( 'Telefono:', 'gmph' ) . ' ' . ( '' !== $data['phone'] ? $data['phone'] : '-' ),
			__( 'Servizio:', 'gmph' ) . ' ' . $service_label,
	);
	if ( $is_gift ) {
		$body_lines[] = __( 'Tipo di buono:', 'gmph' ) . ' ' . $gift_options['types'][ $data['voucher_type'] ];
		if ( 'valore' === $data['voucher_type'] && '' !== $data['amount'] ) {
			$body_lines[] = __( 'Importo indicativo:', 'gmph' ) . ' ' . $data['amount'];
		}
		if ( 'servizio' === $data['voucher_type'] ) {
			$body_lines[] = __( 'Servizio da regalare:', 'gmph' ) . ' ' . $gift_options['services'][ $data['gift_service'] ];
		}
		$body_lines[] = __( 'Consegna:', 'gmph' ) . ' ' . $gift_options['deliveries'][ $data['delivery'] ];
		if ( '' !== $data['recipient'] ) {
			$body_lines[] = __( 'Per chi è:', 'gmph' ) . ' ' . $data['recipient'];
		}
		if ( '' !== $data['personal_message'] ) {
			$body_lines[] = __( 'Messaggio da inserire nel buono:', 'gmph' );
			$body_lines[] = $data['personal_message'];
		}
		$body_lines[] = __( 'Note:', 'gmph' ) . ' ' . ( '' !== $data['message'] ? $data['message'] : '-' );
	} else {
		$body_lines[] = __( 'Periodo desiderato:', 'gmph' ) . ' ' . ( '' !== $data['period'] ? $data['period'] : '-' );
		$body_lines[] = '';
		$body_lines[] = __( 'Messaggio:', 'gmph' );
		$body_lines[] = $data['message'];
	}
	$body_lines[] = '';
	$body_lines[] = __( 'Informativa privacy accettata per rispondere alla richiesta.', 'gmph' );
	$body = implode( "\n", $body_lines );
	$headers = array(
		'Content-Type: text/plain; charset=UTF-8',
		sprintf( 'Reply-To: %s <%s>', str_replace( array( '"', '<', '>', ',' ), '', $data['name'] ), $data['email'] ),
	);

	$finish( wp_mail( $to, $subject, $body, $headers ) ? 'sent' : 'failed' );
}
add_action( 'admin_post_gmph_contact', 'gmph_handle_contact' );
add_action( 'admin_post_nopriv_gmph_contact', 'gmph_handle_contact' );

/**
 * Stampa il modulo contatti con eventuali messaggi di esito.
 */
function gmph_contact_form() {
	$status   = isset( $_GET['gmph_contact'] ) ? sanitize_key( wp_unslash( $_GET['gmph_contact'] ) ) : '';
	$invalid  = isset( $_GET['gmph_errors'] ) ? array_map( 'sanitize_key', explode( ',', sanitize_text_field( wp_unslash( $_GET['gmph_errors'] ) ) ) ) : array();
	$services = gmph_contact_services();
	$gift_options = gmph_contact_gift_options();
	$selected = isset( $_GET['servizio'] ) ? sanitize_key( wp_unslash( $_GET['servizio'] ) ) : '';
	$is_gift  = 'buono-regalo' === $selected;
	$voucher_type = '';
	$messages = gmph_contact_field_errors();

	$notices = array(
		'sent'    => array( 'status', __( 'Grazie, la tua richiesta è stata inviata. Ti risponderò il prima possibile.', 'gmph' ) ),
		'error'   => array( 'alert', __( 'Controlla i campi indicati e invia di nuovo la richiesta.', 'gmph' ) ),
		'failed'  => array( 'alert', __( 'Non è stato possibile inviare la richiesta. Riprova tra poco oppure scrivimi direttamente via email.', 'gmph' ) ),
		'expired' => array( 'alert', __( 'Il modulo è scaduto. Ricarica la pagina e invia di nuovo la richiesta.', 'gmph' ) ),
	);

	$error_attrs = function ( $key ) use ( $invalid ) {
		return in_array( $key, $invalid, true ) ? ' aria-invalid="true" aria-describedby="gmph-error-' . esc_attr( $key ) . '"' : '';
	};
	$error_text = function ( $key ) use ( $invalid, $messages ) {
		if ( in_array( $key, $invalid, true ) && isset( $messages[ $key ] ) ) {
			echo '<p class="form-field__error" id="gmph-error-' . esc_attr( $key ) . '">' . esc_html( $messages[ $key ] ) . '</p>';
		}
	};
	?>
	<div class="contact-form" id="gmph-contact">
		<?php if ( isset( $notices[ $status ] ) ) : ?>
			<div class="form-notice form-notice--<?php echo esc_attr( $status ); ?>" id="gmph-contact-notice" role="<?php echo esc_attr( $notices[ $status ][0] ); ?>" tabindex="-1">
				<?php echo esc_html( $notices[ $status ][1] ); ?>
			</div>
		<?php endif; ?>

		<?php if ( 'sent' !== $status ) : ?>
			<form class="contact__form" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post">
				<input type="hidden" name="action" value="gmph_contact">
				<?php wp_nonce_field( 'gmph_contact', 'gmph_contact_nonce', true ); ?>

				<p class="form-note"><?php esc_html_e( 'I campi contrassegnati con * sono obbligatori.', 'gmph' ); ?></p>

				<div class="form-field">
					<label for="gmph-name"><?php esc_html_e( 'Nome', 'gmph' ); ?> <span aria-hidden="true">*</span></label>
					<input type="text" id="gmph-name" name="gmph_name" autocomplete="name" maxlength="100" required<?php echo $error_attrs( 'name' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
					<?php $error_text( 'name' ); ?>
				</div>
				<div class="form-field">
					<label for="gmph-email"><?php esc_html_e( 'Email', 'gmph' ); ?> <span aria-hidden="true">*</span></label>
					<input type="email" id="gmph-email" name="gmph_email" autocomplete="email" required<?php echo $error_attrs( 'email' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
					<?php $error_text( 'email' ); ?>
				</div>
				<div class="form-field">
					<label for="gmph-phone"><?php esc_html_e( 'Telefono', 'gmph' ); ?></label>
					<input type="tel" id="gmph-phone" name="gmph_phone" autocomplete="tel" maxlength="40"<?php echo $error_attrs( 'phone' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
					<?php $error_text( 'phone' ); ?>
				</div>
				<div class="form-field">
					<label for="gmph-service"><?php esc_html_e( 'Servizio di interesse', 'gmph' ); ?> <span aria-hidden="true">*</span></label>
					<select id="gmph-service" name="gmph_service" required<?php echo $error_attrs( 'service' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
						<option value=""><?php esc_html_e( 'Seleziona…', 'gmph' ); ?></option>
						<?php foreach ( $services as $value => $label ) : ?>
							<option value="<?php echo esc_attr( $value ); ?>"<?php selected( $selected, $value ); ?>><?php echo esc_html( $label ); ?></option>
						<?php endforeach; ?>
					</select>
					<?php $error_text( 'service' ); ?>
				</div>
				<div class="form-field" id="gmph-period-field"<?php echo $is_gift ? ' hidden aria-hidden="true"' : ''; ?>>
					<label for="gmph-period"><?php esc_html_e( 'Periodo desiderato', 'gmph' ); ?></label>
					<input type="text" id="gmph-period" name="gmph_period" maxlength="100" placeholder="<?php esc_attr_e( 'Es. primavera, fine maggio…', 'gmph' ); ?>"<?php echo $is_gift ? ' disabled' : ''; ?><?php echo $error_attrs( 'period' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
					<?php $error_text( 'period' ); ?>
				</div>
				<div id="gmph-voucher-fields"<?php echo $is_gift ? '' : ' hidden aria-hidden="true"'; ?>>
					<div class="form-field">
						<label for="gmph-voucher-type"><?php esc_html_e( 'Che tipo di buono ti interessa?', 'gmph' ); ?> <span aria-hidden="true">*</span></label>
						<select id="gmph-voucher-type" name="gmph_voucher_type"<?php echo $is_gift ? ' required' : ' disabled'; ?><?php echo $error_attrs( 'voucher_type' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
							<option value=""><?php esc_html_e( 'Seleziona…', 'gmph' ); ?></option>
							<?php foreach ( $gift_options['types'] as $value_key => $label ) : ?>
								<option value="<?php echo esc_attr( $value_key ); ?>"<?php selected( $voucher_type, $value_key ); ?>><?php echo esc_html( $label ); ?></option>
							<?php endforeach; ?>
						</select>
						<?php $error_text( 'voucher_type' ); ?>
					</div>
					<div class="form-field" id="gmph-gift-service-field"<?php echo $is_gift && 'servizio' === $voucher_type ? '' : ' hidden aria-hidden="true"'; ?>>
						<label for="gmph-gift-service"><?php esc_html_e( 'Quale servizio vorresti regalare?', 'gmph' ); ?> <span aria-hidden="true">*</span></label>
						<select id="gmph-gift-service" name="gmph_gift_service"<?php echo $is_gift && 'servizio' === $voucher_type ? ' required' : ' disabled'; ?><?php echo $error_attrs( 'gift_service' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
							<option value=""><?php esc_html_e( 'Seleziona…', 'gmph' ); ?></option>
							<?php foreach ( $gift_options['services'] as $value_key => $label ) : ?>
								<option value="<?php echo esc_attr( $value_key ); ?>"><?php echo esc_html( $label ); ?></option>
							<?php endforeach; ?>
						</select>
						<?php $error_text( 'gift_service' ); ?>
					</div>
					<div class="form-field" id="gmph-amount-field"<?php echo $is_gift && 'valore' === $voucher_type ? '' : ' hidden aria-hidden="true"'; ?>>
						<label for="gmph-amount"><?php esc_html_e( 'Che importo avevi in mente?', 'gmph' ); ?></label>
						<input type="text" id="gmph-amount" name="gmph_amount" maxlength="40" inputmode="decimal" placeholder="<?php esc_attr_e( 'Es. 100 €', 'gmph' ); ?>"<?php echo $is_gift && 'valore' === $voucher_type ? '' : ' disabled'; ?><?php echo $error_attrs( 'amount' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
						<?php $error_text( 'amount' ); ?>
					</div>
					<div class="form-field">
						<label for="gmph-delivery"><?php esc_html_e( 'Come preferisci ricevere il buono?', 'gmph' ); ?> <span aria-hidden="true">*</span></label>
						<select id="gmph-delivery" name="gmph_delivery"<?php echo $is_gift ? ' required' : ' disabled'; ?><?php echo $error_attrs( 'delivery' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
							<option value=""><?php esc_html_e( 'Seleziona…', 'gmph' ); ?></option>
							<?php foreach ( $gift_options['deliveries'] as $value_key => $label ) : ?>
								<option value="<?php echo esc_attr( $value_key ); ?>"><?php echo esc_html( $label ); ?></option>
							<?php endforeach; ?>
						</select>
						<?php $error_text( 'delivery' ); ?>
					</div>
					<div class="form-field">
						<label for="gmph-recipient"><?php esc_html_e( 'Per chi è il regalo?', 'gmph' ); ?></label>
						<input type="text" id="gmph-recipient" name="gmph_recipient" placeholder="<?php esc_attr_e( 'Es. mia sorella, i nonni, una futura mamma...', 'gmph' ); ?>"<?php echo $is_gift ? '' : ' disabled'; ?>>
					</div>
					<div class="form-field">
						<label for="gmph-personal-message"><?php esc_html_e( 'Vuoi aggiungere un messaggio personale al buono?', 'gmph' ); ?></label>
						<textarea id="gmph-personal-message" name="gmph_personal_message" rows="4" maxlength="5000" placeholder="<?php esc_attr_e( 'Scrivi qui il messaggio che vorresti inserire nel buono...', 'gmph' ); ?>"<?php echo $is_gift ? '' : ' disabled'; ?><?php echo $error_attrs( 'personal_message' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>></textarea>
						<?php $error_text( 'personal_message' ); ?>
					</div>
				</div>
				<div class="form-field">
					<label for="gmph-message"><span id="gmph-message-label"><?php echo $is_gift ? esc_html__( 'Vuoi aggiungere qualche informazione?', 'gmph' ) : esc_html__( 'Messaggio', 'gmph' ); ?></span> <span id="gmph-message-required" aria-hidden="true"<?php echo $is_gift ? ' hidden' : ''; ?>>*</span></label>
					<textarea id="gmph-message" name="gmph_message" rows="5" maxlength="5000"<?php echo $is_gift ? '' : ' required'; ?><?php echo $error_attrs( 'message' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>></textarea>
					<?php $error_text( 'message' ); ?>
				</div>

				<div class="form-field form-field--hp" aria-hidden="true">
					<label for="gmph-website"><?php esc_html_e( 'Lascia vuoto questo campo', 'gmph' ); ?></label>
					<input type="text" id="gmph-website" name="gmph_website" tabindex="-1" autocomplete="off">
				</div>

				<div class="form-field form-field--check">
					<input type="checkbox" id="gmph-privacy" name="gmph_privacy" value="1" required<?php echo $error_attrs( 'privacy' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>
					<label for="gmph-privacy">
						<?php
						$privacy_url = get_privacy_policy_url();
						if ( $privacy_url ) {
							printf(
								/* translators: %s: link all'informativa privacy. */
								esc_html__( 'Ho letto l’%s e acconsento al trattamento dei dati necessario per rispondere alla mia richiesta.', 'gmph' ),
								'<a href="' . esc_url( $privacy_url ) . '" target="_blank" rel="noopener">' . esc_html__( 'informativa privacy', 'gmph' ) . '</a>'
							);
						} else {
							esc_html_e( 'Ho letto l’informativa privacy e acconsento al trattamento dei dati necessario per rispondere alla mia richiesta.', 'gmph' );
						}
						?>
						<span aria-hidden="true">*</span>
					</label>
					<?php $error_text( 'privacy' ); ?>
				</div>

				<button type="submit" class="btn btn--primary"><?php esc_html_e( 'Invia richiesta', 'gmph' ); ?></button>
			</form>
		<?php endif; ?>
	</div>
	<?php
}
