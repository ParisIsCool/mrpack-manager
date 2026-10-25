
/** @vitest-environment jsdom */
import { fireEvent, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('@pterodactyl/sdk', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@pterodactyl/sdk')>();

    return {
        ...actual,
        useCurrentServerRequired: () => ({
            attributes: {
                identifier: 'test-server',
            },
        }),
    };
});

import ServerScreen from './ServerScreen';

afterEach(() => {
    cleanup();
});

test('renders the Modrinth Pack Manager screen', () => {
    render(<ServerScreen />);

fireEvent.click(
    screen.getByRole('button', { name: 'Import Modpack' }),
);

expect(
    screen.getByLabelText('Drop a modpack here or browse files'),
).toBeTruthy();
});
