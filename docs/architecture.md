# 架构与目录职责

> 这份文档回答一个问题:**"我想改 X,该动哪个目录?"**
> 全仓的口径是「契约单一来源 → 生成 → 消费」,九个目录按这三段分工,另加两类面向人的东西(文档、agent 说明)。

## 一、依赖方向

```text
contract/methods.json            唯一事实源:13 个方法(10 verified + 3 partial)+ needs/status/note + 钱包线格式
        │
        │  scripts/gen.mjs(校验 + 渲染)
        ▼
src/methods.js   src/index.d.ts   docs/capabilities.md      ← 三份「生成物」,不要手改
        │
        ├─► src/index.js  作者页面里 import 的客户端(createClient / 13 个 helper)
        ├─► src/mock.js   测试与自检用的假钱包
        ├─► cli/          静态自检、真机通道、逐条校准
        └─► mcp/          agent 驱动钱包的 MCP server(复用 cli 的传输层)

schema/manifest.schema.json   dApp 的 jdid-manifest.json 形状(conformance 按它判)
examples/minimal-dapp/        能跑的最小样板(conformance 的默认目标)
.dsh/skills/jdid-dapp/        给 agent 的操作手册(文件系统发现,不需注册)
```

依赖是**单向**的:契约 → 生成物 → 消费者。没有任何反向依赖,也没有循环。

## 二、九个目录

| 目录 | 放什么 | 谁消费 | 可否手改 |
| --- | --- | --- | --- |
| `contract/` | `methods.json`:方法名 / `returns` / `needs` / `status` / `note` / `source`,外加 `_tw_` 线格式、注入的全局、事件、默认链 | 生成器、conformance、作者工具 | ✅ **唯一可手改的源头** |
| `scripts/` | `gen.mjs`:`validateContract()`(唯一名 / 枚举 / `confirm ⇒ secret` / `source` 必须存在)+ 四个 renderer;`--check` 只校验不写 | 开发者、CI | ✅ |
| `src/` | 作者侧运行时:`index.js`(`createClient` + 白名单 + 超时/错误归一化 + `_tw_` transport)、`mock.js`(假钱包)、`methods.js`、`index.d.ts` | dApp 作者、测试、conformance | `index.js`/`mock.js` ✅;`methods.js`/`index.d.ts` ❌ 生成物 |
| `cli/` | `conformance.mjs`(5 项静态检查 + 可选 `--cdp`)、`cdp.mjs`(adb/CDP 底座)、`device-ui.mjs`(uiautomator)、`calibrate.mjs`(逐条真机校准) | 作者、CI、开发者 | ✅ |
| `mcp/` | `server.mjs`:9 个工具(devices / open_dapp / probe / eval / tap / type / logcat / screenshot / conformance),stdio JSON-RPC,零依赖,复用 `cli/` 的传输层;`README.md` 写注册方式与限制 | agent(MCP 客户端) | ✅ |
| `schema/` | `manifest.schema.json`:dApp 清单的形状(`name`/`version`/`entry`/`methods`) | conformance 的 manifest 检查 | ✅ |
| `examples/` | `minimal-dapp/`:`main.js`(导出 `run(wallet)`)+ `index.html` + `jdid-manifest.json` | conformance 默认目标、作者照抄 | ✅(必须始终绿) |
| `docs/` | `capabilities.md`(生成的能力矩阵)+ 本文档 | dApp 作者、agent | `capabilities.md` ❌ 生成物;其它 ✅ |
| `.dsh/` | `skills/jdid-dapp/SKILL.md`:五步流程与硬约束;拷到 `<项目>/.dsh/skills/` 或 `~/.dsh/skills/` 即被 DSH 发现 | agent | ✅ |

## 三、三份生成物(不要手改)

| 生成物 | 由谁生成 | 守卫 |
| --- | --- | --- |
| `src/methods.js` | `scripts/gen.mjs` → `renderMethods` | `gen --check` / `conformance` 的 codegen 项 |
| `src/index.d.ts` | `renderTypes` | 同上 |
| `docs/capabilities.md` | `renderCapabilities` | 同上 |

改契约后的正确流程:

```sh
# 1) 只改 contract/methods.json
node scripts/gen.mjs          # 2) 重新生成三份产物
node --test "test/*.test.mjs" # 3) 测试
node cli/conformance.mjs      # 4) 五项检查
```

## 四、改哪里(决策表)

| 想做的事 | 动哪里 |
| --- | --- |
| 加/删方法、改 `needs`/`status`/说明 | `contract/methods.json` → `npm run gen` |
| 改契约校验规则、类型/常量/能力矩阵的模板 | `scripts/gen.mjs` |
| 加客户端 helper | `src/index.js` **和** `scripts/gen.mjs` 的 `.d.ts` 模板(两处,当前是已知弱点) |
| 加静态检查项 | `cli/conformance.mjs` |
| 加真机能力(新 adb/CDP 操作) | `cli/cdp.mjs` / `cli/device-ui.mjs` |
| 加 agent 工具 | `mcp/server.mjs` |
| 教 agent 怎么做 | `.dsh/skills/jdid-dapp/SKILL.md` |
| 改 dApp 清单格式 | `schema/manifest.schema.json` + `cli/conformance.mjs` 的 manifest 检查 |

## 五、边界:不在这些目录里的东西

- **运行时不在本仓**:`window.ethereum` / `window.ccdao` 由 JDID 钱包(另一个仓)注入;本仓只做"调用前的闸门 + 调用后的归一化"。
- **契约是"作者可依赖的面",不是"钱包只实现这些"**:钱包还实现了 `eth_chainId`、`swtc_signMessage` 等,但不在 13 条契约内,客户端会在发出前拒绝。`mcp` 的 `jdid_probe` 属于**钱包诊断**,可用契约外方法(已在 `mcp/README.md` 注明)。
- **发布白名单**:`package.json` 的 `files`(`src`/`scripts`/`contract`/`schema`/`cli`/`docs`/`mcp`/`examples`/`dsh`)决定 npm 包包含什么。`mcp/server.mjs` 与 `cli/conformance.mjs` 运行时会 `import ../scripts/gen.mjs`，所以 `scripts/` 必须发布(由 `test/publish-completeness.test.mjs` 守卫)。
