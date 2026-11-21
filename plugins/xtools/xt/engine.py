"""The daily work: plan and write posts, watch the niche, draft replies and quotes,
answer mentions, act in sessions, measure, learn. Each job is safe to run again."""
import json
import random
import re
import time

from . import browser, clock, db, env, playbook, writer, x

KINDS = ('reply', 'quote', 'like', 'follow')


# ---- safety ------------------------------------------------------------------

def halted():
    """Why automation is stopped, or None."""
    if env.setting('paused'):
        return '已在设置里暂停'
    h = db.kv_get('halt')
    if h and h.get('until', 0) > time.time() and h.get('profile', env.browser_profile()) == env.browser_profile():
        return h.get('why')
    return None


def halt(why, minutes):
    db.kv_set('halt', {'why': why, 'until': time.time() + minutes * 60, 'at': time.time(), 'profile': env.browser_profile()})
    db.log('停下 %d 分钟:%s' % (minutes, why), 'warn')


def on_unhealthy(state):
    minutes = {'limited': 180, 'locked': 60 * 24 * 7, 'signed_out': 60 * 24, 'error': 30}.get(state, 60)
    why = {'limited': 'X 提示操作太频繁(限流)', 'locked': 'X 账号被锁或需要验证,请到浏览器里处理',
           'signed_out': browser.signed_out_text(), 'error': 'X 页面出错'}.get(state, state)
    halt(why, minutes)


# ---- warm-up (养号期) ------------------------------------------------------------
# A new or small account that suddenly posts, replies and follows every day looks like a
# bot to X. So it starts the way a person new to X does, in three stages:
#   1 只逛  look around: read the timeline and the niche, like a few posts, answer anyone
#           who talks to it; no originals, no replies to strangers, no follows, no quotes
#   2 开口  start talking: one original a day, a few replies under peers' posts, a few follows
#   3 起步  everything, the daily caps rising day by day to the full amount
# Stage 1 takes the first fifth of the period, stage 2 runs to half of it.

STAGES = {
    1: ('只逛', '只看时间线和领域里的帖、少量点赞、回应找你的人;不发原创、不在别人帖下回复、不关注、不引用'),
    2: ('开口', '每天最多 1 条原创,少量前排回复和关注;不引用'),
    3: ('起步', '什么都做,每天的上限逐天放开到设定值'),
}
NEW_FOLLOWERS, NEW_DAYS = 500, 180


def is_new_account(book=None):
    """Fewer than 500 followers, or joined X under half a year ago (unknown counts as new)."""
    prof = ((book or db.playbook()).get('learned') or {}).get('profile') or {}
    followers, joined = prof.get('followers'), prof.get('joined_at')
    return followers is None or followers < NEW_FOLLOWERS or bool(joined and time.time() - joined < NEW_DAYS * 86400)


def warmup():
    """Where the account is in its warm-up, or None when it is not in one."""
    book = db.playbook()
    mode, total = env.setting('warmup.mode') or 'auto', env.setting('warmup.days') or 0
    if not book.get('pillars') or mode == 'off' or total <= 0 or db.kv_get('warmup_ended'):
        return None
    if mode == 'auto' and not is_new_account(book):
        return None
    start = db.kv_get('warmup_start')
    if start is None:
        start = time.time()
        db.kv_set('warmup_start', start)
    day = (time.time() - start) / 86400
    if day >= total:
        return None
    s1 = max(1, round(total * 0.2))
    s2 = max(s1 + 1, round(total * 0.5))
    stage = 1 if day < s1 else 2 if day < s2 else 3
    ends = {1: s1, 2: min(s2, total), 3: total}[stage]
    return {'stage': stage, 'name': STAGES[stage][0], 'what': STAGES[stage][1], 'day': int(day) + 1, 'days': total,
            'next_at': start + ends * 86400, 'end_at': start + total * 86400,
            'progress': 0 if stage < 3 else (day - s2) / max(1, total - s2)}


def stage():
    w = warmup()
    return w['stage'] if w else None


