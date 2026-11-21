/* ============================================================
   Лендинг «3D-фартук 33 мм» — калькулятор и формы
   Все ценовые коэффициенты вынесены в CONFIG — меняются без правки логики.
   ============================================================ */

/*
  Ориентиры по рынку РФ (проверено через DuckDuckGo, ноябрь 2026):
  — тонкий 3D/SPC-фартук 3 мм: 2000×600 мм ≈ 1 669 ₽ (≈1 390 ₽/м²),
    3000×600 мм ≈ 2 005 ₽ (≈1 115 ₽/м²) — vseinstrumenti.ru / Wildberries;
  — композитный/МДФ-фартук: ≈ 2 900–4 000 ₽/м² — meb96.ru, vseinstrumenti.ru;
  — фартук из кварцевого агломерата: 12 700–33 400 ₽/м² — etnaquartz.ru.

  Наш продукт — жёсткая 3D-панель 33 мм: позиционируем выше композитных
  панелей, но ниже камня. База 5 200 ₽/м² — примерная, заменить на вашу
  реальную себестоимость/цену перед запуском.
*/
const CONFIG = {
  counterId: 0,                 // Yandex Metrica ID, 0 = выключен
  crmEndpoint: '',              // URL приёма заявок (AmoCRM / Bitrix24 / свой API)

  waste: 0.07,                  // запас на подрезку, 7%
  panelArea: 0.72,              // площадь панели 1200×600 мм = 0,72 м² (уточнить!)

  basePrice: 5200,              // базовая цена за м², ₽ (бетон)
  collectionCoeff: {
    stone: 1.40,                // ≈ 7 280 ₽/м²
    wood: 1.25,                 // ≈ 6 500 ₽/м²
    concrete: 1.00,             // ≈ 5 200 ₽/м²
    '3d': 1.55                  // ≈ 8 060 ₽/м²
  },
  clientCoeff: {
    designer: 0.90,             // −10% дизайнерам
    contractor: 0.85,           // −15% подрядчикам
    dealer: 0.75,               // −25% дилерам
    retail: 1.00                // розница без скидки
  },
  optionCost: { corner: 800, cutout: 500 },
  deliveryCost: { kazan: 0, region: 2500 },
  term: { kazan: '3–5 дней', region: '5–9 дней' }
};

/* ---------- Утилиты ---------- */
document.documentElement.classList.add('js');

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n, digits = 2) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const fmtMoney = (n) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ₽';
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function trackGoal(name) {
  if (!CONFIG.counterId) return;
  if (typeof window.ym === 'function') window.ym(CONFIG.counterId, 'reachGoal', name);
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name });
  console.info('[goal]', name);
}

function setError(name, message) {
  const el = $(`[data-error="${name}"]`);
  if (el) el.textContent = message || '';
  const input = $('#' + name);
  if (input) input.classList.toggle('invalid', Boolean(message));
}
function clearErrors(root) {
  $$('.error', root).forEach((e) => (e.textContent = ''));
  $$('.invalid', root).forEach((e) => e.classList.remove('invalid'));
}
function validContact(value) {
  const v = value.trim();
  if (v.startsWith('@')) return /^@[a-zA-Z0-9_]{4,32}$/.test(v);
  return v.replace(/\D/g, '').length >= 10;
}

/* ---------- Калькулятор ---------- */
const calcForm = $('#calcForm');

function readCalc() {
  return {
    width: num($('#width').value),
    height: num($('#height').value),
    collection: $('#collection').value,
    clientType: $('#clientType').value,
    city: $('#city').value,
    panelsManual: num($('#panels').value),
    corners: Math.max(0, Math.floor(num($('#corners').value))),
    cutouts: Math.max(0, Math.floor(num($('#cutouts').value)))
  };
}

function compute(d) {
  const area = d.width * d.height;
  const areaWithWaste = area * (1 + CONFIG.waste);
  const panels = d.panelsManual > 0
    ? Math.floor(d.panelsManual)
    : Math.max(1, Math.ceil(areaWithWaste / CONFIG.panelArea));

  const optionsCost = d.corners * CONFIG.optionCost.corner + d.cutouts * CONFIG.optionCost.cutout;
  const price =
    area *
      CONFIG.basePrice *
      (CONFIG.collectionCoeff[d.collection] || 1) *
      (CONFIG.clientCoeff[d.clientType] || 1) +
    optionsCost +
    CONFIG.deliveryCost[d.city];

  return { area, areaWithWaste, panels, price, term: CONFIG.term[d.city] };
}

