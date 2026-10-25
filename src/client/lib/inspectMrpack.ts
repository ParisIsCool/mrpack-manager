import { unzipSync } from 'fflate';

export type JavaCompatibility = {
    minecraft: string | null;
    loaders: Record<string, string>;
    server: {
        java: number | null;
        dockerImage: string | null;
    };
    launcher: {
        name: string;
        minimumJava: number;
        classFileVersion: number;
        status: 'known';
    };
    status: 'known' | 'uncertain' | 'unsupported';
    reason: string;
};

export type LocalPackInfo = {
    name: string;
    versionId: string | null;
    summary: string | null;
    minecraft: string | null;
    loaders: Record<string, string>;
    javaCompatibility: JavaCompatibility;
    fileCount: number;
    overrides: string[];
};

function compatibility(
    minecraft: string | null,
    loaders: Record<string, string>,
): JavaCompatibility {
    const launcherForJava = (java: number | null) => {
        const variant = java !== null && java >= 17
            ? 'jvm17'
            : java !== null && java >= 16
                ? 'jvm16'
                : 'jvm8';

        return {
            name: `mrpack4server-0.5.1-${variant}.jar`,
            minimumJava: variant === 'jvm17' ? 17 : variant === 'jvm16' ? 16 : 8,
            classFileVersion: variant === 'jvm17' ? 61 : variant === 'jvm16' ? 60 : 52,
            status: 'known' as const,
        };
    };
    const result: JavaCompatibility = {
        minecraft,
        loaders,
        server: { java: null, dockerImage: null },
        launcher: launcherForJava(null),
        status: 'uncertain',
        reason: 'Minecraft version metadata is missing or unknown.',
    };

    const match = minecraft?.trim().match(
        /^(?<major>\d+)\.(?<minor>\d+)(?:\.(?<patch>\d+))?(?:[-+].*)?$/,
    );

    if (!match) {
        result.status = minecraft === null ? 'uncertain' : 'unsupported';
        result.reason = minecraft === null
            ? 'The pack does not declare a Minecraft version.'
            : 'The declared Minecraft version is not recognized.';

        return result;
    }

    const major = Number(match.groups?.major);
    const minor = Number(match.groups?.minor);
    const patch = Number(match.groups?.patch ?? 0);

    if (major !== 1) {
        result.reason = 'This Minecraft version is outside the verified compatibility policy.';
        return result;
    }

    const java = minor <= 16
        ? 8
        : minor === 17
            ? 16
            : minor <= 19
                ? 17
                : minor === 20 && patch <= 4
                    ? 17
                    : minor === 20 || minor === 21
                        ? 21
                        : null;

    if (java === null) {
        result.reason = 'This Minecraft version is newer than the verified compatibility policy.';
        return result;
    }

    result.server.java = java;
    result.launcher = launcherForJava(java);
    result.status = 'known';
    result.reason =
        'Compatibility was determined from the pack metadata. Docker image availability is checked when installing.';

    return result;
}

export async function inspectMrpack(file: File): Promise<LocalPackInfo> {
    let archive: Record<string, Uint8Array>;

    try {
        archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
    } catch {
        throw new Error('The selected file is not a valid ZIP archive.');
    }

    const indexBytes = archive['modrinth.index.json'];

    if (!indexBytes) {
        throw new Error('The archive has no readable modrinth.index.json.');
    }

    let index: Record<string, unknown>;

    try {
        index = JSON.parse(new TextDecoder().decode(indexBytes)) as Record<string, unknown>;
    } catch {
        throw new Error('modrinth.index.json contains invalid JSON.');
    }

    const dependencies = index.dependencies;
    const files = index.files;

    if (
        index.formatVersion !== 1 ||
        !dependencies ||
        typeof dependencies !== 'object' ||
        !Array.isArray(files)
    ) {
        throw new Error('The archive does not contain a supported Modrinth pack index.');
    }

    const dependencyMap = dependencies as Record<string, unknown>;
    const loaders: Record<string, string> = {};

    for (const loader of [
        'fabric-loader',
        'forge',
        'neoforge',
        'quilt-loader',
        'liteloader',
    ]) {
        if (typeof dependencyMap[loader] === 'string') {
            loaders[loader] = dependencyMap[loader];
        }
    }

    const minecraft =
        typeof dependencyMap.minecraft === 'string'
            ? dependencyMap.minecraft
            : null;
    const overrides = ['overrides', 'server-overrides', 'client-overrides']
        .filter((directory) =>
            Object.keys(archive).some((name) => name.startsWith(`${directory}/`)),
        );

    return {
        name: typeof index.name === 'string' ? index.name : 'Unnamed pack',
        versionId: typeof index.versionId === 'string' ? index.versionId : null,
        summary: typeof index.summary === 'string' ? index.summary : null,
        minecraft,
        loaders,
        javaCompatibility: compatibility(minecraft, loaders),
        fileCount: files.length,
        overrides,
    };
}
