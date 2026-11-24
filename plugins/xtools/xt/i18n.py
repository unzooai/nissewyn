"""Interface language, the same way Nissewyn does it: the Chinese text is the key.

Text is written in Chinese; `i18n/en.json` maps each piece to English. A message that
is built from parts and kept for later (the log, why automation stopped, an error) is a
`Msg`: it reads as Chinese like any string, and also remembers its template and values,
so it can be shown in whatever language the page asks for when it is read -- not only
the language it was made in.

The page says which language it wants with an `X-Lang` header (`en` or `zh`); `use()`
sets it for the request being answered, and `tr()` / `render()` follow it.
"""
import json
import os
import re
import threading

_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'i18n')
_CATALOGS = {}
_LOCAL = threading.local()
_HOLE = re.compile(r'\{(\w+)\}')


def catalog(lang):
    if lang not in _CATALOGS:
        try:
            with open(os.path.join(_DIR, lang + '.json'), encoding='utf-8') as f:
                _CATALOGS[lang] = json.load(f)
        except (OSError, ValueError):
            _CATALOGS[lang] = {}
    return _CATALOGS[lang]


def norm(lang):
    """'en-US' -> 'en', 'zh-CN' -> 'zh'; anything not Chinese is English."""
    return 'zh' if re.match(r'zh\b|zh[-_]', str(lang or ''), re.I) else 'en'


def use(lang):
    _LOCAL.lang = norm(lang) if lang else None


def current():
    return getattr(_LOCAL, 'lang', None) or norm(os.environ.get('XTOOLS_LANG') or 'zh')


def _fill(text, values, lang):
    if not values:
        return text
    return _HOLE.sub(lambda m: render(values[m.group(1)], lang) if m.group(1) in values else m.group(0), text)


def tr(text, lang=None, **values):
    """This Chinese text in the language being answered in, with {name} filled in."""
    lang = lang or current()
    base = catalog(lang).get(text, text) if lang != 'zh' else text
    return _fill(base, values, lang)


class Msg(str):
    """A message that reads as Chinese and can be shown in any language later."""

    def __new__(cls, template, **values):
        self = super().__new__(cls, _fill(template, values, 'zh'))
        self.template, self.values = template, values
        return self

    def dump(self):
        return {'t': self.template, 'a': {k: dump(v) for k, v in self.values.items()}}


def msg(template, **values):
    return Msg(template, **values)


def dump(value):
    """A value as it is stored: a Msg keeps its template and values."""
    if isinstance(value, Msg):
        return value.dump()
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value
    return str(value) if value is not None else ''


def load(stored):
    """Back from storage: {'t', 'a'} -> Msg; anything else as it was."""
    if isinstance(stored, dict) and 't' in stored:
        return Msg(stored['t'], **{k: load(v) for k, v in (stored.get('a') or {}).items()})
    return stored


def of(error):
    """What an exception says, keeping a Msg if it was raised with one."""
    first = error.args[0] if getattr(error, 'args', None) else None
    return first if isinstance(first, Msg) else str(error)


def render(value, lang=None):
    """Any message in the given language: a Msg by its template, a plain Chinese text by
    the catalog (text it does not know -- a handle, a URL, an error from X -- stays as it is)."""
    lang = lang or current()
    value = load(value)
    if isinstance(value, Msg):
        return tr(value.template, lang, **value.values)
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value)
    if lang == 'zh':
        return text
    words = catalog(lang)
    if text in words:
        return words[text]
    # Written before messages kept their template (Xtools 2.1 and earlier): find the template it was made from.
    for pattern, template in _patterns(lang):
        m = pattern.fullmatch(text)
        if m:
            return tr(template, lang, **m.groupdict())
    return text


def _patterns(lang):
    key = '_patterns_' + lang
    if key not in _CATALOGS:
        out = []
        for template in catalog(lang):
            if not _HOLE.search(template):
                continue
            parts, seen = [], set()
            for i, piece in enumerate(_HOLE.split(template)):
                if i % 2 == 0:
                    parts.append(re.escape(piece))
                else:
                    parts.append('(?P=%s)' % piece if piece in seen else '(?P<%s>.+?)' % piece)
                    seen.add(piece)
            out.append((re.compile(''.join(parts), re.S), template))
        _CATALOGS[key] = out
    return _CATALOGS[key]