def _warm_cap(kind, cap):
    w = warmup()
    if not w:
        return cap
    r = env.setting('warmup.ratio')
    r = 0.4 if r is None else (r / 100 if r > 1 else r)    # a percentage; old values were 0-1
    if w['stage'] == 1:
        f = {'post': 0, 'reply': r * 0.25, 'quote': 0, 'like': r * 0.5, 'follow': 0}[kind]
    elif w['stage'] == 2:
        if kind == 'post':
            return min(1, cap)
        f = {'reply': r, 'quote': 0, 'like': r, 'follow': r * 0.5}[kind]
    else:
        f = r + (1 - r) * w['progress']
    return int(cap * f + (0.5 if f else 0)) if cap else 0


def cap_left(kind):
    """How many more of this kind today, after warm-up, today's count and the hourly limit."""
    cap = _warm_cap(kind, env.setting('caps.' + kind) or 0)
    if kind == 'post':
        done = db.count_today('posts', 'kind', 'post', done=('published',))
    else:
        done = db.count_today('actions', 'kind', kind, done=('done',))
    hour = db.one("SELECT (SELECT COUNT(*) FROM actions WHERE status='done' AND done_at>?) + "
                  "(SELECT COUNT(*) FROM posts WHERE status='published' AND published_at>?) n",
                  (time.time() - 3600, time.time() - 3600))['n']
    return max(0, min(cap - done, (env.setting('caps.per_hour') or 15) - hour))


def gap():
    lo, hi = env.setting('pace.gap_seconds') or [25, 90]
    time.sleep(random.uniform(lo, hi))


def _redline_hit(text):
    """A cheap first check; the writer is also told the red lines."""
    low = (text or '').lower()
    words = []
    for r in env.setting('redlines') or []:
        words += [w.strip().lower() for w in re.split(r'[、,，/;；\s]+', r) if len(w.strip()) >= 2]
    return next((w for w in words if w in low), None)


# ---- writing -----------------------------------------------------------------

def _book():
    book = db.playbook()
    if not book.get('pillars'):
        raise RuntimeError('还没有打法:先在 Xtools 页面完成「开始」')
    return book


def _lang_hint(book):
    lang = env.setting('posts.language')
    if lang in (None, '', 'auto'):
        lang = book.get('language') or 'zh'
    return {'zh': '用中文写。', 'en': 'Write in English.', 'both': '用账号最常用的语言写。'}.get(lang, '用账号最常用的语言写。')


def _fresh_material(pillar, n=6):
    """Recent posts in the niche that relate to this pillar, as raw material."""
    rows = db.q("SELECT handle, text, views, likes FROM seen WHERE captured_at>? AND text!='' "
                "ORDER BY (likes + 3*replies + 4*reposts) DESC LIMIT 60", (time.time() - 36 * 3600,))
    words = set(re.findall(r'\w{2,}', (pillar.get('name', '') + ' ' + pillar.get('what', '')).lower()))
    rows.sort(key=lambda r: -len(words & set(re.findall(r'\w{2,}', r['text'].lower()))))
    return rows[:n]


def write_post(pillar=None, fmt=None, extra=''):
    """One original post (or thread) for a pillar, in the account's voice."""
    book = _book()
    recent = [r['pillar'] for r in db.q('SELECT pillar FROM posts ORDER BY id DESC LIMIT 6')][::-1]
    pillar = pillar or playbook.pick_pillar(book, recent)
    fmt = fmt or random.choice(env.setting('posts.formats') or ['short'])
    material = _fresh_material(pillar)
    shape = {
        'short': '一条单帖,不超过 280 个权重字符(中文一个字算 2)。开头一句就要抓人。',
        'thread': '一个 3-6 条的 thread,每条之间用单独一行 --- 隔开,每条不超过 280 个权重字符;第一条要让人想点开。',
        'long': '一篇 X 长帖(Premium 长文),600-1500 字,有小标题感但不用 markdown 符号。',
    }.get(fmt, '一条单帖。')
    prompt = '\n'.join([
        playbook.voice_block(book), '',
        '这次写的内容支柱:%s —— %s' % (pillar['name'], pillar.get('what', '')),
        '可以参考的选题:' + ';'.join(pillar.get('examples') or []) if pillar.get('examples') else '',
        '这个领域最近 36 小时大家在讨论的(只作素材和时效参考,不要提这些作者、不要转述成新闻):' if material else '',
        *['  · @%s:%s' % (m['handle'], re.sub(r'\s+', ' ', m['text'])[:240]) for m in material],
        '', '写:' + shape, _lang_hint(book),
        '读者:%s。目标:%s。' % ((book.get('about') or {}).get('audience', ''), (book.get('about') or {}).get('goal', '')),
        extra,
    ])
    text = writer.write(prompt, env.setting('redlines'))
    parts = writer.split_thread(text) if fmt != 'long' else [text]
    if fmt == 'short' and len(parts) > 1:
        parts = parts[:1]
    link = (env.setting('posts.link') or '').strip()
    every = env.setting('posts.link_every') or 0
    if link and every and (db.one("SELECT COUNT(*) n FROM posts")['n'] % every == every - 1):
        parts[-1] = parts[-1].rstrip() + '\n' + link
    hit = _redline_hit(' '.join(parts))
    if hit:
        raise RuntimeError('写出来的内容碰到红线(%s),已丢弃' % hit)
    return {'pillar': pillar['name'], 'format': fmt, 'parts': parts, 'source': json.dumps([m['handle'] for m in material])}


