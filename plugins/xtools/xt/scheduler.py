"""The clock: once a minute, decide which job is due. One job at a time on the account."""
import random
import threading
import time
import traceback

from . import browser, db, engine, env, human, x
from .i18n import msg, of, tr

_RUNNING = {'job': None, 'since': None}
_BEAT = {'at': None, 'idle': None}    # the clock's last tick, and why it did nothing (or None)
_LOCK = threading.Lock()


def running():
    return dict(_RUNNING)


def heartbeat():
    return dict(_BEAT)


def run_job(name, fn, *args):
    """Run a job now unless another one is running; logs what went wrong."""
    if not _LOCK.acquire(blocking=False):
        return {'ok': False, 'error': tr('正在做:{job}', job=_RUNNING['job'])}
    _RUNNING.update(job=name, since=time.time())
    try:
        return {'ok': True, 'result': fn(*args)}
    except x.Unhealthy as e:
        engine.on_unhealthy(e.state)
        return {'ok': False, 'error': e.state}
    except Exception as e:
        db.log(msg('{job} 出错:{error}', job=name, error=of(e)), 'warn')
        traceback.print_exc()
        return {'ok': False, 'error': str(e)}
    finally:
        _RUNNING.update(job=None, since=None)
        _LOCK.release()


def _every(key, seconds):
    """True once per `seconds` for this key."""
    last = db.kv_get('last:' + key, 0)
    if time.time() - last >= seconds:
        db.kv_set('last:' + key, time.time())
        return True
    return False


def _now_and_then(key, about):
    """True about once per `about` seconds, never on a fixed beat (the next time is drawn
    between 0.6 and 1.5 times `about`)."""
    if time.time() >= db.kv_get('next:' + key, 0):
        db.kv_set('next:' + key, time.time() + about * random.uniform(0.6, 1.5))
        return True
    return False


def _daily(key):
    day = db.today_start()
    if db.kv_get('day:' + key) != day:
        db.kv_set('day:' + key, day)
        return True
    return False


def tick():
    """Run what is due. Returns why it did nothing, or None when it went through."""
    if not db.playbook().get('pillars'):
        return 'not_setup'
    if engine.halted():
        return 'halted'
    if not browser.reachable():
        return 'no_browser'
    if _daily('plan'):
        run_job('写今天的原创', engine.plan_day)
    if env.setting('learn.weekly') and _every('learn', 7 * 86400) and db.kv_get('first_run_at', time.time()) < time.time() - 6 * 86400:
        run_job('周报', engine.weekly_learn)
    run_job('到点发原创', engine.publish_due)
    # Everything else in the browser happens in visits, inside the owner's own day (human.py):
    # no timer that opens X every so many minutes around the clock.
    if not human.owner_awake():
        return 'asleep'
    v = human.due_visit()
    if not v:
        return 'between'
    run_job('逛一会儿 X' if v['kind'] == 'session' else '看一眼 X', engine.visit, v)
    # Drafting that needs no browser, after a visit has read something, at uneven intervals.
    if _now_and_then('frontrow', 2 * 3600):
        run_job('起草前排回复', engine.frontrow)
    if _now_and_then('quotes', 8 * 3600):
        run_job('起草引用', engine.quotes)
    if _now_and_then('follows', 12 * 3600):
        run_job('找要关注的人', engine.discover_follows)


def loop():
    if db.kv_get('first_run_at') is None:
        db.kv_set('first_run_at', time.time())
    while True:
        _BEAT['at'] = time.time()
        try:
            _BEAT['idle'] = tick()
        except Exception:
            _BEAT['idle'] = 'error'
            traceback.print_exc()
        _BEAT['at'] = time.time()
        time.sleep(60)


def start():
    threading.Thread(target=loop, daemon=True, name='xtools-scheduler').start()
