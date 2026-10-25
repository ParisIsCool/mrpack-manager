import { defineConfig } from 'vitest/config';
import {
    pterodactylTestAliases,
    pterodactylTestSetup,
    pterodactylTestDirectory,
} from '@pterodactyl/sdk/vitest';

export default defineConfig({
    server: {
        fs: { allow: [process.cwd(), pterodactylTestDirectory] },
    },
    resolve: {
        alias: pterodactylTestAliases(),
    },
    test: {
        environment: 'jsdom',
        setupFiles: [pterodactylTestSetup],
        include: [
            'src/**/*.spec.ts',
            'src/**/*.spec.tsx',
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
        ],
        exclude: ['node_modules/**', 'vendor/**', 'dist/**'],
    },
});
