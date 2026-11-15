// ============================================================
// content.js — se ejecuta DENTRO de la página del aula virtual
//   1. Fusiona los cursos duplicados (teoría/práctica) en una
//      sola tarjeta que abre un modal para elegir el aula.
//   2. Hace que toda el área de los cursos sueltos sea clickeable.
//   3. Desvanece el banner verde al hacer scroll.
// ============================================================

// ------------------------------------------------------------
// Helpers DOM seguros (cero innerHTML / cero riesgo XSS)
// ------------------------------------------------------------
const _svgDomParser = new DOMParser();

function crearNodoSvg(svgMarkup) {
  if (!svgMarkup || typeof svgMarkup !== 'string') return null;
  let markup = svgMarkup.trim();
  if (markup.startsWith('<svg') && !markup.includes('xmlns=')) {
    markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const doc = _svgDomParser.parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() === 'parsererror') return null;
  return document.importNode(root, true);
}

function crearEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function appendSvg(parent, svgMarkup) {
  const svgNode = crearNodoSvg(svgMarkup);
  if (svgNode && parent) parent.appendChild(svgNode);
  return svgNode;
}

function prependSvg(parent, svgMarkup) {
  const svgNode = crearNodoSvg(svgMarkup);
  if (svgNode && parent) parent.prepend(svgNode);
  return svgNode;
}

function crearWindowDots(containerClass = 'unalm-window-dots') {
  const dotsWrap = crearEl('div', containerClass);
  dotsWrap.appendChild(crearEl('span', 'unalm-dot dot-close'));
  dotsWrap.appendChild(crearEl('span', 'unalm-dot dot-min'));
  dotsWrap.appendChild(crearEl('span', 'unalm-dot dot-max'));
  return dotsWrap;
}

// ------------------------------------------------------------
// MODAL: se crea una sola vez y se reutiliza para cualquier curso.
// Va directo en <body>, no dentro de ninguna tarjeta, para que
// ningún overflow ni z-index de las tarjetas lo recorte.
// ------------------------------------------------------------
const overlay = document.createElement('div');
overlay.className = 'modal-overlay';

const modalBox = document.createElement('div');
modalBox.className = 'modal-box';

overlay.appendChild(modalBox);
document.body.appendChild(overlay);

function cerrarModal() {
  overlay.classList.remove('active');
}

// Cerrar al hacer clic en el fondo oscuro. "e.target === overlay"
// distingue "clic en el fondo" de "clic dentro del cuadro", si no
// el modal se cerraría al tocar un link de adentro.
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) cerrarModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModal();
});


// ------------------------------------------------------------
// ¿Teoría o Práctica?
// En el bloque "Navegación" cada curso aparece con su código
// (EP6003-T-1165 = Teoría, EP6003-P-1165 = Práctica). Buscamos el
// código por el id del curso. Si no lo encuentra, usamos el orden
// de aparición (primero Teoría, luego Práctica).
// ------------------------------------------------------------
function etiquetaDe(link, posicion) {
  const id = new URL(link.href).searchParams.get('id');
  const enNavegacion = document.querySelector(
    `.block_navigation a[href$="course/view.php?id=${id}"]`
  );
  const codigo = enNavegacion ? enNavegacion.textContent : '';

  if (codigo.includes('-T-')) return 'Teoría';
  if (codigo.includes('-P-')) return 'Práctica';
  return posicion === 0 ? 'Teoría' : 'Práctica';
}

function abrirModal(nombre, cursos) {
  modalBox.replaceChildren();   // limpia lo de una apertura anterior

  const titulo = document.createElement('h2');
  titulo.className = 'modal-title';
  titulo.textContent = nombre;
  modalBox.appendChild(titulo);

  cursos.forEach((curso, i) => {
    const link = curso.querySelector('.coursename a');
    const profesor = curso.querySelector('.teachers a');

    const opcion = document.createElement('div');
    opcion.className = 'merged-option';

    const etiqueta = document.createElement('span');
    etiqueta.className = 'merged-label';
    etiqueta.textContent = etiquetaDe(link, i);
    opcion.appendChild(etiqueta);

    // cloneNode(true) copia el link con su href, sin reconstruir la URL
    opcion.appendChild(link.cloneNode(true));

    if (profesor) {
      const prof = document.createElement('span');
      prof.className = 'merged-prof';
      prof.textContent = 'Profesor: ' + profesor.textContent;
      opcion.appendChild(prof);
    }

    modalBox.appendChild(opcion);
  });

  overlay.classList.add('active');
}


// ------------------------------------------------------------
// 1. Agrupar cursos con el mismo nombre
// ------------------------------------------------------------
function agruparCursosDuplicados() {
  // grupos = { "Analisis de Regresion": [tarjeta1, tarjeta2], ... }
  const grupos = {};

  document.querySelectorAll('.coursebox').forEach((curso) => {
    const enlace = curso.querySelector('.coursename a');
    if (!enlace) return;

    const nombre = enlace.textContent.trim();
    (grupos[nombre] ??= []).push(curso);
  });

  Object.entries(grupos).forEach(([nombre, cursos]) => {
    if (cursos.length < 2) return;   // sin duplicado: no se toca

    // Tarjeta nueva: solo el título (clonado, con su link e ícono)
    const tarjeta = document.createElement('div');
    tarjeta.className = 'coursebox coursebox-merged';
    tarjeta.appendChild(cursos[0].querySelector('.coursename').cloneNode(true));

    // Guardar metadatos de los cursos agrupados para la vista en cuadrícula
    const ids = cursos
      .map((c) => {
        const directId = c.getAttribute('data-courseid');
        if (directId) return directId;
        const a = c.querySelector('.coursename a');
        return a ? new URL(a.href).searchParams.get('id') : '';
      })
      .filter(Boolean);

    const teachers = Array.from(
      new Set(
        cursos.flatMap((c) =>
          Array.from(c.querySelectorAll('.teachers a')).map((a) => a.textContent.trim()).filter(Boolean)
        )
      )
    );

    tarjeta.dataset.unalmCourseIds = ids.join(',');
    tarjeta.dataset.unalmTeachers = teachers.join(' | ');
    tarjeta._unalmMergedCursos = cursos;

    // preventDefault evita que el link del título te lleve a un aula
    // al mismo tiempo que se abre el modal
    tarjeta.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      abrirModal(nombre, cursos);
    });

    cursos[0].before(tarjeta);       // la ponemos donde estaba la primera
    cursos.forEach((c) => c.remove());
  });
}


// ------------------------------------------------------------
// 2. Cursos sueltos: toda la tarjeta lleva al curso
// ------------------------------------------------------------
function hacerCursosClickeables() {
  document.querySelectorAll('.coursebox:not(.coursebox-merged)').forEach((curso) => {
    const link = curso.querySelector('.coursename a');
    if (!link) return;

    curso.addEventListener('click', (e) => {
      // Si el clic fue en un link o botón de acción, no redirigimos.
      if (e.target.closest('a, button')) return;
      window.location.href = link.href;
    });
  });
}


// ------------------------------------------------------------
// 3. Banner: opacidad 1 → 0 a medida que se baja 300px
// ------------------------------------------------------------
function desvanecerBannerAlScroll() {
  const banner = document.querySelector('#page #page-header');
  if (!banner) return;

  const distancia = 300;   // px de scroll hasta que desaparece del todo

  window.addEventListener('scroll', () => {
    banner.style.opacity = Math.max(1 - window.scrollY / distancia, 0);
  }, { passive: true });
}

