// READ-ONLY diagnostic: which copy of @deepseek-ai/* does each package actually resolve?
// Loads nothing from the packages themselves (no side effects beyond module resolution).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const PROFILE = "C:\\Users\\VoilT\\.dsh\\profiles\\web";
const NPX = "C:\\Users\\VoilT\\AppData\\Local\\npm-cache\\_npx\\1e7f6d9597241db0\\node_modules";

const probes = [
  // [anchor path, package to resolve from that anchor]
  [`${PROFILE}\\node_modules\\@goodandready\\dsh-tts\\lib\\index.js`, "@deepseek-ai/dsh-credentials"],
  [`${PROFILE}\\node_modules\\@goodandready\\dsh-voice\\lib\\index.js`, "@deepseek-ai/dsh-credentials"],
  [`${PROFILE}\\node_modules\\dsh-client-ui-skins\\lib\\client.js`, "@deepseek-ai/dsh-client-runtime/client"],
  [`${PROFILE}\\node_modules\\dsh-client-ui-skins\\lib\\client.js`, "@deepseek-ai/dsh-client-store"],
  // official platform packages (loaded from the dsh installation)
  [`${NPX}\\@deepseek-ai\\dsh-base\\lib\\index.js`, "@deepseek-ai/dsh-credentials"],
  [`${NPX}\\@deepseek-ai\\dsh-llm-deepseek\\lib\\index.js`, "@deepseek-ai/dsh-credentials"],
  [`${NPX}\\@deepseek-ai\\dsh-authorization\\lib\\index.js`, "@deepseek-ai/dsh-credentials"],
];

for (const [anchor, spec] of probes) {
  const req = createRequire(anchor);
  let res;
  try {
    res = req.resolve(spec);
  } catch (e) {
    console.log(`MISS  ${spec}\n      from ${anchor}\n      -> ${e.code ?? e.message}`);
    continue;
  }
  // walk up to the owning package.json to report its version
  let dir = res;
  let version = "?";
  for (let i = 0; i < 6; i++) {
    dir = dir.slice(0, Math.max(dir.lastIndexOf("\\"), 0));
    try {
      const j = JSON.parse(readFileSync(`${dir}\\package.json`, "utf8"));
      if (j.name?.startsWith("@deepseek-ai/dsh-credentials") || j.name?.startsWith("@deepseek-ai/dsh-client-runtime") || j.name?.startsWith("@deepseek-ai/dsh-client-store")) {
        version = j.version;
        break;
      }
    } catch { /* keep walking */ }
  }
  const origin = res.toLowerCase().includes("profiles\\web") ? "PROFILE-LOCAL" : "dsh installation";
  console.log(`OK    ${spec} = ${version}  [${origin}]\n      from ${anchor}\n      -> ${res}`);
}