/* ---------- Анимированный счётчик ---------- */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const animState = new WeakMap();
function animateNumber(el, to, format, duration = 420) {
  const state = animState.get(el) || { value: 0, raf: 0 };
  const from = state.value;
  if (state.raf) cancelAnimationFrame(state.raf);
  if (state.fallback) clearTimeout(state.fallback);
  if (reduceMotion || from === to) {
    state.value = to; state.raf = 0; state.fallback = 0;
    animState.set(el, state);
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const finish = () => {
    if (state.fallback) clearTimeout(state.fallback);
    state.value = to; state.raf = 0; state.fallback = 0;
    el.textContent = format(to);
  };
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = from + (to - from) * eased;
    state.value = value;
    el.textContent = format(value);
    if (p < 1) state.raf = requestAnimationFrame(tick);
    else finish();
  };
  state.fallback = setTimeout(finish, duration + 100); // rAF может не стрелять в фоновой вкладке
  state.raf = requestAnimationFrame(tick);
  animState.set(el, state);
}

function renderCalc() {
  const d = readCalc();
  const r = compute(d);
  animateNumber($('#resArea'), r.area, (v) => fmt(v, 2) + ' м²');
  animateNumber($('#resWaste'), r.areaWithWaste, (v) => fmt(v, 2) + ' м²');
  animateNumber($('#resPanels'), r.panels, (v) => Math.round(v) + ' шт.');
  animateNumber($('#resPrice'), r.price, (v) => fmtMoney(v), 520);
  $('#resTerm').textContent = r.term;
  return { d, r };
}

const calcInputs = $$('#width, #height, #panels, #collection, #clientType, #city, #corners, #cutouts');
calcInputs.forEach((el) => el.addEventListener('input', renderCalc));
renderCalc();

/* ---------- Отправка заявок ---------- */
async function sendLead(payload, source) {
  // 1) Аналитика
  trackGoal(source === 'calculator' ? 'calc_lead' : 'form_lead');

  // 2) Локальная копия (демо-режим)
  try {
    const leads = JSON.parse(localStorage.getItem('fartuk33_leads') || '[]');
    leads.push({ ...payload, source, sentAt: new Date().toISOString() });
    localStorage.setItem('fartuk33_leads', JSON.stringify(leads));
  } catch (e) { /* localStorage может быть недоступен */ }

  // 3) Реальная интеграция с CRM: раскомментируйте и укажите CONFIG.crmEndpoint
  // (Telegram-бот намеренно не подключаем — экспорт заявок через admin.html)
  /*
  if (CONFIG.crmEndpoint) {
    await fetch(CONFIG.crmEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  */

  console.info('[lead]', source, payload);
  return true;
}

/* ---------- Сабмит калькулятора ---------- */
calcForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(calcForm);
  $('#calcSuccess').hidden = true;

  const { d, r } = renderCalc();
  let firstBad = null;

  if (d.width < 0.1 || d.width > 20) {
    setError('width', 'Укажите ширину от 0,1 до 20 м'); firstBad = firstBad || $('#width');
  }
  if (d.height < 0.1 || d.height > 5) {
    setError('height', 'Укажите высоту от 0,1 до 5 м'); firstBad = firstBad || $('#height');
  }
  const phone = $('#calcPhone').value;
  if (!validContact(phone)) {
    setError('calcPhone', 'Укажите телефон или Telegram'); firstBad = firstBad || $('#calcPhone');
  }
  if (!$('#calcConsent').checked) {
    setError('calcConsent', 'Нужно согласие на обработку данных'); firstBad = firstBad || $('#calcConsent');
  }
  if (firstBad) {
    const stepEl = firstBad.closest('.wiz-step');
    if (stepEl && stepEl.dataset.step !== String(wizardStep)) {
      showWizardStep(Number(stepEl.dataset.step));
      window.setTimeout(() => firstBad.focus(), 60);
    } else firstBad.focus();
    return;
  }

  const btn = $('#calcSubmit');
  btn.disabled = true;
  btn.textContent = 'Отправляем...';

  const payload = {
    source: 'landing_calculator',
    width: d.width,
    height: d.height,
    area: +r.area.toFixed(2),
    areaWithWaste: +r.areaWithWaste.toFixed(2),
    panels: r.panels,
    collection: d.collection,
    clientType: d.clientType,
    city: d.city,
    options: { corners: d.corners, cutouts: d.cutouts },
    estimatedPrice: Math.round(r.price),
    term: r.term,
    phone: phone.trim(),
    company: $('#calcCompany').value.trim()
  };

  await sendLead(payload, 'calculator');

  btn.disabled = false;
  btn.textContent = 'Отправить запрос';
  $('#calcSuccessText').textContent =
    `${fmt(r.area)} м² · ${r.panels} шт. · ${fmtMoney(r.price)}. Менеджер уточнит счёт.`;
  $('#calcSuccess').hidden = false;
});