def add_post(draft, due_at=None):
    mode = env.automation('posts')
    status = 'scheduled' if mode == 'auto' and due_at else 'draft'
    return db.run('INSERT INTO posts(kind, pillar, format, parts, source, status, due_at, created_at) VALUES(?,?,?,?,?,?,?,?)',
                  ('post', draft['pillar'], draft['format'], json.dumps(draft['parts'], ensure_ascii=False),
                   draft.get('source', ''), status, due_at, time.time()))


def plan_day():
    """Today's posts and sessions, spread over the hours the audience is awake."""
    if env.automation('posts') == 'off':
        return
    start = db.today_start()
    end = start + 86400
    now = time.time()
    planned = db.one("SELECT COUNT(*) n FROM posts WHERE due_at>=? AND due_at<? AND status IN ('scheduled','draft','published')",
                     (start, end))['n']
    want = max(0, min(env.setting('posts.per_day') or 0, _warm_cap('post', 99)) - planned)
    times = [t for t in clock.spread_over_awake(want + 2, max(start, now + 600), end)][:want]
    for t in times:
        try:
            pid = add_post(write_post(), due_at=t)
            db.log('写好今天的原创 #%d,%s 发' % (pid, clock.fmt(t)))
        except Exception as e:
            db.log('写原创失败:%s' % e, 'warn')
            break
    sessions = clock.spread_over_awake(env.setting('sessions.per_day') or 0, max(start, now), end)
    db.kv_set('sessions', {'day': start, 'at': sessions, 'done': []})


# ---- watching the niche --------------------------------------------------------

def _remember(posts, source):
    n = 0
    for p in posts:
        if not p.get('text'):
            continue
        if db.one('SELECT 1 FROM seen WHERE url=?', (p['url'],)):
            db.run('UPDATE seen SET views=?, likes=?, replies=?, reposts=? WHERE url=?',
                   (p['views'], p['likes'], p['replies'], p['reposts'], p['url']))
            continue
        db.run('INSERT INTO seen(url, handle, text, at, source, views, likes, replies, reposts, captured_at) '
               'VALUES(?,?,?,?,?,?,?,?,?,?)',
               (p['url'], p['handle'], p['text'], p['at'], source, p['views'], p['likes'], p['replies'],
                p['reposts'], time.time()))
        n += 1
    return n


def radar(accounts=4, keywords=2):
    """A few watched accounts and keywords per run, rotating through all of them."""
    book = _book()
    me = (book.get('learned') or {}).get('handle', '').lower()
    watch = [w['handle'] for w in book.get('watch') or [] if w.get('handle', '').lower() != me]
    kws = book.get('keywords') or []
    turn = db.kv_get('radar_turn', 0)
    got = 0
    for i in range(min(accounts, len(watch))):
        h = watch[(turn * accounts + i) % len(watch)]
        got += _remember(x.posts_of(h, want=5), 'watch:' + h)
        browser.pause(3, 8)
    for i in range(min(keywords, len(kws))):
        k = kws[(turn * keywords + i) % len(kws)]
        posts = [p for p in x.search(k, want=12) if not _redline_hit(p['text'])]
        got += _remember(posts, 'kw:' + k)
        browser.pause(3, 8)
    db.kv_set('radar_turn', turn + 1)
    db.log('雷达:新看到 %d 条' % got)
    return got


