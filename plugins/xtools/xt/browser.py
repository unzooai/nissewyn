"""The Unzoo browser, through its local REST API: one working tab in the bound profile."""
import json
import random
import threading
import time
import urllib.error
import urllib.request

from . import env
from .i18n import msg

BASE = 'http://127.0.0.1:9399'
_LOCK = threading.RLock()     # one action at a time on the account: never two tabs racing
_TAB = {'id': None}
_ALIVE_FOR = 120              # a tab that answered this recently is taken to be there still
# Whole-page loads (an address typed) and in-app moves, counted for the visit's budget: a
# person on X loads it once and then moves by clicking, and every load is a burst of requests.
LOADS = {'pages': 0, 'moves': 0}


class BrowserError(RuntimeError):
    pass


def _call(path, body=None, timeout=60):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={'Content-Type': 'application/json'},
                                 method='POST' if body is not None else 'GET')
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=timeout).read() or b'{}')
    except urllib.error.HTTPError as e:
        raise BrowserError('%s: HTTP %s %s' % (path, e.code, e.read()[:200].decode('utf-8', 'replace')))
    except (urllib.error.URLError, OSError) as e:
        raise BrowserError(msg('Unzoo 浏览器没有响应({error})', error=e))
    if isinstance(r, dict) and r.get('success') is False:
        raise BrowserError('%s: %s' % (path, r.get('error') or r))
    return r.get('data') if isinstance(r, dict) and 'data' in r else r


def reachable():
    try:
        _call('/api/v1/profiles', timeout=5)
        return True
    except BrowserError:
        return False


def profiles():
    d = _call('/api/v1/profiles', timeout=10)
    items = d.get('profiles', d) if isinstance(d, dict) else d
    return [{'id': p.get('profile_id'), 'name': p.get('name')} for p in items or []]


def signed_out_text():
    """Says which browser identity was checked, so a wrong binding is obvious."""
    pid = env.browser_profile()
    try:
        name = next((p['name'] for p in profiles() if p['id'] == pid), None) or pid
    except BrowserError:
        name = pid
    return msg('浏览器身份「{profile}」里 X 没有登录。如果你的 X 登录在别的身份里,到 设置 › X 账号 选那个;'
               '否则在这个身份里登录 X。', profile=name)


def _alive(tab):
    try:
        return _call('/api/v1/evaluate', {'tab_id': tab, 'expression': '1'}, timeout=10).get('result') == 1
    except BrowserError:
        return False


def tab():
    """Our own tab in the account's profile, made once and reused (never someone else's tab).
    It is asked whether it is still there only when it has not answered for a while, not
    before every step."""
    with _LOCK:
        profile = env.browser_profile()
        if not profile:
            raise BrowserError(msg('还没指定 X 账号用哪个浏览器身份(Nissewyn › 插件 › Xtools › 设置 › 账号与模型)'))
        if _TAB['id'] and _TAB.get('profile') == profile:
            if time.time() - _TAB.get('ok_at', 0) < _ALIVE_FOR or _alive(_TAB['id']):
                return _TAB['id']
        d = _call('/api/v1/tabs/create', {'profile_id': profile, 'url': 'about:blank'})
        _TAB.update(id=d['tab_id'], profile=profile, ok_at=time.time())
        return _TAB['id']


def _on_tab(path, body, timeout):
    """A call on our tab. When the tab has gone (closed by hand) it is made again once."""
    t = tab()
    try:
        r = _call(path, dict(body, tab_id=t), timeout=timeout)
    except BrowserError:
        if _alive(t):
            raise
        _TAB['id'] = None
        r = _call(path, dict(body, tab_id=tab()), timeout=timeout)
    _TAB['ok_at'] = time.time()
    return r


def close():
    with _LOCK:
        if _TAB['id']:
            try:
                _call('/api/v1/tabs/close', {'tab_id': _TAB['id']}, timeout=10)
            except BrowserError:
                pass
            _TAB['id'] = None


def go(url, settle=(2.5, 5.0)):
    """Load a page by its address: the whole page again. Counted (see LOADS)."""
    _on_tab('/api/v1/navigate', {'url': url}, timeout=60)
    LOADS['pages'] += 1
    time.sleep(random.uniform(*settle))
    return _TAB['id']


def js(expr, timeout=30):
    r = _on_tab('/api/v1/evaluate', {'expression': expr}, timeout=timeout)
    return r.get('result') if isinstance(r, dict) else r


def wait_for(expr, seconds=15, every=1.2):
    """Look again now and then until a JS expression is truthy; its value, or None. The
    first look is right away; after that about every `every` seconds, unevenly."""
    end = time.time() + seconds
    while True:
        v = js(expr)
        if v:
            return v
        if time.time() >= end:
            return None
        time.sleep(min(max(0.2, end - time.time()), random.uniform(every * 0.7, every * 1.4)))


def click(selector):
    """A person's click: move, pause, click (Unzoo's human click). It clicked even when Unzoo
    could not see a change afterwards (focusing a text box changes nothing visible); callers
    check the outcome they need themselves."""
    try:
        return _on_tab('/api/v1/human/click', {'selector': selector}, timeout=60)
    except BrowserError as e:
        if 'not_verified' in str(e):
            return None
        raise


def type_text(selector, text):
    """A person's typing into an element (rhythm, read-back)."""
    return _on_tab('/api/v1/human/type', {'selector': selector, 'text': text}, timeout=180)


def paste(selector, text):
    """Paste text into an editor as the clipboard would: the editor's own paste handling
    takes it, so rich editors (X's Draft.js) keep their state right. Any text, any script."""
    return js(r"""(() => { const e = document.querySelector(%s); if (!e) return false; e.focus();
      const dt = new DataTransfer(); dt.setData('text/plain', %s);
      e.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
      return true; })()""" % (json.dumps(selector), json.dumps(text)))


def upload(selector, path):
    return _on_tab('/api/v1/upload', {'selector': selector, 'file_path': path}, timeout=60)


def pause(lo=0.8, hi=2.2):
    time.sleep(random.uniform(lo, hi))


def scroll(px=None):
    """A flick of the wheel: part of a screen to most of one, smooth, then a moment for the
    eye to land. Never more than a screen at once: what was skipped was never read, and
    racing down a timeline is what makes X fetch page after page. Negative goes back up."""
    if px is None:
        screen = _TAB.get('screen') or js('window.innerHeight') or 800
        _TAB['screen'] = screen
        px = int(screen * random.choice([random.uniform(0.35, 0.6), random.uniform(0.5, 0.85), random.uniform(0.7, 1.0)]))
    js('window.scrollBy({top: %d, behavior: "smooth"})' % px)
    pause(1.4, 3.6)
