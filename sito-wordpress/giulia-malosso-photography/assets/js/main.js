/**
 * Giulia Malosso Photography - interazioni front-end.
 */
(function () {
	'use strict';

	document.addEventListener('DOMContentLoaded', function () {
		// Menu mobile.
		var toggle = document.querySelector('.nav-toggle');
		var nav = document.querySelector('.main-nav');

		if (toggle && nav) {
			toggle.addEventListener('click', function () {
				var isOpen = nav.classList.toggle('is-open');
				toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
			});

			nav.addEventListener('click', function (event) {
				if (event.target.tagName === 'A') {
					nav.classList.remove('is-open');
					toggle.setAttribute('aria-expanded', 'false');
				}
			});
		}

		// Filtro portfolio.
		var filterButtons = document.querySelectorAll('.filter-btn');
		var galleryItems = document.querySelectorAll('.gallery__item');

		if (filterButtons.length && galleryItems.length) {
			filterButtons.forEach(function (button) {
				button.addEventListener('click', function () {
					var filter = button.getAttribute('data-filter');

					filterButtons.forEach(function (b) {
						b.classList.remove('is-active');
					});
					button.classList.add('is-active');

					galleryItems.forEach(function (item) {
						var category = item.getAttribute('data-category');
						var show = filter === 'all' || category === filter;
						item.classList.toggle('is-hidden', !show);
					});
				});
			});
		}
	});
})();
