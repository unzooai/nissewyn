"""Xtools behaves like a person: on X only in the owner's own day, never on a fixed beat,
liking only what it read and what is the account's kind of post, following only people
it has something to do with.

Run: python -m unittest plugins/xtools/test_human.py
"""
import json
import os
import random
import sys
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ['UNZOO_PLUGIN_DATA'] = tempfile.mkdtemp(prefix='xtools-test-')
os.environ['UNZOO_PLUGIN_SETTINGS'] = json.dumps({'audience.timezones': ['UTC-8'], 'owner.active_hours': [9, 24],
                                                  'sessions.per_day': 3})
sys.path.insert(0, HERE)

from xt import db, engine, human, scheduler, x  # noqa: E402

BOOK = {
    'pillars': [{'name': 'Browser automation for AI agents', 'examples': ['MCP servers in a real browser']}],
    'keywords': ['MCP server', 'browser automation', 'headless browser'],
    'watch': [{'handle': 'simonw'}, {'handle': 'browser_use'}],
    'learned': {'handle': 'Unzooai'},
}


def local(day_offset, hour, minute=0):
    t = time.localtime()
    return time.mktime((t.tm_year, t.tm_mon, t.tm_mday + day_offset, hour, minute, 0, 0, 0, -1))


class Day(unittest.TestCase):
    def test_visits_stay_in_the_owners_day_and_apart(self):
        for d in range(30):
            noon = local(d, 12)
            start, end = human.owner_window(noon)
            plan = human.plan_day(noon - 12 * 3600, random.Random(d))
            self.assertTrue(plan, 'a day with no visit at all')
            for v in plan:
                self.assertTrue(start <= v['at'] <= end + human.SLOT, (d, v))
            for a, b in zip(plan, plan[1:]):
                self.assertGreaterEqual(b['at'] - a['at'], human.MIN_APART)

    def test_no_two_days_are_alike(self):
        plans = [human.plan_day(local(d, 0), random.Random(d)) for d in range(14)]
        counts = {len(p) for p in plans}
        self.assertGreater(len(counts), 1, 'the same number of visits every day')
        clock_times = [tuple(time.strftime('%H:%M', time.localtime(v['at'])) for v in p) for p in plans]
        self.assertEqual(len(set(clock_times)), len(clock_times), 'the same times on two days')
        lengths = {v['minutes'] for p in plans for v in p}
        self.assertGreater(len(lengths), 5)

    def test_the_edges_of_the_day_move(self):
        starts = {round((human.owner_window(local(d, 12))[0] - local(d, 0)) / 60) for d in range(20)}
        self.assertGreater(len(starts), 5)
        for s in starts:
            self.assertTrue(9 * 60 - 41 <= s <= 9 * 60 + 51, s)

    def test_nothing_in_the_browser_while_the_owner_sleeps(self):
        db.save_playbook(BOOK)
        calls = []
        old = (scheduler.browser.reachable, scheduler.run_job, human.owner_awake)
        scheduler.browser.reachable = lambda: True
        scheduler.run_job = lambda name, fn, *a: calls.append(fn.__name__)
        human.owner_awake = lambda ts=None: False
        try:
            self.assertEqual(scheduler.tick(), 'asleep')
        finally:
            scheduler.browser.reachable, scheduler.run_job, human.owner_awake = old
        self.assertNotIn('visit', calls)
        self.assertEqual(set(calls) - {'plan_day', 'publish_due', 'weekly_learn'}, set())

    def test_a_visit_is_its_own_mix(self):
        orders = {tuple(human.moves('session', True, True, False)) for _ in range(200)}
        self.assertGreater(len(orders), 8)
        for o in orders:
            self.assertIn(o[0], ('home', 'notifications'))
        for _ in range(100):
            self.assertLessEqual(len(human.moves('glance', True, True, False)), 2)

    def test_reading_and_pauses_are_uneven(self):
        long = 'word ' * 60
        times = [human.dwell(long) for _ in range(200)]
        self.assertGreater(max(times) - min(times), 3)
        self.assertLess(max(times), 18.5)
        gaps = [human.gap() for _ in range(300)]
        self.assertGreater(len({round(g) for g in gaps}), 30)


