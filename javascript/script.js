/* ==========================================================================
   BURGERHUB — Main Script
   Vanilla JS · No dependencies · IIFE scoped
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     0. HELPERS
     ------------------------------------------------------------------------ */
  const $  = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------------
     1. THEME (DARK / LIGHT)
     ------------------------------------------------------------------------ */
  const root        = document.documentElement;
  const themeToggle = $('#themeToggle');
  const STORAGE_KEY = 'burgerhub-theme';

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);

    // Update browser UI colour (address bar on mobile)
    let meta = $('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', theme === 'dark' ? '#0a0908' : '#fdfaf6');
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const initial = saved || (systemPrefersLight ? 'light' : 'dark');
    applyTheme(initial);
  }

  initTheme();

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);

      // Little pulse feedback
      themeToggle.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(0.86)' },
          { transform: 'scale(1)' }
        ],
        { duration: 320, easing: 'ease-out' }
      );
    });
  }

  // React to system theme change when the user hasn't chosen manually
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'light' : 'dark');
    }
  });

  /* ------------------------------------------------------------------------
     2. MOBILE NAVIGATION
     ------------------------------------------------------------------------ */
  const menuToggle = $('#menuToggle');
  const navMenu    = $('#navMenu');

  function closeMenu() {
    if (!navMenu || !menuToggle) return;
    navMenu.classList.remove('active');
    menuToggle.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    if (!navMenu || !menuToggle) return;
    const isOpen = navMenu.classList.toggle('active');
    menuToggle.classList.toggle('active', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  }

  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });
  }

  // Close the menu when a link is tapped
  $$('#navMenu a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!navMenu || !navMenu.classList.contains('active')) return;
    if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  // Close when resizing back to desktop
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (window.innerWidth > 900) closeMenu();
    }, 150);
  });

  /* ------------------------------------------------------------------------
     3. NAVBAR SCROLL STATE
     ------------------------------------------------------------------------ */
  const navbar = $('#navbar');

  function updateNavbar() {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }

  /* ------------------------------------------------------------------------
     4. SCROLL PROGRESS BAR
     ------------------------------------------------------------------------ */
  const progressBar = $('#scrollProgress');

  function updateProgress() {
    if (!progressBar) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress  = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
    progressBar.style.width = progress + '%';
  }

  /* ------------------------------------------------------------------------
     5. BACK TO TOP
     ------------------------------------------------------------------------ */
  const backToTop = $('#backToTop');

  function updateBackToTop() {
    if (!backToTop) return;
    backToTop.classList.toggle('visible', window.scrollY > 500);
  }

  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });
  }

  /* ------------------------------------------------------------------------
     6. SCROLL LISTENER (throttled via rAF)
     ------------------------------------------------------------------------ */
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateNavbar();
      updateProgress();
      updateBackToTop();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // Initial run
  onScroll();

  /* ------------------------------------------------------------------------
     7. REVEAL ON SCROLL
     ------------------------------------------------------------------------ */
  const revealElements = $$('.reveal');

  if (revealElements.length && 'IntersectionObserver' in window && !prefersReducedMotion) {
    const revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          // Stagger siblings inside the same parent
          const parent   = entry.target.parentElement;
          const siblings = parent ? $$('.reveal', parent) : [];
          const index    = siblings.indexOf(entry.target);
          const delay    = index > 0 ? Math.min(index * 90, 360) : 0;

          setTimeout(function () {
            entry.target.classList.add('visible');
          }, delay);

          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    // Fallback: show everything
    revealElements.forEach(function (el) {
      el.classList.add('visible');
    });
  }

  /* ------------------------------------------------------------------------
     8. SCROLLSPY — ACTIVE NAV LINK
     ------------------------------------------------------------------------ */
  const sections = $$('section[id]');
  const navLinks = $$('.nav-link');

  function setActiveLink(id) {
    navLinks.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('href') === '#' + id);
    });
  }

  if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
    const spyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActiveLink(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );

    sections.forEach(function (section) {
      spyObserver.observe(section);
    });
  }

  /* ------------------------------------------------------------------------
     9. SMOOTH ANCHOR SCROLL (offset-aware)
     ------------------------------------------------------------------------ */
  $$('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      const navHeight = navbar ? navbar.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight + 1;

      window.scrollTo({
        top: Math.max(top, 0),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });

      // Update the URL without jumping
      if (history.pushState) {
        history.pushState(null, '', targetId);
      }
    });
  });

  /* ------------------------------------------------------------------------
     10. GALLERY LIGHTBOX (simple, dependency-free)
     ------------------------------------------------------------------------ */
  const galleryItems = $$('.image-item');

  if (galleryItems.length) {
    // Build lightbox markup once
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Image preview');
    lightbox.innerHTML =
      '<button class="lightbox-close" aria-label="Close preview">&times;</button>' +
      '<img src="" alt="Enlarged gallery image">';

    // Minimal inline styles so the lightbox works without extra CSS
    Object.assign(lightbox.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '4000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'rgba(6, 5, 4, .92)',
      backdropFilter: 'blur(10px)',
      opacity: '0',
      visibility: 'hidden',
      transition: 'opacity .35s ease, visibility .35s ease',
      cursor: 'zoom-out'
    });

    const lightboxImg = lightbox.querySelector('img');
    Object.assign(lightboxImg.style, {
      maxWidth: '92vw',
      maxHeight: '86vh',
      borderRadius: '16px',
      boxShadow: '0 30px 80px rgba(0,0,0,.7)',
      transform: 'scale(.92)',
      transition: 'transform .4s cubic-bezier(.16,1,.3,1)'
    });

    const closeBtn = lightbox.querySelector('.lightbox-close');
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '20px',
      right: '24px',
      width: '46px',
      height: '46px',
      border: '1px solid rgba(255,255,255,.25)',
      borderRadius: '50%',
      background: 'rgba(255,255,255,.08)',
      color: '#fff',
      fontSize: '1.6rem',
      lineHeight: '1',
      cursor: 'pointer',
      transition: 'background .3s ease, transform .3s ease'
    });

    document.body.appendChild(lightbox);

    function openLightbox(src, alt) {
      lightboxImg.src = src;
      lightboxImg.alt = alt || 'Gallery image';
      lightbox.style.visibility = 'visible';
      lightbox.style.opacity = '1';
      lightboxImg.style.transform = 'scale(1)';
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.style.opacity = '0';
      lightbox.style.visibility = 'hidden';
      lightboxImg.style.transform = 'scale(.92)';
      document.body.style.overflow = '';
    }

    galleryItems.forEach(function (item) {
      const img = item.querySelector('img');
      if (!img) return;

      item.addEventListener('click', function () {
        openLightbox(img.src, img.alt);
      });
    });

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target === closeBtn) closeLightbox();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.style.visibility === 'visible') {
        closeLightbox();
      }
    });
  }


  /* ------------------------------------------------------------------------
   11. RESERVATION FORM → API
   ------------------------------------------------------------------------ */
