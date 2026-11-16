(function () {
  'use strict';
  var meta = function (n) { var m = document.querySelector('meta[name="' + n + '"]'); return m ? m.content : ''; };
  var CSRF = meta('csrf');
  var BASE = meta('base');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var api = function (url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'X-CSRF-Token': CSRF }, opts.headers || {});
    opts.credentials = 'same-origin';
    return fetch(url, opts);
  };

  // Menu mobile
  var st = $('[data-side-toggle]');
  if (st) {
    st.addEventListener('click', function () {
      var open = $('[data-side-nav]').classList.toggle('is-open');
      st.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Confirmation des actions destructrices
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-confirm]');
    if (b && !window.confirm(b.dataset.confirm)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // Avertit avant de quitter un formulaire modifié
  var dirty = false;
  var marks = $$('form[data-dirty]');
  marks.forEach(function (f) {
    f.addEventListener('input', function () { dirty = true; });
    f.addEventListener('change', function () { dirty = true; });
    f.addEventListener('submit', function () { dirty = false; });
  });
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // Éditeur de texte
  function initRte(root) {
    $$('[data-rte]', root).forEach(function (box) {
      if (box.dataset.ready) { return; }
      box.dataset.ready = '1';
      var area = $('textarea', box);
      var el = $('.rte__editor', box);
      var q = new Quill(el, {
        theme: 'snow',
        modules: {
          toolbar: {
            container: [[{ header: [2, 3, false] }], ['bold', 'italic'], [{ list: 'bullet' }, { list: 'ordered' }], ['blockquote', 'link', 'image'], ['clean']],
            handlers: {
              image: function () {
                openPicker({ multi: false }, function (items) {
                  var r = q.getSelection(true);
                  q.insertEmbed(r.index, 'image', BASE + items[0].path, 'user');
                  q.setSelection(r.index + 1);
                });
              }
            }
          }
        },
        formats: ['header', 'bold', 'italic', 'list', 'blockquote', 'link', 'image']
      });
      if (area.value) { q.clipboard.dangerouslyPasteHTML(area.value, 'silent'); }
      var sync = function () {
        area.value = q.getLength() > 1 ? q.getSemanticHTML().replace(/&nbsp;/g, ' ') : '';
      };
      q.on('text-change', function (d, o, source) {
        sync();
        if (source === 'user') { dirty = true; }
      });
    });
  }

  // Médiathèque
  var picker = $('[data-picker]');
  var pState = { page: 1, multi: false, cb: null, sel: [], q: '' };
  var thumbNode = function (m, onClick, href) {
    var n = document.createElement(href ? 'a' : 'button');
    n.className = 'thumb' + (m.alt ? '' : ' thumb--noalt');
    if (href) { n.href = href; } else { n.type = 'button'; }
    var i = document.createElement('img');
    i.src = m.thumb; i.alt = m.alt || ''; i.loading = 'lazy';
    n.appendChild(i);
    if (onClick) { n.addEventListener('click', function () { onClick(n); }); }
    return n;
  };
  var listUrl = function (page, q) { return BASE + '/admin/media/list?page=' + page + '&q=' + encodeURIComponent(q || ''); };
  function loadPicker(reset) {
    if (reset) { pState.page = 1; $('[data-picker-grid]').innerHTML = ''; }
    api(listUrl(pState.page, pState.q)).then(function (r) { return r.json(); }).then(function (d) {
      d.items.forEach(function (m) { $('[data-picker-grid]').appendChild(pickerThumb(m)); });
      $('[data-picker-more]').hidden = !d.more;
    });
  }
  function pickerThumb(m) {
    return thumbNode(m, function (n) {
      if (!pState.multi) { var cb = pState.cb; picker.close(); cb([m]); return; }
      var at = pState.sel.findIndex(function (x) { return x.id === m.id; });
      if (at > -1) { pState.sel.splice(at, 1); n.classList.remove('is-on'); }
      else { pState.sel.push(m); n.classList.add('is-on'); }
      var c = $('[data-picker-confirm]');
      c.hidden = pState.sel.length === 0;
      c.textContent = 'Ajouter ' + pState.sel.length + ' photo' + (pState.sel.length > 1 ? 's' : '');
    });
  }
  function openPicker(opts, cb) {
    pState.multi = !!opts.multi; pState.cb = cb; pState.sel = []; pState.q = '';
    $('[data-picker-search]').value = '';
    $('[data-picker-confirm]').hidden = true;
    $('[data-picker-status]').textContent = '';
    picker.showModal();
    loadPicker(true);
  }
  function upload(files, statusEl, done) {
    var list = Array.prototype.slice.call(files);
    var i = 0;
    var next = function () {
      if (i >= list.length) { statusEl.textContent = list.length > 1 ? list.length + ' photos traitées.' : 'Photo ajoutée.'; return; }
      statusEl.classList.remove('is-error');
      statusEl.textContent = 'Envoi de ' + list[i].name + ' (' + (i + 1) + '/' + list.length + ')…';
      var fd = new FormData();
      fd.append('file', list[i]);
      api(BASE + '/admin/media/upload', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) { throw new Error(d.error); }
          done(d); i++; next();
        })
        .catch(function (e) {
          statusEl.classList.add('is-error');
          statusEl.textContent = list[i].name + ' : ' + e.message;
        });
    };
    next();
  }
  if (picker) {
    $('[data-picker-close]').addEventListener('click', function () { picker.close(); });
    $('[data-picker-more]').addEventListener('click', function () { pState.page++; loadPicker(false); });
    $('[data-picker-confirm]').addEventListener('click', function () { var s = pState.sel, cb = pState.cb; picker.close(); cb(s); });
    var deb;
    $('[data-picker-search]').addEventListener('input', function (e) {
      clearTimeout(deb);
      deb = setTimeout(function () { pState.q = e.target.value; loadPicker(true); }, 250);
    });
    $('[data-picker-upload]').addEventListener('change', function (e) {
      upload(e.target.files, $('[data-picker-status]'), function (m) {
        $('[data-picker-grid]').prepend(pickerThumb(m));
      });
      e.target.value = '';
    });
  }

  // Champ image
  document.addEventListener('click', function (e) {
    var open = e.target.closest('[data-pick-open]');
    var clear = e.target.closest('[data-pick-clear]');
    if (open) {
      var box = open.closest('[data-pick]');
      openPicker({ multi: false }, function (items) {
        $('input', box).value = items[0].id;
        $('[data-pick-thumb]', box).innerHTML = '';
        var i = document.createElement('img'); i.src = items[0].thumb; i.alt = '';
        $('[data-pick-thumb]', box).appendChild(i);
        $('[data-pick-clear]', box).hidden = false;
        dirty = true;
      });
    }
    if (clear) {
      var b2 = clear.closest('[data-pick]');
      $('input', b2).value = '';
      $('[data-pick-thumb]', b2).innerHTML = '';
      clear.hidden = true;
      dirty = true;
    }
  });

  // Galerie
  $$('[data-gallery-field]').forEach(function (box) {
    var grid = $('[data-gal-grid]', box);
    Sortable.create(grid, { animation: 120, onEnd: function () { dirty = true; } });
    grid.addEventListener('click', function (e) {
      var d = e.target.closest('.gal__del');
      if (d) { d.parentNode.remove(); dirty = true; }
    });
    $('[data-gal-add]', box).addEventListener('click', function () {
      openPicker({ multi: true }, function (items) {
        items.forEach(function (m) {
          var n = document.createElement('div');
          n.className = 'gal__item';
          n.innerHTML = '<input type="hidden" name="gallery[]"><img alt=""><button type="button" class="gal__del" aria-label="Retirer la photo">×</button>';
          $('input', n).value = m.id;
          $('img', n).src = m.thumb;
          grid.appendChild(n);
        });
        dirty = true;
      });
    });
  });

  // Répéteurs
  function initRep(root) {
    $$('[data-rep-rows]', root).forEach(function (rows) {
      if (rows.dataset.ready) { return; }
      rows.dataset.ready = '1';
      Sortable.create(rows, { handle: '.handle', animation: 120, onEnd: function () { dirty = true; } });
    });
  }
  var repCount = 1000;
  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-rep-add]');
    var del = e.target.closest('[data-rep-del]');
    if (add) {
      var rep = add.closest('[data-rep]');
      var tpl = $(':scope > [data-rep-tpl]', rep);
      var holder = document.createElement('div');
      holder.innerHTML = tpl.innerHTML.replace(/__i__/g, String(repCount++));
      var row = holder.firstElementChild;
      $(':scope > [data-rep-rows]', rep).appendChild(row);
      initRte(row); initRep(row);
      dirty = true;
    }
    if (del) { del.closest('[data-rep-row]').remove(); dirty = true; }
  });

  // Sections de page
  var secList = $('[data-sections]');
  if (secList) {
    Sortable.create(secList, { handle: '.sec__head > .handle', animation: 140, onEnd: function () { dirty = true; } });
    secList.addEventListener('click', function (e) {
      var t = e.target.closest('[data-sec-toggle]');
      var d = e.target.closest('[data-sec-del]');
      if (t) {
        var body = t.closest('[data-sec]').querySelector('.sec__body');
        body.hidden = !body.hidden;
        t.setAttribute('aria-expanded', body.hidden ? 'false' : 'true');
        if (!body.hidden) { initRte(body); }
      }
      if (d && window.confirm('Retirer cette section de la page ?')) { d.closest('[data-sec]').remove(); dirty = true; }
    });
    secList.addEventListener('change', function (e) {
      if (e.target.matches('[data-sec-vis]')) { e.target.closest('[data-sec]').classList.toggle('is-hidden', !e.target.checked); }
    });
    var addBtn = $('[data-sec-add]');
    addBtn.addEventListener('click', function () {
      var type = $('[data-sec-type]').value;
      if (!type) { return; }
      api(addBtn.dataset.secAdd + '?type=' + encodeURIComponent(type)).then(function (r) { return r.text(); }).then(function (html) {
        var holder = document.createElement('div');
        holder.innerHTML = html;
        var sec = holder.firstElementChild;
        secList.appendChild(sec);
        initRte(sec); initRep(sec);
        sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dirty = true;
      });
    });
  }

  // Tri des listes
  $$('[data-sort-table]').forEach(function (tb) {
    Sortable.create(tb, {
      handle: '.handle', animation: 120,
      onEnd: function () {
        var fd = new FormData();
        fd.append('ids', JSON.stringify($$('tr', tb).map(function (r) { return r.dataset.id; })));
        api(tb.dataset.sortTable, { method: 'POST', body: fd });
      }
    });
  });

  // Menus
  var menus = $('[data-menus]');
  if (menus) {
    var sortKids = function (el) { Sortable.create(el, { group: 'kids', handle: '.handle', animation: 120, onEnd: function () { dirty = true; } }); };
    $$('[data-menu]', menus).forEach(function (l) { Sortable.create(l, { handle: '.mi__row > .handle', animation: 120, onEnd: function () { dirty = true; } }); });
    $$('[data-mi-kids]', menus).forEach(sortKids);
    var fromTpl = function (sel) { var d = document.createElement('div'); d.innerHTML = $(sel, menus).innerHTML; return d.firstElementChild; };
    menus.addEventListener('click', function (e) {
      if (e.target.closest('[data-mi-add]')) {
        var n = fromTpl('[data-mi-tpl]');
        e.target.closest('.panel').querySelector('[data-menu]').appendChild(n);
        sortKids($('[data-mi-kids]', n));
        $('[data-mi-label]', n).focus();
      }
      if (e.target.closest('[data-mi-addkid]')) {
        var k = fromTpl('[data-mi-tpl-kid]');
        e.target.closest('[data-mi]').querySelector('[data-mi-kids]').appendChild(k);
        $('[data-mi-label]', k).focus();
      }
      if (e.target.closest('[data-mi-del]')) { e.target.closest('[data-mi]').remove(); dirty = true; }
    });
    var read = function (mi) {
      return { label: $('[data-mi-label]', mi).value, url: $('[data-mi-url]', mi).value, visible: $('[data-mi-vis]', mi).checked ? 1 : 0 };
    };
    menus.addEventListener('submit', function () {
      var tree = {};
      $$('[data-menu]', menus).forEach(function (list) {
        tree[list.dataset.menu] = Array.prototype.map.call(list.children, function (mi) {
          var it = read(mi);
          var kids = $('[data-mi-kids]', mi);
          it.children = kids ? Array.prototype.map.call(kids.children, read) : [];
          return it;
        });
      });
      $('[data-tree]', menus).value = JSON.stringify(tree);
    });
  }

  // Filtres
  var ff = $('[data-filters-form]');
  if (ff) {
    var sortTerms = function (el) { Sortable.create(el, { handle: '.handle', animation: 120, onEnd: function () { dirty = true; } }); };
    Sortable.create($('[data-groups]', ff), { handle: '[data-group] > .mi__row > .handle', animation: 120, onEnd: function () { dirty = true; } });
    $$('[data-terms]', ff).forEach(sortTerms);
    var make = function (sel) { var d = document.createElement('div'); d.innerHTML = $(sel, ff).innerHTML; return d.firstElementChild; };
    ff.addEventListener('click', function (e) {
      if (e.target.closest('[data-group-add]')) {
        var g = make('[data-group-tpl]');
        $('[data-groups]', ff).appendChild(g);
        sortTerms($('[data-terms]', g));
        $('[data-group-label]', g).focus();
      }
      if (e.target.closest('[data-term-add]')) {
        var t = make('[data-term-tpl]');
        e.target.closest('[data-group]').querySelector('[data-terms]').appendChild(t);
        $('[data-term-label]', t).focus();
      }
      if (e.target.closest('[data-mi-del]')) { e.target.closest('[data-term]').remove(); dirty = true; }
      if (e.target.closest('[data-group-del]') && window.confirm('Retirer ce groupe et tous ses filtres ?')) { e.target.closest('[data-group]').remove(); dirty = true; }
    });
    ff.addEventListener('submit', function () {
      var tree = $$('[data-group]', ff).map(function (g) {
        return {
          id: g.dataset.id, label: $('[data-group-label]', g).value, visible: $('[data-group-vis]', g).checked ? 1 : 0,
          terms: $$('[data-term]', g).map(function (t) { return { id: t.dataset.id, label: $('[data-term-label]', t).value, description: $('[data-term-desc]', t).value }; })
        };
      });
      $('[data-tree]', ff).value = JSON.stringify(tree);
    });
  }

  // Page Médiathèque
  var lib = $('[data-lib]');
  if (lib) {
    var grid = $('[data-lib-grid]');
    var status = $('[data-lib-status]');
    var more = $('[data-lib-more]');
    var page = 1, query = '';
    var add = function (m, first) {
      var n = thumbNode(m, null, lib.dataset.link + m.id);
      if (first) { grid.prepend(n); } else { grid.appendChild(n); }
    };
    var load = function (reset) {
      if (reset) { page = 1; grid.innerHTML = ''; }
      api(listUrl(page, query)).then(function (r) { return r.json(); }).then(function (d) {
        d.items.forEach(function (m) { add(m); });
        more.hidden = !d.more;
        status.textContent = d.total + ' image' + (d.total > 1 ? 's' : '');
      });
    };
    load(true);
    more.addEventListener('click', function () { page++; load(false); });
    var t2;
    $('[data-lib-search]').addEventListener('input', function (e) {
      clearTimeout(t2);
      t2 = setTimeout(function () { query = e.target.value; load(true); }, 250);
    });
    $('[data-lib-upload]').addEventListener('change', function (e) {
      upload(e.target.files, status, function (m) { add(m, true); });
      e.target.value = '';
    });
    ['dragover', 'dragenter'].forEach(function (ev) {
      lib.addEventListener(ev, function (e) { e.preventDefault(); lib.classList.add('is-drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      lib.addEventListener(ev, function () { lib.classList.remove('is-drag'); });
    });
    lib.addEventListener('drop', function (e) {
      e.preventDefault();
      upload(e.dataTransfer.files, status, function (m) { add(m, true); });
    });
  }

  initRep(document);
  // Les éditeurs des sections repliées démarrent à l'ouverture, pour une page légère.
  $$('[data-rte]').forEach(function (box) {
    if (!box.closest('[hidden]')) { initRte(box.parentNode); }
  });
})();
