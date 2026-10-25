
import { useRef, useState, type DragEvent, type ReactNode } from 'react';

interface ImportModpackModalProps {
    file: File | null;
    onFileChange: (file: File | null) => void;
    onInspect: () => void;
    onInstall: () => void;
    onClose: () => void;
    isInspecting: boolean;
    isInstalling: boolean;
    isInspected: boolean;
    status: string | null;
    error: string | null;
    children?: ReactNode;
}

export default function ImportModpackModal({
    file,
    onFileChange,
    onInspect,
    onInstall,
    onClose,
    isInspecting,
    isInstalling,
    isInspected,
    status,
    error,
    children,
}: ImportModpackModalProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    const busy = isInspecting || isInstalling;

    function selectFile(candidate?: File) {
        if (!candidate) return;

        if (!candidate.name.toLowerCase().endsWith('.mrpack')) {
            setFileError('Please select a .mrpack file.');
            return;
        }

        setFileError(null);
        onFileChange(candidate);
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setDragging(false);

        if (!busy) {
            selectFile(event.dataTransfer.files[0]);
        }
    }

    return (
        <div
            className="mm:fixed mm:inset-0 mm:z-50 mm:flex mm:items-center mm:justify-center mm:bg-black/60 mm:p-4"
            onMouseDown={(event) => {
                if (
                    event.target === event.currentTarget &&
                    !busy
                ) {
                    onClose();
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="mm-import-title"
                className="mm:w-full mm:max-w-xl mm:max-h-[90vh] mm:overflow-y-auto mm:rounded-xl mm:border mm:border-border mm:bg-card mm:p-6 mm:shadow-xl"
            >
                <header className="mm:mb-6 mm:flex mm:items-start mm:justify-between mm:gap-4">
                    <div>
                        <h2
                            id="mm-import-title"
                            className="mm:text-xl mm:font-semibold"
                        >
                            Import Modpack
                        </h2>
                        <p className="mm:mt-1 mm:text-sm mm:text-muted-foreground">
                            Choose a Modrinth .mrpack file from your computer.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close dialog"
                        className="mm:rounded-md mm:px-3 mm:py-2 hover:mm:bg-muted disabled:mm:opacity-50"
                    >
                        ✕
                    </button>
                </header>

                <input
                    ref={inputRef}
                    type="file"
                    accept=".mrpack"
                    hidden
                    disabled={busy}
                    onChange={(event) => {
                        selectFile(event.target.files?.[0]);
                        event.target.value = '';
                    }}
                />

                <div
                    role="button"
                    tabIndex={busy ? -1 : 0}
                    aria-label="Drop a modpack here or browse files"
                    onClick={() => {
                        if (!busy) inputRef.current?.click();
                    }}
                    onKeyDown={(event) => {
                        if (
                            !busy &&
                            (event.key === 'Enter' || event.key === ' ')
                        ) {
                            event.preventDefault();
                            inputRef.current?.click();
                        }
                    }}
                    onDragEnter={(event) => {
                        event.preventDefault();
                        if (!busy) setDragging(true);
                    }}
                    onDragOver={(event) => {
                        event.preventDefault();
                        if (!busy) setDragging(true);
                    }}
                    onDragLeave={(event) => {
                        if (
                            !event.currentTarget.contains(
                                event.relatedTarget as Node | null,
                            )
                        ) {
                            setDragging(false);
                        }
                    }}
                    onDrop={handleDrop}
                    className={`mm:rounded-lg mm:border-2 mm:border-dashed mm:p-8 mm:text-center mm:transition-colors ${
                        dragging
                            ? 'mm:border-[#16181C] mm:bg-muted'
                            : 'mm:border-border'
                    } ${busy ? 'mm:cursor-not-allowed mm:opacity-60' : 'mm:cursor-pointer'}`}
                >
                    <div className="mm:text-4xl" aria-hidden="true">
                        ⇧
                    </div>
                    <p className="mm:mt-3 mm:font-medium">
                        {dragging
                            ? 'Drop your modpack here'
                            : 'Drag and drop your .mrpack here'}
                    </p>
                    <p className="mm:mt-1 mm:text-sm mm:text-muted-foreground">
                        Or browse files on your computer
                    </p>
                    <span className="mm:mt-4 mm:inline-block mm:rounded-md mm:border mm:border-border mm:px-4 mm:py-2 mm:text-sm">
                        Browse files
                    </span>
                </div>

                {fileError && (
                    <p role="alert" className="mm:mt-3 mm:text-sm mm:text-red-500">
                        {fileError}
                    </p>
                )}

                {file && (
                    <div className="mm:mt-4 mm:flex mm:items-center mm:gap-3 mm:rounded-lg mm:border mm:border-border mm:p-3">
                        <span className="mm:text-2xl" aria-hidden="true">
                            📦
                        </span>
                        <div className="mm:min-w-0 mm:flex-1">
                            <p className="mm:break-words mm:font-medium">
                                {file.name}
                            </p>
                            <p className="mm:text-sm mm:text-muted-foreground">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                onFileChange(null);
                                setFileError(null);
                            }}
                            className="mm:rounded-md mm:border mm:border-border mm:px-3 mm:py-2 mm:text-sm disabled:mm:opacity-50"
                        >
                            Remove
                        </button>
                    </div>
                )}

                {children && (
                    <div className="mm:mt-5">
                        {children}
                    </div>
                )}

                {status && (
                    <p role="status" className="mm:mt-4 mm:text-sm">
                        {status}
                    </p>
                )}

                {error && (
                    <p role="alert" className="mm:mt-3 mm:text-sm mm:text-red-500">
                        {error}
                    </p>
                )}

                <div className="mm:mt-6 mm:flex mm:flex-col mm:gap-3">
                    {!isInspected ? (
                        <button
                            type="button"
                            disabled={!file || busy}
                            onClick={onInspect}
                            className="mm:w-full mm:rounded-md mm:bg-[#16181C] mm:px-4 mm:py-3 mm:font-semibold mm:text-white disabled:mm:cursor-not-allowed disabled:mm:opacity-50"
                        >
                            {isInspecting ? 'Inspecting pack…' : 'Inspect Pack'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={!file || busy}
                            onClick={onInstall}
                            className="mm:w-full mm:rounded-md mm:bg-[#16181C] mm:px-4 mm:py-3 mm:font-semibold mm:text-white disabled:mm:cursor-not-allowed disabled:mm:opacity-50"
                        >
                            {isInstalling ? 'Uploading files…' : 'Install Modpack'}
                        </button>
                    )}

                    <button
                        type="button"
                        disabled={busy}
                        onClick={onClose}
                        className="mm:w-full mm:rounded-md mm:border mm:border-border mm:px-4 mm:py-3 disabled:mm:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </section>
        </div>
    );
}
