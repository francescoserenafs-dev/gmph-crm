/**
 * Giulia Malosso Photography - interazioni front-end.
 */
(function () {
	'use strict';

	// Menu mobile.
	var toggle = document.querySelector('.nav-toggle');
	var nav = document.getElementById('primary-nav');

	if (toggle && nav) {
		var label = toggle.querySelector('.screen-reader-text');

		var setOpen = function (open) {
			nav.classList.toggle('is-open', open);
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
			if (label) {
				label.textContent = toggle.getAttribute(open ? 'data-label-close' : 'data-label-open');
			}
		};

		toggle.addEventListener('click', function () {
			setOpen(toggle.getAttribute('aria-expanded') !== 'true');
		});

		nav.addEventListener('click', function (event) {
			if (event.target.closest('a')) {
				setOpen(false);
			}
		});

		document.addEventListener('keydown', function (event) {
			if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
				setOpen(false);
				toggle.focus();
			}
		});
	}

	// Sottomenu desktop (aperti da :hover / :focus-within): Escape li chiude e riporta il focus sulla voce padre.
	document.querySelectorAll('.main-nav .menu-item-has-children').forEach(function (item) {
		var parentLink = item.querySelector(':scope > a');

		item.addEventListener('keydown', function (event) {
			if (event.key === 'Escape' && parentLink) {
				item.classList.add('is-dismissed');
				parentLink.focus();
			}
		});
		item.addEventListener('focusout', function (event) {
			if (!item.contains(event.relatedTarget)) {
				item.classList.remove('is-dismissed');
			}
		});
		item.addEventListener('mouseleave', function () {
			item.classList.remove('is-dismissed');
		});
	});

	// Esito del modulo contatti: porta il focus sul messaggio.
	var notice = document.getElementById('gmph-contact-notice');
	if (notice) {
		notice.focus();
	}

	var initContactForm = function () {
		var storageKey = 'gmph-contact-form-state';
		var status = new URLSearchParams(window.location.search).get('gmph_contact');
		var savedState = null;
		try {
			if (status === 'error' || status === 'failed' || status === 'expired') {
				savedState = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
			}
			sessionStorage.removeItem(storageKey);
		} catch {
			savedState = null;
		}

		var form = document.querySelector('.contact__form');
		if (!form) {
			return;
		}

		var service = form.querySelector('#gmph-service');
		var periodField = form.querySelector('#gmph-period-field');
		var period = form.querySelector('#gmph-period');
		var voucherFields = form.querySelector('#gmph-voucher-fields');
		var voucherType = form.querySelector('#gmph-voucher-type');
		var giftServiceField = form.querySelector('#gmph-gift-service-field');
		var giftService = form.querySelector('#gmph-gift-service');
		var amountField = form.querySelector('#gmph-amount-field');
		var amount = form.querySelector('#gmph-amount');
		var delivery = form.querySelector('#gmph-delivery');
		var recipient = form.querySelector('#gmph-recipient');
		var personalMessage = form.querySelector('#gmph-personal-message');
		var message = form.querySelector('#gmph-message');
		var messageLabel = form.querySelector('#gmph-message-label');
		var messageRequired = form.querySelector('#gmph-message-required');

		var setGroupState = function (container, enabled) {
			if (!container) {
				return;
			}
			container.hidden = !enabled;
			container.setAttribute('aria-hidden', enabled ? 'false' : 'true');
			container.querySelectorAll('input, select, textarea, button').forEach(function (control) {
				control.disabled = !enabled;
			});
		};

		var restoreState = function () {
			if (!savedState || typeof savedState !== 'object' || Array.isArray(savedState)) {
				return;
			}
			if (savedState.gmph_service) {
				service.value = savedState.gmph_service;
			}
			if (voucherType && savedState.gmph_voucher_type) {
				voucherType.value = savedState.gmph_voucher_type;
			}
			updateVoucherType();
			form.querySelectorAll('input[name], select[name], textarea[name]').forEach(function (control) {
				if (!Object.prototype.hasOwnProperty.call(savedState, control.name)) {
					return;
				}
				if (control.type === 'checkbox') {
					control.checked = Boolean(savedState[control.name]);
				} else {
					control.value = savedState[control.name];
				}
			});
		};

		var updateVoucherType = function () {
			var isGift = service.value === 'buono-regalo';
			var type = voucherType.value;

			setGroupState(periodField, !isGift);
			setGroupState(voucherFields, isGift);
			if (voucherType) {
				voucherType.required = isGift;
			}
			if (delivery) {
				delivery.required = isGift;
			}
			setGroupState(giftServiceField, isGift && type === 'servizio');
			setGroupState(amountField, isGift && type === 'valore');
			if (giftService) {
				giftService.required = isGift && type === 'servizio';
			}
			if (message) {
				message.required = !isGift;
			}
			if (messageLabel) {
				messageLabel.textContent = isGift ? 'Vuoi aggiungere qualche informazione?' : 'Messaggio';
			}
			if (messageRequired) {
				messageRequired.hidden = isGift;
			}
		};

		service.addEventListener('change', updateVoucherType);
		voucherType.addEventListener('change', updateVoucherType);
		form.addEventListener('submit', function () {
			var state = {};
			form.querySelectorAll('input[name], select[name], textarea[name]').forEach(function (control) {
				if (control.disabled || control.type === 'hidden' || control.type === 'submit' || control.name === 'gmph_website') {
					return;
				}
				state[control.name] = control.type === 'checkbox' ? control.checked : control.value;
			});
			try {
				sessionStorage.setItem(storageKey, JSON.stringify(state));
			} catch {}
		});
		restoreState();
		updateVoucherType();
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initContactForm);
	} else {
		initContactForm();
	}
})();
