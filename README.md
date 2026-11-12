# `@jccdex/jdid-dapp-sdk`

在 **JDID 钱包**里运行的 dApp,用这个包调用钱包能力:`window.ethereum` 的 typed 客户端、
契约里的 13 个方法、以及一套能离线自检的工具链(conformance / Mock 钱包 / 真机 CDP)。

> **它不是运行时。** dApp 的真实运行时是 JDID 钱包 WebView 注入的 `window.ethereum` / `window.ccdao`。
> 本包不改运行时、不签名、不持有私钥;`secret` / `confirm` 类调用永远由钱包自己弹解锁与确认。

- 零依赖,只用 Node 内置模块;Node **>= 22**(仅 CLI 与测试需要,浏览器侧无 Node 依赖)
- 包版本与契约版本保持一致(当前均为 `0.0.2`),`npm run gen:check` 会守这一条

---

## 安装

```sh
npm i @jccdex/jdid-dapp-sdk
# 或 pnpm add / yarn add
```

**前置条件**:页面必须从 **JDID App 的 Explore(DApp 页)** 打开 —— 只有那里才有钱包注入的
`window.ethereum`。在普通浏览器里 `createClient()` 会明确抛 `wallet_missing`,而不是静默失败。

```js
import { createClient } from "@jccdex/jdid-dapp-sdk";

const wallet = createClient(); // 自动发现 window.ethereum / window.ccdao
```

可选参数:`createClient({ wallet, timeoutMs })`(默认超时 20s,自带 `wallet` 便于注入 Mock)。

### 在 DeepSeek Harness(DSH)里使用

本包同时是一个 **DSH bundle**(`package.json` 的 `dsh.bundle.patch` → `dsh/cordis.patch.yml`):
装进 DSH 后,agent 就有了"自己开 dApp、调 provider、看日志、截图"的能力,不用人手动点手机。

#### 1. 安装

```sh
dsh plugin --profile web add @jccdex/jdid-dapp-sdk   # 等价于 Settings → Plugins 里安装
```

装完 **重启 `dsh web`**;新会话里会多出 12 个 `mcp__jdid-wallet__*` 工具。确认生效:

- 会话里让 agent 调一次 `jdid_devices`,返回设备序列号(如 `emulator-5554`)即通;
- 或脱离 DSH 直接自测 stdio(打印 `serverInfo` 后按 Ctrl-C):

```sh
npx -y -p @jccdex/jdid-dapp-sdk jdid-wallet-mcp
```

#### 2. 在 Web 聊天里用文字使用

打开 DSH Web(就是这个对话界面),**直接说你要什么**,不用记工具名:

| 你说 | agent 会做 | 你会看到 |
| --- | --- | --- |
| 「看看现在连着几台设备」 | `jdid_devices` | `emulator-5554` |
| 「在钱包里打开 <http://127.0.0.1:5173/>」 | 起静态服务器 + `adb reverse` + `jdid_open_dapp` | 页面被拉起 |
| 「看看页面里钱包是什么状态」 | `jdid_probe` | `eth_accounts` / `chainId` / `selectedAddress` |
| 「帮我调一下 did_stat,对象是 did:swtc:…」 | `jdid_eval` | `{ cid }` |
| 「把这个 DID 的文档解析出来」 | `jdid_eval` 里调 `did_resolve` | 文档 JSON(没上链是 `null`) |
| 「跑一下示例的自检」 | `npx jdid-dapp-conformance --dapp examples/did-lookup` | 五项全绿 |
| 「截个图看看页面」 | `jdid_screenshot` | 图片路径 |
| 「把刚才的报错捞出来」 | `jdid_logcat` + grep | `WebAppInterface` / `DidSdk` 日志 |
| 「给这个 dApp 再加一个凭证验证页」 | 改文件 + 跑自检 | 新文件 + 自检结果 |

几句提醒:

- **说目标,别报工具名**:"帮我查一下这个 DID" 比 "调用 jdid_eval" 更好使,工具由 agent 选。
- **写操作要说清后果**:说「发布 DID 文档(会写链)」,agent 才会带 `allowWrite: true`;钱包仍会再弹一次确认。
- **卡住就贴现场**:把 `jdid_logcat` 的输出或截图发回聊天,比"不工作"有效得多。
- Web 里可以用 `@` 引用文件或目录(如 `@examples/did-lookup`),agent 会直接读源码。

#### 3. 让 agent 写一个 dApp

给 agent 的一句话(它会自己读契约、生成工程、跑自检):

