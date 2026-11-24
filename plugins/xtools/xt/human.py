"""How a person uses X, so the account never looks like a schedule.

A person is on X when *they* are awake, not when the readers are: everything in the
browser (reading, liking, replying, following) happens inside the account owner's own
day, on this computer's clock (`owner.active_hours`). Inside that day the readers' awake
hours only make some times more likely than others.

The day is made of visits, not of jobs on a timer: a few longer sessions and a few quick
looks, at times drawn afresh every day, of different lengths, some days lighter than
others. Each visit is its own mix of moves (the timeline, notifications, one account,
one search) in its own order, and what is done there is done while reading -- a like is
given to a post that was just read, not to a list of posts picked from a database.
"""
import math
import random
import time

from . import clock, db, env

SLOT = 300                                   # five minutes
MIN_APART = 35 * 60                          # two visits are never closer than this


# ---- the owner's day ---------------------------------------------------------------

def _local_midnight(ts):
    t = time.localtime(ts)
    return time.mktime((t.tm_year, t.tm_mon, t.tm_mday, 0, 0, 0, 0, 0, -1))


def day_key(ts=None):
    return time.strftime('%Y-%m-%d', time.localtime(time.time() if ts is None else ts))


def owner_window(ts=None):
    """(start, end) of the owner's active stretch on the local day of `ts`. The edges move
    by up to an hour from day to day, the same way all day long (seeded by the date)."""
    ts = time.time() if ts is None else ts
    lo, hi = env.setting('owner.active_hours') or [9, 24]
    rnd = random.Random('window:' + day_key(ts))
    midnight = _local_midnight(ts)
    start = midnight + lo * 3600 + rnd.uniform(-40, 50) * 60
    end = midnight + hi * 3600 + rnd.uniform(-60, 25) * 60
    return start, max(end, start + 3600)


def owner_awake(ts=None):
    ts = time.time() if ts is None else ts
    start, end = owner_window(ts)
    if start <= ts < end:
        return True
    # A window that runs past midnight (e.g. 9-25) still counts after midnight.
    start, end = owner_window(ts - 86400)
    return start <= ts < end


# How likely someone is to open X at a given hour of their own day (rough, peaks at
# breakfast, lunch and the evening); multiplied by whether the readers are awake.
_HOURLY = [0.2, 0.15, 0.1, 0.1, 0.1, 0.15, 0.3, 0.6, 0.9, 1.0, 0.8, 0.8,
           1.0, 1.0, 0.7, 0.7, 0.75, 0.8, 0.9, 1.0, 1.1, 1.15, 1.05, 0.7]


def _weight(ts):
    hour = time.localtime(ts).tm_hour
    return _HOURLY[hour] * (1.0 if clock.audience_awake(ts) else 0.4)


def plan_day(ts=None, rnd=None):
    """Today's visits: [{'at', 'kind': 'session'|'glance', 'minutes'}], in time order."""
    ts = time.time() if ts is None else ts
    rnd = rnd or random.Random()
    start, end = owner_window(ts)
    light = rnd.random() < 0.13              # some days you are just busier
    sessions = max(0, (env.setting('sessions.per_day') or 0) + rnd.choice([-1, 0, 0, 0, 1]))
    glances = rnd.choice([1, 2, 2, 3])
    if light:
        sessions, glances = max(1, sessions // 2) if sessions else 0, rnd.choice([0, 1])
    slots = [start + i * SLOT for i in range(int((end - start) // SLOT))]
    weights = [_weight(s) for s in slots]
    picked = []
    for kind in ['session'] * sessions + ['glance'] * glances:
        for _ in range(40):
            at = rnd.choices(slots, weights)[0] + rnd.uniform(0, SLOT) if slots else None
            if at is None:
                break
            if all(abs(at - p['at']) >= MIN_APART for p in picked):
                minutes = (min(30.0, max(5.0, rnd.lognormvariate(math.log(12), 0.45))) if kind == 'session'
                           else rnd.uniform(1.0, 4.0))
                picked.append({'at': at, 'kind': kind, 'minutes': round(minutes, 1)})
                break
    return sorted(picked, key=lambda v: v['at'])


def visits(now=None):
    """Today's plan, made on first use each day and kept."""
    now = time.time() if now is None else now
    plan = db.kv_get('visits') or {}
    if plan.get('day') != day_key(now):
        items = [v for v in plan_day(now) if v['at'] > now - 60]
        plan = {'day': day_key(now), 'items': items, 'done': []}
        db.kv_set('visits', plan)
    return plan


def due_visit(now=None):
    """The visit to make now, marked done; or None. A visit missed by over an hour
    (the computer was asleep) is let go, the way a person skips one."""
    now = time.time() if now is None else now
    plan = visits(now)
    for v in plan['items']:
        if v['at'] in plan['done']:
            continue
        if v['at'] <= now:
            plan['done'].append(v['at'])
            db.kv_set('visits', plan)
            if now - v['at'] > 3600:
                continue
            return v
        break
    return None


def next_visit(now=None):
    now = time.time() if now is None else now
    plan = visits(now)
    return next((v for v in plan['items'] if v['at'] > now and v['at'] not in plan['done']), None)


# ---- moving like a person ----------------------------------------------------------

def chance(p):
    return random.random() < p


def dwell(text='', media=False):
    """How long a post holds the eye: a glance at a short one, longer for long text or a picture;
    now and then one is skimmed past."""
    if chance(0.18):
        return random.uniform(0.4, 1.2)
    words = max(1, len((text or '').split()) + len([c for c in text or '' if '一' <= c <= '鿿']) // 2)
    seconds = 1.2 + words / random.uniform(3.5, 6.0) + (random.uniform(1, 4) if media else 0)
    return min(seconds, random.uniform(10, 18))


def think():
    """The moment before a click."""
    return min(6.0, random.lognormvariate(math.log(1.4), 0.5))


def gap():
    """Between two things done: mostly the set range, sometimes a longer drift."""
    lo, hi = env.setting('pace.gap_seconds') or [25, 90]
    mid = (lo + hi) / 2
    s = random.lognormvariate(math.log(max(1, mid)), 0.35)
    if chance(0.08):
        s += random.uniform(60, 240)         # got distracted
    return max(lo * 0.6, min(s, hi * 1.6 + 240))


def sleep(seconds):
    time.sleep(max(0.0, seconds))


def moves(kind, has_watch, has_keywords, first_today):
    """What this visit does, in order."""
    if kind == 'glance':
        out = ['home'] if chance(0.7) else ['notifications']
        if chance(0.35):
            out.append('notifications' if out[0] == 'home' else 'home')
        return out
    middle = []
    if chance(0.65):
        middle.append('notifications')
    if has_watch and chance(0.5):
        middle.append('account')
    if has_watch and chance(0.15):
        middle.append('account')
    if has_keywords and chance(0.35):
        middle.append('search')
    if chance(0.25):
        middle.append('home')
    random.shuffle(middle)
    first = 'home' if chance(0.8) else 'notifications'
    out = [first] + [m for i, m in enumerate(middle) if not (i == 0 and m == first)]
    if first_today and chance(0.7):
        out.insert(random.randint(1, len(out)), 'me')   # look at your own profile once a day
    return out
