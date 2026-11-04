/**
 * 最小示例 dApp —— 只做三件事:拿地址、读 chainId、签一条消息。
 *
 * 约定:本文件导出 `run(wallet)`,这样 conformance 能用 Mock 钱包在 Node 里跑**同一份逻辑**,
 * 不必先起模拟器。真实页面在 index.html 里用 `window.ethereum` 调它。
 */
import { createClient } from "../../src/index.js";

export async function run(wallet) {
  const jdid = createClient({ wallet });

  // 先按 EVM 语义授权拿地址;未授权 origin 时 eth_accounts 恒为空(M-R7)。
  let accounts = await jdid.connect();
  const chainId = await jdid.chainId();
  // C185:SWTC 钱包的 eth_accounts/eth_requestAccounts 只报 EVM 账户(空数组),
  // 账户与签名都要改走 swtc_* —— 这里演示两个通路的写法。
  let signature;
  if (accounts.length === 0) {
    accounts = await jdid.connectSwtc();
    signature = await jdid.swtcSignMessage({ from: accounts[0], data: "hello from a JDID dApp" });
  } else {
    // 只有确实需要签名时才调:它会触发钱包的解锁/确认(needs 含 account + secret)。
    signature = await jdid.personalSign({ message: "hello from a JDID dApp" });
  }

  return {
    accounts,
    chainId,
    signature,
    // 让作者一眼看到"这个 dApp 会向用户要哪些权限"。
    promptSurface: jdid
      .permissions()
      .filter((p) => p.needs.includes("secret") || p.needs.includes("confirm")),
  };
}
