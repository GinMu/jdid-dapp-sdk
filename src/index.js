/**
 * JDID dApp SDK —— 最小骨架(契约驱动的 typed 客户端)
 *
 * 职责边界(重要):
 *   - **运行时**仍是钱包注入的 `window.ethereum` / `window.ccdao`(`kotlin-toolkits` 的
 *     `ccdao-eip1193-provider.js`);本 SDK **不改运行时、不签名、不持有私钥**。
 *   - 本 SDK 只做三件事:①方法白名单校验(只允许契约里的名字);②把 EIP-1193 调用封装成
 *     typed helper;③把 `_tw_` 线格式(见 contract/methods.json 的 wallet.envelope)实现成
 *     可直接测试的 transport,供 conformance 与宿主自测使用。
 *
 * 安全约定:
 *   - 不往 JS 侧塞私钥/助记词;`secret` 类方法由钱包自己弹解锁/确认。
 *   - `needs` 含 `confirm` 的方法,`requiresConfirmation()` 返回 true;dApp 不应假设"一定放行"。
 */
import {
  CONTRACT_VERSION,
  METHOD_INDEX,
  METHOD_NAMES,
  METHODS,
  NEEDS,
  STATUS,
  WALLET,
  isKnownMethod,
  methodsRequiring,
} from "./methods.js";

export {
  CONTRACT_VERSION,
  METHOD_INDEX,
  METHOD_NAMES,
  METHODS,
  NEEDS,
  STATUS,
  WALLET,
  isKnownMethod,
  methodsRequiring,
};

export const DEFAULT_TIMEOUT_MS = 20_000;

