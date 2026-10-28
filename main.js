const root = document.documentElement;

// ---------- Screenshot viewer: each project cover opens all its screenshots ----------
const viewer = document.getElementById('viewer');
const viewerFrame = viewer.querySelector('.viewer-frame');
const viewerCaption = viewer.querySelector('figcaption');
const viewerCount = viewer.querySelector('.viewer-count');
const viewerPrev = viewer.querySelector('.viewer-prev');
const viewerNext = viewer.querySelector('.viewer-next');
const viewerThumbs = viewer.querySelector('.viewer-thumbs');
let shots = [];
let shotIndex = 0;
let loadToken = 0;

// Each screenshot opens in its device, like the covers: a portrait one in the iPhone (under the iOS
// status bar, with the home indicator), a landscape one in the MacBook (in a plain frame on narrow
// screens), the console (data-device="tablet") in the tablet. data-bar: the height in image pixels of
// the app's bottom bar, kept above the iPhone's safe area.
const narrow = matchMedia('(max-width: 700px)');
const iosIcons = document.querySelector('.ios-icons').outerHTML;

// Colour of the screenshot's edge (top or bottom row), for the status or menu bar and the safe area
function edgeColor(pic, y) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(pic, 2, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return { css: `rgb(${r} ${g} ${b})`, dark: r * .3 + g * .59 + b * .11 < 128 };
}

function deviceHTML(kind, pic, src, alt, bar) {
  const img = (cls = '') => `<img${cls && ` class="${cls}"`} src="${src}" alt="${alt.replace(/"/g, '&quot;')}">`;
  if (kind === 'tablet') return `<span class="dev-tablet"><span class="dev-tablet-camera"></span>${img()}</span>`;
  if (kind === 'laptop') {
    return `<span class="dev-laptop device device-macbook-pro" style="--menubar: ${edgeColor(pic, 2).css}"><span class="device-frame">${img('device-screen')}</span>`
      + '<span class="device-header"></span><span class="device-power"></span></span>';
  }
  const top = edgeColor(pic, 2);
  const bottom = edgeColor(pic, pic.naturalHeight - 3);
  // The screen is 390 px wide: the bar's height there
  const tabbar = bar ? `<span class="ios-tabbar" style="height: ${bar * 390 / pic.naturalWidth}px; background-image: url('${src}')"></span><span class="ios-safe"></span>` : '';
  return `<span class="dev-phone device device-iphone-14-pro"><span class="device-frame">`
    + `<span class="device-screen ios-screen ${top.dark ? 'dark' : 'light'}" style="--bar: ${top.css}; --safe: ${bottom.css}">`
    + `<span class="ios-status"><span class="ios-time">9:41</span>${iosIcons}</span>${img()}${tabbar}<span class="ios-home"></span></span></span>`
    + '<span class="device-stripe"></span><span class="device-header"></span><span class="device-sensors"></span>'
    + '<span class="device-btns"></span><span class="device-power"></span><span class="device-home"></span></span>';
}

// Scale the device to the space left by the counter, the caption and the thumbnails
function fitDevice() {
  const wrap = viewerFrame.querySelector('.viewer-device');
  if (!wrap) return;
  const device = wrap.firstElementChild;
  const phone = device.classList.contains('dev-phone');
  const maxW = Math.min(1100, innerWidth * (narrow.matches ? .94 : .78));
  const maxH = innerHeight - (phone ? 230 : 250);
  const k = Math.min(maxW / device.offsetWidth, maxH / device.offsetHeight);
  wrap.style.transform = `scale(${k})`;
  viewerFrame.style.width = `${device.offsetWidth * k}px`;
  viewerFrame.style.height = `${device.offsetHeight * k}px`;
}
addEventListener('resize', () => { if (viewer.open) fitDevice(); });

function renderShot(pic, img) {
  const src = img.getAttribute('src');
  let kind = img.dataset.device || (pic.naturalHeight > pic.naturalWidth ? 'phone' : 'laptop');
  if (kind === 'laptop' && narrow.matches) kind = 'plain';
  viewerFrame.className = `viewer-frame is-${kind}`;
  viewerFrame.style.width = viewerFrame.style.height = '';
  viewerFrame.innerHTML = kind === 'plain'
    ? `<img src="${src}" alt="">`
    : `<span class="viewer-device">${deviceHTML(kind, pic, src, img.alt, +img.dataset.bar || 0)}</span>`;
  if (kind === 'plain') viewerFrame.querySelector('img').alt = img.alt;
  fitDevice();
}