> 在 JDID 里做一个查 DID 的 dApp:读 `node_modules/@jccdex/jdid-dapp-sdk/contract/methods.json`
> 挑方法(只能用契约里的名字),生成 `jdid-manifest.json` + `index.html` + `main.js`
> (导出 `run(wallet)`),最后用 `npx jdid-dapp-conformance --dapp .` 自检到全绿。

仓库自带一个 skill(`jdid-dapp`,见 [`.dsh/skills/jdid-dapp/SKILL.md`](.dsh/skills/jdid-dapp/SKILL.md)),
把"读契约 → 建 manifest → 写 run(wallet) → conformance"固化成了五步;想复用它,把该目录拷到
项目的 `.dsh/skills/`(或 `~/.dsh/skills/`)下即可。

#### 4. 让 agent 真机联调

典型闭环(全部通过 MCP 工具完成):

```text
jdid_devices                     # 1) 确认设备
jdid_open_dapp { url }           # 2) 在 Explore 里打开(先 adb reverse 起静态服务器)
jdid_probe                       # 3) 看注入状态:eth_accounts / chainId / selectedAddress
jdid_eval { expression }         # 4) 在页面里跑 JS:调 window.ethereum.request(...)
jdid_logcat { grep }             # 5) 看 WebAppInterface / DidSdk 的报错
jdid_screenshot { path }         # 6) 留证
```

前置条件:`adb devices` 有设备、装的是 **debug** 包(WebView 调试只对 debuggable 应用开启)、
钱包已解锁并进过 Explore。

写操作有闸门:`jdid_did_publish` 不传 `allowWrite: true` 时**完全不碰设备**,直接返回
`{ ok: false, state: "blocked" }`;即便传了,钱包仍会按 origin 弹一次确认。

#### 5. 在 DSH 的 shell 里直接用 SDK

DSH 的 bash 工具可以直接跑 Node 片段(前提是工程里装了本包):

```sh
# 列当前契约的方法面
node --input-type=module -e '
import { CONTRACT_VERSION, METHOD_NAMES } from "@jccdex/jdid-dapp-sdk";
console.log(CONTRACT_VERSION, METHOD_NAMES);
'

# 用 Mock 钱包跑一遍 dApp 的 run(wallet),看它到底发了哪些调用
node --input-type=module -e '
import { createMockWallet } from "@jccdex/jdid-dapp-sdk/mock";
const w = createMockWallet();
await w.request("did_stat", ["did:swtc:MOCK"]);
console.log(w.methodsCalled(), w.calls);
'

# 五项静态自检(不需要设备)
npx jdid-dapp-conformance --dapp . --json
```

#### 6. 给 agent 的硬约束(写进 prompt 更保险)

- 只调用 `contract/methods.json` 里的方法;不在里面的名字会被客户端在**发出前**拒绝。
- SWTC 身份的账户走 `swtc_requestAccounts`;SWTC 钱包上 `eth_requestAccounts` 返回 `[]`。
- `eth_chainId` 恒为 `0x1`,不能用来判断链。
- 动钱方法(`swtc_sendTransaction` / `eth_sendTransaction` / `swtc_multiSign` /
  `swtc_batchTransactions`)**不要**在自检或 agent 流程里调用。
- 私钥/助记词永远不进 dApp:签名只在钱包里做。

---

## 查看这个插件里有什么

**① 运行时直接打印**(推荐,永远和当前版本一致)

```js
import { CONTRACT_VERSION, METHODS } from "@jccdex/jdid-dapp-sdk";

console.log(`契约 ${CONTRACT_VERSION},共 ${METHODS.length} 个方法`);
console.table(
  METHODS.map(({ name, payload, needs, status, note }) => ({
    方法: name,
    载荷: payload,
    需要: needs.join(",") || "-",
    状态: status,
    说明: note,
  })),
);
```

`METHODS` / `METHOD_INDEX` 带 `name / family / payload / returns / needs / status / note / source`;
`METHOD_NAMES` 只有名字;`CONTRACT_VERSION` 是契约版本。

**② 能力矩阵文档**:[`docs/capabilities.md`](docs/capabilities.md) —— 自动生成的表,列有
`方法 | 族 | 载荷 | 返回 | needs | status | 说明`,适合直接贴给协作方或 agent 读。

**③ 命令行自检**(不需要设备):

```sh
npx jdid-dapp-conformance --dapp .          # 五项静态自检
npx jdid-dapp-conformance --dapp . --json   # 机器可读
```

报告里会带上 `contractVersion`、dApp 声明的方法、实际调用的方法、以及会弹给用户的授权面。

