/* ==========================================================================
   BURGERHUB — Cart & Checkout
   Persists in localStorage · Talks to Express backend
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------- CONFIG ---------------------------- */
  const CONFIG = {
    API_BASE: 'http://localhost:5000/api', // change in production
    CURRENCY: '$',
    TAX_RATE: 0.10,
    DELIVERY: 3.50,
    FREE_FROM: 30,
    STORAGE_KEY: 'burgerhub-cart-v1',
  };

  /* ---------------------------- HELPERS ---------------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const fmt = (n) => CONFIG.CURRENCY + Number(n).toFixed(2);

  const safeParse = (str, fallback) => {
    try { return JSON.parse(str); } catch { return fallback; }
  };

  /* ---------------------------- STATE ---------------------------- */
  let cart = safeParse(localStorage.getItem(CONFIG.STORAGE_KEY), []) || [];
  if (!Array.isArray(cart)) cart = [];

  function save() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(cart));
  }

  /* ---------------------------- DOM ---------------------------- */
  const cartBtn      = $('#cartBtn');
  const cartCount    = $('#cartCount');
  const cartDrawer   = $('#cartDrawer');
  const cartBody     = $('#cartBody');
  const cartFooter   = $('#cartFooter');
  const cartBackdrop = $('#cartBackdrop');
  const cartClose    = $('#cartClose');
  const cartEmptyBtn = $('#cartEmptyBtn');

  const checkoutBtn  = $('#checkoutBtn');
  const modal        = $('#checkoutModal');
  const modalClose   = $('#checkoutClose');
  const checkoutForm = $('#checkoutForm');
  const successBox   = $('#checkoutSuccess');
  const successClose = $('#successClose');
  const orderIdLabel = $('#orderIdLabel');
  const placeBtn     = $('#placeOrderBtn');

  /* ---------------------------- CALC ---------------------------- */
  function calc() {
    const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
    const delivery = subtotal >= CONFIG.FREE_FROM || subtotal === 0 ? 0 : CONFIG.DELIVERY;
    const tax      = +(subtotal * CONFIG.TAX_RATE).toFixed(2);
    const total    = +(subtotal + delivery + tax).toFixed(2);
    return { subtotal: +subtotal.toFixed(2), delivery, tax, total };
  }

  /* ---------------------------- RENDER ---------------------------- */
  function render() {
    const count = cart.reduce((s, it) => s + it.qty, 0);

    // Cart badge
    if (cartCount) {
      cartCount.textContent = count;
      cartCount.hidden = count === 0;
    }

    // Empty state
    cartDrawer.classList.toggle('empty', cart.length === 0);

    // Items
    if (cart.length === 0) {
      cartBody.innerHTML = '';
      cartFooter.hidden = true;
      return;
    }

    cartFooter.hidden = false;

    cartBody.innerHTML = cart
      .map(
        (it) => `
      <div class="cart-item" data-id="${it.id}">
        <img src="${it.image}" alt="${it.name}">
        <div class="cart-item-info">
          <h4>${it.name}</h4>
          <span class="price">${fmt(it.price)}</span>
        </div>
        <div class="cart-item-actions">
          <button class="cart-remove" data-action="remove" aria-label="Remove">
            <i class="fa-regular fa-trash-can"></i>
          </button>
          <div class="qty">
            <button data-action="dec" aria-label="Decrease">−</button>
            <span>${it.qty}</span>
            <button data-action="inc" aria-label="Increase">+</button>
          </div>
        </div>
      </div>`
      )
      .join('');

    // Totals
    const t = calc();
    $('#cartSubtotal').textContent = fmt(t.subtotal);
    $('#cartDelivery').textContent = t.delivery === 0 ? 'FREE' : fmt(t.delivery);
    $('#cartTax').textContent      = fmt(t.tax);
    $('#cartTotal').textContent    = fmt(t.total);

    // Checkout modal summary too
    $('#checkoutSubtotal').textContent = fmt(t.subtotal);
    $('#checkoutDelivery').textContent = t.delivery === 0 ? 'FREE' : fmt(t.delivery);
    $('#checkoutTax').textContent      = fmt(t.tax);
    $('#checkoutTotal').textContent    = fmt(t.total);
  }

  /* ---------------------------- ACTIONS ---------------------------- */
  function addToCart(item) {
    const existing = cart.find((x) => x.id === item.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...item, qty: 1 });
    }
    save();
    render();
    bumpCartIcon();
  }

  function updateQty(id, delta) {
    const it = cart.find((x) => x.id === id);
    if (!it) return;
    it.qty += delta;
    if (it.qty <= 0) cart = cart.filter((x) => x.id !== id);
    save();
    render();
  }

  function removeItem(id) {
    cart = cart.filter((x) => x.id !== id);
    save();
    render();
  }

  function bumpCartIcon() {
    if (!cartBtn) return;
    cartBtn.animate(
      [
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(1.25) rotate(-12deg)' },
        { transform: 'scale(1) rotate(0deg)' },
      ],
      { duration: 480, easing: 'cubic-bezier(.34,1.56,.64,1)' }
    );
  }

  /* ---------------------------- DRAWER ---------------------------- */
  function openCart() {
    cartDrawer.classList.add('active');
    cartBackdrop.classList.add('active');
    cartDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    cartDrawer.classList.remove('active');
    cartBackdrop.classList.remove('active');
    cartDrawer.setAttribute('aria-hidden', 'true');
    if (!modal.classList.contains('active')) {
      document.body.style.overflow = '';
    }
  }

  /* ---------------------------- MODAL ---------------------------- */
  function openModal() {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    successBox.hidden = true;
    checkoutForm.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ---------------------------- EVENTS ---------------------------- */

  // Add-to-cart buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-order[data-id]');
    if (!btn) return;
    addToCart({
      id:    btn.dataset.id,
      name:  btn.dataset.name,
      price: parseFloat(btn.dataset.price),
      image: btn.dataset.image || './image/burger1.jpg',
    });

    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
    setTimeout(() => { btn.innerHTML = original; }, 1200);
  });

  // Cart drawer interactions
  cartBody?.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const row = actionBtn.closest('.cart-item');
    const id  = row.dataset.id;
    const action = actionBtn.dataset.action;

    if (action === 'inc')    updateQty(id, +1);
    if (action === 'dec')    updateQty(id, -1);
    if (action === 'remove') removeItem(id);
  });

  // Open / close drawer
  cartBtn?.addEventListener('click', openCart);
  cartClose?.addEventListener('click', closeCart);
  cartBackdrop?.addEventListener('click', closeCart);
  cartEmptyBtn?.addEventListener('click', closeCart);

  // Open checkout
  checkoutBtn?.addEventListener('click', () => {
    if (cart.length === 0) return;
    closeCart();
    openModal();
  });

  modalClose?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal.classList.contains('active')) closeModal();
      else if (cartDrawer.classList.contains('active')) closeCart();
    }
  });

  /* ---------------------------- CHECKOUT SUBMIT ---------------------------- */
  checkoutForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const fd = new FormData(checkoutForm);
    const customer = {
      name:    (fd.get('name')    || '').toString().trim(),
      email:   (fd.get('email')   || '').toString().trim(),
      phone:   (fd.get('phone')   || '').toString().trim(),
      address: (fd.get('address') || '').toString().trim(),
    };
    const notes         = (fd.get('notes') || '').toString().trim();
    const paymentMethod = (fd.get('paymentMethod') || 'cash').toString();

    // Basic client-side validation
    if (!customer.name || customer.name.length < 2)
      return alert('Please enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email))
      return alert('Please enter a valid email.');
    if (!customer.phone || customer.phone.length < 6)
      return alert('Please enter a valid phone number.');
    if (!customer.address || customer.address.length < 5)
      return alert('Please enter a delivery address.');

    const original = placeBtn.innerHTML;
    placeBtn.disabled = true;
    placeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Placing order…';

    try {
      const res = await fetch(`${CONFIG.API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          items: cart.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
          notes,
          paymentMethod,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to place order');
      }

      // Success
      orderIdLabel.textContent = json.data.id;
      checkoutForm.hidden = true;
      successBox.hidden = false;

      // Clear cart
      cart = [];
      save();
      render();
    } catch (err) {
      console.error(err);
      alert('Sorry, something went wrong: ' + err.message);
      placeBtn.disabled = false;
      placeBtn.innerHTML = original;
    }
  });

  // Success close
  successClose?.addEventListener('click', () => {
    closeModal();
    // Reset form for next time
    checkoutForm.reset();
    checkoutForm.hidden = false;
    successBox.hidden = true;
    if (placeBtn) {
      placeBtn.disabled = false;
      placeBtn.innerHTML = 'Place Order <i class="fa-solid fa-check"></i>';
    }
  });

  /* ---------------------------- INIT ---------------------------- */
  render();

  // Sync cart across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === CONFIG.STORAGE_KEY) {
      cart = safeParse(e.newValue, []) || [];
      if (!Array.isArray(cart)) cart = [];
      render();
    }
  });
})();