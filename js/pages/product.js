/* Страница товара: данные из каталога, галерея, табы, похожие позиции */
import { loadCatalog, productCard, money, toast } from '../main.js';

const el = (s, r = document) => r.querySelector(s);
const nf = new Intl.NumberFormat('ru-RU');

export async function init() {
  const host = el('#product-page');
  if (!host) return;
  const data = await loadCatalog();
  const id = new URLSearchParams(location.search).get('id');

  const all = data.categories.flatMap((c) => c.items.map((p) => ({ ...p, catSlug: c.slug, catTitle: c.title, group: c.group })));
  const p = all.find((x) => x.id === id) || all[0];
  const cat = data.categories.find((c) => c.slug === p.catSlug);

  document.title = `${p.name} — купить в Пензе | Эпицентр`;
  el('#crumb-cat').textContent = cat.title;
  el('#crumb-cat').href = `catalog.html?cat=${cat.slug}`;
  el('#crumb-name').textContent = p.name;

  const properties = [
    ['Артикул', p.art || p.id],
    ['Категория', cat.title],
    ['Производитель', /Jeta|Lakeland/.test(p.name) ? 'Jeta Safety' : /DeltaPlus/i.test(p.name) ? 'Delta Plus' : /БАРС|Барс/.test(p.name) ? 'БАРС' : /РОСОМЗ|Росомз/i.test(p.name) ? 'РОСОМЗ®' : 'Эпицентр-Спецодежда'],
    ['Наличие', p.stock ? `На складе в Пензе: ${nf.format(p.stock)} шт.` : 'Под заказ, 5–14 дней'],
    ['Соответствие', 'ГОСТ, ТР ТС 019/2011'],
    ['Нанесение логотипа', 'Шелкография, вышивка, термотрансфер'],
    ['Доставка', 'Пенза — самовывоз/курьер; Россия — СДЭК, Деловые Линии'],
  ];

  const related = all.filter((x) => x.catSlug === p.catSlug && x.id !== p.id).slice(0, 4);

  host.innerHTML = `
    <div class="product-gallery">
      <div class="product-gallery__main"><img id="pg-main" src="${p.img}" alt="${p.name.replace(/"/g, '&quot;')}"></div>
      <div class="product-gallery__thumbs">
        ${[p.img, 'assets/gen/cat-protective.jpg', 'assets/gen/workwear-flatlay.jpg'].map((s) => `<img src="${s}" alt="">`).join('')}
      </div>
    </div>
    <div class="product-info">
      <span class="eyebrow">${cat.title}</span>
      <h1 style="font-size:clamp(22px,2.4vw,32px)">${p.name}</h1>
      <div class="product-info__price">${money(p.price)} <span class="small muted" style="font-weight:400">за шт. с НДС</span></div>
      <div class="stock ${p.stock > 0 && p.stock < 50 ? 'stock--low' : ''}">${p.stock ? `В наличии: ${nf.format(p.stock)} шт.` : 'Под заказ'}</div>
      <div class="product-actions">
        <div class="qty">
          <button type="button" id="q-minus">−</button>
          <input id="q-input" value="1" inputmode="numeric" aria-label="Количество">
          <button type="button" id="q-plus">+</button>
        </div>
        <button class="btn" type="button" data-add="${p.id}" id="add-to-cart">В корзину</button>
        <button class="btn btn--ghost" type="button" id="ask-price">Запросить спецификацию</button>
      </div>
      <div class="product-info__meta">
        ${properties.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('')}
      </div>
      <div class="card" style="padding:18px 20px;display:grid;gap:10px">
        <strong style="font-size:14px">Экономия для юридических лиц</strong>
        <p class="small muted">При заказе через сайт предоставляется персональная скидка, самостоятельный выбор позиций
          и удобный формат коммуникации. Скидка предоставляется только юридическим лицам.</p>
        <button class="btn btn--ghost btn--sm" type="button" onclick="alert('Демо-режим: здесь откроется форма расчёта скидки')">Рассчитать скидку</button>
      </div>
    </div>`;

  /* галерея */
  host.querySelectorAll('.product-gallery__thumbs img').forEach((img) => {
    img.addEventListener('click', () => (el('#pg-main').src = img.src));
  });

  /* количество */
  const qInput = el('#q-input');
  el('#q-minus').addEventListener('click', () => (qInput.value = Math.max(1, Number(qInput.value) - 1)));
  el('#q-plus').addEventListener('click', () => (qInput.value = Number(qInput.value) + 1));
  el('#ask-price').addEventListener('click', () => toast('Запрос спецификации — демо-режим'));

  /* табы */
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
      document.querySelectorAll('.tab-panel').forEach((pnl) => pnl.classList.toggle('is-active', pnl.id === tab.dataset.tab));
    });
  });

  /* похожие */
  const rel = el('#related-grid');
  if (rel) rel.innerHTML = related.map((x) => productCard(x)).join('');

  /* спецификация */
  const spec = el('#spec-table');
  if (spec) {
    spec.innerHTML = properties.concat([
      ['Состав', /Куртка|куртка/.test(p.name) ? 'Ткань Твил, утеплитель, светоотражающая лента' : 'Смесовая ткань, полимерные элементы'],
      ['Размерный ряд', '44–62, рост 170–188'],
      ['Цвет', 'Тёмно-синий / графит / чёрный (по запросу — корпоративный)'],
      ['Гарантия', '12 месяцев'],
    ]).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  }
}
