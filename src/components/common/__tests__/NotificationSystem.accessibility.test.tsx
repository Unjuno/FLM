//! Accessibility tests for NotificationSystem component

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NotificationSystem, useNotifications } from '../NotificationSystem';
import { I18nProvider } from '../../../contexts/I18nContext';

expect.extend(toHaveNoViolations);

describe('NotificationSystem Accessibility', () => {
  beforeEach(() => {
    // Clear window.flmNotifications before each test
    delete (window as unknown as { flmNotifications?: unknown })
      .flmNotifications;
  });

  afterEach(() => {
    // Clean up after each test
    delete (window as unknown as { flmNotifications?: unknown })
      .flmNotifications;
  });

  it('should have no accessibility violations', async () => {
    const TestComponent = () => {
      const { addNotification } = useNotifications();

      return (
        <>
          <NotificationSystem />
          <button
            onClick={() =>
              addNotification({ message: 'Test', severity: 'info' })
            }
          >
            Add Notification
          </button>
        </>
      );
    };

    const { container } = render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes on notification region', async () => {
    const TestWithNotification = () => {
      const { addNotification } = useNotifications();

      React.useEffect(() => {
        addNotification({ message: 'Test notification', severity: 'info' });
      }, [addNotification]);

      return <NotificationSystem />;
    };

    render(
      <I18nProvider>
        <TestWithNotification />
      </I18nProvider>
    );

    await waitFor(() => {
      const region = screen.getByRole('region', { name: /notifications/i });
      expect(region).toHaveAttribute('aria-label', 'Notifications');
    });
  });

  it('should have proper ARIA attributes on error notifications', async () => {
    const TestWithError = () => {
      const { addNotification } = useNotifications();

      React.useEffect(() => {
        addNotification({ message: 'Error message', severity: 'error' });
      }, [addNotification]);

      return <NotificationSystem />;
    };

    render(
      <I18nProvider>
        <TestWithError />
      </I18nProvider>
    );

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });
  });

  it('should have proper ARIA attributes on info notifications', async () => {
    const TestWithInfo = () => {
      const { addNotification } = useNotifications();

      React.useEffect(() => {
        addNotification({ message: 'Info message', severity: 'info' });
      }, [addNotification]);

      return <NotificationSystem />;
    };

    render(
      <I18nProvider>
        <TestWithInfo />
      </I18nProvider>
    );

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('should have accessible dismiss button', async () => {
    const TestWithDismiss = () => {
      const { addNotification } = useNotifications();

      React.useEffect(() => {
        addNotification({ message: 'Test message', severity: 'info' });
      }, [addNotification]);

      return <NotificationSystem />;
    };

    render(
      <I18nProvider>
        <TestWithDismiss />
      </I18nProvider>
    );

    await waitFor(() => {
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toHaveAttribute('aria-label');
    });
  });
});
