/** Settings › Organization (organization-panel.tsx): joining a company's Nissewyn Server. */
export const enPage13: Record<string, string> = {
  "组织": "Organization",
  "公司的 Nissewyn Server": "Your company's Nissewyn Server",
  "加入公司的 Nissewyn": "Join your company's Nissewyn",
  "已加入 {name}": "Joined {name}",
  "公司自己部署了 Nissewyn Server 时，在这里加入。加入后，公司可以为这台电脑设定智能体的规则，并保存操作记录的副本。公司拿不到你的模型账号、浏览器登录和密码。":
    "If your company runs its own Nissewyn Server, join it here. Your company can then set the rules agents follow on this computer and keep a copy of the activity record. It never gets your model accounts, browser sign-ins or passwords.",
  "{name} 的管理员已把这台电脑移出组织（{when}）。要重新加入，请用公司账号再登录一次，或向管理员要一个新的加入码。":
    "An admin at {name} removed this computer from the organization ({when}). To join again, sign in with your company account again or ask your admin for a new join code.",
  "知道了": "Got it",
  "服务器：{server}": "Server: {server}",
  "这台电脑：{name}": "This computer: {name}",
  "加入于 {when}": "Joined {when}",
  "最近确认：{when}": "Last confirmed: {when}",
  "还没和服务器确认过": "Not confirmed with the server yet",
  "离开后，公司的规则不再用于这台电脑。确定离开 {name}？":
    "After you leave, your company's rules no longer apply to this computer. Leave {name}?",
  "离开": "Leave",
  "离开组织": "Leave organization",
  "服务器地址": "Server address",
  "加入码": "Join code",
  "服务器地址和加入码向公司的 IT 管理员要。加入码有使用次数和有效期，用完或过期后要再要一个。":
    "Get the server address and a join code from your company's IT admin. A join code can be used a set number of times and expires; ask for a new one after that.",
  "正在加入…": "Joining…",
  "加入": "Join",
  "这台电脑已加入 {name}": "This computer joined {name}",
  "已离开 {name}": "Left {name}",
  "已离开 {name}。服务器没连上，请让管理员在后台移除这台电脑。":
    "Left {name}. The server couldn't be reached, so ask your admin to remove this computer there.",
  "先填公司服务器的地址": "Enter your company's server address first",
  "这个地址读不懂：{detail}": "That address can't be read: {detail}",
  "公司服务器要用 https 地址；http 只能用于这台电脑上的测试服务器":
    "Your company's server needs an https address; http is only for a test server on this computer",
  "连不上这个服务器：{detail}": "Couldn't reach the server: {detail}",
  "这个地址上不是 Nissewyn Server（{detail}）": "There's no Nissewyn Server at that address ({detail})",
  "服务器的版本比这台电脑的 Nissewyn 旧，请管理员更新 Nissewyn Server":
    "The server is older than Nissewyn on this computer; ask your admin to update Nissewyn Server",
  "这台电脑的 Nissewyn 比服务器旧，请先更新 Nissewyn":
    "Nissewyn on this computer is older than the server; update Nissewyn first",
  "这台电脑和服务器的版本对不上：{detail}": "This computer and the server are on different versions: {detail}",
  "服务器连上了，但它的数据库没有就绪（{detail}），请告诉管理员":
    "The server answered, but its database isn't ready ({detail}); tell your admin",
  "填上管理员给的加入码": "Enter the join code from your admin",
  "加入码不对，或者已经用完、过期、被收回。请向管理员要一个新的。":
    "That join code is wrong, used up, expired or withdrawn. Ask your admin for a new one.",
  "这把设备密钥已经加入过，请再试一次": "This device key has joined already; try again",
  "没能使用系统的密钥库：{detail}": "Couldn't use the system key store: {detail}",
  "系统密钥库里找不到这台电脑的设备密钥，没法向服务器证明身份。请离开组织后重新加入。":
    "This computer's device key isn't in the system key store, so it can't prove itself to the server. Leave the organization and join again.",
  "这台电脑已经加入了一个组织，先离开它": "This computer is already in an organization; leave it first",
  "这台电脑的时间和服务器差了 5 分钟以上。请在系统设置里打开“自动设置时间”后再试。":
    "This computer's clock is more than 5 minutes off the server's. Turn on “Set time automatically” in system settings and try again.",
  "服务器没有接受这台电脑的请求：{detail}": "The server didn't accept this computer's request: {detail}",
  "没能保存：{detail}": "Couldn't save: {detail}",
  "服务器出错了：{detail}": "The server ran into an error: {detail}",
  "只有 Nissewyn 桌面版能加入组织": "Only the Nissewyn desktop app can join an organization",
  "已登录。可以关掉这个页面，回到 Nissewyn。": "You're signed in. You can close this tab and go back to Nissewyn.",
  "没有登录成功。回到 Nissewyn 看原因。": "Sign-in didn't finish. Go back to Nissewyn to see why.",
  "登录为 {who}": "Signed in as {who}",
  "已在浏览器里打开公司的登录页。登录后，这里会自动完成加入。":
    "Your company's sign-in page is open in your browser. Once you sign in, this computer joins automatically.",
  "浏览器没有打开？把这个地址复制到浏览器里：": "Browser didn't open? Copy this address into it:",
  "加入码（不用公司账号时）": "Join code (instead of your company account)",
  "服务器地址向公司的 IT 管理员要。公司开了单点登录时，用公司账号登录就行；否则填管理员给的加入码。":
    "Get the server address from your IT admin. If your company has single sign-on, just sign in with your company account; otherwise enter the join code your admin gave you.",
  "用公司账号登录": "Sign in with company account",
  "用加入码加入": "Join with code",
  "这个服务器没有开单点登录，请用管理员给的加入码": "This server doesn't have single sign-on set up. Use the join code from your admin.",
  "没有登录成功：{detail}": "Sign-in didn't finish: {detail}",
  "没有登录成功，请再试一次": "Sign-in didn't finish. Try again.",
  "等了 10 分钟还没有登录完成，请再试一次": "Sign-in didn't finish within 10 minutes. Try again.",
  "这次登录已经过期，请再登录一次": "This sign-in expired. Sign in again.",
  "登录没有开始，请再点一次“用公司账号登录”": "Sign-in didn't start. Click “Sign in with company account” again.",
};
