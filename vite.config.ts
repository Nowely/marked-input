import {defineConfig} from "vite";
import * as path from "path";

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'lib/index.ts'),
            name: 'MyLib',
            fileName: (format) => `my-lib.${format}.js`
        },
        rollupOptions: {
            external: ['react'],
            output: {
                globals: {
                    react: 'React'
                }
            }
        }
    }
})