// ------------------------------------------------------------
// 4. Modernizar el bloque de Navegación (Estilo Ventana Liquid Glass)
//    - Convierte el bloque en una ventana fluida estilo macOS/OS widget
//    - Reemplaza los botones toscos (Área personal, etc.) por pills con íconos
//    - Enriquece los cursos con nombres amigables y etiquetas [T]/[P]
// ------------------------------------------------------------
const SVG_ICONS = {
  home: `<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
  user: `<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  calendar: `<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>`,
  book: `<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10"></path><path d="M6 10h10"></path></svg>`,
  bell: `<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>`,
  globe: `<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>`,
  compass: `<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`,
  chevronDown: `<svg class="unalm-icon chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  filePdf: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 13v-1h2a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9"></path><path d="M9 17v-4"></path></svg>`,
  fileWord: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 16.5l1.5-6h1l1.5 4.5 1.5-4.5h1l1.5 6"></path></svg>`,
  presentation: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20"></path><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"></path><path d="m7 21 5-5 5 5"></path></svg>`,
  spreadsheet: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M12 9v12"></path></svg>`,
  fileCode: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  fileArchive: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path></svg>`,
  fileAudio: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
  fileGeneric: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`,
  video: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect width="15" height="14" x="1" y="5" rx="2" ry="2"></rect></svg>`,
  forum: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
  assignment: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="m9 14 2 2 4-4"></path></svg>`,
  link: `<svg class="unalm-icon act-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
  arrowUpRight: `<svg class="unalm-icon arrow-action" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`,
  sparkle: `<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path></svg>`,
  layers: `<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
  check: `<svg class="unalm-icon check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
};

function modernizarNavegacion() {
  const blockNav = document.querySelector('#inst24.block_navigation, .block_navigation');
  if (!blockNav) return;

  blockNav.classList.add('unalm-glass-window');

  // Modernizar el encabezado de la ventana
  const header = blockNav.querySelector('.header');
  const headerTitle = blockNav.querySelector('.header h2, #instance-24-header');
  if (header && !header.querySelector('.unalm-window-bar')) {
    const windowBar = crearEl('div', 'unalm-window-bar');
    windowBar.appendChild(crearWindowDots());

    const winTitle = crearEl('div', 'unalm-window-title');
    appendSvg(winTitle, SVG_ICONS.compass);
    winTitle.appendChild(crearEl('span', '', headerTitle ? headerTitle.textContent.trim() : 'Navegación'));
    windowBar.appendChild(winTitle);

    const toggleBtn = crearEl('button', 'unalm-window-toggle');
    toggleBtn.type = 'button';
    toggleBtn.title = 'Minimizar / Expandir';
    toggleBtn.setAttribute('aria-label', 'Toggle navegación');
    appendSvg(toggleBtn, SVG_ICONS.chevronDown);
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      blockNav.classList.toggle('unalm-collapsed');
    });
    windowBar.appendChild(toggleBtn);

    header.prepend(windowBar);
  }

  // Modernizar enlaces clave (Página Principal, Área personal, etc.)
  const links = blockNav.querySelectorAll('.content a');
  links.forEach((link) => {
    const text = link.textContent.trim();
    const href = link.getAttribute('href') || '';
    
    // Ocultar íconos feos nativos de Moodle
    const oldIcon = link.querySelector('img.icon, img.navicon');
    if (oldIcon) oldIcon.style.display = 'none';

    // Identificar tipo de botón y estilizar como Card/Pill
    link.classList.add('unalm-nav-pill');

    if (text.includes('Página Principal') || href.endsWith('.pe/') || href.endsWith('.pe')) {
      if (!link.querySelector('.unalm-icon')) {
        prependSvg(link, SVG_ICONS.home);
      }
      link.classList.add('pill-primary');
    } else if (text.includes('Área personal') || href.includes('/my/')) {
      if (!link.querySelector('.unalm-icon')) {
        prependSvg(link, SVG_ICONS.user);
      }
      link.classList.add('pill-personal');
    } else if (text.includes('Calendario') || href.includes('/calendar/')) {
      if (!link.querySelector('.unalm-icon')) {
        prependSvg(link, SVG_ICONS.calendar);
      }
      link.classList.add('pill-calendar');
    } else if (text.includes('Anuncios') || href.includes('forum')) {
      if (!link.querySelector('.unalm-icon')) {
        prependSvg(link, SVG_ICONS.bell);
      }
      link.classList.add('pill-announcements');
    } else if (text.includes('Páginas del sitio') || href.includes('/blog/')) {
      if (!link.querySelector('.unalm-icon')) {
        prependSvg(link, SVG_ICONS.globe);
      }
    }
  });

  // Modernizar los títulos de sección "Páginas del sitio" y "Mis cursos"
  blockNav.querySelectorAll('.tree_item.branch > span').forEach((span) => {
    span.classList.add('unalm-nav-section-title');
    const text = span.textContent.trim();
    if (text === 'Mis cursos') {
      span.replaceChildren();
      appendSvg(span, SVG_ICONS.book);
      span.appendChild(document.createTextNode(' '));
      span.appendChild(crearEl('span', '', 'Mis cursos'));
    }
  });

  // Modernizar cursos individuales en la lista de navegación
  blockNav.querySelectorAll('li.type_course a[id^="label_3_"]').forEach((courseLink) => {
    courseLink.classList.add('unalm-course-item-pill');
    const rawCode = courseLink.textContent.trim(); // ej: "EP6003-T-1165"
    const fullTitle = courseLink.getAttribute('title') || ''; // ej: "Analisis de Regresion"
    
    // Determinar si es Teoría o Práctica
    let badgeType = '';
    let badgeText = '';
    if (rawCode.includes('-T-')) {
      badgeType = 'badge-theory';
      badgeText = 'T';
    } else if (rawCode.includes('-P-')) {
      badgeType = 'badge-practice';
      badgeText = 'P';
    }

    if (fullTitle && !courseLink.querySelector('.unalm-course-meta')) {
      // Reestructurar el link para mostrar nombre amigable y badge elegante
      const meta = crearEl('span', 'unalm-course-meta');
      meta.appendChild(crearEl('span', 'unalm-course-name', fullTitle));
      meta.appendChild(crearEl('span', 'unalm-course-code', rawCode));

      const frag = [meta];
      if (badgeText) {
        frag.push(crearEl('span', `unalm-course-badge ${badgeType}`, badgeText));
      }
      courseLink.replaceChildren(...frag);
    }
  });
}

// ------------------------------------------------------------
// 5. Modernizar los apartados del Curso (Estilo Ventana Liquid Glass & Botones)
//    - Cada sección / unidad se transforma en una ventana Liquid Glass estilo OS
//    - Cada recurso (PDF, PPT, Excel, Video, Foro) se transforma en un botón moderno
//    - Se integra el botón de finalización de forma elegante
//    - En sección 0, la imagen del curso y los datos de contacto se enmarcan en vidrio
// ------------------------------------------------------------
function modernizarContenidoCurso() {
  const courseContent = document.querySelector('.course-content');
  if (!courseContent) return;

  const sections = document.querySelectorAll('.course-content ul.topics > li.section, .course-content ul.weeks > li.section');
  if (!sections || sections.length === 0) return;

  // Modernizar barra de progreso si existe
  const progressHeader = document.querySelector('#completionprogressid');
  if (progressHeader && !progressHeader.classList.contains('unalm-progress-pill')) {
    progressHeader.classList.add('unalm-progress-pill');
  }

  sections.forEach((section, sIndex) => {
    // Aplicar clase chasis liquid glass a la unidad
    section.classList.add('unalm-unit-window');

    const sectionId = section.getAttribute('id') || `section-${sIndex}`;
    const isGeneral = sectionId === 'section-0';

    // 1. Crear Barra de Título (Titlebar) estilo OS Liquid Glass
    if (!section.querySelector('.unalm-unit-bar')) {
      const allTitles = section.querySelectorAll('h3.sectionname, .sectionname');
      let rawTitle = '';
      allTitles.forEach((t) => {
        const text = t.textContent.trim();
        if (text && !rawTitle) rawTitle = text;
        t.style.setProperty('display', 'none', 'important');
      });
      if (!rawTitle) rawTitle = isGeneral ? 'Información General' : `Unidad ${sIndex}`;
      
      let badgeText = 'UNIDAD';
      let cleanTitle = rawTitle;
      let badgeClass = 'badge-unit';

      if (isGeneral) {
        badgeText = 'GENERAL';
        badgeClass = 'badge-general';
        cleanTitle = rawTitle.replace(/Análisis de Regresión|General/i, '').trim() || 'Información del Curso';
      } else if (rawTitle.toUpperCase().includes('UNIDAD')) {
        const parts = rawTitle.split(':');
        badgeText = parts[0].trim();
        cleanTitle = parts.slice(1).join(':').trim() || parts[0];
        badgeClass = 'badge-unit';
      } else if (rawTitle.toUpperCase().includes('PRÁCTICA')) {
        badgeText = 'PRÁCTICA';
        cleanTitle = rawTitle;
        badgeClass = 'badge-practice';
      } else if (rawTitle.toUpperCase().includes('EVALUACIÓN') || rawTitle.toUpperCase().includes('EXAMEN')) {
        badgeText = 'EVALUACIÓN';
        cleanTitle = rawTitle;
        badgeClass = 'badge-eval';
      } else if (rawTitle.toUpperCase().includes('PROYECTO')) {
        badgeText = 'PROYECTO';
        cleanTitle = rawTitle;
        badgeClass = 'badge-project';
      }

      const unitBar = crearEl('div', 'unalm-window-bar unalm-unit-bar');
      unitBar.appendChild(crearWindowDots());

      const unitTitle = crearEl('div', 'unalm-window-title');
      appendSvg(unitTitle, isGeneral ? SVG_ICONS.sparkle : SVG_ICONS.layers);
      unitTitle.appendChild(crearEl('span', `unalm-unit-badge ${badgeClass}`, badgeText));
      const unitNameSpan = crearEl('span', 'unalm-unit-name', cleanTitle);
      unitNameSpan.title = cleanTitle;
      unitTitle.appendChild(unitNameSpan);
      unitBar.appendChild(unitTitle);

      const toggleBtn = crearEl('button', 'unalm-window-toggle unalm-unit-toggle');
      toggleBtn.type = 'button';
      toggleBtn.title = 'Minimizar / Expandir unidad';
      toggleBtn.setAttribute('aria-label', 'Toggle unidad');
      appendSvg(toggleBtn, SVG_ICONS.chevronDown);
      unitBar.appendChild(toggleBtn);

      // Ocultar TODOS los títulos antiguos de sección (h3, spans y enlaces)
      section.querySelectorAll('.sectionname, h3.sectionname, .content > h3, .hidden.sectionname').forEach((el) => {
        el.style.setProperty('display', 'none', 'important');
      });

      // Acción de colapsar / expandir al hacer clic en el botón o en la barra
      const toggleAction = (e) => {
        e.stopPropagation();
        section.classList.toggle('unalm-unit-collapsed');
      };
      toggleBtn?.addEventListener('click', toggleAction);
      unitBar.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('input')) return;
        section.classList.toggle('unalm-unit-collapsed');
      });

      section.prepend(unitBar);
    }

    // 2. Si es sección 0: Enmarcar foto del curso y datos de contacto
    if (isGeneral) {
      const summaryImgs = section.querySelectorAll('.summary img, .no-overflow img, img');
      summaryImgs.forEach((img) => {
        if (!img.classList.contains('icon') && !img.classList.contains('spacer')) {
          img.classList.add('unalm-hero-styled');
        }
      });

      // Anular el scrollbar horizontal en .no-overflow
      section.querySelectorAll('.no-overflow').forEach((no) => {
        no.style.setProperty('overflow', 'visible', 'important');
        no.style.setProperty('overflow-x', 'visible', 'important');
      });

      const summaryText = section.querySelector('.summary .no-overflow');
      if (summaryText && !summaryText.classList.contains('unalm-summary-styled')) {
        summaryText.classList.add('unalm-summary-styled');
      }
    }

    // 3. Modernizar Actividades y Recursos dentro de la sección
    const activities = section.querySelectorAll('li.activity');
    activities.forEach((act) => {
      // Caso A: Labels / Subencabezados de categoría (Material de Teoría, Caso, Lectura, Video, Foro)
      if (act.classList.contains('modtype_label')) {
        const textContent = act.textContent.trim();
        // Ocultar casilla de completado en etiquetas de categoría
        const labelActions = act.querySelector('.actions');
        if (labelActions) labelActions.style.setProperty('display', 'none', 'important');

        if (textContent.length > 0 && textContent.length < 80) {
          act.classList.add('unalm-activity-label-header');
          let categoryIcon = SVG_ICONS.book;
          if (textContent.includes('Teoría')) categoryIcon = SVG_ICONS.book;
          else if (textContent.includes('Caso')) categoryIcon = SVG_ICONS.spreadsheet;
          else if (textContent.includes('Lectura')) categoryIcon = SVG_ICONS.filePdf;
          else if (textContent.includes('Video')) categoryIcon = SVG_ICONS.video;
          else if (textContent.includes('Foro')) categoryIcon = SVG_ICONS.forum;
          else if (textContent.includes('Horario') || textContent.includes('Información')) categoryIcon = SVG_ICONS.sparkle;

          const boldEl = act.querySelector('b, strong') || act.querySelector('.no-overflow');
          if (boldEl && !boldEl.querySelector('.unalm-label-icon')) {
            boldEl.classList.add('unalm-category-title');
            const labelIcon = crearEl('span', 'unalm-label-icon');
            appendSvg(labelIcon, categoryIcon);
            boldEl.prepend(labelIcon);
          }
        }
        return;
      }

      // Caso B: Elementos Clickeables (Archivos, PDFs, PPTs, Videos, Tareas, Foros)
      const link = act.querySelector('.activityinstance a');
      if (link && !link.classList.contains('unalm-activity-btn')) {
        link.classList.add('unalm-activity-btn');

        // Extraer nombre limpio (sin el texto oculto "Archivo" de Moodle)
        const instanceNameEl = link.querySelector('.instancename');
        const hiddenEl = link.querySelector('.accesshide');
        const hiddenText = hiddenEl ? hiddenEl.textContent.trim() : '';
        let actTitle = instanceNameEl ? instanceNameEl.textContent.trim() : link.textContent.trim();
        if (hiddenText) {
          actTitle = actTitle.replace(hiddenText, '').trim();
        }

        // Detectar tipo de recurso y asignar ícono SVG vectorial
        const nativeIcon = link.querySelector('img.activityicon');
        const nativeSrc = (nativeIcon ? (nativeIcon.getAttribute('src') || '') : '').toLowerCase();
        const nativeAlt = (nativeIcon ? (nativeIcon.getAttribute('alt') || '') : '').toLowerCase();
        const nativeTitle = (nativeIcon ? (nativeIcon.getAttribute('title') || '') : '').toLowerCase();
        const detailsEl = act.querySelector('.resourcelinkdetails');
        const detailsText = (detailsEl ? detailsEl.textContent.trim() : '').toLowerCase();
        const lowerTitle = actTitle.toLowerCase();
        const fullClues = `${nativeSrc} ${nativeAlt} ${nativeTitle} ${detailsText} ${lowerTitle}`;
        
        // REGLA CLAVE: Por defecto es Archivo General desconocido (NO forzar PDF jamás)
        let actType = 'file';
        let actTag = 'Archivo';
        let actIcon = SVG_ICONS.fileGeneric;
        let actHint = 'Abrir archivo';

        // 1. PDF
        if (
          nativeSrc.includes('pdf') || 
          /\.pdf($|\s|\?|#)/i.test(actTitle) || 
          lowerTitle.endsWith('.pdf') || 
          fullClues.includes('documento pdf') || 
          fullClues.includes('archivo pdf')
        ) {
          actType = 'pdf';
          actTag = 'Documento PDF';
          actIcon = SVG_ICONS.filePdf;
          actHint = 'Abrir PDF';
        }
        // 2. Excel / Hojas de cálculo
        else if (
          nativeSrc.includes('spreadsheet') || 
          nativeSrc.includes('calc') || 
          nativeSrc.includes('excel') || 
          /\.(xlsx?|csv|ods)($|\s|\?|#)/i.test(actTitle) || 
          lowerTitle.includes('xls') || 
          lowerTitle.includes('csv') || 
          fullClues.includes('hoja de cálculo') || 
          fullClues.includes('excel')
        ) {
          actType = 'sheet';
          actTag = 'Hoja de Cálculo';
          actIcon = SVG_ICONS.spreadsheet;
          actHint = 'Abrir Excel';
        }
        // 3. PowerPoint / Presentaciones
        else if (
          nativeSrc.includes('powerpoint') || 
          nativeSrc.includes('presentation') || 
          /\.(pptx?|ppsx?|odp)($|\s|\?|#)/i.test(actTitle) || 
          lowerTitle.includes('presentación') || 
          lowerTitle.includes('presentacion') || 
          lowerTitle.includes('ppt')
        ) {
          actType = 'ppt';
          actTag = 'Presentación PPT';
          actIcon = SVG_ICONS.presentation;
          actHint = 'Ver diapositivas';
        }
        // 4. Word / Procesadores de texto
        else if (
          nativeSrc.includes('document-') || 
          nativeSrc.includes('word') || 
          /\.(docx?|odt|rtf)($|\s|\?|#)/i.test(actTitle) || 
          fullClues.includes('documento word') || 
          fullClues.includes('word')
        ) {
          actType = 'word';
          actTag = 'Documento Word';
          actIcon = SVG_ICONS.fileWord;
          actHint = 'Abrir Word';
        }
        // 5. Script / Código (p. ej. scripts de R .r, Python .py, SQL, etc.)
        else if (
          nativeSrc.includes('sourcecode') || 
          /\.(r|rmd|py|sql|java|cpp|c|cs|js|ts|sh|ipynb)($|\s|\?|#)/i.test(actTitle) ||
          lowerTitle.endsWith('.r') ||
          lowerTitle.includes('.r ') ||
          lowerTitle.includes('script')
        ) {
          actType = 'code';
          actTag = 'Script / Código';
          actIcon = SVG_ICONS.fileCode;
          actHint = 'Abrir script';
        }
        // 6. Archivos Comprimidos (ZIP / RAR)
        else if (
          nativeSrc.includes('archive') || 
          nativeSrc.includes('zip') || 
          /\.(zip|rar|7z|tar|gz)($|\s|\?|#)/i.test(actTitle)
        ) {
          actType = 'zip';
          actTag = 'Archivo ZIP';
          actIcon = SVG_ICONS.fileArchive;
          actHint = 'Descargar ZIP';
        }
        // 7. Video / Enlaces a YouTube / Streaming
        else if (
          act.classList.contains('modtype_url') || 
          nativeSrc.includes('video') || 
          /\.(mp4|mkv|webm|avi|mov)($|\s|\?|#)/i.test(actTitle) || 
          lowerTitle.includes('video') || 
          lowerTitle.includes('youtube') || 
          lowerTitle.includes('youtu.be')
        ) {
          actType = 'video';
          actTag = 'Video de Clase';
          actIcon = SVG_ICONS.video;
          actHint = 'Ver video';
        }
        // 8. Audio / Podcasts
        else if (
          nativeSrc.includes('audio') || 
          nativeSrc.includes('mp3') || 
          /\.(mp3|wav|ogg|m4a)($|\s|\?|#)/i.test(actTitle)
        ) {
          actType = 'audio';
          actTag = 'Audio';
          actIcon = SVG_ICONS.fileAudio;
          actHint = 'Escuchar audio';
        }
        // 9. Foro de Debate
        else if (act.classList.contains('modtype_forum') || lowerTitle.includes('foro')) {
          actType = 'forum';
          actTag = 'Foro de Debate';
          actIcon = SVG_ICONS.forum;
          actHint = 'Participar';
        }
        // 10. Tareas / Evaluaciones
        else if (act.classList.contains('modtype_assign') || lowerTitle.includes('tarea') || lowerTitle.includes('entrega')) {
          actType = 'assign';
          actTag = 'Evaluación';
          actIcon = SVG_ICONS.assignment;
          actHint = 'Entregar trabajo';
        }

        // Si es el Sílabo del curso
        if (lowerTitle.includes('sílabo') || lowerTitle.includes('silabo')) {
          actTag = 'Sílabo Oficial';
          actHint = 'Descargar programa';
          if (actType === 'file') {
            actType = 'syllabus';
            actIcon = SVG_ICONS.filePdf;
          }
        }

        // Ocultar ícono de baja resolución nativo de Moodle
        if (nativeIcon) nativeIcon.style.display = 'none';

        // Reestructurar link como Botón Liquid Glass
        const actLeft = crearEl('div', 'unalm-act-left');
        const iconBox = crearEl('div', `unalm-act-icon-box type-${actType}`);
        appendSvg(iconBox, actIcon);
        actLeft.appendChild(iconBox);

        const actInfo = crearEl('div', 'unalm-act-info');
        actInfo.appendChild(crearEl('span', 'unalm-act-title', actTitle));
        const actMeta = crearEl('span', 'unalm-act-meta');
        actMeta.appendChild(crearEl('span', `unalm-act-tag tag-${actType}`, actTag));
        actMeta.appendChild(crearEl('span', 'unalm-act-hint', actHint));
        actInfo.appendChild(actMeta);
        actLeft.appendChild(actInfo);

        const actArrow = crearEl('div', 'unalm-act-arrow');
        appendSvg(actArrow, SVG_ICONS.arrowUpRight);

        link.replaceChildren(actLeft, actArrow);

        // Marcar casilla de finalización para estilo sin moverla del DOM
        const actions = act.querySelector('.actions');
        if (actions) {
          actions.classList.add('unalm-act-completion');
        }
      }
    });
  });
}

// ------------------------------------------------------------
// 6. Modernizar la Página de Entrega de Tareas (Assignment View)
//    - Elimina completamente cualquier franja blanca de Bootstrap/Moodle
//    - Transforma cada dato de la tabla en un Botón/Pill Liquid Glass (Foto 3)
//    - Integra íconos contextuales y badges modernos para estados y retrasos
// ------------------------------------------------------------
function modernizarPaginaTareas() {
  const table = document.querySelector('.submissionstatustable table.generaltable, .submissionsummarytable table.generaltable');
  if (!table) return;

  const container = document.querySelector('.submissionstatustable') || table.closest('.box');
  if (container && !container.classList.contains('unalm-task-styled')) {
    container.classList.add('unalm-task-styled');

    // Estilizar encabezado con puntos estilo macOS
    const h3 = container.querySelector('h3');
    if (h3 && !h3.querySelector('.unalm-assign-dots')) {
      const origText = h3.textContent.trim() || 'Estado de la entrega';
      h3.classList.add('unalm-assign-title');

      const dots = crearEl('span', 'unalm-assign-dots');
      dots.appendChild(crearEl('span', 'dot dot-red'));
      dots.appendChild(crearEl('span', 'dot dot-yellow'));
      dots.appendChild(crearEl('span', 'dot dot-green'));

      h3.replaceChildren(dots);
      appendSvg(h3, '<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>');
      h3.appendChild(crearEl('span', '', origText));
    }
  }

  // Iterar por cada fila del estado de la entrega
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row) => {
    row.classList.add('unalm-submission-row');
    const c0 = row.querySelector('td.c0');
    const c1 = row.querySelector('td.c1');
    if (!c0 || !c1) return;

    const labelText = c0.textContent.trim().toLowerCase();

    // Agregar ícono adecuado a c0 según el tipo de dato
    if (!c0.querySelector('.unalm-row-icon')) {
      let iconSvg = '';
      if (labelText.includes('estado de la entrega')) {
        iconSvg = `<svg class="unalm-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      } else if (labelText.includes('calificación') || labelText.includes('calificacion')) {
        iconSvg = `<svg class="unalm-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`;
      } else if (labelText.includes('fecha')) {
        iconSvg = `<svg class="unalm-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      } else if (labelText.includes('tiempo restante')) {
        iconSvg = `<svg class="unalm-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      } else if (labelText.includes('modificación') || labelText.includes('modificacion')) {
        iconSvg = `<svg class="unalm-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
      } else if (labelText.includes('comentario')) {
        iconSvg = `<svg class="unalm-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
      } else if (labelText.includes('archivo')) {
        iconSvg = `<svg class="unalm-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
      } else {
        iconSvg = `<svg class="unalm-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
      }

      const origLabel = c0.textContent.trim();
      c0.replaceChildren();
      appendSvg(c0, iconSvg);
      c0.appendChild(document.createTextNode(' '));
      c0.appendChild(crearEl('span', 'unalm-row-label-text', origLabel));
    }

    // Mejorar visualización del valor en c1
    const rawVal = c1.textContent.trim();
    if (rawVal === 'No entregado' && !c1.querySelector('.unalm-badge-pill')) {
      c1.replaceChildren(crearEl('span', 'unalm-badge-pill pill-unsubmitted', rawVal));
    } else if (rawVal === 'Sin calificar' && !c1.querySelector('.unalm-badge-pill')) {
      c1.replaceChildren(crearEl('span', 'unalm-badge-pill pill-ungraded', rawVal));
    } else if ((rawVal === 'Enviado para calificar' || rawVal === 'Entregado') && !c1.querySelector('.unalm-badge-pill')) {
      c1.replaceChildren(crearEl('span', 'unalm-badge-pill pill-submitted', rawVal));
    } else if (rawVal.toLowerCase().includes('calificado') && !rawVal.toLowerCase().includes('sin calificar') && !c1.querySelector('.unalm-badge-pill')) {
      c1.replaceChildren(crearEl('span', 'unalm-badge-pill pill-submitted', rawVal));
    }

    // Reemplazo limpio de tiempo restante con retraso (evita el <font color="red"> tosco)
    const overdueFont = c1.querySelector('font[color="red"], .overdue');
    if (overdueFont && !c1.querySelector('.pill-overdue')) {
      const text = overdueFont.textContent.trim();
      const pill = crearEl('span', 'unalm-badge-pill pill-overdue');
      appendSvg(pill, '<svg class="unalm-icon-mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>');
      pill.appendChild(crearEl('span', '', text));
      c1.replaceChildren(pill);
    }
  });
}

// ============================================================
// 7. MODERNIZAR PÁGINA DE LOGIN (INICIAR SESIÓN)
// Fondo de portada UNALM centrado y tarjeta Liquid Glass (Foto 3)
// ============================================================
function modernizarPaginaLogin() {
  const isLoginPage = document.body.id === 'page-login-index' ||
                      document.body.classList.contains('pagelayout-login') ||
                      window.location.pathname.includes('/login/');

  if (!isLoginPage) return;

  const loginWrapper = document.getElementById('loginone-wrapper') || document.querySelector('.login-content');
  if (!loginWrapper) return;

  // Limpiar cualquier fondo blanco residual de Moodle/Bootstrap en los contenedores padres
  const wrapperSelectors = [
    '#loginone-wrapper',
    '.login-content',
    '.login-inner-wrapper-2',
    'div[role="main"]',
    '.row',
    '[class*="col-"]',
    '.card-block',
    '#region-main',
    '.loginbox',
    '.loginpanel',
    '.subcontent',
    '.loginform'
  ];
  wrapperSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.closest('#loginone-wrapper') || el.id === 'loginone-wrapper') {
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
        el.style.setProperty('border', 'none', 'important');
      }
    });
  });

  // Ocultar el birrete viejo suelto fuera de la tarjeta
  const outerIconWrap = loginWrapper.querySelector('.login-inner-wrapper-2 > .mb-2');
  if (outerIconWrap) {
    outerIconWrap.style.setProperty('display', 'none', 'important');
  }

  const card = loginWrapper.querySelector('.card') || loginWrapper;
  card.classList.add('unalm-login-card');

  // Insertar barra superior estilo ventana macOS + badge UNALM PORTAL
  if (!card.querySelector('.unalm-login-window-bar')) {
    const oldDots = card.querySelector('.unalm-login-window-dots');
    if (oldDots && oldDots.parentElement === card) {
      oldDots.remove();
    }
    const winBar = crearEl('div', 'unalm-login-window-bar');
    const dots = crearEl('div', 'unalm-login-window-dots');
    ['rgba(255,95,86,0.6):#ff5f56', 'rgba(255,189,46,0.6):#ffbd2e', 'rgba(39,201,63,0.6):#27c93f'].forEach((item) => {
      const [glow, bg] = item.split(':');
      const d = document.createElement('span');
      d.style.cssText = `width:10px;height:10px;border-radius:50%;background:${bg};box-shadow:0 0 8px ${glow};display:inline-block;`;
      dots.appendChild(d);
    });
    winBar.appendChild(dots);
    winBar.appendChild(crearEl('div', 'unalm-login-portal-badge', 'UNALM PORTAL'));
    card.insertBefore(winBar, card.firstChild);
  }

  // Si existe el aviso de confirmación (usuario ya logueado - Foto 1)
  const noticeBox = card.querySelector('#notice');
  if (noticeBox) {
    const bodyP = noticeBox.querySelector('.modal-body p');
    if (bodyP && !card.querySelector('.unalm-avatar-icon')) {
      const avatarWrap = crearEl('div', 'unalm-avatar-icon');
      avatarWrap.style.cssText = 'width:64px;height:64px;border-radius:50%;background:rgba(31,157,119,0.2);border:2px solid rgba(127,232,200,0.5);display:flex;align-items:center;justify-content:center;margin:0 auto 16px auto;color:#7fe8c8;box-shadow:0 0 24px rgba(31,157,119,0.35);';
      appendSvg(avatarWrap, '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>');
      noticeBox.querySelector('.modal-header')?.insertAdjacentElement('beforebegin', avatarWrap);
    }
    return;
  }

  // Insertar cabecera con Birrete luminoso, "Iniciar Sesión" y subtítulo dentro de la tarjeta
  const winBar = card.querySelector('.unalm-login-window-bar');
  if (winBar && !card.querySelector('.unalm-login-brand')) {
    const brand = crearEl('div', 'unalm-login-brand');
    const emblem = crearEl('div', 'unalm-login-emblem');
    appendSvg(emblem, '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>');
    brand.appendChild(emblem);
    brand.appendChild(crearEl('h2', 'unalm-login-title', 'Iniciar Sesión'));
    brand.appendChild(crearEl('p', 'unalm-login-subtitle', 'Universidad Nacional Agraria La Molina'));
    winBar.insertAdjacentElement('afterend', brand);
  }

  // Modernizar formulario de login estándar
  const loginForm = card.querySelector('form#login');
  const usernameInput = card.querySelector('input#username, input[name="username"]');
  const passwordInput = card.querySelector('input#password, input[name="password"]');

  if (usernameInput && !usernameInput.parentElement.classList.contains('unalm-input-group')) {
    const userGroup = crearEl('div', 'unalm-input-group');
    appendSvg(userGroup, '<svg class="unalm-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>');
    usernameInput.placeholder = 'Código o usuario institucional';
    usernameInput.classList.add('unalm-login-input');
    usernameInput.parentElement.insertBefore(userGroup, usernameInput);
    userGroup.appendChild(usernameInput);
  }

  if (passwordInput && !passwordInput.parentElement.classList.contains('unalm-input-group')) {
    const passGroup = crearEl('div', 'unalm-input-group');
    appendSvg(passGroup, '<svg class="unalm-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>');
    passwordInput.placeholder = 'Contraseña';
    passwordInput.classList.add('unalm-login-input');
    passwordInput.parentElement.insertBefore(passGroup, passwordInput);
    passGroup.appendChild(passwordInput);

    // Botón de visibilidad de contraseña
    const toggleEye = crearEl('button', 'unalm-pass-toggle');
    toggleEye.type = 'button';
    toggleEye.style.cssText = 'position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:rgba(148,163,184,0.7); cursor:pointer; padding:4px; display:flex; align-items:center; justify-content:center;';
    appendSvg(toggleEye, '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>');
    toggleEye.addEventListener('click', (e) => {
      e.preventDefault();
      const isPass = passwordInput.type === 'password';
      passwordInput.type = isPass ? 'text' : 'password';
      toggleEye.style.color = isPass ? '#7fe8c8' : 'rgba(148,163,184,0.7)';
    });
    passGroup.appendChild(toggleEye);
  }

  // Agrupar Recordar usuario y ¿Olvidó su contraseña? en una sola fila encima del botón Acceder
  if (loginForm && !loginForm.querySelector('.unalm-login-options')) {
    const rememberEl = loginForm.querySelector('.rememberpass');
    const forgetEl = loginForm.querySelector('.forgetpass');
    const loginBtn = loginForm.querySelector('#loginbtn, input[type="submit"]');

    if (rememberEl || forgetEl) {
      const optionsRow = document.createElement('div');
      optionsRow.className = 'unalm-login-options';

      if (rememberEl) {
        const lbl = rememberEl.querySelector('label');
        if (lbl && lbl.textContent.trim().toLowerCase().includes('recordar nombre de usuario')) {
          lbl.textContent = 'Recordar usuario';
        }
        optionsRow.appendChild(rememberEl);
      }

      if (forgetEl) {
        const aLink = forgetEl.querySelector('a');
        if (aLink) {
          aLink.classList.add('unalm-forgot-link');
        }
        optionsRow.appendChild(forgetEl);
      }

      if (loginBtn) {
        loginBtn.parentElement.insertBefore(optionsRow, loginBtn);
      } else {
        loginForm.appendChild(optionsRow);
      }
    }

    if (loginBtn && loginBtn.tagName === 'INPUT') {
      loginBtn.classList.add('unalm-login-btn');
      loginBtn.value = 'Acceder al Aula Virtual →';
    }
  }
}

