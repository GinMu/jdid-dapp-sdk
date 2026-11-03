# JDID dApp 能力矩阵

<!-- AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。 -->

契约版本 **0.1.0** · 方法 **28** 个:
verified 5 · partial 16 · stub 2 · unknown 5

> `status` 含义见 `contract/methods.json` 的 `statusCatalog`;`needs` 里的 `confirm`/`secret`
> 就是钱包会向用户弹出的授权/确认面,`jdid-manifest.json` 必须如实声明。

| 方法 | 族 | 返回 | needs | status | 说明 |
| --- | --- | --- | --- | --- | --- |
| `swtc_requestAccounts` | swtc | `string[]` | account | **partial** | 仅注入当前地址;setCurrentAccount/currentAccount 为空实现 |
| `swtc_sendTransaction` | swtc | `object(txHash)` | account, secret, chain, confirm | **partial** | Android 确认路径已收敛(C183);iOS 未 fail-closed(C154,跨仓阻塞) |
| `swtc_multiSign` | swtc | `object` | account, secret, confirm | **partial** | 同 swtc_sendTransaction 的 iOS 确认缺口 |
| `swtc_signMessage` | swtc | `string(signature)` | account, secret | **partial** | origin 已透传给 SecretProvider,但不做授权决策 |
| `swtc_getPublicKey` | swtc | `string` | account | **verified** | — |
| `swtc_batchTransactions` | swtc | `object` | account, secret, chain, confirm | **partial** | 同 swtc_sendTransaction 的 iOS 确认缺口 |
| `swtc_requestNfts` | swtc | `array` | account | **verified** | SWTC NFT 走平台库(IosNftMetaStore / Android NFT store) |
| `eth_accounts` | eth | `string[]` | account | **partial** | 只回当前地址,不提供账户列表选择 |
| `eth_requestAccounts` | eth | `string[]` | account | **partial** | 同上;无按 origin 的账户授权台账 |
| `eth_chainId` | eth | `string(hex)` | — | **verified** | initialChain = SWTC;不注入 initJs 以免 DApp 误判 EVM 链 |
| `eth_blockNumber` | eth | `string(hex)` | — | **stub** | NodeProvider 为 stub,多数方法返回 "0x0" |
| `personal_sign` | eth | `string(signature)` | account, secret | **partial** | 无 origin 授权决策 |
| `personal_ecRecover` | eth | `string` | — | **verified** | — |
| `eth_signTypedData` | eth | `string(signature)` | account, secret | **partial** | 无 origin 授权决策 |
| `eth_signTypedData_v3` | eth | `string(signature)` | account, secret | **partial** | 同 eth_signTypedData(无 origin 授权决策) |
| `eth_signTypedData_v4` | eth | `string(signature)` | account, secret | **partial** | 同 eth_signTypedData(无 origin 授权决策) |
| `eth_sendTransaction` | eth | `string(txHash)` | account, secret, chain, confirm | **partial** | NodeProvider 广播未实现;iOS 无确认闸门(C154) |
| `eth_signTransaction` | eth | `string` | account, secret | **partial** | 只签名不出网;但无 origin 授权决策 |
| `eth_getEncryptionPublicKey` | eth | `string` | account, secret | **unknown** | 本仓 conformance 未覆盖 |
| `eth_decrypt` | eth | `string` | account, secret | **unknown** | 本仓 conformance 未覆盖 |
| `eth_requestNfts` | eth | `array` | — | **stub** | getEvmNfts 恒返回空 |
| `wallet_switchEthereumChain` | wallet | `null` | chain | **partial** | EVM 链切换 UX 与 initJs 均未落地(有意关闭) |
| `did_requestAccountName` | did | `object` | account | **unknown** | 本仓 conformance 未覆盖 |
| `did_getBase58PublicKey` | did | `string` | account | **unknown** | 本仓 conformance 未覆盖 |
| `did_issueCredential` | did | `object` | account, secret, confirm | **partial** | H-DID1 宿主确认回调;未绑定即拒签的语义只在 Android 成立(C154) |
| `ipfs_personalSign` | ipfs | `string(signature)` | account, secret | **partial** | 无载荷确认(审计「第五轮·有意未新开」);接入前请自行确认待签内容 |
| `ipfs_getPublicKey` | ipfs | `string` | account | **unknown** | 本仓 conformance 未覆盖 |
| `web3_clientVersion` | web3 | `string` | — | **verified** | — |

## 数据来源

- `methodEnum`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/model/DAppMethod.kt
- `dispatch`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/WebAppInterface.kt
- `protocol`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.2
- `providers`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.3
- `hostCapabilities`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.4
- `securityDebt`: kotlin-toolkits/docs/SECURITY_AUDIT.md
