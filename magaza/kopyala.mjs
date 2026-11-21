// Web uygulamasını (depo kökü) mağaza kabuğunun www/ klasörüne kopyalar.
// Uygulamanın kendisi tek kaynakta kalır: kökteki index.html. Burada kod yazılmaz.
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const kok = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(kok, "magaza", "www");
const PARCALAR = ["index.html", "yukle.html", "manifest.json", "icons", "img", "vendor", "avatars"];

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const p of PARCALAR) {
  const k = join(kok, p);
  if (existsSync(k)) cpSync(k, join(www, p), { recursive: true });
}
console.log("www hazır:", PARCALAR.filter((p) => existsSync(join(kok, p))).join(", "));
