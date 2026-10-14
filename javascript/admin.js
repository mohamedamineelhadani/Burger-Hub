/* ==========================================================================
   BURGERHUB — Admin Dashboard
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------- CONFIG ---------------------------- */
  const CONFIG = {
    API_BASE: 'http://localhost:5000/api',
    TOKEN_KEY: 'burgerhub-admin-token',
    USER_KEY:  'burgerhub-admin-user',
    THEME_KEY: 'burgerhub-admin-theme',
    CURRENCY:  '$',
  };

  /* ---------------------------- HELPERS ---------------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const fmtMoney = (n) => CONFIG.CURRENCY + Number(n || 0).toFixed(2);

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fmtTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const timeAgo = (iso) => {
    if (!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return fmtDate(iso);
  };

  const escapeHtml = (str) =>
    String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);

  /* ---------------------------- AUTH ---------------------------- */
  const getToken = () => localStorage.getItem(CONFIG.TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(CONFIG.TOKEN_KEY, t);
  const clearAuth = () => {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  };

  async function api(path, options = {}) {
    const res = await fetch(CONFIG.API_BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
      },
    });

    if (res.status === 401) {
      clearAuth();
      showLogin();
      throw new Error('Session expired. Please log in again.');
    }

    const json = await res.json().catch(() => ({ success: false, error: 'Invalid response' }));
    if (!res.ok || !json.success) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json.data !== undefined ? json.data : json;
  }

  /* ---------------------------- TOAST ---------------------------- */
  const toast = $('#toast');
  const toastMsg = $('#toastMsg');

  let toastTimer;
  function showToast(msg, type = 'success') {
    if (!toast) return;
    toastMsg.textContent = msg;
    toast.classList.toggle('error', type === 'error');
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.hidden = true; }, 350);
    }, 2600);
  }

  /* ---------------------------- THEME ---------------------------- */
  function initTheme() {
    const saved = localStorage.getItem(CONFIG.THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }
  initTheme();

  const themeBtn = $('#themeToggle');
  themeBtn?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(CONFIG.THEME_KEY, next);
    drawChart(state.stats?.revenue7d || []);
  });

  /* ---------------------------- LOGIN ---------------------------- */
  const loginScreen = $('#loginScreen');
  const dashboard   = $('#dashboard');
  const loginForm   = $('#loginForm');
  const loginBtn    = $('#loginBtn');
  const loginError  = $('#loginError');

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }

  function showDashboard(user) {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    $('#userName').textContent = user?.username || 'admin';
    loadAll();
  }

  // Password toggle
  $('.toggle-pass')?.addEventListener('click', function () {
    const input = this.previousElementSibling;
    const icon = this.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });

  // Login submit
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;

    const fd = new FormData(loginForm);
    const username = (fd.get('username') || '').toString().trim();
    const password = (fd.get('password') || '').toString();

    if (!username || !password) {
      loginError.textContent = 'Please enter username and password';
      loginError.hidden = false;
      return;
    }

    const original = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';

    try {
      const res = await fetch(`${CONFIG.API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'Login failed');

      setToken(json.token);
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(json.user));
      showDashboard(json.user);
      showToast('Welcome back, ' + json.user.username);
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
      loginForm.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
        { duration: 320 }
      );
    } finally {
      loginBtn.innerHTML = original;
      loginBtn.disabled = false;
    }
  });

  // Logout
  $('#logoutBtn')?.addEventListener('click', () => {
    clearAuth();
    showLogin();
    showToast('Logged out', 'success');
  });

  /* ---------------------------- STATE ---------------------------- */
  const state = {
    stats: null,
    reservations: [],
    orders: [],
    messages: [],
    currentView: 'overview',
  };

  /* ---------------------------- DATA LOADERS ---------------------------- */
  async function loadStats() {
    try {
      state.stats = await api('/admin/stats');
      renderStats();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function loadReservations() {
    try {
      state.reservations = await api('/reservations');
      renderReservations();
      updateBadges();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function loadOrders() {
    try {
      state.orders = await api('/orders');
      renderOrders();
      updateBadges();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function loadMessages() {
    try {
      state.messages = await api('/contact');
      renderMessages();
      updateBadges();
    } catch (err) { showToast(err.message, 'error'); }
  }

  function loadAll() {
    loadStats();
    loadReservations();
    loadOrders();
    loadMessages();
  }

  function updateBadges() {
    const badges = {
      'badge-reservations': state.reservations.filter((r) => r.status === 'pending').length,
      'badge-orders': state.orders.filter((o) => o.status === 'pending').length,
      'badge-messages': state.messages.filter((m) => !m.read).length,
    };
    Object.entries(badges).forEach(([id, count]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  /* ---------------------------- NAVIGATION ---------------------------- */
  const views = {
    overview:     { title: 'Overview',      subtitle: 'Welcome back, admin' },
    reservations: { title: 'Reservations',  subtitle: 'Manage table bookings' },
    orders:       { title: 'Orders',        subtitle: 'Track all customer orders' },
    messages:     { title: 'Messages',      subtitle: 'Customer inquiries' },
  };

  function switchView(name) {
    state.currentView = name;

    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));

    const meta = views[name] || { title: name, subtitle: '' };
    $('#pageTitle').textContent = meta.title;
    $('#pageSubtitle').textContent = meta.subtitle;

    // Close mobile sidebar
    if (window.innerWidth <= 900) $('#sidebar').classList.remove('active');
  }

  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  $('#sidebarToggle')?.addEventListener('click', () => {
    $('#sidebar').classList.toggle('active');
  });

  $('#refreshBtn')?.addEventListener('click', async function () {
    this.querySelector('i').style.animation = 'spin 1s linear infinite';
    await Promise.all([loadStats(), loadReservations(), loadOrders(), loadMessages()]);
    setTimeout(() => { this.querySelector('i').style.animation = ''; }, 300);
    showToast('Data refreshed');
  });

  // Add spin animation
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);

  /* ---------------------------- RENDER STATS ---------------------------- */
  function renderStats() {
    const s = state.stats;
    if (!s) return;
    $('#statOrders').textContent       = s.totals.orders;
    $('#statRevenue').textContent      = fmtMoney(s.totals.revenue);
    $('#statReservations').textContent = s.totals.reservations;
    $('#statMessages').textContent     = s.totals.messages;
    drawChart(s.revenue7d);
    renderActivity();
  }

  /* ---------------------------- CHART ---------------------------- */
  function drawChart(data) {
    const svg = $('#revenueChart');
    if (!svg || !data.length) return;

    const W = 700, H = 220, PAD = { t: 20, r: 20, b: 34, l: 40 };
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;

    const max = Math.max(...data.map((d) => d.revenue), 10);
    const stepX = innerW / (data.length - 1 || 1);

    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || '#ff7a00';
    const accentSoft = style.getPropertyValue('--accent-soft').trim() || '#ff9d3d';
    const textMuted = style.getPropertyValue('--text-muted').trim() || '#888';
    const borderColor = style.getPropertyValue('--border-strong').trim() || 'rgba(255,255,255,.15)';

    // Grid lines
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const y = PAD.t + (innerH / 4) * i;
      grid += `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="${borderColor}" stroke-width="1" stroke-dasharray="3 5" opacity=".6"/>`;
    }

    // Points & path
    const points = data.map((d, i) => ({
      x: PAD.l + i * stepX,
      y: PAD.t + innerH - (d.revenue / max) * innerH,
      ...d,
    }));

    // Smooth line path (Catmull-Rom-ish)
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      path += ` C ${cp1x} ${p0.y}, ${cp1x} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const areaPath = path + ` L ${points[points.length - 1].x} ${PAD.t + innerH} L ${points[0].x} ${PAD.t + innerH} Z`;

    // Bars/dots/labels
    let dots = '';
    let labels = '';
    let values = '';
    points.forEach((p, i) => {
      dots += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${accent}" stroke="var(--surface)" stroke-width="2.5">
        <animate attributeName="r" from="5" to="6" dur=".3s" begin="${i * 0.05}s" fill="freeze"/>
      </circle>`;

      const label = new Date(p.date).toLocaleDateString(undefined, { weekday: 'short' });
      labels += `<text x="${p.x}" y="${H - 12}" text-anchor="middle" fill="${textMuted}" font-size="11" font-family="Inter,sans-serif">${label}</text>`;

      if (p.revenue > 0) {
        values += `<text x="${p.x}" y="${p.y - 12}" text-anchor="middle" fill="${accent}" font-size="10" font-weight="600" font-family="Inter,sans-serif">$${p.revenue.toFixed(0)}</text>`;
      }
    });

    svg.innerHTML = `
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity=".45"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${accentSoft}"/>
          <stop offset="100%" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${areaPath}" fill="url(#areaGrad)"/>
      <path d="${path}" fill="none" stroke="url(#lineGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${values}
      ${labels}
    `;
  }

  /* ---------------------------- ACTIVITY ---------------------------- */
  function renderActivity() {
    const list = $('#activityList');
    if (!list) return;

    const activities = [
      ...state.orders.slice(0, 3).map((o) => ({
        type: 'order',
        icon: 'fa-bag-shopping',
        title: `New order from ${o.customer?.name || 'Guest'}`,
        meta: `${o.id} • ${fmtMoney(o.pricing?.total)}`,
        time: o.createdAt,
      })),
      ...state.reservations.slice(0, 2).map((r) => ({
        type: 'reserve',
        icon: 'fa-calendar-check',
        title: `Reservation by ${r.name}`,
        meta: `${r.date} at ${r.time} • ${r.guests} guests`,
        time: r.createdAt,
      })),
      ...state.messages.slice(0, 1).map((m) => ({
        type: 'message',
        icon: 'fa-envelope',
        title: `Message from ${m.name}`,
        meta: m.subject || m.message.slice(0, 50),
        time: m.createdAt,
      })),
    ]
      .filter((a) => a.time)
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 6);

    if (!activities.length) {
      list.innerHTML = '<p class="empty-note">No activity yet.</p>';
      return;
    }

    list.innerHTML = activities.map((a) => `
      <div class="activity-item">
        <span class="activity-icon ${a.type}"><i class="fa-solid ${a.icon}"></i></span>
        <div class="activity-info">
          <strong>${escapeHtml(a.title)}</strong>
          <span>${escapeHtml(a.meta)}</span>
        </div>
        <span class="activity-time">${timeAgo(a.time)}</span>
      </div>
    `).join('');
  }

  /* ---------------------------- RESERVATIONS ---------------------------- */
  function renderReservations() {
    const body = $('#reservationsBody');
    const search = ($('#searchReservations')?.value || '').toLowerCase();
    const filter = $('#filterReservations')?.value || '';

    let data = state.reservations;
    if (search) {
      data = data.filter((r) =>
        (r.name + ' ' + r.email + ' ' + r.phone).toLowerCase().includes(search)
      );
    }
    if (filter) data = data.filter((r) => r.status === filter);

    $('#reservationsCount').textContent = `${data.length} total`;

    if (!data.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-note">No reservations found.</td></tr>';
      return;
    }

    body.innerHTML = data.map((r) => `
      <tr data-id="${r.id}">
        <td>
          <div class="cell-name">${escapeHtml(r.name)}</div>
          <div class="cell-sub">${r.guests} guests</div>
        </td>
        <td>
          <div>${escapeHtml(r.email)}</div>
          <div class="cell-sub">${escapeHtml(r.phone)}</div>
        </td>
        <td>
          <div>${escapeHtml(r.date)}</div>
          <div class="cell-sub">${escapeHtml(r.time)}</div>
        </td>
        <td>${r.guests}</td>
        <td><span class="status ${r.status}">${r.status}</span></td>
        <td>
          <div class="row-actions">
            <button class="action-btn" data-action="view-reservation" title="View">
              <i class="fa-regular fa-eye"></i>
            </button>
            <button class="action-btn" data-action="next-reservation" title="Advance status">
              <i class="fa-solid fa-arrow-right"></i>
            </button>
            <button class="action-btn danger" data-action="delete-reservation" title="Delete">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /* ---------------------------- ORDERS ---------------------------- */
  function renderOrders() {
    const body = $('#ordersBody');
    const search = ($('#searchOrders')?.value || '').toLowerCase();
    const filter = $('#filterOrders')?.value || '';

    let data = state.orders;
    if (search) {
      data = data.filter((o) =>
        (o.id + ' ' + (o.customer?.name || '') + ' ' + (o.customer?.email || '')).toLowerCase().includes(search)
      );
    }
    if (filter) data = data.filter((o) => o.status === filter);

    $('#ordersCount').textContent = `${data.length} total`;

    if (!data.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-note">No orders found.</td></tr>';
      return;
    }

    body.innerHTML = data.map((o) => `
      <tr data-id="${o.id}">
        <td><strong>${escapeHtml(o.id)}</strong></td>
        <td>
          <div class="cell-name">${escapeHtml(o.customer?.name || '—')}</div>
          <div class="cell-sub">${escapeHtml(o.customer?.phone || '')}</div>
        </td>
        <td>
          <div>${o.items?.length || 0} item(s)</div>
          <div class="cell-sub">${escapeHtml((o.items || []).map((x) => x.name).join(', ').slice(0, 40))}…</div>
        </td>
        <td><strong>${fmtMoney(o.pricing?.total)}</strong></td>
        <td><span class="status ${o.status}">${o.status.replace(/_/g, ' ')}</span></td>
        <td>
          <div class="row-actions">
            <button class="action-btn" data-action="view-order" title="View">
              <i class="fa-regular fa-eye"></i>
            </button>
            <button class="action-btn" data-action="next-order" title="Advance status">
              <i class="fa-solid fa-arrow-right"></i>
            </button>
            <button class="action-btn danger" data-action="delete-order" title="Delete">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /* ---------------------------- MESSAGES ---------------------------- */
  function renderMessages() {
    const list = $('#messagesList');
    const search = ($('#searchMessages')?.value || '').toLowerCase();

    let data = state.messages;
    if (search) {
      data = data.filter((m) =>
        (m.name + ' ' + m.email + ' ' + m.subject + ' ' + m.message).toLowerCase().includes(search)
      );
    }

    $('#messagesCount').textContent = `${data.length} total (${state.messages.filter((m) => !m.read).length} unread)`;

    if (!data.length) {
      list.innerHTML = '<p class="empty-note">No messages found.</p>';
      return;
    }

    list.innerHTML = data.map((m) => `
      <div class="message-card ${m.read ? '' : 'unread'}" data-id="${m.id}">
        <div class="message-head">
          <div>
            <strong>${escapeHtml(m.name)}</strong>
            <div class="cell-sub">${escapeHtml(m.email)}</div>
          </div>
          <small>${timeAgo(m.createdAt)}</small>
        </div>
        ${m.subject ? `<div class="message-subject">${escapeHtml(m.subject)}</div>` : ''}
        <p class="message-body">${escapeHtml(m.message)}</p>
      </div>
    `).join('');
  }

  /* ---------------------------- EVENTS: TABLE ACTIONS ---------------------------- */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const row = btn.closest('tr, .message-card');
    if (!row) return;
    const id = row.dataset.id;

    /* Reservations */
    if (action === 'view-reservation') return openReservationDetail(id);
    if (action === 'delete-reservation') {
      if (!confirm('Delete this reservation?')) return;
      try {
        await api(`/reservations/${id}`, { method: 'DELETE' });
        showToast('Reservation deleted');
        loadReservations(); loadStats();
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }
    if (action === 'next-reservation') {
      const r = state.reservations.find((x) => x.id === id);
      if (!r) return;
      const map = { pending: 'confirmed', confirmed: 'cancelled', cancelled: 'pending' };
      const next = map[r.status];
      try {
        await api(`/reservations/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: next }),
        });
        showToast(`Reservation → ${next}`);
        loadReservations(); loadStats();
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }

    /* Orders */
    if (action === 'view-order') return openOrderDetail(id);
    if (action === 'delete-order') {
      if (!confirm('Delete this order?')) return;
      try {
        await api(`/orders/${id}`, { method: 'DELETE' });
        showToast('Order deleted');
        loadOrders(); loadStats();
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }
    if (action === 'next-order') {
      const o = state.orders.find((x) => x.id === id);
      if (!o) return;
      const map = {
        pending: 'preparing',
        preparing: 'out_for_delivery',
        out_for_delivery: 'delivered',
        delivered: 'delivered',
        cancelled: 'pending',
      };
      const next = map[o.status];
      try {
        await api(`/orders/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: next }),
        });
        showToast(`Order → ${next.replace(/_/g, ' ')}`);
        loadOrders(); loadStats();
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }
  });

  // Message card click → mark as read + open
  $('#messagesList')?.addEventListener('click', async (e) => {
    const card = e.target.closest('.message-card');
    if (!card) return;
    const id = card.dataset.id;
    const msg = state.messages.find((m) => m.id === id);
    if (!msg) return;

    if (!msg.read) {
      try {
        await api(`/contact/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ read: true }),
        });
        msg.read = true;
        renderMessages();
        updateBadges();
      } catch (err) { showToast(err.message, 'error'); }
    }

    openMessageDetail(msg);
  });

  // Search & filter handlers
  $('#searchReservations')?.addEventListener('input', renderReservations);
  $('#filterReservations')?.addEventListener('change', renderReservations);
  $('#searchOrders')?.addEventListener('input', renderOrders);
  $('#filterOrders')?.addEventListener('change', renderOrders);
  $('#searchMessages')?.addEventListener('input', renderMessages);

  /* ---------------------------- DETAIL MODAL ---------------------------- */
  const modal = $('#detailModal');
  const modalBody = $('#detailBody');
  const modalClose = $('#detailClose');

  function openModal(html) {
    modalBody.innerHTML = html;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  modalClose?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  function openReservationDetail(id) {
    const r = state.reservations.find((x) => x.id === id);
    if (!r) return;
    openModal(`
      <h3 class="modal-title">Reservation Details</h3>
      <div class="detail-grid">
        <div class="detail-item"><label>Name</label><p>${escapeHtml(r.name)}</p></div>
        <div class="detail-item"><label>Status</label><p><span class="status ${r.status}">${r.status}</span></p></div>
        <div class="detail-item"><label>Email</label><p>${escapeHtml(r.email)}</p></div>
        <div class="detail-item"><label>Phone</label><p>${escapeHtml(r.phone)}</p></div>
        <div class="detail-item"><label>Date</label><p>${escapeHtml(r.date)}</p></div>
        <div class="detail-item"><label>Time</label><p>${escapeHtml(r.time)}</p></div>
        <div class="detail-item"><label>Guests</label><p>${r.guests}</p></div>
        <div class="detail-item"><label>Created</label><p>${fmtDate(r.createdAt)} at ${fmtTime(r.createdAt)}</p></div>
        ${r.message ? `<div class="detail-item full"><label>Message</label><p>${escapeHtml(r.message)}</p></div>` : ''}
      </div>
    `);
  }

  function openOrderDetail(id) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) return;
    const items = (o.items || []).map((it) => `
      <div class="order-line">
        <span>${escapeHtml(it.name)} × ${it.qty}</span>
        <span>${fmtMoney(it.price * it.qty)}</span>
      </div>
    `).join('');

    openModal(`
      <h3 class="modal-title">Order ${escapeHtml(o.id)}</h3>
      <div class="detail-grid">
        <div class="detail-item"><label>Status</label><p><span class="status ${o.status}">${o.status.replace(/_/g, ' ')}</span></p></div>
        <div class="detail-item"><label>Created</label><p>${fmtDate(o.createdAt)} at ${fmtTime(o.createdAt)}</p></div>
        <div class="detail-item full"><label>Customer</label><p>${escapeHtml(o.customer?.name || '—')}</p></div>
        <div class="detail-item"><label>Email</label><p>${escapeHtml(o.customer?.email || '—')}</p></div>
        <div class="detail-item"><label>Phone</label><p>${escapeHtml(o.customer?.phone || '—')}</p></div>
        <div class="detail-item full"><label>Delivery Address</label><p>${escapeHtml(o.customer?.address || '—')}</p></div>
        <div class="detail-item"><label>Payment</label><p>${escapeHtml(o.paymentMethod || '—')}</p></div>
      </div>
      <div class="order-items">
        <h4>Items</h4>
        ${items}
        <div class="order-total"><span>Total</span><span>${fmtMoney(o.pricing?.total)}</span></div>
      </div>
      ${o.notes ? `<div class="detail-item full" style="margin-top:1rem"><label>Notes</label><p>${escapeHtml(o.notes)}</p></div>` : ''}
    `);
  }

  function openMessageDetail(m) {
    openModal(`
      <h3 class="modal-title">Message from ${escapeHtml(m.name)}</h3>
      <div class="detail-grid">
        <div class="detail-item"><label>Email</label><p>${escapeHtml(m.email)}</p></div>
        <div class="detail-item"><label>Received</label><p>${fmtDate(m.createdAt)} at ${fmtTime(m.createdAt)}</p></div>
        ${m.subject ? `<div class="detail-item full"><label>Subject</label><p>${escapeHtml(m.subject)}</p></div>` : ''}
        <div class="detail-item full"><label>Message</label><p>${escapeHtml(m.message).replace(/\n/g, '<br>')}</p></div>
      </div>
      <div class="modal-actions">
        <a href="mailto:${encodeURIComponent(m.email)}" class="btn btn-primary">
          <i class="fa-solid fa-reply"></i> Reply
        </a>
        <button class="btn action-delete-msg" data-id="${m.id}" style="background:rgba(239,68,68,.15);color:var(--danger);">
          <i class="fa-regular fa-trash-can"></i> Delete
        </button>
      </div>
    `);

    modalBody.querySelector('.action-delete-msg')?.addEventListener('click', async function () {
      if (!confirm('Delete this message?')) return;
      try {
        await api(`/contact/${this.dataset.id}`, { method: 'DELETE' });
        showToast('Message deleted');
        closeModal();
        loadMessages(); loadStats();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  /* ---------------------------- REVEAL ANIMATIONS ---------------------------- */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
  );

  function observeReveals() {
    $$('.reveal').forEach((el) => revealObserver.observe(el));
  }

  /* ---------------------------- AUTO REFRESH ---------------------------- */
  let refreshInterval;
  function startAutoRefresh() {
    clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      if (document.hidden) return;
      if (state.currentView === 'overview') loadStats();
      if (state.currentView === 'reservations') loadReservations();
      if (state.currentView === 'orders') loadOrders();
      if (state.currentView === 'messages') loadMessages();
    }, 30000); // 30s
  }

  /* ---------------------------- INITIAL LOAD ---------------------------- */
  async function init() {
    observeReveals();

    const token = getToken();
    if (!token) {
      showLogin();
      return;
    }

    // Verify token
    try {
      const res = await fetch(`${CONFIG.API_BASE}/admin/me`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) throw new Error('Session expired');
      const json = await res.json();
      showDashboard(json.user);
      startAutoRefresh();
    } catch {
      clearAuth();
      showLogin();
    }
  }

  init();

})();