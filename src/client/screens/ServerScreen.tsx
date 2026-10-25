
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { http, useCurrentServerRequired } from '@pterodactyl/sdk';
import axios from 'axios';
import ImportModpackModal from '../components/ImportModpackModal';
import ExploreModpacks from '../components/ExploreModpacks';

type PackInfo = {
    name: string;
    versionId: string | null;
    summary: string | null;
    minecraft: string | null;
    loaders: Record<string, string>;
    fileCount: number;
    overrides: string[];
};

async function uploadServerFile(
    serverId: string,
    file: File,
    filename: string,
): Promise<void> {
    const base = `/api/client/servers/${serverId}`;

    const signed = await http.get<{ attributes: { url: string } }>(
        `${base}/files/upload`,
    );

    const form = new FormData();
    form.append('files', file, filename);

    await axios.post(signed.data.attributes.url, form, {
        params: { directory: '/' },
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 10 * 60 * 1000,
    });
}

async function downloadLauncher(serverId: string): Promise<File> {
    const response = await axios.get<Blob>(
        `/api/client/servers/${serverId}/extensions/mrpack-manager/launcher`,
        {
            responseType: 'blob',
            timeout: 10 * 60 * 1000,
        },
    );

    const blob = response.data;
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const correctedBlob =
        bytes[0] === 0x0a &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4b &&
        bytes[3] === 0x03
            ? new Blob([bytes.slice(1)], {
                type: 'application/java-archive',
            })
            : blob;

    return new File(
        [correctedBlob],
        'server.jar',
        { type: 'application/java-archive' },
    );
}

async function downloadModrinthPack(
    versionId: string,
    filename: string,
): Promise<File> {
    const response = await axios.get<{
        files: Array<{
            url: string;
            filename: string;
            primary: boolean;
        }>;
    }>(
        `https://api.modrinth.com/v2/version/${encodeURIComponent(versionId)}`,
        { timeout: 15000 },
    );

    const files = response.data.files;
    const pack = files.find(
        (file) =>
            file.primary &&
            file.filename.toLowerCase().endsWith('.mrpack'),
    ) ?? files.find(
        (file) => file.filename.toLowerCase().endsWith('.mrpack'),
    );

    if (!pack) {
        throw new Error('No .mrpack file was found for this version.');
    }

    const download = await axios.get<Blob>(pack.url, {
        responseType: 'blob',
        timeout: 10 * 60 * 1000,
    });

    return new File([download.data], filename, {
        type: 'application/octet-stream',
    });
}

