/**
 * 示例:查一个 DID —— 只读,不弹确认、不写链。
 *
 * 约定与其他示例一致:导出 `run(wallet)`,conformance 用 Mock 钱包在 Node 里跑同一份逻辑;
 * 真实页面用钱包注入的 `window.ethereum` 调它。
 */
import { createClient } from "../../src/index.js";

/**
 * @param {{ request: Function }} wallet 钱包 provider(或 createMockWallet())
 * @param {{ did?: string }} [options] 不传就按当前 SWTC 地址推导 `did:swtc:<address>`
 */
export async function run(wallet, { did: inputDid } = {}) {
  const jdid = createClient({ wallet });

  // 1) 账户:SWTC 身份走 swtc_requestAccounts(首次会弹一次 origin 授权)
  const accounts = await jdid.connectSwtc();
  const address = accounts[0];
  const did = inputDid ?? `did:swtc:${address}`;

  // 2) 三个只读能力:拼装文档 / 解析链上文档 / 读统计
  const didDocument = await jdid.generateDidDoc({ did, version: "1.0" });
  const resolved = await jdid.resolveDid(did); // 没上链时是 null
  const stat = await jdid.didStat(did); // 有 cid 说明链上有

  return {
    address,
    did,
    // 本地拼装的文档只做展示用,不代表链上状态
    didDocumentId: didDocument?.id ?? null,
    onChain: resolved ? { created: resolved.created, updated: resolved.updated } : null,
    cid: stat?.cid ?? null,
  };
}
