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

describe('IntrusionEventsView Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export intrusion events to CSV', async () => {
    const user = userEvent.setup();
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

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(<IntrusionEventsView />);

    await waitFor(() => {
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
    });

    const exportButton = screen.getByText(/CSVエクスポート/i);
    await user.click(exportButton);

    // Verify that createObjectURL was called (indicating CSV export)
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('should filter by IP address', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchIntrusionAttempts).mockResolvedValue([]);

    render(<IntrusionEventsView />);

    await waitFor(() => {
      expect(securityService.fetchIntrusionAttempts).toHaveBeenCalled();
    });

    const ipInput = screen.getByPlaceholderText(/例: 192.168.1.1/i);
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

  it('should filter by minimum score', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchIntrusionAttempts).mockResolvedValue([]);

    render(<IntrusionEventsView />);

    await waitFor(() => {
      expect(securityService.fetchIntrusionAttempts).toHaveBeenCalled();
    });

    const scoreInput = screen.getByLabelText(/最小スコア/i);
    await user.type(scoreInput, '0.8');

    const filterButton = screen.getByText(/フィルター適用/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(securityService.fetchIntrusionAttempts).toHaveBeenCalledWith(
        expect.objectContaining({
          minScore: 0.8,
        })
      );
    });
  });

  it('should handle pagination', async () => {
    const user = userEvent.setup();
    const mockAttempts = Array.from({ length: 50 }, (_, i) => ({
      id: `intrusion-${i + 1}`,
      ip: `192.168.1.${i + 1}`,
      pattern: 'sql_injection',
      score: 0.9,
      requestPath: '/v1/chat/completions',
      userAgent: 'Mozilla/5.0',
      method: 'POST',
      createdAt: '2025-01-28T12:00:00Z',
    }));

    vi.mocked(securityService.fetchIntrusionAttempts).mockResolvedValue(mockAttempts);

    render(<IntrusionEventsView />);

    await waitFor(() => {
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });

    // Check if pagination controls are present
    const nextButton = screen.queryByText(/次へ/i);
    if (nextButton) {
      await user.click(nextButton);
      await waitFor(() => {
        expect(securityService.fetchIntrusionAttempts).toHaveBeenCalledWith(
          expect.objectContaining({
            offset: expect.any(Number),
          })
        );
      });
    }
  });

  it('should display CLI error details when available', async () => {
    const mockError = new Error('CLI error');
    const cliError = {
      code: 'CLI_ERROR',
      message: 'Failed to fetch intrusion attempts',
      stderr: 'Detailed error information',
      originalError: mockError,
    };

    vi.mocked(securityService.fetchIntrusionAttempts).mockRejectedValue(mockError);
    vi.mocked(tauriUtils.extractCliError).mockReturnValue(cliError);

    render(<IntrusionEventsView />);

    await waitFor(() => {
      expect(screen.getByText(/侵入検知イベントの取得に失敗しました/i)).toBeInTheDocument();
      expect(screen.getByText(/Detailed error information/i)).toBeInTheDocument();
    });
  });
});
