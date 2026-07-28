import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig(globalIgnores([
  ".next/**",
  ".next-audit/**",
  "node_modules/**",
  "coverage/**",
]), {
  extends: [...next],
});
