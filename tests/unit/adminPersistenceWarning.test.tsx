import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ManageGames from '../../src/pages/admin/ManageGames';
import ManageLevels from '../../src/pages/admin/ManageLevels';
import Questions from '../../src/pages/admin/Questions';

const { useAdminDataMock } = vi.hoisted(() => ({
  useAdminDataMock: vi.fn(),
}));

vi.mock('../../src/context/AdminDataContext', () => ({
  useAdminData: useAdminDataMock,
}));

vi.mock('../../src/pages/admin/ScorePolicyManager', () => ({
  default: () => null,
}));

const persistenceWarning = 'Saved successfully, but the catalog could not be refreshed: catalog unavailable';
let adminData: ReturnType<typeof createAdminData>;

function createAdminData(error: string | null = persistenceWarning) {
  return {
    games: [{
      id: 'game-1',
      name: 'Test game',
      description: '',
      status: 'published' as const,
      levels: 0,
      createdAt: 'Today',
    }],
    levels: [],
    questions: [],
    isLoading: false,
    error,
    catalogWarnings: [],
    refreshCatalog: vi.fn().mockResolvedValue(undefined),
    addGame: vi.fn().mockResolvedValue(undefined),
    updateGame: vi.fn().mockResolvedValue(undefined),
    deleteGame: vi.fn().mockResolvedValue(undefined),
    publishGame: vi.fn().mockResolvedValue(undefined),
    unpublishGame: vi.fn().mockResolvedValue(undefined),
    archiveGame: vi.fn().mockResolvedValue(undefined),
    addLevel: vi.fn().mockResolvedValue(undefined),
    updateLevel: vi.fn().mockResolvedValue(undefined),
    deleteLevel: vi.fn().mockResolvedValue(undefined),
    publishLevel: vi.fn().mockResolvedValue(undefined),
    unpublishLevel: vi.fn().mockResolvedValue(undefined),
    archiveLevel: vi.fn().mockResolvedValue(undefined),
    addQuestion: vi.fn().mockResolvedValue(undefined),
    updateQuestion: vi.fn().mockResolvedValue(undefined),
    deleteQuestion: vi.fn().mockResolvedValue(undefined),
    deactivateQuestion: vi.fn().mockResolvedValue(undefined),
    reactivateQuestion: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  adminData = createAdminData();
  useAdminDataMock.mockReturnValue(adminData);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function expectSavedWarning() {
  const alert = screen.getByRole('alert');
  expect(alert.textContent).toContain(persistenceWarning);
  expect(alert.textContent).toContain('Saved successfully');
}

function expectUnambiguousSavedWarning() {
  const alert = screen.getByRole('alert');
  expect(alert.textContent).toContain(persistenceWarning);
  expect(alert.textContent).not.toContain('Unable to load or update');
}

describe('Admin persistence warnings', () => {
  it('closes the delete dialog and starts the row pop-out before deleting a Game', async () => {
    adminData = createAdminData(null);
    useAdminDataMock.mockReturnValue(adminData);
    render(<ManageGames />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Test game').closest('.ui-pop-out')).toBeTruthy();
    expect(adminData.deleteGame).not.toHaveBeenCalled();

    await waitFor(() => expect(adminData.deleteGame).toHaveBeenCalledOnce());
  });

  it('shows the saved warning after a Game save closes the modal and resets form errors', async () => {
    render(<ManageGames />);
    fireEvent.click(screen.getByRole('button', { name: /New game/i }));

    let dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create game' }));
    expect(within(dialog).getByText('Game name is required.')).toBeTruthy();

    fireEvent.change(within(dialog).getByPlaceholderText(/Garden Whispers/), {
      target: { value: 'Garden Whispers' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create game' }));

    await waitFor(() => expect(adminData.addGame).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expectUnambiguousSavedWarning();
  });

  it('keeps a genuine Game save failure distinguishable from a refresh warning', async () => {
    const writeError = 'The game was not saved.';
    adminData = createAdminData(writeError);
    adminData.addGame.mockRejectedValue(new Error(writeError));
    useAdminDataMock.mockReturnValue(adminData);

    render(<ManageGames />);
    fireEvent.click(screen.getByRole('button', { name: /New game/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByPlaceholderText(/Garden Whispers/), {
      target: { value: 'Garden Whispers' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create game' }));

    expect(await within(dialog).findByText(writeError)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).not.toContain('Saved successfully');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows the saved warning after a Level save closes the modal and resets form errors', async () => {
    render(<ManageLevels />);
    fireEvent.click(screen.getByRole('button', { name: /New level/i }));

    let dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create level' }));
    expect(within(dialog).getByText('Level title is required.')).toBeTruthy();

    fireEvent.change(within(dialog).getByPlaceholderText('Level title'), {
      target: { value: 'First level' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create level' }));

    await waitFor(() => expect(adminData.addLevel).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expectUnambiguousSavedWarning();
  });

  it('suggests and validates the duration allowed for the selected difficulty', async () => {
    adminData = createAdminData(null);
    useAdminDataMock.mockReturnValue(adminData);
    render(<ManageLevels />);
    fireEvent.click(screen.getByRole('button', { name: /New level/i }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByPlaceholderText('Level title'), {
      target: { value: 'Medium level' },
    });
    fireEvent.change(within(dialog).getAllByRole('combobox')[0], {
      target: { value: 'Medium' },
    });

    const timeInput = within(dialog).getByRole('spinbutton', { name: 'Time limit in seconds' }) as HTMLInputElement;
    expect(timeInput.value).toBe('90');

    fireEvent.change(timeInput, { target: { value: '91' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create level' }));
    expect(within(dialog).getByText('Medium levels need 61 to 90 seconds.')).toBeTruthy();
    expect(adminData.addLevel).not.toHaveBeenCalled();

    fireEvent.change(timeInput, { target: { value: '75' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create level' }));
    await waitFor(() => expect(adminData.addLevel).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 'Medium', time: 75 })));
  });

  it('keeps a genuine Level save failure distinguishable from a refresh warning', async () => {
    const writeError = 'The level was not saved.';
    adminData = createAdminData(writeError);
    adminData.addLevel.mockRejectedValue(new Error(writeError));
    useAdminDataMock.mockReturnValue(adminData);

    render(<ManageLevels />);
    fireEvent.click(screen.getByRole('button', { name: /New level/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByPlaceholderText('Level title'), {
      target: { value: 'First level' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create level' }));

    expect(await within(dialog).findByText(writeError)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).not.toContain('Saved successfully');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('renders the Context warning on Questions in an alert', () => {
    render(
      <MemoryRouter>
        <Questions />
      </MemoryRouter>,
    );

    expectSavedWarning();
  });
});