/**
 * @jest-environment jsdom
 */
import React from 'react';
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { SecurityIpBlocklist } from '../../src/pages/SecurityIpBlocklist';
import { SecurityIntrusion } from '../../src/pages/SecurityIntrusion';
import { SecurityAuditLogs } from '../../src/pages/SecurityAuditLogs';

const mockFetchBlockedIps = jest.fn();
const mockUnblockIp = jest.fn();
const mockClearTemporaryBlocks = jest.fn();
const mockFetchIntrusionAttempts = jest.fn();
const mockFetchAuditLogs = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();

jest.mock('../../src/services/security', () => ({
  fetchBlockedIps: (...args: unknown[]) => mockFetchBlockedIps(...args),
  unblockIp: (...args: unknown[]) => mockUnblockIp(...args),
  clearTemporaryBlocks: (...args: unknown[]) =>
    mockClearTemporaryBlocks(...args),
  fetchIntrusionAttempts: (...args: unknown[]) =>
    mockFetchIntrusionAttempts(...args),
  fetchAuditLogs: (...args: unknown[]) => mockFetchAuditLogs(...args),
}));

jest.mock('../../src/contexts/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('../../src/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

const renderWithRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Security surfaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchBlockedIps.mockResolvedValue([]);
    mockFetchIntrusionAttempts.mockResolvedValue([]);
    mockFetchAuditLogs.mockResolvedValue([]);
  });

  describe('SecurityIpBlocklist', () => {
    it('renders summary counts and disables permanent unblock buttons', async () => {
      const fixtures = [
        {
          ip: '198.51.100.10',
          failureCount: 12,
          firstFailureAt: '2025-11-24T10:00:00Z',
          blockedUntil: '2025-11-26T10:00:00Z',
          permanentBlock: false,
          lastAttempt: '2025-11-25T08:00:00Z',
        },
        {
          ip: '203.0.113.9',
          failureCount: 48,
          firstFailureAt: '2025-11-20T03:00:00Z',
          blockedUntil: null,
          permanentBlock: true,
          lastAttempt: '2025-11-25T05:00:00Z',
        },
      ];
      mockFetchBlockedIps.mockResolvedValueOnce(fixtures);

      renderWithRouter(<SecurityIpBlocklist />);

      await waitFor(() =>
        expect(screen.getByText('IPブロックリスト')).toBeInTheDocument()
      );

      const totalItem = screen
        .getByText('総ブロック数:')
        .closest('.summary-item');
      const permanentItem = screen
        .getByText('永続ブロック:')
        .closest('.summary-item');
      const tempItem = screen
        .getByText('一時ブロック:')
        .closest('.summary-item');

      expect(totalItem).not.toBeNull();
      expect(permanentItem).not.toBeNull();
      expect(tempItem).not.toBeNull();

      expect(within(totalItem!).getByText('2')).toBeInTheDocument();
      expect(within(permanentItem!).getByText('1')).toBeInTheDocument();
      expect(within(tempItem!).getByText('1')).toBeInTheDocument();

      const temporaryRow = screen.getByText('198.51.100.10').closest('tr');
      const permanentRow = screen.getByText('203.0.113.9').closest('tr');
      expect(temporaryRow).not.toBeNull();
      expect(permanentRow).not.toBeNull();

      const temporaryUnblock = within(temporaryRow!).getByRole('button', {
        name: '解除',
      });
      const permanentUnblock = within(permanentRow!).getByRole('button', {
        name: '解除',
      });

      expect(temporaryUnblock).toBeEnabled();
      expect(permanentUnblock).toBeDisabled();
    });

    it('clears all temporary blocks after confirmation', async () => {
      const fixtures = [
        {
          ip: '198.51.100.10',
          failureCount: 5,
          firstFailureAt: '2025-11-24T10:00:00Z',
          blockedUntil: '2025-11-26T10:00:00Z',
          permanentBlock: false,
          lastAttempt: '2025-11-25T08:00:00Z',
        },
      ];
      mockFetchBlockedIps
        .mockResolvedValueOnce(fixtures)
        .mockResolvedValueOnce([]);
      mockClearTemporaryBlocks.mockResolvedValueOnce(undefined);
      const confirmSpy = jest
        .spyOn(window, 'confirm')
        .mockImplementation(() => true);

      renderWithRouter(<SecurityIpBlocklist />);

      const clearButton = await screen.findByRole('button', {
        name: '一時ブロックをすべて解除',
      });
      await userEvent.click(clearButton);

      await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
      await waitFor(() =>
        expect(mockClearTemporaryBlocks).toHaveBeenCalledTimes(1)
      );
      await waitFor(() =>
        expect(mockFetchBlockedIps).toHaveBeenCalledTimes(2)
      );
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'すべての一時ブロックを解除しました'
      );
      confirmSpy.mockRestore();
    });

    it('unblocks a single IP and refreshes the grid', async () => {
      const fixtures = [
        {
          ip: '198.51.100.10',
          failureCount: 9,
          firstFailureAt: '2025-11-24T10:00:00Z',
          blockedUntil: '2025-11-26T10:00:00Z',
          permanentBlock: false,
          lastAttempt: '2025-11-25T08:00:00Z',
        },
      ];
      mockFetchBlockedIps
        .mockResolvedValueOnce(fixtures)
        .mockResolvedValueOnce([]);
      mockUnblockIp.mockResolvedValueOnce(undefined);

      renderWithRouter(<SecurityIpBlocklist />);

      const unblockButton = await screen.findByRole('button', {
        name: '解除',
      });
      await userEvent.click(unblockButton);

      await waitFor(() =>
        expect(mockUnblockIp).toHaveBeenCalledWith('198.51.100.10')
      );
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'IP 198.51.100.10 のブロックを解除しました'
      );
      await waitFor(() =>
        expect(mockFetchBlockedIps).toHaveBeenCalledTimes(2)
      );
    });
  });

  describe('SecurityIntrusion', () => {
    it('applies IP and score filters when requested', async () => {
      const attempts = [
        {
          id: 'attempt-1',
          ip: '198.51.100.50',
          pattern: 'TOR exit node',
          score: 140,
          requestPath: '/v1/chat/completions',
          userAgent: 'curl/8.6.0',
          method: 'POST',
          createdAt: '2025-11-25T10:00:00Z',
        },
      ];
      mockFetchIntrusionAttempts
        .mockResolvedValueOnce(attempts)
        .mockResolvedValue([]);

      renderWithRouter(<SecurityIntrusion />);

      await waitFor(() =>
        expect(screen.getByText('侵入検知イベント')).toBeInTheDocument()
      );
      expect(screen.getByText('198.51.100.50')).toBeInTheDocument();

      const ipInput = screen.getByLabelText('IPアドレス:') as HTMLInputElement;
      const scoreInput = screen.getByLabelText(
        '最小スコア:'
      ) as HTMLInputElement;

      fireEvent.change(ipInput, { target: { value: '203.0.113.55' } });
      fireEvent.change(scoreInput, { target: { value: '90' } });

      await userEvent.click(
        screen.getByRole('button', { name: 'フィルタ適用' })
      );

      await waitFor(() => {
        const lastCall =
          mockFetchIntrusionAttempts.mock.calls[
            mockFetchIntrusionAttempts.mock.calls.length - 1
          ];
        expect(lastCall?.[0]).toEqual(
          expect.objectContaining({
            ip: '203.0.113.55',
            minScore: 90,
            limit: 50,
            offset: 0,
          })
        );
      });
    });
  });

  describe('SecurityAuditLogs', () => {
    it('renders audit log rows with severity and status', async () => {
      const logs = [
        {
          id: 1,
          requestId: 'req-1',
          apiKeyId: 'key-1',
          endpoint: '/v1/chat',
          status: 401,
          latencyMs: 320,
          eventType: 'auth_failure',
          severity: 'high',
          ip: '203.0.113.1',
          details: 'Invalid API key',
          createdAt: '2025-11-25T09:00:00Z',
        },
        {
          id: 2,
          requestId: 'req-2',
          apiKeyId: null,
          endpoint: '/v1/logs',
          status: 200,
          latencyMs: 45,
          eventType: 'fetch_logs',
          severity: 'low',
          ip: '198.51.100.5',
          details: null,
          createdAt: '2025-11-25T09:05:00Z',
        },
      ];
      mockFetchAuditLogs.mockResolvedValueOnce(logs);

      renderWithRouter(<SecurityAuditLogs />);

      await waitFor(() =>
        expect(screen.getByText('監査ログ')).toBeInTheDocument()
      );

      expect(screen.getByText('/v1/chat')).toBeInTheDocument();
      expect(screen.getByText('/v1/logs')).toBeInTheDocument();
      expect(screen.getByText('auth_failure')).toBeInTheDocument();
      expect(screen.getByText('fetch_logs')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('low')).toBeInTheDocument();
      expect(screen.getByText('401')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });

    it('passes filter form state to fetchAuditLogs and resets inputs', async () => {
      const capturedFilters: Record<string, unknown>[] = [];
      mockFetchAuditLogs.mockImplementation(async (filter) => {
        capturedFilters.push({ ...(filter as Record<string, unknown>) });
        return [];
      });

      renderWithRouter(<SecurityAuditLogs />);

      await waitFor(() => expect(capturedFilters.length).toBeGreaterThan(0));

      const eventTypeInput = screen.getByLabelText(
        'イベントタイプ:'
      ) as HTMLInputElement;
      const severitySelect = screen.getByLabelText(
        '重要度:'
      ) as HTMLSelectElement;
      const ipInput = screen.getByLabelText('IPアドレス:') as HTMLInputElement;

      fireEvent.change(eventTypeInput, { target: { value: 'intrusion' } });
      expect(eventTypeInput.value).toBe('intrusion');

      await userEvent.selectOptions(severitySelect, 'critical');
      expect(severitySelect.value).toBe('critical');

      fireEvent.change(ipInput, { target: { value: '198.51.100.5' } });
      expect(ipInput.value).toBe('198.51.100.5');

      const callsBeforeApply = capturedFilters.length;
      await userEvent.click(
        screen.getByRole('button', { name: 'フィルタ適用' })
      );

      await waitFor(() =>
        expect(capturedFilters.length).toBeGreaterThan(callsBeforeApply)
      );

      const latestFilter = capturedFilters[capturedFilters.length - 1];
      expect(latestFilter).toEqual(
        expect.objectContaining({
          eventType: 'intrusion',
        })
      );

      const callsBeforeClear = capturedFilters.length;
      await userEvent.click(screen.getByRole('button', { name: 'クリア' }));

      await waitFor(() =>
        expect(capturedFilters.length).toBeGreaterThan(callsBeforeClear)
      );
    });
  });
});

