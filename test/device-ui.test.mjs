import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { boundsCenter, findByText, findInput, parseUiNodes } from "../cli/device-ui.mjs";

const ROOT = resolve(import.meta.dirname, "..");

const XML = `<hierarchy rotation="0">
  <node text="搜索 DApp" content-desc="" class="android.widget.EditText" resource-id="search" bounds="[40,120][680,200]" clickable="true"/>
  <node text="" content-desc="浏览" class="android.widget.Button" resource-id="tab-explore" bounds="[0,1900][200,2000]" clickable="true"/>
  <node text="打开" content-desc="" class="android.widget.Button" resource-id="go" bounds="[0,300][500,400]" clickable="true"/>
</hierarchy>`;

test("parseUiNodes 取出 text/desc/class/bounds", () => {
  const nodes = parseUiNodes(XML);
  assert.equal(nodes.length, 3);
  assert.deepEqual(nodes[0], {
    text: "搜索 DApp",
    desc: "",
    cls: "android.widget.EditText",
    resourceId: "search",
    bounds: "[40,120][680,200]",
    clickable: true,
  });
});

test("findByText 精确优先、其次包含、找不到返回 null", () => {
  const nodes = parseUiNodes(XML);
  assert.equal(findByText(nodes, ["浏览"])?.resourceId, "tab-explore");
  assert.equal(findByText(nodes, ["搜索"])?.resourceId, "search", "包含匹配应命中 '搜索 DApp'");
  assert.equal(findByText(nodes, ["不存在"]), null);
});

test("findInput 优先带提示词的输入框", () => {
  const nodes = parseUiNodes(XML);
  assert.equal(findInput(nodes, ["搜索"])?.resourceId, "search");
  assert.equal(findInput(nodes, ["无关"])?.resourceId, "search", "没有命中时退化到第一个 EditText");
  assert.equal(findInput(parseUiNodes("<hierarchy/>")), null);
});

test("boundsCenter 解析中心点,非法输入返回 null", () => {
  assert.deepEqual(boundsCenter("[40,120][680,200]"), { x: 360, y: 160 });
  assert.equal(boundsCenter("bad"), null);
  assert.equal(boundsCenter(""), null);
});

test("conformance --auto-open:无设备时仍降级为跳过", () => {
  const result = spawnSync(
    process.execPath,
    ["cli/conformance.mjs", "--cdp", "--auto-open", "--device", "no-such-device-42", "--wait", "1"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /~ cdp\s+真钱包 CDP\(跳过:/);
});