// ============================================================
// 8. FORZAR ESTILO DE BOTONES, BUSCADOR Y FOROS (ANTI-BOOTSTRAP)
// ============================================================
function modernizarBotonesYForos() {
  const isLoginPage = document.body.id === 'page-login-index' ||
                      document.body.classList.contains('pagelayout-login') ||
                      window.location.pathname.includes('/login/');

  if (!isLoginPage) {
    // A. Forzar estilo Liquid Glass en botones nativos de Moodle (elimina el degradado blanco roto de Bootstrap)
    const btnSelectors = [
      'input[type="submit"]',
      'input[type="button"]',
      'input[type="reset"]',
      '.singlebutton button',
      'a.btn:not(.btn-navbar)',
      'button:not(.unalm-window-toggle):not(.unalm-unit-toggle):not(.btn-link):not(.unalm-pass-toggle):not(.btn-navbar):not(.close)'
    ].join(', ');

    document.querySelectorAll(btnSelectors).forEach((btn) => {
      if (
        btn.closest('#page-login-index') ||
        btn.closest('.unalm-window-bar') ||
        btn.closest('#course-units-dropdown') ||
        btn.closest('.unalm-courses-toolbar') ||
        btn.closest('.unalm-grid-footer') ||
        btn.classList.contains('unalm-view-btn') ||
        btn.classList.contains('unalm-card-action-btn') ||
        btn.dataset.toggle === 'dropdown'
      ) {
        return;
      }

      const isSearchBtn = btn.id === 'searchforums' || !!btn.closest('.forumsearch');
      const isCancelBtn = btn.classList.contains('btn-cancel') || btn.id === 'id_cancel' || btn.name === 'cancel';

      if (isCancelBtn) {
        btn.style.setProperty('background', 'rgba(255, 255, 255, 0.07)', 'important');
        btn.style.setProperty('background-color', 'rgba(255, 255, 255, 0.07)', 'important');
        btn.style.setProperty('background-image', 'none', 'important');
        btn.style.setProperty('color', '#e2e8f0', 'important');
        btn.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.16)', 'important');
        btn.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.28)', 'important');
        btn.style.setProperty('box-shadow', '0 4px 14px rgba(0, 0, 0, 0.28)', 'important');
      } else {
        btn.style.setProperty(
          'background',
          'linear-gradient(135deg, rgba(31, 157, 119, 0.92) 0%, rgba(15, 92, 69, 0.96) 100%)',
          'important'
        );
        btn.style.setProperty('background-color', '#1F9D77', 'important');
        btn.style.setProperty(
          'background-image',
          'linear-gradient(135deg, rgba(31, 157, 119, 0.92) 0%, rgba(15, 92, 69, 0.96) 100%)',
          'important'
        );
        btn.style.setProperty('color', '#ffffff', 'important');
        btn.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.42)', 'important');
        btn.style.setProperty('border-top', '1px solid rgba(127, 232, 200, 0.72)', 'important');
        btn.style.setProperty(
          'box-shadow',
          isSearchBtn
            ? '0 4px 14px rgba(0, 0, 0, 0.3)'
            : '0 6px 20px rgba(0, 0, 0, 0.35), 0 0 16px rgba(31, 157, 119, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
          'important'
        );
      }

      btn.style.setProperty('background-repeat', 'no-repeat', 'important');
      btn.style.setProperty('background-position', '0 0', 'important');
      btn.style.setProperty('text-shadow', 'none', 'important');
      btn.style.setProperty('-webkit-appearance', 'none', 'important');
      btn.style.setProperty('appearance', 'none', 'important');
      btn.style.setProperty('outline', 'none', 'important');

      if (isSearchBtn) {
        btn.style.setProperty('border-radius', '999px', 'important');
        btn.style.setProperty('height', '32px', 'important');
        btn.style.setProperty('min-height', '32px', 'important');
        btn.style.setProperty('padding', '0 16px', 'important');
        btn.style.setProperty('margin', '0', 'important');
        btn.style.setProperty('font-size', '0.8rem', 'important');
        btn.style.setProperty('font-weight', '600', 'important');
      } else {
        btn.style.setProperty('border-radius', '14px', 'important');
        btn.style.setProperty('height', 'auto', 'important');
        btn.style.setProperty('min-height', '38px', 'important');
        btn.style.setProperty('padding', '10px 22px', 'important');
        btn.style.setProperty('font-size', '0.88rem', 'important');
        btn.style.setProperty('font-weight', '600', 'important');
      }
    });

    // B. Forzar estilo transparente en el input del buscador de foros (#search)
    const searchInput = document.querySelector('#page-header .forumsearch input#search, .forumsearch input#search');
    if (searchInput) {
      if (!searchInput.placeholder) {
        searchInput.placeholder = 'Buscar en los foros...';
      }
      searchInput.style.setProperty('background', 'transparent', 'important');
      searchInput.style.setProperty('background-color', 'transparent', 'important');
      searchInput.style.setProperty('background-image', 'none', 'important');
      searchInput.style.setProperty('border', 'none', 'important');
      searchInput.style.setProperty('box-shadow', 'none', 'important');
      searchInput.style.setProperty('color', '#ffffff', 'important');
      searchInput.style.setProperty('height', '32px', 'important');
      searchInput.style.setProperty('min-height', '32px', 'important');
      searchInput.style.setProperty('padding', '0 6px', 'important');
      searchInput.style.setProperty('margin', '0', 'important');
    }
  }

  // C. Mejorar tarjetas de descripción de Foros (#intro .no-overflow): convertir URLs en enlaces clicables
  const isForumPage = document.body.classList.contains('path-mod-forum') ||
                      window.location.pathname.includes('/mod/forum/');
  const forumIntro = document.querySelector('#region-main #intro.box.generalbox .no-overflow, #region-main #intro .no-overflow');
  if (isForumPage && forumIntro && !forumIntro.dataset.unalmEnhanced) {
    forumIntro.dataset.unalmEnhanced = 'true';

    forumIntro.querySelectorAll('p').forEach((p) => {
      if (!p.textContent.trim() && !p.querySelector('img, video, iframe, a')) {
        p.style.display = 'none';
      }
    });

    const walker = document.createTreeWalker(forumIntro, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      if (currentNode.parentElement && !currentNode.parentElement.closest('a')) {
        if (/https?:\/\/[^\s<>"']+/i.test(currentNode.nodeValue)) {
          textNodes.push(currentNode);
        }
      }
    }

    textNodes.forEach((node) => {
      const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
      const parts = node.nodeValue.split(urlRegex);
      if (parts.length <= 1) return;

      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (/^https?:\/\/[^\s<>"']+$/i.test(part)) {
          const a = document.createElement('a');
          a.href = part;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'unalm-forum-link-pill';
          const isPdf = /\.pdf($|\?|#)/i.test(part);
          appendSvg(
            a,
            isPdf
              ? SVG_ICONS.filePdf
              : '<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
          );
          const span = document.createElement('span');
          span.textContent = part;
          a.appendChild(span);
          frag.appendChild(a);
        } else if (part) {
          frag.appendChild(document.createTextNode(part));
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  // D. Modernizar Tabla de Debates del Foro (forumheaderlist) y Posts (.forumpost)
  if (isForumPage) {
    modernizarTablaYPostsForo();
  }
}

function obtenerPaletaIniciales(nombre) {
  const paletas = [
    { bg: 'rgba(31, 157, 119, 0.28)', border: 'rgba(127, 232, 200, 0.45)', color: '#7fe8c8' },
    { bg: 'rgba(14, 165, 233, 0.24)', border: 'rgba(125, 211, 252, 0.42)', color: '#7dd3fc' },
    { bg: 'rgba(168, 85, 247, 0.24)', border: 'rgba(216, 180, 254, 0.42)', color: '#d8b4fe' },
    { bg: 'rgba(245, 158, 11, 0.22)', border: 'rgba(252, 211, 77, 0.4)', color: '#fcd34d' },
    { bg: 'rgba(20, 184, 166, 0.26)', border: 'rgba(94, 234, 212, 0.44)', color: '#5eead4' }
  ];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  }
  return paletas[hash % paletas.length];
}

function obtenerInicialesNombre(nombre) {
  const clean = (nombre || 'US').replace(/\s+/g, ' ').trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length === 0) return 'US';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mejorarAvatarForo(pictureContainer, authorName) {
  if (!pictureContainer) return;
  const img = pictureContainer.querySelector('img.userpicture, img');
  if (!img) return;

  const imgSrc = img.getAttribute('src') || '';
  const isDefaultPic =
    img.classList.contains('defaultuserpic') ||
    imgSrc.includes('/u/f2') ||
    imgSrc.includes('/u/f1');

  if (isDefaultPic) {
    img.style.setProperty('display', 'none', 'important');
    const holder = img.closest('a') || pictureContainer;
    if (!holder.querySelector('.unalm-forum-avatar-initials')) {
      const palette = obtenerPaletaIniciales(authorName);
      const initials = obtenerInicialesNombre(authorName);
      const badge = document.createElement('span');
      badge.className = 'unalm-forum-avatar-initials';
      badge.textContent = initials;
      badge.style.setProperty('background', palette.bg, 'important');
      badge.style.setProperty('border', `1.5px solid ${palette.border}`, 'important');
      badge.style.setProperty('color', palette.color, 'important');
      holder.appendChild(badge);
    }
  } else {
    img.style.setProperty('width', '34px', 'important');
    img.style.setProperty('height', '34px', 'important');
    img.style.setProperty('min-width', '34px', 'important');
    img.style.setProperty('border-radius', '50%', 'important');
    img.style.setProperty('object-fit', 'cover', 'important');
    img.style.setProperty('border', '1.5px solid rgba(127, 232, 200, 0.45)', 'important');
    img.style.setProperty('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.35)', 'important');
  }
}

function actualizarBotonSuscripcionForo(subToggle) {
  if (!subToggle) return;
  const subImg = subToggle.querySelector('img');
  const imgSrc = subImg ? (subImg.getAttribute('src') || '').toLowerCase() : '';
  const titleAttr = (subToggle.getAttribute('title') || '').toLowerCase();
  const isSubscribed =
    (imgSrc.includes('subscribed') && !imgSrc.includes('unsubscribed')) ||
    titleAttr.includes('cancelar la suscripción') ||
    titleAttr.includes('está suscrito');

  if (subImg && subImg.style.display !== 'none') {
    subImg.style.setProperty('display', 'none', 'important');
  }

  const prevState = subToggle.dataset.unalmSubState;
  const nextState = isSubscribed ? '1' : '0';
  if (prevState !== nextState) {
    subToggle.dataset.unalmSubState = nextState;
    subToggle.classList.toggle('is-subscribed', isSubscribed);
    subToggle.style.setProperty('display', 'inline-flex', 'important');
    subToggle.style.setProperty('align-items', 'center', 'important');
    subToggle.style.setProperty('justify-content', 'center', 'important');
    subToggle.style.setProperty('width', '34px', 'important');
    subToggle.style.setProperty('height', '34px', 'important');
    subToggle.style.setProperty('border-radius', '11px', 'important');
    subToggle.style.setProperty('text-decoration', 'none', 'important');

    if (isSubscribed) {
      subToggle.style.setProperty('background', 'rgba(31, 157, 119, 0.28)', 'important');
      subToggle.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.55)', 'important');
      subToggle.style.setProperty('color', '#7fe8c8', 'important');
    } else {
      subToggle.style.setProperty('background', 'rgba(255, 255, 255, 0.05)', 'important');
      subToggle.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.12)', 'important');
      subToggle.style.setProperty('color', '#94a3b8', 'important');
    }
  }

  let svgEl = subToggle.querySelector('.unalm-forum-sub-svg');
  if (!svgEl) {
    appendSvg(
      subToggle,
      `<svg class="unalm-forum-sub-svg" width="15" height="15" viewBox="0 0 24 24" fill="${isSubscribed ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`
    );
  } else {
    const desiredFill = isSubscribed ? 'currentColor' : 'none';
    if (svgEl.getAttribute('fill') !== desiredFill) {
      svgEl.setAttribute('fill', desiredFill);
    }
  }
}

function modernizarTablaYPostsForo() {
  // 1. Tabla de debates (table.forumheaderlist)
  document.querySelectorAll('table.forumheaderlist').forEach((table) => {
    table.classList.add('unalm-transformed');

    if (!table.parentElement?.classList.contains('unalm-forum-list-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'unalm-forum-list-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }

    table.style.setProperty('width', '100%', 'important');
    table.style.setProperty('border-collapse', 'collapse', 'important');
    table.style.setProperty('border-spacing', '0', 'important');
    table.style.setProperty('background', 'transparent', 'important');
    table.style.setProperty('border', 'none', 'important');
    table.style.setProperty('margin', '0', 'important');

    table.querySelectorAll('thead th.header').forEach((th) => {
      th.style.setProperty('background', 'rgba(255, 255, 255, 0.045)', 'important');
      th.style.setProperty('background-color', 'rgba(255, 255, 255, 0.045)', 'important');
      th.style.setProperty('color', '#7fe8c8', 'important');
      th.style.setProperty('border', 'none', 'important');
      th.style.setProperty('border-bottom', '1px solid rgba(255, 255, 255, 0.12)', 'important');
      th.style.setProperty('border-radius', '0', 'important');
      th.style.setProperty('padding', '14px 14px', 'important');
      if (th.classList.contains('topic') || th.classList.contains('author')) {
        th.style.setProperty('text-align', 'left', 'important');
      } else if (th.classList.contains('lastpost')) {
        th.style.setProperty('text-align', 'right', 'important');
      } else {
        th.style.setProperty('text-align', 'center', 'important');
      }
    });

    table.querySelectorAll('tbody tr.discussion').forEach((row) => {
      row.querySelectorAll('td').forEach((td) => {
        td.style.setProperty('background', 'rgba(255, 255, 255, 0.012)', 'important');
        td.style.setProperty('background-color', 'rgba(255, 255, 255, 0.012)', 'important');
        td.style.setProperty('background-image', 'none', 'important');
        td.style.setProperty('color', '#e2e8f0', 'important');
        td.style.setProperty('border', 'none', 'important');
        td.style.setProperty('border-bottom', '1px solid rgba(255, 255, 255, 0.06)', 'important');
        td.style.setProperty('border-radius', '0', 'important');
        td.style.setProperty('padding', '13px 14px', 'important');
        td.style.setProperty('vertical-align', 'middle', 'important');
      });

      if (!row.dataset.unalmHoverBound) {
        row.dataset.unalmHoverBound = '1';
        row.addEventListener('mouseenter', () => {
          row.querySelectorAll('td').forEach((c) => {
            c.style.setProperty('background', 'rgba(31, 157, 119, 0.13)', 'important');
            c.style.setProperty('background-color', 'rgba(31, 157, 119, 0.13)', 'important');
          });
        });
        row.addEventListener('mouseleave', () => {
          row.querySelectorAll('td').forEach((c) => {
            c.style.setProperty('background', 'rgba(255, 255, 255, 0.012)', 'important');
            c.style.setProperty('background-color', 'rgba(255, 255, 255, 0.012)', 'important');
          });
        });
      }

      // Columna Tema (Debate)
      const topicLink = row.querySelector('td.topic.starter a');
      if (topicLink) {
        topicLink.style.setProperty('display', 'inline-flex', 'important');
        topicLink.style.setProperty('align-items', 'center', 'important');
        topicLink.style.setProperty('gap', '10px', 'important');
        topicLink.style.setProperty('color', '#f8fafc', 'important');
        topicLink.style.setProperty('font-size', '0.9rem', 'important');
        topicLink.style.setProperty('font-weight', '600', 'important');
        topicLink.style.setProperty('text-decoration', 'none', 'important');
        if (!topicLink.querySelector('.unalm-forum-topic-icon')) {
          const topicIcon = crearEl('span', 'unalm-forum-topic-icon');
          appendSvg(topicIcon, SVG_ICONS.forum);
          topicLink.prepend(topicIcon);
        }
      }

      // Columna Comenzado por (Avatar + Nombre)
      const authorTd = row.querySelector('td.author');
      if (authorTd) {
        const pic = authorTd.querySelector('.picture');
        const nameEl = authorTd.querySelector('.name');
        const authorName = nameEl ? nameEl.textContent.trim() : 'Usuario';

        if (pic && nameEl && !authorTd.querySelector('.unalm-forum-author-wrap')) {
          const flexWrap = document.createElement('div');
          flexWrap.className = 'unalm-forum-author-wrap';
          flexWrap.appendChild(pic);
          flexWrap.appendChild(nameEl);
          authorTd.appendChild(flexWrap);
        }

        mejorarAvatarForo(pic, authorName);

        const authorLink = authorTd.querySelector('.name a');
        if (authorLink) {
          authorLink.style.setProperty('color', '#e2e8f0', 'important');
          authorLink.style.setProperty('font-size', '0.83rem', 'important');
          authorLink.style.setProperty('font-weight', '500', 'important');
          authorLink.style.setProperty('text-decoration', 'none', 'important');
        }
      }

      // Columna Réplicas como píldora
      const repliesLink = row.querySelector('td.replies a');
      if (repliesLink) {
        const count = parseInt(repliesLink.textContent.trim(), 10) || 0;
        repliesLink.style.setProperty('display', 'inline-flex', 'important');
        repliesLink.style.setProperty('align-items', 'center', 'important');
        repliesLink.style.setProperty('justify-content', 'center', 'important');
        repliesLink.style.setProperty('min-width', '30px', 'important');
        repliesLink.style.setProperty('height', '26px', 'important');
        repliesLink.style.setProperty('padding', '0 10px', 'important');
        repliesLink.style.setProperty('border-radius', '999px', 'important');
        repliesLink.style.setProperty('font-size', '0.78rem', 'important');
        repliesLink.style.setProperty('font-weight', '600', 'important');
        repliesLink.style.setProperty('text-decoration', 'none', 'important');

        if (count > 0) {
          repliesLink.classList.add('has-replies');
          repliesLink.style.setProperty('background', 'rgba(31, 157, 119, 0.24)', 'important');
          repliesLink.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.45)', 'important');
          repliesLink.style.setProperty('color', '#7fe8c8', 'important');
        } else {
          repliesLink.style.setProperty('background', 'rgba(255, 255, 255, 0.06)', 'important');
          repliesLink.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.12)', 'important');
          repliesLink.style.setProperty('color', '#cbd5e1', 'important');
        }
      }

      // Columna Último mensaje (Adiós azul Moodle)
      const lastpostTd = row.querySelector('td.lastpost');
      if (lastpostTd) {
        lastpostTd.style.setProperty('text-align', 'right', 'important');
        const lpLinks = lastpostTd.querySelectorAll('a');
        if (lpLinks[0]) {
          lpLinks[0].style.setProperty('color', '#cbd5e1', 'important');
          lpLinks[0].style.setProperty('font-size', '0.8rem', 'important');
          lpLinks[0].style.setProperty('font-weight', '500', 'important');
          lpLinks[0].style.setProperty('text-decoration', 'none', 'important');
        }
        if (lpLinks[1]) {
          lpLinks[1].style.setProperty('color', '#7fe8c8', 'important');
          lpLinks[1].style.setProperty('font-size', '0.73rem', 'important');
          lpLinks[1].style.setProperty('font-weight', '500', 'important');
          lpLinks[1].style.setProperty('text-decoration', 'none', 'important');
        }
      }

      // Botón Suscripción a discusión (campanita Liquid Glass)
      const subToggle = row.querySelector('td.discussionsubscription a.discussiontoggle');
      if (subToggle) {
        actualizarBotonSuscripcionForo(subToggle);
      }
    });

    // Observar cambios AJAX de YUI al hacer clic en suscribirse/desuscribirse
    if (!table.dataset.unalmSubObserved) {
      table.dataset.unalmSubObserved = '1';
      const subObserver = new MutationObserver(() => {
        table.querySelectorAll('td.discussionsubscription a.discussiontoggle').forEach((toggle) => {
          actualizarBotonSuscripcionForo(toggle);
        });
      });
      subObserver.observe(table, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class', 'title'] });
    }
  });

  // 2. Publicaciones y comentarios dentro de hilos (.forumpost)
  document.querySelectorAll('.forumpost').forEach((post) => {
    post.style.setProperty('background', 'linear-gradient(155deg, rgba(16, 25, 23, 0.88) 0%, rgba(9, 15, 13, 0.94) 100%)', 'important');
    post.style.setProperty('background-color', 'rgba(12, 20, 18, 0.9)', 'important');
    post.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
    post.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.25)', 'important');
    post.style.setProperty('border-radius', '22px', 'important');
    post.style.setProperty('padding', '18px 22px', 'important');
    post.style.setProperty('color', '#e2e8f0', 'important');

    const picCell = post.querySelector('.picture');
    const authorText = post.querySelector('.author a')?.textContent.trim() || 'Usuario';
    mejorarAvatarForo(picCell, authorText);

    const subj = post.querySelector('.subject');
    if (subj) subj.style.setProperty('color', '#ffffff', 'important');

    post.querySelectorAll('.author a').forEach((a) => {
      a.style.setProperty('color', '#7fe8c8', 'important');
      a.style.setProperty('text-decoration', 'none', 'important');
    });

    post.querySelectorAll('.options .commands a, .options .link a').forEach((cmd) => {
      cmd.style.setProperty('background', 'rgba(255, 255, 255, 0.06)', 'important');
      cmd.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.12)', 'important');
      cmd.style.setProperty('border-radius', '10px', 'important');
      cmd.style.setProperty('color', '#cbd5e1', 'important');
      cmd.style.setProperty('padding', '6px 12px', 'important');
      cmd.style.setProperty('text-decoration', 'none', 'important');
    });
  });
}

// ============================================================
// 9. MODERNIZAR EDITOR DE ENTREGA (.filemanager, .mform y YUI)
// Elimina caja blanca de botones, diseño comprimido y fondo blanco
// ============================================================
function obtenerIconoArchivoEditor(filename) {
  const name = (filename || '').toLowerCase();
  if (/\.pdf$/.test(name)) {
    return { svg: SVG_ICONS.filePdf, bg: 'rgba(239, 68, 68, 0.18)', color: '#f87171', border: 'rgba(239, 68, 68, 0.35)' };
  }
  if (/\.(xlsx?|csv|ods)$/.test(name)) {
    return { svg: SVG_ICONS.spreadsheet, bg: 'rgba(16, 185, 129, 0.18)', color: '#34d399', border: 'rgba(16, 185, 129, 0.35)' };
  }
  if (/\.(pptx?|ppsx?|odp)$/.test(name)) {
    return { svg: SVG_ICONS.presentation, bg: 'rgba(249, 115, 22, 0.18)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.35)' };
  }
  if (/\.(docx?|odt|rtf)$/.test(name)) {
    return { svg: SVG_ICONS.fileWord, bg: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.35)' };
  }
  if (/\.(pl|pro|py|r|rmd|sql|java|cpp|c|cs|js|ts|html|css|sh|ipynb|json|xml)$/.test(name)) {
    return { svg: SVG_ICONS.fileCode, bg: 'rgba(20, 184, 166, 0.18)', color: '#2dd4bf', border: 'rgba(20, 184, 166, 0.35)' };
  }
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) {
    return { svg: SVG_ICONS.fileArchive, bg: 'rgba(168, 85, 247, 0.18)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' };
  }
  if (/\.(mp3|wav|ogg|m4a)$/.test(name)) {
    return { svg: SVG_ICONS.fileAudio, bg: 'rgba(244, 63, 94, 0.18)', color: '#fb7185', border: 'rgba(244, 63, 94, 0.35)' };
  }
  if (/\.(mp4|mkv|webm|avi|mov)$/.test(name)) {
    return { svg: SVG_ICONS.video, bg: 'rgba(14, 165, 233, 0.18)', color: '#38bdf8', border: 'rgba(14, 165, 233, 0.35)' };
  }
  return { svg: SVG_ICONS.fileGeneric, bg: 'rgba(148, 163, 184, 0.18)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.35)' };
}

