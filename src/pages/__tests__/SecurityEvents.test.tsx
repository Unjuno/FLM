import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { SecurityEvents } from '../SecurityEvents';

// Mock security components
vi.mock('../../components/security/AuditLogsView', () => ({
  AuditLogsView: () => <div data-testid="audit-logs-view">Audit Logs View</div>,
}));

vi.mock('../../components/security/IntrusionEventsView', () => ({
  IntrusionEventsView: () => <div data-testid="intrusion-events-view">Intrusion Events View</div>,
}));

vi.mock('../../components/security/AnomalyEventsView', () => ({
  AnomalyEventsView: () => <div data-testid="anomaly-events-view">Anomaly Events View</div>,
}));

describe('SecurityEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSecurityEvents = () => {
    return render(
      <BrowserRouter>
        <SecurityEvents />
      </BrowserRouter>
    );
  };

  it('should render security events page with title', () => {
    renderSecurityEvents();

    expect(screen.getByText('セキュリティイベント')).toBeInTheDocument();
  });

  it('should render all tabs', () => {
    renderSecurityEvents();

    expect(screen.getByText('監査ログ')).toBeInTheDocument();
    expect(screen.getByText('侵入検知')).toBeInTheDocument();
    expect(screen.getByText('異常検知')).toBeInTheDocument();
  });

  it('should show audit logs view by default', () => {
    renderSecurityEvents();

    expect(screen.getByTestId('audit-logs-view')).toBeInTheDocument();
    expect(screen.queryByTestId('intrusion-events-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('anomaly-events-view')).not.toBeInTheDocument();
  });

  it('should switch to intrusion events view when tab is clicked', async () => {
    const user = userEvent.setup();
    renderSecurityEvents();

    const intrusionTab = screen.getByText('侵入検知');
    await user.click(intrusionTab);

    expect(screen.getByTestId('intrusion-events-view')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-logs-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('anomaly-events-view')).not.toBeInTheDocument();
  });

  it('should switch to anomaly events view when tab is clicked', async () => {
    const user = userEvent.setup();
    renderSecurityEvents();

    const anomalyTab = screen.getByText('異常検知');
    await user.click(anomalyTab);

    expect(screen.getByTestId('anomaly-events-view')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-logs-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('intrusion-events-view')).not.toBeInTheDocument();
  });

  it('should switch back to audit logs view when tab is clicked', async () => {
    const user = userEvent.setup();
    renderSecurityEvents();

    // Switch to intrusion first
    await user.click(screen.getByText('侵入検知'));
    expect(screen.getByTestId('intrusion-events-view')).toBeInTheDocument();

    // Switch back to audit
    await user.click(screen.getByText('監査ログ'));
    expect(screen.getByTestId('audit-logs-view')).toBeInTheDocument();
    expect(screen.queryByTestId('intrusion-events-view')).not.toBeInTheDocument();
  });

  it('should apply active class to active tab', async () => {
    const user = userEvent.setup();
    renderSecurityEvents();

    const auditTab = screen.getByText('監査ログ');
    const intrusionTab = screen.getByText('侵入検知');

    expect(auditTab).toHaveClass('active');
    expect(intrusionTab).not.toHaveClass('active');

    await user.click(intrusionTab);

    expect(auditTab).not.toHaveClass('active');
    expect(intrusionTab).toHaveClass('active');
  });
});
