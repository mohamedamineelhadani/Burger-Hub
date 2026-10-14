'use strict';

const express   = require('express');
const rateLimit = require('express-rate-limit');
const { sign, requireAuth } = require('../middleware/auth');
const JsonStore = require('../utils/store');

const router = express.Router();

const reservationsStore = new JsonStore('reservations.json');
const ordersStore       = new JsonStore('orders.json');
const contactStore      = new JsonStore('contact-messages.json');

/* ---------------------- Strict rate limit on login ---------------------- */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
});

/* -------------------------------- LOGIN -------------------------------- */
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};

  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.trim() !== ADMIN_USER ||
    password !== ADMIN_PASS
  ) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const token = sign({ username: ADMIN_USER, role: 'admin' });
  res.json({
    success: true,
    token,
    user: { username: ADMIN_USER, role: 'admin' },
  });
});

/* --------------------------------- ME ---------------------------------- */
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.admin });
});

/* ------------------------------- STATS --------------------------------- */
router.get('/stats', requireAuth, async (_req, res, next) => {
  try {
    const [r, o, c] = await Promise.all([
      reservationsStore.all(),
      ordersStore.all(),
      contactStore.all(),
    ]);

    const revenue = o
      .filter((x) => x.status !== 'cancelled')
      .reduce((sum, x) => sum + (x.pricing?.total || 0), 0);

    // Last 7 days revenue trend
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayRev = o
        .filter((x) => (x.createdAt || '').slice(0, 10) === key && x.status !== 'cancelled')
        .reduce((sum, x) => sum + (x.pricing?.total || 0), 0);
      days.push({ date: key, revenue: +dayRev.toFixed(2) });
    }

    res.json({
      success: true,
      data: {
        totals: {
          orders:       o.length,
          revenue:      +revenue.toFixed(2),
          reservations: r.length,
          messages:     c.length,
        },
        pending: {
          ordersPending:      o.filter((x) => x.status === 'pending').length,
          reservationsPending: r.filter((x) => x.status === 'pending').length,
          unreadMessages:     c.filter((x) => !x.read).length,
        },
        revenue7d: days,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;