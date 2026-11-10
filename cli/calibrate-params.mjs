/**
 * 校准用的"无害占位参数"。
 *
 * 单独成模块(不 import 设备相关代码)是为了能在单测里直接断言:
 * 参数给错时校准会把"方法不可用"误报成失败,所以这份表本身值得被钉住。
 *
 * 约定:
 * - 需要地址的方法一律用 `--address` 传入的真实地址;
 * - DID bridge 的方法由地址推导 DID(`0x…` → `did:ethr:`,其它 → `did:swtc:`);
 * - `did_publish` / `did_generateVC` 只给空对象:**只验路由**(走到钱包的参数校验),
 *   不写链、也不触发宿主确认弹窗。
 */

/** 地址 → DID(与钱包 resolveDidRuntime 的前缀约定一致)。 */
export function didFor(address) {
  if (!address) return "did:swtc:";
  return address.startsWith("0x") ? `did:ethr:${address}` : `did:swtc:${address}`;
}

const NEEDS_ADDRESS = new Set([
  "swtc_getPublicKey",
  "did_requestAccountName",
  "did_getBase58PublicKey",
  "ipfs_getPublicKey",
  "eth_getEncryptionPublicKey",
]);

/** @returns {unknown[]} 该方法的占位参数 */
export function paramsFor(method, address) {
  const did = didFor(address);
  const paramsByMethod = {
    personal_sign: ["0x68656c6c6f", address],
    swtc_signMessage: [address, "hello"],
    personal_ecRecover: ["0x00", address],
    did_issueCredential: [{ keyDoc: { address } }],
    ipfs_personalSign: [[1, 2, 3], address],
    eth_decrypt: ["0x00", address],
    // DID bridge:只读的三个用真实 DID
    did_generateDidDoc: [{ did, version: "1.0" }],
    did_resolve: [did],
    did_stat: [did],
    did_verifyCredential: [JSON.stringify({ id: `${did}#vc-1` })],
    // 写链/签发的两个:只验路由,不产生副作用
    did_publish: [{}],
    did_generateVC: [{}],
  };
  if (Object.prototype.hasOwnProperty.call(paramsByMethod, method)) return paramsByMethod[method];
  return NEEDS_ADDRESS.has(method) ? [address] : [];
}
