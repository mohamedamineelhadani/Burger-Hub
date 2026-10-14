'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const reservationsRouter = require('./routes/reservations');
const ordersRouter       = require('./routes/orders');
const contactRouter = require('./routes/contact');
const adminRouter = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 5000;

/* ------------------------- Security & middleware ------------------------- */
app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / curl / Postman (no origin) and whitelist
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS: ' + origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* --------------------------- Rate limiting --------------------------- */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

app.use('/api', apiLimiter);

/* ------------------------------- Routes ------------------------------- */
app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});


app.use('/api/admin', adminRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/contact', contactRouter);

/* ------------------------- Static (optional) ------------------------- */
// Serve the frontend if you drop it into ../public
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

/* ---------------------------- 404 & errors ---------------------------- */
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

/* -------------------------------- Start -------------------------------- */
app.listen(PORT, () => {
  console.log(`BurgerHub API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});