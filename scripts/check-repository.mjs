import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
execFileSync("git", ["diff", "--check"], { cwd: root, stdio: "inherit" });
for (const file of files) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  if (file.endsWith(".json")) JSON.parse(readFileSync(path, "utf8"));
  if (file.endsWith(".mjs") && !file.includes(".agents/")) {
    execFileSync(process.execPath, ["--check", path], { cwd: root, stdio: "inherit" });
  }
  if (file.endsWith("SKILL.md")) {
    const text = readFileSync(path, "utf8");
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
    if (!frontmatter || !/^name:\s*\S/m.test(frontmatter) || !/^description:\s*\S/m.test(frontmatter)) {
      throw new Error(`Missing skill name/description frontmatter: ${file}`);
    }
  }
}
console.log(`Repository metadata and JavaScript syntax validated (${files.length} tracked files).`);
