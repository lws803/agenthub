#!/usr/bin/env node
/**
 * Syncs public/skill.md to all skill distribution locations and
 * updates plugin.json version to match packages/agenthub/package.json.
 */
import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const { version } = JSON.parse(
  readFileSync(resolve(root, "packages/agenthub/package.json"), "utf8")
);

const source = resolve(root, "public/skill.md");
const destinations = [
  "skills/agenthub/skill.md",
  "plugins/agenthub/skills/agenthub/skill.md",
  "packages/agenthub/skill.md",
];

for (const dest of destinations) {
  copyFileSync(source, resolve(root, dest));
  console.log(`  copied → ${dest}`);
}

const pluginJsonPath = resolve(
  root,
  "plugins/agenthub/.claude-plugin/plugin.json"
);
const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf8"));
pluginJson.version = version;
writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + "\n");
console.log(`  updated plugin.json version → ${version}`);

console.log("✅ Skill sync complete");
