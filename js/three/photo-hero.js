/* ==========================================================================
   ГЕРОЙ-ФОТОПОСЛЕДОВАТЕЛЬНОСТЬ
   Кадры одного и того же манекена со слоями экипировки: по мере прокрутки
   одежда «надевается» кроссфейдом. Лёгкий режим — без 3D, идеален для телефона.
   ========================================================================== */

/* Цены взяты из data/catalog.json по конкретным товарам каталога */
export const PHOTO_STAGES = [
  {
    key: 'base', frame: 'assets/hero/step-1-base.jpg', id: 'EP-1076',
    short: 'Трикотаж', title: 'Трикотаж и термобельё',
    caption: 'Трикотаж и термобельё: 160–220 г/м², логотип — шелкография или вышивка',
  },
  {
    key: 'trousers', frame: 'assets/hero/step-1-base.jpg', id: 'EP-1002',
    short: 'Брюки', title: 'Брюки рабочие',
    caption: 'Брюки на смесовой ткани, светоотражающие элементы, наколенники СОП',
  },
  {
    key: 'jacket', frame: 'assets/hero/step-2-jacket.jpg', id: 'EP-1001',
    short: 'Куртка', title: 'Куртка рабочая',
    caption: 'Куртка зимняя: до −30 °C, светоотражающие полосы, шеврон компании',
  },
  {
    key: 'vest', frame: 'assets/hero/step-3-vest.jpg', id: 'EP-1017',
    short: 'Жилет', title: 'Сигнальный жилет',
    caption: 'Жилет 2-го класса защиты, светоотражающая лента 50 мм',
  },
  {
    key: 'helmet', frame: 'assets/hero/step-4-helmet.jpg', id: 'EP-1123',
    short: 'Каска', title: 'Защита головы и зрения',
    caption: 'Каска СОМЗ-55 с храповым механизмом и защитные очки с покрытием Anti-Fog',
  },
  {
    key: 'gloves', frame: 'assets/hero/step-5-gloves.jpg', id: 'EP-1155',
    short: 'Краги', title: 'Защита рук',
    caption: 'Краги спилковые и перчатки с нитриловым покрытием — по 2 пары на смену',
  },
];

/**
 * Фотогерой: слои проявляются кроссфейдом по прогрессу прокрутки.
 * @param {HTMLElement} root — контейнер с уже разложенными кадрами
 * @returns {{setProgress:Function, stages:Array, dispose:Function}}
 */
export function createPhotoHero(root, opts = {}) {
  const layers = [...root.querySelectorAll('[data-frame]')];
  const state = { target: 0, current: -1 };

  /** прогресс отдельного кадра: 0 — ещё не появился, 1 — полностью виден */
  function frameOpacity(index, p) {
    const n = layers.length;
    if (n <= 1) return 1;
    if (index === 0) {
      // первый кадр виден сразу и уступает второму
      return 1 - smooth(p, 0.1, 0.22);
    }
    const start = 0.1 + (index - 1) * (0.78 / (n - 1));
    const end = start + 0.12;
    return smooth(p, start, end);
  }

  function smooth(v, a, b) {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a || 1)));
    return t * t * (3 - 2 * t);
  }

  function setProgress(p) {
    const prog = Math.min(1, Math.max(0, p));
    layers.forEach((el, i) => {
      const o = frameOpacity(i, prog);
      el.style.opacity = o.toFixed(3);
      el.style.zIndex = String(i + 1);
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    });
    // активная стадия — по прогрессу, с учётом числа кадров
    const n = layers.length;
    const active = Math.min(n - 1, Math.floor(prog * n));
    if (active !== state.current) {
      state.current = active;
      opts.onStage && opts.onStage(active, prog);
    } else {
      opts.onTick && opts.onTick(prog, active);
    }
  }


  /* ---------------- «живость»: дыхание и параллакс ---------------- */
  const START_LIVE = performance.now();
  let pointer = { x: 0, y: 0 };
  let target = { x: 0, y: 0 };
  let rafId = 0;
  let alive = true;

  function onPointer(e) {
    // -1..1 по обеим осям
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }
  function onOrientation(e) {
    if (e.gamma == null || e.beta == null) return;
    target.x = Math.max(-1, Math.min(1, e.gamma / 35));
    target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 35));
  }
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('deviceorientation', onOrientation, { passive: true });

  function loop(now) {
    if (!alive) return;
    const t = (now - START_LIVE) / 1000;
    // плавное доведение до цели
    pointer.x += (target.x - pointer.x) * 0.045;
    pointer.y += (target.y - pointer.y) * 0.045;

    // дыхание: очень медленное «вдох-выдох» кадра
    const breath = Math.sin(t * 0.42) * 0.5 + 0.5;          // 0..1, период ~15 c
    const lift = Math.sin(t * 0.28 + 1.2) * 0.5 + 0.5;       // второй, более медленный слой

    layers.forEach((el, i) => {
      const depth = 1 + i * 0.06;                            // верхние слои чуть ближе
      const px = pointer.x * 10 * depth;
      const py = pointer.y * 6 * depth;
      const scale = 1 + breath * 0.012 + lift * 0.006;
      const ty = -breath * 6 + py;
      el.style.transform = `translate3d(${px.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    });
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  // параллакс и «дыхание» не должны работать, когда герой вне экрана
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !alive) { alive = true; rafId = requestAnimationFrame(loop); }
        else if (!e.isIntersecting && alive) { alive = false; cancelAnimationFrame(rafId); }
      }
    }, { rootMargin: '120px' });
    io.observe(root);
  }

  setProgress(0);
  return { setProgress, stages: PHOTO_STAGES, dispose() { alive = false; cancelAnimationFrame(rafId); } };
}

/** разметка кадров внутри героя (создаётся один раз) */
export function photoFramesMarkup() {
  return PHOTO_STAGES.map((s, i) => `
      <img class="hero-photo__frame" data-frame="${i}" src="${s.frame}" alt="${s.title}"
           loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" draggable="false">`).join('');
}
