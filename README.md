# `@jdid/dapp-sdk` —— 最小骨架

给 **dApp 作者**用的工具链骨架:**契约单一来源 → 类型/常量生成 → conformance 自检**。
零依赖,只用 Node 内置模块。

> **它不是运行时。** dApp 的真实运行时仍是 JDID 钱包 WebView 里注入的
> `window.ethereum` / `window.ccdao`(`kotlin-toolkits` 的 `ccdao-eip1193-provider.js`)。
> 本包不改运行时、不签名、不持有私钥。

## 目录

```text
contract/methods.json      契约单一来源(13 个可依赖方法:10 verified + 3 partial,含 needs/status + 线格式)
schema/manifest.schema.json jdid-manifest.json 的 JSON Schema
scripts/gen.mjs            生成器:methods.json → src/methods.js / src/index.d.ts / docs/capabilities.md
src/index.js               createClient() typed 客户端 + createNativeTransport()(_tw_ 线格式)
src/mock.js                createMockWallet():测试/示例用的假钱包(桩值)
cli/conformance.mjs        conformance CLI:契约/生成物/manifest/调用声明/Mock 冒烟
examples/minimal-dapp/     最小示例 dApp(SWTC 账户 + DID 名字 + Base58 公钥 + 签名)
test/                      node --test 用例(含两条反向证明)
docs/capabilities.md       生成的能力矩阵:哪些方法可用、要不要用户确认
docs/architecture.md       目录/分层职责:契约 → 生成 → 消费,以及"想改 X 该动哪个目录"
mcp/server.mjs             jdid-wallet-mcp:agent 驱动真机钱包的 9 个工具
```

## 发布与起步(0.3.0 起)

本包已可发布(`private` 已去掉,`files` 含 `src/contract/schema/cli/docs/mcp/examples`,版本跟契约版本对齐)。

```sh
# 1) 从模板起步(拷 examples/minimal-dapp 并改写 import 为包名)
npx @jdid/dapp-sdk my-first-dapp
cd my-first-dapp && npm i
node node_modules/@jdid/dapp-sdk/cli/conformance.mjs --dapp .   # 静态自检,不需要设备

# 2) 在 JDID App 里真机联调
npx @jdid/dapp-sdk jdid-wallet-mcp    # 以 stdio 起 MCP server,交给 agent 驱动
```

三个 bin:

| bin | 作用 |
| --- | --- |
| `create-jdid-dapp` | 生成 dApp 骨架(manifest 的 `name` 与目录名一致) |
| `jdid-dapp-conformance` | 五项静态自检 + 可选 `--cdp` 真机 |
| `jdid-wallet-mcp` | MCP server:让 agent 自己开 dApp/调 provider/截图 |

CI(`.github/workflows/ci.yml`)在 Node 22 上跑 `npm run check`,并用 `npm pack --dry-run` 兜住 `files` 白名单。

## 快速开始

```sh
npm run gen          # 改完 contract/methods.json 后重新生成
npm run gen:check    # 只校验生成物是否漂移(CI 用)
npm test             # 22 个用例
npm run conformance  # 对 examples/minimal-dapp 跑一遍
npm run check        # 以上三件套
```

`npm run conformance -- --dapp <dir>` 可对任意 dApp 目录自检;`--json` 给机器读。

## 写一个 dApp 的最小流程

1. 建目录,放 `jdid-manifest.json`(必填 `name`/`version`/`entry`/`methods`,见 `schema/manifest.schema.json`);
2. 页面里 `import { createClient } from "@jdid/dapp-sdk"`,用 `createClient(window.ethereum)`;
3. 只调用契约里的方法(SDK 会在**发出之前**拒绝未知方法名);
4. `run(wallet)` 这个约定让你能用 `createMockWallet()` 在 Node 里跑同一份逻辑 —— conformance 靠它做冒烟;
5. `npx jdid-dapp-conformance --dapp .` 自检,再拿到 JDID App 的 Explore 页里打开。

