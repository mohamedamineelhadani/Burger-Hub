'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+\d][\d\s().-]{6,}$/;

function isString(v, { min = 1, max = 500 } = {}) {
  return typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
}

function isEmail(v) {
  return isString(v, { max: 254 }) && EMAIL_RE.test(v.trim());
}

function isPhone(v) {
  return isString(v, { max: 40 }) && PHONE_RE.test(v.trim());
}

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0 && v < 100;
}

function isIsoDate(v) {
  if (!isString(v, { max: 10 })) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

function isTime(v) {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

module.exports = {
  isString,
  isEmail,
  isPhone,
  isPositiveInt,
  isIsoDate,
  isTime,
};