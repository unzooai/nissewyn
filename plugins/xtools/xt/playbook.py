"""Who the account is and how it plays: learned from its own posts, proposed by the writer,
edited by the person, and adjusted every week from what worked."""
import collections
import re
import time

from . import clock, db, env, writer, x


def score(p):
    """What a post earned, in one number: replies and reposts count most."""
    return (p.get('likes') or 0) + 3 * (p.get('replies') or 0) + 4 * (p.get('reposts') or 0) + 2 * (p.get('bookmarks') or 0)


def _cjk_share(texts):
    s = ''.join(texts)
    if not s:
        return 0.0
    return len(re.findall(r'[぀-ヿ㐀-鿿가-힯]', s)) / max(1, len(re.sub(r'\s', '', s)))


def learn_account():
    """Read the account: profile, its recent posts and what they earned."""
    handle = x.me()
    if not handle:
        raise RuntimeError('这个浏览器身份里 X 没有登录')
    prof = x.profile(handle)
    posts = x.posts_of(handle, want=60)
    own = {p['url'] for p in posts}
    replies = [p for p in x.posts_of(handle, want=30, include_replies=True) if p['url'] not in own]
    for p in posts:
        p['score'] = score(p)
    ranked = sorted(posts, key=lambda p: p['score'], reverse=True)
    hours = collections.Counter()
    for p in posts:
        for z in clock.zones()[:1]:
            hours[int(clock.local_hour(z, p['at']))] += 1 + p['score']
    lengths = sorted(writer.weighted_len(p['text']) for p in posts if p['text'])
    return {
        'handle': handle,
        'profile': prof,
        'posts': len(posts),
        'top': [{'text': p['text'][:600], 'score': p['score'], 'views': p['views'], 'url': p['url']} for p in ranked[:8]],
        'recent': [p['text'][:400] for p in posts[:12]],
        'reply_samples': [p['text'][:280] for p in replies[:8]],
        'best_hours': [h for h, _ in hours.most_common(5)],
        'median_length': lengths[len(lengths) // 2] if lengths else 0,
        'cjk_share': round(_cjk_share([p['text'] for p in posts]), 2),
        'with_media': sum(1 for p in posts if p['has_media']),
        'avg_views': int(sum(p['views'] for p in posts) / len(posts)) if posts else 0,
        'learned_at': time.time(),
    }


PROPOSE = """你在帮一个 X(推特)账号制定运营打法。

账号自己说的:
- 我是谁、做什么:{who}
- 想吸引的人:{audience}
- 目标:{goal}

从它的主页和历史帖读到的:
- 主页名字和简介:{name} / {bio}
- 粉丝 {followers},平均每帖 {avg_views} 次浏览,中日韩文字占比 {cjk}
- 表现最好的帖(按互动排序):
{top}
- 最近的帖:
{recent}

请给出 JSON:
{{
  "positioning": "一句话:这个号给读者什么",
  "voice": "这个号的说话方式(句式、长度、语气、常用词),2-3 句,写给写稿的人看",
  "pillars": [{{"name": "支柱名", "what": "写什么、为什么读者在乎", "examples": ["两三个具体选题"]}}],
  "keywords": ["在 X 上搜得到这个领域正在讨论的关键词,6-10 个,用读者会用的语言"],
  "watch": ["这个领域值得盯的 X 账号 handle(不带@),8-15 个,真实存在、活跃、和目标读者重合;不确定就少写"],
  "language": "zh 或 en 或 both"
}}
支柱 3-5 个,要从它已经表现好的内容里长出来,不要空泛。"""


def propose(about, learned):
    fmt = lambda xs: '\n'.join('  · ' + re.sub(r'\s+', ' ', t)[:300] for t in xs) or '  (没有)'
    prof = learned.get('profile') or {}
    prompt = PROPOSE.format(
        who=about.get('who') or '(没填)', audience=about.get('audience') or '(没填)', goal=about.get('goal') or '涨粉',
        name=prof.get('name', ''), bio=prof.get('bio', ''), followers=prof.get('followers'),
        avg_views=learned.get('avg_views'), cjk=learned.get('cjk_share'),
        top=fmt([t['text'] for t in learned.get('top', [])]), recent=fmt(learned.get('recent', [])))
    plan = writer.write_json(prompt, env.setting('redlines'))
    pillars = [{'name': p.get('name', ''), 'what': p.get('what', ''), 'examples': p.get('examples') or [], 'weight': 1.0}
               for p in plan.get('pillars') or [] if p.get('name')]
    return {
        'positioning': plan.get('positioning', ''),
        'voice': plan.get('voice', ''),
        'pillars': pillars,
        'keywords': [k for k in plan.get('keywords') or [] if isinstance(k, str)][:12],
        'watch': [{'handle': h.lstrip('@'), 'why': 'proposed', 'score': 0} for h in plan.get('watch') or [] if isinstance(h, str)][:20],
        'language': plan.get('language') or ('zh' if learned.get('cjk_share', 0) > 0.3 else 'en'),
    }


def setup(about):
    """First run: learn the account, propose a playbook, save it."""
    db.log('开始读账号:主页、最近的帖和它们的数据')
    learned = learn_account()
    db.log('读完 @%s:%d 条帖;让写稿的智能体给出打法' % (learned['handle'], learned['posts']))
    plan = propose(about, learned)
    book = {'about': about, 'learned': learned, **plan, 'created_at': time.time(), 'history': []}
    db.save_playbook(book)
    db.log('打法已生成:%d 个内容支柱、%d 个关键词、%d 个要盯的账号' % (len(plan['pillars']), len(plan['keywords']), len(plan['watch'])))
    return book


def voice_block(book):
    """What every writing prompt gets about the account's voice."""
    samples = [t['text'] for t in (book.get('learned') or {}).get('top', [])[:5]]
    lines = ['账号:@%s。%s' % (book.get('learned', {}).get('handle', ''), book.get('positioning', '')),
             '说话方式:' + (book.get('voice') or '')]
    if samples:
        lines.append('本人写过、表现好的帖(学语气,不要照抄):')
        lines += ['  · ' + re.sub(r'\s+', ' ', s)[:280] for s in samples]
    return '\n'.join(lines)


def pick_pillar(book, recent_names):
    """By weight, avoiding the pillars used most recently."""
    import random
    pillars = book.get('pillars') or []
    if not pillars:
        return None
    pool = [p for p in pillars if p['name'] not in recent_names[-max(1, len(pillars) - 1):]] or pillars
    total = sum(max(0.05, p.get('weight', 1.0)) for p in pool)
    r = random.uniform(0, total)
    for p in pool:
        r -= max(0.05, p.get('weight', 1.0))
        if r <= 0:
            return p
    return pool[-1]
