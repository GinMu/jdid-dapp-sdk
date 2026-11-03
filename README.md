# `@jdid/dapp-sdk` —— 最小骨架

给 **dApp 作者**用的工具链骨架:**契约单一来源 → 类型/常量生成 → conformance 自检**。
零依赖,只用 Node 内置模块。

> **它不是运行时。** dApp 的真实运行时仍是 JDID 钱包 WebView 里注入的
> `window.ethereum` / `window.ccdao`(`kotlin-toolkits` 的 `ccdao-eip1193-provider.js`)。
> 本包不改运行时、不签名、不持有私钥。

## 目录

```text
contract/methods.json      契约单一来源(28 个 RPC 方法 + needs/status + 线格式)
schema/manifest.schema.json jdid-manifest.json 的 JSON Schema
scripts/gen.mjs            生成器:methods.json → src/methods.js / src/index.d.ts / docs/capabilities.md
src/index.js               createClient() typed 客户端 + createNativeTransport()(_tw_ 线格式)
src/mock.js                createMockWallet():测试/示例用的假钱包(桩值)
cli/conformance.mjs        conformance CLI:契约/生成物/manifest/调用声明/Mock 冒烟
examples/minimal-dapp/     最小示例 dApp(拿地址 + 读 chainId + 签一条消息)
test/                      node --test 用例(含两条反向证明)
docs/capabilities.md       生成的能力矩阵:哪些方法可用、要不要用户确认
```

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

## 已经实现 vs 还没做

已实现(本骨架):

- 契约校验 + 生成物漂移守卫(含**反向证明**用例:手改生成物必红);
- manifest 校验:`entry` 存在、`methods ⊆ 契约`;
- **调用声明覆盖**:静态字面量 ∪ Mock 跑出来的真实调用,未声明即红(反向证明 fixture 已覆盖);
- `_tw_` 线格式实现与断言:`{ name, network, id, params }`,响应按 id 只结算一次;
- 超时/未知方法/钱包拒绝的错误归一化(`timeout` / `unknown_method` / `wallet_rejected`)。

还没做(下一步):

- `--cdp` 传输:把同一份用例打到 **debug** WebView 的 CDP 上(真钱包真签名);release 绝不能开调试;
- 按 origin 的授权台账与 dApp catalog(钱包侧要做运行时,本包只管声明与校验);
- `create-jdid-dapp` 脚手架与 `@jdid/dapp-sdk` 的正式发版(现在 `private: true`)。

## 与 harness 的关系

本包是**给 agent 用的底座**:项目里的 `AGENTS.md` 与 `.dsh/skills/jdid-dapp/SKILL.md`
只需要引用本包的 `contract/methods.json` + `npm run conformance`,就能让 agent
"按用户想法生成 dApp → 自检 → 交回可运行工程"。MCP(驱动模拟器)是再下一层,不在本骨架内。
