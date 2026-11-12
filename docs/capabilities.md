# JDID dApp 能力矩阵

<!-- AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。 -->

契约版本 **0.0.2** · 方法 **13** 个:
verified 13 · partial 0 · stub 0 · unknown 0

> `status` 含义见 `contract/methods.json` 的 `statusCatalog`;`needs` 里的 `confirm`/`secret`
> 就是钱包会向用户弹出的授权/确认面,`jdid-manifest.json` 必须如实声明。

| 方法 | 族 | 载荷 | 返回 | needs | status | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `swtc_requestAccounts` | swtc | `[]` | `string[]` | account | **verified** | 取得 SWTC 账户(首次会触发 origin 授权,之后同一 origin 静默) |
| `eth_requestAccounts` | eth | `[]` | `string[]` | account | **verified** | 取得 EVM 账户(会触发 origin 授权) |
| `did_requestAccountName` | did | `[address]` | `object` | account | **verified** | 按地址取 DID 账户名 |
| `did_getBase58PublicKey` | did | `[address]` | `string` | account | **verified** | 按地址取 Base58 公钥(会弹一次确认) |
| `did_issueCredential` | did | `[{keyDoc:{address,did,id}, credential:{…}}]` | `object` | account, secret, confirm | **verified** | 签发凭证载荷,会弹确认 |
| `ipfs_personalSign` | ipfs | `[[…bytes], address]` | `string(signature)` | account, secret | **verified** | 对载荷签名 |
| `ipfs_getPublicKey` | ipfs | `[address]` | `string` | account | **verified** | 按地址取公钥(会弹一次确认) |
| `did_publish` | did | `[{address, did, didDocument}]` | `object{code,message}` | account, secret, confirm, chain | **verified** | 发布 DID 文档 |
| `did_resolve` | did | `[did]` | `object or null` | — | **verified** | 解析 DID 文档 |
| `did_stat` | did | `[did]` | `object` | — | **verified** | 读 DID 统计 |
| `did_generateVC` | did | `[{address, id, types, subject}]` | `object(VC)` | account, secret, confirm | **verified** | 生成 VC |
| `did_verifyCredential` | did | `[credentialJsonOrObject]` | `object{verified,unknown,results?}` | — | **verified** | 验证凭证(只读) |
| `did_generateDidDoc` | did | `[{did, version}]` | `object` | — | **verified** | 生成 DID 文档 |

## 数据来源

- `methodEnum`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/model/DAppMethod.kt
- `dispatch`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/WebAppInterface.kt
- `protocol`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.2
- `providers`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.3
- `hostCapabilities`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.4
- `securityDebt`: kotlin-toolkits/docs/SECURITY_AUDIT.md
- `didBridge`: kotlin-toolkits/webview-bridge/src/main/assets/did-bridge.js(publishDid / didResolve / didStat / generateVC / verifyCredential / generateDidDoc);Android 经 DidSdk、iOS 经 SwiftDid 转发,宿主注入私钥
