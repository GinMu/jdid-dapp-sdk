# JDID dApp 能力矩阵

<!-- AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。 -->

契约版本 **0.3.0** · 方法 **13** 个:
verified 10 · partial 3 · stub 0 · unknown 0

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
| `did_publish` | did | `object{code,message}` | account, secret, confirm | **partial** | 发布 DID 文档。私钥由钱包按 address 取(页面**不能**传 privateKey);必须经宿主确认,无回调即拒。实测(2026-11-09)可调用(缺 address 时钱包报 `Missing address`),写链成功路径未验证。 |
| `did_resolve` | did | `object or null` | — | **verified** | 解析 DID 文档;不存在时返回 null。不落库。实测(2026-11-09)对该 SWTC 地址返回 null(未上链),调用路径正常。 |
| `did_stat` | did | `object` | — | **partial** | 读 DID 统计。实测(2026-11-09)已路由到钱包,但该 DID 的 stat 解析失败(`no link named "b2" under bafybei…`);需要有链上 stat 的 DID 再验。 |
| `did_generateVC` | did | `object(VC)` | account, secret, confirm | **partial** | 生成 VC。私钥由钱包按 address 取;必须经宿主确认,无回调即拒。实测(2026-11-09)可调用(缺 address 时钱包报 `Missing address`),签发成功路径未验证。 |
| `did_verifyCredential` | did | `object{verified,unknown,results?}` | — | **verified** | 验证凭证(只读)。参数是凭证 JSON 字符串或对象。实测(2026-11-09)返回 {"verified":false,"unknown":false,"results":"[]"}。 |
| `did_generateDidDoc` | did | `object` | — | **verified** | 生成 DID 文档(纯拼装,不需要私钥)。实测(2026-11-09,emulator-5554,SWTC 身份)239ms 返回带 @context/id/created/updated 的文档对象。 |

## 数据来源

- `methodEnum`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/model/DAppMethod.kt
- `dispatch`: kotlin-toolkits/dapp-connect/src/main/java/com/jccdex/toolkits/dappconnect/WebAppInterface.kt
- `protocol`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.2
- `providers`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.3
- `hostCapabilities`: jdid-multi-platform/docs/dapp-webview-bridge-audit.md §2.4
- `securityDebt`: kotlin-toolkits/docs/SECURITY_AUDIT.md
- `didBridge`: kotlin-toolkits/webview-bridge/src/main/assets/did-bridge.js(publishDid / didResolve / didStat / generateVC / verifyCredential / generateDidDoc);Android 经 DidSdk、iOS 经 SwiftDid 转发,宿主注入私钥
