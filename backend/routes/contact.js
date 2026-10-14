'use strict';

const express   = require('express');
const crypto    = require('crypto');
const JsonStore = require('../utils/store');
const v         = require('../utils/validate');

const router = express.Router();
const store  = new JsonStore('contact-messages.json');

const { requireAuth } = require('../middleware/auth');

/* ------------------------------ CREATE ------------------------------ */
router.post('/', async (req, res, next) => {
  try {
    const { name, email, subject = '', message } = req.body || {};

    const errors = [];
    if (!v.isString(name,    { min: 2, max: 80 }))  errors.push('Invalid name');
    if (!v.isEmail(email))                          errors.push('Invalid email');
    if (!v.isString(message, { min: 5, max: 1000 })) errors.push('Message must be 5–1000 chars');
    if (subject && !v.isString(subject, { max: 120 })) errors.push('Subject too long');

    if (errors.length) {
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }

    const record = {
      id: 'MSG-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      read:    false,
      createdAt: new Date().toISOString(),
    };

    await store.add(record);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------- LIST ------------------------------- */
router.get('/' , requireAuth , async (_req, res, next) => {
  try {
    const all = await store.all();
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ success: true, count: all.length, data: all });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------- GET ONE ----------------------------- */
router.get('/:id', requireAuth , async (req, res, next) => {
  try {
    const msg = await store.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });
    res.json({ success: true, data: msg });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ UPDATE ------------------------------ */
router.patch('/:id', requireAuth , async (req, res, next) => {
  try {
    const patch = {};
    if ('read' in req.body) patch.read = Boolean(req.body.read);
    const updated = await store.update(req.params.id, patch);
    if (!updated) return res.status(404).json({ success: false, error: 'Message not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ DELETE ------------------------------ */
router.delete('/:id', requireAuth , async (req, res, next) => {
  try {
    const ok = await store.remove(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Message not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;