**④ 插件(DSH / MCP)里有什么**:安装后是 12 个 `jdid-wallet` 工具,分三组 ——

| 组 | 工具 |
| --- | --- |
| 设备与页面 | `jdid_devices`、`jdid_open_dapp`、`jdid_probe`、`jdid_eval`、`jdid_tap`、`jdid_type`、`jdid_logcat`、`jdid_screenshot` |
| DID 能力 | `jdid_did_inspect`(只读)、`jdid_did_verify`(只读)、`jdid_did_publish`(写,默认拦下) |
| 契约自检 | `jdid_conformance` |

`jdid_did_publish` 必须显式传 `allowWrite: true` 才会碰设备,否则直接返回
`{ ok: false, state: "blocked" }`。真机工具的**前置条件**:`adb devices` 有设备、装的是 **debug** 包
(WebView 调试只对 debuggable 应用开启)、钱包已解锁并进过 Explore。

不装插件也能直接起这个 MCP server(stdio):

```sh
npx -y -p @jccdex/jdid-dapp-sdk jdid-wallet-mcp
```

---

## 开放 API 怎么用

客户端把 13 个契约方法都包成了具名 helper,底层统一走 `wallet.request({ method, params })`:

| helper | RPC 方法 | 载荷 | 会弹确认 |
| --- | --- | --- | --- |
| `connect()` | `eth_requestAccounts` | `[]` | 首次授权 |
| `connectSwtc()` | `swtc_requestAccounts` | `[]` | 首次授权 |
| `requestAccountName(address)` | `did_requestAccountName` | `[address]` | 否 |
| `base58PublicKey(address)` | `did_getBase58PublicKey` | `[address]` | 是 |
| `issueCredential(payload)` | `did_issueCredential` | `[{keyDoc:{address,did,id}, credential:{…}}]` | 密码 + 确认 |
| `ipfsSign({data, address})` | `ipfs_personalSign` | `[[…bytes], address]` | 签名 |
| `ipfsPublicKey(address)` | `ipfs_getPublicKey` | `[address]` | 是 |
| `publishDid({did, didDocument, address})` | `did_publish` | `[{address, did, didDocument}]` | 密码 + 确认,写链 |
| `resolveDid(did)` | `did_resolve` | `[did]` | 否 |
| `didStat(did)` | `did_stat` | `[did]` | 否 |
| `generateVC(payload)` | `did_generateVC` | `[{address, id, types, subject}]` | 密码 + 确认 |
| `verifyCredential(credential)` | `did_verifyCredential` | `[credentialJsonOrObject]` | 否 |
| `generateDidDoc(payload)` | `did_generateDidDoc` | `[{did, version}]` | 否 |

也可以不用 helper,直接调契约里的名字(SDK 会在**发出之前**拒绝未知方法):

```js
await wallet.request("did_stat", ["did:swtc:jsk26..."]);
```

### 典型流程

```js
// 1) 拿账户(SWTC 身份;EVM 身份用 connect())
const [address] = await wallet.connectSwtc();
const did = `did:swtc:${address}`;

// 2) 拼装 / 解析文档(都只读)
const doc = await wallet.generateDidDoc({ did, version: "1.0" });
const onChain = await wallet.resolveDid(did); // 没上链时是 null
const stat = await wallet.didStat(did);       // { cid }

// 3) 发布文档(写链:钱包弹密码 + 确认;私钥由钱包按 address 取,页面不传)
await wallet.publishDid({ address, did, didDocument: doc });

// 4) 生成 / 签发 / 验证凭证
const vc = await wallet.generateVC({
  address,
  id: "urn:uuid:demo-1",
  types: ["VerifiableCredential"],
  subject: { id: did },
});
const signed = await wallet.issueCredential({
  keyDoc: { address, did, id: `${did}#key-1` }, // did + id 必填
  credential: {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    id: "urn:uuid:demo-2",
    type: ["VerifiableCredential"],
    issuer: did,
    issuanceDate: new Date().toISOString(),
    credentialSubject: { id: did },
  },
});
const { verified } = await wallet.verifyCredential(signed);
```

`eth_*` 只报 **EVM** 账户(SWTC 身份下返回 `[]`),`eth_chainId` 是 provider 默认值,**不能用来判断链**。

### 错误处理

所有失败都归一化成 `JdidDappError`,带稳定的 `code`:

| `code` | 含义 |
| --- | --- |
| `wallet_missing` | 没找到 provider(不在 JDID App 里打开) |
| `unknown_method` | 方法名不在契约里 |
| `timeout` | 钱包没在超时内响应(未解锁 / 确认弹窗超时) |
| `wallet_rejected` | 钱包拒绝(用户点取消、密码错、参数不合法等,原文在 message 里) |

```js
try {
  await wallet.publishDid({ address, did, didDocument: doc });
} catch (e) {
  if (e.code === "timeout") {
    /* 确认弹窗 15s 超时,等价于用户拒绝 */
  }
}
```

### 没有 EIP-1193 provider 的宿主

某些宿主只提供原生桥 `_tw_`,这时用 `createNativeTransport`:

```js
import { createNativeTransport } from "@jccdex/jdid-dapp-sdk";

