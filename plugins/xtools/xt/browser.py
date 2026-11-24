"""The Unzoo browser, through its local REST API: one working tab in the bound profile."""
import json
import random
import threading
import time
import urllib.error
import urllib.request

from . import env

BASE = 'http://127.0.0.1:9399'
_LOCK = threading.RLock()     # one action at a time on the account: never two tabs racing
_TAB = {'id': None}


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
        raise BrowserError('Unzoo 浏览器没有响应(%s)' % e)
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
    return ('浏览器身份「%s」里 X 没有登录。如果你的 X 登录在别的身份里,到 设置 › X 账号 选那个;'
            '否则在这个身份里登录 X。' % name)


def _alive(tab):
    try:
        return _call('/api/v1/evaluate', {'tab_id': tab, 'expression': '1'}, timeout=10).get('result') == 1
    except BrowserError:
        return False


def tab():
    """Our own tab in the account's profile, made once and reused (never someone else's tab)."""
    with _LOCK:
        profile = env.browser_profile()
        if not profile:
            raise BrowserError('还没指定 X 账号用哪个浏览器身份(Nissewyn › 插件 › Xtools › 设置 › 账号与模型)')
        if _TAB['id'] and _TAB.get('profile') == profile and _alive(_TAB['id']):
            return _TAB['id']
        d = _call('/api/v1/tabs/create', {'profile_id': profile, 'url': 'about:blank'})
        _TAB.update(id=d['tab_id'], profile=profile)
        return _TAB['id']


def close():
    with _LOCK:
        if _TAB['id']:
            try:
                _call('/api/v1/tabs/close', {'tab_id': _TAB['id']}, timeout=10)
            except BrowserError:
                pass
            _TAB['id'] = None


def go(url, settle=(2.5, 5.0)):
    t = tab()
    _call('/api/v1/navigate', {'tab_id': t, 'url': url}, timeout=60)
    time.sleep(random.uniform(*settle))
    return t


def js(expr, timeout=30):
    r = _call('/api/v1/evaluate', {'tab_id': tab(), 'expression': expr}, timeout=timeout)
    return r.get('result') if isinstance(r, dict) else r


def wait_for(expr, seconds=15, every=0.6):
    """Poll a JS expression until it is truthy; its value, or None."""
    end = time.time() + seconds
    while time.time() < end:
        v = js(expr)
        if v:
            return v
        time.sleep(every)
    return None


def click(selector):
    """A person's click: move, pause, click (Unzoo's human click). It clicked even when Unzoo
    could not see a change afterwards (focusing a text box changes nothing visible); callers
    check the outcome they need themselves."""
    try:
        return _call('/api/v1/human/click', {'tab_id': tab(), 'selector': selector}, timeout=60)
    except BrowserError as e:
        if 'not_verified' in str(e):
            return None
        raise


def type_text(selector, text):
    """A person's typing into an element (rhythm, read-back)."""
    return _call('/api/v1/human/type', {'tab_id': tab(), 'selector': selector, 'text': text}, timeout=180)


def paste(selector, text):
    """Paste text into an editor as the clipboard would: the editor's own paste handling
    takes it, so rich editors (X's Draft.js) keep their state right. Any text, any script."""
    return js(r"""(() => { const e = document.querySelector(%s); if (!e) return false; e.focus();
      const dt = new DataTransfer(); dt.setData('text/plain', %s);
      e.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
      return true; })()""" % (json.dumps(selector), json.dumps(text)))


def upload(selector, path):
    return _call('/api/v1/upload', {'tab_id': tab(), 'selector': selector, 'file_path': path}, timeout=60)


def pause(lo=0.8, hi=2.2):
    time.sleep(random.uniform(lo, hi))


def scroll(px=None):
    js('window.scrollBy(0, %d)' % (px or random.randint(600, 1100)))
    pause(1.2, 2.8)
