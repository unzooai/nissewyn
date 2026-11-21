"""Xtools: the control page and its API, plus the scheduler. Standard library only."""
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from xt import browser, clock, db, engine, env, playbook, scheduler, stats  # noqa: E402

WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')


def background(name, fn, *args):
    threading.Thread(target=scheduler.run_job, args=(name, fn) + args, daemon=True).start()
    return {'ok': True, 'started': name}


JOBS = {
    'plan': ('写今天的原创', engine.plan_day),
    'radar': ('领域雷达', engine.radar),
    'frontrow': ('起草前排回复', engine.frontrow),
    'mentions': ('看读者通知', engine.mentions),
    'quotes': ('起草引用', engine.quotes),
    'follows': ('找要关注的人', engine.discover_follows),
    'session': ('互动会话', engine.session),
    'publish': ('到点发原创', engine.publish_due),
    'measure': ('记录数据', engine.measure),
    'learn': ('周报', engine.weekly_learn),
}


def _post_view(r):
    r = dict(r)
    r['parts'] = json.loads(r['parts'] or '[]')
    r['due'] = clock.fmt(r['due_at']) if r.get('due_at') else None
    return r


def state():
    book = db.playbook()
    start = db.today_start()
    snaps = db.q('SELECT at, followers FROM snapshots ORDER BY at DESC LIMIT 30')[::-1]
    sessions = db.kv_get('sessions') or {}
    return {
        'setup': bool(book.get('pillars')),
        'handle': (book.get('learned') or {}).get('handle'),
        'profile_bound': bool(env.browser_profile()),
        'in_unzoo_one': env.in_unzoo_one(),
        'browser': browser.reachable(),
        'halted': engine.halted(),
        'running': scheduler.running(),
        'awake': clock.audience_awake(),
        'automation': {k: env.automation(k) for k in ('posts', 'mentions', 'replies', 'quotes', 'likes', 'follows')},
        'today': {
            'posts': [_post_view(r) for r in db.q("SELECT * FROM posts WHERE (due_at>=? OR status='draft' OR published_at>=?) "
                                                  "ORDER BY COALESCE(due_at, created_at)", (start, start))],
            'done': {k: db.count_today('actions', 'kind', k, done=('done',)) for k in engine.KINDS},
            'left': {k: engine.cap_left(k) for k in ('post',) + engine.KINDS},
            'sessions': [{'at': clock.fmt(t), 'done': t in sessions.get('done', [])} for t in sessions.get('at', [])],
        },
        'queue': {s: db.one('SELECT COUNT(*) n FROM actions WHERE status=?', (s,))['n'] for s in ('pending', 'queued')},
        'followers': snaps,
        'log': db.q('SELECT at, level, what FROM log ORDER BY at DESC LIMIT 40'),
        'timezones': env.setting('audience.timezones'),
        'warmup': _warmup_view(book),
        'status': _status(book, sessions),
    }


def _status(book, sessions):
    """Is it running, in one line: state (on / working / waiting / off / problem), what, next."""
    now, beat, job = time.time(), scheduler.heartbeat(), scheduler.running()
    nxt = []
    p = db.one("SELECT due_at FROM posts WHERE status='scheduled' ORDER BY due_at LIMIT 1")
    if p:
        nxt.append((p['due_at'], '发原创'))
    nxt += [(t, '互动会话') for t in sessions.get('at', []) if t > now and t not in sessions.get('done', [])]
    nxt.sort()
    nxt = '%s %s' % (clock.fmt(nxt[0][0]), nxt[0][1]) if nxt else ''
    def out(state, text, detail=''):
        return {'state': state, 'text': text, 'detail': detail, 'next': nxt,
                'beat': beat['at'], 'job': job['job'], 'since': job['since']}
    if os.environ.get('XTOOLS_NO_SCHEDULER'):
        return out('off', '没有在运行', '自动调度被关掉了(XTOOLS_NO_SCHEDULER),只能手动操作')
    if job['job']:
        return out('working', '运行中 · 正在' + job['job'], '已经 %d 秒' % (now - job['since']))
    if not book.get('pillars'):
        return out('off', '还没开始', '先在下面完成设置,完成后自动开始')
    if env.setting('paused'):
        return out('off', '已暂停', '在 Unzoo One › 插件 › Xtools › 设置 里关掉「全部暂停」就继续')
    h = engine.halted()
    if h:
        return out('problem', '已停下', h)
    if not beat['at'] or now - beat['at'] > 180:
        return out('problem', '调度没有在跑', '超过 3 分钟没有动静;到 Unzoo One 里把 Xtools 关掉再打开')
    if beat['idle'] == 'no_browser':
        return out('problem', '等浏览器', 'Unzoo 浏览器没有响应,连上后自动继续')
    if beat['idle'] == 'error':
        return out('problem', '运行中 · 上一轮出错', '看下面「最近」里的记录')
    if beat['idle'] == 'asleep':
        return out('on', '运行中 · 读者在睡觉', '这段时间只按时发原创,不互动')
    return out('on', '运行中 · 等下一件事', '每分钟检查一次')


def _warmup_view(book):
    w = engine.warmup()
    if not w:
        return None
    prof = (book.get('learned') or {}).get('profile') or {}
    todo = []
    if prof.get('default_avatar'):
        todo.append('换一张真实的头像')
    if prof.get('banner') is False:
        todo.append('加一张横幅图')
    if not (prof.get('bio') or '').strip():
        todo.append('写一句简介:你是谁、关注你能看到什么')
    return {**w, 'next': clock.fmt(w['next_at']), 'end': clock.fmt(w['end_at']), 'todo': todo,
            'mode': env.setting('warmup.mode'), 'new_account': engine.is_new_account(book)}


