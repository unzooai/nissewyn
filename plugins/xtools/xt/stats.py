"""The numbers page: followers over time, what Xtools did each day, and what it earned."""
import json
import time

from . import clock, db, playbook


def _avg(rows, key):
    vals = [r[key] or 0 for r in rows]
    return round(sum(vals) / len(vals)) if vals else 0


def _group(rows, key):
    out = {}
    for r in rows:
        out.setdefault(r[key] if r[key] is not None else '?', []).append(r)
    return [{'name': k, 'n': len(v), 'views': _avg(v, 'views'), 'likes': _avg(v, 'likes'),
             'score': round(sum(playbook.score(r) for r in v) / len(v), 1)} for k, v in out.items()]


def stats(days=30):
    now = time.time()
    since = now - days * 86400
    today = db.today_start()
    tz = clock.zones()[0]

    # Followers: the last reading of each day.
    by_day = {}
    for s in db.q('SELECT at, followers, following FROM snapshots WHERE at>? ORDER BY at', (since,)):
        by_day[clock.fmt(s['at'])[:5]] = s
    followers = [{'day': d, 'followers': s['followers'], 'following': s['following']} for d, s in by_day.items()]
    def gain(n):
        old = db.one('SELECT followers FROM snapshots WHERE at<=? ORDER BY at DESC LIMIT 1', (now - n * 86400,)) or \
            db.one('SELECT followers FROM snapshots WHERE at>? ORDER BY at LIMIT 1', (now - n * 86400,))
        last = db.one('SELECT followers FROM snapshots ORDER BY at DESC LIMIT 1')
        return (last['followers'] - old['followers']) if old and last else None

    # What was done, per day (oldest first).
    activity = [{'day': clock.fmt(today - i * 86400)[:5], 'post': 0, 'reply': 0, 'quote': 0, 'like': 0, 'follow': 0}
                for i in range(min(days, 30) - 1, -1, -1)]
    index = {a['day']: a for a in activity}
    for r in db.q("SELECT published_at t FROM posts WHERE status='published' AND published_at>?", (since,)):
        a = index.get(clock.fmt(r['t'])[:5])
        if a:
            a['post'] += 1
    for r in db.q("SELECT kind, done_at t FROM actions WHERE status='done' AND done_at>?", (since,)):
        a = index.get(clock.fmt(r['t'])[:5])
        if a and r['kind'] in a:
            a[r['kind']] += 1
    totals = {k: sum(a[k] for a in activity) for k in ('post', 'reply', 'quote', 'like', 'follow')}
    failed = db.one("SELECT COUNT(*) n FROM actions WHERE status='failed' AND done_at>?", (since,))['n'] + \
        db.one("SELECT COUNT(*) n FROM posts WHERE status='failed' AND created_at>?", (since,))['n']

    # What the originals earned (only those measured at least once).
    posts = db.q("SELECT id, pillar, format, published_at, url, parts, views, likes, replies, reposts, bookmarks FROM posts "
                 "WHERE status='published' AND published_at>? AND measured_at IS NOT NULL", (since,))
    for p in posts:
        p['hour'] = int(clock.local_hour(tz, p['published_at']))
    top = sorted(posts, key=playbook.score, reverse=True)[:5]

    # Our replies under other people's posts: whose posts bring us views.
    replies = db.q("SELECT target_handle, reason, views, likes, replies FROM actions WHERE kind='reply' AND status='done' "
                   "AND done_at>? AND measured_at IS NOT NULL", (since,))
    for r in replies:
        r['bookmarks'] = r['reposts'] = 0
        r['who'] = '回读者' if r['reason'] == '回读者' else '@' + (r['target_handle'] or '?')

    return {
        'days': days,
        'followers': followers,
        'gain': {'d1': gain(1), 'd7': gain(7), 'd30': gain(30)},
        'activity': activity,
        'totals': totals,
        'failed': failed,
        'posts': {'n': len(posts), 'views': _avg(posts, 'views'), 'likes': _avg(posts, 'likes'),
                  'replies': _avg(posts, 'replies'), 'reposts': _avg(posts, 'reposts'), 'bookmarks': _avg(posts, 'bookmarks')},
        'by_pillar': sorted(_group(posts, 'pillar'), key=lambda g: -g['score']),
        'by_format': sorted(_group(posts, 'format'), key=lambda g: -g['score']),
        'by_hour': sorted(_group(posts, 'hour'), key=lambda g: g['name']),
        'top': [{'url': p['url'], 'text': (json.loads(p['parts'] or '[]') or [''])[0][:400], 'pillar': p['pillar'], 'at': clock.fmt(p['published_at']),
                 'views': p['views'], 'likes': p['likes'], 'replies': p['replies'], 'reposts': p['reposts']} for p in top],
        'replies': {'n': len(replies), 'views': _avg(replies, 'views'), 'likes': _avg(replies, 'likes'),
                    'by_target': sorted(_group(replies, 'who'), key=lambda g: -g['views'])[:10]},
        'tz': tz,
    }
