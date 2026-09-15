/* 3D-прототип на странице услуг: сцена создаётся при появлении секции,
   прогресс считается от положения секции в окне, режимы переключаются чипами. */
export async function init() {
  const host = document.getElementById('proto3d');
  const canvas = document.getElementById('proto-canvas');
  if (!host || !canvas) return;

  const title = document.getElementById('proto-title');
  const caption = document.getElementById('proto-caption');
  let api = null;
  let stages = [];
  let ready = false;

  async function boot() {
    if (ready) return;
    ready = true;
    try {
      const mod = await import('../three/scene.js');
      api = await mod.createHero(canvas, { mode: 'spin' });
      stages = api.stages || [];
    } catch (e) {
      console.warn('Прототип 3D недоступен:', e.message);
      host.insertAdjacentHTML('beforeend',
        '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#6f7784;font-size:14px">3D-сцена недоступна в этом браузере</div>');
      return;
    }
    onScroll();
  }

  let lastStage = -1;
  function onScroll() {
    if (!api) return;
    const r = host.getBoundingClientRect();
    const vh = window.innerHeight;
    // прогресс: 0 — секция входит снизу, 1 — выходит сверху
    const p = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 1.1)));
    api.setProgress(p);
    const per = 1 / Math.max(stages.length, 1);
    const active = Math.min(stages.length - 1, Math.floor(p / per));
    if (active !== lastStage && stages[active]) {
      lastStage = active;
      if (title) title.textContent = stages[active].title || '';
      if (caption) caption.textContent = stages[active].caption || '';
    }
  }

  // включаем сцену, когда секция подъехала к экрану
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { boot(); io.disconnect(); }
    }, { rootMargin: '300px' });
    io.observe(host);
  } else {
    boot();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  document.querySelectorAll('[data-proto-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.protoMode;
      document.querySelectorAll('[data-proto-mode]').forEach((b) => b.classList.toggle('is-active', b === btn));
      host.dataset.mode = mode;
      if (api) api.setMode(mode === 'vertical' ? 'vertical' : 'spin');
      onScroll();
    });
  });
}
