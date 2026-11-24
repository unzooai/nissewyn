# one-core

> 状态：骨架（`unzoo-one#4` / ONE-C003）
> 对应路线图 M1「Runtime Spine」的第一块

Unzoo One 的常驻运行时。Task、Run、事件和授权的唯一事实来源——GUI 关掉、
进程重启、机器断电之后，任务还在。

这一版实现了骨架的四件事：**认证 IPC、单实例、SQLite、事件 cursor**。
Brain、Provider、Policy 还没接，那是 `unzoo-one#10` / `#7` / `#6`。

## 跑起来

```bash
npm install
npm start          # 起 Core，Ctrl-C 停
npm run cli demo   # 另开一个终端：建任务 → 开跑 → 收尾 → 读事件 → 验链
npm test           # 36 个测试
npm run typecheck
```

`demo` 就是 ONE-C003 的验收物：**没有任何产品界面的情况下把一个任务跑完**。
它走的路径和将来的桌面端完全一样——读 core.json 拿 endpoint 和 token，带
Bearer 调 `/v0`，没有只给 CLI 开的后门。

源码用 TypeScript 直接跑（Node 24+ 的类型擦除），没有构建步骤。

## 四件事各自是怎么做的

### 认证 IPC

只监听 `127.0.0.1`，端口交给系统分配。真实地址和 token 写进状态目录的
`core.json`（权限 0600），客户端读文件而不是猜端口。

除 `/v0/health` 外每个请求都要 `Bearer`，token 用定长比较（`timingSafeEqual`）。
两条容易被想当然的：

- **Origin/CORS 不能代替认证。** 它挡浏览器里的跨站请求，挡不住 `curl 127.0.0.1`。
- **`/v0/health` 故意不认证**，因为单实例锁要靠它判断「锁里记的那个进程还在不在」，
  而那时候还没有 token。它只回自证身份的 `instance_id`，不含任何任务数据。

### 单实例

两个 Core 同时开着比没有 Core 更糟：它们会各自持有同一个 SQLite 文件、各自签发
Grant、各自认为自己是事实来源。所以启动第一件事是拿锁，拿不到就不启动（退出码 3，
和崩溃区分开）。

锁用「独占创建文件」（`open` 的 `wx`）实现，这是文件系统层面的原子操作。难的是
判断锁里记的进程还活着没有——pid 会被复用，光看 pid 存在不够：

| pid 存活 | 探活 endpoint | 结论 |
|---|---|---|
| 否 | — | 陈旧锁，接管 |
| 是 | 通 | 真的在跑，拒绝启动 |
| 是 | 不通 | **拒绝启动**，并把锁文件路径告诉用户 |

最后一行是刻意选的保守：pid 被复用和 Core 卡住这两种情况从外面看一模一样，而猜错
的代价不对称——猜「陈旧」会让两个 Core 抢一个库，猜「活着」只是让用户多删一个文件。

### SQLite

一个文件就是全部真相。用 `node:sqlite`（Node 内置，无原生模块编译），WAL 模式让
读不挡写。

表结构有一处刻意的取舍：每张表既有几个提出来的列（用于查询和约束），又存一份完整的
JSON `doc`。因为 contracts/v0 是唯一事实来源，把它每个字段都摊成列等于把契约抄了
第二遍，改契约就要改两处、而且容易漏。**提出来的列只是索引，`doc` 才是对象本身。**

### 事件 cursor

客户端不轮询对象，它按 cursor 追事件。三条要求：

1. **每个 Task 内单调、不跳号。** 序号在 `BEGIN IMMEDIATE` 事务里取，并发写入不会
   拿到同一个号；库里还有 `UNIQUE (task_id, sequence)` 兜底——「不跳号」不能只靠
   应用层自觉。
2. **断线可续。** cursor 就是序号本身，不是不透明游标，客户端存下来就行。读完返回
   空数组和原样的 cursor，那不是错误，是还没有新的。
3. **可验证。** 每条带 `prev_hash` 串成链。改过库里的内容、删掉中间一条，
   `GET /v0/tasks/{id}/verify` 都会发现。

序号是 **per task** 的，不是全局的：全局序号会让每次写入都去争同一行。

## 状态目录

平台数据目录，`UNZOO_ONE_STATE_DIR` 可覆盖：

| 平台 | 路径 |
|---|---|
| Windows | `%LOCALAPPDATA%\UnzooOne` |
| macOS | `~/Library/Application Support/UnzooOne` |
| Linux | `$XDG_DATA_HOME/unzoo-one` |

里面三个文件：`core.json`（endpoint + token）、`core.lock.json`（单实例锁）、
`core.db`。

**只有一个状态目录，这是刻意的。** unterm 那边踩过的坑值得抄下来避开：它有
`~/.unterm` 和平台数据目录两处，结果 supervisor 拿错路径把活着的 Core 报成 absent，
文档里也错了五处；更麻烦的是设了环境变量的测试会同时覆盖两者，所以测试永远看不出
这个 bug。这里的规则是一个目录、一个环境变量、测试和生产走同一条解析路径，并且有
一个测试专门验不设环境变量时的默认解析。

## 和 contracts/v0 的关系

`tests/contracts.test.ts` 拿真 schema 校验 Core 产出的每一个对象和每一条事件。
字段名写错、状态机漏一档、终态还挂着活动 Run——都在这里红，不用等到跨仓库联调。

这是契约存在的意义：schema 不是画在文档里的图，是能拦住实现的东西。

## API

按 `docs/domain-model-and-contracts.md` §16。错误按
`contracts/v0/common/error.schema.json`——调用方只对 `code` 分支，不解析 `message`。

```text
GET  /v0/health                    不需要认证
GET  /v0/tasks
POST /v0/tasks                     支持 Idempotency-Key
GET  /v0/tasks/{id}
POST /v0/tasks/{id}/start
POST /v0/tasks/{id}/cancel
GET  /v0/tasks/{id}/events?cursor=N&limit=M
GET  /v0/tasks/{id}/verify         验事件链
POST /v0/tasks/{id}/finish         骨架期占位，见下
```

## 还没做的

- **`POST /finish` 是占位。** 真正结束一次 Run 该由 Brain 的收敛结果驱动，不该由
  客户端说了算。Brain Router（`unzoo-one#10`）落地后撤掉。
- **`cancel` 直接落到 `cancelled`。** 真做起来要先进 `cancelling`、把取消送到 Brain
  和 Provider、确认对面真的停了才算。契约里 `cancelling → cancelled | cancel_failed`
  那个分叉就是为这件事留的，这里先不假装做到了。
- Step、ToolCall、Approval、Grant、Artifact 都还没落库——schema 有了，引擎还没有。
- Policy Gateway（`unzoo-one#6`）、Provider Registry（`#7`）没接。
- 没有 pause / resume / continue。
- `node:sqlite` 在 Node 25 仍标着 experimental，启动会打一行警告。