def _queue(kind, target, text='', reason='', soon=True):
    mode = env.automation({'reply': 'replies', 'quote': 'quotes', 'like': 'likes', 'follow': 'follows'}[kind])
    if mode == 'off':
        return None
    status = 'queued' if mode == 'auto' else 'pending'
    return db.run('INSERT INTO actions(kind, target_url, target_handle, target_text, text, reason, status, due_at, created_at) '
                  'VALUES(?,?,?,?,?,?,?,?,?)',
                  (kind, target.get('url'), target.get('handle'), (target.get('text') or '')[:1000], text, reason, status,
                   time.time() + (random.uniform(60, 900) if soon else 0), time.time()))


def _already(url, kind):
    return db.one('SELECT 1 FROM actions WHERE target_url=? AND kind=?', (url, kind)) is not None


REPLY = """{voice}

要回复的帖(@{handle}):
{text}

写一条回复:像同行在评论区说话,补一个对方没说到的具体东西(做法、数据、反例、亲身经验、一个好问题)。
不夸对方、不复述原帖、不推销、不带链接。一到两句,不超过 {limit} 个权重字符(中文一个字算 2)。{lang}
如果这条帖不适合回复(和账号领域无关、争议、碰红线、对方在诉苦),只输出 SKIP。"""


def write_reply(target, book):
    text = writer.write(REPLY.format(voice=playbook.voice_block(book), handle=target['handle'], text=target['text'][:1200],
                                     limit=240, lang=_lang_of(target['text'])), env.setting('redlines'))
    if text.strip().upper().startswith('SKIP') or _redline_hit(text):
        return None
    return writer.split_thread(text, 280)[0]


def _lang_of(text):
    cjk = len(re.findall(r'[㐀-鿿]', text or ''))
    return '用中文写。' if cjk > len(text or '') * 0.15 else 'Reply in the language of the post.'


def frontrow(max_drafts=4):
    """Fresh posts from watched accounts, still early (few replies): be one of the first good replies."""
    if stage() == 1:
        return 0                     # warm-up: not talking to strangers yet
    book = _book()
    age = (env.setting('frontrow.max_age_hours') or 3) * 3600
    crowd = env.setting('frontrow.max_replies_on_post') or 150
    watched = {w['handle'].lower() for w in book.get('watch') or []}
    rows = db.q('SELECT * FROM seen WHERE at>? AND replies<=? AND used IS NULL ORDER BY views DESC LIMIT 30',
                (time.time() - age, crowd))
    made = 0
    for r in rows:
        if made >= max_drafts:
            break
        if r['handle'].lower() not in watched and not r['source'].startswith('kw:'):
            continue
        if _already(r['url'], 'reply') or _redline_hit(r['text']):
            db.run("UPDATE seen SET used='skip' WHERE url=?", (r['url'],))
            continue
        try:
            text = write_reply(r, book)
        except Exception as e:
            db.log('起草前排回复失败:%s' % e, 'warn')
            break
        db.run("UPDATE seen SET used=? WHERE url=?", ('reply' if text else 'skip', r['url']))
        if text:
            _queue('reply', r, text, '前排回复:@%s 的新帖' % r['handle'])
            _queue('like', r, reason='回复前先点赞')
            made += 1
    if made:
        db.log('起草前排回复 %d 条' % made)
    return made


QUOTE = """{voice}

这条帖正在被很多人看(@{handle},{views} 次浏览):
{text}

写一段引用转发的评论:给出你自己的判断或一个具体补充,让没看过原帖的人也能看懂你在说什么。
不复述原帖、不夸、不带链接、不超过 220 个权重字符。{lang}
如果不适合引用,只输出 SKIP。"""


