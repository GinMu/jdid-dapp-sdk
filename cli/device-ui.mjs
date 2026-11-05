/**
 * 设备 UI 小工具 —— 只做 `--auto-open` 需要的那一点:读 uiautomator dump、找节点、点、输入。
 *
 * 为什么不引依赖:uiautomator 的 dump 是结构化 XML,正则取 `text/content-desc/class/bounds`
 * 足够用;真正的导航逻辑仍放在 conformance 里,找不到元素时给明确报错而不是瞎点。
 */
import { spawnSync } from "node:child_process";

/** 把 uiautomator dump 的 XML 解析成节点数组(text / desc / cls / bounds)。 */
export function parseUiNodes(xml) {
  const nodes = [];
  const nodeRe = /<node\b([^>]*)\/?>/g;
  let match;
  while ((match = nodeRe.exec(xml)) !== null) {
    const attrs = match[1];
    const pick = (name) => {
      const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return m ? m[1] : "";
    };
    nodes.push({
      text: pick("text"),
      desc: pick("content-desc"),
      cls: pick("class"),
      resourceId: pick("resource-id"),
      bounds: pick("bounds"),
      clickable: pick("clickable") === "true",
    });
  }
  return nodes;
}

/** 找第一个 text 或 content-desc 命中候选词的节点(精确匹配优先,其次包含)。 */
export function findByText(nodes, candidates) {
  const list = candidates.filter(Boolean);
  for (const want of list) {
    const exact = nodes.find((n) => n.text === want || n.desc === want);
    if (exact) return exact;
  }
  for (const want of list) {
    const partial = nodes.find((n) => (n.text && n.text.includes(want)) || (n.desc && n.desc.includes(want)));
    if (partial) return partial;
  }
  return null;
}

/** 找输入框:优先 text 含候选词的 EditText,没有就退化到第一个可点击 EditText。 */
export function findInput(nodes, candidates = []) {
  const edits = nodes.filter((n) => /EditText/i.test(n.cls));
  if (edits.length === 0) return null;
  const hinted = edits.find(
    (n) => candidates.some((c) => (n.text && n.text.includes(c)) || (n.desc && n.desc.includes(c))),
  );
  return hinted ?? edits[0];
}

/** `[x1,y1][x2,y2]` → 中心点坐标。 */
export function boundsCenter(bounds) {
  const m = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(bounds ?? "");
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) };
}

const run = (device, args) => spawnSync("adb", ["-s", device, ...args], { encoding: "utf8" });

/** 抓一次 UI 层级并解析。 */
export function dumpUi(device) {
  run(device, ["shell", "uiautomator", "dump", "/sdcard/jdid-ui.xml"]);
  const out = run(device, ["shell", "cat", "/sdcard/jdid-ui.xml"]);
  return parseUiNodes(out.stdout ?? "");
}

export function tapBounds(device, bounds) {
  const center = boundsCenter(bounds);
  if (!center) return false;
  run(device, ["shell", "input", "tap", String(center.x), String(center.y)]);
  return true;
}

export function typeText(device, text) {
  // adb input text 不支持空格与部分符号;URL 里常见字符需转义。
  const escaped = text.replace(/[()&<>|;*`$!"'\\]/g, "\\$&").replace(/ /g, "%s");
  run(device, ["shell", "input", "text", escaped]);
}

export function pressEnter(device) {
  run(device, ["shell", "input", "keyevent", "66"]);
}
