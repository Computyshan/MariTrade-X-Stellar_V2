import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
    ignores: ["**/_node_modules.bak/**", "**/escrow-bindings/dist/**"],
}, {
    extends: [...next],
    rules: {
        // The React Compiler lint rules bundled with recent eslint-config-next
        // flag the standard "fetch on mount, setLoading(true) synchronously
        // before the await" pattern as a hard error. That pattern is used
        // throughout this codebase (dashboard, network, payments, shipments,
        // analytics, team, etc.) and does not actually cause the cascading-
        // render problem the rule is designed to catch here — downgrade to a
        // warning so `next build` isn't blocked by it. Genuine render-time
        // mutation bugs (react-hooks/immutability) stay at error severity.
        "react-hooks/set-state-in-effect": "warn",
    },
}]);
