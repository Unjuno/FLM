import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

// Mock child components to simplify testing
vi.mock('../pages/Home', () => ({
  Home: () => <div>Home Page</div>,
}));

vi.mock('../pages/ChatTester', () => ({
  ChatTester: () => <div>Chat Tester Page</div>,
}));

vi.mock('../pages/SecurityEvents', () => ({
  SecurityEvents: () => <div>Security Events Page</div>,
}));

vi.mock('../pages/IpBlocklistManagement', () => ({
  IpBlocklistManagement: () => <div>IP Blocklist Management Page</div>,
}));

vi.mock('../components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

describe('App', () => {
  it('should render app with routing', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('should render app container', () => {
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(container.querySelector('.app')).toBeInTheDocument();
  });

  it('should wrap routes with AppLayout', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });
});
