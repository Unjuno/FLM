import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SetupWizard } from '../SetupWizard';
import { safeInvoke } from '../../utils/tauri';

vi.mock('../../utils/tauri');
vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('SetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders firewall configuration form', () => {
    vi.mocked(safeInvoke).mockResolvedValue('windows');
    render(<SetupWizard />);
    
    expect(screen.getByText('Setup Wizard - Firewall Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText(/Operating System/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ports/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/IP Whitelist/i)).toBeInTheDocument();
  });

  it('generates firewall script preview', async () => {
    vi.mocked(safeInvoke)
      .mockResolvedValueOnce('windows')
      .mockResolvedValueOnce({
        script: '# Windows Firewall Rules\nNew-NetFirewallRule -DisplayName "FLM Proxy 8080" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080',
        display_name: 'Windows / PowerShell',
        shell: 'powershell',
      });

    render(<SetupWizard />);
    
    await waitFor(() => {
      expect(screen.getByText('Generate Script Preview')).toBeInTheDocument();
    });

    const previewButton = screen.getByText('Generate Script Preview');
    previewButton.click();

    await waitFor(() => {
      expect(screen.getByText('Script Preview')).toBeInTheDocument();
    });
  });

  it('handles script copy', async () => {
    const mockWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    vi.mocked(safeInvoke)
      .mockResolvedValueOnce('windows')
      .mockResolvedValueOnce({
        script: '# Test script',
        display_name: 'Windows / PowerShell',
        shell: 'powershell',
      });

    render(<SetupWizard />);
    
    await waitFor(() => {
      expect(screen.getByText('Generate Script Preview')).toBeInTheDocument();
    });

    const previewButton = screen.getByText('Generate Script Preview');
    previewButton.click();

    await waitFor(() => {
      expect(screen.getByText('Copy Script')).toBeInTheDocument();
    });

    const copyButton = screen.getByText('Copy Script');
    copyButton.click();

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('# Test script');
    });
  });

  it('handles firewall script application', async () => {
    vi.mocked(safeInvoke)
      .mockResolvedValueOnce('windows')
      .mockResolvedValueOnce({
        script: '# Test script',
        display_name: 'Windows / PowerShell',
        shell: 'powershell',
      })
      .mockResolvedValueOnce({
        stdout: 'Success',
        stderr: '',
        exit_code: 0,
      });

    render(<SetupWizard />);
    
    await waitFor(() => {
      expect(screen.getByText('Generate Script Preview')).toBeInTheDocument();
    });

    const previewButton = screen.getByText('Generate Script Preview');
    previewButton.click();

    await waitFor(() => {
      expect(screen.getByText('Apply Script (Requires Admin)')).toBeInTheDocument();
    });

    const applyButton = screen.getByText('Apply Script (Requires Admin)');
    applyButton.click();

    await waitFor(() => {
      expect(screen.getByText(/Firewall rules applied successfully/i)).toBeInTheDocument();
    });
  });

  it('handles firewall script application failure', async () => {
    vi.mocked(safeInvoke)
      .mockResolvedValueOnce('windows')
      .mockResolvedValueOnce({
        script: '# Test script',
        display_name: 'Windows / PowerShell',
        shell: 'powershell',
      })
      .mockResolvedValueOnce({
        stdout: '',
        stderr: 'Access denied',
        exit_code: 1,
      });

    render(<SetupWizard />);
    
    await waitFor(() => {
      expect(screen.getByText('Generate Script Preview')).toBeInTheDocument();
    });

    const previewButton = screen.getByText('Generate Script Preview');
    previewButton.click();

    await waitFor(() => {
      expect(screen.getByText('Apply Script (Requires Admin)')).toBeInTheDocument();
    });

    const applyButton = screen.getByText('Apply Script (Requires Admin)');
    applyButton.click();

    await waitFor(() => {
      expect(screen.getByText(/Firewall application failed/i)).toBeInTheDocument();
    });
  });

  it('handles firewall rollback', async () => {
    vi.mocked(safeInvoke)
      .mockResolvedValueOnce('windows')
      .mockResolvedValueOnce({
        script: '# Test script',
        display_name: 'Windows / PowerShell',
        shell: 'powershell',
      })
      .mockResolvedValueOnce({
        stdout: 'Success',
        stderr: '',
        exit_code: 0,
      })
      .mockResolvedValueOnce({
        stdout: 'Rollback success',
        stderr: '',
        exit_code: 0,
      });

    render(<SetupWizard />);
    
    await waitFor(() => {
      expect(screen.getByText('Generate Script Preview')).toBeInTheDocument();
    });

    const previewButton = screen.getByText('Generate Script Preview');
    previewButton.click();

    await waitFor(() => {
      expect(screen.getByText('Apply Script (Requires Admin)')).toBeInTheDocument();
    });

    const applyButton = screen.getByText('Apply Script (Requires Admin)');
    applyButton.click();

    await waitFor(() => {
      expect(screen.getByText('Rollback')).toBeInTheDocument();
    });

    const rollbackButton = screen.getByText('Rollback');
    rollbackButton.click();

    await waitFor(() => {
      expect(screen.getByText(/Firewall rules rolled back successfully/i)).toBeInTheDocument();
    });
  });
});
