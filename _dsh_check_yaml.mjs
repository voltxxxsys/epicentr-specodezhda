// READ-ONLY cross-check: parse a cordis.patch.yml with a real YAML parser and replay the
// loader's patch semantics (last-wins apply over an empty entry list), reporting the
// effective disabled state. Mirrors @deepseek-ai/dsh-app-boot applyEntryPatches semantics.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const CACHE = "C:\\Users\\VoilT\\AppData\\Local\\npm-cache\\_npx\\1e7f6d9597241db0\\node_modules";
const loaderReq = createRequire(`${CACHE}\\@deepseek-ai\\cordis-plugin-loader\\package.json`);

let YAML = null;
for (const spec of ["js-yaml", "yaml", "@deepseek-ai/cosmokit"]) {
  try { YAML = loaderReq(spec); console.log(`yaml parser: ${spec}`); break; } catch { /* try next */ }
}
if (!YAML) { console.error("no YAML parser available"); process.exit(2); }

const parse = (text) =>
  typeof YAML.load === "function" ? YAML.load(text)
  : typeof YAML.parse === "function" ? YAML.parse(text)
  : (() => { throw new Error("parser exposes neither load() nor parse()"); })();

for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf8");
  const patches = parse(text);
  if (!Array.isArray(patches)) { console.error(`${file}: top level is not an array`); process.exit(1); }

  // loader semantics: build the entry map once, then apply patches in order (last wins)
  const entries = new Map(); // id -> {disabled}
  for (const p of patches) {
    if (p?.insert) continue;               // no inserts in this file
    if (typeof p?.id !== "string") continue;
    const cur = entries.get(p.id) ?? {};
    for (const [k, v] of Object.entries(p)) { if (k !== "id" && k !== "insert" && k !== "name") cur[k] = v; }
    entries.set(p.id, cur);
  }

  const ids = patches.filter((p) => typeof p?.id === "string" && !p.insert).map((p) => p.id);
  const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  const disabled = [...entries].filter(([, v]) => v.disabled === true).map(([id]) => id).sort();

  console.log(`\n=== ${file}`);
  console.log(`patches: ${patches.length}   unique ids: ${entries.size}   duplicate ids: ${dups.length ? dups.join(", ") : "(none)"}`);
  console.log(`effective disabled (${disabled.length}): ${disabled.join(", ")}`);
  console.log(`messenger-gateway config present: ${entries.get("dsh-messenger-gateway")?.config ? "yes" : "NO"}`);
}
