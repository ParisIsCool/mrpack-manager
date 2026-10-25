<?php
namespace MrpackManager\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Models\Server;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InstallPackController extends Controller
{
    private const VERSION = '0.5.1';

    private const RELEASE_API =
        'https://api.github.com/repos/Patbox/mrpack4server/releases/tags/0.5.1';

    public function launcher(Request $request): StreamedResponse|JsonResponse
    {
        $java = $request->integer('java', 8);
        $variant = match (true) {
            $java >= 17 => 'jvm17',
            $java >= 16 => 'jvm16',
            default => 'jvm8',
        };
        $filename = 'mrpack4server-' . self::VERSION . '-' . $variant . '.jar';
        $directory = storage_path('app/mrpack-manager');
        $path = $directory . '/' . $filename;

        if (!is_file($path) || filesize($path) < 100_000) {
            $release = Http::timeout(20)
                ->withHeaders([
                    'Accept' => 'application/vnd.github+json',
                    'User-Agent' => 'Pterodactyl-Modrinth-Pack-Manager',
                ])
                ->get(self::RELEASE_API);

            if (!$release->successful()) {
                return response()->json([
                    'message' => 'Could not verify mrpack4server release '
                        . self::VERSION
                        . '. Check the official GitHub release and try again.',
                ], 502);
            }

            $assets = $release->json('assets', []);

            $asset = collect($assets)->first(
                fn (array $item) =>
                    ($item['name'] ?? '') ===
                    $filename
            );

            if (!$asset || !is_string($asset['browser_download_url'] ?? null)) {
                return response()->json([
                    'message' => 'The expected launcher JAR was not found '
                        . 'in the official release.',
                ], 502);
            }

            $downloadUrl = $asset['browser_download_url'];

            if (!str_starts_with(
                $downloadUrl,
                'https://github.com/Patbox/mrpack4server/releases/download/'
            )) {
                return response()->json([
                    'message' => 'The release contains an unexpected download URL.',
                ], 502);
            }

            $download = Http::timeout(90)->withOptions([
                'allow_redirects' => true,
            ])->get($downloadUrl);

            if (!$download->successful() || strlen($download->body()) < 100_000) {
                return response()->json([
                    'message' => 'The launcher download failed or was incomplete.',
                ], 502);
            }

            File::ensureDirectoryExists($directory);

            $temporary = $path . '.tmp';
            file_put_contents($temporary, $download->body(), LOCK_EX);
            rename($temporary, $path);
        }

        \Log::info('mrpack launcher response check', [
            'path' => $path,
            'size' => filesize($path),
            'first_bytes' => bin2hex(file_get_contents($path, false, null, 0, 8)),
            'variant' => $variant,
        ]);

        return response()->streamDownload(
            static function () use ($path): void {
                readfile($path);
            },
            'mrpack4server.jar',
            [
                'Content-Type' => 'application/java-archive',
                'Cache-Control' => 'private, no-store',
            ],
        );
    }

    public function activate(Request $request, Server $server): JsonResponse
    {
        $request->validate([
            'confirmed_stopped' => ['required', 'accepted'],
        ]);

        /*
         * IMPORTANT:
         * This is not yet the final activation implementation.
         * The panel's Server model does not provide a verified live Wings
         * power-state check here. Do not change startup until that check
         * is added and verified for this panel version.
         */
        return response()->json([
            'message' => 'Activation is not enabled yet. Upload support is '
                . 'being implemented first; startup will not be changed.',
        ], 501);
    }
}