function aplicarForzadoEditorEntrega() {
  const editBox = document.querySelector('.editsubmissionform');
  const filemanagers = document.querySelectorAll('.filemanager');
  if (!editBox && filemanagers.length === 0) return;

  // 1. Limpiar fondos blancos heredados en formulario mform y contenedor de botones
  document.querySelectorAll('.editsubmissionform, .mform, .mform fieldset, .mform .fitem, .mform .fitemtitle, .mform .felement, #fgroup_id_buttonar, .mform .fitem_actionbuttons, .form-actions').forEach((el) => {
    if (el.classList.contains('editsubmissionform')) {
      el.style.setProperty('background', 'linear-gradient(155deg, rgba(18, 26, 24, 0.86) 0%, rgba(10, 16, 15, 0.94) 100%)', 'important');
      el.style.setProperty('background-color', 'rgba(14, 22, 20, 0.9)', 'important');
      el.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.09)', 'important');
      el.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.24)', 'important');
      el.style.setProperty('border-radius', '24px', 'important');
      el.style.setProperty('padding', '24px 28px', 'important');
      el.style.setProperty('box-shadow', '0 22px 54px rgba(0, 0, 0, 0.58)', 'important');
    } else {
      el.style.setProperty('background', 'transparent', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('box-shadow', 'none', 'important');
      if (el.id !== 'fgroup_id_buttonar' && !el.classList.contains('fitem_actionbuttons')) {
        el.style.setProperty('border', 'none', 'important');
      }
    }
  });

  // 2. Evitar que .fitemtitle aplaste al FileManager hacia la derecha
  document.querySelectorAll('.mform .fitem_ffilemanager').forEach((row) => {
    row.style.setProperty('display', 'flex', 'important');
    row.style.setProperty('flex-direction', 'column', 'important');
    row.style.setProperty('gap', '10px', 'important');
    row.style.setProperty('width', '100%', 'important');
    const titleEl = row.querySelector('.fitemtitle');
    if (titleEl) {
      titleEl.style.setProperty('float', 'none', 'important');
      titleEl.style.setProperty('width', '100%', 'important');
      titleEl.style.setProperty('text-align', 'left', 'important');
      titleEl.style.setProperty('margin', '0', 'important');
      titleEl.style.setProperty('padding', '0', 'important');
    }
    const elemEl = row.querySelector('.felement.ffilemanager');
    if (elemEl) {
      elemEl.style.setProperty('float', 'none', 'important');
      elemEl.style.setProperty('width', '100%', 'important');
      elemEl.style.setProperty('margin-left', '0', 'important');
      elemEl.style.setProperty('padding', '0', 'important');
    }
  });

  // 3. Centrar botones inferiores sin caja blanca
  const btnGroup = document.querySelector('#fgroup_id_buttonar .felement.fgroup, .mform .fitem_actionbuttons .felement.fgroup');
  if (btnGroup) {
    btnGroup.style.setProperty('float', 'none', 'important');
    btnGroup.style.setProperty('margin-left', '0', 'important');
    btnGroup.style.setProperty('width', '100%', 'important');
    btnGroup.style.setProperty('display', 'flex', 'important');
    btnGroup.style.setProperty('flex-wrap', 'wrap', 'important');
    btnGroup.style.setProperty('justify-content', 'center', 'important');
    btnGroup.style.setProperty('gap', '12px', 'important');
  }

  // 4. Forzar apariencia oscura Liquid Glass en cada .filemanager
  filemanagers.forEach((fm) => {
    const navbar = fm.querySelector('.fp-navbar');
    if (navbar) {
      navbar.style.setProperty('background', 'rgba(255, 255, 255, 0.04)', 'important');
      navbar.style.setProperty('background-color', 'rgba(255, 255, 255, 0.04)', 'important');
      navbar.style.setProperty('background-image', 'none', 'important');
      navbar.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
      navbar.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.22)', 'important');
      navbar.style.setProperty('border-radius', '18px 18px 0 0', 'important');
    }

    // Limpiar fondos blancos de los contenedores de toolbar/viewbar
    fm.querySelectorAll('.filemanager-toolbar, .fp-toolbar, .fp-toolbar > div, .fp-viewbar').forEach((wrap) => {
      wrap.style.setProperty('background', 'transparent', 'important');
      wrap.style.setProperty('background-color', 'transparent', 'important');
      wrap.style.setProperty('background-image', 'none', 'important');
      wrap.style.setProperty('border', 'none', 'important');
      wrap.style.setProperty('box-shadow', 'none', 'important');
    });

    // Forzar estilo Liquid Glass en cada botoncito de acción y cambio de vista
    const toolbarSvgs = {
      add: '<svg class="unalm-fm-tb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
      mkdir: '<svg class="unalm-fm-tb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
      download: '<svg class="unalm-fm-tb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
      icons: '<svg class="unalm-fm-tb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
      details: '<svg class="unalm-fm-tb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
      tree: '<svg class="unalm-fm-tb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 10h6"/><path d="M10 10v6h7"/></svg>'
    };

    fm.querySelectorAll('.fp-toolbar a, .fp-viewbar a').forEach((tbBtn) => {
      const isChecked = tbBtn.classList.contains('checked');
      tbBtn.style.setProperty('display', 'inline-flex', 'important');
      tbBtn.style.setProperty('align-items', 'center', 'important');
      tbBtn.style.setProperty('justify-content', 'center', 'important');
      tbBtn.style.setProperty('width', '36px', 'important');
      tbBtn.style.setProperty('height', '34px', 'important');
      tbBtn.style.setProperty('padding', '0', 'important');
      tbBtn.style.setProperty('margin', '0', 'important');
      tbBtn.style.setProperty('border-radius', '10px', 'important');
      tbBtn.style.setProperty('background-image', 'none', 'important');
      tbBtn.style.setProperty('box-shadow', isChecked ? '0 0 12px rgba(31, 157, 119, 0.3)' : 'none', 'important');

      if (isChecked) {
        tbBtn.style.setProperty('background', 'rgba(31, 157, 119, 0.36)', 'important');
        tbBtn.style.setProperty('background-color', 'rgba(31, 157, 119, 0.36)', 'important');
        tbBtn.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.65)', 'important');
        tbBtn.style.setProperty('color', '#7fe8c8', 'important');
      } else {
        tbBtn.style.setProperty('background', 'rgba(255, 255, 255, 0.08)', 'important');
        tbBtn.style.setProperty('background-color', 'rgba(255, 255, 255, 0.08)', 'important');
        tbBtn.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.16)', 'important');
        tbBtn.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.28)', 'important');
        tbBtn.style.setProperty('color', '#e2e8f0', 'important');
      }

      const oldImg = tbBtn.querySelector('img');
      if (oldImg) oldImg.style.setProperty('display', 'none', 'important');

      if (!tbBtn.querySelector('.unalm-fm-tb-svg')) {
        let svgMarkup = toolbarSvgs.icons;
        if (tbBtn.closest('.fp-btn-add')) svgMarkup = toolbarSvgs.add;
        else if (tbBtn.closest('.fp-btn-mkdir')) svgMarkup = toolbarSvgs.mkdir;
        else if (tbBtn.closest('.fp-btn-download')) svgMarkup = toolbarSvgs.download;
        else if (tbBtn.classList.contains('fp-vb-details')) svgMarkup = toolbarSvgs.details;
        else if (tbBtn.classList.contains('fp-vb-tree')) svgMarkup = toolbarSvgs.tree;
        appendSvg(tbBtn, svgMarkup);
      }
    });

    const container = fm.querySelector('.filemanager-container');
    if (container) {
      container.style.setProperty('background', 'rgba(7, 13, 11, 0.62)', 'important');
      container.style.setProperty('background-color', 'rgba(7, 13, 11, 0.62)', 'important');
      container.style.setProperty('background-image', 'none', 'important');
      container.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
      container.style.setProperty('border-top', 'none', 'important');
      container.style.setProperty('border-radius', '0 0 18px 18px', 'important');
    }

    const fpContent = fm.querySelector('.fp-content');
    if (fpContent) {
      fpContent.style.setProperty('background', 'transparent', 'important');
      fpContent.style.setProperty('background-color', 'transparent', 'important');
      fpContent.style.setProperty('border', 'none', 'important');
    }

    const pathbar = fm.querySelector('.fp-pathbar');
    if (pathbar) {
      pathbar.style.setProperty('background', 'rgba(0, 0, 0, 0.26)', 'important');
      pathbar.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.07)', 'important');
      pathbar.style.setProperty('border-radius', '10px', 'important');
    }

    // Modernizar cada archivo en vista de iconos (.fp-file)
    fm.querySelectorAll('.fp-iconview .fp-file').forEach((fileCard) => {
      fileCard.style.setProperty('background', 'rgba(255, 255, 255, 0.04)', 'important');
      fileCard.style.setProperty('background-color', 'rgba(255, 255, 255, 0.04)', 'important');
      fileCard.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
      fileCard.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.22)', 'important');
      fileCard.style.setProperty('border-radius', '16px', 'important');

      const mainLink = fileCard.querySelector('a:first-child');
      if (mainLink) {
        mainLink.style.setProperty('display', 'flex', 'important');
        mainLink.style.setProperty('flex-direction', 'column', 'important');
        mainLink.style.setProperty('align-items', 'center', 'important');
        const thumbWrapper = mainLink.querySelector(':scope > div:first-child');
        if (thumbWrapper) {
          thumbWrapper.style.setProperty('position', 'relative', 'important');
          thumbWrapper.style.setProperty('height', 'auto', 'important');
          thumbWrapper.style.setProperty('order', '1', 'important');
        }
      }

      const nameField = fileCard.querySelector('.fp-filename-field');
      if (nameField) {
        nameField.style.setProperty('position', 'static', 'important');
        nameField.style.setProperty('order', '2', 'important');
        nameField.style.setProperty('margin-top', '8px', 'important');
        nameField.style.setProperty('background', 'transparent', 'important');
      }

      const nameEl = fileCard.querySelector('.fp-filename');
      const fileName = nameEl ? nameEl.textContent.trim() : '';
      if (nameEl) {
        nameEl.style.setProperty('background', 'transparent', 'important');
        nameEl.style.setProperty('color', '#f1f5f9', 'important');
      }

      const ctxBtn = fileCard.querySelector('.fp-contextmenu');
      if (ctxBtn) {
        const ctxImg = ctxBtn.querySelector('img');
        if (ctxImg) ctxImg.style.setProperty('display', 'none', 'important');
        if (!ctxBtn.querySelector('.unalm-fm-ctx-svg')) {
          appendSvg(
            ctxBtn,
            '<svg class="unalm-fm-ctx-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'
          );
        }
      }

      const thumb = fileCard.querySelector('.fp-thumbnail');
      if (thumb) {
        thumb.style.setProperty('position', 'static', 'important');
        thumb.style.setProperty('background', 'rgba(0, 0, 0, 0.28)', 'important');
        thumb.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.08)', 'important');
        thumb.style.setProperty('border-radius', '12px', 'important');
        thumb.style.setProperty('width', '96px', 'important');
        thumb.style.setProperty('height', '84px', 'important');

        const nativeImg = thumb.querySelector('img');
        const imgSrc = nativeImg ? (nativeImg.getAttribute('src') || '') : '';
        const isImageThumb = /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName) &&
                             !imgSrc.includes('/theme/image.php/') &&
                             !imgSrc.includes('-80.');

        if (!isImageThumb && !thumb.querySelector('.unalm-fm-svg-icon')) {
          if (nativeImg) nativeImg.style.setProperty('display', 'none', 'important');
          const iconMeta = obtenerIconoArchivoEditor(fileName);
          const badge = crearEl('div', 'unalm-fm-svg-icon');
          badge.style.background = iconMeta.bg;
          badge.style.color = iconMeta.color;
          badge.style.border = `1px solid ${iconMeta.border}`;
          appendSvg(badge, iconMeta.svg);
          thumb.appendChild(badge);
        }
      }
    });
  });

  // 5. Forzar estilo oscuro Liquid Glass en diálogos YUI de Moodle (Subir/Editar archivo)
  document.querySelectorAll('.moodle-dialogue-base .moodle-dialogue-wrap.moodle-dialogue-content').forEach((dlg) => {
    dlg.style.setProperty('background', 'linear-gradient(155deg, rgba(16, 26, 23, 0.96) 0%, rgba(9, 15, 13, 0.98) 100%)', 'important');
    dlg.style.setProperty('background-color', 'rgba(12, 20, 18, 0.96)', 'important');
    dlg.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.14)', 'important');
    dlg.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.3)', 'important');
    dlg.style.setProperty('border-radius', '22px', 'important');
    dlg.style.setProperty('color', '#f1f5f9', 'important');
  });
}

function modernizarEditorEntrega() {
  const isEditSubmission =
    document.body.id === 'page-mod-assign-editsubmission' ||
    !!document.querySelector('.editsubmissionform, .filemanager');

  if (!isEditSubmission) return;

  aplicarForzadoEditorEntrega();
  modernizarBotonesYForos();

  // Re-aplicar cuando YUI renderice archivos o abra ventanas modales de forma asíncrona
  if (!window.__unalmFileManagerObserver) {
    let rafPending = false;
    window.__unalmFileManagerObserver = new MutationObserver(() => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        aplicarForzadoEditorEntrega();
        modernizarBotonesYForos();
      });
    });
    window.__unalmFileManagerObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// ============================================================
// 10. MODERNIZAR CALIFICACIONES Y BLOQUE ADMINISTRACIÓN
//     - Elimina ola blanca y rectángulo blanco de #inst25 (.block_settings)
//     - Evita choque del navbar superior al hacer scroll
//     - Transforma pestañas (.nav-tabs) y tablas (user-grade / overview-grade)
//       forzando estilos inline con !important
// ============================================================
function obtenerBadgeIconoCalificacion(altOrSrc) {
  const s = (altOrSrc || '').toLowerCase();
  const badge = crearEl('span', 'unalm-grade-icon-badge');
  if (s.includes('folder') || s.includes('categor')) {
    badge.classList.add('icon-folder');
    appendSvg(badge, '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>');
    return badge;
  }
  if (s.includes('agg_mean') || s.includes('media')) {
    badge.classList.add('icon-mean');
    appendSvg(badge, '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 4 3 5-6"/></svg>');
    return badge;
  }
  if (s.includes('agg_sum') || s.includes('suma') || s.includes('agg')) {
    badge.classList.add('icon-sum');
    appendSvg(badge, '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6H6l6 6-6 6h12"/></svg>');
    return badge;
  }
  badge.classList.add('icon-item');
  appendSvg(badge, '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>');
  return badge;
}