const API_BASE = 'http://localhost:5000/api';
const reservationForm = document.querySelector('.reservation-form');

reservationForm?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  if (!btn || btn.dataset.busy === 'true') return;

  const fd = new FormData(this);
  const payload = {
    name:    (fd.get('name')    || '').toString().trim(),
    email:   (fd.get('email')   || '').toString().trim(),
    phone:   (fd.get('phone')   || '').toString().trim(),
    date:    (fd.get('date')    || '').toString(),
    time:    (fd.get('time')    || '').toString(),
    message: (fd.get('message') || '').toString().trim(),
    guests:  Number(fd.get('guests') || 2),
  };

  const original = btn.innerHTML;
  btn.dataset.busy = 'true';
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';

  try {
    const res  = await fetch(`${API_BASE}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed');

    btn.innerHTML = '<i class="fa-solid fa-check"></i> Reserved!';
    btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
    this.reset();
  } catch (err) {
    btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Error';
    btn.style.background = 'linear-gradient(135deg,#ef4444,#b91c1c)';
    alert('Reservation failed: ' + err.message);
  } finally {
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      btn.disabled = false;
      btn.dataset.busy = 'false';
    }, 2200);
  }
});


/* ------------------------------------------------------------------------
   11b. CONTACT FORM → API
   ------------------------------------------------------------------------ */
const contactForm = document.getElementById('contactForm');

contactForm?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  if (!btn || btn.dataset.busy === 'true') return;

  const fd = new FormData(this);
  const payload = {
    name:    (fd.get('name')    || '').toString().trim(),
    email:   (fd.get('email')   || '').toString().trim(),
    subject: (fd.get('subject') || '').toString().trim(),
    message: (fd.get('message') || '').toString().trim(),
  };

  if (!payload.name || payload.name.length < 2)
    return alert('Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email))
    return alert('Please enter a valid email.');
  if (!payload.message || payload.message.length < 5)
    return alert('Message must be at least 5 characters.');

  const original = btn.innerHTML;
  btn.dataset.busy = 'true';
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';

  try {
    const res  = await fetch(`${API_BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed');

    btn.innerHTML = '<i class="fa-solid fa-check"></i> Sent!';
    btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
    this.reset();
  } catch (err) {
    btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Failed';
    btn.style.background = 'linear-gradient(135deg,#ef4444,#b91c1c)';
    alert('Could not send message: ' + err.message);
  } finally {
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      btn.disabled = false;
      btn.dataset.busy = 'false';
    }, 2200);
  }
});




  /* ------------------------------------------------------------------------
     12. MENU ITEM CARD TILT (subtle pointer effect — desktop only)
     ------------------------------------------------------------------------ */
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (canHover && !prefersReducedMotion) {
    $$('.menu-item').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width  - 0.5;
        const y = (e.clientY - rect.top)  / rect.height - 0.5;

        card.style.transform =
          'translateY(-10px) ' +
          'rotateX(' + (-y * 5) + 'deg) ' +
          'rotateY(' + (x * 5) + 'deg)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------------------
     13. CURRENT YEAR IN FOOTER
     ------------------------------------------------------------------------ */
  const footerText = $('.footer-bottom p');
  if (footerText) {
    footerText.innerHTML = footerText.innerHTML.replace(/\d{4}/, new Date().getFullYear());
  }

  /* ------------------------------------------------------------------------
     14. LAZY-LOAD FALLBACK FOR IMAGES
     ------------------------------------------------------------------------ */
  $$('img').forEach(function (img) {
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  });

})();