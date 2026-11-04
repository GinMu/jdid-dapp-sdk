# JDID dApp 能力矩阵

<!-- AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。 -->

契约版本 **0.1.0** · 方法 **28** 个:
verified 3 · partial 21 · stub 2 · unknown 2

> `status` 含义见 `contract/methods.json` 的 `statusCatalog`;`needs` 里的 `confirm`/`secret`
> 就是钱包会向用户弹出的授权/确认面,`jdid-manifest.json` 必须如实声明。

| 方法 | 族 | 返回 | needs | status | 说明 |
| --- | --- | --- | --- | --- | --- |
| `swtc_requestAccounts` | swtc | `string[]` | account | **partial** | 未授权时直接 `User rejected the requestAccounts request`;授权后返回 SWTC 地址(实测 OK,2026-11-04) |
| `swtc_sendTransaction` | swtc | `object(txHash)` | account, secret, chain, confirm | **partial** | Android 确认路径已收敛(C183);iOS 未 fail-closed(C154,跨仓阻塞) |
| `swtc_multiSign` | swtc | `object` | account, secret, confirm | **partial** | 同 swtc_sendTransaction 的 iOS 确认缺口 |
| `swtc_signMessage` | swtc | `string(signature)` | account, secret | **partial** | 实测成功:约 23s(含用户确认),返回 DER 签名 3045022100…(2026-11-04 真机) |
| `swtc_getPublicKey` | swtc | `string` | account | **partial** | 实测会触发用户确认(25s 超时未点),属需确认路径;未见失败语义(2026-11-04 真机) |
| `swtc_batchTransactions` | swtc | `object` | account, secret, chain, confirm | **partial** | 同 swtc_sendTransaction 的 iOS 确认缺口 |
| `swtc_requestNfts` | swtc | `object{address,total,nfts}` | account | **partial** | 实测返回 {"address":"","total":0,"nfts":[]}(该身份无 NFT;2026-11-04 真机) |
| `eth_accounts` | eth | `string[]` | account | **partial** | M-R7:未授权 origin 不注入 selectedAddress,未授权时恒为 [];授权后实测返回 ["jwWmuiN6B1KjNJjH6f8cFxeY83UpjSMRWq"](2026-11-04 真机) |
| `eth_requestAccounts` | eth | `string[]` | account | **partial** | 触发 origin 授权(M-06/M-R7);授权一次后静默,实测返回 ["jwWmui…"](2026-11-04 真机) |
| `eth_chainId` | eth | `string(hex)` | — | **partial** | provider JS 默认 chainId=0x1 且原生不推送 _updateChainId(实测返回 0x1)→ **不能**用它判断真实链;SWTC 场景按地址/`swtc_*` 判断 |
| `eth_blockNumber` | eth | `string(hex)` | — | **stub** | NodeProvider 为 stub,实测返回 "0x0"(2026-11-04 真机) |
| `personal_sign` | eth | `string(signature)` | account, secret | **partial** | SWTC 地址上报 `Address is not an EVM address: jwW…`(2026-11-04 真机)→ SWTC 场景请用 swtc_signMessage |
| `personal_ecRecover` | eth | `string` | — | **verified** | 实测:占位参数被拒(`Cannot convert string to buffer`),需真实签名+地址(2026-11-04 真机) |
| `eth_signTypedData` | eth | `string(signature)` | account, secret | **partial** | 无 origin 授权决策 |
| `eth_signTypedData_v3` | eth | `string(signature)` | account, secret | **partial** | 同 eth_signTypedData(无 origin 授权决策) |
| `eth_signTypedData_v4` | eth | `string(signature)` | account, secret | **partial** | 同 eth_signTypedData(无 origin 授权决策) |
| `eth_sendTransaction` | eth | `string(txHash)` | account, secret, chain, confirm | **partial** | NodeProvider 广播未实现;iOS 无确认闸门(C154) |
| `eth_signTransaction` | eth | `string` | account, secret | **partial** | 只签名不出网;但无 origin 授权决策 |
| `eth_getEncryptionPublicKey` | eth | `string` | account, secret | **unknown** | SWTC 地址上报 `Address is not an EVM address`(2026-11-04 真机);需 EVM 地址 |
| `eth_decrypt` | eth | `string` | account, secret | **unknown** | SWTC 地址上报 `Address is not an EVM address`(2026-11-04 真机);需 EVM 地址 |
| `eth_requestNfts` | eth | `object{address,total,nfts}` | — | **stub** | 实测返回 {"address":"","total":0,"nfts":[]}(**对象**不是数组;2026-11-04 真机) |
| `wallet_switchEthereumChain` | wallet | `null` | chain | **partial** | EVM 链切换 UX 与 initJs 均未落地(有意关闭) |
| `did_requestAccountName` | did | `object` | account | **verified** | 实测返回 "Base1"(2026-11-04 真机) |
| `did_getBase58PublicKey` | did | `string` | account | **partial** | 实测会触发用户确认(25s 超时未点)(2026-11-04 真机) |
| `did_issueCredential` | did | `object` | account, secret, confirm | **partial** | 实测 `Missing credential in payload`(需 {credential:…});成功路径未验证(2026-11-04 真机) |
| `ipfs_personalSign` | ipfs | `string(signature)` | account, secret | **partial** | 实测成功(13ms),返回 DER 签名 30440220…;审计仍记录无载荷确认,接入前自行确认待签内容(2026-11-04 真机) |
| `ipfs_getPublicKey` | ipfs | `string` | account | **partial** | 实测会触发用户确认(25s 超时未点)(2026-11-04 真机) |
| `web3_clientVersion` | web3 | `string` | — | **verified** | 2026-11-04 真机实测返回 `CCDAO/v1.0.0`(provider JS 常量) |

## 数据来源

- `methodEnum`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/model/DAppMethod.kt
- `dispatch`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/WebAppInterface.kt
- `protocol`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.2
- `providers`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.3
- `hostCapabilities`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.4
- `securityDebt`: kotlin-toolkits/docs/SECURITY_AUDIT.md