function modernizarBloquesAdministracion() {
  document.querySelectorAll('.block_settings, #inst25').forEach((block) => {
    block.classList.add('unalm-glass-window');
    block.style.setProperty('background', 'linear-gradient(155deg, rgba(18, 25, 26, 0.78) 0%, rgba(10, 16, 15, 0.88) 100%)', 'important');
    block.style.setProperty('background-color', 'rgba(14, 21, 19, 0.84)', 'important');
    block.style.setProperty('background-image', 'none', 'important');
    block.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.12)', 'important');
    block.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.36)', 'important');
    block.style.setProperty('border-radius', '26px', 'important');
    block.style.setProperty('padding', '0', 'important');
    block.style.setProperty('overflow', 'hidden', 'important');

    const header = block.querySelector('.header');
    const titleEl = block.querySelector('.header h2');
    if (header) {
      header.style.setProperty('background', 'transparent', 'important');
      header.style.setProperty('background-color', 'transparent', 'important');
      header.style.setProperty('background-image', 'none', 'important');
      header.style.setProperty('border', 'none', 'important');
      header.style.setProperty('margin', '0', 'important');
      header.style.setProperty('padding', '0', 'important');

      const oldTitle = header.querySelector('.title');
      if (oldTitle) oldTitle.style.setProperty('display', 'none', 'important');

      if (!header.querySelector('.unalm-window-bar')) {
        const bar = crearEl('div', 'unalm-window-bar');
        bar.appendChild(crearWindowDots());

        const winTitle = crearEl('div', 'unalm-window-title');
        appendSvg(winTitle, '<svg class="unalm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>');
        winTitle.appendChild(crearEl('span', '', titleEl ? titleEl.textContent.trim() : 'Administración'));
        bar.appendChild(winTitle);

        const toggleBtn = crearEl('button', 'unalm-window-toggle');
        toggleBtn.type = 'button';
        toggleBtn.title = 'Minimizar / Expandir';
        toggleBtn.setAttribute('aria-label', 'Toggle administración');
        appendSvg(toggleBtn, SVG_ICONS.chevronDown);
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          block.classList.toggle('unalm-collapsed');
        });
        bar.appendChild(toggleBtn);
        header.prepend(bar);
      }
    }

    // Forzar limpieza de cualquier caja blanca en #settingsnav y nodos internos
    block.querySelectorAll('.content, #settingsnav, .block_tree_box, .block_tree, ul, li, p.tree_item').forEach((el) => {
      el.style.setProperty('background', 'transparent', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('border', 'none', 'important');
      el.style.setProperty('box-shadow', 'none', 'important');
    });

    const content = block.querySelector('.content');
    if (content) content.style.setProperty('padding', '16px', 'important');

    block.querySelectorAll('#settingsnav .root_node > span').forEach((secSpan) => {
      secSpan.classList.add('unalm-nav-section-title');
      secSpan.style.setProperty('color', '#7fe8c8', 'important');
      if (!secSpan.querySelector('.unalm-icon')) {
        prependSvg(secSpan, SVG_ICONS.layers);
      }
    });

    block.querySelectorAll('#settingsnav img.navicon').forEach((ic) => {
      ic.style.setProperty('display', 'none', 'important');
    });

    block.querySelectorAll('#settingsnav li p.tree_item a').forEach((link) => {
      const oldIcon = link.querySelector('img.icon, img.navicon');
      if (oldIcon) oldIcon.style.setProperty('display', 'none', 'important');

      const txt = link.textContent.trim().toLowerCase();
      const isActive = !!link.closest('.current_branch, .active_tree_node');

      link.style.setProperty('display', 'flex', 'important');
      link.style.setProperty('align-items', 'center', 'important');
      link.style.setProperty('gap', '10px', 'important');
      link.style.setProperty('padding', '10px 14px', 'important');
      link.style.setProperty('border-radius', '14px', 'important');
      link.style.setProperty('text-decoration', 'none', 'important');
      link.style.setProperty('font-size', '0.84rem', 'important');

      if (isActive) {
        link.style.setProperty('background', 'linear-gradient(135deg, rgba(31, 157, 119, 0.28) 0%, rgba(16, 94, 70, 0.34) 100%)', 'important');
        link.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.45)', 'important');
        link.style.setProperty('color', '#7fe8c8', 'important');
        link.style.setProperty('font-weight', '600', 'important');
      } else {
        link.style.setProperty('background', 'rgba(255, 255, 255, 0.04)', 'important');
        link.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.08)', 'important');
        link.style.setProperty('color', '#e2e8f0', 'important');
        link.style.setProperty('font-weight', '500', 'important');
      }

      if (!link.querySelector('.unalm-icon')) {
        let iconSvg = SVG_ICONS.fileGeneric;
        if (txt.includes('usuario')) iconSvg = SVG_ICONS.user;
        else if (txt.includes('informe')) iconSvg = SVG_ICONS.spreadsheet;
        else if (txt.includes('calificaci')) iconSvg = SVG_ICONS.sparkle;
        prependSvg(link, iconSvg);
      }
    });
  });
}

function modernizarCalificacionesYAdmin() {
  // 1. Fijar barra superior al tope del documento para evitar choque con el contenido al hacer scroll
  document.querySelectorAll('header.navbar, .navbar').forEach((nav) => {
    nav.style.setProperty('position', 'absolute', 'important');
    nav.style.setProperty('top', '0', 'important');
    nav.style.setProperty('left', '0', 'important');
    nav.style.setProperty('right', '0', 'important');
    nav.style.setProperty('background', 'transparent', 'important');
    nav.style.setProperty('background-image', 'none', 'important');
    nav.style.setProperty('border', 'none', 'important');
    nav.style.setProperty('box-shadow', 'none', 'important');
  });

  // 2. Transformar bloque lateral Administración (#inst25) en todas las vistas
  modernizarBloquesAdministracion();

  // 3. Pestañas de Calificaciones (.grade-navigation .nav-tabs y .nav-tabs en #region-main)
  document.querySelectorAll('.grade-navigation ul.nav.nav-tabs, #region-main ul.nav.nav-tabs').forEach((tabList) => {
    tabList.style.setProperty('display', 'inline-flex', 'important');
    tabList.style.setProperty('flex-wrap', 'wrap', 'important');
    tabList.style.setProperty('align-items', 'center', 'important');
    tabList.style.setProperty('gap', '6px', 'important');
    tabList.style.setProperty('padding', '5px', 'important');
    tabList.style.setProperty('margin', '0', 'important');
    tabList.style.setProperty('background', 'rgba(255, 255, 255, 0.04)', 'important');
    tabList.style.setProperty('background-color', 'rgba(255, 255, 255, 0.04)', 'important');
    tabList.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
    tabList.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.22)', 'important');
    tabList.style.setProperty('border-radius', '16px', 'important');

    tabList.querySelectorAll('li').forEach((li) => {
      li.style.setProperty('background', 'transparent', 'important');
      li.style.setProperty('border', 'none', 'important');
      li.style.setProperty('margin', '0', 'important');
      li.style.setProperty('float', 'none', 'important');

      const a = li.querySelector('a');
      if (!a) return;
      const isActive = li.classList.contains('active');
      a.style.setProperty('display', 'inline-flex', 'important');
      a.style.setProperty('align-items', 'center', 'important');
      a.style.setProperty('gap', '8px', 'important');
      a.style.setProperty('padding', '8px 18px', 'important');
      a.style.setProperty('border-radius', '12px', 'important');
      a.style.setProperty('text-decoration', 'none', 'important');
      a.style.setProperty('text-shadow', 'none', 'important');
      a.style.setProperty('background-image', 'none', 'important');

      if (isActive) {
        a.style.setProperty('background', 'linear-gradient(135deg, rgba(31, 157, 119, 0.92) 0%, rgba(16, 94, 70, 0.96) 100%)', 'important');
        a.style.setProperty('background-color', 'rgba(31, 157, 119, 0.92)', 'important');
        a.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.45)', 'important');
        a.style.setProperty('border-top', '1px solid rgba(127, 232, 200, 0.72)', 'important');
        a.style.setProperty('color', '#ffffff', 'important');
        a.style.setProperty('font-weight', '600', 'important');
      } else {
        a.style.setProperty('background', 'transparent', 'important');
        a.style.setProperty('background-color', 'transparent', 'important');
        a.style.setProperty('border', '1px solid transparent', 'important');
        a.style.setProperty('color', '#cbd5e1', 'important');
        a.style.setProperty('font-weight', '500', 'important');
      }

      if (!a.querySelector('.unalm-icon')) {
        const t = a.textContent.trim().toLowerCase();
        const tabSvg = t.includes('usuario') ? SVG_ICONS.user : SVG_ICONS.spreadsheet;
        prependSvg(a, tabSvg);
      }
    });
  });

  // 4. Tablas de calificaciones (table.user-grade / table.overview-grade)
  const gradeTables = document.querySelectorAll('table.user-grade, table.overview-grade');
  gradeTables.forEach((table) => {
    table.classList.add('unalm-transformed');

    // Envolver en contenedor Liquid Glass con scroll horizontal suave
    if (!table.parentElement?.classList.contains('unalm-grade-table-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'unalm-grade-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }

    table.style.setProperty('width', '100%', 'important');
    table.style.setProperty('border-collapse', 'collapse', 'important');
    table.style.setProperty('border-spacing', '0', 'important');
    table.style.setProperty('background', 'transparent', 'important');
    table.style.setProperty('border', 'none', 'important');
    table.style.setProperty('margin', '0', 'important');

    // Cabeceras thead th
    table.querySelectorAll('thead th').forEach((th) => {
      th.style.setProperty('background', 'rgba(255, 255, 255, 0.045)', 'important');
      th.style.setProperty('background-color', 'rgba(255, 255, 255, 0.045)', 'important');
      th.style.setProperty('color', '#7fe8c8', 'important');
      th.style.setProperty('border', 'none', 'important');
      th.style.setProperty('border-bottom', '1px solid rgba(255, 255, 255, 0.12)', 'important');
      th.style.setProperty('border-radius', '0', 'important');
      th.style.setProperty('padding', '14px 12px', 'important');
    });

    // Filas del cuerpo
    table.querySelectorAll('tbody tr').forEach((row) => {
      // Ocultar <tr> vacíos generados por Moodle
      if (row.children.length === 0 || row.textContent.trim() === '') {
        row.style.setProperty('display', 'none', 'important');
        return;
      }

      const itemTh = row.querySelector('th.column-itemname');
      const isCat = !!(itemTh && itemTh.id && itemTh.id.startsWith('cat_'));
      const isRootCat = isCat && itemTh.classList.contains('level1');
      const isBaggt = !!(itemTh && itemTh.classList.contains('baggt'));
      const isCourseTotal = isBaggt && (itemTh.classList.contains('level1') || itemTh.textContent.toLowerCase().includes('total del curso'));

      row.classList.remove('unalm-grade-root-row', 'unalm-grade-cat-row', 'unalm-grade-total-row', 'unalm-grade-course-total-row', 'unalm-grade-item-row');
      if (isRootCat) row.classList.add('unalm-grade-root-row');
      else if (isCat) row.classList.add('unalm-grade-cat-row');
      else if (isCourseTotal) row.classList.add('unalm-grade-course-total-row');
      else if (isBaggt) row.classList.add('unalm-grade-total-row');
      else row.classList.add('unalm-grade-item-row');

      // Neutralizar columnas separadoras td.column-leader para eliminar pilares grises/negros
      row.querySelectorAll('td.column-leader').forEach((leader) => {
        leader.style.setProperty('width', '14px', 'important');
        leader.style.setProperty('min-width', '14px', 'important');
        leader.style.setProperty('max-width', '16px', 'important');
        leader.style.setProperty('padding', '0', 'important');
        leader.style.setProperty('background', 'transparent', 'important');
        leader.style.setProperty('background-color', 'transparent', 'important');
        leader.style.setProperty('border', 'none', 'important');
        leader.style.setProperty('border-radius', '0', 'important');
        leader.style.setProperty('box-shadow', leader.classList.contains('level2') ? 'inset 2px 0 0 rgba(127, 232, 200, 0.16)' : 'none', 'important');
      });

      // Unificar celdas de datos (th + td no leader)
      row.querySelectorAll('th, td:not(.column-leader)').forEach((cell) => {
        cell.style.setProperty('border', 'none', 'important');
        cell.style.setProperty('border-radius', '0', 'important');
        cell.style.setProperty('box-shadow', 'none', 'important');
        cell.style.setProperty('background-image', 'none', 'important');

        if (isRootCat) {
          cell.style.setProperty('background', 'linear-gradient(90deg, rgba(31, 157, 119, 0.22) 0%, rgba(16, 86, 64, 0.14) 100%)', 'important');
          cell.style.setProperty('color', '#ffffff', 'important');
          cell.style.setProperty('padding', '13px 14px', 'important');
          cell.style.setProperty('border-bottom', '1px solid rgba(127, 232, 200, 0.22)', 'important');
        } else if (isCat) {
          cell.style.setProperty('background', 'rgba(255, 255, 255, 0.045)', 'important');
          cell.style.setProperty('color', '#7fe8c8', 'important');
          cell.style.setProperty('padding', '11px 14px', 'important');
          cell.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.08)', 'important');
          cell.style.setProperty('border-bottom', '1px solid rgba(255, 255, 255, 0.08)', 'important');
        } else if (isCourseTotal) {
          cell.style.setProperty('background', 'linear-gradient(90deg, rgba(31, 157, 119, 0.25) 0%, rgba(14, 74, 56, 0.3) 100%)', 'important');
          cell.style.setProperty('color', '#ffffff', 'important');
          cell.style.setProperty('padding', '13px 12px', 'important');
          cell.style.setProperty('border-top', '1px solid rgba(127, 232, 200, 0.35)', 'important');
        } else if (isBaggt) {
          cell.style.setProperty('background', 'rgba(15, 42, 33, 0.56)', 'important');
          cell.style.setProperty('background-color', 'rgba(15, 42, 33, 0.56)', 'important');
          cell.style.setProperty('color', '#ffffff', 'important');
          cell.style.setProperty('padding', '12px 12px', 'important');
          cell.style.setProperty('border-bottom', '1px solid rgba(127, 232, 200, 0.14)', 'important');
        } else {
          cell.style.setProperty('background', 'rgba(255, 255, 255, 0.014)', 'important');
          cell.style.setProperty('background-color', 'rgba(255, 255, 255, 0.014)', 'important');
          cell.style.setProperty('color', cell.tagName === 'TH' ? '#f8fafc' : '#e2e8f0', 'important');
          cell.style.setProperty('padding', '12px 12px', 'important');
          cell.style.setProperty('border-bottom', '1px solid rgba(255, 255, 255, 0.05)', 'important');
        }
      });

      if (!isRootCat && !isCat && !isCourseTotal && !isBaggt && !row.dataset.unalmHoverBound) {
        row.dataset.unalmHoverBound = '1';
        row.addEventListener('mouseenter', () => {
          row.querySelectorAll('th, td:not(.column-leader)').forEach((c) => {
            c.style.setProperty('background', 'rgba(31, 157, 119, 0.14)', 'important');
            c.style.setProperty('background-color', 'rgba(31, 157, 119, 0.14)', 'important');
          });
        });
        row.addEventListener('mouseleave', () => {
          row.querySelectorAll('th, td:not(.column-leader)').forEach((c) => {
            c.style.setProperty('background', 'rgba(255, 255, 255, 0.014)', 'important');
            c.style.setProperty('background-color', 'rgba(255, 255, 255, 0.014)', 'important');
          });
        });
      }

      // Reemplazar íconos nativos opacos por badges SVG limpios
      if (itemTh) {
        itemTh.querySelectorAll('img.itemicon, img.icon').forEach((img) => {
          if (img.dataset.unalmReplaced === '1') return;
          img.dataset.unalmReplaced = '1';
          img.style.setProperty('display', 'none', 'important');
          const hint = `${img.getAttribute('src') || ''} ${img.getAttribute('alt') || ''} ${img.getAttribute('title') || ''}`;
          img.after(obtenerBadgeIconoCalificacion(hint));
        });
      }

      // Mejorar lectura de "( Vacío )" en columna Peso calculado
      const weightCell = row.querySelector('td.column-weight');
      if (weightCell && !weightCell.querySelector('.unalm-grade-empty-tag') && weightCell.textContent.includes('Vacío')) {
        const cleanNum = weightCell.textContent.replace(/\(\s*Vacío\s*\)/i, '').trim();
        weightCell.replaceChildren(
          crearEl('span', '', cleanNum),
          document.createElement('br'),
          crearEl('span', 'unalm-grade-empty-tag', 'Vacío')
        );
      }

      // Badges visuales para notas y porcentajes
      row.querySelectorAll('td.column-grade, td.column-percentage, td.c1').forEach((valCell) => {
        if (valCell.querySelector('.unalm-grade-pill, .unalm-grade-muted')) return;
        const txt = valCell.textContent.trim();
        if (txt === '-' || txt === '') {
          if (txt === '-') valCell.replaceChildren(crearEl('span', 'unalm-grade-muted', '-'));
          return;
        }
        const isPct = txt.includes('%');
        const numeric = parseFloat(txt.replace('%', '').replace(',', '.').trim());
        if (!Number.isNaN(numeric)) {
          let cls = 'grade-low';
          if (isPct) {
            if (numeric >= 70) cls = 'grade-high';
            else if (numeric >= 52.5) cls = 'grade-mid';
          } else if (numeric >= 14) {
            cls = 'grade-high';
          } else if (numeric >= 10.5) {
            cls = 'grade-mid';
          }
          valCell.replaceChildren(crearEl('span', `unalm-grade-pill ${cls}`, txt));
        }
      });

      // Suavizar guiones simples en rango/peso/aporte
      row.querySelectorAll('td.column-weight, td.column-contributiontocoursetotal').forEach((cell) => {
        if (cell.textContent.trim() === '-' && !cell.querySelector('.unalm-grade-muted')) {
          cell.replaceChildren(crearEl('span', 'unalm-grade-muted', '-'));
        }
      });
    });
  });
}