`examples/minimal-dapp/` 是照着上面五步写的完整例子。

## 契约怎么改(重要)

`contract/methods.json` 是**唯一来源**,方法名与宿主实现以
`kotlin-toolkits/dapp-connect` 的 `DAppMethod.kt` / `WebAppInterface.kt` 为准
(见 JSON 里的 `sources` 字段)。改契约的流程:

```text
改 contract/methods.json → npm run gen → 三份生成物一起提交
```

- `gen --check` 会在 CI 里拦住"改了契约忘了重新生成";
- `test/contract.test.mjs` 里有一份与 `DAppMethod.kt` 对齐的方法名清单,**加/删方法必须显式改它**;
- 契约里的两条硬规则:方法名唯一;`needs` 含 `confirm` 的方法必须同时含 `secret`(要确认的调用必然也要签名材料)。

## `status` 与 `needs` 的含义

| 字段 | 含义 |
| --- | --- |
| `status: verified` | 有源码守卫/测试证据,可直接依赖 |
| `status: partial` | 可用但有已知限制(看 `note`),生产 dApp 要容错 |
| `status: stub` | 宿主返回桩值/恒空(如 `eth_blockNumber`、`eth_requestNfts`),**不要依赖** |
| `status: unknown` | 本仓 conformance 未覆盖,接入前先实测 |
| `needs: account/secret/confirm/chain` | 该调用会碰到的授权面;`secret`/`confirm` 就是钱包会弹给用户的解锁/确认 |

`docs/capabilities.md` 是这张表的自动生成版,给 dApp 作者和 agent 读。

## 真机跑法(`--cdp`)

前面 5 项检查都在 Node 里跑;要打**真钱包**,加 `--cdp`:

```sh
# 1) 宿主机有 adb,设备已连上(debug 包:WebView 调试对 debuggable 应用默认开启)
# 2) 在设备上解锁 JDID 并进入 Explore(先别输地址)
node cli/conformance.mjs --cdp --wait 180

# 3) 终端会打印形如 http://127.0.0.1:56803/ 的地址(已用 adb reverse 打通),
#    粘到 Explore 输入框里打开;页面出现后工具自动 attach
```

它做的事:起静态服务器 → `adb reverse` → 等 App 进程 → `adb forward` 到
`webview_devtools_remote_<pid>` → 在页面里 `Runtime.evaluate` 跑只读探针
(`eth_accounts` / `eth_chainId` / `web3_clientVersion`),**不触碰** `secret` / `confirm`。

- 默认只跑探针;要连 dApp 的 `run(wallet)` 一起跑就加 `--run-dapp`(示例 dApp 会先
  `eth_requestAccounts` 授权、再 `personal_sign`,需要已解锁,会弹确认);
- 没有设备 / App 没开:默认**降级为跳过**(报告里 `~ cdp`),加 `--require-cdp` 才判失败;
- **`eth_accounts` 为空不算失败**(M-R7:未授权 origin 不注入地址),报告里是一条 `~` 警告
  (注意:探针用的是**钱包诊断方法**,不受 13 条契约限制 —— 契约是"作者可依赖的面",不是"钱包只实现这些");
  想让它变失败加 `--require-accounts`(那就要先在钱包里授权);
- 其它开关:`--device <serial>`、`--package <id>`(默认 `com.android.jdid`)、`--wait <秒>`、`--port <端口>`、`--auto-open`。
- **`--port` 固定端口有实际意义**:origin(`http://127.0.0.1:<port>`)是授权台账的键,端口随机就意味着
  **每次都要重新授权**;固定成比如 `--port 5173` 后,一次授权后续几次都静默。
- **`--auto-open`** 会 `monkey` 拉起 App、点 Explore,并**优先点 App 的「最近访问」**里的同一个地址;
  找不到时才退化为 `input text` 打字。⚠️ 实测中文输入法会把 `http://` 改写成全角 `HTTP：／／`、
  吞掉点号(`127.0.0.1:59721` → `12700.：／159721`),所以**第一次请用固定 `--port` 手动打开一次**,
  之后 `--auto-open` 就能靠最近访问稳定复跑。解锁页/改版后找不到控件时只打印提示,不会瞎点。

