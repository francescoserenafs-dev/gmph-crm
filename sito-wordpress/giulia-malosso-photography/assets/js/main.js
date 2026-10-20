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
})();