// ============================================================
// 11. SELECTOR DE VISTA DE CURSOS EN PÁGINA PRINCIPAL
//     - Mantiene el modo Lista exactamente igual al diseño actual
//     - Agrega barra superior [Lista | Cuadrícula] + buscador + filtro
//     - En modo Cuadrícula muestra tarjetas en 3 columnas con portada,
//       código de curso, docente / múltiples aulas e íconos ★ e ⓘ
// ============================================================
function clasificarTemaCursoUnalm(nombre, codeText) {
  const norm = String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const rawCode = String(codeText || '').toUpperCase();
  const baseMatch = rawCode.match(/\b([A-Z]{2,3}\d{4})\b/);
  const baseCode = baseMatch ? baseMatch[1] : '';
  const prefixMatch = rawCode.match(/\b([A-Z]{2,3})/);
  const prefix = prefixMatch ? prefixMatch[1] : '';

  // 1. Mapeo directo por código UNALM para cursos transversales o con códigos específicos
  const codeOverrides = {
    VRI0001: 'humanities',
    CC1011: 'math', CC1032: 'math', CC2050: 'math', CC2051: 'math', CC2073: 'math',
    CC2076: 'math', CC3009: 'math', CC3010: 'math', CC3020: 'math', CC3106: 'math',
    CC3107: 'math', CC3108: 'math', CC3110: 'math', CC3111: 'math', CC4036: 'math',
    CC4046: 'math', CC4072: 'math', IA3061: 'math', IA3062: 'math', IA3068: 'math',
    EP2083: 'math', EP2084: 'math', EP3034: 'math', ZT2007: 'math',

    CC1017: 'chemistry', CC1020: 'chemistry', CC1031: 'chemistry', CC2004: 'chemistry',
    CC2033: 'chemistry', CC2041: 'chemistry', CC2075: 'chemistry', CC3022: 'chemistry',
    CC3027: 'chemistry', CC3070: 'chemistry', CC4004: 'chemistry', CC4011: 'chemistry',
    CC4012: 'chemistry', CC5007: 'chemistry', CC5019: 'chemistry', CC6007: 'chemistry',
    IA2020: 'chemistry', FR2009: 'chemistry', FR4081: 'chemistry', PQ2009: 'chemistry',
    AL2001: 'chemistry', AL3010: 'chemistry', ZT2006: 'chemistry',

    CC1030: 'physics', CC2017: 'physics', CC2018: 'physics', CC2027: 'physics',
    CC2037: 'physics', CC2074: 'physics', CC3025: 'physics', CC3090: 'physics',
    IA2021: 'physics', IA3000: 'physics', IA3002: 'physics', IA3020: 'physics',
    IA3026: 'physics', IA3031: 'physics', IA3063: 'physics', IA3072: 'physics',
    IA4012: 'physics', PQ2016: 'physics', AL2005: 'physics', AL4044: 'physics',

    CC3115: 'code', CC4079: 'code', CC4089: 'code', CC5065: 'code',
    EP1053: 'code', EP2025: 'code', EP3035: 'code', EP3036: 'code',
    EP3190: 'code', EP3198: 'code', EP4184: 'code', EP4188: 'code',
    EP4189: 'code', EP4190: 'code', EP4192: 'code', EP4202: 'code',
    EP4203: 'code', EP5120: 'code', EP5121: 'code', EP5123: 'code',
    IA4108: 'code', IA5024: 'code',

    FR2000: 'stats', AL4046: 'stats', CC4082: 'stats', ZT3034: 'stats',
    EP2081: 'stats', EP2085: 'stats', EP2091: 'stats', EP3010: 'stats',
    EP3041: 'stats', EP3042: 'stats', EP3071: 'stats', EP3168: 'stats',
    EP3170: 'stats', EP3191: 'stats', EP4041: 'stats', EP4065: 'stats',
    EP4066: 'stats', EP4068: 'stats', EP4146: 'stats', EP4150: 'stats',
    EP4154: 'stats', EP4156: 'stats', EP4178: 'stats', EP4181: 'stats',
    EP4183: 'stats', EP4185: 'stats', EP5001: 'stats', EP5029: 'stats',
    EP5117: 'stats', EP5124: 'stats', EP6003: 'stats',

    CC1038: 'meteo_geo', CC3001: 'meteo_geo', CC3011: 'meteo_geo', CC3040: 'meteo_geo',
    CC3046: 'meteo_geo', CC3047: 'meteo_geo', CC3049: 'meteo_geo', CC3056: 'meteo_geo',
    CC3098: 'meteo_geo', CC3112: 'meteo_geo', CC3116: 'meteo_geo', CC4016: 'meteo_geo',
    CC4021: 'meteo_geo', CC4027: 'meteo_geo', CC4063: 'meteo_geo', CC4069: 'meteo_geo',
    CC4070: 'meteo_geo', CC4071: 'meteo_geo', CC4073: 'meteo_geo', CC4074: 'meteo_geo',
    CC4075: 'meteo_geo', CC4076: 'meteo_geo', CC4080: 'meteo_geo', CC4081: 'meteo_geo',
    CC4083: 'meteo_geo', CC4084: 'meteo_geo', CC4085: 'meteo_geo', CC5013: 'meteo_geo',
    CC5030: 'meteo_geo', CC5044: 'meteo_geo', CC5056: 'meteo_geo', CC5057: 'meteo_geo',
    CC5058: 'meteo_geo', CC5063: 'meteo_geo', CC5064: 'meteo_geo', CC6023: 'meteo_geo',
    FR3040: 'meteo_geo', FR5000: 'meteo_geo', IA2006: 'meteo_geo', IA3065: 'meteo_geo',
    IA3069: 'meteo_geo', IA4094: 'meteo_geo', IA4104: 'meteo_geo', IA4110: 'meteo_geo',
    IA5051: 'meteo_geo', IA5090: 'meteo_geo',

    CC3103: 'water', CC3104: 'water', CC4034: 'water', CC4035: 'water',
    CC5000: 'water', CC5062: 'water', FR5013: 'water', FR6006: 'water',
    AL4045: 'water', AG4023: 'water',

    AG3005: 'entomo_fito', AG3017: 'entomo_fito', AG3028: 'entomo_fito',
    AG4007: 'entomo_fito', AG4014: 'entomo_fito', AG4080: 'entomo_fito',
    AG4137: 'entomo_fito', AG5003: 'entomo_fito', AG5006: 'entomo_fito',

    AL2008: 'economy', AL3024: 'economy', AL5034: 'economy', AL5035: 'economy',
    AL5036: 'economy', AL5037: 'economy', AL5048: 'economy',
    FR4008: 'economy', FR5047: 'economy', FR5065: 'economy',
    PQ2002: 'economy', PQ3028: 'economy', PQ4002: 'economy', PQ4042: 'economy',
    AG4020: 'economy', AG4141: 'economy', AG4142: 'economy', AG4143: 'economy',
    ZT3037: 'economy', ZT4088: 'economy', ZT5033: 'economy', IA6027: 'economy',

    EP1014: 'humanities', EP1027: 'humanities', EP1048: 'humanities', EP1049: 'humanities',
    EP1051: 'humanities', EP1052: 'humanities', EP2003: 'humanities', EP2008: 'humanities',
    EP2037: 'humanities', EP2086: 'humanities', EP2087: 'humanities', EP2088: 'humanities',
    EP3203: 'humanities', EP3211: 'humanities', EP4201: 'humanities',
    CC3117: 'humanities', AG4139: 'humanities', IA4095: 'humanities',
    EP1056: 'engineering_mach', EP2096: 'engineering_mach', IA5029: 'engineering_mach',
    EP3084: 'agro_soils', ZT4072: 'zootecnia', ZT4073: 'zootecnia',
    ZT3039: 'zootecnia', ZT4089: 'zootecnia', PQ3000: 'fishery', PQ4005: 'fishery',
    IA5095: 'environment',
    EP5022: 'environment', EP5111: 'environment', EP4053: 'environment', EP4048: 'environment'
  };

  if (baseCode && codeOverrides[baseCode]) {
    return codeOverrides[baseCode];
  }

  // 2. Reglas semánticas por palabras clave normalizadas (límites de palabra donde haya ambigüedad)
  if (/writewise|redaccion|lenguaje y comunicacion|oratoria|\betica\b|antropologia|sociedad y cultura|historia economica|teatro|danza|marinera|musica|guitarra|banda unalm|fotografia|dibujo y pintura|artes plasticas|capoeira|habilidades blandas/.test(norm)) {
    return 'humanities';
  }
  if (/aerobicos|aikido|ajedrez|beisbol|basquet|ciclismo|futbol|futsal|handball|judo|karate|taekwondo|tenis de mesa|tiro con arco|voley|educacion fisica|deporte/.test(norm)) {
    return 'sports';
  }
  if (/lenguaje de programacion|tecnicas de programacion|algoritmia|base de datos|ciencia de datos|ciencias de datos|inteligencia artificial|maquinas de aprendizaje|tecnologias emergentes|estadistica computacional|sistemas de informacion|bioinformatica|metodologia bim/.test(norm)) {
    return 'code';
  }
  if (/estadistic|probabilidad|regresion|muestreo|disenos experimentales|series de tiempo|multivariad|bayesiana|sobrevivencia|inferencia|exploracion de datos|estocastic|econometria|macroeconometria|modelos lineales|optimizacion/.test(norm)) {
    return 'stats';
  }
  if (/entomolog|fitopatolog|fitovirolog|plagas|apicultura|insectos|control biologico/.test(norm)) {
    return 'entomo_fito';
  }
  if (/quimica|bioquimica|enzimolog|fisicoquimica|fisico quimica|fitoquimica|ecotoxicologia|cinetica quimica/.test(norm)) {
    return 'chemistry';
  }
  if (/biologia|genetica|fitogenetica|microbiolog|botanica|zoologia|fisiologia|celula|tejidos|angiospermas|cordados|morfogenesis|evolucion|biotecnologia|microbiano/.test(norm)) {
    return 'biology';
  }
  if (/hidric|hidraul|hidrolog|hidrogeolog|hidrometeorolog|riego|drenaje|presas|cuencas|aguas|agua residual|abastecimiento de agua|alcantarillado|mecanica de fluidos/.test(norm)) {
    return 'water';
  }
  if (/meteorolog|climatolog|clima|climatic|atmosfera|teledeteccion|geomatica|informacion geografica|topografia|geodesia|fotogrametria|drones|ordenamiento territorial|geografia/.test(norm)) {
    return 'meteo_geo';
  }
  if (/pesquer|pesca|acuicola|acuicultura|hidrobiolog|limnologia|oceanografia|crustaceos|peces|tilapia|marinos|surimi|embarcaciones|navegacion|bentonicos|organismos acuaticos/.test(norm)) {
    return 'fishery';
  }
  if (/zootecnia|animal|ganad|vacuno|porcino|ovino|caprino|cuyes|equino|pollos|pavos|patos|camelidos|rumiantes|pecuario|pecuaria|pastizales|inseminacion|embriones|ultrasonografia|patologia animal|cirugia|farmacologia|etologia|enfermedades infecciosas|enfermedades parasitarias|pastoreo|fibras y pieles/.test(norm)) {
    return 'zootecnia';
  }
  if (/forestal|silvicult|dendrolog|madera|maderable|aserrado|muebles|arboricult|etnobotanica|agroforesteria|fauna silvestre|areas naturales|parques nacionales|areas verdes|revegetacion|ecoturismo/.test(norm)) {
    return 'forestry';
  }
  if (/aliment|lacteas|carnicas|fermentaciones|frutas y hortalizas|aceites y grasas|envases y embalajes|reologia|poscosecha|post cosecha|alcoholes|nutraceuticos|leguminosas y cereales|tecnologias de conservacion|extraccion|inocuidad|evaluacion sensorial|seguridad alimentaria/.test(norm)) {
    return 'food';
  }
  if (/agronom|agrotecn|agroecolog|cultivos|horticult|fruticult|olericult|floricult|viticult|viveros|paisajista|semillas|malezas|forraj|algodonero|arroz|cana de azucar|cereales|leguminosas|maiz|oleaginosas|tuberosas|propaga|suelo|edafolog|fertilidad|geologia|salinidad|erosion|agricultura|agraria|agrarios|agropecuar/.test(norm)) {
    return 'agro_soils';
  }
  if (/ambiental|ecologia|ecosistema|biorremediacion|ciudades sostenibles|residuos|recursos naturales|soluciones basadas en la naturaleza|seguridad y salud ocupacional/.test(norm)) {
    return 'environment';
  }
  if (/matematica|calculo|algebra|ecuaciones diferenciales|geometria|metodos numericos|investigacion de operaciones/.test(norm)) {
    return 'math';
  }
  if (/fisica|mecanica|termodinamica|electronica|circuitos|transferencia de calor|fenomenos de transferencia|instrumentacion/.test(norm)) {
    return 'physics';
  }
  if (/maquinaria|maquinas|motores|tractores|mecanizacion|concreto|estructural|construccion|invernaderos|vivienda|diseno rural|diseno en ingenieria|dibujo|energias renovables|automatizacion|procesos industriales|operaciones unitarias|refrigeracion|del frio/.test(norm)) {
    return 'engineering_mach';
  }
  if (/econom|finanzas|financiero|financieras|contabilidad|administracion|marketing|mercado|mercados|mercadeo|negoci|proyecto|proyectos|emprend|empresa|empresarial|branding|coaching|liderazgo|comercio|logistica|banca|bancarias|gerencia|planeamiento|calidad|agronegocios|talento|organizacion y metodos|derecho|auditoria|certificacion|vigilancia tecnologica/.test(norm)) {
    return 'economy';
  }

  // 3. Respaldo por código de departamento UNALM
  const prefixMap = {
    AG: 'agro_soils',
    FR: 'forestry',
    IA: 'engineering_mach',
    ZT: 'zootecnia',
    PQ: 'fishery',
    AL: 'food',
    EG: 'sports',
    EP: 'economy',
    CC: 'biology',
    VRI: 'humanities'
  };
  if (prefix && prefixMap[prefix]) {
    return prefixMap[prefix];
  }

  // 4. Respaldo determinista universal para cualquier curso nuevo o no listado
  const fallbackPool = ['stats', 'code', 'biology', 'chemistry', 'environment', 'economy'];
  let h = 0;
  for (let i = 0; i < norm.length; i++) h = (h * 31 + norm.charCodeAt(i)) >>> 0;
  return fallbackPool[h % fallbackPool.length];
}

