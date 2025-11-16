import { fs } from "zx";

fs.mkdirp("dist/v2/public");
fs.copy("src/v2/public", "dist/v2/public", { recursive: true });