function showShot(i) {
  shotIndex = (i + shots.length) % shots.length;
  const fig = shots[shotIndex];
  const img = fig.querySelector('img');
  const token = ++loadToken;
  viewerFrame.classList.add('is-loading');
  const pic = new Image();
  pic.src = img.getAttribute('src');
  pic.decode().catch(() => {}).then(() => {
    if (token !== loadToken) return;
    renderShot(pic, img);
  });
  viewerCaption.innerHTML = fig.querySelector('figcaption').innerHTML;
  viewerCount.textContent = `${shotIndex + 1} / ${shots.length}`;
  viewerThumbs.querySelectorAll('button').forEach((b, n) => {
    b.setAttribute('aria-current', String(n === shotIndex));
    if (n === shotIndex) b.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
}

function buildThumbs() {
  viewerThumbs.replaceChildren(...shots.map((fig, n) => {
    const b = document.createElement('button');
    const img = fig.querySelector('img');
    b.setAttribute('aria-label', img.alt);
    b.innerHTML = `<img src="${img.getAttribute('src')}" alt="">`;
    b.addEventListener('click', () => showShot(n));
    return b;
  }));
}

document.querySelectorAll('[data-shots]').forEach((button) => {
  button.addEventListener('click', () => {
    shots = [...button.nextElementSibling.querySelectorAll('figure')];
    buildThumbs();
    viewer.showModal();
    showShot(0);
  });
});

viewerPrev.addEventListener('click', () => showShot(shotIndex - 1));
viewerNext.addEventListener('click', () => showShot(shotIndex + 1));
viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', (e) => { if (e.target === viewer || e.target.classList.contains('viewer-stage') || e.target.classList.contains('viewer-figure')) viewer.close(); });
viewer.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') showShot(shotIndex - 1);
  if (e.key === 'ArrowRight') showShot(shotIndex + 1);
});
// Swipe on touch screens
let touchX = null;
viewer.addEventListener('touchstart', (e) => { touchX = e.target.closest('.viewer-thumbs') ? null : e.touches[0].clientX; }, { passive: true });
viewer.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) showShot(shotIndex + (dx < 0 ? 1 : -1));
  touchX = null;
});

// ---------- Language (English in the HTML, French in i18n.js) ----------
const textEls = document.querySelectorAll('[data-i18n]');
const hrefEls = document.querySelectorAll('[data-i18n-href]');
const ariaEls = document.querySelectorAll('[data-i18n-aria]');
const altEls = document.querySelectorAll('[data-i18n-alt]');

// Keep the English originals so we can switch back without reloading
const EN = {
  'meta.title': document.title,
  'meta.description': document.querySelector('meta[name="description"]').content,
};
textEls.forEach((el) => { EN[el.dataset.i18n] = el.innerHTML; });
hrefEls.forEach((el) => { EN[el.dataset.i18nHref] = el.getAttribute('href'); });
ariaEls.forEach((el) => { EN[el.dataset.i18nAria] = el.getAttribute('aria-label'); });
altEls.forEach((el) => { EN[el.dataset.i18nAlt] = el.alt; });

const DICTS = { en: EN, fr: window.I18N_FR || {} };

function detectLang() {
  // 1. ?lang=fr in the URL (handy for the link on a French CV)
  const param = new URLSearchParams(location.search).get('lang');
  if (Object.hasOwn(DICTS, param ?? '')) return param;
  // 2. The visitor's last choice
  try { const saved = localStorage.getItem('lang'); if (Object.hasOwn(DICTS, saved ?? '')) return saved; } catch (e) {}
  // 3. The browser language; English for everything that is not French
  const browser = (navigator.languages || [navigator.language]).find((l) => /^(fr|en)/i.test(l));
  return browser && /^fr/i.test(browser) ? 'fr' : 'en';
}

function applyLang(lang) {
  const dict = DICTS[lang];
  const t = (key) => dict[key] ?? EN[key];
  root.lang = lang;
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]').content = t('meta.description');
  textEls.forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  hrefEls.forEach((el) => { el.setAttribute('href', t(el.dataset.i18nHref)); });
  ariaEls.forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  altEls.forEach((el) => { el.alt = t(el.dataset.i18nAlt); });
  updateThemeLabel(lang);
  langToggle.textContent = lang === 'fr' ? 'EN' : 'FR';
  langToggle.setAttribute('aria-label', lang === 'fr' ? 'EN, switch to English' : 'FR, passer en français');
}

const langToggle = document.getElementById('lang-toggle');
const themeToggle = document.getElementById('theme-toggle');
let lang = detectLang();
applyLang(lang);

langToggle.addEventListener('click', () => {
  lang = lang === 'fr' ? 'en' : 'fr';
  applyLang(lang);
  try { localStorage.setItem('lang', lang); } catch (e) {}
  // Drop ?lang= so a reload keeps this choice instead of the link's language
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) { url.searchParams.delete('lang'); history.replaceState(null, '', url); }
});

// ---------- Theme: remembers the visitor's choice; otherwise follows the system ----------
function currentTheme() {
  return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function updateThemeLabel(l) {
  const toDark = currentTheme() === 'light';
  const labels = l === 'fr'
    ? (toDark ? 'Passer en thème sombre' : 'Passer en thème clair')
    : (toDark ? 'Switch to dark theme' : 'Switch to light theme');
  themeToggle.setAttribute('aria-label', labels);
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
  updateThemeLabel(lang);
});

// ---------- Device mockups: scale each fixed-size stage to its column ----------
// Fitted right away too, so the unscaled stage never widens the page on phones
function fitStage(media) {
  media.style.setProperty('--k', media.clientWidth / media.querySelector('.stage').offsetWidth);
}
const fitStages = new ResizeObserver((entries) => entries.forEach(({ target }) => fitStage(target)));
document.querySelectorAll('.work-media .stage').forEach((stage) => {
  fitStage(stage.parentElement);
  fitStages.observe(stage.parentElement);
});

document.getElementById('year').textContent = new Date().getFullYear();

// ---------- Scroll reveal: blocks below the fold fade up once when they come into view ----------
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const targets = document.querySelectorAll('.section-head, .about, .flow-box, .card, .job, .stack-row, .work, .contact .btn');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('reveal');
      entry.target.classList.remove('reveal-pending');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el) => {
    // Anything already on screen at load stays as it is
    if (el.getBoundingClientRect().top < innerHeight) return;
    el.classList.add('reveal-pending');
    observer.observe(el);
  });
}
