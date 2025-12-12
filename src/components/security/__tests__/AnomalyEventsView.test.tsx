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

describe('AnomalyEventsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render anomaly events view', async () => {
    vi.mocked(securityService.fetchAnomalyDetections).mockResolvedValue([]);

    render(<AnomalyEventsView />);

    await waitFor(() => {
      expect(screen.getByText(/異常検知/i)).toBeInTheDocument();
    });
  });

  it('should display loading spinner while loading', () => {
    vi.mocked(securityService.fetchAnomalyDetections).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AnomalyEventsView />);

    expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
  });

  it('should display anomaly detections when loaded', async () => {
    const mockDetections = [
      {
        id: 'anomaly-1',
        ip: '192.168.1.200',
        anomalyType: 'rate_limit_exceeded',
        score: 0.85,
        details: 'Too many requests',
        createdAt: '2025-01-28T12:00:00Z',
      },
    ];

    vi.mocked(securityService.fetchAnomalyDetections).mockResolvedValue(mockDetections);

    render(<AnomalyEventsView />);

    await waitFor(() => {
      expect(screen.getByText('192.168.1.200')).toBeInTheDocument();
      expect(screen.getByText(/rate_limit_exceeded/i)).toBeInTheDocument();
    });
  });

  it('should display error when loading fails', async () => {
    vi.mocked(securityService.fetchAnomalyDetections).mockRejectedValue(
      new Error('Failed to fetch anomaly detections')
    );
    vi.mocked(tauriUtils.extractCliError).mockReturnValue(null);

    render(<AnomalyEventsView />);

    await waitFor(() => {
      expect(screen.getByText(/異常検知イベントの取得に失敗しました/i)).toBeInTheDocument();
    });
  });

  it('should apply filters when filter button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchAnomalyDetections).mockResolvedValue([]);

    render(<AnomalyEventsView />);

    await waitFor(() => {
      expect(securityService.fetchAnomalyDetections).toHaveBeenCalled();
    });

    const ipInput = screen.getByPlaceholderText(/例: 192.168.1.1/i);
    await user.type(ipInput, '192.168.1.200');

    const filterButton = screen.getByText(/フィルター適用/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(securityService.fetchAnomalyDetections).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: '192.168.1.200',
        })
      );
    });
  });
});