class Likes(unittest.TestCase):
    def setUp(self):
        db.save_playbook(BOOK)
        db.run('DELETE FROM actions')
        self.liked = []
        self.old_sleep = human.sleep
        human.sleep = lambda seconds: None
        self.old = x.like_here
        x.like_here = lambda url, dry_run=False: (self.liked.append(url), {'ok': True})[1]

    def tearDown(self):
        x.like_here = self.old
        human.sleep = self.old_sleep

    def state(self, likes=100):
        return {'me': 'unzooai', 'terms': engine._terms(BOOK), 'watched': {'simonw', 'browser_use'}, 'talked': set(),
                'stage': None, 'likes': likes, 'follows': 0, 'done': {k: 0 for k in engine.KINDS}}

    def post(self, i, text, handle='someone', likes=10):
        return {'url': 'https://x.com/%s/status/%d' % (handle, i), 'handle': handle, 'text': text,
                'at': time.time() - 3600, 'likes': likes}

    def test_off_topic_posts_are_never_liked(self):
        on_post = engine._like_while_reading(self.state())
        for i in range(300):
            on_post(self.post(i, 'Look at my cat, she is sleeping on the sofa again'))
        self.assertEqual(self.liked, [])

    def test_some_but_not_all_relevant_posts_are_liked(self):
        on_post = engine._like_while_reading(self.state())
        for i in range(200):
            on_post(self.post(1000 + i, 'We moved our MCP server to a real browser instead of a headless browser'))
        self.assertGreater(len(self.liked), 10)
        self.assertLess(len(self.liked), 180)

    def test_the_visits_budget_is_kept(self):
        on_post = engine._like_while_reading(self.state(likes=3))
        for i in range(200):
            on_post(self.post(5000 + i, 'browser automation with an MCP server', handle='simonw'))
        self.assertEqual(len(self.liked), 3)

    def test_own_old_and_red_line_posts_are_left(self):
        on_post = engine._like_while_reading(self.state())
        for i in range(100):
            on_post(self.post(9000 + i, 'MCP server browser automation', handle='Unzooai'))
            p = self.post(9500 + i, 'MCP server browser automation')
            p['at'] = time.time() - 5 * 86400
            on_post(p)
        self.assertEqual(self.liked, [])


class Follows(unittest.TestCase):
    def test_strangers_are_not_followed_for_a_popular_post(self):
        db.save_playbook(dict(BOOK, watch=[]))
        db.run('DELETE FROM actions')
        db.run('DELETE FROM seen')
        db.run("INSERT INTO seen(url, handle, text, at, source, likes, captured_at) VALUES('u1', 'bigstranger', 'MCP', ?, 'kw:MCP server', 90000, ?)",
               (time.time(), time.time()))
        old = engine.cap_left
        engine.cap_left = lambda kind: 10
        try:
            engine.discover_follows(n=5)
        finally:
            engine.cap_left = old
        follows = [r['target_handle'] for r in db.q("SELECT target_handle FROM actions WHERE kind='follow'")]
        self.assertNotIn('bigstranger', follows)

    def test_people_it_has_to_do_with_can_be(self):
        db.save_playbook(BOOK)
        db.run('DELETE FROM actions')
        old = engine.cap_left
        engine.cap_left = lambda kind: 10
        try:
            for _ in range(10):
                engine.discover_follows(n=3)
        finally:
            engine.cap_left = old
        follows = {r['target_handle'] for r in db.q("SELECT target_handle FROM actions WHERE kind='follow'")}
        self.assertTrue(follows)
        self.assertLessEqual(follows, {'simonw', 'browser_use'})


class FakeX:
    """The browser, as far as moving around X goes: where it is, what links the page has,
    whether the app follows a route. Counts page loads, clicks and scrolls."""

    def __init__(self, path=None, links=(), routes=True, posts=()):
        self.path, self.links, self.routes = path, set(links), routes
        self.loads, self.clicks, self.posts, self.scrolls = [], [], list(posts), 0
        self.title, self.found = 'X', None

    def js(self, expr, timeout=30):
        if expr == 'location.hostname':
            return 'x.com' if self.path else ''
        if expr == 'location.pathname + location.search':
            return self.path or ''
        if expr == 'document.title':
            return self.title
        if 'const want' in expr:
            want = json.loads(expr.split('const want = ')[1].split('.toLowerCase')[0])
            self.found = next((l for l in self.links if l.lower() == want.lower()), None)
            return bool(self.found)
        if 'pushState' in expr:
            if self.routes:
                self.path = json.loads(expr.split('history.pushState({}, "", ')[1].split('); dispatch')[0])
                self.title = 'moved'
            return None
        if 'document.title !==' in expr:
            return self.title != json.loads(expr.split('!== ')[1])
        if 'map(a =>' in expr:                       # the posts on the page
            return self.posts[:3 + 3 * self.scrolls]
        if 'toLowerCase() ===' in expr:            # arrived?
            want = json.loads(expr.split('=== ')[1])
            return (self.path or '').split('?')[0].rstrip('/').lower() == want
        if 'signed_out' in expr:
            return 'ok'
        if 'SideNav_AccountSwitcher_Button' in expr:
            return 'Unzooai'
        if 'data-xt-nav="nav"' in expr:
            return False
        return True

    def go(self, url, settle=None):
        self.loads.append(url)
        self.path = url[len('https://x.com'):]
        browser_mod.LOADS['pages'] += 1

    def click(self, selector):
        self.clicks.append(selector)
        if 'data-xt-nav' in selector and self.found:
            self.path = self.found

    def wait_for(self, expr, seconds=15, every=1.2):
        return self.js(expr)

    def scroll(self, px=None):
        self.scrolls += 1


