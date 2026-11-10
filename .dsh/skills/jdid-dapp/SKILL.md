---
name: jdid-dapp
description: 用 @jdid/dapp-sdk 的契约给 JDID 钱包生成/修改一个 dApp,并用 conformance 自检(Mock 与真机两档)。当用户说"做一个 dApp""给钱包加个页面/功能""接一下 JDID 的钱包能力"时使用。
whenToUse: 用户要在 JDID 钱包里跑一个自建 dApp,或要改动本仓示例 dApp / 契约 / conformance。
user-invocable: true
---

# 给 JDID 生成一个 dApp

本仓(`jdid-dapp-sdk`)是 **dApp 作者侧的唯一事实源**:契约、类型、自检 CLI。钱包运行时不在
这里 —— 页面里的 `window.ethereum` / `window.ccdao` 由 JDID App 注入。

## 五步流程

1. **读契约**:`contract/methods.json`(**13 个方法:10 verified + 3 partial**;`status` 告诉你哪些能直接依赖)。
   不在里面的方法不要调用 —— 客户端会在发出前拒绝。DID bridge 的 6 个见第 6 步。
   只调用那里面的方法名;`needs` 含 `secret`/`confirm` 的会弹钱包授权。
2. **建 manifest**:`jdid-manifest.json`(`name`/`version`/`entry`/`methods`),
   schema 在 `schema/manifest.schema.json`。
3. **写逻辑**:`import { createClient } from "@jdid/dapp-sdk"` → `createClient(window.ethereum)`;
   导出 `run(wallet)` 便于 Node 里用 `createMockWallet()` 跑同一份代码。
4. **自检**:`node cli/conformance.mjs --dapp <dir>`(契约/生成物/manifest/声明覆盖/冒烟 五项)。
5. **(可选)真机**:`node cli/conformance.mjs --cdp --auto-open --port 5173`
   —— 需要连着设备、App 已解锁;`--run-dapp` 才会真的调 `run(wallet)`。

## 关键约束(违反会被守卫或钱包拒)

- **SWTC 身份的账户**走 `swtc_requestAccounts`;`eth_requestAccounts` 在 SWTC 钱包上返回 `[]`(C185)。
- **签名**用 `ipfs_personalSign`(DER 签名);`personal_sign` 不在契约里,SWTC 地址上也会被拒。
- **`eth_chainId` 恒为 `0x1`**(C186),别拿它判断链;要判断就用地址前缀或 `swtc_*` 能力。
- 会动钱的方法(`swtc_sendTransaction` / `eth_sendTransaction` / `swtc_multiSign` /
  `swtc_batchTransactions`)**永远不要**在自检里跑。
- 契约只改 `contract/methods.json`,然后 `npm run gen` 让三份生成物跟上;`gen --check` 会抓漂移。
- 别把私钥/助记词写进 dApp —— 签名只在钱包里做。

## 校验清单(交付前)

```sh
node scripts/gen.mjs --check          # 生成物没漂移
node --test "test/*.test.mjs"         # 36 例
node cli/conformance.mjs --dapp <dir> # 五项全绿
node cli/calibrate.mjs --address <地址>   # 有设备时逐条校准
```