function generarPortadaCursoSvg(nombre, codeText) {
  const seedText = `${nombre || ''}::${codeText || ''}`;
  let hash = 0;
  for (let i = 0; i < seedText.length; i++) {
    hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  }

  const gid = `unalmG_${hash}`;
  const category = clasificarTemaCursoUnalm(nombre, codeText);
  const v = hash % 3;

  const pick = (palettes) => palettes[v % palettes.length];
  const svgWrap = (stops, inner) => {
    const cssBg = `linear-gradient(135deg, ${stops[0]} 0%, ${stops[1]} 55%, ${stops[2]} 100%)`;
    const svg = `<svg viewBox="0 0 360 130" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="360" y2="130" gradientUnits="userSpaceOnUse"><stop stop-color="${stops[0]}"/><stop offset="0.55" stop-color="${stops[1]}"/><stop offset="1" stop-color="${stops[2]}"/></linearGradient></defs><rect width="360" height="130" fill="url(#${gid})"/>${inner}</svg>`;
    return { bg: cssBg, svg };
  };

  if (category === 'code') {
    const p = pick([
      { stops: ['#09152b', '#172554', '#0369a1'], acc: '#38bdf8', hi: '#7fe8c8' },
      { stops: ['#0b1f24', '#0f3d4c', '#0284c7'], acc: '#22d3ee', hi: '#a7f3d0' },
      { stops: ['#131129', '#2e1065', '#0e7490'], acc: '#c084fc', hi: '#5eead4' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M0 28H360M0 64H360M0 100H360M60 0V130M120 0V130M180 0V130M240 0V130M300 0V130" stroke="#ffffff" stroke-opacity="0.06"/>
       <circle cx="56" cy="48" r="24" fill="${p.acc}" fill-opacity="0.14"/>
       <circle cx="308" cy="84" r="32" fill="${p.hi}" fill-opacity="0.12"/>
       <rect x="112" y="20" width="136" height="74" rx="9" fill="#0b1322" fill-opacity="0.88" stroke="${p.acc}" stroke-width="2"/>
       <rect x="122" y="30" width="116" height="52" rx="5" fill="${p.acc}" fill-opacity="0.18"/>
       <path d="M132 42H172M132 54H212M142 66H196M132 74H162" stroke="${p.hi}" stroke-width="2.6" stroke-linecap="round"/>
       <path d="M76 54L62 66L76 78M284 54L298 66L284 78" stroke="${p.acc}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.8"/>
       <rect x="162" y="94" width="36" height="9" fill="${p.acc}" fill-opacity="0.7"/>
       <rect x="142" y="103" width="76" height="6" rx="3" fill="#cbd5e1" fill-opacity="0.55"/>`
    );
  }

  if (category === 'stats') {
    const p = pick([
      { stops: ['#072219', '#0e543f', '#1f9d77'], acc: '#7fe8c8', hi: '#fde047' },
      { stops: ['#0a252b', '#0f4c5c', '#14b8a6'], acc: '#5eead4', hi: '#fbbf24' },
      { stops: ['#0b1e2d', '#164e63', '#0d9488'], acc: '#38bdf8', hi: '#a7f3d0' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M26 106H334" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>
       <rect x="44" y="70" width="22" height="36" rx="4" fill="${p.acc}" fill-opacity="0.28" stroke="${p.acc}" stroke-opacity="0.65"/>
       <rect x="76" y="48" width="22" height="58" rx="4" fill="${p.acc}" fill-opacity="0.4" stroke="${p.acc}" stroke-opacity="0.75"/>
       <rect x="108" y="30" width="22" height="76" rx="4" fill="${p.hi}" fill-opacity="0.34" stroke="${p.hi}" stroke-opacity="0.8"/>
       <rect x="140" y="54" width="22" height="52" rx="4" fill="${p.acc}" fill-opacity="0.32" stroke="${p.acc}" stroke-opacity="0.65"/>
       <path d="M188 98C214 98 228 28 256 28C284 28 298 98 328 98" stroke="${p.acc}" stroke-width="2.8" fill="${p.acc}" fill-opacity="0.14"/>
       <path d="M186 92L326 32" stroke="${p.hi}" stroke-width="2.2" stroke-dasharray="5 4"/>
       <circle cx="212" cy="80" r="3.5" fill="${p.hi}"/><circle cx="238" cy="64" r="3.5" fill="${p.hi}"/><circle cx="268" cy="58" r="3.5" fill="${p.hi}"/><circle cx="302" cy="40" r="4.5" fill="#ffffff"/>`
    );
  }

  if (category === 'math') {
    const p = pick([
      { stops: ['#0c1c36', '#1e3a8a', '#0284c7'], acc: '#7dd3fc', hi: '#fde047' },
      { stops: ['#09252c', '#0f766e', '#0369a1'], acc: '#5eead4', hi: '#fcd34d' },
      { stops: ['#17153b', '#312e81', '#2563eb'], acc: '#a5b4fc', hi: '#7fe8c8' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M0 65H360M180 0V130" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1.5"/>
       <polygon points="48,100 118,28 148,100" fill="${p.acc}" fill-opacity="0.18" stroke="${p.acc}" stroke-width="2"/>
       <path d="M28 96Q108 18 180 65T332 34" stroke="${p.hi}" stroke-width="2.6" fill="none"/>
       <circle cx="268" cy="65" r="36" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2" stroke-dasharray="5 5"/>
       <path d="M244 88L292 42" stroke="${p.acc}" stroke-width="2"/>
       <circle cx="180" cy="65" r="5" fill="${p.hi}"/><circle cx="292" cy="42" r="5" fill="${p.acc}"/>`
    );
  }

  if (category === 'physics') {
    const p = pick([
      { stops: ['#1e293b', '#422006', '#b45309'], acc: '#7fe8c8', hi: '#fbbf24' },
      { stops: ['#1a1635', '#3b0764', '#0284c7'], acc: '#38bdf8', hi: '#f472b6' },
      { stops: ['#0b2228', '#155e75', '#d97706'], acc: '#fde047', hi: '#5eead4' }
    ]);
    return svgWrap(
      p.stops,
      `<circle cx="180" cy="65" r="46" stroke="${p.hi}" stroke-opacity="0.24" stroke-width="1.6"/>
       <ellipse cx="180" cy="65" rx="64" ry="20" transform="rotate(-24 180 65)" stroke="${p.acc}" stroke-opacity="0.78" stroke-width="2.2"/>
       <ellipse cx="180" cy="65" rx="64" ry="20" transform="rotate(24 180 65)" stroke="${p.hi}" stroke-opacity="0.78" stroke-width="2.2"/>
       <ellipse cx="180" cy="65" rx="64" ry="20" transform="rotate(88 180 65)" stroke="#ffffff" stroke-opacity="0.32" stroke-width="1.6"/>
       <circle cx="180" cy="65" r="8" fill="${p.hi}"/>
       <path d="M36 96Q62 42 88 96T134 96" stroke="${p.acc}" stroke-opacity="0.5" stroke-width="2" fill="none"/>
       <path d="M266 36L318 36M308 28L318 36L308 44" stroke="${p.hi}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }

  if (category === 'meteo_geo') {
    const p = pick([
      { stops: ['#082436', '#0e7490', '#0284c7'], acc: '#7dd3fc', hi: '#fde047' },
      { stops: ['#0a2a29', '#115e59', '#0369a1'], acc: '#5eead4', hi: '#fb923c' },
      { stops: ['#111c33', '#1d4ed8', '#0891b2'], acc: '#93c5fd', hi: '#7fe8c8' }
    ]);
    return svgWrap(
      p.stops,
      `<ellipse cx="268" cy="65" rx="76" ry="48" stroke="${p.acc}" stroke-opacity="0.24" stroke-width="1.6"/>
       <ellipse cx="268" cy="65" rx="52" ry="32" stroke="${p.acc}" stroke-opacity="0.38" stroke-width="1.6"/>
       <ellipse cx="268" cy="65" rx="26" ry="15" stroke="${p.hi}" stroke-opacity="0.55" stroke-width="1.8"/>
       <circle cx="104" cy="48" r="24" fill="${p.hi}" fill-opacity="0.24"/>
       <path d="M54 78H146A20 20 0 0 0 144 42A26 26 0 0 0 94 36A18 18 0 0 0 54 78Z" fill="#ffffff" fill-opacity="0.18" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>
       <path d="M40 98C96 86 138 112 204 94" stroke="${p.acc}" stroke-width="2.4" stroke-linecap="round"/>
       <circle cx="268" cy="65" r="5" fill="${p.hi}"/>`
    );
  }

  if (category === 'biology') {
    const p = pick([
      { stops: ['#062b22', '#0f5c47', '#10b981'], acc: '#7fe8c8', hi: '#a7f3d0' },
      { stops: ['#0a252b', '#134e4a', '#06b6d4'], acc: '#5eead4', hi: '#fde047' },
      { stops: ['#0f291e', '#166534', '#0d9488'], acc: '#86efac', hi: '#7dd3fc' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M48 34C96 34 114 96 164 96C214 96 232 34 282 34C308 34 324 52 338 66" stroke="${p.acc}" stroke-width="3" stroke-linecap="round"/>
       <path d="M48 96C96 96 114 34 164 34C214 34 232 96 282 96C308 96 324 78 338 64" stroke="${p.hi}" stroke-width="3" stroke-linecap="round"/>
       <path d="M74 42V88M102 52V78M136 46V84M194 46V84M224 54V76M258 42V88M296 42V88" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
       <circle cx="64" cy="30" r="16" stroke="${p.acc}" stroke-opacity="0.35" stroke-width="1.8"/>
       <circle cx="298" cy="30" r="18" fill="${p.hi}" fill-opacity="0.16" stroke="${p.hi}" stroke-opacity="0.4"/>`
    );
  }

  if (category === 'chemistry') {
    const p = pick([
      { stops: ['#17153b', '#3b0764', '#0f766e'], acc: '#c084fc', hi: '#7fe8c8' },
      { stops: ['#1b1138', '#581c87', '#0284c7'], acc: '#e879f9', hi: '#38bdf8' },
      { stops: ['#0e1d36', '#4338ca', '#14b8a6'], acc: '#a5b4fc', hi: '#5eead4' }
    ]);
    return svgWrap(
      p.stops,
      `<polygon points="108,34 134,49 134,79 108,94 82,79 82,49" stroke="${p.acc}" stroke-opacity="0.72" stroke-width="2.2" fill="${p.acc}" fill-opacity="0.14"/>
       <circle cx="108" cy="64" r="14" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="4 3"/>
       <path d="M226 24H254M232 24V46L208 92A8 8 0 0 0 215 104H265A8 8 0 0 0 272 92L248 46V24" stroke="${p.hi}" stroke-width="2.4" stroke-linejoin="round" fill="${p.hi}" fill-opacity="0.14"/>
       <path d="M214 80H266L272 94A7 7 0 0 1 265 102H215A7 7 0 0 1 208 94Z" fill="${p.hi}" fill-opacity="0.36"/>
       <circle cx="234" cy="68" r="4" fill="#ffffff" fill-opacity="0.75"/><circle cx="246" cy="56" r="3" fill="${p.acc}"/><circle cx="298" cy="46" r="10" fill="${p.acc}" fill-opacity="0.22"/>`
    );
  }

  if (category === 'agro_soils') {
    const p = pick([
      { stops: ['#0e2918', '#15803d', '#65a30d'], acc: '#bef264', hi: '#fde047' },
      { stops: ['#142815', '#166534', '#ca8a04'], acc: '#86efac', hi: '#facc15' },
      { stops: ['#1c2411', '#3f6212', '#10b981'], acc: '#d9f99d', hi: '#6ee7b7' }
    ]);
    return svgWrap(
      p.stops,
      `<circle cx="292" cy="34" r="24" fill="${p.hi}" fill-opacity="0.24"/>
       <circle cx="292" cy="34" r="14" fill="${p.hi}" fill-opacity="0.45"/>
       <path d="M0 92Q90 76 180 92T360 88V130H0Z" fill="#06140c" fill-opacity="0.55"/>
       <path d="M0 106Q110 92 220 106T360 102V130H0Z" fill="${p.acc}" fill-opacity="0.2"/>
       <path d="M128 96V48M128 74C108 72 98 58 98 44C114 44 126 56 128 74ZM128 60C148 58 160 44 160 30C144 30 132 42 128 60Z" stroke="${p.acc}" stroke-width="2.4" fill="${p.acc}" fill-opacity="0.3" stroke-linecap="round"/>
       <path d="M214 98V62M214 78C200 76 192 66 192 56C204 56 212 64 214 78Z" stroke="#ffffff" stroke-opacity="0.6" stroke-width="2" fill="#ffffff" fill-opacity="0.18"/>`
    );
  }

  if (category === 'entomo_fito') {
    const p = pick([
      { stops: ['#241b07', '#713f12', '#65a30d'], acc: '#fde047', hi: '#bef264' },
      { stops: ['#1b280e', '#3f6212', '#d97706'], acc: '#a3e635', hi: '#fbbf24' },
      { stops: ['#0e2a1e', '#115e59', '#eab308'], acc: '#fde047', hi: '#5eead4' }
    ]);
    return svgWrap(
      p.stops,
      `<polygon points="74,34 94,46 94,70 74,82 54,70 54,46" stroke="${p.acc}" stroke-opacity="0.55" stroke-width="2" fill="${p.acc}" fill-opacity="0.14"/>
       <polygon points="116,58 136,70 136,94 116,106 96,94 96,70" stroke="${p.acc}" stroke-opacity="0.4" stroke-width="2"/>
       <polygon points="116,10 136,22 136,46 116,58 96,46 96,22" stroke="${p.hi}" stroke-opacity="0.45" stroke-width="2"/>
       <path d="M218 88C218 52 252 30 294 34C294 74 260 96 218 88Z" fill="${p.hi}" fill-opacity="0.25" stroke="${p.hi}" stroke-width="2.2"/>
       <path d="M218 88L286 42" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.8"/>
       <circle cx="256" cy="64" r="28" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="5 4"/>`
    );
  }

  if (category === 'forestry') {
    const p = pick([
      { stops: ['#062116', '#065f46', '#15803d'], acc: '#6ee7b7', hi: '#fde047' },
      { stops: ['#0b2619', '#14532d', '#0f766e'], acc: '#86efac', hi: '#5eead4' },
      { stops: ['#172415', '#365314', '#059669'], acc: '#bef264', hi: '#a7f3d0' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M0 108L88 64L164 98L252 52L360 106V130H0Z" fill="#04150d" fill-opacity="0.5"/>
       <polygon points="94,30 68,82 120,82" fill="${p.acc}" fill-opacity="0.28" stroke="${p.acc}" stroke-width="1.8"/>
       <polygon points="148,20 116,88 180,88" fill="${p.acc}" fill-opacity="0.36" stroke="${p.acc}" stroke-width="2"/>
       <rect x="144" y="88" width="8" height="22" fill="#d97706" fill-opacity="0.7"/>
       <circle cx="276" cy="56" r="34" stroke="${p.hi}" stroke-opacity="0.32" stroke-width="2"/>
       <circle cx="276" cy="56" r="22" stroke="${p.hi}" stroke-opacity="0.45" stroke-width="1.8"/>
       <circle cx="276" cy="56" r="10" stroke="${p.acc}" stroke-opacity="0.6" stroke-width="1.6"/>`
    );
  }

  if (category === 'environment') {
    const p = pick([
      { stops: ['#062b23', '#0f766e', '#10b981'], acc: '#6ee7b7', hi: '#7dd3fc' },
      { stops: ['#092a1e', '#15803d', '#0891b2'], acc: '#86efac', hi: '#5eead4' },
      { stops: ['#0a252e', '#0d9488', '#22c55e'], acc: '#a7f3d0', hi: '#fde047' }
    ]);
    return svgWrap(
      p.stops,
      `<circle cx="180" cy="65" r="38" fill="${p.hi}" fill-opacity="0.16" stroke="${p.hi}" stroke-width="2"/>
       <ellipse cx="180" cy="65" rx="38" ry="15" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1.5"/>
       <ellipse cx="180" cy="65" rx="16" ry="38" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1.5"/>
       <path d="M98 78C98 46 124 30 144 38C144 68 122 86 98 78Z" fill="${p.acc}" fill-opacity="0.34" stroke="${p.acc}" stroke-width="2"/>
       <path d="M262 78C262 46 236 30 216 38C216 68 238 86 262 78Z" fill="${p.acc}" fill-opacity="0.34" stroke="${p.acc}" stroke-width="2"/>
       <circle cx="62" cy="34" r="8" fill="${p.hi}" fill-opacity="0.3"/><circle cx="304" cy="94" r="12" fill="${p.acc}" fill-opacity="0.24"/>`
    );
  }

  if (category === 'water') {
    const p = pick([
      { stops: ['#062436', '#0e7490', '#0ea5e9'], acc: '#7dd3fc', hi: '#5eead4' },
      { stops: ['#042f2e', '#0f766e', '#0284c7'], acc: '#5eead4', hi: '#38bdf8' },
      { stops: ['#091c3a', '#0369a1', '#14b8a6'], acc: '#38bdf8', hi: '#a7f3d0' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M0 78Q60 54 120 78T240 78T360 78V130H0Z" fill="${p.acc}" fill-opacity="0.2"/>
       <path d="M0 94Q60 74 120 94T240 94T360 94" stroke="${p.acc}" stroke-width="2.4" fill="none"/>
       <path d="M0 110Q60 92 120 110T240 110T360 110" stroke="${p.hi}" stroke-opacity="0.65" stroke-width="2" fill="none"/>
       <path d="M180 20C180 20 206 50 206 66A26 26 0 1 1 154 66C154 50 180 20 180 20Z" fill="${p.hi}" fill-opacity="0.28" stroke="${p.acc}" stroke-width="2.4"/>
       <circle cx="282" cy="40" r="14" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>`
    );
  }

  if (category === 'engineering_mach') {
    const p = pick([
      { stops: ['#172133', '#1e3a5f', '#0284c7'], acc: '#7dd3fc', hi: '#fbbf24' },
      { stops: ['#1f242d', '#334155', '#0f766e'], acc: '#5eead4', hi: '#f59e0b' },
      { stops: ['#241b14', '#78350f', '#0369a1'], acc: '#fcd34d', hi: '#38bdf8' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M0 32H360M0 64H360M0 96H360M64 0V130M128 0V130M192 0V130M256 0V130M320 0V130" stroke="#ffffff" stroke-opacity="0.08"/>
       <circle cx="132" cy="65" r="28" stroke="${p.hi}" stroke-width="5" stroke-dasharray="10 7"/>
       <circle cx="132" cy="65" r="12" fill="${p.hi}" fill-opacity="0.35" stroke="${p.hi}" stroke-width="2"/>
       <circle cx="192" cy="82" r="19" stroke="${p.acc}" stroke-width="4" stroke-dasharray="8 5"/>
       <polygon points="242,96 286,32 328,96" stroke="${p.acc}" stroke-width="2.2" fill="${p.acc}" fill-opacity="0.14"/>
       <path d="M264 66H308M286 32V96" stroke="#ffffff" stroke-opacity="0.4" stroke-width="1.6"/>`
    );
  }

  if (category === 'zootecnia') {
    const p = pick([
      { stops: ['#14281d', '#0f5c45', '#65a30d'], acc: '#86efac', hi: '#fde047' },
      { stops: ['#261e0c', '#713f12', '#15803d'], acc: '#fde047', hi: '#7fe8c8' },
      { stops: ['#0e2824', '#115e59', '#84cc16'], acc: '#bef264', hi: '#5eead4' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M0 98Q95 66 195 94T360 84V130H0Z" fill="${p.acc}" fill-opacity="0.18"/>
       <path d="M46 66H98L114 40L132 88L148 54L162 66H216" stroke="${p.hi}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
       <circle cx="268" cy="62" r="30" stroke="${p.acc}" stroke-opacity="0.5" stroke-width="2"/>
       <path d="M250 62C258 44 278 44 286 62C278 80 258 80 250 62Z" fill="${p.acc}" fill-opacity="0.28" stroke="${p.acc}" stroke-width="2"/>
       <circle cx="268" cy="62" r="5" fill="${p.hi}"/>`
    );
  }

  if (category === 'fishery') {
    const p = pick([
      { stops: ['#061d36', '#0c4a6e', '#0891b2'], acc: '#38bdf8', hi: '#5eead4' },
      { stops: ['#042533', '#155e75', '#0284c7'], acc: '#7dd3fc', hi: '#fde047' },
      { stops: ['#071e2e', '#0f766e', '#0369a1'], acc: '#5eead4', hi: '#93c5fd' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M0 92Q60 72 120 92T240 92T360 92V130H0Z" fill="${p.acc}" fill-opacity="0.2"/>
       <circle cx="272" cy="58" r="40" stroke="${p.acc}" stroke-opacity="0.25" stroke-width="1.5" stroke-dasharray="4 4"/>
       <circle cx="272" cy="58" r="24" stroke="${p.hi}" stroke-opacity="0.4" stroke-width="1.5"/>
       <path d="M126 58C150 38 192 38 214 58C192 78 150 78 126 58ZM126 58L102 44V72Z" fill="${p.hi}" fill-opacity="0.34" stroke="${p.hi}" stroke-width="2.2" stroke-linejoin="round"/>
       <circle cx="192" cy="54" r="3" fill="#ffffff"/><circle cx="72" cy="40" r="6" fill="${p.acc}" fill-opacity="0.45"/><circle cx="86" cy="26" r="4" fill="#ffffff" fill-opacity="0.45"/>`
    );
  }

  if (category === 'food') {
    const p = pick([
      { stops: ['#2b190d', '#7c2d12', '#d97706'], acc: '#fdba74', hi: '#fde047' },
      { stops: ['#211a0c', '#854d0e', '#15803d'], acc: '#fde047', hi: '#86efac' },
      { stops: ['#2d1220', '#881337', '#b45309'], acc: '#fda4af', hi: '#fcd34d' }
    ]);
    return svgWrap(
      p.stops,
      `<circle cx="180" cy="65" r="38" stroke="${p.hi}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="6 4"/>
       <polygon points="180,30 212,48 212,84 180,102 148,84 148,48" fill="${p.acc}" fill-opacity="0.22" stroke="${p.acc}" stroke-width="2.2"/>
       <path d="M76 96V40M76 80L62 66M76 66L90 52M76 52L62 38" stroke="${p.hi}" stroke-width="2.4" stroke-linecap="round"/>
       <rect x="266" y="40" width="32" height="52" rx="7" fill="${p.acc}" fill-opacity="0.22" stroke="${p.acc}" stroke-width="2"/>
       <path d="M266 68H298" stroke="${p.hi}" stroke-width="2"/>`
    );
  }

  if (category === 'economy') {
    const p = pick([
      { stops: ['#0b2b26', '#134e4a', '#0ea5e9'], acc: '#7fe8c8', hi: '#fde047' },
      { stops: ['#0e1f33', '#1e3a8a', '#10b981'], acc: '#6ee7b7', hi: '#fbbf24' },
      { stops: ['#162620', '#065f46', '#ca8a04'], acc: '#fde047', hi: '#5eead4' }
    ]);
    return svgWrap(
      p.stops,
      `<circle cx="294" cy="40" r="38" fill="${p.hi}" fill-opacity="0.14"/>
       <rect x="58" y="74" width="22" height="32" rx="4" fill="${p.acc}" fill-opacity="0.32" stroke="${p.acc}" stroke-opacity="0.65"/>
       <rect x="92" y="56" width="22" height="50" rx="4" fill="${p.acc}" fill-opacity="0.45" stroke="${p.acc}" stroke-opacity="0.75"/>
       <rect x="126" y="38" width="22" height="68" rx="4" fill="${p.hi}" fill-opacity="0.35" stroke="${p.hi}" stroke-opacity="0.8"/>
       <path d="M180 88L226 62L258 74L306 30" stroke="${p.hi}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
       <path d="M292 30H306V44" stroke="${p.hi}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
       <circle cx="226" cy="62" r="4" fill="#ffffff"/><circle cx="258" cy="74" r="4" fill="#ffffff"/>`
    );
  }

  if (category === 'sports') {
    const p = pick([
      { stops: ['#24120c', '#9a3412', '#eab308'], acc: '#fde047', hi: '#fb923c' },
      { stops: ['#0a2623', '#0f766e', '#f59e0b'], acc: '#5eead4', hi: '#fde047' },
      { stops: ['#111c3a', '#1d4ed8', '#10b981'], acc: '#93c5fd', hi: '#6ee7b7' }
    ]);
    return svgWrap(
      p.stops,
      `<path d="M0 96C110 72 220 34 360 22" stroke="${p.hi}" stroke-opacity="0.45" stroke-width="3"/>
       <path d="M0 112C120 88 230 50 360 38" stroke="${p.acc}" stroke-opacity="0.35" stroke-width="2"/>
       <circle cx="180" cy="62" r="34" fill="${p.hi}" fill-opacity="0.18" stroke="${p.hi}" stroke-width="2.4"/>
       <polygon points="180,42 195,54 189,74 171,74 165,54" fill="${p.acc}" fill-opacity="0.36" stroke="${p.acc}" stroke-width="1.8"/>
       <circle cx="82" cy="44" r="14" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>`
    );
  }

  // humanities (WriteWise, Comunicación, Ética, Cultura, Artes)
  const p = pick([
    { stops: ['#1c1635', '#4c1d95', '#0f766e'], acc: '#d8b4fe', hi: '#7fe8c8' },
    { stops: ['#0e2729', '#115e59', '#4f46e5'], acc: '#a5b4fc', hi: '#fde047' },
    { stops: ['#291826', '#831843', '#0e7490'], acc: '#fbcfe8', hi: '#5eead4' }
  ]);
  return svgWrap(
    p.stops,
    `<path d="M98 34C130 34 162 42 180 54C198 42 230 34 262 34V94C230 94 198 100 180 110C162 100 130 94 98 94Z" fill="${p.acc}" fill-opacity="0.22" stroke="${p.acc}" stroke-width="2.2" stroke-linejoin="round"/>
     <path d="M180 54V110M116 54H162M116 70H156M198 54H244M204 70H244" stroke="${p.hi}" stroke-width="2" stroke-linecap="round"/>
     <circle cx="62" cy="48" r="18" fill="${p.hi}" fill-opacity="0.18"/>
     <polygon points="302,26 307,38 320,42 307,46 302,58 297,46 284,42 297,38" fill="${p.hi}" fill-opacity="0.85"/>`
  );
}

function obtenerCodigosCursoDesdeNav(courseIds) {
  const codes = [];
  courseIds.forEach((cid) => {
    const navLink = document.querySelector(`.block_navigation a[href*="course/view.php?id=${cid}"]`);
    if (navLink) {
      const codeEl = navLink.querySelector('.unalm-course-code');
      const codeTxt = (codeEl ? codeEl.textContent : navLink.textContent || '').trim();
      if (codeTxt && !codes.includes(codeTxt)) {
        codes.push(codeTxt);
      }
    }
  });
  return codes;
}

function modernizarSelectorVistaCursos() {
  const frontList = document.getElementById('frontpage-course-list');
  if (!frontList) return;

  const coursesContainer = frontList.querySelector('.courses');
  if (!coursesContainer) return;

  const VIEW_KEY = 'unalm_frontpage_view';
  const STAR_KEY = 'unalm_starred_courses';

  let currentView = 'list';
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'grid' || saved === 'list') currentView = saved;
  } catch (e) {}

  let starredSet = new Set();
  try {
    const rawStars = JSON.parse(localStorage.getItem(STAR_KEY) || '[]');
    if (Array.isArray(rawStars)) starredSet = new Set(rawStars);
  } catch (e) {}

  const saveStars = () => {
    try {
      localStorage.setItem(STAR_KEY, JSON.stringify(Array.from(starredSet)));
    } catch (e) {}
  };

  // 1. Insertar barra superior [Lista | Cuadrícula] + Buscador + Filtro arriba de .courses
  let toolbar = frontList.querySelector('.unalm-courses-toolbar');
  if (!toolbar) {
    toolbar = crearEl('div', 'unalm-courses-toolbar');

    const switcher = crearEl('div', 'unalm-view-switcher');
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Modo de visualización de cursos');

    const listBtn = crearEl('button', 'unalm-view-btn');
    listBtn.type = 'button';
    listBtn.dataset.view = 'list';
    listBtn.title = 'Vista de lista (diseño original)';
    appendSvg(listBtn, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>');

    const gridBtn = crearEl('button', 'unalm-view-btn');
    gridBtn.type = 'button';
    gridBtn.dataset.view = 'grid';
    gridBtn.title = 'Vista en tarjetas';
    appendSvg(gridBtn, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>');

    switcher.append(listBtn, gridBtn);

    const searchWrap = crearEl('div', 'unalm-courses-search-wrap');
    appendSvg(searchWrap, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>');
    const searchEl = crearEl('input', 'unalm-courses-search-input');
    searchEl.type = 'text';
    searchEl.placeholder = 'Busque sus cursos...';
    searchEl.setAttribute('aria-label', 'Busque sus cursos');
    searchWrap.appendChild(searchEl);

    const filterWrap = crearEl('div', 'unalm-courses-filter-wrap');
    filterWrap.appendChild(crearEl('span', 'unalm-courses-filter-label', 'Filtrar'));
    const selectEl = crearEl('select', 'unalm-courses-filter-select');
    selectEl.setAttribute('aria-label', 'Filtrar cursos');
    [
      ['all', 'Todos los cursos'],
      ['starred', 'Destacados ★'],
      ['merged', 'Teoría y Práctica']
    ].forEach(([val, label]) => {
      const opt = crearEl('option', '', label);
      opt.value = val;
      selectEl.appendChild(opt);
    });
    filterWrap.appendChild(selectEl);

    toolbar.append(switcher, searchWrap, filterWrap);
    coursesContainer.before(toolbar);
  }

  // 2. Preparar metadatos de cuadrícula en cada .coursebox (ocultos en modo Lista)
  const boxes = Array.from(coursesContainer.querySelectorAll('.coursebox'));
  boxes.forEach((box) => {
    const titleLink = box.querySelector('.coursename a');
    const courseName = titleLink ? titleLink.textContent.trim() : 'Curso UNALM';
    const isMerged = box.classList.contains('coursebox-merged');

    let courseIds = [];
    if (box.dataset.unalmCourseIds) {
      courseIds = box.dataset.unalmCourseIds.split(',').filter(Boolean);
    } else if (box.getAttribute('data-courseid')) {
      courseIds = [box.getAttribute('data-courseid')];
    } else if (titleLink && titleLink.href) {
      try {
        const idFromUrl = new URL(titleLink.href, window.location.origin).searchParams.get('id');
        if (idFromUrl) courseIds = [idFromUrl];
      } catch (e) {}
    }

    let teachers = [];
    if (box.dataset.unalmTeachers) {
      teachers = box.dataset.unalmTeachers.split(' | ').filter(Boolean);
    } else {
      teachers = Array.from(box.querySelectorAll('.teachers a'))
        .map((a) => a.textContent.trim())
        .filter(Boolean);
    }

    const codes = obtenerCodigosCursoDesdeNav(courseIds);
    const codeText = codes.length > 0 ? codes.join(' · ') : (courseIds[0] ? `CURSO-${courseIds[0]}` : 'UNALM');
    const starKey = courseName.toLowerCase();

    box.dataset.unalmSearchText = `${courseName} ${codeText} ${teachers.join(' ')}`.toLowerCase();
    box.dataset.unalmStarKey = starKey;

    if (!box.querySelector('.unalm-grid-cover')) {
      const theme = generarPortadaCursoSvg(courseName, codeText);
      const coverDiv = crearEl('div', 'unalm-grid-cover');
      coverDiv.style.background = theme.bg;
      appendSvg(coverDiv, theme.svg);
      if (isMerged) {
        coverDiv.appendChild(crearEl('span', 'unalm-grid-badge', 'Teoría + Práctica'));
      }
      box.prepend(coverDiv);

      const codeDiv = crearEl('div', 'unalm-grid-code', codeText);
      coverDiv.insertAdjacentElement('afterend', codeDiv);

      const footerDiv = crearEl('div', 'unalm-grid-footer');

      const profLabel =
        teachers.length > 1 || isMerged
          ? (teachers.length > 1 ? 'Múltiples profesores' : (teachers[0] ? `Teoría y Práctica · ${teachers[0]}` : 'Múltiples aulas'))
          : (teachers[0] || 'Docente UNALM');

      const profSpan = crearEl('span', 'unalm-grid-prof', profLabel);
      profSpan.title = teachers.length > 0 ? teachers.join(', ') : profLabel;

      const actionsDiv = crearEl('div', 'unalm-grid-actions');

      const infoBtn = crearEl('button', 'unalm-card-action-btn');
      infoBtn.type = 'button';
      infoBtn.title = teachers.length > 0 ? `Docente(s): ${teachers.join(', ')} (${codeText})` : codeText;
      appendSvg(infoBtn, '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>');
      infoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isMerged && Array.isArray(box._unalmMergedCursos)) {
          abrirModal(courseName, box._unalmMergedCursos);
        } else if (titleLink) {
          window.location.href = titleLink.href;
        }
      });

      const starBtn = crearEl('button', 'unalm-card-action-btn');
      starBtn.type = 'button';
      const syncStarUi = () => {
        const isStarred = starredSet.has(starKey);
        starBtn.classList.toggle('is-starred', isStarred);
        starBtn.title = isStarred ? 'Quitar de destacados' : 'Destacar curso';
        starBtn.replaceChildren();
        appendSvg(starBtn, `<svg width="14" height="14" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`);
      };
      syncStarUi();

      starBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (starredSet.has(starKey)) starredSet.delete(starKey);
        else starredSet.add(starKey);
        saveStars();
        syncStarUi();
        aplicarFiltrosYVista();
      });

      actionsDiv.appendChild(infoBtn);
      actionsDiv.appendChild(starBtn);
      footerDiv.appendChild(profSpan);
      footerDiv.appendChild(actionsDiv);
      box.appendChild(footerDiv);
    }
  });

  // 3. Estado vacío si búsqueda no coincide
  let emptyState = coursesContainer.querySelector('.unalm-courses-empty');
  if (!emptyState) {
    emptyState = document.createElement('div');
    emptyState.className = 'unalm-courses-empty';
    emptyState.textContent = 'No se encontraron cursos con ese criterio.';
    emptyState.style.setProperty('display', 'none', 'important');
    coursesContainer.appendChild(emptyState);
  }

  const searchInput = toolbar.querySelector('.unalm-courses-search-input');
  const filterSelect = toolbar.querySelector('.unalm-courses-filter-select');
  const viewButtons = toolbar.querySelectorAll('.unalm-view-btn');

  const aplicarFiltrosYVista = () => {
    const isGrid = currentView === 'grid';
    coursesContainer.classList.toggle('unalm-view-grid', isGrid);

    viewButtons.forEach((btn) => {
      const active = btn.dataset.view === currentView;
      btn.classList.toggle('is-active', active);
      btn.style.setProperty('min-width', '36px', 'important');
      btn.style.setProperty('height', '32px', 'important');
      btn.style.setProperty('padding', '0 10px', 'important');
      btn.style.setProperty('border-radius', '9px', 'important');
      if (active) {
        btn.style.setProperty('background', 'linear-gradient(135deg, rgba(31, 157, 119, 0.9) 0%, rgba(15, 92, 69, 0.95) 100%)', 'important');
        btn.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.55)', 'important');
        btn.style.setProperty('color', '#ffffff', 'important');
      } else {
        btn.style.setProperty('background', 'transparent', 'important');
        btn.style.setProperty('border', '1px solid transparent', 'important');
        btn.style.setProperty('color', '#94a3b8', 'important');
      }
    });

    const query = (searchInput?.value || '').trim().toLowerCase();
    const filterVal = filterSelect?.value || 'all';
    let visibleCount = 0;

    boxes.forEach((box) => {
      const matchesSearch = !query || (box.dataset.unalmSearchText || '').includes(query);
      const isMerged = box.classList.contains('coursebox-merged');
      const isStarred = starredSet.has(box.dataset.unalmStarKey || '');

      let matchesFilter = true;
      if (filterVal === 'starred') matchesFilter = isStarred;
      else if (filterVal === 'merged') matchesFilter = isMerged;

      if (matchesSearch && matchesFilter) {
        box.style.removeProperty('display');
        visibleCount++;
      } else {
        box.style.setProperty('display', 'none', 'important');
      }
    });

    if (visibleCount === 0) {
      emptyState.style.removeProperty('display');
    } else {
      emptyState.style.setProperty('display', 'none', 'important');
    }
  };

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentView = btn.dataset.view === 'grid' ? 'grid' : 'list';
      try {
        localStorage.setItem(VIEW_KEY, currentView);
      } catch (err) {}
      aplicarFiltrosYVista();
    });
  });

  searchInput?.addEventListener('input', aplicarFiltrosYVista);
  filterSelect?.addEventListener('change', aplicarFiltrosYVista);

  aplicarFiltrosYVista();
}

// ============================================================
// 12. MENSAJERÍA UNALM (#page-message-index / .messaging-area)
//     Fuerza estilos Liquid Glass y observa cambios AJAX de Moodle
// ============================================================
function estilizarContenedorMensajes(container) {
  if (!container) return;

  const area = container.querySelector('.messaging-area');
  if (!area) return;

  container.style.setProperty('border-radius', '24px', 'important');
  container.style.setProperty('overflow', 'hidden', 'important');
  container.style.setProperty('background', 'linear-gradient(155deg, rgba(16, 25, 22, 0.86) 0%, rgba(8, 14, 12, 0.94) 100%)', 'important');
  container.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.12)', 'important');
  container.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.28)', 'important');
  container.style.setProperty('box-shadow', '0 24px 56px rgba(0, 0, 0, 0.62)', 'important');

  area.style.setProperty('border', 'none', 'important');
  area.style.setProperty('background', 'transparent', 'important');

  const contactsArea = area.querySelector('.contacts-area');
  if (contactsArea) {
    contactsArea.style.setProperty('background', 'rgba(255, 255, 255, 0.02)', 'important');
    contactsArea.style.setProperty('border-right', '1px solid rgba(255, 255, 255, 0.09)', 'important');
  }

  const searchArea = area.querySelector('.searchtextarea');
  if (searchArea) {
    searchArea.style.setProperty('background', 'rgba(255, 255, 255, 0.03)', 'important');
    searchArea.style.setProperty('background-color', 'rgba(255, 255, 255, 0.03)', 'important');
    searchArea.style.setProperty('border', 'none', 'important');
    searchArea.style.setProperty('border-bottom', '1px solid rgba(255, 255, 255, 0.08)', 'important');
    searchArea.style.setProperty('height', 'auto', 'important');
  }

  const searchInput = area.querySelector('input[data-region="search-box"], #searchtext');
  if (searchInput) {
    if (searchInput.placeholder && searchInput.placeholder.trim() !== searchInput.placeholder) {
      searchInput.placeholder = searchInput.placeholder.trim();
    }
    searchInput.style.setProperty('background', 'rgba(255, 255, 255, 0.06)', 'important');
    searchInput.style.setProperty('background-color', 'rgba(255, 255, 255, 0.06)', 'important');
    searchInput.style.setProperty('background-image', 'none', 'important');
    searchInput.style.setProperty('color', '#f8fafc', 'important');
    searchInput.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.14)', 'important');
    searchInput.style.setProperty('border-radius', '12px', 'important');
    searchInput.style.setProperty('text-align', 'left', 'important');
  }

  area.querySelectorAll('.contacts').forEach((list) => {
    list.style.setProperty('background', 'transparent', 'important');
    list.style.setProperty('background-color', 'transparent', 'important');
    list.style.setProperty('border', 'none', 'important');
  });

  area.querySelectorAll('.contact').forEach((c) => {
    const isSel = c.classList.contains('selected');
    c.style.setProperty('border-radius', '15px', 'important');
    c.style.setProperty('margin-bottom', '6px', 'important');
    c.style.setProperty('padding', '10px 12px', 'important');
    c.style.setProperty('height', 'auto', 'important');
    if (isSel) {
      c.style.setProperty('background', 'linear-gradient(135deg, rgba(31, 157, 119, 0.28) 0%, rgba(14, 82, 62, 0.36) 100%)', 'important');
      c.style.setProperty('background-color', 'rgba(31, 157, 119, 0.28)', 'important');
      c.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.45)', 'important');
      c.style.setProperty('color', '#ffffff', 'important');
    } else {
      c.style.setProperty('background', 'rgba(255, 255, 255, 0.025)', 'important');
      c.style.setProperty('background-color', 'rgba(255, 255, 255, 0.025)', 'important');
      c.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.06)', 'important');
      c.style.setProperty('color', '#e2e8f0', 'important');
    }
  });

  const tabsBar = area.querySelector('.tabs');
  if (tabsBar) {
    tabsBar.style.setProperty('background', 'rgba(11, 18, 16, 0.94)', 'important');
    tabsBar.style.setProperty('background-color', 'rgba(11, 18, 16, 0.94)', 'important');
    tabsBar.style.setProperty('border', 'none', 'important');
    tabsBar.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.09)', 'important');
    tabsBar.style.setProperty('height', 'auto', 'important');
    tabsBar.style.setProperty('padding', '9px 10px', 'important');
    tabsBar.style.setProperty('display', 'flex', 'important');
    tabsBar.style.setProperty('gap', '8px', 'important');

    tabsBar.querySelectorAll('.tab').forEach((tab) => {
      const isSel = tab.classList.contains('selected');
      tab.style.setProperty('height', 'auto', 'important');
      tab.style.setProperty('border-radius', '11px', 'important');
      tab.style.setProperty('padding', '8px 10px', 'important');
      tab.style.setProperty('display', 'inline-flex', 'important');
      tab.style.setProperty('align-items', 'center', 'important');
      tab.style.setProperty('justify-content', 'center', 'important');
      tab.style.setProperty('gap', '7px', 'important');
      if (isSel) {
        tab.style.setProperty('background', 'linear-gradient(135deg, rgba(31, 157, 119, 0.28) 0%, rgba(14, 82, 62, 0.36) 100%)', 'important');
        tab.style.setProperty('background-color', 'rgba(31, 157, 119, 0.28)', 'important');
        tab.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.45)', 'important');
        tab.style.setProperty('color', '#7fe8c8', 'important');
      } else {
        tab.style.setProperty('background', 'rgba(255, 255, 255, 0.04)', 'important');
        tab.style.setProperty('background-color', 'rgba(255, 255, 255, 0.04)', 'important');
        tab.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.06)', 'important');
        tab.style.setProperty('color', '#cbd5e1', 'important');
      }
    });
  }

  const msgArea = area.querySelector('.messages-area');
  if (msgArea) {
    msgArea.style.setProperty('background', 'rgba(7, 12, 10, 0.55)', 'important');
    msgArea.style.setProperty('border', 'none', 'important');
  }

  const header = area.querySelector('.messages-header');
  if (header) {
    header.style.setProperty('height', 'auto', 'important');
    header.style.setProperty('min-height', '62px', 'important');
    header.style.setProperty('padding', '12px 18px', 'important');
    header.style.setProperty('background', 'rgba(255, 255, 255, 0.035)', 'important');
    header.style.setProperty('background-color', 'rgba(255, 255, 255, 0.035)', 'important');
    header.style.setProperty('border', 'none', 'important');
    header.style.setProperty('border-bottom', '1px solid rgba(255, 255, 255, 0.09)', 'important');

    const profileBtn = header.querySelector('[data-action="view-contact-profile"]');
    if (profileBtn) {
      profileBtn.style.setProperty('background', 'transparent', 'important');
      profileBtn.style.setProperty('background-color', 'transparent', 'important');
      profileBtn.style.setProperty('background-image', 'none', 'important');
      profileBtn.style.setProperty('border', 'none', 'important');
      profileBtn.style.setProperty('box-shadow', 'none', 'important');
      profileBtn.style.setProperty('padding', '0', 'important');
      profileBtn.style.setProperty('min-height', '0', 'important');
      profileBtn.style.setProperty('color', '#f8fafc', 'important');
      profileBtn.style.setProperty('font-size', '1rem', 'important');
      profileBtn.style.setProperty('font-weight', '700', 'important');
    }

    header.querySelectorAll('.offline-text').forEach((el) => {
      el.style.setProperty('color', '#94a3b8', 'important');
    });
    header.querySelectorAll('.online-text').forEach((el) => {
      el.style.setProperty('color', '#7fe8c8', 'important');
    });

    header.querySelectorAll('.actions button, .view-toggle button').forEach((btn) => {
      btn.style.setProperty('background', 'rgba(255, 255, 255, 0.06)', 'important');
      btn.style.setProperty('background-color', 'rgba(255, 255, 255, 0.06)', 'important');
      btn.style.setProperty('background-image', 'none', 'important');
      btn.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.14)', 'important');
      btn.style.setProperty('border-radius', '10px', 'important');
      btn.style.setProperty('padding', '6px 13px', 'important');
      btn.style.setProperty('min-height', '32px', 'important');
      btn.style.setProperty('color', '#e2e8f0', 'important');
      btn.style.setProperty('box-shadow', 'none', 'important');
    });
  }

  const msgs = area.querySelector('.messages');
  if (msgs) {
    msgs.style.setProperty('background', 'radial-gradient(circle at 50% 0%, rgba(31, 157, 119, 0.08) 0%, transparent 65%)', 'important');
    msgs.style.setProperty('background-color', 'transparent', 'important');
    msgs.style.setProperty('border', 'none', 'important');
    msgs.style.setProperty('padding', '18px 20px', 'important');

    msgs.querySelectorAll('.message .content').forEach((bubble) => {
      const isRight = bubble.classList.contains('right');
      bubble.style.setProperty('padding', '11px 15px', 'important');
      bubble.style.setProperty('box-sizing', 'border-box', 'important');
      if (isRight) {
        bubble.style.setProperty('background', 'linear-gradient(135deg, rgba(31, 157, 119, 0.34) 0%, rgba(14, 82, 62, 0.44) 100%)', 'important');
        bubble.style.setProperty('background-color', 'rgba(31, 157, 119, 0.34)', 'important');
        bubble.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.36)', 'important');
        bubble.style.setProperty('border-radius', '18px 18px 6px 18px', 'important');
        bubble.style.setProperty('color', '#ffffff', 'important');
      } else {
        bubble.style.setProperty('background', 'rgba(255, 255, 255, 0.065)', 'important');
        bubble.style.setProperty('background-color', 'rgba(255, 255, 255, 0.065)', 'important');
        bubble.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.12)', 'important');
        bubble.style.setProperty('border-radius', '18px 18px 18px 6px', 'important');
        bubble.style.setProperty('color', '#f1f5f9', 'important');
      }
    });
  }

  const response = area.querySelector('.response');
  if (response) {
    response.style.setProperty('height', 'auto', 'important');
    response.style.setProperty('min-height', '62px', 'important');
    response.style.setProperty('padding', '12px 16px', 'important');
    response.style.setProperty('background', 'rgba(11, 18, 16, 0.94)', 'important');
    response.style.setProperty('background-color', 'rgba(11, 18, 16, 0.94)', 'important');
    response.style.setProperty('border', 'none', 'important');
    response.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.09)', 'important');

    const txt = response.querySelector('textarea[data-region="send-message-txt"]');
    if (txt) {
      txt.style.setProperty('background', 'rgba(255, 255, 255, 0.06)', 'important');
      txt.style.setProperty('background-color', 'rgba(255, 255, 255, 0.06)', 'important');
      txt.style.setProperty('background-image', 'none', 'important');
      txt.style.setProperty('color', '#f8fafc', 'important');
      txt.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.14)', 'important');
      txt.style.setProperty('border-radius', '13px', 'important');
      txt.style.setProperty('padding', '9px 14px', 'important');
    }

    const sendBtn = response.querySelector('[data-action="send-message"]');
    if (sendBtn) {
      sendBtn.style.setProperty('background', 'linear-gradient(135deg, rgba(31, 157, 119, 0.94) 0%, rgba(15, 92, 69, 0.98) 100%)', 'important');
      sendBtn.style.setProperty('border', '1px solid rgba(127, 232, 200, 0.45)', 'important');
      sendBtn.style.setProperty('border-radius', '13px', 'important');
      sendBtn.style.setProperty('padding', '9px 20px', 'important');
      sendBtn.style.setProperty('min-height', '40px', 'important');
      sendBtn.style.setProperty('color', '#ffffff', 'important');
    }
  }
}

