"""X itself: read pages and act on them, as the signed-in person would in the browser.

Every read returns plain dicts; every action returns {"ok": bool, ...} and checks the
account's health afterwards. Selectors are X's data-testid attributes."""
import json
import random
import re
import time
import urllib.parse

from . import browser as b
from . import human

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

# What X itself says on the page -- its notices, alerts, dialogs and the column's own
# messages -- never what people wrote: posts, names, bios, trends and the composer are left
# out, so a post that talks about rate limits (common in this niche) is not taken for one.
HEALTH = r"""
(() => {
  const p = location.pathname;
  if (/^\/account\/access|^\/account\/suspended/.test(p)) return 'locked';
  if (/^\/(i\/flow\/)?login/.test(p) || document.querySelector('a[href="/login"][data-testid="loginButton"]')) return 'signed_out';
  const skip = 'article, [data-testid="tweetText"], [data-testid="UserDescription"], [data-testid="UserName"], ' +
               '[data-testid="UserCell"], [data-testid="trend"], [data-testid^="tweetTextarea"], [contenteditable="true"]';
  const roots = [...document.querySelectorAll('[data-testid="toast"], [role="alert"], [role="dialog"], [data-testid="primaryColumn"], [data-testid="error-detail"]')];
  let txt = '';
  for (const r of roots) {
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT,
      {acceptNode: n => n.parentElement && n.parentElement.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
    let n;
    while ((n = w.nextNode()) && txt.length < 4000) txt += n.nodeValue + ' ';
  }
  if (!document.querySelector('[data-testid="primaryColumn"]'))   // X's bare error page
    txt += (document.body ? document.body.innerText : '').slice(0, 2000);
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
    """The signed-in handle (without @), or None if X is not signed in. Read off the page
    that is open when X is open already: no reload just to see who is signed in."""
    if not _on_x():
        _load(X + '/home')
    # X has moved the "Profile" tab out of the side nav; the account button bottom-left
    # ("name\n@handle") is there either way, the old tab is the fallback.
    h = b.wait_for(r'''(() => {
      const s = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      const m = s && s.innerText.match(/@([A-Za-z0-9_]{1,15})/);
      if (m) return m[1];
      // A narrow window folds the side nav to icons: no text, but the avatar names the account.
      const av = s && s.querySelector('[data-testid^="UserAvatar-Container-"]');
      if (av) return av.getAttribute('data-testid').slice('UserAvatar-Container-'.length);
      const a = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
      return a && a.getAttribute("href");
    })()''', 20)
    return h.strip('/') if h else None


# ---- moving around ---------------------------------------------------------------
# A person loads X once and then moves inside it: the side bar, a name on a post, the time
# of a post, the search box. A typed address reloads the whole app -- a burst of requests
# X counts -- so it is the last resort, and a visit has only so many (`BUDGET`).

BUDGET = {'pages': None}          # whole-page loads allowed in this visit; None = no limit


class OutOfPages(RuntimeError):
    """The visit has used its page loads; it ends here rather than reload X again."""


def _load(url):
    if BUDGET['pages'] is not None and b.LOADS['pages'] >= BUDGET['pages']:
        raise OutOfPages(url)
    b.go(url)


def _on_x():
    try:
        return (b.js('location.hostname') or '').endswith('x.com')
    except b.BrowserError:
        return False


def _path(url):
    return url[len(X):] if url.startswith(X) else url


def _here():
    return b.js('location.pathname + location.search') or ''


def _same(a, b_):
    norm = lambda u: urllib.parse.unquote(u or '').rstrip('/').lower()
    return norm(a) == norm(b_)


# A link on the page that goes to `path`: the side bar's first, then one in view, then any;
# tagged so the human click (a real pointer) can find it, and brought into view.
_FIND_LINK = r"""(() => {
  const want = %s.toLowerCase().replace(/\/$/, '');
  document.querySelectorAll('[data-xt-nav]').forEach(e => e.removeAttribute('data-xt-nav'));
  const links = [...document.querySelectorAll('a[href]')].filter(a => {
    const h = (a.getAttribute('href') || '').toLowerCase().replace(/\/$/, '');
    return h === want && a.offsetParent !== null;
  });
  if (!links.length) return false;
  const inView = a => { const r = a.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; };
  const a = links.find(a => a.closest('nav')) || links.find(inView) || links[0];
  a.setAttribute('data-xt-nav', a.closest('nav') ? 'nav' : '1');
  if (!inView(a)) a.scrollIntoView({block: 'center', behavior: 'smooth'});
  return true;
})()"""


def _arrived(path, seconds=10):
    want = urllib.parse.unquote(path.split('?')[0]).rstrip('/').lower()
    return bool(b.wait_for('decodeURIComponent(location.pathname).replace(/\\/$/, "").toLowerCase() === %s'
                           % json.dumps(want), seconds))


def _by_link(path):
    """Click a link to `path` on the page, as a person does; True when it took us there."""
    if not b.js(_FIND_LINK % json.dumps(path)):
        return False
    human.sleep(human.think())
    b.click('a[data-xt-nav]')
    return _arrived(path)


def _route(path):
    """Move inside the open app when nothing on the page links there (an account nobody on
    the page mentions, say): the app's own router takes us, as its links do -- no reload.
    True when the app followed (its title changes with the page)."""
    before = b.js('document.title') or ''
    b.js('(() => { history.pushState({}, "", %s); dispatchEvent(new PopStateEvent("popstate", {state: history.state})); })()'
         % json.dumps(path))
    if not _arrived(path, 5):
        return False
    return bool(b.wait_for('document.title !== %s' % json.dumps(before), 8))


def open_page(url, fresh=False):
    """Go to an X page the way a person would: stay when it is open already, else by a link
    on the page, else through the app; by its address only when X is not open (or the app
    will not follow). `fresh`: when already there, look at what is new -- back to the top,
    and the side bar's link asked again (X then fetches the timeline's new posts only)."""
    path = _path(url)
    if _on_x():
        if _same(_here(), path):
            if fresh:
                b.js('window.scrollTo({top: 0, behavior: "smooth"})')
                b.pause(1.0, 2.5)
                if b.js(_FIND_LINK % json.dumps(path)) and b.js('!!document.querySelector(\'a[data-xt-nav="nav"]\')'):
                    human.sleep(human.think())
                    b.click('a[data-xt-nav="nav"]')
                    b.pause(1.5, 3.0)
            return
        if path == '/notifications/mentions' and not _same(_here(), '/notifications'):
            _by_link('/notifications')
            b.pause(1.0, 2.5)
        if _by_link(path) or _route(path):
            b.pause(1.5, 3.5)
            return
    _load(X + path)


def read(url, want, max_scrolls=8, keep=None, on_post=None, fresh=False):
    """Read a page of posts as a person does: each new post is looked at for as long as it
    takes to read; the scroll is uneven and now and then goes back up. `on_post(post)` is
    called for each post as it is read (to like it there and then). None as `url` reads the
    page that is open."""
    if url:
        open_page(url, fresh=fresh)
    _check()
    b.wait_for('!!document.querySelector(\'article[data-testid="tweet"]\')', 15)
    seen, out, idle = set(), [], 0
    for _ in range(max_scrolls):
        new = 0
        for p in b.js(READ_POSTS) or []:
            if p['url'] in seen:
                continue
            seen.add(p['url'])
            new += 1
            if keep and not keep(p):
                continue
            out.append(p)
            human.sleep(human.dwell(p.get('text'), p.get('has_media')))
            if on_post:
                on_post(p)
        if len(out) >= want:
            break
        if not new:
            # Nothing new came in: wait for it the way one does, and after two such waits
            # stop -- scrolling on regardless is what has X serve page after page.
            idle += 1
            if idle >= 2:
                break
            human.sleep(random.uniform(3, 7))
        else:
            idle = 0
        if human.chance(0.08):
            b.scroll(-random.randint(250, 600))      # back up to something just passed
        b.scroll()
    return out[:want]


def _collect(url, want, max_scrolls=8, keep=None):
    return read(url, want, max_scrolls=max_scrolls, keep=keep)


def profile(handle):
    """Followers, following, name, bio of a profile."""
    open_page('%s/%s' % (X, handle))
    _check()
    got = b.wait_for(r"""(() => {
      const f = [...document.querySelectorAll('a[href$="/followers"], a[href$="/verified_followers"]')][0];
      const g = document.querySelector('a[href$="/following"]');
      if (!f && !g) return null;
      const n = el => { if (!el) return null; const m = el.innerText.replace(/,/g, '').match(/([\d.]+)\s*([KkMm万]?)/);
        if (!m) return null; const mul = {k: 1e3, K: 1e3, m: 1e6, M: 1e6, '万': 1e4}[m[2]] || 1; return Math.round(parseFloat(m[1]) * mul); };
      const av = document.querySelector('a[href$="/photo"] img');
      return {followers: n(f), following: n(g),
              name: ((document.querySelector('[data-testid="UserName"]') || {}).innerText || '').split('\n')[0],
              bio: (document.querySelector('[data-testid="UserDescription"]') || {}).innerText || '',
              joined: (document.querySelector('[data-testid="UserJoinDate"]') || {}).innerText || '',
              default_avatar: !av || /default_profile/.test(av.getAttribute('src') || ''),
              banner: !!document.querySelector('a[href$="/header_photo"]')};
    })()""", 15)
    got = got or {}
    if got.get('joined'):
        got['joined_at'] = _joined_at(got['joined'])
    return got


_MONTHS = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}


def _joined_at(text):
    """'Joined March 2024' / '2024年3月 加入' -> the first of that month, as a timestamp."""
    m = re.search(r'(\d{4})\s*年\s*(\d{1,2})\s*月', text)
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
    else:
        m = re.search(r'([A-Za-z]{3})[a-z]*\.?\s+(\d{4})', text)
        if not m or m.group(1).lower() not in _MONTHS:
            return None
        y, mo = int(m.group(2)), _MONTHS[m.group(1).lower()]
    return time.mktime((y, mo, 1, 0, 0, 0, 0, 0, -1))


def home(want=15):
    """The home timeline, read the way a person scrolls it."""
    return read(X + '/home', want, max_scrolls=max(3, want // 4), fresh=True)


def posts_of(handle, want=12, include_replies=False, on_post=None):
    """Recent posts written by this account (not reposts), newest first."""
    keep = lambda p: p['handle'].lower() == handle.lower() and not p['repost_by'] and (include_replies or not p['is_reply'])
    url = '%s/%s%s' % (X, handle, '/with_replies' if include_replies else '')
    return read(url, want, max_scrolls=max(3, want // 4), keep=keep, on_post=on_post)


def mentions(want=20):
    return _collect(X + '/notifications/mentions', want, max_scrolls=4)


SEARCH_BOX = 'input[data-testid="SearchBox_Search_Input"]'


def _search_box(query, latest):
    """Search the way a person does: in the search box (the side bar's, or Explore's), sent,
    then the Latest tab. True when the results are open."""
    if not _on_x():
        return False
    box = '!!document.querySelector(%s)' % json.dumps(SEARCH_BOX)
    if not b.js(box) and not _by_link('/explore'):
        return False
    if not b.wait_for(box, 8):
        return False
    human.sleep(human.think())
    b.click(SEARCH_BOX)
    # What a previous search left in the box goes first, as select-all and typing over does.
    b.js(r"""(() => { const e = document.querySelector(%s); if (!e || !e.value) return;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(e, ''); e.dispatchEvent(new Event('input', {bubbles: true})); })()""" % json.dumps(SEARCH_BOX))
    b.type_text(SEARCH_BOX, query)
    b.pause(0.6, 1.6)
    b.js('(() => { const e = document.querySelector(%s); const f = e && e.closest("form");'
         ' if (f) { if (f.requestSubmit) f.requestSubmit(); else f.submit(); } })()' % json.dumps(SEARCH_BOX))
    if not _arrived('/search', 10):
        return False
    b.pause(1.5, 3.5)
    if latest and 'f=live' not in _here():
        tab = r"""(() => { document.querySelectorAll('[data-xt-nav]').forEach(e => e.removeAttribute('data-xt-nav'));
          const a = document.querySelector('a[role="tab"][href*="f=live"]');
          if (!a) return false; a.setAttribute('data-xt-nav', '1'); return true; })()"""
        if b.js(tab):
            human.sleep(human.think())
            b.click('a[data-xt-nav]')
            b.wait_for("location.search.includes('f=live')", 8)
            b.pause(1.0, 2.5)
    return True


def search(query, want=12, latest=True, on_post=None):
    if not _search_box(query, latest):
        open_page('%s/search?q=%s&src=typed_query%s' % (X, urllib.parse.quote(query), '&f=live' if latest else ''))
    return read(None, want, max_scrolls=4, keep=lambda p: not p['repost_by'], on_post=on_post)


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


def _tag(sid, testid):
    """Mark the button `testid` of post `sid` on this page and bring it into view, so the
    human click (a real pointer moving to it) can find it; True when it is there."""
    return bool(b.js(r"""(() => {
      document.querySelectorAll('[data-xt-act]').forEach(e => e.removeAttribute('data-xt-act'));
      const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
      const art = arts.find(a => [...a.querySelectorAll('a[href*="/status/%s"] time')].length);
      const btn = art && art.querySelector('[data-testid="%s"]');
      if (!btn) return false;
      btn.setAttribute('data-xt-act', '1');
      btn.scrollIntoView({block: 'center', behavior: 'smooth'});
      return true; })()""" % (sid, testid)))


def _press(sid, testid):
    """A person's click on that post's button."""
    if not _tag(sid, testid):
        return False
    human.sleep(human.think())
    b.click('[data-xt-act="1"]')
    return True


def _text_of(sid):
    return b.js(_main_article_js(sid, 'return (art.querySelector(\'[data-testid="tweetText"]\')||{}).innerText||"";')) or ''


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
    """The URL of the post we just made: the "View" link in X's own notice while it is up,
    else the newest of ours since `after` on our replies page."""
    href = b.wait_for('(() => { const a = document.querySelector(\'[data-testid="toast"] a[href*="/status/"]\');'
                      ' return a ? a.getAttribute("href") : ""; })()', 4)
    if href:
        return X + href
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
    open_page(X + '/compose/post')
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
    url = _latest_own_url(handle, started, text) if handle else ''
    b.pause(2, 4)
    _check()
    return {'ok': True, 'url': url}


def reply(url, text, handle=None, dry_run=False):
    sid = _status_id(url)
    started = time.time()
    open_page(url)
    _check()
    if not b.wait_for(_main_article_js(sid, 'return !!art.querySelector(\'[data-testid="reply"]\');'), 15):
        return {'ok': False, 'error': 'post-not-found'}
    human.sleep(human.dwell(_text_of(sid)))   # read it first
    if not _press(sid, 'reply'):
        return {'ok': False, 'error': 'reply-button-not-found'}
    if not b.wait_for('!!document.querySelector(\'[data-testid="tweetTextarea_0"]\')', 10):
        return {'ok': False, 'error': 'reply-box-not-found'}
    if not _type_into(_box(0), text):
        return {'ok': False, 'error': 'text-did-not-take'}
    if dry_run:
        return {'ok': True, 'dry_run': True}
    if not _send('tweetButton'):
        return {'ok': False, 'error': 'send-failed'}
    url = _latest_own_url(handle, started, text) if handle else ''
    b.pause(2, 4)
    _check()
    return {'ok': True, 'url': url}


def quote(url, text, handle=None, dry_run=False):
    """A quote is our post with the other post's link at the end: X shows it as a quote."""
    return post([text.rstrip() + '\n' + url.split('?')[0]], handle=handle, dry_run=dry_run)


