"""Xtools' tools for agents in Unzoo One conversations: a small MCP server over stdio that
talks to the running Xtools (its port comes from Unzoo One)."""
import json
import os
import sys
import urllib.request

PORT = os.environ.get('UNZOO_PLUGIN_PORT')

TOOLS = [
    ('status', 'Xtools 现在的状态:账号、是否暂停、今天的原创和互动、队列。', {}, []),
    ('playbook', '这个账号的打法:定位、说话方式、内容支柱、关键词、盯的账号。', {}, []),
    ('queue', '待批准(pending)或排队中(queued)的互动:回复、引用、点赞、关注。',
     {'status': {'type': 'string', 'enum': ['pending', 'queued', 'done', 'failed']}}, []),
    ('write_post', '按打法写一条原创草稿(不发出)。可指定内容支柱、格式(short/thread/long)和额外要求。',
     {'pillar': {'type': 'string'}, 'format': {'type': 'string'}, 'extra': {'type': 'string'}}, []),
    ('run', '立刻做一件事:radar(看领域)、frontrow(起草前排回复)、mentions(看通知)、quotes、follows、plan(写今天的原创)、measure(记录数据)、learn(周报)。',
     {'job': {'type': 'string'}}, ['job']),
    ('schedule_post', '把一条原创草稿排到某时发出(due_at 为 Unix 秒;不填就是一分钟后)。会发到 X。',
     {'id': {'type': 'integer'}, 'due_at': {'type': 'number'}}, ['id']),
    ('approve', '批准待批准的互动(会按节奏发到 X)。', {'ids': {'type': 'array', 'items': {'type': 'integer'}}}, ['ids']),
    ('session', '立刻跑一场互动会话:执行排队中的回复、引用、点赞、关注(会发到 X)。', {}, []),
]

# tool -> (method, path, body builder)
ROUTES = {
    'status': ('GET', lambda a: '/api/state', None),
    'playbook': ('GET', lambda a: '/api/playbook', None),
    'queue': ('GET', lambda a: '/api/actions?status=' + (a.get('status') or 'pending'), None),
    'write_post': ('POST', lambda a: '/api/posts/write', lambda a: a),
    'run': ('POST', lambda a: '/api/run', lambda a: {'job': a.get('job')}),
    'schedule_post': ('POST', lambda a: '/api/posts/schedule', lambda a: a),
    'approve': ('POST', lambda a: '/api/actions/approve', lambda a: a),
    'session': ('POST', lambda a: '/api/run', lambda a: {'job': 'session'}),
}


def call(name, args):
    if not PORT:
        raise RuntimeError('Xtools 没在运行:在 Unzoo One 的插件页打开它')
    method, path, body = ROUTES[name]
    data = json.dumps(body(args)).encode() if body else None
    req = urllib.request.Request('http://127.0.0.1:%s%s' % (PORT, path(args)), data=data, method=method,
                                 headers={'Content-Type': 'application/json'})
    out = json.loads(urllib.request.urlopen(req, timeout=60).read() or b'null')
    if name == 'status' and isinstance(out, dict):
        out.pop('log', None)
    return json.dumps(out, ensure_ascii=False, default=str)[:20000]


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        msg = json.loads(line)
        if 'id' not in msg:
            continue
        method, mid = msg.get('method'), msg['id']
        try:
            if method == 'initialize':
                result = {'protocolVersion': msg.get('params', {}).get('protocolVersion', '2025-06-18'),
                          'capabilities': {'tools': {}}, 'serverInfo': {'name': 'xtools', 'version': '2.0.0'}}
            elif method == 'tools/list':
                result = {'tools': [{'name': n, 'description': d,
                                     'inputSchema': {'type': 'object', 'properties': p, 'required': r}} for n, d, p, r in TOOLS]}
            elif method == 'tools/call':
                p = msg.get('params', {})
                result = {'content': [{'type': 'text', 'text': call(p.get('name'), p.get('arguments') or {})}]}
            else:
                raise ValueError('unsupported method %s' % method)
            reply = {'jsonrpc': '2.0', 'id': mid, 'result': result}
        except Exception as e:
            reply = {'jsonrpc': '2.0', 'id': mid, 'error': {'code': -32000, 'message': str(e)}}
        sys.stdout.write(json.dumps(reply, ensure_ascii=False) + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    main()
