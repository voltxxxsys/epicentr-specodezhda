/* ==========================================================================
   ЭПИЦЕНТР — общий скрипт страниц: шапка/подвал, 3D-герой, каталог, анимации
   ========================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* --------------------------------------------------------------- утилиты */
const nf = new Intl.NumberFormat('ru-RU');
export const money = (v) => `${nf.format(Math.round(v))} \u20BD`;

async function inject(target, url) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    el.innerHTML = await r.text();
  } catch (e) {
    el.innerHTML = el.dataset.fallback || '';
    console.warn('partial failed', url, e.message);
  }
}

/* --------------------------------------------------- данные каталога */
let CATALOG = null;
export async function loadCatalog() {
  if (CATALOG) return CATALOG;
  const r = await fetch('data/catalog.json');
  CATALOG = await r.json();
  return CATALOG;
}

export function productCard(p, opts = {}) {
  const low = p.stock > 0 && p.stock < 50;
  return `
  <article class="card product-card" data-product="${p.id}">
    <div class="product-card__media">
      <img src="${p.img}" alt="${p.name.replace(/"/g, '&quot;')}" loading="lazy" onerror="this.style.opacity=0">
      <button class="product-card__fav" aria-label="В избранное" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 20s-7-4.35-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.65 12 20 12 20Z"/></svg>
      </button>
    </div>
    <div class="product-card__body">
      <div class="product-card__art mono">Арт. ${p.art || p.id}</div>
      <h3 class="product-card__name"><a href="product.html?id=${p.id}">${p.name}</a></h3>
      <div class="product-card__foot">
        <div>
          <div class="product-card__price">${money(p.price)}</div>
          <div class="stock ${low ? 'stock--low' : ''}">${p.stock ? `В наличии: ${nf.format(p.stock)}` : 'Под заказ'}</div>
        </div>
        <button class="btn btn--sm btn--ghost" type="button" data-add="${p.id}">В корзину</button>
      </div>
    </div>
  </article>`;
}

/* --------------------------------------------------------- 3D-герой */
/* Товары, из которых собирается комплект на манекене: id из data/catalog.json,
   цены подтягиваются из каталога, чтобы цифры совпадали с карточками */
const KIT = [
  { key: 'base', id: 'EP-1076', short: 'Трикотаж', fallback: 561 },
  { key: 'boots', id: 'EP-1086', short: 'Обувь', fallback: 4220 },
  { key: 'trousers', id: 'EP-1002', short: 'Брюки', fallback: 1881 },
  { key: 'jacket', id: 'EP-1001', short: 'Куртка', fallback: 4050 },
  { key: 'gloves', id: 'EP-1155', short: 'Руки', fallback: 324 },
  { key: 'helmet', id: 'EP-1123', short: 'Голова', fallback: 512 },
  { key: 'respirator', id: 'EP-1139', short: 'Дыхание', fallback: 82 },
  { key: 'vest', id: 'EP-1017', short: 'Жилет', fallback: 261 },
  { key: 'harness', id: 'EP-1163', short: 'Высота', fallback: 1131 },
];

