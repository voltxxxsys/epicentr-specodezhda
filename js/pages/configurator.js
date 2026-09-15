/* ==========================================================================
   Страница «3D-подбор комплекта»
   Слева — интерактивная 3D-фигура, справа — слои экипировки с ценами каталога.
   Собранный комплект считает сумму, можно запросить спецификацию.
   ========================================================================== */

const KIT = [
  { key: 'base', cat: 'trikotazh', title: 'Трикотаж и термобельё', note: '160–220 г/м²', on: true, id: 'EP-1076' },
  { key: 'trousers', cat: 'spetsodezhda-letnyaya', title: 'Брюки рабочие', note: 'смесовая ткань, СОП', on: true, id: 'EP-1002' },
  { key: 'jacket', cat: 'spetsodezhda-zimnyaya', title: 'Куртка зимняя', note: 'до −30 °C, светоотражающие полосы', on: true, id: 'EP-1001' },
  { key: 'vest', cat: 'spetsodezhda-zashchitnaya', title: 'Сигнальный жилет', note: '2-й класс защиты', on: true, id: 'EP-1017' },
  { key: 'helmet', cat: 'zashchita-golovy', title: 'Каска и очки', note: 'СОМЗ-55, Anti-Fog', on: true, id: 'EP-1123' },
  { key: 'respirator', cat: 'zashchita-dykhaniya', title: 'Полумаска FFP1–FFP3', note: 'со сменными фильтрами', on: true, id: 'EP-1139' },
  { key: 'gloves', cat: 'zashchita-ruk', title: 'Краги и перчатки', note: 'спилок, нитрил', on: true, id: 'EP-1155' },
  { key: 'boots', cat: 'spetsobuv-zimnyaya', title: 'Ботинки рабочие', note: 'композитный подносок', on: true, id: 'EP-1086' },
  { key: 'harness', cat: 'zashchita-vysota', title: 'Страховочная привязь', note: 'анкерная точка', on: false, id: 'EP-1163' },
];

const money = (v) => new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';

export async function init(pageHost) {
  const host = document.getElementById('cfg-stage');
  const canvas = document.getElementById('cfg-canvas');
  if (!host || !canvas) return;

  const host_ = pageHost;

  /* ---------- данные каталога: цены, фото, ссылки ---------- */
  let byId = new Map();
  try {
    const r = await fetch('data/catalog.json');
    const data = await r.json();
    byId = new Map(data.categories.flatMap((c) => c.items.map((p) => [p.id, p])));
  } catch { /* без данных каталога панель всё равно работает */ }

  for (const item of KIT) {
    const p = byId.get(item.id);
    item.price = p ? p.price : 0;
    item.img = p ? p.img : 'assets/gen/cat-protective.jpg';
    item.name = p ? p.name : item.title;
    item.art = p ? p.art : '';
  }

  /* ---------- 3D-сцена ---------- */
  let api = null;
  let stage = 0; // сколько слоёв показано (0..9)
  try {
    const mod = await import('../three/scene.js');
    api = await mod.createHero(canvas, { mode: 'spin', zoom: 1.15, autoSpin: 0.22, lookY: 0.98, center: true });
    api.setProgress(1); // показываем комплект целиком
    host.classList.add('is-ready');
  } catch (e) {
    console.warn('3D недоступен:', e.message);
    host.classList.add('is-failed');
  }

  /* перетаскивание — поворот фигуры */
  let dragging = false;
  let lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !api) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    api.nudge(dx * 0.012);
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  /* ракурсы */
  document.querySelectorAll('[data-cfg-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.cfgView;
      if (!api) return;
      document.querySelectorAll('[data-cfg-view]').forEach((b) => b.classList.toggle('is-active', b === btn));
      if (view === 'vertical') api.setMode('vertical');
      else if (view === 'spin') api.setMode('spin');
      else { api.setMode('spin'); api.setProgress(1); api.setZoom(1.15); }
    });
  });

  /* ---------- панель слоёв ---------- */
  const layersHost = document.getElementById('cfg-layers');
  const sumEl = document.getElementById('cfg-sum');
  const countEl = document.getElementById('cfg-count');
  const titleEl = document.getElementById('cfg-title');
  const subEl = document.getElementById('cfg-sub');

  layersHost.innerHTML = KIT.map((item, i) => `
    <label class="cfg-layer${item.on ? ' is-on' : ''}" data-layer="${i}">
      <input type="checkbox" ${item.on ? 'checked' : ''}>
      <img src="${item.img}" alt="" loading="lazy">
      <span class="cfg-layer__text">
        <b>${item.title}</b>
        <span class="cfg-layer__note">${item.note}${item.art ? ' · арт. ' + item.art : ''}</span>
      </span>
      <span class="cfg-layer__price">${money(item.price)}</span>
    </label>`).join('');

  function refresh() {
    const on = KIT.filter((k) => k.on);
    const sum = on.reduce((a, k) => a + k.price, 0);
    sumEl.textContent = money(sum);
    countEl.textContent = String(on.length);
    // в сцене показываем ровно столько слоёв, сколько отмечено
    stage = on.length;
    if (api) api.setProgress(stage / KIT.length);
    const last = on[on.length - 1];
    titleEl.textContent = on.length === KIT.length
      ? 'Комплект собран'
      : (last ? 'Последний слой: ' + last.title : 'Ничего не выбрано');
    subEl.textContent = on.length
      ? `${on.length} ${on.length === 1 ? 'слой' : on.length < 5 ? 'слоя' : 'слоёв'} экипировки на фигуре`
      : 'Отметьте слои в панели справа';
  }

  layersHost.addEventListener('change', (e) => {
    const wrap = e.target.closest('[data-layer]');
    if (!wrap) return;
    const i = Number(wrap.dataset.layer);
    KIT[i].on = e.target.checked;
    wrap.classList.toggle('is-on', e.target.checked);
    refresh();
  });

  document.getElementById('cfg-all')?.addEventListener('click', () => {
    KIT.forEach((k) => { k.on = true; });
    layersHost.querySelectorAll('[data-layer]').forEach((w) => {
      w.classList.add('is-on');
      const input = w.querySelector('input');
      if (input) input.checked = true;
    });
    refresh();
  });

  document.getElementById('cfg-spec')?.addEventListener('click', () => {
    const on = KIT.filter((k) => k.on);
    const sum = on.reduce((a, k) => a + k.price, 0);
    const lines = on.map((k) => `• ${k.title} — ${money(k.price)}${k.art ? ' (арт. ' + k.art + ')' : ''}`).join('\n');
    window.EP?.toast(`Спецификация: ${on.length} позиций на ${money(sum)} — демо-режим`);
    console.info('Спецификация (демо):\n' + lines + `\nИтого: ${money(sum)}`);
  });

  refresh();

  /* ---------- фотопревью комплекта ---------- */
  const previewHost = document.getElementById('cfg-preview');
  if (previewHost) {
    try {
      const mod = await import('../three/photo-hero.js');
      previewHost.innerHTML = `<div class="hero-photo cfg-preview__photo">${mod.photoFramesMarkup()}</div>`;
      const photoRoot = previewHost.querySelector('.cfg-preview__photo');
      const inst = mod.createPhotoHero(photoRoot, {});
      const r = previewHost.getBoundingClientRect();
      const onScroll = () => {
        const rect = previewHost.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - rect.top) / (rect.height + window.innerHeight * 0.35)));
        inst.setProgress(p);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      void r;
    } catch (e) {
      console.warn('фотопревью недоступно:', e.message);
    }
  }

  void host_;
}
