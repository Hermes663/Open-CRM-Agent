// ADIKAM website — language toggle (PL/EN), mobile menu, scroll reveal.

(function () {
  'use strict';

  // ----- Language toggle -------------------------------------------------
  // Polish is the default content in the markup. Every translatable element
  // carries a data-en attribute; on first switch we stash the Polish text in
  // data-pl so we can toggle back without reloading.
  var langToggle = document.getElementById('langToggle');
  var currentLang = 'pl';

  var PAGE_TITLES = {
    pl: 'ADIKAM — Polski producent czekolady premium | Private Label & OEM',
    en: 'ADIKAM — Premium Polish Chocolate Manufacturer | Private Label & OEM'
  };

  function setLanguage(lang) {
    document.querySelectorAll('[data-en]').forEach(function (el) {
      if (!el.hasAttribute('data-pl')) {
        el.setAttribute('data-pl', el.textContent);
      }
      el.textContent = el.getAttribute(lang === 'en' ? 'data-en' : 'data-pl');
    });

    document.querySelectorAll('[data-en-placeholder]').forEach(function (el) {
      if (!el.hasAttribute('data-pl-placeholder')) {
        el.setAttribute('data-pl-placeholder', el.getAttribute('placeholder') || '');
      }
      el.setAttribute(
        'placeholder',
        el.getAttribute(lang === 'en' ? 'data-en-placeholder' : 'data-pl-placeholder')
      );
    });

    document.documentElement.lang = lang;
    document.title = PAGE_TITLES[lang];
    langToggle.textContent = lang === 'en' ? 'PL' : 'EN';
    currentLang = lang;
  }

  langToggle.addEventListener('click', function () {
    setLanguage(currentLang === 'pl' ? 'en' : 'pl');
  });

  // ----- Mobile menu ------------------------------------------------------
  var burger = document.getElementById('navBurger');
  var navLinks = document.getElementById('navLinks');

  burger.addEventListener('click', function () {
    navLinks.classList.toggle('is-open');
  });

  navLinks.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      navLinks.classList.remove('is-open');
    }
  });

  // ----- Scroll reveal ------------------------------------------------------
  var revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();