export default function ServerScreen() {
    const server = useCurrentServerRequired();
    const [file, setFile] = useState<File | null>(null);
    const [pack, setPack] = useState<PackInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [installRequested, setInstallRequested] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [installStatus, setInstallStatus] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);

    
    function selectFile(selected: File | null) {
        setFile(selected);
        setPack(null);
        setError(null);
        setInstallStatus(null);
    }

    async function inspect(): Promise<void> {
        if (!file || busy) return;

        setBusy(true);
        setError(null);
        setPack(null);
        setInstallStatus(null);

        const form = new FormData();
        form.append('pack', file);

        try {
            const response = await http.post<PackInfo>(
                `/api/client/servers/${server.attributes.identifier}/extensions/mrpack-manager/inspect`,
                form,
                { timeout: 360000 },
            );

            setPack(response.data);
        } catch (err: unknown) {
            console.error('Mrpack inspect failed:', err);
            const message =
                err instanceof Error
                    ? `${err.message}${
                        typeof err === 'object' &&
                        err !== null &&
                        'response' in err &&
                        err.response &&
                        typeof err.response === 'object' &&
                        'status' in err.response
                            ? ` (HTTP ${err.response.status})`
                            : ''
                    }`
                    : String(err);

            setError(message);
        } finally {
            setBusy(false);
        }
    }

    
    async function installPack(): Promise<void> {
        if (!file || !pack || installing) return;

        const serverId = server.attributes.identifier;

        setInstalling(true);
        setInstallStatus('Downloading launcher…');
        setError(null);

        try {
            const launcher = await downloadLauncher(serverId);

            setInstallStatus('Uploading mrpack4server.jar…');
            await uploadServerFile(
                serverId,
                launcher,
                'server.jar',
            );

            setInstallStatus('Uploading local.mrpack…');
            await uploadServerFile(
                serverId,
                file,
                'local.mrpack',
            );

            setInstallStatus(
                'Both files uploaded successfully. Startup has not been changed.',
            );
        } catch (err: unknown) {
            console.error('Modrinth pack upload failed:', err);

            setError(
                'Upload failed. Check the launcher endpoint, server permissions, and panel logs. One file may already have uploaded; check the server files before retrying.',
            );
            setInstallStatus(null);
        } finally {
            setInstalling(false);
        }
    }

    async function installModrinthVersion(
        versionId: string,
    ): Promise<void> {
        const serverId = server.attributes.identifier;

        const packFile = await downloadModrinthPack(
            versionId,
            'local.mrpack',
        );

        const launcherFile = await downloadLauncher(serverId);

        await uploadServerFile(
            serverId,
            launcherFile,
            'server.jar',
        );

        await uploadServerFile(
            serverId,
            packFile,
            'local.mrpack',
        );
    }

    return (
        <div className="mm:flex mm:flex-col mm:gap-6">
            <div>
            </div>


            <ExploreModpacks onInstall={installModrinthVersion} />

            <section className="mm:rounded-lg mm:border mm:border-border mm:bg-card mm:p-5">
                <h2 className="mm:font-semibold">Import a modpack</h2>
                <p className="mm:mt-1 mm:text-sm mm:text-muted-foreground">
                    Select a local Modrinth pack to inspect it and upload its
                    installation files.
                </p>

                <div className="mm:mt-4">
                    <button
                        type="button"
                        onClick={() => {
                            setError(null);
                            setInstallStatus(null);
                            setImportOpen(true);
                        }}
                        className="mm:rounded-md mm:bg-[#16181C] mm:px-4 mm:py-2 mm:font-semibold mm:text-white"
                    >
                        Import Modpack
                    </button>
                </div>
            </section>

            {importOpen && (
                <ImportModpackModal
                    file={file}
                    onFileChange={selectFile}
                    onInspect={() => void inspect()}
                    onInstall={() => void installPack()}
                    onClose={() => {
                        if (busy || installing) return;
                        setImportOpen(false);
                    }}
                    isInspecting={busy}
                    isInstalling={installing}
                    isInspected={Boolean(pack)}
                    status={installStatus}
                    error={error}
                >
                    {pack && (
                        <section className="mm:rounded-lg mm:border mm:border-border mm:p-4">
                            <h3 className="mm:text-lg mm:font-semibold">
                                {pack.name}
                            </h3>

                            {pack.summary && (
                                <p className="mm:mt-2 mm:text-sm mm:text-muted-foreground">
                                    {pack.summary}
                                </p>
                            )}

                            <dl className="mm:mt-4 mm:grid mm:grid-cols-1 mm:gap-3 sm:mm:grid-cols-2">
                                <div>
                                    <dt className="mm:text-sm mm:text-muted-foreground">
                                        Pack version
                                    </dt>
                                    <dd>{pack.versionId ?? 'Not specified'}</dd>
                                </div>
                                <div>
                                    <dt className="mm:text-sm mm:text-muted-foreground">
                                        Minecraft version
                                    </dt>
                                    <dd>{pack.minecraft ?? 'Not specified'}</dd>
                                </div>
                                <div>
                                    <dt className="mm:text-sm mm:text-muted-foreground">
                                        Indexed files
                                    </dt>
                                    <dd>{pack.fileCount}</dd>
                                </div>
                                <div>
                                    <dt className="mm:text-sm mm:text-muted-foreground">
                                        Overrides
                                    </dt>
                                    <dd>
                                        {pack.overrides.length
                                            ? pack.overrides.join(', ')
                                            : 'None found'}
                                    </dd>
                                </div>
                            </dl>

                            <h4 className="mm:mt-4 mm:font-medium">
                                Declared loaders
                            </h4>

                            {Object.keys(pack.loaders).length ? (
                                <ul className="mm:mt-2 mm:list-inside mm:list-disc">
                                    {Object.entries(pack.loaders).map(
                                        ([name, version]) => (
                                            <li key={name}>
                                                {name}: {version}
                                            </li>
                                        ),
                                    )}
                                </ul>
                            ) : (
                                <p className="mm:mt-1 mm:text-sm mm:text-muted-foreground">
                                    No recognized loader dependency was found.
                                </p>
                            )}
                        </section>
                    )}
                </ImportModpackModal>
            )}

            <footer className="mm:mt-4 mm:border-t mm:border-border mm:pt-4 mm:text-sm mm:text-muted-foreground">
                Modrinth Pack Manager
            </footer>
        </div>
    );
}
