import path from "path";
import {defineConfig} from "vite";
import {MarkedInput} from "./lib";
import react from '@vitejs/plugin-react';
import injectCss from "./InjectCssPlugin"
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'lib/index.ts'),
            name: MarkedInput.name,
            formats: ['es', 'umd'],
        },
        rollupOptions: {
            external: ['react'],
            output: {
                globals: {
                    react: 'React'
                }
            }
        }
    },
    plugins: [react(), injectCss()]
})