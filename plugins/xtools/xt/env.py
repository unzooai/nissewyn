"""Where Xtools runs: what Unzoo One passed in (port, data folder, roles, settings)."""
import json
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# What a setting is when Unzoo One did not pass one (running on its own, or an
# older Unzoo One). Same keys and defaults as unzoo-plugin.json.
DEFAULTS = {
    'auto.posts': 'auto', 'auto.mentions': 'auto', 'auto.replies': 'auto', 'auto.quotes': 'auto',
    'auto.likes': 'auto', 'auto.follows': 'auto',
    'paused': False,
    'audience.timezones': ['UTC+8'],
    'audience.active_hours': [8, 23],
    'posts.per_day': 2,
    'posts.formats': ['short', 'thread'],
    'posts.language': 'auto',
    'posts.link': '', 'posts.link_every': 5,
    'sessions.per_day': 3,
    'sessions.replies': [2, 4], 'sessions.likes': [4, 8], 'sessions.follows': [0, 2],
    'frontrow.max_age_hours': 3, 'frontrow.max_replies_on_post': 150,
    'mentions.max_per_run': 5,
    'caps.post': 6, 'caps.reply': 30, 'caps.quote': 3, 'caps.like': 80, 'caps.follow': 20,
    'caps.per_hour': 15,
    'warmup.days': 14, 'warmup.ratio': 0.4,
    'pace.gap_seconds': [25, 90],
    'redlines': ['政治、时政、地缘冲突', '宗教', '色情', '投资建议、炒币', '人身攻击'],
    'learn.weekly': True,
}


def data_dir():
    d = os.environ.get('UNZOO_PLUGIN_DATA') or os.path.join(HERE, 'data')
    os.makedirs(d, exist_ok=True)
    return d


def port():
    return int(os.environ.get('UNZOO_PLUGIN_PORT') or os.environ.get('PORT') or 8792)


def in_unzoo_one():
    return bool(os.environ.get('UNZOO_PLUGIN_ID'))


def _json_env(name):
    try:
        v = json.loads(os.environ.get(name) or '{}')
        return v if isinstance(v, dict) else {}
    except ValueError:
        return {}


def setting(key):
    v = _json_env('UNZOO_PLUGIN_SETTINGS').get(key, DEFAULTS.get(key))
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, list):
        return [int(x) if isinstance(x, float) and x.is_integer() else x for x in v]
    return v


def role(name):
    """The value bound to a role: {"profile": id} or {"agent", "model", "effort"}."""
    r = _json_env('UNZOO_PLUGIN_ROLES').get(name) or {}
    return r.get('value') or {}


def browser_profile():
    """The Unzoo browser identity signed in to the X account; None if not bound."""
    return role('account').get('profile') or os.environ.get('XTOOLS_PROFILE') or None


def automation(kind):
    """'auto', 'approve' or 'off' for posts / mentions / replies / quotes / likes / follows."""
    v = setting('auto.' + kind)
    return v if v in ('auto', 'approve', 'off') else 'approve'