def like(url, dry_run=False):
    sid = _status_id(url)
    if _on_x() and _tag(sid, 'unlike'):
        return {'ok': True, 'already': True}
    if _on_x() and _tag(sid, 'like'):
        return like_here(url, dry_run=dry_run)      # it is on the page open now
    open_page(url)
    _check()
    state = b.wait_for(_main_article_js(sid, 'return art.querySelector(\'[data-testid="unlike"]\') ? "liked" : '
                                             '(art.querySelector(\'[data-testid="like"]\') ? "can" : null);'), 15)
    if state == 'liked':
        return {'ok': True, 'already': True}
    if state != 'can':
        return {'ok': False, 'error': 'like-button-not-found'}
    if dry_run:
        return {'ok': True, 'dry_run': True}
    human.sleep(human.dwell(_text_of(sid)))
    if not _press(sid, 'like'):
        return {'ok': False, 'error': 'like-button-not-found'}
    ok = b.wait_for(_main_article_js(sid, 'return !!art.querySelector(\'[data-testid="unlike"]\');'), 8)
    _check()
    return {'ok': bool(ok)}


def like_here(url, dry_run=False):
    """Like a post on the page being read (the timeline, a search, a profile) without
    leaving it: the way a like is usually given."""
    sid = _status_id(url)
    if not sid:
        return {'ok': False, 'error': 'no-status-id'}
    if dry_run:
        return {'ok': _tag(sid, 'like'), 'dry_run': True}
    if not _press(sid, 'like'):
        return {'ok': False, 'error': 'like-button-not-found'}
    ok = b.wait_for(r"""(() => { const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
      const art = arts.find(a => [...a.querySelectorAll('a[href*="/status/%s"] time')].length);
      return !!(art && art.querySelector('[data-testid="unlike"]')); })()""" % sid, 8)
    _check()
    return {'ok': bool(ok)}


def follow(handle, dry_run=False, here=False):
    """Follow from the account's own page; `here` when that page is already open."""
    open_page('%s/%s' % (X, handle))
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
    # Look at who it is first: the bio, a few of their posts, then back up to the button.
    human.sleep(random.uniform(2, 5))
    for _ in range(random.randint(1, 3)):
        b.scroll(random.randint(350, 800))
        human.sleep(random.uniform(1.5, 5))
    b.js('window.scrollTo({top: 0, behavior: "smooth"})')
    human.sleep(human.think() + 0.8)
    b.click('[data-testid="primaryColumn"] [data-testid="%s"]' % state)
    ok = bool(b.wait_for('(%s) === "following"' % find, 8))
    _check()
    return {'ok': ok}