> release / 上架包没有这个能力(WebView 调试只在 debuggable 构建里),这是刻意的。

## 已经实现 vs 还没做

已实现(本骨架):

- 契约校验 + 生成物漂移守卫(含**反向证明**用例:手改生成物必红);
- manifest 校验:`entry` 存在、`methods ⊆ 契约`;
- **调用声明覆盖**:静态字面量 ∪ Mock 跑出来的真实调用,未声明即红(反向证明 fixture 已覆盖);
- `_tw_` 线格式实现与断言:`{ name, network, id, params }`,响应按 id 只结算一次;
- 超时/未知方法/钱包拒绝的错误归一化(`timeout` / `unknown_method` / `wallet_rejected`);
- **`--cdp` 真机通道**:静态服务器 + `adb reverse`/`forward` + 页面内 `Runtime.evaluate`
  跑只读探针;缺设备时降级跳过,`--require-cdp` 才判失败。

**历史真机校准(2026-11-04,28 条时代的记录,保留作证据)**:当时逐条实测后写回契约——

- **授权前** `eth_accounts` → `[]`、`swtc_requestAccounts` → `User rejected`(M-R7 设计);
  设备上确认一次后 `swtc_requestAccounts` 返回地址;**C185 起 `eth_accounts` / `eth_requestAccounts`
  在已授权状态下仍为 `[]`**(EVM-only,2026-11-05 复验),SWTC 账户只能走 `swtc_requestAccounts`。
- **确认是桩的**:`eth_blockNumber` → `"0x0"`、`eth_requestNfts` → `{address:"",total:0,nfts:[]}`
  (是**对象**不是数组,`returns` 已更正)。
- **真能签的**:`swtc_signMessage`(23s,含确认,DER 签名)、`ipfs_personalSign`(13ms,DER 签名)。
- **会弹确认的门**(2026-11-05 补测,确认后均成功):`swtc_getPublicKey` → 压缩公钥 `03347aa7…`;
  `did_getBase58PublicKey` → `{publicKeyBase58:"xDondUJ3…",type:"EcdsaSecp256k1…"}`;
  `ipfs_getPublicKey` → 与 `swtc_getPublicKey` 相同;`swtc_signMessage` → DER 签名。**不点确认则超时**。
- **EVM 方法在 SWTC 地址上直接拒**:`personal_sign` / `eth_decrypt` / `eth_getEncryptionPublicKey`
  都报 `Address is not an EVM address` → SWTC 场景请用 `swtc_*`。
- `eth_chainId` → `0x1`(provider JS 默认,原生从不推 `_updateChainId`)——**不能**用来判断真实链;
- `did_requestAccountName` → `"Base1"`;`web3_clientVersion` → `CCDAO/v1.0.0`。

`node cli/calibrate.mjs --address <地址>` 可复跑这套逐条校准(默认只跑只读/无资金风险的方法)。

还没做(下一步):

- **用真机结果继续校准契约**:v0.3.0 起方法面 13 条(10 `verified` + 3 `partial`);新增方法时用 `--cdp` / `calibrate` 的实测输出把 `partial` 逐条变成证据
  (需要解锁后跑一轮);
- 按 origin 的授权台账与 dApp catalog(钱包侧要做运行时,本包只管声明与校验);
- `create-jdid-dapp` 脚手架与 `@jdid/dapp-sdk` 的正式发版(现在 `private: true`)。

## 与 harness 的关系

本包是**给 agent 用的底座**:项目里的 `AGENTS.md` 与 `.dsh/skills/jdid-dapp/SKILL.md`
只需要引用本包的 `contract/methods.json` + `npm run conformance`,就能让 agent
"按用户想法生成 dApp → 自检 → 交回可运行工程"。MCP(驱动模拟器)是再下一层,不在本骨架内。
