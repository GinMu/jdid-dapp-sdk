// 反向证明用 fixture:manifest 只声明了 eth_accounts,却调用了 personal_sign。
// conformance 的 dapp-source 检查必须把这一项判红。
import { createClient } from "../../../src/index.js";

export async function run(wallet) {
  const jdid = createClient({ wallet });
  const accounts = await jdid.accounts();
  const signature = await jdid.personalSign({ message: "should be flagged" });
  return { accounts, signature };
}