/* ---------- Сабмит формы КП ---------- */
$('#leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  clearErrors(form);
  $('#leadSuccess').hidden = true;

  const contact = $('#leadContact').value;
  let firstBad = null;
  if (!validContact(contact)) {
    setError('leadContact', 'Укажите телефон или Telegram'); firstBad = $('#leadContact');
  }
  if (!$('#leadConsent').checked) {
    setError('leadConsent', 'Нужно согласие на обработку данных'); firstBad = firstBad || $('#leadConsent');
  }
  if (firstBad) { firstBad.focus(); return; }

  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  btn.textContent = 'Отправляем...';

  await sendLead({
    source: 'landing_lead_form',
    company: $('#leadCompany').value.trim(),
    clientType: $('#leadType').value,
    city: $('#leadCity').value.trim(),
    contact: contact.trim(),
    comment: $('#leadVolume').value.trim()
  }, 'form');

  btn.disabled = false;
  btn.textContent = 'Отправить запрос';
  $('#leadSuccess').hidden = false;
});

/* ---------- Мобильное меню ---------- */
$('#menuToggle').addEventListener('click', (e) => {
  const open = $('#nav').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});
$$('#nav a').forEach((a) => a.addEventListener('click', () => {
  $('#nav').classList.remove('open');
  $('#menuToggle').setAttribute('aria-expanded', 'false');
}));

/* ---------- Скрытая админ-ссылка (?admin=1) ---------- */
if (new URLSearchParams(location.search).get('admin') === '1') {
  const link = document.createElement('a');
  link.href = 'admin.html?v=5';
  link.className = 'admin-floating';
  link.textContent = 'Админ: заявки';
  document.body.appendChild(link);
}

/* ---------- Scroll reveal ---------- */
if (!reduceMotion && 'IntersectionObserver' in window) {
  const targets = document.querySelectorAll(
    '.section-head, .card, .collection-card, .case-card, .step, .audience-card, ' +
    '.calc-form, .calc-result, .hero-content > *, .hero-visual, .thickness-copy, ' +
    '.comparison, .contact-box, .map-placeholder, .table-wrap, .specs-grid > div'
  );
  let i = 0;
  targets.forEach((el) => {
    el.classList.add('reveal');
    const delay = i % 3;
    if (delay === 1) el.classList.add('reveal-delay-1');
    if (delay === 2) el.classList.add('reveal-delay-2');
    i++;
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  targets.forEach((el) => io.observe(el));
}

/* ---------- Прогресс прокрутки (без layout-читаний на каждом скролле) ---------- */
const progressBar = $('#scrollProgress');
let pageMaxScroll = 1;
let stickyShowFrom = 0;
let stickyHideFrom = Infinity;

function updateProgress() {
  const value = Math.min(1, Math.max(0, window.scrollY / pageMaxScroll));
  progressBar.style.width = (value * 100).toFixed(2) + '%';
}
function measurePage() {
  pageMaxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const hero = $('#hero');
  const lead = $('#lead');
  stickyShowFrom = hero.offsetTop + hero.offsetHeight - 120;
  stickyHideFrom = lead.offsetTop - 200;
  updateProgress();
  updateSticky();
}

/* ---------- Анимация полос сравнения ---------- */
const barTracks = $$('.bar-track');
let barsDone = false;
function checkBars() {
  if (barsDone) return;
  let allGrown = true;
  barTracks.forEach((track) => {
    const bar = track.querySelector('.bar');
    if (!bar) return;
    if (bar.classList.contains('grow')) return;
    const rect = track.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) bar.classList.add('grow');
    else allGrown = false;
  });
  if (allGrown) barsDone = true;
}
if (reduceMotion) { $$('.bar').forEach((bar) => bar.classList.add('grow')); barsDone = true; }

/* ---------- Фильтр коллекций с анимацией ---------- */
const collectionsGrid = $('#collectionsGrid');
const filterButtons = $$('#collectionFilters .filter-btn');

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const filter = btn.dataset.filter;
    filterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
    collectionsGrid.classList.add('is-switching');
    window.setTimeout(() => {
      $$('.collection-card', collectionsGrid).forEach((card) => {
        const show = filter === 'all' || card.dataset.collection === filter;
        card.classList.toggle('is-hidden', !show);
      });
      collectionsGrid.classList.remove('is-switching');
    }, reduceMotion ? 0 : 220);
  });
});

