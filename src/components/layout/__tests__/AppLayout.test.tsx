import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppLayout } from '../AppLayout';

// Mock Sidebar
vi.mock('../Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

describe('AppLayout', () => {
  it('should render app layout with children', () => {
    render(
      <BrowserRouter>
        <AppLayout>
          <div>Test Content</div>
        </AppLayout>
      </BrowserRouter>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <BrowserRouter>
        <AppLayout className="custom-class">
          <div>Test Content</div>
        </AppLayout>
      </BrowserRouter>
    );

    expect(container.firstChild).toHaveClass('app-layout', 'custom-class');
  });

  it('should render without custom className', () => {
    const { container } = render(
      <BrowserRouter>
        <AppLayout>
          <div>Test Content</div>
        </AppLayout>
      </BrowserRouter>
    );

    expect(container.firstChild).toHaveClass('app-layout');
  });
});
