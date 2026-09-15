/* Проверка страниц демо-сайта: теги, пути к картинкам, якоря, классы.
   Запуск: node tools/check-pages.mjs   (из папки S:\сайт) */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/* корень проекта: аргумент запуска или текущая папка */
const root = resolve(process.argv[2] || process.cwd());
const PAGES = ['about.html', 'services.html', 'delivery.html', 'blog.html', 'contacts.html'];
const KNOWN = ['index.html', 'catalog.html', 'product.html', 'contacts.html', 'delivery.html',
  'services.html', 'blog.html', 'about.html', 'partials/header.html', 'partials/footer.html'];

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr']);

/* классы из технического задания */
const REQUIRED = {
  'about.html': ['.page-head', '.breadcrumbs', '.lead', '.section', '.container', '.grid', '.card',
    '.btn', '.btn--ghost', '.btn--chrome', '.btn--sm', '.eyebrow', '.muted', '.small', '.mono',
    '.link-arrow', '.chip', '.feature', '.review', '.team-card', '.partner-pill', '.stats-grid',
    '.stat', '.timeline', '.faq', '.cta-band'],
  'services.html': ['.page-head', '.breadcrumbs', '.lead', '.section', '.container', '.grid', '.card',
    '.btn', '.btn--ghost', '.btn--chrome', '.btn--sm', '.eyebrow', '.muted', '.small', '.mono',
    '.link-arrow', '.chip', '.service-row', '.timeline', '.cta-band'],
  'delivery.html': ['.page-head', '.breadcrumbs', '.lead', '.section', '.container', '.grid', '.card',
    '.btn', '.btn--ghost', '.btn--chrome', '.btn--sm', '.eyebrow', '.muted', '.small', '.mono',
    '.link-arrow', '.chip', '.feature', '.stats-grid', '.stat', '.cta-band'],
  'blog.html': ['.page-head', '.breadcrumbs', '.lead', '.section', '.container', '.grid', '.card',
    '.btn', '.btn--ghost', '.btn--chrome', '.btn--sm', '.eyebrow', '.muted', '.small', '.mono',
    '.link-arrow', '.chip', '.post-card', '.cta-band'],
  'contacts.html': ['.page-head', '.breadcrumbs', '.lead', '.section', '.container', '.grid', '.card',
    '.btn', '.btn--ghost', '.btn--sm', '.eyebrow', '.muted', '.small', '.mono', '.link-arrow',
    '.chip', '.faq', '.contact-card', '.map-frame', '.lead-form'],
};

let errors = 0;
let warnings = 0;
const fail = (m) => { errors++; console.log('  ✗ ' + m); };
const warn = (m) => { warnings++; console.log('  ! ' + m); };

