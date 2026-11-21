"""Everything Xtools knows, in one SQLite file in the plugin's data folder."""
import json
import os
import sqlite3
import threading
import time

from . import env

_LOCK = threading.RLock()
_CONN = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);

-- Who the account is and how it plays: one row, JSON fields.
CREATE TABLE IF NOT EXISTS playbook (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT, updated_at REAL);

-- Our own posts: drafts, scheduled, published (with what they earned).
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY, kind TEXT, pillar TEXT, format TEXT, parts TEXT, source TEXT,
  status TEXT, due_at REAL, published_at REAL, url TEXT, error TEXT,
  views INTEGER, likes INTEGER, replies INTEGER, reposts INTEGER, bookmarks INTEGER, measured_at REAL,
  created_at REAL);

-- Actions toward other people's posts: reply, quote, like, follow.
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY, kind TEXT, target_url TEXT, target_handle TEXT, target_text TEXT,
  text TEXT, reason TEXT, status TEXT, due_at REAL, done_at REAL, result_url TEXT, error TEXT,
  created_at REAL);
CREATE INDEX IF NOT EXISTS actions_status ON actions(status, due_at);

-- Posts seen in the niche: from watched accounts, keywords, mentions.
CREATE TABLE IF NOT EXISTS seen (
  url TEXT PRIMARY KEY, handle TEXT, text TEXT, at REAL, source TEXT,
  views INTEGER, likes INTEGER, replies INTEGER, reposts INTEGER, captured_at REAL, used TEXT);

-- Follower counts over time.
CREATE TABLE IF NOT EXISTS snapshots (at REAL, followers INTEGER, following INTEGER);

-- What happened, for the page and the weekly report.
CREATE TABLE IF NOT EXISTS log (at REAL, level TEXT, what TEXT);
"""


def conn():
    global _CONN
    with _LOCK:
        if _CONN is None:
            _CONN = sqlite3.connect(os.path.join(env.data_dir(), 'xtools.db'), check_same_thread=False)
            _CONN.row_factory = sqlite3.Row
            _CONN.executescript(SCHEMA)
            have = {r[1] for r in _CONN.execute('PRAGMA table_info(actions)')}
            for col in ('views', 'likes', 'replies', 'measured_at'):      # added in 2.1: how our replies did
                if col not in have:
                    _CONN.execute('ALTER TABLE actions ADD COLUMN %s %s' % (col, 'REAL' if col == 'measured_at' else 'INTEGER'))
            _CONN.commit()
        return _CONN


def q(sql, args=()):
    with _LOCK:
        return [dict(r) for r in conn().execute(sql, args).fetchall()]


def one(sql, args=()):
    rows = q(sql, args)
    return rows[0] if rows else None


def run(sql, args=()):
    with _LOCK:
        c = conn().execute(sql, args)
        conn().commit()
        return c.lastrowid


def kv_get(k, default=None):
    r = one('SELECT v FROM kv WHERE k=?', (k,))
    return json.loads(r['v']) if r else default


def kv_set(k, v):
    run('INSERT INTO kv(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', (k, json.dumps(v, ensure_ascii=False)))


def log(what, level='info'):
    run('INSERT INTO log(at, level, what) VALUES(?, ?, ?)', (time.time(), level, what))
    print(time.strftime('%H:%M:%S'), level, what, flush=True)


def playbook():
    r = one('SELECT data FROM playbook WHERE id=1')
    return json.loads(r['data']) if r else {}


def save_playbook(data):
    run('INSERT INTO playbook(id, data, updated_at) VALUES(1, ?, ?) '
        'ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at',
        (json.dumps(data, ensure_ascii=False), time.time()))


def today_start(tz_hours=None):
    """Start of today in the account's main audience time zone, as a timestamp."""
    off = tz_hours if tz_hours is not None else main_tz()
    now = time.time() + off * 3600
    return now - (now % 86400) - off * 3600


def main_tz():
    from . import clock
    zones = clock.zones()
    return zones[0] if zones else 0.0


def count_today(table, kind_col, kind, status_col='status', done=('done', 'published')):
    start = today_start()
    marks = ','.join('?' * len(done))
    time_col = 'done_at' if table == 'actions' else 'published_at'
    r = one('SELECT COUNT(*) n FROM %s WHERE %s=? AND %s IN (%s) AND %s>=?' % (table, kind_col, status_col, marks, time_col),
            (kind, *done, start))
    return r['n'] if r else 0
