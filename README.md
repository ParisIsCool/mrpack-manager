# Modrinth Pack Manager

A Pterodactyl panel extension, scaffolded by `p:extension:make`.

## Layout

- `extension.json`: the manifest; `provider` is the boot entry point.
- `src/`: PSR-4 PHP (`MrpackManager\`), booted through `src/MrpackManagerProvider.php`.
  Runs fully trusted, in-process, with the same middleware stacks core uses.
- `composer.json`: the PSR-4 map the panel and your editor read. Composer
  dependencies go here too; the panel loads `vendor/autoload.php` when it exists.
- `routes/client.php`: mounted at `/api/client/extensions/mrpack-manager`. Add
  `routes/admin.php` / `routes/application.php` for the other API surfaces.
- `database/migrations/`: extension-owned migrations. Prefix tables with
  `ext_mrpack-manager_` by convention.

## Frontend

The UI entry (`src/client/index.tsx`) is compiled against `@pterodactyl/sdk` to a
single prebuilt ESM file — the panel dynamic-imports it at boot and resolves
React, TanStack Query, and the SDK through its import map, so the bundle stays
tiny and shares the panel's runtime.

```sh
npm install
npm run build        # or: npm run dev (rebuild on change)
npm run typecheck
npm test
```

`dist/client.js` must exist before the extension is enabled; it is published to
`/assets/extensions/mrpack-manager/` on install/enable.

A `file:` SDK dependency is a link into the panel checkout. `preserveSymlinks` in
`tsconfig.json` makes the SDK's types use this package's React and TanStack Query
instead of the panel's copies; keep it.


Screen metadata is declared in `extension.json` under `ui.screens`. The client entry registers the implementation with `screens.register('main', importer)`. Keep both IDs in sync. The panel renders while extensions load; errors and loading are isolated per mount. Reload the panel after enabling, disabling, updating, or changing extension configuration.

Tests use the real SDK with `createExtensionTestHost`, including the host query cache,
router, permissions, and websocket events. CI runs types, tests, and a production build.

To generate a client for this extension, export its routes from the panel after Scribe
generation, then run the generator in this package:

```sh
php /path/to/panel/scripts/generate-extension-openapi.php mrpack-manager /path/to/panel/storage/app/private/scribe/openapi.yaml /path/to/mrpack-manager/openapi.yaml
npm run api:generate
```

The generated client uses `@pterodactyl/sdk/api` and the panel's shared authentication
and transport. Commit generated sources and the OpenAPI input with your extension.
Use `p:extension:doctor`, `p:extension:dev --watch`, and `p:extension:pack` from the panel
for validation, successful-build publishing, and runtime-only packaging.

`src/client/styles.css` compiles Tailwind with this extension's own prefix, `mm`
(`ui.prefix` in `extension.json`), and without resetting the panel, so its utilities never
collide with the panel's or another extension's: write `mm:flex`, `mm:lg:hidden`,
`mm:hover:bg-accent`, `mm:mt-4!` and `@apply mm:flex`. Unprefixed classes are not in
the extension's stylesheet, and `p:extension:doctor` and the installer reject a build whose
prefix is not the declared one. The SDK theme maps the same live tokens as core, so use
`mm:bg-card`, `mm:text-foreground`, and `mm:border-border` instead of palette
colors. Pass `prefix: 'mm'` to the SDK test hosts when a test asserts merged classes.
CSS loads before extension setup.

## Java compatibility inspection

Pack inspection reads `modrinth.index.json` and reports the Minecraft server
Java recommendation separately from the Java runtime required by the uploaded
`mrpack4server` launcher. The current `mrpack4server-0.5.1` is downloaded using the release's runtime-specific
asset: `jvm8` for server Java 8+, `jvm16` for server Java 16+, or `jvm17`
for server Java 17+. The selected launcher is uploaded as `server.jar`.

The server policy covers Java 8 for Minecraft 1.7 through 1.16, Java 16 for
1.17, Java 17 for 1.18 through 1.20.4, and Java 21 for 1.20.5 through 1.21.
Docker images are recommended only when the current egg offers the matching
verified Pterodactyl yolks image. Inspection never changes the server image or
executes the launcher.

Run `php artisan p:extension:types /path/to/mrpack-manager` to generate literal screen ids and
configuration keys after loading the provider. Declare frontend settings with
`->frontend()->frontendType('string')` and add `->public()` to those guests may read; use
`defineConfiguredExtension` with a runtime
parser and the generated types. Secret definitions use `->secret()` and stay backend-only.
## Develop

```sh
php artisan p:extension:dev /path/to/mrpack-manager --enable
```

This builds the extension, installs it from where it is and enables it; `--watch` republishes each
change. Package for distribution with `p:extension:pack`, after building `dist/` and, if
the extension has Composer dependencies, running
`composer install --no-dev --optimize-autoloader`:

```sh
php artisan p:extension:pack /path/to/mrpack-manager
```