$$('.collection-card', collectionsGrid).forEach((card) => {
  card.addEventListener('click', () => {
    $('#collection').value = card.dataset.collection;
    renderCalc();
    $('#calculator').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});

/* ---------- Мастер расчёта ---------- */
const wizardSteps = $$('.wiz-step');
const wizardLabels = ['Размеры', 'Текстура и клиент', 'Доставка и опции', 'Контакты'];
let wizardStep = 1;

function showWizardStep(n) {
  wizardStep = n;
  wizardSteps.forEach((step, i) => step.classList.toggle('is-active', i === n - 1));
  $('#wizardBar').style.width = (n / wizardSteps.length) * 100 + '%';
  $('#wizardLabel').textContent = `Шаг ${n} из ${wizardSteps.length} · ${wizardLabels[n - 1]}`;
  $('#wizPrev').disabled = n === 1;
  $('#wizNext').textContent = n === wizardSteps.length ? 'Отправить запрос' : 'Далее';
}
$('#wizPrev').addEventListener('click', () => showWizardStep(Math.max(1, wizardStep - 1)));

function validateCurrentStep() {
  clearErrors(calcForm);
  if (wizardStep !== 1) return true;
  let ok = true;
  const w = num($('#width').value);
  const h = num($('#height').value);
  if (w < 0.1 || w > 20) { setError('width', 'Укажите ширину от 0,1 до 20 м'); ok = false; }
  if (h < 0.1 || h > 5) { setError('height', 'Укажите высоту от 0,1 до 5 м'); ok = false; }
  return ok;
}

function goNext() {
  if (!validateCurrentStep()) return;
  if (wizardStep === wizardSteps.length) {
    if (typeof calcForm.requestSubmit === 'function') calcForm.requestSubmit();
    else calcForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    return;
  }
  showWizardStep(wizardStep + 1);
}
$('#wizNext').addEventListener('click', goNext);
$('#calcSubmit').addEventListener('click', () => {
  if (wizardStep !== wizardSteps.length) showWizardStep(wizardSteps.length);
  goNext();
});
showWizardStep(1);

/* ---------- Конфигуратор ---------- */
const configSwatches = $$('.swatch');
let chosenCollection = 'stone';
configSwatches.forEach((swatch) => {
  swatch.addEventListener('click', () => {
    chosenCollection = swatch.dataset.collection;
    configSwatches.forEach((s) => s.classList.toggle('is-active', s === swatch));
    $('#configCaption').textContent = swatch.dataset.name;
    const apron = $('#configApron');
    apron.className = 'config-apron changing';
    window.setTimeout(() => {
      apron.className = 'config-apron texture-' + chosenCollection;
    }, reduceMotion ? 0 : 180);
  });
});
$('#configApply').addEventListener('click', () => {
  $('#collection').value = chosenCollection;
  renderCalc();
  $('#calculator').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
});

/* ---------- 3D-просмотр ---------- */
const viewerStage = $('#viewerStage');
const viewerPanel = $('#viewerPanel');
let rotX = -12, rotY = -20, dragging = false, startX = 0, startY = 0;
viewerStage.addEventListener('pointerdown', (e) => {
  dragging = true; startX = e.clientX; startY = e.clientY;
  viewerStage.setPointerCapture(e.pointerId);
});
viewerStage.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  rotY += (e.clientX - startX) * 0.4;
  rotX -= (e.clientY - startY) * 0.3;
  rotX = Math.max(-60, Math.min(30, rotX));
  startX = e.clientX; startY = e.clientY;
  viewerPanel.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
});
viewerStage.addEventListener('pointerup', () => { dragging = false; });
viewerStage.addEventListener('pointercancel', () => { dragging = false; });
$('#viewerReset').addEventListener('click', () => {
  rotX = -12; rotY = -20;
  viewerPanel.style.transform = 'rotateX(-12deg) rotateY(-20deg)';
});

