# JDID dApp 能力矩阵

<!-- AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。 -->

契约版本 **0.2.0** · 方法 **7** 个:
verified 7 · partial 0 · stub 0 · unknown 0

> `status` 含义见 `contract/methods.json` 的 `statusCatalog`;`needs` 里的 `confirm`/`secret`
> 就是钱包会向用户弹出的授权/确认面,`jdid-manifest.json` 必须如实声明。

| 方法 | 族 | 返回 | needs | status | 说明 |
| --- | --- | --- | --- | --- | --- |
| `swtc_requestAccounts` | swtc | `string[]` | account | **verified** | 取得 SWTC 账户(首次会触发 origin 授权,之后同一 origin 静默)。实测返回 SWTC 地址,如 ["jwWmui…"]。 |
| `eth_requestAccounts` | eth | `string[]` | account | **verified** | 取得 EVM 账户(会触发 origin 授权)。**C185 起只报 EVM 账户**:SWTC 身份下即使已授权也返回 [];SWTC 账户请用 swtc_requestAccounts。 |
| `did_requestAccountName` | did | `object` | account | **verified** | 按地址取 DID 账户名。实测返回 "Base1"。 |
| `did_getBase58PublicKey` | did | `string` | account | **verified** | 按地址取 Base58 公钥(会弹一次确认)。实测返回 {"publicKeyBase58":"xDondUJ3…","type":"EcdsaSecp256k1…"}。 |
| `did_issueCredential` | did | `object` | account, secret, confirm | **verified** | 签发凭证(需 {credential:…} 载荷,会弹确认)。实测缺载荷时返回 `Missing credential in payload`;成功路径需按凭证格式调用。 |
| `ipfs_personalSign` | ipfs | `string(signature)` | account, secret | **verified** | 对载荷签名(需 account + secret)。实测返回 DER 签名 30440220…。 |
| `ipfs_getPublicKey` | ipfs | `string` | account | **verified** | 按地址取公钥(会弹一次确认)。实测返回与 swtc_getPublicKey 相同的压缩公钥。 |

## 数据来源

- `methodEnum`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/model/DAppMethod.kt
- `dispatch`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/WebAppInterface.kt
- `protocol`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.2
- `providers`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.3
- `hostCapabilities`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.4
- `securityDebt`: kotlin-toolkits/docs/SECURITY_AUDIT.md