const t = createNativeTransport({
  postMessage: (json) => window._tw_.postMessage(json), // { name, network, id, params }
});
// 原生侧回调:
t.handleResponse(id, result);
t.handleError(id, error);
```

---

## 自测:dApp 里怎么写才能在 Node 里跑

本包约定 dApp 导出一个 `run(wallet)`;`createMockWallet()` 给桩值,conformance 的冒烟检查就靠它:

```js
import { createMockWallet } from "@jccdex/jdid-dapp-sdk/mock";

export async function run(wallet) {
  const [addr] = await wallet.request("swtc_requestAccounts", []);
  return { addr };
}

// 测试里
const mock = createMockWallet();
await run(mock);
console.log(mock.calls); // [{ method, params }] —— conformance 用它校验"声明覆盖"
```

---

## 最小 dApp 与自检

一个 dApp 目录需要 `jdid-manifest.json`(必填 `name` / `version` / `entry` / `methods`,
schema 见 [`schema/manifest.schema.json`](schema/manifest.schema.json)),`methods` 必须是契约的子集。

```sh
npx create-jdid-dapp my-dapp      # 从 examples/minimal-dapp 拷贝骨架
cd my-dapp
npx jdid-dapp-conformance --dapp . # contract / codegen / manifest / dapp-source / smoke 五项
```

真机联调(需要 adb + debug 包 + 已解锁):

```sh
node node_modules/@jccdex/jdid-dapp-sdk/cli/conformance.mjs --cdp --wait 180
# 终端给出 http://127.0.0.1:<port>/ ,粘到 Explore 打开;--auto-open 可自动拉起
```

`--cdp` 只跑只读探针;加 `--run-dapp` 才会跑 dApp 自己的 `run(wallet)`(可能触发授权/确认)。

---

## 示例

| 目录 | 做什么 | 会弹的授权面 |
| --- | --- | --- |
| [`examples/minimal-dapp`](examples/minimal-dapp) | 取账户、读 DID 名字与 Base58 公钥、签一条载荷、拼装 + 解析文档 | `secret`(签名) |
| [`examples/did-lookup`](examples/did-lookup) | 只读查 DID:拼装文档、解析链上文档、读 `cid` | 无(不碰签名与确认) |

两个都导出 `run(wallet)`,因此既能离线自检,也能直接在 Explore 里打开:

```sh
npx jdid-dapp-conformance --dapp examples/minimal-dapp
npx jdid-dapp-conformance --dapp examples/did-lookup
```

真机看效果(静态服务器跑在宿主,再用 `adb reverse` 打通):

```sh
python3 -m http.server 5173 --directory examples/did-lookup
adb reverse tcp:5173 tcp:5173
# 然后在 JDID 的 Explore 里打开 http://127.0.0.1:5173/
```

## 本仓开发

```sh
npm run gen          # 改完 contract/methods.json 重新生成三份产物
npm run gen:check    # 只校验漂移(CI)
npm test             # node --test
npm run check        # 以上三件套
```

`contract/methods.json` 是**唯一来源**,方法名与宿主实现以 `kotlin-toolkits/dapp-connect` 的
`DAppMethod.kt` / `WebAppInterface.kt` 为准。生成物(`src/methods.js`、`src/index.d.ts`、
`docs/capabilities.md`)不要手改;`payload` 列只描述 `params` 的形状,不参与管线判定。

目录:

```text
contract/methods.json   契约单一来源(13 个方法、needs/status/payload、线格式)
src/index.js            createClient() / createNativeTransport() / 错误归一化
src/mock.js             createMockWallet():测试与 conformance 用的假钱包
cli/conformance.mjs     五项自检 + 可选 --cdp 真机
cli/create-dapp.mjs     脚手架
mcp/server.mjs          jdid-wallet-mcp:让 agent 驱动真机钱包
dsh/cordis.patch.yml    DSH 插件层:把上面这个 MCP server 注册成 mcp-jdid-wallet
docs/capabilities.md    生成的能力矩阵
```

## 许可

MIT