/* ---------- Карусель кейсов ---------- */
const caseFilters = $$('[data-case-filter]');
caseFilters.forEach((btn) => {
  btn.addEventListener('click', () => {
    caseFilters.forEach((b) => b.classList.toggle('is-active', b === btn));
    const filter = btn.dataset.caseFilter;
    $$('.case-card').forEach((card) => card.classList.toggle('is-hidden', filter !== 'all' && card.dataset.caseType !== filter));
    $('#casesCarousel').scrollTo({ left: 0, behavior: 'smooth' });
  });
});
$('#casePrev').addEventListener('click', () => $('#casesCarousel').scrollBy({ left: -320, behavior: 'smooth' }));
$('#caseNext').addEventListener('click', () => $('#casesCarousel').scrollBy({ left: 320, behavior: 'smooth' }));

/* ---------- Липкий CTA ---------- */
const stickyCta = $('#stickyCta');
function updateSticky() {
  const y = window.scrollY;
  stickyCta.classList.toggle('visible', y > stickyShowFrom && y < stickyHideFrom);
}

let scrollQueued = false;
function onScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    updateProgress();
    updateSticky();
    checkBars();
    scrollQueued = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { measurePage(); checkBars(); });
measurePage();

/* ---------- PDF-документы (печать из браузера) ---------- */
function openPrintable(title, rows, note) {
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return alert('Разрешите всплывающие окна для скачивания PDF');
  const body = rows.map((r) => `<tr><td>${escapeHtml(r[0])}</td><td><b>${escapeHtml(r[1])}</b></td></tr>`).join('');
  win.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#161A1F;padding:40px;max-width:760px;margin:0 auto}
      h1{font-size:26px;margin:0 0 6px}.date{color:#8b8f94;font-size:12px;margin-bottom:26px}
      table{width:100%;border-collapse:collapse;font-size:14px}
      td{padding:10px 8px;border-bottom:1px solid #ddd}
      .note{margin-top:24px;font-size:11px;color:#6b7178;line-height:1.5}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>${title}</h1><div class="date">${new Date().toLocaleDateString('ru-RU')} · Казань</div>
    <table>${body}</table><p class="note">${note}</p>
    </body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 350);
}
$('#pricePdf').addEventListener('click', () => {
  const rows = [
    ['Базовая цена (бетон), ₽/м²', fmtMoney(CONFIG.basePrice)],
    ...Object.entries(CONFIG.collectionCoeff).map(([k, v]) => [
      'Коллекция ' + ({ stone: 'Камень', wood: 'Дерево', concrete: 'Бетон', '3d': '3D-геометрия' })[k],
      fmtMoney(CONFIG.basePrice * v) + ' / м²'
    ]),
    ['Скидка дизайнерам', '−10%'],
    ['Скидка подрядчикам', '−15%'],
    ['Скидка дилерам', '−25%'],
    ['Угол, ₽/шт', fmtMoney(CONFIG.optionCost.corner)],
    ['Вырез под розетку, ₽/шт', fmtMoney(CONFIG.optionCost.cutout)],
    ['Доставка: Казань / регионы', '0 ₽ / ' + fmtMoney(CONFIG.deliveryCost.region)]
  ];
  openPrintable('Прайс-лист · 3D-фартук 33 мм', rows, 'Цены ориентировочные. Точный счёт формируется после согласования образца и партии. Укажите «Сохранить как PDF» в окне печати.');
});
$('#mobilePricePdf').addEventListener('click', () => $('#pricePdf').click());
$('#techPdf').addEventListener('click', () => {
  openPrintable('Техническая карта · 3D-фартук 33 мм', [
    ['Толщина', '33 мм'],
    ['Размер панели', 'уточняется'],
    ['Вес', 'уточняется'],
    ['Влагостойкость', 'уточняется'],
    ['Термостойкость', 'уточняется'],
    ['Способ монтажа', 'уточняется'],
    ['Запас на подрезку', '7%'],
    ['Срок отгрузки: Казань / регионы', '3–5 / 5–9 дней']
  ], 'Документ заполняется по реальным параметрам партии перед запуском продаж.');
});

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ---------- A/B-тест первого экрана ---------- */
let heroVariant = 'a';
try {
  heroVariant = localStorage.getItem('hero_variant') || (Math.random() < 0.5 ? 'a' : 'b');
  localStorage.setItem('hero_variant', heroVariant);
} catch (e) { /* приватный режим — используем вариант a */ }
document.body.classList.add('hero-' + heroVariant);
trackGoal('hero_variant_' + heroVariant);