for (const page of PAGES) {
  console.log('\n=== ' + page + ' ===');
  const path = join(root, page);
  if (!existsSync(path)) { fail('файл не найден'); continue; }
  const html = readFileSync(path, 'utf8');

  /* --- 1. базовая структура --- */
  if (!html.startsWith('<!DOCTYPE html>')) fail('нет <!DOCTYPE html> в первой строке');
  if (!/<html lang="ru">/.test(html)) fail('нет <html lang="ru">');
  const baseIdx = html.indexOf('href="css/base.css"');
  const pagesIdx = html.indexOf('href="css/pages.css"');
  if (baseIdx < 0) fail('нет подключения css/base.css');
  if (pagesIdx < 0) fail('нет подключения css/pages.css');
  if (baseIdx >= 0 && pagesIdx >= 0 && baseIdx > pagesIdx) fail('pages.css подключён раньше base.css');
  if (!/<meta name="viewport"/.test(html)) fail('нет meta viewport');
  if (!/<title>.+<\/title>/.test(html)) fail('нет <title>');

  /* --- 2. шапка/подвал/скрипт --- */
  const headerIdx = html.indexOf('<div id="site-header"></div>');
  const footerIdx = html.indexOf('<div id="site-footer"></div>');
  const scriptIdx = html.indexOf("import { boot } from './js/main.js';");
  if (headerIdx < 0) fail('нет <div id="site-header"></div>');
  if (footerIdx < 0) fail('нет <div id="site-footer"></div>');
  if (headerIdx > footerIdx) fail('site-header идёт после site-footer');
  if (scriptIdx < 0) fail('нет подключения boot()');
  if (footerIdx > scriptIdx) fail('скрипт boot() идёт до site-footer');
  const bootArg = (html.match(/boot\('([a-z]+)'\)/) || [])[1];
  const wantBoot = page === 'contacts.html' ? 'contacts' : 'home';
  if (bootArg !== wantBoot) fail(`boot('${bootArg}') вместо boot('${wantBoot}')`);

  /* --- 3. заголовок страницы: page-head + breadcrumbs + h1 + lead --- */
  const head = html.slice(html.indexOf('class="page-head"'), html.indexOf('</section>'));
  if (!/class="page-head"/.test(html)) fail('нет .page-head');
  if (!/class="breadcrumbs"/.test(head)) fail('нет .breadcrumbs внутри .page-head');
  if (!/href="index.html">Главная<\/a>/.test(head)) fail('в крошках нет ссылки «Главная» → index.html');
  if (!/<h1>/.test(head)) fail('нет h1 в .page-head');
  if (!/class="lead"/.test(head)) fail('нет .lead в .page-head');

  /* --- 4. обязательные классы --- */
  const missing = REQUIRED[page].filter((c) => !html.includes(c.replace(/^\./, '')));
  if (missing.length) fail('нет классов: ' + missing.join(', '));
  else console.log('  обязательные классы: все ' + REQUIRED[page].length + ' на месте ✓');

  /* --- 5. картинки существуют --- */
  const imgs = [...html.matchAll(/src="(assets\/[^"]+)"/g)].map((m) => m[1]);
  const bad = [...new Set(imgs)].filter((p) => !existsSync(join(root, decodeURIComponent(p))));
  if (bad.length) bad.forEach((p) => fail('нет файла картинки: ' + p));
  if (!imgs.length) warn('на странице нет изображений');

  /* --- 6. локальные ссылки ведут в существующие файлы --- */
  const hrefs = [...html.matchAll(/href="([^"#][^"]*)"/g)].map((m) => m[1])
    .filter((h) => !/^(https?:|mailto:|tel:|#)/.test(h));
  for (const h of new Set(hrefs)) {
    const file = h.split('#')[0].split('?')[0];
    if (!file) continue;
    if (!existsSync(join(root, file))) {
      if (KNOWN.includes(file)) warn(`ссылка на ещё не созданную страницу: ${h}`);
      else fail(`битая ссылка: ${h}`);
    }
  }

  /* --- 7. якорные ссылки внутри страницы --- */
  const anchors = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="#([^"]+)"/g)) {
    if (!anchors.has(m[1])) fail(`якорь #${m[1]} не найден на странице`);
  }
  for (const m of html.matchAll(/href="([a-z-]+\.html)#([^"]+)"/g)) {
    const target = join(root, m[1]);
    if (!existsSync(target)) continue;
    const tHtml = readFileSync(target, 'utf8');
    if (!tHtml.includes(`id="${m[2]}"`)) fail(`на ${m[1]} нет якоря #${m[2]}`);
  }

  /* --- 8. дубли id --- */
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) fail('дубли id: ' + [...new Set(dup)].join(', '));

  /* --- 9. баланс тегов --- */
  const stack = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
    const [, close, name, selfClose] = m;
    const tag = name.toLowerCase();
    if (VOID.has(tag) || selfClose) continue;
    if (tag === 'script' || tag === 'style') continue;
    if (!close) stack.push({ tag, pos: m.index });
    else {
      const last = stack.pop();
      if (!last) fail(`закрывающий </${tag}> без открывающего`);
      else if (last.tag !== tag) fail(`нарушен порядок тегов: открыт <${last.tag}>, закрыт </${tag}>`);
    }
  }
  if (stack.length) fail('не закрыты теги: ' + stack.map((s) => '<' + s.tag + '>').join(', '));

  /* --- 10. data-reveal внутри секций --- */
  const blocks = html.split('<section').slice(1)
    .map((b) => b.slice(0, b.indexOf('</section>') + 10))
    .filter((b) => !b.startsWith(' class="page-head"'));
  const withoutReveal = blocks.filter((b) => !b.includes('data-reveal'));
  if (withoutReveal.length) warn(`${withoutReveal.length} секц. без data-reveal внутри`);
  else console.log(`  контентных секций с data-reveal: ${blocks.length} / ${blocks.length} ✓`);

  console.log(`  секций: ${blocks.length}, картинок: ${imgs.length}, ссылок: ${hrefs.length}`);
}

/* --- 11. все классы со страниц есть в css --- */
console.log('\n=== классы и стили ===');
const css = ['css/base.css', 'css/pages.css']
  .map((f) => readFileSync(join(root, f), 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const styleFiles = ['index.html', 'partials/header.html', 'partials/footer.html']
  .concat(PAGES)
  .map((f) => readFileSync(join(root, f), 'utf8'))
  .join('\n');
const usedClasses = new Set();
for (const m of styleFiles.matchAll(/class="([^"]+)"/g)) {
  m[1].split(/\s+/).filter(Boolean).forEach((c) => usedClasses.add(c));
}
const undefinedClasses = [...usedClasses].filter((c) => !css.includes('.' + c));
if (undefinedClasses.length) warn('классы без стилей: ' + undefinedClasses.join(', '));
else console.log(`  все ${usedClasses.size} классов со страниц описаны в css ✓`);

/* --- 12. запрещённые телефон/адрес, которых нет у клиента --- */
console.log('\n=== контакты клиента ===');
const ALLOWED_PHONES = ['8 (8412) 205-200', '8 (800) 444-39-55', '+78412205200', '+78004443955'];
for (const page of PAGES) {
  const html = readFileSync(join(root, page), 'utf8');
  for (const m of html.matchAll(/\+?[78][\s(-]?\d{3,4}[\s)-]?\s?\d{3}[-\s]?\d{2}[-\s]?\d{2}/g)) {
    const norm = m[0].trim();
    if (!ALLOWED_PHONES.some((p) => norm.startsWith(p) || p.startsWith(norm))) {
      fail(`${page}: посторонний телефон «${norm}»`);
    }
  }
  if (/205200@mail\.ru/.test(html)) console.log(`  ${page}: 205200@mail.ru ✓`);
}

console.log(`\nИтог: ошибок — ${errors}, предупреждений — ${warnings}`);
process.exit(errors ? 1 : 0);
