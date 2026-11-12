// AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。
// 改动流程:改 contract/methods.json → npm run gen → 把三份生成物一起提交。

export const CONTRACT_VERSION = "0.0.1";

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
    payload: "[]",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "取得 SWTC 账户(首次会触发 origin 授权,之后同一 origin 静默)",
    source: "providers",
  }),
  Object.freeze({
    name: "eth_requestAccounts",
    family: "eth",
    returns: "string[]",
    payload: "[]",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "取得 EVM 账户(会触发 origin 授权)",
    source: "providers",
  }),
  Object.freeze({
    name: "did_requestAccountName",
    family: "did",
    returns: "object",
    payload: "[address]",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "按地址取 DID 账户名",
    source: "dispatch",
  }),
  Object.freeze({
    name: "did_getBase58PublicKey",
    family: "did",
    returns: "string",
    payload: "[address]",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "按地址取 Base58 公钥(会弹一次确认)",
    source: "dispatch",
  }),
  Object.freeze({
    name: "did_issueCredential",
    family: "did",
    returns: "object",
    payload: "[{keyDoc:{address,did,id}, credential:{…}}]",
    needs: Object.freeze(["account","secret","confirm"]),
    status: "verified",
    note: "签发凭证载荷,会弹确认",
    source: "hostCapabilities",
  }),
  Object.freeze({
    name: "ipfs_personalSign",
    family: "ipfs",
    returns: "string(signature)",
    payload: "[[…bytes], address]",
    needs: Object.freeze(["account","secret"]),
    status: "verified",
    note: "对载荷签名",
    source: "hostCapabilities",
  }),
  Object.freeze({
    name: "ipfs_getPublicKey",
    family: "ipfs",
    returns: "string",
    payload: "[address]",
    needs: Object.freeze(["account"]),
    status: "verified",
    note: "按地址取公钥(会弹一次确认)",
    source: "dispatch",
  }),
  Object.freeze({
    name: "did_publish",
    family: "did",
    returns: "object{code,message}",
    payload: "[{address, did, didDocument}]",
    needs: Object.freeze(["account","secret","confirm","chain"]),
    status: "verified",
    note: "发布 DID 文档",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_resolve",
    family: "did",
    returns: "object or null",
    payload: "[did]",
    needs: Object.freeze([]),
    status: "verified",
    note: "解析 DID 文档",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_stat",
    family: "did",
    returns: "object",
    payload: "[did]",
    needs: Object.freeze([]),
    status: "verified",
    note: "读 DID 统计",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_generateVC",
    family: "did",
    returns: "object(VC)",
    payload: "[{address, id, types, subject}]",
    needs: Object.freeze(["account","secret","confirm"]),
    status: "verified",
    note: "生成 VC",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_verifyCredential",
    family: "did",
    returns: "object{verified,unknown,results?}",
    payload: "[credentialJsonOrObject]",
    needs: Object.freeze([]),
    status: "verified",
    note: "验证凭证(只读)",
    source: "didBridge",
  }),
  Object.freeze({
    name: "did_generateDidDoc",
    family: "did",
    returns: "object",
    payload: "[{did, version}]",
    needs: Object.freeze([]),
    status: "verified",
    note: "生成 DID 文档",
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
