(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  // En-tête : devient opaque dès que la photo défile
  var head = document.querySelector('[data-head]');
  if (head) {
    var onScroll = function () { head.classList.toggle('is-solid', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Menu mobile
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    var setNav = function (open) {
      nav.classList.toggle('is-open', open);
      root.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    };
    toggle.addEventListener('click', function () { setNav(!nav.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setNav(false); } });
    nav.querySelectorAll('.nav__more').forEach(function (b) {
      b.addEventListener('click', function () {
        b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      });
    });
  }

  // Apparition au défilement, décalée dans une même rangée
  var targets = document.querySelectorAll('.band__head, .card, .tile, .tile-note, .quote, .duo > *, .skills > *, .intro > *, .steps li, .promo, .cta, .mosaic__item, .split-form > *');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) {
      var siblings = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      el.setAttribute('data-reveal', '');
      el.style.setProperty('--d', (siblings % 3) * 70 + 'ms');
      io.observe(el);
    });
  }

  // Catalogue : recherche dans la catégorie affichée
  var catalog = document.querySelector('[data-catalog]');
  if (catalog) {
    var search = catalog.querySelector('[data-search]');
    var cards = Array.prototype.slice.call(catalog.querySelectorAll('[data-card]'));
    var count = catalog.querySelector('[data-count]');
    var empty = catalog.querySelector('[data-empty]');
    var fold = function (s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
    search.addEventListener('input', function () {
      var words = fold(search.value.trim());
      var shown = 0;
      cards.forEach(function (c) {
        var ok = !words || fold(c.dataset.text).indexOf(words) > -1;
        c.hidden = !ok;
        if (ok) { shown++; c.classList.add('is-in'); }
      });
      count.textContent = shown + ' ' + (shown > 1 ? catalog.dataset.many : catalog.dataset.one);
      empty.hidden = shown !== 0;
    });
  }

  // Total de réservation : affichage seulement, le serveur recalcule le prix
  document.querySelectorAll('[data-booking]').forEach(function (f) {
    var total = f.querySelector('[data-total]');
    var price = { qty_full: Number(f.dataset.priceFull), qty_reduced: Number(f.dataset.priceReduced) };
    var update = function () {
      var cents = 0;
      f.querySelectorAll('[data-qty]').forEach(function (i) { cents += (parseInt(i.value, 10) || 0) * price[i.name]; });
      total.textContent = (cents / 100).toLocaleString('fr-BE', { maximumFractionDigits: 2 }) + ' €';
    };
    f.addEventListener('input', update);
    update();
  });

  // Visionneuse
  var lb = document.querySelector('[data-lightbox]');
  if (lb) {
    var lbImg = lb.querySelector('[data-lb-img]');
    var list = [];
    var at = 0;
    var show = function (i) {
      at = (i + list.length) % list.length;
      lbImg.src = list[at];
    };
    document.querySelectorAll('[data-gallery]').forEach(function (g) {
      var items = Array.prototype.slice.call(g.querySelectorAll('button[data-full]'));
      items.forEach(function (b, i) {
        b.addEventListener('click', function () {
          list = items.map(function (x) { return x.dataset.full; });
          show(i);
          lb.showModal();
        });
      });
    });
    lb.querySelector('[data-lb-close]').addEventListener('click', function () { lb.close(); });
    lb.querySelector('[data-lb-prev]').addEventListener('click', function () { show(at - 1); });
    lb.querySelector('[data-lb-next]').addEventListener('click', function () { show(at + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) { lb.close(); } });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { show(at - 1); }
      if (e.key === 'ArrowRight') { show(at + 1); }
    });
  }
})();
