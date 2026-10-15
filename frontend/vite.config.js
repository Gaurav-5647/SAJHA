import {defineConfig} from 'vite'; export default defineConfig({esbuild:{jsxFactory:'localizedElement',jsxFragment:'React.Fragment'},server:{proxy:{'/api':'http://127.0.0.1:5000'}}});
