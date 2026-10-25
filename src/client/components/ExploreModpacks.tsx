
import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';


interface ModrinthPack {
    project_id: string;
    slug: string;
    title: string;
    description: string;
    author: string;
    downloads: number;
    icon_url: string | null;
    categories: string[];
    versions: string[];
}

interface SearchResponse {
    hits: ModrinthPack[];
    total_hits: number;
}

interface ModrinthVersionFile {
    url: string;
    filename: string;
    primary: boolean;
    size: number;
}

interface ModrinthVersion {
    id: string;
    name: string;
    version_number: string;
    date_published: string;
    game_versions: string[];
    loaders: string[];
    files: ModrinthVersionFile[];
}

const PAGE_SIZE = 20;
const API = 'https://api.modrinth.com/v2/search';

function formatDownloads(value: number): string {
    return new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

type ExploreModpacksProps = {
    onInstall: (versionId: string) => Promise<void>;
};

export default function ExploreModpacks({
    onInstall,
}: ExploreModpacksProps) {
    const [query, setQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [sort, setSort] = useState('downloads');
    const [page, setPage] = useState(0);
    const [packs, setPacks] = useState<ModrinthPack[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPack, setSelectedPack] = useState<ModrinthPack | null>(null);
    const [versions, setVersions] = useState<ModrinthVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [versionsError, setVersionsError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        async function search() {
            setLoading(true);
            setError(null);

            try {
                const response = await axios.get<SearchResponse>(API, {
                    params: {
                        query: submittedQuery,
                        facets: JSON.stringify([
                            ['project_type:modpack'],
                        ]),
                        index: sort,
                        limit: PAGE_SIZE,
                        offset: page * PAGE_SIZE,
                    },
                    signal: controller.signal,
                    timeout: 15000,
                });

                setPacks(response.data.hits);
                setTotal(response.data.total_hits);
            } catch (err) {
                if (controller.signal.aborted) return;

                console.error('Modrinth search failed:', err);
                setError(
                    'Could not load Modrinth modpacks. Please try again.',
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void search();

        return () => controller.abort();
    }, [submittedQuery, sort, page]);

    function submitSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPage(0);
        setSubmittedQuery(query.trim());
    }

    function changeSort(value: string) {
        setSort(value);
        setPage(0);
    }

    async function openPack(pack: ModrinthPack) {
        setSelectedPack(pack);
        setVersions([]);
        setSelectedVersion('');
        setVersionsError(null);
        setVersionsLoading(true);

        try {
            const response = await axios.get<ModrinthVersion[]>(
                `https://api.modrinth.com/v2/project/${encodeURIComponent(pack.project_id)}/version`,
                { timeout: 15000 },
            );

            setVersions(response.data);
            setSelectedVersion(response.data[0]?.id ?? '');
        } catch (err) {
            console.error('Failed to load Modrinth versions:', err);
            setVersionsError('Could not load versions for this modpack.');
        } finally {
            setVersionsLoading(false);
        }
    }

   async function installSelectedVersion() {
    if (!selectedVersion) return;

    try {
        setVersionsError(null);
        await onInstall(selectedVersion);
        setSelectedPack(null);
    } catch (err) {
        console.error('Modrinth pack installation failed:', err);
        setVersionsError(
            'Installation failed. Check the server files and try again.',
        );
    }
}

    return (
        <div className="mm:flex mm:flex-col mm:gap-5 mm:px-4 sm:mm:px-6 lg:mm:px-8">
            <header>
                <h2 className="mm:text-2xl mm:font-semibold">
                    Explore Modpacks
                </h2>
                <p className="mm:mt-1 mm:text-sm mm:text-muted-foreground">
                    Discover your next Minecraft adventure.
                </p>
            </header>

            <form
                onSubmit={submitSearch}
                className="mm:flex mm:min-w-0 mm:items-center mm:gap-3"
            >
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search Modrinth modpacks..."
                    aria-label="Search modpacks"
                    className="mm:w-0 mm:min-w-0 mm:flex-1 mm:rounded-md mm:border mm:border-border mm:bg-card mm:px-4 mm:py-3"
                />

                <button
                    type="submit"
                    className="mm:shrink-0 mm:rounded-md mm:bg-[#16181C] mm:px-5 mm:py-3 mm:font-semibold mm:text-white"
                >
                    Search
                </button>
            </form>
            <div className="mm:flex mm:flex-wrap mm:items-center mm:justify-between mm:gap-3">
                <p className="mm:text-sm mm:text-muted-foreground">
                    {loading
                        ? 'Loading modpacks…'
                        : `${total.toLocaleString()} modpacks found`}
                </p>

                <label className="mm:flex mm:items-center mm:gap-2 mm:text-sm">
                    Sort by
                    <select
                        value={sort}
                        onChange={(event) => changeSort(event.target.value)}
                        className="mm:rounded-md mm:border mm:border-border mm:bg-card mm:px-3 mm:py-2"
                    >
                        <option value="downloads">Most downloaded</option>
                        <option value="follows">Most followed</option>
                        <option value="newest">Newest</option>
                        <option value="updated">Recently updated</option>
                        <option value="relevance">Relevance</option>
                    </select>
                </label>
            </div>

            {error && (
                <div role="alert" className="mm:rounded-lg mm:border mm:border-border mm:p-5">
                    <p className="mm:text-sm mm:text-red-500">{error}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setPage((current) => current);
                            setSubmittedQuery((current) => `${current} `);
                        }}
                        className="mm:mt-3 mm:rounded-md mm:border mm:border-border mm:px-3 mm:py-2 mm:text-sm"
                    >
                        Retry search
                    </button>
                </div>
            )}

            {!error && !loading && packs.length === 0 && (
                <p className="mm:rounded-lg mm:border mm:border-border mm:p-6 mm:text-sm mm:text-muted-foreground">
                    No modpacks found. Try another search.
                </p>
            )}

            {packs.length > 0 && (
                <div className="mm:grid mm:grid-cols-1 mm:gap-4 sm:mm:grid-cols-2 xl:mm:grid-cols-3">
                    {packs.map((pack) => (
                        <button
                            key={pack.project_id}
                            type="button"
                            onClick={() => void openPack(pack)}
                            className="mm:flex mm:min-w-0 mm:gap-3 mm:rounded-lg mm:border mm:border-border mm:bg-card mm:p-4 mm:text-left hover:mm:bg-muted"
                        >
                            {pack.icon_url ? (
                                <img
                                    src={pack.icon_url}
                                    alt=""
                                    loading="lazy"
                                    className="mm:size-16 mm:shrink-0 mm:rounded-lg mm:object-cover"
                                />
                            ) : (
                                <div className="mm:flex mm:size-16 mm:shrink-0 mm:items-center mm:justify-center mm:rounded-lg mm:bg-muted">
                                    📦
                                </div>
                            )}

                            <div className="mm:min-w-0 mm:flex-1">
                                <h3 className="mm:font-semibold">
                                    {pack.title}
                                </h3>
                                <p className="mm:mt-1 mm:text-xs mm:text-muted-foreground">
                                    by {pack.author}
                                    {' · '}
                                    {formatDownloads(pack.downloads)} downloads
                                </p>
                                <p className="mm:mt-2 mm:line-clamp-3 mm:text-sm mm:text-muted-foreground">
                                    {pack.description}
                                </p>
                                {pack.categories.length > 0 && (
                                    <p className="mm:mt-3 mm:line-clamp-1 mm:text-xs mm:text-muted-foreground">
                                        {pack.categories.slice(0, 3).join(' · ')}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {loading && (
                <p role="status" className="mm:py-8 mm:text-center mm:text-sm mm:text-muted-foreground">
                    Fetching modpacks from Modrinth…
                </p>
            )}

            {!loading && !error && total > PAGE_SIZE && (
                <nav
                    aria-label="Modpack pages"
                    className="mm:flex mm:items-center mm:justify-center mm:gap-4 mm:pt-2"
                >
                    <button
                        type="button"
                        disabled={page === 0}
                        onClick={() => setPage((current) => current - 1)}
                        className="mm:rounded-md mm:border mm:border-border mm:px-4 mm:py-2 disabled:mm:opacity-40"
                    >
                        Previous
                    </button>
                    <span className="mm:text-sm mm:text-muted-foreground">
                        Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
                    </span>
                    <button
                        type="button"
                        disabled={(page + 1) * PAGE_SIZE >= total}
                        onClick={() => setPage((current) => current + 1)}
                        className="mm:rounded-md mm:border mm:border-border mm:px-4 mm:py-2 disabled:mm:opacity-40"
                    >
                        Next
                    </button>
                </nav>
            )}
            {selectedPack && (
                <div
                    className="mm:fixed mm:inset-0 mm:z-50 mm:flex mm:items-center mm:justify-center mm:bg-black/60 mm:p-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setSelectedPack(null);
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="mm-version-title"
                        className="mm:max-h-[85vh] mm:w-full mm:max-w-xl mm:overflow-y-auto mm:rounded-xl mm:border mm:border-border mm:bg-card mm:p-6"
                    >
                        <div className="mm:flex mm:items-start mm:justify-between mm:gap-4">
                            <div>
                                <h2
                                    id="mm-version-title"
                                    className="mm:text-xl mm:font-semibold"
                                >
                                    {selectedPack.title}
                                </h2>
                                <p className="mm:mt-1 mm:text-sm mm:text-muted-foreground">
                                    Choose a release and its Minecraft version.
                                </p>
                            </div>

                            <button
                                type="button"
                                aria-label="Close version selection"
                                onClick={() => setSelectedPack(null)}
                                className="mm:rounded-md mm:border mm:border-border mm:px-3 mm:py-2"
                            >
                                ✕
                            </button>
                        </div>

                        {versionsLoading && (
                            <p role="status" className="mm:py-8 mm:text-sm mm:text-muted-foreground">
                                Loading available versions…
                            </p>
                        )}

                        {versionsError && (
                            <p role="alert" className="mm:mt-4 mm:text-sm mm:text-red-500">
                                {versionsError}
                            </p>
                        )}

                        {!versionsLoading && !versionsError && versions.length === 0 && (
                            <p className="mm:py-6 mm:text-sm mm:text-muted-foreground">
                                No versions are available for this pack.
                            </p>
                        )}

                        {versions.length > 0 && (
                            <div className="mm:mt-5 mm:flex mm:flex-col mm:gap-3">
                                <label
                                    htmlFor="mm-pack-version"
                                    className="mm:font-medium"
                                >
                                    Available versions
                                </label>

                                <select
                                    id="mm-pack-version"
                                    value={selectedVersion}
                                    onChange={(event) => setSelectedVersion(event.target.value)}
                                    className="mm:w-full mm:rounded-md mm:border mm:border-border mm:bg-card mm:px-3 mm:py-3"
                                >
                                    {versions.map((version) => (
                                        <option key={version.id} value={version.id}>
                                            {version.version_number} — {version.name}
                                        </option>
                                    ))}
                                </select>

                                {versions
                                    .filter((version) => version.id === selectedVersion)
                                    .map((version) => (
                                        <div
                                            key={version.id}
                                            className="mm:rounded-lg mm:border mm:border-border mm:p-4 mm:text-sm"
                                        >
                                            <p>
                                                <span className="mm:font-medium">
                                                    Minecraft:
                                                </span>{' '}
                                                {version.game_versions.join(', ') || 'Not specified'}
                                            </p>
                                            <p className="mm:mt-2">
                                                <span className="mm:font-medium">
                                                    Loaders:
                                                </span>{' '}
                                                {version.loaders.join(', ') || 'Not specified'}
                                            </p>
                                            <p className="mm:mt-2 mm:text-muted-foreground">
                                                Released{' '}
                                                {new Date(version.date_published).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        )}

                        <div className="mm:mt-6 mm:flex mm:gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedPack(null)}
                                className="mm:flex-1 mm:rounded-md mm:border mm:border-border mm:px-4 mm:py-3"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={
                                    versionsLoading ||
                                    !selectedVersion ||
                                    Boolean(versionsError)
                                }
                                onClick={() => void installSelectedVersion()}
                                className="mm:flex-1 mm:rounded-md mm:bg-[#16181C] mm:px-4 mm:py-3 mm:font-semibold mm:text-white disabled:mm:opacity-50"
                            >
                                Install Modpack
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
