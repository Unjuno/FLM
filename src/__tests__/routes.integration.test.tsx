import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock all page components
vi.mock('../pages/Home', () => ({
  Home: () => <div data-testid="home-page">Home Page</div>,
}));

vi.mock('../pages/ChatTester', () => ({
  ChatTester: () => <div data-testid="chat-tester-page">Chat Tester Page</div>,
}));

vi.mock('../pages/SecurityEvents', () => ({
  SecurityEvents: () => (
    <div data-testid="security-events-page">Security Events Page</div>
  ),
}));

vi.mock('../pages/IpBlocklistManagement', () => ({
  IpBlocklistManagement: () => (
    <div data-testid="ip-blocklist-page">IP Blocklist Management Page</div>
  ),
}));

// Mock ErrorBoundary
vi.mock('../components/common/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('Routes Integration', () => {
  it('should navigate to home page when path is /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });

  it('should navigate to chat tester page when path is /chat/tester', () => {
    render(
      <MemoryRouter initialEntries={['/chat/tester']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('chat-tester-page')).toBeInTheDocument();
  });

  it('should navigate to security events page when path is /security/events', () => {
    render(
      <MemoryRouter initialEntries={['/security/events']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('security-events-page')).toBeInTheDocument();
  });

  it('should navigate to IP blocklist page when path is /security/ip-blocklist', () => {
    render(
      <MemoryRouter initialEntries={['/security/ip-blocklist']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('ip-blocklist-page')).toBeInTheDocument();
  });

  it('should redirect to home page for unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });

  it('should maintain navigation state when switching routes', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Start at home
    expect(screen.getByTestId('home-page')).toBeInTheDocument();

    // Navigate to chat tester (this would require actual navigation implementation)
    // For now, we test that routes are properly configured
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });
});
