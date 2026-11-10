/**
 * 最小示例 dApp —— 只做契约里的四件事:拿 SWTC 账户、读 DID 名字、读 Base58 公钥、签一条载荷。
 *
 * 约定:本文件导出 `run(wallet)`,这样 conformance 能用 Mock 钱包在 Node 里跑**同一份逻辑**,
 * 不必先起模拟器。真实页面在 index.html 里用 `window.ethereum` 调它。
 */
import { createClient } from "../../src/index.js";

export async function run(wallet) {
  const jdid = createClient({ wallet });

  // 1) 拿账户:SWTC 身份走 swtc_requestAccounts(首次会弹一次 origin 授权)。
  const accounts = await jdid.connectSwtc();
  const address = accounts[0];

  // 2) 两个只读 DID 能力(第二个会弹一次确认)。
  const name = await jdid.requestAccountName(address);
  const base58PublicKey = await jdid.base58PublicKey(address);

  // 3) 签一条载荷(DER 签名;会弹确认,不要在这里放真实业务载荷之外的东西)。
  const signature = await jdid.ipfsSign({ data: [104, 101, 108, 108, 111], address });

  // 4) DID bridge 的两个**只读**能力(不弹确认、不写链):
  //    先按地址拼 DID,再让钱包拼装文档并把解析结果读回来。
  const did = `did:swtc:${address}`;
  const didDocument = await jdid.generateDidDoc({ did, version: "1.0" });
  const resolved = await jdid.resolveDid(did);

  return {
    accounts,
    name,
    base58PublicKey,
    ipfsPublicKey: await jdid.ipfsPublicKey(address),
    signature,
    did,
    didDocumentId: didDocument?.id ?? null,
    resolved,
    // 让作者一眼看到"这个 dApp 会向用户要哪些权限"。
    promptSurface: jdid.permissions().filter((p) => p.needs.includes("secret") || p.needs.includes("confirm")),
  };
}
