import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntrusionEventsView } from '../IntrusionEventsView';
import * as securityService from '../../../services/security';
import * as tauriUtils from '../../../utils/tauri';

// Mock services
vi.mock('../../../services/security', () => ({
  fetchIntrusionAttempts: vi.fn(),
}));

vi.mock('../../../utils/tauri', () => ({
  extractCliError: vi.fn(),
}));

describe('IntrusionEventsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render intrusion events view', async () => {
    vi.mocked(securityService.fetchIntrusionAttempts).mockResolvedValue([]);

    render(<IntrusionEventsView />);

    await waitFor(() => {
      expect(screen.getByText(/侵入検知/i)).toBeInTheDocument();
    });
  });

  it('should display loading spinner while loading', () => {
    vi.mocked(securityService.fetchIntrusionAttempts).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<IntrusionEventsView />);

    expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
  });

  it('should display intrusion attempts when loaded', async () => {
    const mockAttempts = [
      {
        id: 'intrusion-1',
        ip: '192.168.1.100',
        pattern: 'sql_injection',
        score: 0.95,
        requestPath: '/v1/chat/completions',
        userAgent: 'Mozilla/5.0',
        method: 'POST',
        createdAt: '2025-01-28T12:00:00Z',
      },
    ];

    vi.mocked(securityService.fetchIntrusionAttempts).mockResolvedValue(mockAttempts);

    render(<IntrusionEventsView />);

    await waitFor(() => {
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
      expect(screen.getByText('sql_injection')).toBeInTheDocument();
    });
  });

  it('should display error when loading fails', async () => {
    vi.mocked(securityService.fetchIntrusionAttempts).mockRejectedValue(
      new Error('Failed to fetch intrusion attempts')
    );
    vi.mocked(tauriUtils.extractCliError).mockReturnValue(null);

    render(<IntrusionEventsView />);

    await waitFor(() => {
      expect(screen.getByText(/侵入検知イベントの取得に失敗しました/i)).toBeInTheDocument();
    });
  });

  it('should apply filters when filter button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchIntrusionAttempts).mockResolvedValue([]);

    render(<IntrusionEventsView />);

    await waitFor(() => {
      expect(securityService.fetchIntrusionAttempts).toHaveBeenCalled();
    });

    const ipInput = screen.getByPlaceholderText(/IPアドレス/i);
    await user.type(ipInput, '192.168.1.100');

    const filterButton = screen.getByText(/フィルター適用/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(securityService.fetchIntrusionAttempts).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: '192.168.1.100',
        })
      );
    });
  });
});
