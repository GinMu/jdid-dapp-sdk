/**
 * 最小示例 dApp —— 只做三件事:拿地址、读 chainId、签一条消息。
 *
 * 约定:本文件导出 `run(wallet)`,这样 conformance 能用 Mock 钱包在 Node 里跑**同一份逻辑**,
 * 不必先起模拟器。真实页面在 index.html 里用 `window.ethereum` 调它。
 */
import { createClient } from "../../src/index.js";

export async function run(wallet) {
  const jdid = createClient({ wallet });

  const accounts = await jdid.accounts();
  const chainId = await jdid.chainId();
  // 只有确实需要签名时才调:它会触发钱包的解锁/确认(needs 含 account + secret)。
  const signature = await jdid.personalSign({ message: "hello from a JDID dApp" });

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
