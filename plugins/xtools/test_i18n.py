"""Every piece of Xtools text a person sees has English, with the same {placeholders}.

Run: python -m unittest plugins/xtools/test_i18n.py   (or: python plugins/xtools/test_i18n.py)

The text is found where it is used: T('…') on the page, tr('…') / msg('…') in the Python,
the status lines, job names, warm-up stages, queue reasons and the manifest's labels.
Prompts written for the writing agent are not interface text and are not looked at.
"""
import ast
import json
import os
import re
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
HAN = re.compile(r'[一-鿿]')
HOLE = re.compile(r'\{(\w+)\}')


def _read(*parts):
    with open(os.path.join(HERE, *parts), encoding='utf-8') as f:
        return f.read()


def page_text():
    src = _read('web', 'index.html')
    out = set(re.findall(r"\bT\('((?:[^'\\]|\\.)*)'", src))
    # Words kept in tables and shown through T(...) at the point of use.
    for name in ('KIND', 'MODE', 'AUTO', 'STAGE', 'POST_STATUS', 'SERIES'):
        m = re.search(r'const %s=(.*);' % name, src)
        out |= set(re.findall(r"'([^']*)'", m.group(1)))
    m = re.search(r"const tabs=(\[\[.*?\]\]);", src)
    out |= set(re.findall(r"'([^']*)'", m.group(1)))
    return {s for s in out if HAN.search(s)}


def _calls(tree, names):
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            f = node.func
            name = f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else None
            if name in names:
                yield node


def _const(node):
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def python_text():
    out = set()
    files = ['server.py'] + [os.path.join('xt', f) for f in os.listdir(os.path.join(HERE, 'xt')) if f.endswith('.py')]
    for rel in files:
        tree = ast.parse(_read(rel))
        for call in _calls(tree, {'tr', 'msg'}):
            if call.args and _const(call.args[0]):
                out.add(_const(call.args[0]))
        for call in _calls(tree, {'out'}):                 # status: out(state, text, detail)
            if len(call.args) > 1 and _const(call.args[1]):
                out.add(_const(call.args[1]))
        for call in _calls(tree, {'run_job', 'background'}):  # job names, shown while running
            if call.args and _const(call.args[0]):
                out.add(_const(call.args[0]))
        for call in _calls(tree, {'_queue'}):              # queue reasons
            for a in call.args[3:4] + [k.value for k in call.keywords if k.arg == 'reason']:
                if _const(a):
                    out.add(_const(a))
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and any(getattr(t, 'id', '') in ('JOBS', 'STAGES') for t in node.targets):
                out |= {c.value for c in ast.walk(node.value) if _const(c)}
    # Built from parts at run time.
    out |= {'今天 {time}', '明天 {time}', '后天 {time}', '发原创', '互动会话', '回读者', '已在设置里暂停'}
    return {s for s in out if HAN.search(s)}


def manifest_text():
    m = json.loads(_read('unzoo-plugin.json'))
    out = {m['description']}
    for r in m.get('roles', {}).values():
        out.add(r.get('label', ''))
    for s in m.get('settings', []):
        out |= {s.get('group', ''), s.get('label', ''), s.get('help', '')}
        out |= {c[1] for c in s.get('choices', [])}
    return {s for s in out if HAN.search(s)}


class Catalog(unittest.TestCase):
    def setUp(self):
        self.en = json.loads(_read('i18n', 'en.json'))

    def _check(self, texts):
        missing = sorted(t for t in texts if t not in self.en)
        self.assertEqual(missing, [], 'no English for:\n' + '\n'.join(missing))

    def test_page(self):
        self._check(page_text())

    def test_page_has_no_text_outside_T(self):
        src = _read('web', 'index.html')
        src = re.sub(r"\bT\('(?:[^'\\]|\\.)*'", '', src[src.index('<script>'):])
        bare = [line.strip()[:120] for line in src.splitlines()
                if HAN.search(line) and not re.match(r'\s*(//|const (KIND|MODE|AUTO|STAGE|POST_STATUS|SERIES|tabs)=)', line)
                and 'const tabs=' not in line and not line.startswith('const num=')]   # 万: the Chinese way of counting
        self.assertEqual(bare, [])

    def test_python(self):
        self._check(python_text())

    def test_manifest(self):
        self._check(manifest_text())

    def test_placeholders_kept(self):
        for zh, en in self.en.items():
            self.assertEqual(sorted(HOLE.findall(zh)), sorted(HOLE.findall(en)), zh)

    def test_english_is_english(self):
        for zh, en in self.en.items():
            self.assertFalse(HAN.search(en), 'still Chinese: %s -> %s' % (zh, en))

    def test_manifest_points_at_the_catalog(self):
        m = json.loads(_read('unzoo-plugin.json'))
        self.assertEqual(m.get('i18n', {}).get('en'), 'i18n/en.json')

    def test_messages_render_in_either_language(self):
        import sys
        sys.path.insert(0, HERE)
        from xt import i18n
        m = i18n.msg('{job} 出错:{error}', job='周报', error=i18n.msg('写稿超过 {n} 秒', n=240))
        self.assertEqual(str(m), '周报 出错:写稿超过 240 秒')
        stored = json.loads(json.dumps(i18n.dump(m)))
        self.assertEqual(i18n.render(stored, 'zh'), '周报 出错:写稿超过 240 秒')
        self.assertEqual(i18n.render(stored, 'en'),
                         self.en['{job} 出错:{error}'].replace('{job}', self.en['周报'])
                         .replace('{error}', self.en['写稿超过 {n} 秒'].replace('{n}', '240')))
        self.assertEqual(i18n.render('@someone', 'en'), '@someone')
        # A line logged before messages kept their template is matched back to it.
        self.assertEqual(i18n.render('雷达:新看到 16 条', 'en'), self.en['雷达:新看到 {n} 条'].replace('{n}', '16'))
        self.assertEqual(i18n.norm('en-US'), 'en')
        self.assertEqual(i18n.norm('zh-CN'), 'zh')
        self.assertEqual(i18n.norm('ja'), 'en')


if __name__ == '__main__':
    if os.environ.get('XTOOLS_LIST_TEXT'):
        for t in sorted(page_text() | python_text() | manifest_text()):
            print(json.dumps(t, ensure_ascii=False))
    else:
        unittest.main()
