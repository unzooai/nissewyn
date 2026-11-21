"""The clock: once a minute, decide which job is due. One job at a time on the account."""
import threading
import time
import traceback

from . import browser, clock, db, engine, env, x

_RUNNING = {'job': None, 'since': None}
_LOCK = threading.Lock()


def running():
    return dict(_RUNNING)


def run_job(name, fn, *args):
    """Run a job now unless another one is running; logs what went wrong."""
    if not _LOCK.acquire(blocking=False):
        return {'ok': False, 'error': '正在做:%s' % _RUNNING['job']}
    _RUNNING.update(job=name, since=time.time())
    try:
        return {'ok': True, 'result': fn(*args)}
    except x.Unhealthy as e:
        engine.on_unhealthy(e.state)
        return {'ok': False, 'error': e.state}
    except Exception as e:
        db.log('%s 出错:%s' % (name, e), 'warn')
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


def _daily(key):
    day = db.today_start()
    if db.kv_get('day:' + key) != day:
        db.kv_set('day:' + key, day)
        return True
    return False


def tick():
    if not db.playbook().get('pillars'):
        return                                   # not set up yet
    if engine.halted() or not browser.reachable():
        return
    awake = clock.audience_awake()
    if _daily('plan'):
        run_job('写今天的原创', engine.plan_day)
    if _daily('measure'):
        run_job('记录数据', engine.measure)
    if env.setting('learn.weekly') and _every('learn', 7 * 86400) and db.kv_get('first_run_at', time.time()) < time.time() - 6 * 86400:
        run_job('周报', engine.weekly_learn)
    run_job('到点发原创', engine.publish_due)
    if not awake:
        return
    if _every('mentions', 30 * 60):
        run_job('看读者通知', engine.mentions)
    if _every('radar', 90 * 60):
        run_job('领域雷达', engine.radar)
        run_job('起草前排回复', engine.frontrow)
    if _every('quotes', 8 * 3600):
        run_job('起草引用', engine.quotes)
    if _every('follows', 12 * 3600):
        run_job('找要关注的人', engine.discover_follows)
    plan = db.kv_get('sessions') or {}
    due = [t for t in plan.get('at', []) if t <= time.time() and t not in plan.get('done', [])]
    if due:
        plan.setdefault('done', []).append(due[0])
        db.kv_set('sessions', plan)
        run_job('互动会话', engine.session)


def loop():
    if db.kv_get('first_run_at') is None:
        db.kv_set('first_run_at', time.time())
    while True:
        try:
            tick()
        except Exception:
            traceback.print_exc()
        time.sleep(60)


def start():
    threading.Thread(target=loop, daemon=True, name='xtools-scheduler').start()