def quotes(n=1):
    if cap_left('quote') <= 0:
        return 0
    book = _book()
    rows = db.q("SELECT * FROM seen WHERE at>? AND used IS NULL ORDER BY views DESC LIMIT 10", (time.time() - 12 * 3600,))
    made = 0
    for r in rows:
        if made >= n:
            break
        if _already(r['url'], 'quote') or _redline_hit(r['text']):
            continue
        text = writer.write(QUOTE.format(voice=playbook.voice_block(book), handle=r['handle'], views=r['views'],
                                         text=r['text'][:1200], lang=_lang_of(r['text'])), env.setting('redlines'))
        db.run("UPDATE seen SET used='quote' WHERE url=?", (r['url'],))
        if text.strip().upper().startswith('SKIP') or _redline_hit(text):
            continue
        _queue('quote', r, writer.split_thread(text)[0], '引用高流量帖')
        made += 1
    return made


MENTION = """{voice}

有人在 X 上提到或回复了这个账号:
@{handle}:{text}
{context}

决定怎么回应,输出 JSON:{{"action": "reply" 或 "like" 或 "skip", "text": "回复内容(action 是 reply 时)"}}
- 真问题、真讨论:reply,认真回答,具体,一到三句,不超过 260 个权重字符。{lang}
- 只是附和、感谢、表情:like。
- 广告、骂人、碰红线、看不懂:skip。"""


def mentions():
    """Readers first: answer questions, like thanks, skip noise."""
    book = _book()
    me = (book.get('learned') or {}).get('handle', '').lower()
    items = [p for p in x.mentions(want=env.setting('mentions.max_per_run') * 3 or 15) if p['handle'].lower() != me]
    made = 0
    for p in items:
        if made >= (env.setting('mentions.max_per_run') or 5):
            break
        if db.one('SELECT 1 FROM seen WHERE url=?', (p['url'],)):
            continue
        _remember([p], 'mention')
        recent_same = db.one("SELECT 1 FROM actions WHERE kind='reply' AND target_handle=? AND created_at>?",
                             (p['handle'], time.time() - 86400))
        try:
            ans = writer.write_json(MENTION.format(voice=playbook.voice_block(book), handle=p['handle'], text=p['text'][:800],
                                                   context='', lang=_lang_of(p['text'])), env.setting('redlines'))
        except Exception as e:
            db.log('处理通知失败:%s' % e, 'warn')
            break
        act = ans.get('action') if isinstance(ans, dict) else 'skip'
        db.run("UPDATE seen SET used=? WHERE url=?", (act, p['url']))
        if act == 'reply' and ans.get('text') and not recent_same and not _redline_hit(ans['text']):
            mode = env.automation('mentions')
            if mode != 'off':
                db.run('INSERT INTO actions(kind, target_url, target_handle, target_text, text, reason, status, due_at, created_at) '
                       'VALUES(?,?,?,?,?,?,?,?,?)',
                       ('reply', p['url'], p['handle'], p['text'][:1000], writer.split_thread(ans['text'])[0], '回读者',
                        'queued' if mode == 'auto' else 'pending', time.time() + random.uniform(120, 1200), time.time()))
                made += 1
        elif act == 'like':
            _queue('like', p, reason='读者的附和')
    if made:
        db.log('读者通知:起草回复 %d 条' % made)
    return made


def discover_follows(n=3):
    """Watched accounts we do not follow yet, and authors of strong posts in the niche."""
    if cap_left('follow') <= 0:
        return 0                     # warm-up stage 1, or today's follows used up
    book = _book()
    done = {r['target_handle'].lower() for r in db.q("SELECT target_handle FROM actions WHERE kind='follow'") if r['target_handle']}
    me = (book.get('learned') or {}).get('handle', '').lower()
    cands = [w['handle'] for w in book.get('watch') or []]
    cands += [r['handle'] for r in db.q("SELECT handle, MAX(likes) l FROM seen WHERE source LIKE 'kw:%' GROUP BY handle "
                                        "ORDER BY l DESC LIMIT 20")]
    made = 0
    for h in cands:
        if made >= n:
            break
        if not h or h.lower() in done or h.lower() == me:
            continue
        _queue('follow', {'url': 'https://x.com/' + h, 'handle': h}, reason='同领域账号')
        done.add(h.lower())
        made += 1
    return made


