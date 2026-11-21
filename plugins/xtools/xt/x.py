"""X itself: read pages and act on them, as the signed-in person would in the browser.

Every read returns plain dicts; every action returns {"ok": bool, ...} and checks the
account's health afterwards. Selectors are X's data-testid attributes."""
import json
import re
import time
import urllib.parse

from . import browser as b

X = 'https://x.com'
DIALOG_OPEN = """!!document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"]')"""

# Every post on the page as data. Ads (no timestamp link) are dropped.
READ_POSTS = r"""
(() => {
  const num = (label, words) => {
    for (const w of words) {
      const m = label.match(new RegExp('([\\d.,]+\\s*[KkMm万千]?)\\s*' + w));
      if (m) {
        let s = m[1].replace(/[,\s]/g, ''), mul = 1;
        if (/[Kk千]$/.test(s)) { mul = 1e3; s = s.slice(0, -1); }
        else if (/[Mm]$/.test(s)) { mul = 1e6; s = s.slice(0, -1); }
        else if (/万$/.test(s)) { mul = 1e4; s = s.slice(0, -1); }
        return Math.round(parseFloat(s) * mul) || 0;
      }
    }
    return 0;
  };
  return [...document.querySelectorAll('article[data-testid="tweet"]')].map(a => {
    const t = a.querySelector('a[href*="/status/"] time');
    if (!t) return null;
    const href = t.closest('a').getAttribute('href');
    const label = (a.querySelector('[role="group"][aria-label]') || {getAttribute: () => ''}).getAttribute('aria-label') || '';
    const social = (a.querySelector('[data-testid="socialContext"]') || {}).innerText || '';
    return {
      url: 'https://x.com' + href.replace(/\/(analytics|photo|video).*$/, ''),
      handle: href.split('/')[1],
      at: Date.parse(t.getAttribute('datetime')) / 1000,
      text: ((a.querySelector('[data-testid="tweetText"]') || {}).innerText || '').trim(),
      replies: num(label, ['repl', '回复', '件の返信']),
      reposts: num(label, ['repost', '转帖', '转推', '件のリポスト']),
      likes: num(label, ['like', '喜欢', '件のいいね']),
      bookmarks: num(label, ['bookmark', '书签', '件のブックマーク']),
      views: num(label, ['view', '查看', '次查看', '件の表示']),
      pinned: /Pinned|已置顶|固定/.test(social),
      repost_by: /repost|转帖|转推|リポスト/i.test(social) && !/Pinned|已置顶|固定/.test(social),
      is_reply: !!a.querySelector('[data-testid="tweetText"]') && /Replying to|回复 @|返信先/.test(a.innerText.slice(0, 300)),
      has_media: !!a.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]'),
    };
  }).filter(Boolean);
})()
"""

HEALTH = r"""
(() => {
  const p = location.pathname, txt = (document.body ? document.body.innerText : '').slice(0, 4000);
  if (/^\/account\/access|^\/account\/suspended/.test(p)) return 'locked';
  if (/^\/(i\/flow\/)?login/.test(p) || document.querySelector('a[href="/login"][data-testid="loginButton"]')) return 'signed_out';
  if (/rate limit|exceeded the (number|limit)|over the daily limit|请求过多|超出.*限制|制限を超え/i.test(txt)) return 'limited';
  if (/suspended|已被冻结|凍結/i.test(txt) && /account|账号|アカウント/i.test(txt) && p.split('/').length <= 2) return 'locked';
  if (/Something went wrong|出错了|問題が発生/i.test(txt) && !document.querySelector('article')) return 'error';
  return 'ok';
})()
"""


class Unhealthy(RuntimeError):
    def __init__(self, state):
        super().__init__(state)
        self.state = state


def health():
    return b.js(HEALTH) or 'error'


def _check():
    st = health()
    if st != 'ok':
        raise Unhealthy(st)


def me():
    """The signed-in handle (without @), or None if X is not signed in."""
    b.go(X + '/home')
    h = b.wait_for('(() => { const a = document.querySelector(\'a[data-testid="AppTabBar_Profile_Link"]\');'
                   ' return a && a.getAttribute("href"); })()', 15)
    return h.strip('/') if h else None


def _collect(url, want, max_scrolls=8, keep=None):
    b.go(url)
    _check()
    b.wait_for('!!document.querySelector(\'article[data-testid="tweet"]\')', 15)
    seen, out = set(), []
    for _ in range(max_scrolls):
        for p in b.js(READ_POSTS) or []:
            if p['url'] in seen or (keep and not keep(p)):
                continue
            seen.add(p['url'])
            out.append(p)
        if len(out) >= want:
            break
        b.scroll()
    return out[:want]


