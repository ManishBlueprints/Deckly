import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts/ui-token-scope.json"), "utf8"));
const sourceExtensions = new Set([".css", ".ts", ".tsx"]);

function collectSourceFiles(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativeEntry = path.join(relativeDirectory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return collectSourceFiles(relativeEntry);
    return sourceExtensions.has(path.extname(entry.name)) ? [relativeEntry] : [];
  });
}
const rules = [
  ["raw color", /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/gi],
  ["palette utility", /\b(?:text|bg|border|ring|fill|stroke)-(?:white|black|slate|gray|zinc|neutral|stone|red|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-|\/|\b)/g],
  ["Material Symbols", /material-symbols|Material Symbols/g],
  ["legacy Manrope", /font-manrope|\bManrope\b/g],
  ["arbitrary overlay layer", /z-\[(?:[4-9]\d|\d{3,})\]/g],
];

const scopedFiles = new Set([
  ...manifest.files,
  ...(manifest.directories ?? []).flatMap(collectSourceFiles),
]);

const failures = [];
for (const relative of [...scopedFiles].sort()) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const exceptions = manifest.exceptions[relative] ?? [];
  for (const exception of exceptions) {
    if (!exception.literal || !exception.reason?.trim()) {
      failures.push(`${relative}: exception entries require a literal and reason`);
    }
  }
  const allowed = new Set(exceptions.map((exception) => exception.literal));
  for (const [label, pattern] of rules) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      if (allowed.has(match[0])) continue;
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      failures.push(`${relative}:${line} ${label}: ${match[0]}`);
    }
  }
}

if (failures.length) {
  console.error(`UI token check failed:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`UI token check passed for ${scopedFiles.size} migrated files.`);
