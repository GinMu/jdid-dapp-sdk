// 反向证明用 fixture:manifest 只声明了 swtc_requestAccounts,却调用了 did_getBase58PublicKey。
// conformance 的 dapp-source 检查必须把这一项判红。
import { createClient } from "../../../src/index.js";

export async function run(wallet) {
  const jdid = createClient({ wallet });
  const accounts = await jdid.connectSwtc();
  const base58PublicKey = await jdid.base58PublicKey(accounts[0]);
  return { accounts, base58PublicKey };
}
