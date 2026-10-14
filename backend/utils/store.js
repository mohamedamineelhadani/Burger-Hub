'use strict';

const fs   = require('fs');
const path = require('path');

class JsonStore {
  constructor(fileName) {
    this.filePath = path.join(__dirname, '..', 'data', fileName);
    this.queue    = Promise.resolve();
    this._ensure();
  }

  _ensure() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, '[]', 'utf8');
  }

  _readSync() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  _writeSync(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  /** Queue-safe mutation */
  _enqueue(fn) {
    this.queue = this.queue.then(() => Promise.resolve(fn()));
    return this.queue;
  }

  all() {
    return this._enqueue(() => this._readSync());
  }

  findById(id) {
    return this._enqueue(() => this._readSync().find((r) => r.id === id) || null);
  }

  add(record) {
    return this._enqueue(() => {
      const data = this._readSync();
      data.push(record);
      this._writeSync(data);
      return record;
    });
  }

  update(id, patch) {
    return this._enqueue(() => {
      const data = this._readSync();
      const idx  = data.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      data[idx] = { ...data[idx], ...patch, updatedAt: new Date().toISOString() };
      this._writeSync(data);
      return data[idx];
    });
  }

  remove(id) {
    return this._enqueue(() => {
      const data = this._readSync();
      const next = data.filter((r) => r.id !== id);
      const removed = next.length !== data.length;
      if (removed) this._writeSync(next);
      return removed;
    });
  }
}

module.exports = JsonStore;