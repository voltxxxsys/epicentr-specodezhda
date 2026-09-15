/* Каталог: фильтры по группам, категориям, цене и наличию */
import { loadCatalog, productCard, money } from '../main.js';

const el = (s, r = document) => r.querySelector(s);
const nf = new Intl.NumberFormat('ru-RU');

export async function init() {
  const grid = el('#catalog-grid');
  if (!grid) return;
  const data = await loadCatalog();
  const params = new URLSearchParams(location.search);

  const state = {
    cat: params.get('cat') || 'all',
    group: params.get('group') || 'all',
    sort: 'popular',
    max: 100000,
    inStock: false,
    q: params.get('q') || '',
  };

  const allItems = data.categories.flatMap((c) => c.items.map((p) => ({ ...p, catSlug: c.slug, catTitle: c.title, group: c.group })));

  /* ---- фильтры ---- */
  const catsHost = el('#filter-cats');
  const groupsHost = el('#filter-groups');
  const groups = [...new Set(data.categories.map((c) => c.group))];

  groupsHost.innerHTML = [
    `<a href="#" data-group="all" class="${state.group === 'all' ? 'is-active' : ''}">Все направления <span>${allItems.length}</span></a>`,
    ...groups.map((g) => {
      const n = allItems.filter((p) => p.group === g).length;
      return `<a href="#" data-group="${g}" class="${state.group === g ? 'is-active' : ''}">${g} <span>${n}</span></a>`;
    }),
  ].join('');

  catsHost.innerHTML = [
    `<a href="#" data-cat="all" class="${state.cat === 'all' ? 'is-active' : ''}">Все категории <span>${data.categories.length}</span></a>`,
    ...data.categories.map((c) => {
      const active = state.cat === c.slug;
      return `<a href="#" data-cat="${c.slug}" class="${active ? 'is-active' : ''}">${c.title} <span>${c.items.length}</span></a>`;
    }),
  ].join('');

  const maxPrice = Math.max(...allItems.map((p) => p.price));
  const range = el('#filter-price');
  range.max = String(Math.ceil(maxPrice / 1000) * 1000);
  range.value = range.max;
  state.max = Number(range.max);

  const rangeVal = el('#price-val');
  const stock = el('#filter-stock');
  const sortSel = el('#catalog-sort');
  const countEl = el('#catalog-count');

  /* ---- рендер ---- */
  function filtered() {
    let list = allItems;
    if (state.group !== 'all') list = list.filter((p) => p.group === state.group);
    if (state.cat !== 'all') list = list.filter((p) => p.catSlug === state.cat);
    if (state.inStock) list = list.filter((p) => p.stock > 0);
    list = list.filter((p) => p.price <= state.max);
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.art || '').toLowerCase().includes(q));
    }
    if (state.sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    if (state.sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    if (state.sort === 'stock') list = [...list].sort((a, b) => b.stock - a.stock);
    return list;
  }

  function render() {
    const list = filtered();
    countEl.textContent = `${nf.format(list.length)} товаров`;
    grid.innerHTML = list.length
      ? list.map((p) => productCard(p)).join('')
      : '<div class="catalog-empty" style="grid-column:1/-1"><h3>Ничего не найдено</h3><p class="muted">Измените фильтры или сбросьте их — в каталоге 185 позиций.</p></div>';
    const title = state.cat !== 'all' ? data.categories.find((c) => c.slug === state.cat)?.title : 'Весь каталог';
    el('#catalog-title').textContent = title || 'Весь каталог';
    const crumb = el('#crumb-cat');
    if (crumb) crumb.textContent = title || 'Каталог';
    rangeVal.textContent = `до ${nf.format(state.max)} \u20BD`;
  }

  /* ---- события ---- */
  groupsHost.addEventListener('click', (e) => {
    const a = e.target.closest('[data-group]');
    if (!a) return;
    e.preventDefault();
    state.group = a.dataset.group;
    state.cat = 'all';
    [...groupsHost.children].forEach((c) => c.classList.toggle('is-active', c === a));
    [...catsHost.children].forEach((c, i) => c.classList.toggle('is-active', i === 0));
    render();
  });
  catsHost.addEventListener('click', (e) => {
    const a = e.target.closest('[data-cat]');
    if (!a) return;
    e.preventDefault();
    state.cat = a.dataset.cat;
    [...catsHost.children].forEach((c) => c.classList.toggle('is-active', c === a));
    const cat = data.categories.find((c) => c.slug === state.cat);
    if (cat) {
      state.group = cat.group;
      [...groupsHost.children].forEach((c) => c.classList.toggle('is-active', c.dataset.group === cat.group));
    }
    render();
  });
  range.addEventListener('input', () => {
    state.max = Number(range.value);
    render();
  });
  stock.addEventListener('change', () => {
    state.inStock = stock.checked;
    render();
  });
  sortSel.addEventListener('change', () => {
    state.sort = sortSel.value;
    render();
  });
  el('#filters-reset')?.addEventListener('click', () => {
    state.cat = 'all'; state.group = 'all'; state.inStock = false; state.q = '';
    state.max = Number(range.max); range.value = range.max; stock.checked = false;
    [...catsHost.children].forEach((c, i) => c.classList.toggle('is-active', i === 0));
    [...groupsHost.children].forEach((c, i) => c.classList.toggle('is-active', i === 0));
    render();
  });

  // поиск из шапки
  document.querySelectorAll('.search-inline input').forEach((inp) => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.q = inp.value.trim();
        render();
      }
    });
  });

  render();
  void money;
}