# ---- doing -------------------------------------------------------------------

def publish_due(post_id=None):
    """The next scheduled post that is due, within today's cap and the warm-up. With
    post_id, that post now: the person pressed "post now", so caps and warm-up yield."""
    if halted():
        return 0
    if post_id:
        rows = db.q("SELECT * FROM posts WHERE id=? AND status!='published'", (post_id,))
    else:
        rows = db.q("SELECT * FROM posts WHERE status='scheduled' AND due_at<=? ORDER BY due_at LIMIT 1", (time.time(),))
    for r in rows:
        if not post_id and cap_left('post') <= 0:
            return 0
        handle = (db.playbook().get('learned') or {}).get('handle')
        try:
            res = x.post(json.loads(r['parts']), handle=handle)
        except x.Unhealthy as e:
            on_unhealthy(e.state)
            return 0
        if res.get('ok'):
            db.run("UPDATE posts SET status='published', published_at=?, url=? WHERE id=?", (time.time(), res.get('url'), r['id']))
            db.log('发出原创 #%d %s' % (r['id'], res.get('url') or ''))
        else:
            db.run("UPDATE posts SET status='failed', error=? WHERE id=?", (res.get('error'), r['id']))
            db.log('原创 #%d 没发出去:%s' % (r['id'], res.get('error')), 'warn')
        return 1
    return 0


def do_action(a):
    handle = (db.playbook().get('learned') or {}).get('handle')
    if a['kind'] == 'reply':
        return x.reply(a['target_url'], a['text'], handle=handle)
    if a['kind'] == 'quote':
        return x.quote(a['target_url'], a['text'], handle=handle)
    if a['kind'] == 'like':
        return x.like(a['target_url'])
    if a['kind'] == 'follow':
        return x.follow(a['target_handle'])
    return {'ok': False, 'error': 'unknown kind'}


def run_actions(limits):
    """Carry out queued actions, up to `limits` per kind, a person's pace apart."""
    done = {k: 0 for k in KINDS}
    first_stage = stage() == 1
    rows = db.q("SELECT * FROM actions WHERE status='queued' AND due_at<=? ORDER BY "
                "CASE reason WHEN '回读者' THEN 0 ELSE 1 END, due_at LIMIT 40", (time.time(),))
    for a in rows:
        k = a['kind']
        if halted() or done[k] >= limits.get(k, 0) or cap_left(k) <= 0:
            continue
        if first_stage and k == 'reply' and a['reason'] != '回读者':
            continue                 # warm-up stage 1: only answering people who talked to us
        try:
            res = do_action(a)
        except x.Unhealthy as e:
            db.run("UPDATE actions SET status='queued' WHERE id=?", (a['id'],))
            on_unhealthy(e.state)
            break
        except browser.BrowserError as e:
            db.log('浏览器出错:%s' % e, 'warn')
            break
        if res.get('ok'):
            db.run("UPDATE actions SET status='done', done_at=?, result_url=? WHERE id=?", (time.time(), res.get('url'), a['id']))
            done[k] += 1
        else:
            db.run("UPDATE actions SET status='failed', error=?, done_at=? WHERE id=?", (res.get('error'), time.time(), a['id']))
        gap()
    if any(done.values()):
        db.log('会话:回复 %(reply)d、引用 %(quote)d、点赞 %(like)d、关注 %(follow)d' % done)
    return done


def session():
    """One burst of activity, like a person checking X: readers first, then the front row, likes, follows."""
    if halted():
        return None
    r = lambda key: random.randint(*(env.setting(key) or [0, 0]))
    warm = stage()
    try:
        x.mentions(want=5)       # look at notifications first, as a person would
        browser.scroll()
        if warm or random.random() < 0.5:
            browse(likes=random.randint(2, 5) if warm == 1 else 0)
    except x.Unhealthy as e:
        on_unhealthy(e.state)
        return None
    return run_actions({'reply': r('sessions.replies'), 'quote': 1, 'like': r('sessions.likes'), 'follow': r('sessions.follows')})


