import { zipSync } from 'fflate';
import { describe, expect, test } from 'vitest';
import { inspectMrpack } from './inspectMrpack';

function packFile(index: Record<string, unknown>): File {
    const archive = zipSync({
        'modrinth.index.json': new TextEncoder().encode(JSON.stringify(index)),
        'overrides/server.properties': new Uint8Array([1]),
    });

    return {
        name: 'test.mrpack',
        arrayBuffer: async () => archive.buffer,
    } as File;
}

const baseIndex = {
    formatVersion: 1,
    name: 'Test pack',
    versionId: '1.0.0',
    summary: 'A test pack',
    dependencies: {
        minecraft: '1.7.10',
        forge: '10.13.4.1614',
    },
    files: [{ path: 'mods/example.jar' }],
};

describe('inspectMrpack', () => {
    test('reads metadata locally without a server request', async () => {
        const result = await inspectMrpack(packFile(baseIndex));

        expect(result.name).toBe('Test pack');
        expect(result.minecraft).toBe('1.7.10');
        expect(result.loaders).toEqual({ forge: '10.13.4.1614' });
        expect(result.fileCount).toBe(1);
        expect(result.overrides).toEqual(['overrides']);
        expect(result.javaCompatibility.server.java).toBe(8);
        expect(result.javaCompatibility.launcher.name).toBe(
            'mrpack4server-0.5.1-jvm8.jar',
        );
        expect(result.javaCompatibility.launcher.minimumJava).toBe(8);
    });

    test('reports malformed archives clearly', async () => {
        await expect(
            inspectMrpack({
                name: 'broken.mrpack',
                arrayBuffer: async () => new TextEncoder().encode('not a zip').buffer,
            } as File),
        ).rejects.toThrow('valid ZIP archive');
    });

    test('reports missing or malformed pack metadata', async () => {
        const archive = zipSync({
            'modrinth.index.json': new TextEncoder().encode('{}'),
        });

        await expect(
            inspectMrpack({
                name: 'missing.mrpack',
                arrayBuffer: async () => archive.buffer,
            } as File),
        ).rejects.toThrow('supported Modrinth pack index');
    });
});
