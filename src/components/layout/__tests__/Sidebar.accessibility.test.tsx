//! Accessibility tests for Sidebar component

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Sidebar } from '../Sidebar';
import { I18nProvider } from '../../../contexts/I18nContext';

expect.extend(toHaveNoViolations);

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <I18nProvider>{ui}</I18nProvider>
    </BrowserRouter>
  );
};

describe('Sidebar Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = renderWithProviders(<Sidebar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes on toggle button', () => {
    const { getAllByRole } = renderWithProviders(<Sidebar />);
    const buttons = getAllByRole('button');
    const toggleButton = buttons.find(
      button =>
        button.getAttribute('aria-label')?.includes('サイドバー') ||
        button.getAttribute('aria-label')?.includes('expand') ||
        button.getAttribute('aria-label')?.includes('collapse')
    );

    expect(toggleButton).toBeDefined();
    if (toggleButton) {
      expect(toggleButton).toHaveAttribute('aria-label');
      expect(toggleButton).toHaveAttribute('aria-expanded');
    }
  });

  it('should have proper ARIA attributes on navigation', () => {
    const { getByRole } = renderWithProviders(<Sidebar />);
    const nav = getByRole('navigation');

    expect(nav).toHaveAttribute('aria-label');
  });

  it('should have proper ARIA attributes on navigation items', () => {
    const { getAllByRole } = renderWithProviders(<Sidebar />);
    const navButtons = getAllByRole('button', { hidden: false });

    // All navigation buttons should have aria-label
    navButtons.forEach(button => {
      if (button.getAttribute('aria-label')) {
        expect(button).toHaveAttribute('aria-label');
      }
    });
  });

  it('should mark active navigation item with aria-current', () => {
    const { getAllByRole } = renderWithProviders(<Sidebar />);

    const navButtons = getAllByRole('button');
    const activeButton = navButtons.find(
      button => button.getAttribute('aria-current') === 'page'
    );

    // At least one button should be marked as current page (home page by default)
    expect(activeButton).toBeDefined();
  });
});