def handle_get(path, qs):
    one = lambda k, d=None: (qs.get(k) or [d])[0]
    if path == '/api/ping':
        return {'ok': True, 'app': 'xtools'}
    if path == '/api/state':
        return state()
    if path == '/api/playbook':
        return db.playbook()
    if path == '/api/stats':
        return stats.stats(max(1, min(90, int(one('days', 30)))))
    if path == '/api/posts':
        st = one('status')
        rows = db.q('SELECT * FROM posts WHERE status=? ORDER BY id DESC LIMIT 100', (st,)) if st else \
            db.q('SELECT * FROM posts ORDER BY id DESC LIMIT 100')
        return {'items': [_post_view(r) for r in rows]}
    if path == '/api/actions':
        st = one('status', 'pending')
        return {'items': db.q('SELECT * FROM actions WHERE status=? ORDER BY id DESC LIMIT 200', (st,))}
    if path == '/api/seen':
        return {'items': db.q('SELECT * FROM seen ORDER BY captured_at DESC LIMIT 150')}
    if path == '/api/log':
        return {'items': db.q('SELECT * FROM log ORDER BY at DESC LIMIT 300')}
    return None


def handle_post(path, body):
    if path == '/api/setup':
        about = {k: (body.get(k) or '').strip() for k in ('who', 'audience', 'goal')}
        return background('读账号、生成打法', playbook.setup, about)
    if path == '/api/playbook':
        book = db.playbook()
        for k in ('positioning', 'voice', 'pillars', 'keywords', 'watch', 'language', 'about'):
            if k in body:
                book[k] = body[k]
        db.save_playbook(book)
        return {'ok': True}
    if path == '/api/run':
        job = JOBS.get(body.get('job'))
        if not job:
            return {'ok': False, 'error': 'unknown job'}
        return background(*job)
    if path == '/api/posts/publish':
        return background('发一条原创', engine.publish_due, int(body['id']))
    if path == '/api/warmup':
        if body.get('action') == 'end':
            db.kv_set('warmup_ended', True)
            db.log('养号期提前结束')
        elif body.get('action') == 'restart':
            db.kv_set('warmup_ended', None)
            db.kv_set('warmup_start', time.time())
            db.log('养号期从今天重新开始')
        return {'ok': True}
    if path == '/api/resume':
        db.kv_set('halt', None)
        db.log('已恢复自动运行')
        return {'ok': True}
    if path == '/api/posts/write':
        def write():
            book = db.playbook()
            pillar = next((p for p in book.get('pillars', []) if p['name'] == body.get('pillar')), None)
            pid = engine.add_post(engine.write_post(pillar, body.get('format'), body.get('extra', '')))
            db.log('写好一条草稿 #%d' % pid)
        return background('写一条原创', write)
    if path == '/api/posts/save':
        db.run('UPDATE posts SET parts=? WHERE id=?', (json.dumps(body['parts'], ensure_ascii=False), body['id']))
        return {'ok': True}
    if path == '/api/posts/schedule':
        due = body.get('due_at') or time.time() + 60
        db.run("UPDATE posts SET status='scheduled', due_at=? WHERE id=? AND status IN ('draft','failed','scheduled')", (due, body['id']))
        return {'ok': True}
    if path == '/api/posts/unschedule':
        db.run("UPDATE posts SET status='draft' WHERE id=? AND status='scheduled'", (body['id'],))
        return {'ok': True}
    if path == '/api/posts/delete':
        db.run("DELETE FROM posts WHERE id=? AND status!='published'", (body['id'],))
        return {'ok': True}
    if path == '/api/actions/approve':
        for i in body.get('ids') or []:
            db.run("UPDATE actions SET status='queued', due_at=? WHERE id=? AND status='pending'", (time.time(), i))
        return {'ok': True}
    if path == '/api/actions/reject':
        for i in body.get('ids') or []:
            db.run("UPDATE actions SET status='rejected' WHERE id=? AND status IN ('pending','queued')", (i,))
        return {'ok': True}
    if path == '/api/actions/edit':
        db.run("UPDATE actions SET text=? WHERE id=? AND status IN ('pending','queued')", (body.get('text', ''), body['id']))
        return {'ok': True}
    return None


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, data, ctype='application/json; charset=utf-8'):
        raw = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False, default=str).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.startswith('/api/'):
            try:
                out = handle_get(u.path, parse_qs(u.query))
            except Exception as e:
                return self._send(500, {'ok': False, 'error': str(e)})
            return self._send(200 if out is not None else 404, out if out is not None else {'error': 'not found'})
        name = 'index.html' if u.path in ('/', '') else u.path.lstrip('/')
        f = os.path.normpath(os.path.join(WEB, name))
        if not f.startswith(WEB) or not os.path.isfile(f):
            return self._send(404, {'error': 'not found'})
        ctype = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                 '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml'}.get(os.path.splitext(f)[1], 'application/octet-stream')
        with open(f, 'rb') as fh:
            self._send(200, fh.read(), ctype)

    def do_POST(self):
        u = urlparse(self.path)
        n = int(self.headers.get('Content-Length') or 0)
        try:
            body = json.loads(self.rfile.read(n) or b'{}') if n else {}
            out = handle_post(u.path, body)
        except Exception as e:
            return self._send(500, {'ok': False, 'error': str(e)})
        self._send(200 if out is not None else 404, out if out is not None else {'error': 'not found'})


def main():
    db.conn()
    if not os.environ.get('XTOOLS_NO_SCHEDULER'):
        scheduler.start()
    srv = ThreadingHTTPServer(('127.0.0.1', env.port()), H)
    print('Xtools on http://127.0.0.1:%d/' % env.port(), flush=True)
    try:
        srv.serve_forever()
    finally:
        browser.close()


if __name__ == '__main__':
    main()
