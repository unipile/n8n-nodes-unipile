import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("dist/nodes/Unipile", { recursive: true });
copyFileSync("nodes/Unipile/unipile.svg", "dist/nodes/Unipile/unipile.svg");