async function initHero() {
  const section = $('#hero3d');
  if (!section) return;
  const canvas = $('#hero-canvas', section);
  const loading = $('#hero-loading', section);
  const stepsEl = $('#hero-steps', section);
  const kitSum = $('#kit-sum', section);
  const kitBar = $('#kit-bar', section);
  const kitItems = $('#kit-items', section);
  const kitCard = $('#kit-card', section);
  const kitCardImg = $('#kit-card-img', section);
  const kitCardName = $('#kit-card-name', section);
  const kitCardPrice = $('#kit-card-price', section);
  const stageTitle = $('#stage-title', section);
  const stageSub = $('#stage-sub', section);
  const stagePrice = $('#stage-price', section);
  const photoHost = $('#hero-photo', section);

  /* --- 1. фотогерой: лёгкий режим по умолчанию --- */
  const photoMod = await import('./three/photo-hero.js');
  const stages = photoMod.PHOTO_STAGES;

  // цены и фото товаров берём из реального каталога
  try {
    const data = await loadCatalog();
    const byId = new Map(data.categories.flatMap((c2) => c2.items.map((p) => [p.id, p])));
    for (const st of stages) {
      const p = byId.get(st.id);
      if (p) { st.price = p.price; st.img = p.img; st.name = p.name; }
    }
  } catch { /* цены подставятся нулями — не критично для демо */ }
  for (const st of stages) {
    if (st.price === undefined) st.price = 0;
    if (!st.img) st.img = 'assets/gen/cat-protective.jpg';
  }

  if (photoHost) photoHost.innerHTML = photoMod.photoFramesMarkup();
  // в фото-режиме 3D не грузится — оверлей загрузки вообще не показываем
  if (loading) loading.style.display = 'none';

  if (stepsEl) stepsEl.innerHTML = stages.map((k, i) => `
    <button class="hero-step" type="button" data-step="${i}">
      <span class="hero-step__dot">${String(i + 1).padStart(2, '0')}</span>
      <span>
        <span class="hero-step__label">${k.short}</span>
        <span class="hero-step__meta">${money(k.price)}</span>
      </span>
    </button>`).join('');
  kitItems.innerHTML = stages.map((k, i) => `<span class="hero-kit__item" data-kit="${i}">${String(i + 1).padStart(2, '0')}</span>`).join('');

  /* --- 2. прогресс секции -> кадры + интерфейс --- */
  let lastActive = -1;
  const render = (prog, active) => {
    const per = 1 / stages.length;
    const sum = stages.slice(0, active + 1).reduce((a, k) => a + (k.price || 0), 0);
    if (kitBar) kitBar.style.width = `${Math.round(prog * 100)}%`;
    if (kitSum) kitSum.textContent = money(sum);
    if (active !== lastActive) {
      lastActive = active;
      if (stepsEl) $$('.hero-step', stepsEl).forEach((el, i) => {
        el.classList.toggle('is-active', i === active);
        el.classList.toggle('is-done', i < active);
      });
      $$('.hero-kit__item', kitItems).forEach((el, i) => el.classList.toggle('is-on', i <= active));
      const st = stages[active];
      if (st) {
        if (stageTitle) stageTitle.textContent = st.title;
        if (stageSub) stageSub.textContent = st.caption;
        if (stagePrice) stagePrice.textContent = `+ ${money(st.price)} · в комплекте ${money(sum)}`;
        if (kitCard && kitCardImg && kitCardName && kitCardPrice && st.img) {
          kitCardImg.src = st.img;
          kitCardImg.alt = st.name || st.title;
          kitCardName.textContent = st.name || st.title;
          kitCardPrice.textContent = money(st.price);
          kitCard.hidden = false;
          kitCard.classList.remove('is-fresh');
          void kitCard.offsetWidth;
          kitCard.classList.add('is-fresh');
        }
      }
    }
    void per;
  };

  const photoHero = photoHost ? photoMod.createPhotoHero(photoHost, {
    onStage: (active, prog) => render(prog, active),
    onTick: (prog) => {
      const active = Math.min(stages.length - 1, Math.floor(prog * stages.length));
      const sum = stages.slice(0, active + 1).reduce((a, k) => a + (k.price || 0), 0);
      if (kitBar) kitBar.style.width = `${Math.round(prog * 100)}%`;
      if (kitSum) kitSum.textContent = money(sum);
    },
  }) : null;

  /* --- 3. 3D-сцена: включается по кнопке (тяжёлый режим) --- */
  let threeApi = null;
  let threeLoading = false;
  async function ensure3d() {
    if (threeApi || threeLoading) return threeApi;
    threeLoading = true;
    try {
      const mod = await import('./three/scene.js');
      threeApi = await mod.createHero(canvas, { mode: window.innerWidth < 800 ? 'vertical' : 'spin' });
      section.dataset.mode3d = 'ready';
    } catch (e) {
      console.warn('3D недоступен:', e.message);
      section.classList.add('hero3d--fallback');
    }
    threeLoading = false;
    loading?.classList.add('is-hidden');
    return threeApi;
  }

  let mode = 'photo';
  function setMode(next) {
    const want3d = next === '3d';
    mode = want3d ? '3d' : 'photo';
    localStorage.setItem('ep-hero-mode', mode);
    section.dataset.mode = mode;
    document.querySelectorAll('.hero-mode').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === mode));
    if (photoHost) photoHost.style.visibility = want3d ? 'hidden' : 'visible';
    if (want3d) { ensure3d().then(() => onScroll()); }
    onScroll();
  }

  let lastScroll = -1;
  function onScroll() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    const p = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));
    window.__epProgress = p;
    if (mode === '3d' && threeApi) threeApi.setProgress(p);
    if (photoHero) photoHero.setProgress(p); // кадры следуют за скроллом точно
    lastScroll = p;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  setMode(localStorage.getItem('ep-hero-mode') === '3d' ? '3d' : 'photo');
  document.querySelectorAll('.hero-mode').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  stepsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    const i = Number(btn.dataset.step);
    const total = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: section.offsetTop + (i / stages.length) * 0.96 * total + 4, behavior: 'smooth' });
  });

  // отладочный хук: сразу выставить прогресс
  window.__epHero = { set: (p) => { window.__hero?.api?.setProgress?.(p); window.scrollTo(0, section.offsetTop + p * (section.offsetHeight - window.innerHeight)); onScroll(); } };
  void lastScroll;
}

/* ------------------------------------------------- появление при скролле */
function initReveal() {
  const els = $$('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });
  els.forEach((e) => io.observe(e));
}

/* --------------------------------------------------------- счётчики */
function initCounters() {
  const els = $$('[data-count]');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const to = Number(el.dataset.count);
      const dur = 1200;
      const t0 = performance.now();
      (function step(t) {
        const k = Math.min(1, (t - t0) / dur);
        el.textContent = nf.format(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
      io.unobserve(el);
    });
  }, { threshold: 0.4 });
  els.forEach((e) => io.observe(e));
}

