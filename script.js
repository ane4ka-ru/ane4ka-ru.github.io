/* Interactive portfolio. No analytics, network APIs, packages or external scripts. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const html = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  html.classList.add('js');

  // Mobile navigation.
  const menuButton = $('.menu-button');
  const navigation = $('#main-nav');
  function closeMenu() {
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Открыть меню');
  }
  menuButton.addEventListener('click', () => {
    const opening = menuButton.getAttribute('aria-expanded') !== 'true';
    navigation.classList.toggle('open', opening);
    menuButton.setAttribute('aria-expanded', String(opening));
    menuButton.setAttribute('aria-label', opening ? 'Закрыть меню' : 'Открыть меню');
  });
  $$('a', navigation).forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.classList.contains('open')) {
      closeMenu();
      menuButton.focus();
    }
  });

  // Category filters. On a browser without JavaScript, every project is visible
  // and the native <details> elements provide the project descriptions.
  const cards = $$('.project-card');
  const filters = $$('.filter');
  const showAll = $('#show-all-projects');
  const projectCount = $('#project-count');
  let filterValue = 'all';
  let expanded = false;
  const initialCount = 6;
  function applyFilter(announce = true) {
    const matching = cards.filter(card => filterValue === 'all' || card.dataset.category === filterValue);
    const visible = filterValue === 'all' && !expanded ? matching.slice(0, initialCount) : matching;
    const visibleSet = new Set(visible);
    cards.forEach(card => { card.hidden = !visibleSet.has(card); });
    showAll.hidden = filterValue !== 'all' || matching.length <= initialCount;
    showAll.setAttribute('aria-expanded', String(expanded));
    showAll.replaceChildren(
      document.createTextNode(expanded ? 'Свернуть проекты ' : `Ещё ${cards.length - initialCount} проектов `)
    );
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = expanded ? '↑' : '↓';
    showAll.append(icon);
    if (announce) projectCount.textContent = `Показано проектов: ${visible.length} из ${matching.length}.`;
  }
  filters.forEach(button => button.addEventListener('click', () => {
    filterValue = button.dataset.filter;
    expanded = false;
    filters.forEach(item => {
      const isActive = item === button;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });
    applyFilter();
  }));
  showAll.addEventListener('click', () => {
    expanded = !expanded;
    applyFilter();
    const target = expanded ? cards[initialCount] : $('#projects');
    if (target) target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  });
  applyFilter(false);

  // Native dialogs give keyboard focus trapping and Escape handling.
  const projectDialog = $('#project-dialog');
  const letterDialog = $('#letter-dialog');
  const supportsDialog = typeof projectDialog.showModal === 'function';
  let projectOpener = null;
  let letterOpener = null;
  function syncScrollLock() {
    document.body.classList.toggle('modal-open', projectDialog.open || letterDialog.open);
  }
  function safeFocus(element) {
    if (element && element.isConnected && !element.closest('[hidden]')) {
      element.focus({ preventScroll: true });
    }
  }
  if (supportsDialog) {
    cards.forEach(card => {
      const summary = $('summary', card);
      summary.setAttribute('aria-haspopup', 'dialog');
      summary.addEventListener('click', event => {
        event.preventDefault();
        projectOpener = summary;
        const source = $('.project-details', card);
        const destination = $('#project-dialog-content');
        destination.replaceChildren(...[...source.children].map(node => node.cloneNode(true)));
        $('h3', destination).id = 'project-dialog-title';
        projectDialog.showModal();
        syncScrollLock();
      });
    });
    $('.project-close').addEventListener('click', () => projectDialog.close());
    $('.letter-close').addEventListener('click', () => letterDialog.close());
    [projectDialog, letterDialog].forEach(dialog => {
      dialog.addEventListener('click', event => {
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (
          event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom
        )) dialog.close();
      });
    });
    projectDialog.addEventListener('close', () => {
      syncScrollLock();
      if (!letterDialog.open) safeFocus(projectOpener);
    });
    letterDialog.addEventListener('close', () => {
      syncScrollLock();
      if (!projectDialog.open) safeFocus(letterOpener);
    });
  } else {
    // Older browsers retain the native expandable project descriptions.
    html.classList.add('no-dialog');
    const fallbackStyle = document.createElement('style');
    fallbackStyle.textContent = '.js.no-dialog .project-card[open] .project-details{display:block}';
    document.head.append(fallbackStyle);
  }

  // Independent letter and accreditation galleries share an accessible image viewer.
  const galleryCards = {
    letters: $$('.letters-grid .letter-card'),
    accreditations: $$('.accreditations-grid .accreditation-card')
  };
  let activeGallery = 'letters';
  const image = $('#letter-full-image');
  const viewport = $('#letter-viewport');
  const imageCanvas = $('#letter-image-canvas');
  const zoomIn = $('#zoom-in');
  const zoomOut = $('#zoom-out');
  const zoomReset = $('#zoom-reset');
  let activeLetter = 0;
  let zoom = 1;
  let fitWidth = 1;
  let fitHeight = 1;
  let imageRequest = 0;

  function sizeLetter(preserveCenter = false) {
    if (!letterDialog.open || !image.naturalWidth || !viewport.clientWidth || !viewport.clientHeight) return;
    const oldW = imageCanvas.offsetWidth || 1;
    const oldH = imageCanvas.offsetHeight || 1;
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / oldW;
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / oldH;
    const padding = window.innerWidth <= 570 ? 20 : 28;
    const ratio = Math.min((viewport.clientWidth - padding) / image.naturalWidth,
                           (viewport.clientHeight - padding) / image.naturalHeight);
    fitWidth = Math.max(1, image.naturalWidth * ratio);
    fitHeight = Math.max(1, image.naturalHeight * ratio);
    image.style.width = `${Math.round(fitWidth * zoom)}px`;
    image.style.height = `${Math.round(fitHeight * zoom)}px`;
    imageCanvas.style.width = `${Math.max(viewport.clientWidth, Math.ceil(fitWidth * zoom + padding))}px`;
    imageCanvas.style.height = `${Math.max(viewport.clientHeight, Math.ceil(fitHeight * zoom + padding))}px`;
    if (preserveCenter) {
      viewport.scrollLeft = centerX * imageCanvas.offsetWidth - viewport.clientWidth / 2;
      viewport.scrollTop = centerY * imageCanvas.offsetHeight - viewport.clientHeight / 2;
    } else {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
    zoomReset.textContent = `${Math.round(zoom * 100)}%`;
    zoomReset.setAttribute('aria-label', `Вписать изображение в окно. Текущий масштаб: ${Math.round(zoom * 100)} процентов`);
    zoomOut.disabled = zoom <= 1;
    zoomIn.disabled = zoom >= 4;
  }
  function changeZoom(value) {
    zoom = Math.max(1, Math.min(4, value));
    sizeLetter(true);
  }
  function setLetter(index) {
    const letterCards = galleryCards[activeGallery];
    const isAccreditation = activeGallery === 'accreditations';
    letterDialog.classList.toggle('is-accreditation', isAccreditation);
    activeLetter = (index + letterCards.length) % letterCards.length;
    const card = letterCards[activeLetter];
    const title = $('h3', card).textContent;
    const source = card.getAttribute('href');
    $('#letter-dialog-title').textContent = title;
    $('#letter-dialog-date').textContent = card.dataset.date;
    $('#letter-dialog-org').textContent = card.dataset.org;
    $('#letter-dialog-description').textContent = card.dataset.description;
    $('#letter-dialog-signer').textContent = card.dataset.signer || '';
    $('#letter-dialog-signer').hidden = !card.dataset.signer;
    $('#letter-counter').textContent = `${activeLetter + 1} / ${letterCards.length}`;
    const download = $('#letter-download');
    download.href = source;
    download.download = `${isAccreditation ? 'Аккредитации' : 'Благодарственное_письмо'}_${activeLetter + 1}.jpg`;
    download.replaceChildren(document.createTextNode(isAccreditation ? 'Скачать фото ' : 'Скачать письмо '));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↓';
    download.append(arrow);
    $('.letter-close').setAttribute('aria-label', isAccreditation ? 'Закрыть фотографию' : 'Закрыть письмо');
    zoomIn.setAttribute('aria-label', 'Увеличить изображение');
    zoomOut.setAttribute('aria-label', 'Уменьшить изображение');
    $('#gallery-controls-note').textContent = `Увеличение кнопками + / −. Переключение ${isAccreditation ? 'фотографий' : 'писем'} — стрелками клавиатуры.`;
    zoom = 1;
    zoomReset.textContent = '100%';
    zoomOut.disabled = true;
    zoomIn.disabled = false;
    image.alt = `${card.dataset.org}. ${title}. ${card.dataset.date}.`;
    imageRequest += 1;
    const request = imageRequest;
    image.onload = () => {
      if (request === imageRequest) requestAnimationFrame(() => sizeLetter(false));
    };
    image.onerror = () => showToast('Не удалось открыть изображение. Попробуйте скачать файл.');
    image.src = source;
    requestAnimationFrame(() => { if (image.complete && image.naturalWidth) sizeLetter(false); });
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-letter-index], a[data-accreditation-index]');
    if (!link || !supportsDialog || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const group = link.hasAttribute('data-accreditation-index') ? 'accreditations' : 'letters';
    const index = Number(group === 'accreditations' ? link.dataset.accreditationIndex : link.dataset.letterIndex);
    if (!Number.isInteger(index) || !galleryCards[group][index]) return;
    activeGallery = group;
    event.preventDefault();
    letterOpener = projectDialog.open ? projectOpener : link;
    if (projectDialog.open) projectDialog.close();
    if (!letterDialog.open) letterDialog.showModal();
    syncScrollLock();
    setLetter(index);
    $('.letter-close').focus({ preventScroll: true });
  });
  $('#previous-letter').addEventListener('click', () => setLetter(activeLetter - 1));
  $('#next-letter').addEventListener('click', () => setLetter(activeLetter + 1));
  zoomIn.addEventListener('click', () => changeZoom(zoom + 0.5));
  zoomOut.addEventListener('click', () => changeZoom(zoom - 0.5));
  zoomReset.addEventListener('click', () => changeZoom(1));
  document.addEventListener('keydown', event => {
    if (!letterDialog.open) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); setLetter(activeLetter - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); setLetter(activeLetter + 1); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(zoom + 0.5); }
    if (event.key === '-') { event.preventDefault(); changeZoom(zoom - 0.5); }
    if (event.key === '0') { event.preventDefault(); changeZoom(1); }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) closeMenu();
    if (letterDialog.open) requestAnimationFrame(() => sizeLetter(false));
  }, { passive: true });

  // Status messages for the image viewer.
  let toastTimer;
  function showToast(message) {
    const toast = $('#toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
  }
  // Reading progress and active anchor; no trackers or background requests.
  const progress = $('.reading-progress');
  const navLinks = $$('a', navigation);
  const sections = navLinks.map(link => ({ link, section: $(link.getAttribute('href')) }));
  let framePending = false;
  function refreshScroll() {
    const available = html.scrollHeight - window.innerHeight;
    progress.style.width = `${available > 0 ? Math.min(100, Math.max(0, window.scrollY / available * 100)) : 0}%`;
    let active = null;
    sections.forEach(item => { if (item.section.getBoundingClientRect().top < 190) active = item.link; });
    navLinks.forEach(link => {
      link.classList.toggle('active', link === active);
      if (link === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    framePending = false;
  }
  window.addEventListener('scroll', () => {
    if (!framePending) { requestAnimationFrame(refreshScroll); framePending = true; }
  }, { passive: true });
  refreshScroll();
})();