function modernizarMensajeria() {
  const containers = document.querySelectorAll('.messaging-area-container');
  if (!containers.length) return;

  containers.forEach((container) => {
    estilizarContenedorMensajes(container);
    if (!container.dataset.unalmObserverBound) {
      container.dataset.unalmObserverBound = '1';
      let timer = null;
      const obs = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          estilizarContenedorMensajes(container);
        }, 40);
      });
      obs.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-checked'] });
    }
  });
}

// Inicialización segura con control de errores
function iniciarExtension() {
  try { agruparCursosDuplicados(); } catch (e) { console.error('Error agrupar cursos:', e); }
  try { hacerCursosClickeables(); } catch (e) { console.error('Error cursos clickeables:', e); }
  try { desvanecerBannerAlScroll(); } catch (e) { console.error('Error desvanecer banner:', e); }
  try { modernizarNavegacion(); } catch (e) { console.error('Error modernizar navegacion:', e); }
  try { modernizarSelectorVistaCursos(); } catch (e) { console.error('Error selector vista cursos:', e); }
  try { modernizarContenidoCurso(); } catch (e) { console.error('Error modernizar contenido curso:', e); }
  try { modernizarPaginaTareas(); } catch (e) { console.error('Error modernizar pagina tareas:', e); }
  try { modernizarPaginaLogin(); } catch (e) { console.error('Error modernizar pagina login:', e); }
  try { modernizarBotonesYForos(); } catch (e) { console.error('Error modernizar botones y foros:', e); }
  try { modernizarEditorEntrega(); } catch (e) { console.error('Error modernizar editor entrega:', e); }
  try { modernizarCalificacionesYAdmin(); } catch (e) { console.error('Error modernizar calificaciones y admin:', e); }
  try { modernizarMensajeria(); } catch (e) { console.error('Error modernizar mensajeria:', e); }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarExtension);
} else {
  iniciarExtension();
}