/* ------------------------------------------------------ каталог на главной */
async function initCatalogTeasers() {
  const hosts = $$('[data-catalog-teaser]');
  if (!hosts.length) return;
  const data = await loadCatalog();
  const bySlug = Object.fromEntries(data.categories.map((c) => [c.slug, c]));
  hosts.forEach((host) => {
    const slug = host.dataset.catalogTeaser;
    const cat = bySlug[slug];
    if (!cat) return;
    const n = Number(host.dataset.count || 4);
    host.innerHTML = cat.items.slice(0, n).map((p) => productCard(p)).join('');
  });
}

/* ------------------------------------------------------ корзина (демо) */
let cartCount = Number(sessionStorage.getItem('ep-cart') || 0);
function initCart() {
  const sync = () => {
    $$('[data-cart-count]').forEach((e) => (e.textContent = cartCount));
    sessionStorage.setItem('ep-cart', String(cartCount));
  };
  sync();
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      cartCount++;
      sync();
      add.textContent = 'Добавлено';
      add.classList.add('btn--chrome');
      add.classList.remove('btn--ghost');
      setTimeout(() => {
        add.textContent = 'В корзину';
        add.classList.remove('btn--chrome');
        add.classList.add('btn--ghost');
      }, 1400);
      toast('Товар добавлен в корзину — демо-режим');
    }
    const fav = e.target.closest('.product-card__fav');
    if (fav) {
      fav.style.borderColor = '#ff6a1a';
      toast('Добавлено в избранное');
    }
  });
}

export function toast(text) {
  let box = $('#toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    box.style.cssText = `position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);z-index:200;
      padding:13px 20px;border-radius:999px;background:rgba(20,23,29,.95);border:1px solid #2e333d;color:#f2f4f7;
      font-size:13.5px;opacity:0;transition:all .35s cubic-bezier(.22,1,.36,1);backdrop-filter:blur(14px);pointer-events:none`;
    document.body.appendChild(box);
  }
  box.textContent = text;
  requestAnimationFrame(() => {
    box.style.opacity = '1';
    box.style.transform = 'translate(-50%,0)';
  });
  clearTimeout(box._t);
  box._t = setTimeout(() => {
    box.style.opacity = '0';
    box.style.transform = 'translate(-50%,20px)';
  }, 2200);
}

/* ---------------------------------------------------- мелочи интерфейса */
function initHeader() {
  const header = $('.header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  // мобильное меню
  const burger = $('.burger');
  if (burger) {
    burger.addEventListener('click', () => {
      const nav = $('.nav');
      nav?.classList.toggle('is-open');
      document.body.classList.toggle('is-locked');
    });
  }
  // активный пункт меню
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav a').forEach((a) => {
    const h = a.getAttribute('href');
    if (h === page) a.classList.add('is-active');
  });
  // год
  $$('[data-year]').forEach((e) => (e.textContent = new Date().getFullYear()));
}

/* --------------------------------------------------- главная витрина */
async function initHomeShowcase() {
  const host = $('#showcase-grid');
  if (!host) return;
  const data = await loadCatalog();
  const picks = ['spetsodezhda-zimnyaya', 'spetsobuv-zimnyaya', 'spetsodezhda-letnyaya', 'spetsobuv-termo'];
  const cards = picks.map((slug, i) => {
    const c = data.categories.find((x) => x.slug === slug);
    if (!c) return '';
    const img = ['assets/gen/cat-winter.jpg', 'assets/gen/hero-gear.jpg', 'assets/gen/cat-summer.jpg', 'assets/gen/cat-protective.jpg'][i];
    const min = Math.min(...c.items.map((p) => p.price));
    return `
      <a class="card showcase-card" href="catalog.html?cat=${slug}" data-reveal data-reveal-delay="${i}">
        <img src="${img}" alt="${c.title}">
        <span class="showcase-card__tag">${c.group}</span>
        <span class="showcase-card__overlay">
          <span class="showcase-card__price">от ${money(min)}</span>
          <h3>${c.title}</h3>
          <p>${c.items.length} позиций в наличии</p>
        </span>
      </a>`;
  });
  host.innerHTML = cards.join('');
}

/* ------------------------------------------------------------- запуск */
export async function boot(page) {
  await Promise.all([
    inject('#site-header', 'partials/header.html'),
    inject('#site-footer', 'partials/footer.html'),
  ]);
  initHeader();
  initCart();
  initReveal();
  initCounters();

  if (page === 'home') {
    await Promise.all([initHero(), initCatalogTeasers(), initHomeShowcase()]);
  }
  if (page === 'catalog') await import('./pages/catalog.js').then((m) => m.init());
  if (page === 'product') await import('./pages/product.js').then((m) => m.init());
  if (page === 'contacts') await import('./pages/contacts.js').then((m) => m.init());

  // повторно подхватываем элементы, отрисованные динамически
  initReveal();
}

window.EP = { money, productCard, loadCatalog, toast };
