// AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。
// 改动流程:改 contract/methods.json → npm run gen → 把三份生成物一起提交。

export const CONTRACT_VERSION = "0.3.0";

export const NEEDS = Object.freeze({
  ACCOUNT: "account",
  SECRET: "secret",
  CONFIRM: "confirm",
  CHAIN: "chain",
});

export const STATUS = Object.freeze({
  VERIFIED: "verified",
  PARTIAL: "partial",
  STUB: "stub",
  UNKNOWN: "unknown",
});

export const WALLET = Object.freeze({
  name: "JDID",
  nativeBridge: "_tw_",
  providerGlobals: Object.freeze(["ethereum","ccdao"]),
  envelope: Object.freeze(["name","network","id","params"]),
  responseApi: "window.ccdao.sendResponse(id, result)",
  errorApi: "window.ccdao.sendError(id, error)",
  events: Object.freeze(["_updateSelectedAddress","_updateSwtcSelectedAddress","_updateChainId"]),
  defaultChain: "swtc",
});

export const METHODS = Object.freeze([
  Object.freeze({
    name: "swtc_requestAccounts",
    family: "swtc",
    returns: "string[]",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "取得 SWTC 账户(首次会触发 origin 授权,之后同一 origin 静默)。实测返回 SWTC 地址,如 [\"jwWmui…\"]。",
    source: "providers",
  }),
  Object.freeze({
    name: "eth_requestAccounts",
    family: "eth",
    returns: "string[]",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "取得 EVM 账户(会触发 origin 授权)。**C185 起只报 EVM 账户**:SWTC 身份下即使已授权也返回 [];SWTC 账户请用 swtc_requestAccounts。",
    source: "providers",
  }),
  Object.freeze({
    name: "did_requestAccountName",
    family: "did",
    returns: "object",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "按地址取 DID 账户名。实测返回 \"Base1\"。",
    source: "dispatch",
  }),
  Object.freeze({
    name: "did_getBase58PublicKey",
    family: "did",
    returns: "string",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "按地址取 Base58 公钥(会弹一次确认)。实测返回 {\"publicKeyBase58\":\"xDondUJ3…\",\"type\":\"EcdsaSecp256k1…\"}。",
    source: "dispatch",
  }),
  Object.freeze({
    name: "did_issueCredential",
    family: "did",
    returns: "object",
    needs: Object.freeze(["account","secret","confirm"]),
    status: "verified",
    note: "签发凭证(需 {credential:…} 载荷,会弹确认)。实测缺载荷时返回 `Missing credential in payload`;成功路径需按凭证格式调用。",
    source: "hostCapabilities",
  }),
  Object.freeze({
    name: "ipfs_personalSign",
    family: "ipfs",
    returns: "string(signature)",
    needs: Object.freeze(["account","secret"]),
    status: "verified",
    note: "对载荷签名(需 account + secret)。实测返回 DER 签名 30440220…。",
    source: "hostCapabilities",
  }),
  Object.freeze({
    name: "ipfs_getPublicKey",
    family: "ipfs",
    returns: "string",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "按地址取公钥(会弹一次确认)。实测返回与 swtc_getPublicKey 相同的压缩公钥。",
    source: "dispatch",
  }),
  Object.freeze({
    name: "did_publish",
    family: "did",
    returns: "object{code,message}",
    needs: Object.freeze(["account","secret","confirm"]),
    status: "partial",
    note: "发布 DID 文档。私钥由钱包按 address 取(页面**不能**传 privateKey);必须经宿主确认,无回调即拒。实测(2026-11-09)可调用(缺 address 时钱包报 `Missing address`),写链成功路径未验证。",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_resolve",
    family: "did",
    returns: "object or null",
    needs: Object.freeze([]),
    status: "verified",
    note: "解析 DID 文档;不存在时返回 null。不落库。实测(2026-11-09)对该 SWTC 地址返回 null(未上链),调用路径正常。",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_stat",
    family: "did",
    returns: "object",
    needs: Object.freeze([]),
    status: "partial",
    note: "读 DID 统计。实测(2026-11-09)已路由到钱包,但该 DID 的 stat 解析失败(`no link named \"b2\" under bafybei…`);需要有链上 stat 的 DID 再验。",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_generateVC",
    family: "did",
    returns: "object(VC)",
    needs: Object.freeze(["account","secret","confirm"]),
    status: "partial",
    note: "生成 VC。私钥由钱包按 address 取;必须经宿主确认,无回调即拒。实测(2026-11-09)可调用(缺 address 时钱包报 `Missing address`),签发成功路径未验证。",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_verifyCredential",
    family: "did",
    returns: "object{verified,unknown,results?}",
    needs: Object.freeze([]),
    status: "verified",
    note: "验证凭证(只读)。参数是凭证 JSON 字符串或对象。实测(2026-11-09)返回 {\"verified\":false,\"unknown\":false,\"results\":\"[]\"}。",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_generateDidDoc",
    family: "did",
    returns: "object",
    needs: Object.freeze([]),
    status: "verified",
    note: "生成 DID 文档(纯拼装,不需要私钥)。实测(2026-11-09,emulator-5554,SWTC 身份)239ms 返回带 @context/id/created/updated 的文档对象。",
    source: "didBridge",
  }),
]);

export const METHOD_NAMES = Object.freeze(METHODS.map((m) => m.name));

export const METHOD_INDEX = Object.freeze(
  Object.fromEntries(METHODS.map((m) => [m.name, m])),
);

export function isKnownMethod(name) {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(METHOD_INDEX, name);
}

export function methodsRequiring(need) {
  return METHODS.filter((m) => m.needs.includes(need));
}
