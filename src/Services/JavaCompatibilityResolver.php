<?php

declare(strict_types=1);

namespace MrpackManager\Services;

final class JavaCompatibilityResolver
{
    /**
     * These image values are the images shipped by the Minecraft eggs in this
     * panel. An image is returned only when the current egg offers that value.
     *
     * @var array<int, string>
     */
    private const DOCKER_IMAGES = [
        8 => 'ghcr.io/pterodactyl/yolks:java_8',
        11 => 'ghcr.io/pterodactyl/yolks:java_11',
        16 => 'ghcr.io/pterodactyl/yolks:java_16',
        17 => 'ghcr.io/pterodactyl/yolks:java_17',
        21 => 'ghcr.io/pterodactyl/yolks:java_21',
        25 => 'ghcr.io/pterodactyl/yolks:java_25',
    ];

    /**
     * mrpack4server 0.5.1 was inspected from its release JAR. Class-file
     * major 65 is Java 21; this is deliberately independent of server Java.
     */
    private static function launcher(int|null $java): array
    {
        $variant = match (true) {
            $java >= 17 => 'jvm17',
            $java >= 16 => 'jvm16',
            default => 'jvm8',
        };

        return [
            'name' => 'mrpack4server-0.5.1-' . $variant . '.jar',
            'minimumJava' => match ($variant) {
                'jvm17' => 17,
                'jvm16' => 16,
                default => 8,
            },
            'classFileVersion' => match ($variant) {
                'jvm17' => 61,
                'jvm16' => 60,
                default => 52,
            },
            'status' => 'known',
        ];
    }

    /**
     * @param array<string, string> $loaders
     * @param array<string, string> $availableImages
     * @return array<string, mixed>
     */
    public function resolve(
        ?string $minecraft,
        array $loaders = [],
        array $availableImages = [],
    ): array {
        $base = [
            'minecraft' => $minecraft,
            'loaders' => $loaders,
            'server' => [
                'java' => null,
                'dockerImage' => null,
            ],
            'launcher' => self::launcher(null),
            'status' => 'uncertain',
            'reason' => 'Minecraft version metadata is missing or unknown.',
        ];

        if ($minecraft === null || !preg_match(
            '/^(?<major>\d+)\.(?<minor>\d+)(?:\.(?<patch>\d+))?(?:[-+].*)?$/',
            trim($minecraft),
            $matches,
        )) {
            $base['status'] = $minecraft === null ? 'uncertain' : 'unsupported';
            $base['reason'] = $minecraft === null
                ? 'The pack does not declare a Minecraft version.'
                : 'The declared Minecraft version is not recognized.';

            return $base;
        }

        $major = (int) $matches['major'];
        $minor = (int) $matches['minor'];
        $patch = isset($matches['patch']) ? (int) $matches['patch'] : 0;

        if ($major !== 1) {
            $base['status'] = 'uncertain';
            $base['reason'] = 'This Minecraft version is outside the verified compatibility policy.';

            return $base;
        }

        $java = match (true) {
            $minor <= 16 => 8,
            $minor === 17 => 16,
            $minor === 18 => 17,
            $minor === 19 => 17,
            $minor === 20 && $patch <= 4 => 17,
            $minor === 20 => 21,
            $minor === 21 => 21,
            default => null,
        };

        if ($java === null) {
            $base['reason'] = 'This Minecraft version is newer than the verified compatibility policy.';

            return $base;
        }

        $image = self::DOCKER_IMAGES[$java] ?? null;
        $available = array_map('strtolower', array_values($availableImages));
        $image = $image !== null && in_array(strtolower($image), $available, true)
            ? $image
            : null;

        $base['server'] = [
            'java' => $java,
            'dockerImage' => $image,
        ];
        $base['launcher'] = self::launcher($java);
        $base['status'] = 'known';
        $base['reason'] = $image === null
            ? 'The server Java version is known, but the current egg does not offer a verified matching Docker image.'
            : 'Compatibility was determined from the Minecraft version and the current egg image list.';

        return $base;
    }
}