export class JdidDappError extends Error {
  constructor(message, { code = "jdid_dapp_error", cause } = {}) {
    super(message);
    this.name = "JdidDappError";
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

/** 钱包只在 JDID 的 WebView 里注入 provider;在普通浏览器里应当明确报错,而不是静默失败。 */
export function resolveInjectedWallet(scope = globalThis) {
  const candidates = WALLET.providerGlobals ?? ["ethereum", "ccdao"];
  for (const key of candidates) {
    const value = scope?.[key];
    if (value && typeof value.request === "function") return value;
  }
  return undefined;
}

function unrefTimer(timer) {
  if (timer && typeof timer.unref === "function") timer.unref();
  return timer;
}

function withTimeout(promise, ms, label) {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = unrefTimer(
      setTimeout(() => {
        reject(new JdidDappError(`${label} 超时(${ms}ms):钱包没有响应(可能未解锁/未注入)`, { code: "timeout" }));
      }, ms),
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeError(error, label) {
  if (error instanceof JdidDappError) return error;
  const message = error && typeof error.message === "string" ? error.message : String(error);
  const code = error && error.code !== undefined ? `(钱包 code ${error.code})` : "";
  return new JdidDappError(`${label} 失败${code}:${message}`, { code: "wallet_rejected", cause: error });
}

function assertKnown(name) {
  if (!isKnownMethod(name)) {
    throw new JdidDappError(
      `未知方法 ${JSON.stringify(name)}:本 SDK 只允许契约里的 ${METHOD_NAMES.length} 个方法(见 contract/methods.json)`,
      { code: "unknown_method" },
    );
  }
}

/**
 * 创建 dApp 客户端。
 * @param {{ wallet?: {request: Function, on?: Function}, timeoutMs?: number }} [options]
 */
export function createClient(options = {}) {
  const wallet = options.wallet ?? resolveInjectedWallet();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!wallet || typeof wallet.request !== "function") {
    throw new JdidDappError(
      "找不到 JDID 钱包 provider(window.ethereum 缺失):请从 JDID App 的 Explore/DApp 页打开本页,而不是普通浏览器",
      { code: "wallet_missing" },
    );
  }

  async function request(name, params = []) {
    assertKnown(name);
    try {
      return await withTimeout(Promise.resolve(wallet.request({ method: name, params })), timeoutMs, name);
    } catch (error) {
      throw normalizeError(error, name);
    }
  }

  const client = {
    wallet,
    request,
    /** 取得 EVM 账户(EIP-1193 connect,会触发 origin 授权)。SWTC 身份下返回 [],请用 connectSwtc。 */
    connect: () => request("eth_requestAccounts"),
    /** 取得 SWTC 账户(首次触发 origin 授权,之后同一 origin 静默)。 */
    connectSwtc: () => request("swtc_requestAccounts"),
    /** 按地址取 DID 账户名。 */
    requestAccountName: (address) => request("did_requestAccountName", [address]),
    /** 按地址取 Base58 公钥(会弹一次确认)。 */
    base58PublicKey: (address) => request("did_getBase58PublicKey", [address]),
    /** 签发凭证(需 { credential: … } 载荷,会弹确认)。 */
    issueCredential: (payload) => request("did_issueCredential", [payload]),
    /** 对载荷签名(需 account + secret),参数顺序 [data, address]。 */
    ipfsSign: ({ data, address }) => request("ipfs_personalSign", [data, address]),
    /** 按地址取公钥(会弹一次确认)。 */
    ipfsPublicKey: (address) => request("ipfs_getPublicKey", [address]),
    // ── DID bridge 能力(6 个)──
    // 私钥一律由钱包按 address 取,页面永远不传 privateKey;
    // did_publish / did_generateVC 会弹宿主确认,没有确认回调时钱包直接拒绝。
    /** 发布 DID 文档(需钱包确认,会写链)。 */
    publishDid: ({ did, didDocument, address }) => request("did_publish", [{ did, didDocument, address }]),
    /** 解析 DID 文档;不存在返回 null。 */
    resolveDid: (did) => request("did_resolve", [did]),
    /** 读 DID 统计。 */
    didStat: (did) => request("did_stat", [did]),
    /** 生成 VC(需钱包确认)。 */
    generateVC: (payload) => request("did_generateVC", [payload]),
    /** 验证凭证(只读)。 */
    verifyCredential: (credential) => request("did_verifyCredential", [credential]),
    /** 生成 DID 文档(纯拼装)。 */
    generateDidDoc: (payload) => request("did_generateDidDoc", [payload]),
    /** 本 dApp 会碰到的授权面(给 manifest 与权限提示用)。 */
    permissions: () => METHODS.map((m) => ({ name: m.name, needs: m.needs, status: m.status })),
    requiresConfirmation: (name) => isKnownMethod(name) && METHOD_INDEX[name].needs.includes(NEEDS.CONFIRM),
    on: (event, listener) => {
      if (typeof wallet.on !== "function") {
        throw new JdidDappError("当前钱包 provider 不支持事件订阅", { code: "wallet_rejected" });
      }
      wallet.on(event, listener);
      return () => {
        if (typeof wallet.removeListener === "function") wallet.removeListener(event, listener);
      };
    },
  };
  return Object.freeze(client);
}

/**
 * `_tw_` 原生桥 transport —— 实现 contract 里记录的线格式:
 *
 *   dApp → Native : window._tw_.postMessage(JSON.stringify({ name, network, id, params }))
 *   Native → dApp : window.ccdao.sendResponse(id, result) / window.ccdao.sendError(id, error)
 *
 * 只在没有 EIP-1193 provider 的宿主(或测试)里使用;有 `window.ethereum` 时优先用 createClient。
 */
export function createNativeTransport({ postMessage, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof postMessage !== "function") {
    throw new JdidDappError("createNativeTransport 需要 postMessage(payload)", { code: "jdid_dapp_error" });
  }
  let seq = 0;
  const pending = new Map();

  /** 取出并移除一个待响应请求(响应/错误/超时都只允许结算一次)。 */
  function take(id) {
    const key = String(id);
    const entry = pending.get(key);
    if (!entry) return undefined;
    pending.delete(key);
    return entry;
  }

  return {
    request(name, params = [], { network = WALLET.defaultChain } = {}) {
      if (!isKnownMethod(name)) {
        return Promise.reject(new JdidDappError(`未知方法 ${JSON.stringify(name)}`, { code: "unknown_method" }));
      }
      const id = String(++seq);
      const envelope = { name, network, id, params };
      return new Promise((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        const timer = unrefTimer(
          setTimeout(() => {
            take(id);
            reject(new JdidDappError(`${name} 超时(${timeoutMs}ms)`, { code: "timeout" }));
          }, timeoutMs),
        );
        try {
          postMessage(JSON.stringify(envelope));
        } catch (error) {
          take(id);
          clearTimeout(timer);
          reject(
            new JdidDappError(`postMessage 失败:${error?.message ?? error}`, { code: "wallet_rejected", cause: error }),
          );
        }
      });
    },
    handleResponse(id, result) {
      const entry = take(id);
      if (!entry) return false;
      entry.resolve(result);
      return true;
    },
    handleError(id, error) {
      const entry = take(id);
      if (!entry) return false;
      entry.reject(normalizeError(error, `native#${String(id)}`));
      return true;
    },
    get pendingCount() {
      return pending.size;
    },
  };
}
