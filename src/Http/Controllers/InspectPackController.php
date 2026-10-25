<?php
namespace MrpackManager\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;
use MrpackManager\Services\JavaCompatibilityResolver;
use Pterodactyl\Models\Server;
use ZipArchive;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InspectPackController extends Controller
{
    public function inspect(
        Request $request,
        Server $server,
        JavaCompatibilityResolver $compatibility,
    ): JsonResponse
    {
        $request->validate([
            'pack' => ['required', 'file', 'max:2097152'],
        ]);

        $file = $request->file('pack');

        if (!$file || strtolower($file->getClientOriginalExtension()) !== 'mrpack') {
            throw ValidationException::withMessages([
                'pack' => 'Please upload a .mrpack file.',
            ]);
        }

        $zip = new ZipArchive();

        if ($zip->open($file->getRealPath()) !== true) {
            throw ValidationException::withMessages([
                'pack' => 'The uploaded file is not a valid ZIP archive.',
            ]);
        }

        try {
            if ($zip->numFiles > 20000) {
                throw ValidationException::withMessages([
                    'pack' => 'The archive contains too many entries.',
                ]);
            }

            $contents = $zip->getFromName('modrinth.index.json');

            if ($contents === false || strlen($contents) > 4 * 1024 * 1024) {
                throw ValidationException::withMessages([
                    'pack' => 'The archive has no readable modrinth.index.json.',
                ]);
            }

            try {
                $index = json_decode($contents, true, 64, JSON_THROW_ON_ERROR);
            } catch (\JsonException $e) {
                throw ValidationException::withMessages([
                    'pack' => 'modrinth.index.json contains invalid JSON.',
                ]);
            }

            if (
                !is_array($index)
                || ($index['formatVersion'] ?? null) !== 1
                || !is_array($index['dependencies'] ?? null)
                || !is_array($index['files'] ?? null)
            ) {
                throw ValidationException::withMessages([
                    'pack' => 'The archive does not contain a supported Modrinth pack index.',
                ]);
            }

            $overrides = [];

            foreach (['overrides', 'server-overrides', 'client-overrides'] as $directory) {
                $prefix = $directory . '/';

                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $name = $zip->getNameIndex($i);

                    if (is_string($name) && str_starts_with($name, $prefix)) {
                        $overrides[] = $directory;
                        break;
                    }
                }
            }

            $dependencies = $index['dependencies'];
            $files = $index['files'];

            $loaders = [];

            foreach (
                ['fabric-loader', 'forge', 'neoforge', 'quilt-loader', 'liteloader']
                as $loader
            ) {
                if (isset($dependencies[$loader]) && is_string($dependencies[$loader])) {
                    $loaders[$loader] = $dependencies[$loader];
                }
            }

            $server->loadMissing('egg');
            $availableImages = $server->egg?->docker_images ?? [];

            return response()->json([
                'name' => is_string($index['name'] ?? null) ? $index['name'] : 'Unnamed pack',
                'versionId' => is_string($index['versionId'] ?? null) ? $index['versionId'] : null,
                'summary' => is_string($index['summary'] ?? null) ? $index['summary'] : null,
                'minecraft' => is_string($dependencies['minecraft'] ?? null)
                    ? $dependencies['minecraft']
                    : null,
                'loaders' => $loaders,
                'javaCompatibility' => $compatibility->resolve(
                    is_string($dependencies['minecraft'] ?? null)
                        ? $dependencies['minecraft']
                        : null,
                    $loaders,
                    $availableImages,
                ),
                'fileCount' => count($files),
                'overrides' => $overrides,
            ]);
        } finally {
            $zip->close();
        }
    }
}