def browse(likes=0):
    """Read like a person: scroll the home timeline, open a post now and then, look in on
    one account in the niche. With `likes`, like a few of the niche posts it read (in
    warm-up stage 1 this is what the account mostly does)."""
    _remember(x.home(want=random.randint(8, 20)), 'home')
    book = db.playbook()
    watch = [w['handle'] for w in book.get('watch') or []]
    if watch:
        h = random.choice(watch)
        _remember(x.posts_of(h, want=5), 'watch:' + h)
        browser.pause(4, 12)
    if likes <= 0:
        return 0
    rows = db.q("SELECT * FROM seen WHERE (source LIKE 'watch:%' OR source LIKE 'kw:%') AND captured_at>? "
                "ORDER BY likes DESC LIMIT 40", (time.time() - 48 * 3600,))
    made = 0
    for row in rows:
        if made >= likes:
            break
        if _already(row['url'], 'like') or _redline_hit(row['text']):
            continue
        if _queue('like', row, reason='养号:读到的同领域好帖', soon=False):
            made += 1
    return made


# ---- measuring and learning ---------------------------------------------------------

def measure():
    book = db.playbook()
    handle = (book.get('learned') or {}).get('handle')
    if not handle:
        return
    prof = x.profile(handle)
    if prof.get('followers') is not None:
        db.run('INSERT INTO snapshots(at, followers, following) VALUES(?,?,?)', (time.time(), prof['followers'], prof.get('following')))
        book['learned']['profile'] = {**(book['learned'].get('profile') or {}), **prof}
        db.save_playbook(book)
    for p in x.posts_of(handle, want=40, include_replies=True):
        # our replies and quotes too: how they did, for the numbers page
        db.run("UPDATE actions SET views=?, likes=?, replies=?, measured_at=? WHERE result_url=? AND kind IN ('reply','quote')",
               (p['views'], p['likes'], p['replies'], time.time(), p['url']))
        if not p['is_reply']:
            db.run('UPDATE posts SET views=?, likes=?, replies=?, reposts=?, bookmarks=?, measured_at=? WHERE url=?',
                   (p['views'], p['likes'], p['replies'], p['reposts'], p['bookmarks'], time.time(), p['url']))
    db.log('记录数据:粉丝 %s' % prof.get('followers'))


def weekly_learn():
    """What worked this week -> next week's pillar weights and posting hours."""
    book = _book()
    since = time.time() - 7 * 86400
    rows = db.q("SELECT pillar, format, published_at, views, likes, replies, reposts, bookmarks FROM posts "
                "WHERE status='published' AND published_at>? AND measured_at IS NOT NULL", (since,))
    snaps = db.q('SELECT at, followers FROM snapshots WHERE at>? ORDER BY at', (since,))
    by_pillar = {}
    for r in rows:
        by_pillar.setdefault(r['pillar'], []).append(playbook.score(r))
    avg = {k: sum(v) / len(v) for k, v in by_pillar.items()}
    overall = (sum(avg.values()) / len(avg)) if avg else 0
    changes = []
    for p in book.get('pillars') or []:
        if p['name'] in avg and overall:
            ratio = avg[p['name']] / overall
            new = round(min(3.0, max(0.3, p.get('weight', 1.0) * (0.7 + 0.3 * ratio))), 2)
            if abs(new - p.get('weight', 1.0)) >= 0.05:
                changes.append('「%s」权重 %.2f → %.2f(平均互动 %.0f,整体 %.0f)' % (p['name'], p.get('weight', 1.0), new, avg[p['name']], overall))
                p['weight'] = new
    # Accounts whose posts we replied to and that then engaged with us stay; others drop down the list.
    report = {
        'at': time.time(),
        'followers': [snaps[0]['followers'], snaps[-1]['followers']] if snaps else None,
        'posts': len(rows),
        'actions': {k: db.one("SELECT COUNT(*) n FROM actions WHERE kind=? AND status='done' AND done_at>?", (k, since))['n'] for k in KINDS},
        'pillars': avg,
        'changes': changes,
    }
    book.setdefault('history', []).append(report)
    book['history'] = book['history'][-12:]
    db.save_playbook(book)
    db.log('周报:%d 条原创,调整 %d 处' % (len(rows), len(changes)))
    return report
