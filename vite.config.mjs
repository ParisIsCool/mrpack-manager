import { defineConfig } from 'vite';
import { defineExtensionConfig } from '@pterodactyl/sdk/vite';

export default defineConfig(defineExtensionConfig({
    entry: 'src/client/index.tsx',
}));