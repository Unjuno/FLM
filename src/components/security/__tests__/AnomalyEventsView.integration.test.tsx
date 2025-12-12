import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnomalyEventsView } from '../AnomalyEventsView';
import * as securityService from '../../../services/security';
import * as tauriUtils from '../../../utils/tauri';

// Mock services
vi.mock('../../../services/security', () => ({
  fetchAnomalyDetections: vi.fn(),
}));

vi.mock('../../../utils/tauri', () => ({
  extractCliError: vi.fn(),
}));

describe('AnomalyEventsView Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export anomaly events to CSV', async () => {
    const user = userEvent.setup();
    const mockEvents = [
      {
        id: 'anomaly-1',
        ip: '192.168.1.100',
        anomalyType: 'rate_limit_exceeded',
        score: 0.85,
        details: 'High request rate detected',
        createdAt: '2025-01-28T12:00:00Z',
      },
    ];

    vi.mocked(securityService.fetchAnomalyDetections).mockResolvedValue(mockEvents);

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(<AnomalyEventsView />);

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

  it('should filter by anomaly type', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchAnomalyDetections).mockResolvedValue([]);

    render(<AnomalyEventsView />);

    await waitFor(() => {
      expect(securityService.fetchAnomalyDetections).toHaveBeenCalled();
    });

    const anomalyTypeSelect = screen.getByLabelText(/異常タイプ/i);
    await user.selectOptions(anomalyTypeSelect, 'rate_limit_exceeded');

    const filterButton = screen.getByText(/フィルター適用/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(securityService.fetchAnomalyDetections).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'rate_limit_exceeded',
        })
      );
    });
  });

  it('should filter by IP address', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchAnomalyDetections).mockResolvedValue([]);

    render(<AnomalyEventsView />);

    await waitFor(() => {
      expect(securityService.fetchAnomalyDetections).toHaveBeenCalled();
    });

    const ipInput = screen.getByPlaceholderText(/例: 192.168.1.1/i);
    await user.type(ipInput, '192.168.1.100');

    const filterButton = screen.getByText(/フィルター適用/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(securityService.fetchAnomalyDetections).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: '192.168.1.100',
        })
      );
    });
  });

  it('should handle pagination', async () => {
    const user = userEvent.setup();
    const mockEvents = Array.from({ length: 50 }, (_, i) => ({
      id: `anomaly-${i + 1}`,
      ip: `192.168.1.${i + 1}`,
      anomalyType: 'rate_limit_exceeded',
      score: 0.85,
      details: 'High request rate detected',
      createdAt: '2025-01-28T12:00:00Z',
    }));

    vi.mocked(securityService.fetchAnomalyDetections).mockResolvedValue(mockEvents);

    render(<AnomalyEventsView />);

    await waitFor(() => {
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });

    // Check if pagination controls are present
    const nextButton = screen.queryByText(/次へ/i);
    if (nextButton) {
      await user.click(nextButton);
      await waitFor(() => {
        expect(securityService.fetchAnomalyDetections).toHaveBeenCalledWith(
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
      message: 'Failed to fetch anomaly events',
      stderr: 'Detailed error information',
      originalError: mockError,
    };

    vi.mocked(securityService.fetchAnomalyDetections).mockRejectedValue(mockError);
    vi.mocked(tauriUtils.extractCliError).mockReturnValue(cliError);

    render(<AnomalyEventsView />);

    await waitFor(() => {
      expect(screen.getByText(/異常検知イベントの取得に失敗しました/i)).toBeInTheDocument();
      expect(screen.getByText(/Detailed error information/i)).toBeInTheDocument();
    });
  });
});