def profile(handle):
    """Followers, following, name, bio of a profile."""
    b.go('%s/%s' % (X, handle))
    _check()
    got = b.wait_for(r"""(() => {
      const f = [...document.querySelectorAll('a[href$="/followers"], a[href$="/verified_followers"]')][0];
      const g = document.querySelector('a[href$="/following"]');
      if (!f && !g) return null;
      const n = el => { if (!el) return null; const m = el.innerText.replace(/,/g, '').match(/([\d.]+)\s*([KkMm万]?)/);
        if (!m) return null; const mul = {k: 1e3, K: 1e3, m: 1e6, M: 1e6, '万': 1e4}[m[2]] || 1; return Math.round(parseFloat(m[1]) * mul); };
      return {followers: n(f), following: n(g),
              name: ((document.querySelector('[data-testid="UserName"]') || {}).innerText || '').split('\n')[0],
              bio: (document.querySelector('[data-testid="UserDescription"]') || {}).innerText || ''};
    })()""", 15)
    return got or {}


def posts_of(handle, want=40, include_replies=False):
    """Recent posts written by this account (not reposts), newest first."""
    keep = lambda p: p['handle'].lower() == handle.lower() and not p['repost_by'] and (include_replies or not p['is_reply'])
    url = '%s/%s%s' % (X, handle, '/with_replies' if include_replies else '')
    return _collect(url, want, max_scrolls=max(4, want // 4), keep=keep)


def mentions(want=20):
    return _collect(X + '/notifications/mentions', want, max_scrolls=4)


def search(query, want=20, latest=True):
    url = '%s/search?q=%s&src=typed_query%s' % (X, urllib.parse.quote(query), '&f=live' if latest else '')
    return _collect(url, want, max_scrolls=4, keep=lambda p: not p['repost_by'])


def thread_context(url, want=6):
    """The post and what it replies to, for answering with context."""
    return _collect(url, want, max_scrolls=1)


# ---- acting ------------------------------------------------------------------

def _status_id(url):
    m = re.search(r'/status/(\d+)', url or '')
    return m.group(1) if m else ''


def _main_article_js(sid, inner):
    """Run `inner` (JS using `art`) on the article of status `sid` on its own page."""
    return r"""(() => {
      const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
      const art = arts.find(a => [...a.querySelectorAll('a[href*="/status/%s"] time')].length) || arts[0];
      if (!art) return null;
      %s
    })()""" % (sid, inner)


def _type_into(selector, text):
    """Put text into X's composer the way a paste does: its editor takes it whole (any
    script, emoji, line breaks) and the Post button sees it. Checked afterwards."""
    if not b.wait_for('!!document.querySelector(%s)' % json.dumps(selector), 10):
        return False
    b.pause(0.6, 1.6)
    b.paste(selector, text)
    b.pause(0.8, 1.8)
    got = b.js('(document.querySelector(%s)||{}).innerText||""' % json.dumps(selector)) or ''
    return _norm(got) == _norm(text)


def _box(i=0):
    """The composer's text box: the one in the dialog when a dialog is open (the home page has its own behind it)."""
    dlg = b.js(DIALOG_OPEN)
    return ('[role="dialog"] ' if dlg else '') + '[data-testid="tweetTextarea_%d"]' % i


def _norm(s):
    return re.sub(r'\s+', '', s or '')


def _send(button='tweetButton'):
    scope = '[role="dialog"] ' if b.js(DIALOG_OPEN) else ''
    sel = scope + '[data-testid="%s"]' % button
    ok = b.wait_for('(() => { const e = document.querySelector(%s) || document.querySelector(\'[data-testid="tweetButtonInline"]\');'
                    ' return !!e && !e.disabled && e.getAttribute("aria-disabled") !== "true"; })()' % json.dumps(sel), 10)
    if not ok:
        return False
    if not b.js('!!document.querySelector(%s)' % json.dumps(sel)):
        sel = scope + '[data-testid="tweetButtonInline"]'
    b.pause(0.6, 1.6)
    b.click(sel)
    # Sent when the composer is gone.
    return bool(b.wait_for('!document.querySelector(\'[data-testid="tweetTextarea_0"]\') || '
                           '!!document.querySelector(\'[data-testid="toast"]\')', 20))


def _latest_own_url(handle, after, near_text=''):
    """The URL of the post we just made: newest of ours since `after`."""
    for p in posts_of(handle, want=6, include_replies=True):
        if p['at'] >= after - 120 and (not near_text or _norm(near_text)[:20] in _norm(p['text'])):
            return p['url']
    return ''


def post(parts, handle=None, image=None, dry_run=False):
    """A post; a thread when parts has more than one piece. A thread is what X makes it:
    the first post, then each next part as a reply to the one before."""
    parts = [p for p in (parts or []) if p and p.strip()]
    if not parts:
        return {'ok': False, 'error': 'empty'}
    first = _post_one(parts[0], handle=handle, image=image, dry_run=dry_run)
    if not first.get('ok') or dry_run or len(parts) == 1:
        return first
    if not first.get('url'):
        return {'ok': False, 'error': 'posted the first part but could not find it to continue the thread', 'url': ''}
    prev, urls = first['url'], [first['url']]
    for i, text in enumerate(parts[1:], 2):
        b.pause(4, 10)
        r = reply(prev, text, handle=handle)
        if not r.get('ok') or not r.get('url'):
            return {'ok': False, 'error': 'thread stopped at part %d: %s' % (i, r.get('error') or 'no url'), 'url': first['url'], 'urls': urls}
        prev = r['url']
        urls.append(prev)
    return {'ok': True, 'url': first['url'], 'urls': urls}


def _post_one(text, handle=None, image=None, dry_run=False):
    started = time.time()
    b.go(X + '/compose/post')
    _check()
    if not b.wait_for(DIALOG_OPEN, 15):
        return {'ok': False, 'error': 'composer-not-found'}
    if not _type_into(_box(0), text):
        return {'ok': False, 'error': 'text-did-not-take'}
    if image:
        b.upload('[role="dialog"] [data-testid="fileInput"]', image)
        b.wait_for('!!document.querySelector(\'[role="dialog"] [data-testid="attachments"] img\')', 30)
    if dry_run:
        return {'ok': True, 'dry_run': True}
    if not _send('tweetButton'):
        return {'ok': False, 'error': 'send-failed'}
    b.pause(2, 4)
    _check()
    return {'ok': True, 'url': _latest_own_url(handle, started, text) if handle else ''}


def reply(url, text, handle=None, dry_run=False):
    sid = _status_id(url)
    started = time.time()
    b.go(url)
    _check()
    if not b.wait_for(_main_article_js(sid, 'return !!art.querySelector(\'[data-testid="reply"]\');'), 15):
        return {'ok': False, 'error': 'post-not-found'}
    b.pause(2, 5)   # read it first
    b.js(_main_article_js(sid, 'art.querySelector(\'[data-testid="reply"]\').click(); return true;'))
    if not b.wait_for('!!document.querySelector(\'[data-testid="tweetTextarea_0"]\')', 10):
        return {'ok': False, 'error': 'reply-box-not-found'}
    if not _type_into(_box(0), text):
        return {'ok': False, 'error': 'text-did-not-take'}
    if dry_run:
        return {'ok': True, 'dry_run': True}
    if not _send('tweetButton'):
        return {'ok': False, 'error': 'send-failed'}
    b.pause(2, 4)
    _check()
    return {'ok': True, 'url': _latest_own_url(handle, started, text) if handle else ''}


def quote(url, text, handle=None, dry_run=False):
    """A quote is our post with the other post's link at the end: X shows it as a quote."""
    return post([text.rstrip() + '\n' + url.split('?')[0]], handle=handle, dry_run=dry_run)


def like(url, dry_run=False):
    sid = _status_id(url)
    b.go(url)
    _check()
    state = b.wait_for(_main_article_js(sid, 'return art.querySelector(\'[data-testid="unlike"]\') ? "liked" : '
                                             '(art.querySelector(\'[data-testid="like"]\') ? "can" : null);'), 15)
    if state == 'liked':
        return {'ok': True, 'already': True}
    if state != 'can':
        return {'ok': False, 'error': 'like-button-not-found'}
    if dry_run:
        return {'ok': True, 'dry_run': True}
    b.pause(1.5, 4)
    b.js(_main_article_js(sid, 'art.querySelector(\'[data-testid="like"]\').click(); return true;'))
    ok = b.wait_for(_main_article_js(sid, 'return !!art.querySelector(\'[data-testid="unlike"]\');'), 8)
    _check()
    return {'ok': bool(ok)}


def follow(handle, dry_run=False):
    b.go('%s/%s' % (X, handle))
    _check()
    # The header button names the account: aria-label "Follow @handle".
    find = r"""(() => { const h = %s.toLowerCase();
      const bs = [...document.querySelectorAll('[data-testid="primaryColumn"] [data-testid$="-follow"], [data-testid="primaryColumn"] [data-testid$="-unfollow"]')];
      const m = bs.find(e => (e.getAttribute('aria-label') || '').toLowerCase().includes('@' + h)) || null;
      if (!m) return null; return m.getAttribute('data-testid').endsWith('-unfollow') ? 'following' : m.getAttribute('data-testid'); })()""" % json.dumps(handle)
    state = b.wait_for(find, 15)
    if state == 'following':
        return {'ok': True, 'already': True}
    if not state:
        return {'ok': False, 'error': 'follow-button-not-found'}
    if dry_run:
        return {'ok': True, 'dry_run': True}
    b.pause(1.5, 4)
    b.click('[data-testid="primaryColumn"] [data-testid="%s"]' % state)
    ok = bool(b.wait_for('(%s) === "following"' % find, 8))
    _check()
    return {'ok': ok}
