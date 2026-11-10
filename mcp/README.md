# `jdid-wallet-mcp` —— 让 agent 自己驱动 JDID 钱包

一个**零依赖**的 MCP server(stdio,每行一个 JSON-RPC):把"装/开/调/看/截"这套真机操作暴露成工具,
agent 就能自己完成"改 dApp → 打开 → 调 provider → 看日志"的闭环,不用人手动点手机。

底层复用本仓已有的 `cli/cdp.mjs`(WebView CDP)与 `cli/device-ui.mjs`(uiautomator)。

## 启动与注册

```sh
node mcp/server.mjs          # 或 npm run mcp
```

在 MCP 客户端里注册(以 DeepSeek Harness 的 `mcpServers` 配置为例):

```json
{
  "mcpServers": {
    "jdid-wallet": {
      "command": "node",
      "args": ["/绝对路径/jdid-dapp-sdk/mcp/server.mjs"]
    }
  }
}
```

## 工具

| 工具 | 作用 | 参数 |
| --- | --- | --- |
| `jdid_devices` | 列出可调试的设备 | — |
| `jdid_open_dapp` | 拉起 App → Explore → 打开地址(优先点「最近访问」),等页面就绪 | `url`(必填)、`device`、`packageName` |
| `jdid_probe` | 读钱包诊断状态:`eth_accounts` / `eth_chainId` / `web3_clientVersion` / `selectedAddress`(**诊断用,不受 13 条契约限制**) | `device`、`packageName` |
| `jdid_eval` | 在页面里执行一段 JS(可直接写 `await`) | `expression`(必填)、`device`、`url`、`timeoutMs` |
| `jdid_tap` | 按可见文本点击 | `text`(必填)、`device` |
| `jdid_type` | 向焦点输入文本 | `text`(必填)、`device` |
| `jdid_logcat` | 读最近日志(可过滤) | `grep`、`lines`、`device` |
| `jdid_screenshot` | 截屏到宿主文件 | `path`、`device` |
| `jdid_conformance` | 对一个 dApp 目录跑 conformance | `dappDir`(必填) |

## 前置条件

1. `adb devices` 里有设备(模拟器或真机);
2. 装的是 **debug** 包(WebView 调试只对 `debuggable` 应用默认开启,release 没有这个能力);
3. 钱包已**解锁**并进过 Explore —— 装包会杀掉进程,重新解锁后 `jdid_open_dapp` 才能打开页面。

## 已知限制(都是真机踩出来的)

- WebView 里还有一个内部桥页 `file:///android_asset/unified-bridge.html`,**没有 `window.ethereum`**;
  本 server 只认 `http(s)` 页面,不会误连它。
- `jdid_type` 走的是当前输入法:中文 IME 会把 URL 的 `://` 改成全角、吞掉点号,所以**优先用
  `jdid_open_dapp`**(它先点「最近访问」)。第一次请用固定端口手动打开一次。
- release / 上架包里没有 WebView 调试能力,这套工具在那种包上不工作(这是刻意的)。
