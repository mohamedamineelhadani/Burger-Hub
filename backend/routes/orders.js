'use strict';

const express = require('express');
const crypto  = require('crypto');
const JsonStore = require('../utils/store');
const v = require('../utils/validate');

const router = express.Router();
const store  = new JsonStore('orders.json');

const { requireAuth } = require('../middleware/auth');

/* -------------------------- Pricing constants -------------------------- */
const TAX_RATE  = 0.10; // 10% tax
const DELIVERY  = 3.50; // flat delivery fee
const FREE_FROM = 30;   // free delivery over this subtotal

/* ------------------------------- CREATE ------------------------------- */
router.post('/', async (req, res, next) => {
  try {
    const {
      customer = {},
      items = [],
      notes = '',
      paymentMethod = 'cash',
    } = req.body || {};

    const errors = [];

    /* Customer validation */
    if (!v.isString(customer.name, { min: 2, max: 80 })) errors.push('Invalid name');
    if (!v.isEmail(customer.email))                      errors.push('Invalid email');
    if (!v.isPhone(customer.phone))                      errors.push('Invalid phone');
    if (!v.isString(customer.address, { min: 5, max: 200 })) errors.push('Invalid address');

    /* Items validation */
    if (!Array.isArray(items) || items.length === 0) {
      errors.push('Cart is empty');
    } else {
      items.forEach((it, i) => {
        if (!v.isString(it.id, { max: 64 }))      errors.push(`items[${i}].id invalid`);
        if (!v.isString(it.name, { max: 120 }))   errors.push(`items[${i}].name invalid`);
        if (typeof it.price !== 'number' || it.price < 0) errors.push(`items[${i}].price invalid`);
        if (!v.isPositiveInt(it.qty))             errors.push(`items[${i}].qty invalid`);
      });
    }

    if (!['cash', 'card'].includes(paymentMethod)) {
      errors.push('Invalid payment method');
    }

    if (errors.length) {
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }

    /* Recompute totals server-side (never trust the client) */
    const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const delivery = subtotal >= FREE_FROM ? 0 : DELIVERY;
    const tax      = +(subtotal * TAX_RATE).toFixed(2);
    const total    = +(subtotal + delivery + tax).toFixed(2);

    const record = {
      id: 'ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      customer: {
        name:    customer.name.trim(),
        email:   customer.email.trim().toLowerCase(),
        phone:   customer.phone.trim(),
        address: customer.address.trim(),
      },
      items: items.map((it) => ({
        id:    it.id,
        name:  it.name,
        price: it.price,
        qty:   it.qty,
      })),
      pricing: {
        subtotal: +subtotal.toFixed(2),
        delivery,
        tax,
        total,
      },
      notes: notes.trim().slice(0, 300),
      paymentMethod,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.add(record);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- LIST -------------------------------- */
router.get('/', requireAuth ,  async (_req, res, next) => {
  try {
    const all = await store.all();
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ success: true, count: all.length, data: all });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- GET ONE ----------------------------- */
router.get('/:id', requireAuth , async (req, res, next) => {
  try {
    const o = await store.findById(req.params.id);
    if (!o) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: o });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- UPDATE ------------------------------ */
router.patch('/:id', requireAuth , async (req, res, next) => {
  try {
    const allowed = ['status'];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];

    if (patch.status && !['pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].includes(patch.status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updated = await store.update(req.params.id, patch);
    if (!updated) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- DELETE ------------------------------ */
router.delete('/:id', requireAuth , async (req, res, next) => {
  try {
    const ok = await store.remove(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;