"""Time in the audience's time zones."""
import random
import re
import time

from . import env


def parse_tz(text):
    """'UTC+8', '+8', '-5', 'UTC-3:30' -> hours east of UTC; None if not a zone."""
    m = re.fullmatch(r'\s*(?:UTC|GMT)?\s*([+-]?\d{1,2})(?::?(\d{2}))?\s*', str(text or ''), re.I)
    if not m:
        return None
    h = int(m.group(1))
    mins = int(m.group(2) or 0)
    if not -12 <= h <= 14:
        return None
    return h + (mins / 60.0 if h >= 0 else -mins / 60.0)


def zones():
    out = [z for z in (parse_tz(t) for t in env.setting('audience.timezones') or []) if z is not None]
    return out or [0.0]


def local_hour(tz, at=None):
    t = (at or time.time()) + tz * 3600
    return (t % 86400) / 3600.0


def audience_awake(at=None):
    """Is it inside the active hours for at least one audience time zone?"""
    lo, hi = env.setting('audience.active_hours') or [8, 23]
    return any(lo <= local_hour(z, at) < hi for z in zones())


def slots(n, start_ts, end_ts):
    """n moments between start and end, spread with a little randomness."""
    if n <= 0 or end_ts <= start_ts:
        return []
    width = (end_ts - start_ts) / n
    return sorted(start_ts + width * i + random.uniform(0.1, 0.9) * width for i in range(n))


def awake_windows(day_start, day_end):
    """[(start, end)] of the stretches in [day_start, day_end) where some audience is awake, by 15 minutes."""
    out, cur = [], None
    t = day_start
    while t < day_end:
        if audience_awake(t):
            cur = [t, t + 900] if cur is None else [cur[0], t + 900]
        elif cur:
            out.append(tuple(cur))
            cur = None
        t += 900
    if cur:
        out.append(tuple(cur))
    return out


def spread_over_awake(n, day_start, day_end):
    """n moments spread across the awake stretches of the day, proportional to their length."""
    wins = awake_windows(day_start, day_end)
    total = sum(e - s for s, e in wins)
    if not total or n <= 0:
        return []
    # Evenly spaced with jitter: never two posts back to back, never a long silence.
    picks = [total * (i + random.uniform(0.25, 0.75)) / n for i in range(n)]
    out = []
    for p in picks:
        for s, e in wins:
            if p <= e - s:
                out.append(s + p)
                break
            p -= e - s
    return out


def fmt(ts, tz=None):
    tz = zones()[0] if tz is None else tz
    t = time.gmtime(ts + tz * 3600)
    return time.strftime('%m-%d %H:%M', t)


def fmt_here(ts, now=None):
    """A moment on this computer's own clock, as the person reads it: 今天/明天/后天 HH:MM, else MM-DD HH:MM.
    Not the readers' time zone -- a schedule about the person's account is read against their own day."""
    now = time.time() if now is None else now
    t, today = time.localtime(ts), time.localtime(now)
    days = (time.mktime((t.tm_year, t.tm_mon, t.tm_mday, 0, 0, 0, 0, 0, -1))
            - time.mktime((today.tm_year, today.tm_mon, today.tm_mday, 0, 0, 0, 0, 0, -1)))
    days = round(days / 86400)
    clock_part = time.strftime('%H:%M', t)
    word = {0: '今天', 1: '明天', 2: '后天'}.get(days)
    return f'{word} {clock_part}' if word else time.strftime('%m-%d %H:%M', t)
