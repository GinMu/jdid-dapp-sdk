/**
 * Mock 钱包 —— 只给测试、示例与 conformance 用。
 *
 * 明确不是链上实现:返回值是**桩值**(地址/签名/chainId 都是假的),只为让 dApp 的
 * 调用链在 Node 里跑通、让 conformance 能断言"发出了哪些方法、参数长什么样"。
 * 真机行为以 JDID App 注入的 provider 为准。
 */
import { METHOD_INDEX, isKnownMethod } from "./methods.js";

/** 明显是假值的桩数据:任何把它当真地址/真签名的代码都该被判为 bug。 */
export const MOCK_RESULTS = Object.freeze({
  // 与契约(contract/methods.json,7 条)一一对应;新增方法时先改契约再补这里。
  eth_requestAccounts: Object.freeze(["0x000000000000000000000000000000000000dEaD"]),
  swtc_requestAccounts: Object.freeze(["jMOCKswtcAddressForTestingOnly1111111111"]),
  did_requestAccountName: Object.freeze({ name: "MOCK-NAME" }),
  did_getBase58PublicKey: "MOCK-BASE58-KEY",
  did_issueCredential: Object.freeze({ vc: "MOCK-VC" }),
  ipfs_personalSign: "0xMOCKSIGNATURE",
  ipfs_getPublicKey: "MOCK-PUBLIC-KEY",
  // DID bridge(6):只给能跑通 smoke 的桩值
  did_publish: Object.freeze({ code: "0", message: "success" }),
  did_resolve: Object.freeze({ id: "did:swtc:MOCK" }),
  did_stat: Object.freeze({ cid: "MOCK-CID" }),
  did_generateVC: Object.freeze({ id: "MOCK-VC" }),
  did_verifyCredential: Object.freeze({ verified: false }),
  did_generateDidDoc: Object.freeze({ id: "did:swtc:MOCK" }),
});

const clone = (value) =>
  typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));

/**
 * @param {{ results?: Record<string, unknown>, failOn?: string[], latencyMs?: number }} [options]
 */
export function createMockWallet({ results = {}, failOn = [], latencyMs = 0 } = {}) {
  /** @type {{ method: string, params: unknown }[]} */
  const calls = [];
  const listeners = new Map();
  const table = { ...MOCK_RESULTS, ...results };
  const failures = new Set(failOn);

  const wallet = {
    /** 本次会话里 dApp 发出过的全部调用(conformance 与测试的主要断言对象)。 */
    calls,
    reset() {
      calls.length = 0;
    },
    async request({ method, params } = {}) {
      calls.push({ method, params });
      if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
      if (!isKnownMethod(method)) {
        const error = new Error(`mock 未声明的方法:${method}`);
        error.code = -32601;
        throw error;
      }
      if (failures.has(method)) {
        const error = new Error(`mock 按 failOn 拒绝:${method}`);
        error.code = 4001;
        throw error;
      }
      if (Object.prototype.hasOwnProperty.call(table, method)) return clone(table[method]);
      // 契约里有、mock 没给桩值的方法:返回 null,并在 meta 里能看出它属于哪一类
      return METHOD_INDEX[method] ? null : null;
    },
    on(event, listener) {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
    },
    removeListener(event, listener) {
      const list = listeners.get(event) ?? [];
      listeners.set(
        event,
        list.filter((it) => it !== listener),
      );
    },
    emit(event, ...args) {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
    /** 发出的方法名(去重,保持首次出现顺序)。 */
    methodsCalled() {
      return [...new Set(calls.map((c) => c.method))];
    },
  };
  return wallet;
}
