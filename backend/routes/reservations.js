'use strict';

const express = require('express');
const crypto  = require('crypto');
const JsonStore = require('../utils/store');
const v = require('../utils/validate');

const router = express.Router();
const store  = new JsonStore('reservations.json');
const { requireAuth } = require('../middleware/auth');

const MAX_PER_SLOT = 4; // reservations per same date+time

/* ------------------------------- CREATE ------------------------------- */
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, date, time, message = '', guests = 2 } = req.body || {};

    const errors = [];
    if (!v.isString(name,  { min: 2, max: 80 }))  errors.push('Invalid name');
    if (!v.isEmail(email))                        errors.push('Invalid email');
    if (!v.isPhone(phone))                        errors.push('Invalid phone');
    if (!v.isIsoDate(date))                       errors.push('Invalid date');
    if (!v.isTime(time))                          errors.push('Invalid time (HH:MM)');
    if (!v.isPositiveInt(Number(guests)))         errors.push('Invalid guests count');
    if (message && !v.isString(message, { max: 500 })) errors.push('Message too long');

    if (errors.length) {
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }

    // Prevent double bookings on same date+time (soft cap)
    const all = await store.all();
    const slotCount = all.filter(
      (r) => r.date === date && r.time === time && r.status !== 'cancelled'
    ).length;

    if (slotCount >= MAX_PER_SLOT) {
      return res.status(409).json({
        success: false,
        error: 'This time slot is fully booked. Please choose another.',
      });
    }

    const record = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      date,
      time,
      guests: Number(guests),
      message: message.trim(),
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
router.get('/', requireAuth , async (_req, res, next) => {
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
    const r = await store.findById(req.params.id);
    if (!r) return res.status(404).json({ success: false, error: 'Reservation not found' });
    res.json({ success: true, data: r });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- UPDATE ------------------------------ */
router.patch('/:id', requireAuth , async (req, res, next) => {
  try {
    const allowed = ['status', 'date', 'time', 'guests', 'message'];
    const patch = {};
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key];
    }
    if (patch.status && !['pending', 'confirmed', 'cancelled'].includes(patch.status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    const updated = await store.update(req.params.id, patch);
    if (!updated) return res.status(404).json({ success: false, error: 'Reservation not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- DELETE ------------------------------ */
router.delete('/:id', requireAuth , async (req, res, next) => {
  try {
    const ok = await store.remove(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Reservation not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;