from xt import browser as browser_mod  # noqa: E402


class Moving(unittest.TestCase):
    """X is loaded once and then moved in, by clicking, as a person does."""
    NAMES = ('js', 'go', 'click', 'wait_for', 'pause', 'scroll')

    def setUp(self):
        self.saved = {k: getattr(browser_mod, k) for k in self.NAMES}
        self.old_sleep = human.sleep
        human.sleep = lambda s: None
        browser_mod.LOADS['pages'] = 0

    def tearDown(self):
        for k, v in self.saved.items():
            setattr(browser_mod, k, v)
        human.sleep = self.old_sleep
        x.BUDGET['pages'] = None

    def use(self, fake):
        for k in ('js', 'go', 'click', 'wait_for', 'scroll'):
            setattr(browser_mod, k, getattr(fake, k))
        browser_mod.pause = lambda lo=0, hi=0: None
        return fake

    def test_x_open_already_is_not_reloaded_to_see_who_is_signed_in(self):
        f = self.use(FakeX('/search?q=mcp'))
        x.me()
        self.assertEqual(f.loads, [])

    def test_x_not_open_is_loaded_once(self):
        f = self.use(FakeX(None))
        x.me()
        self.assertEqual(f.loads, ['https://x.com/home'])

    def test_a_link_on_the_page_is_clicked_not_typed(self):
        f = self.use(FakeX('/home', links=['/simonw']))
        x.open_page('https://x.com/simonw')
        self.assertEqual((f.loads, f.path), ([], '/simonw'))
        self.assertTrue(f.clicks)

    def test_with_no_link_it_moves_inside_the_app(self):
        f = self.use(FakeX('/home'))
        x.open_page('https://x.com/simonw/status/1')
        self.assertEqual((f.loads, f.path), ([], '/simonw/status/1'))

    def test_the_address_is_the_last_resort_and_a_visit_has_few(self):
        f = self.use(FakeX('/home', routes=False))
        x.BUDGET['pages'] = 1
        x.open_page('https://x.com/simonw')
        self.assertEqual(f.loads, ['https://x.com/simonw'])
        with self.assertRaises(x.OutOfPages):
            x.open_page('https://x.com/browser_use')
        self.assertEqual(len(f.loads), 1)

    def test_the_page_open_already_is_stayed_on(self):
        f = self.use(FakeX('/Unzooai'))
        x.open_page('https://x.com/unzooai')
        self.assertEqual((f.loads, f.clicks), ([], []))

    def test_reading_stops_when_nothing_new_comes(self):
        posts = [{'url': 'https://x.com/a/status/%d' % i, 'handle': 'a', 'text': 'hi', 'has_media': False} for i in range(6)]
        f = self.use(FakeX('/home', posts=posts))
        got = x.read(None, want=50, max_scrolls=20)
        self.assertEqual(len(got), 6)
        self.assertLessEqual(f.scrolls, 4, 'kept scrolling a page with nothing new')


class Limited(unittest.TestCase):
    """Told "too many" by X, it stops for the day; told again within the week, it does less for days."""

    def setUp(self):
        db.save_playbook(BOOK)
        for k in ('limit_strikes', 'slow', 'halt'):
            db.kv_set(k, None)

    def tearDown(self):
        for k in ('limit_strikes', 'slow', 'halt'):
            db.kv_set(k, None)

    def test_once_is_the_rest_of_the_day_and_no_slowdown(self):
        now = local(0, 15)
        engine._limited(now)
        self.assertGreaterEqual(db.kv_get('halt')['until'], human.owner_window(now + 86400)[0] - 3600 - (time.time() - now))
        self.assertIsNone(human.slowdown(now))

    def test_again_within_the_week_slows_down_for_days(self):
        now = local(0, 15)
        engine._limited(now - 2 * 86400)
        engine._limited(now)
        s = human.slowdown(now)
        self.assertEqual(s['factor'], 0.5)
        self.assertGreater(s['until'], now + 3 * 86400)
        engine._limited(now + 60)
        s = human.slowdown(now)
        self.assertEqual(s['factor'], 0.3)
        self.assertGreater(s['until'], now + 9 * 86400)

    def test_long_ago_limits_are_forgotten(self):
        now = local(0, 15)
        engine._limited(now - 8 * 86400)
        engine._limited(now)
        self.assertIsNone(human.slowdown(now))

    def test_a_slowdown_means_fewer_visits_and_less_reading(self):
        normal = sum(len(human.plan_day(local(d, 0), random.Random(d))) for d in range(10))
        db.kv_set('slow', {'factor': 0.5, 'until': time.time() + 30 * 86400})
        slow = sum(len(human.plan_day(local(d, 0), random.Random(d))) for d in range(10))
        self.assertLess(slow, normal)
        self.assertLessEqual(engine.read_left('session'), engine.READ['session'] // 2)


if __name__ == '__main__':
    unittest.main()
