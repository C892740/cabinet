import { writeFileSync, mkdirSync } from "node:fs";

/**
 * Marks each build output with the module system it was compiled for, so Node
 * and Electron resolve the right variant from the package "exports" map.
 */
mkdirSync("dist/esm", { recursive: true });
mkdirSync("dist/cjs", { recursive: true });
writeFileSync("dist/esm/package.json", JSON.stringify({ type: "module" }, null, 2) + "\n");
writeFileSync("dist/cjs/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n");
console.log("✔ @cabinet/core dual build complete (dist/esm, dist/cjs)");
