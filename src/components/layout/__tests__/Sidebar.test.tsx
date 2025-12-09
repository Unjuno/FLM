import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar';

// Mock router - only mock useNavigate, keep useLocation from MemoryRouter
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    // useLocation is provided by MemoryRouter, so we don't mock it
  };
});

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSidebar = (initialPath = '/', props = {}) => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Sidebar {...props} />
      </MemoryRouter>
    );
  };

  it('should render sidebar with navigation items', () => {
    renderSidebar();

    expect(screen.getByText('ホーム')).toBeInTheDocument();
    expect(screen.getByText('Chat Tester')).toBeInTheDocument();
    expect(screen.getByText('セキュリティイベント')).toBeInTheDocument();
    expect(screen.getByText('IPブロックリスト')).toBeInTheDocument();
  });

  it('should render sidebar title when not collapsed', () => {
    renderSidebar();

    expect(screen.getByText('メニュー')).toBeInTheDocument();
  });

  it('should hide sidebar title when collapsed', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const toggleButton = screen.getByLabelText('サイドバーを折りたたむ');
    await user.click(toggleButton);

    expect(screen.queryByText('メニュー')).not.toBeInTheDocument();
  });

  it('should toggle collapse state when toggle button is clicked', async () => {
    const user = userEvent.setup();
    const onCollapseChange = vi.fn();

    renderSidebar('/', { onCollapseChange });

    const toggleButton = screen.getByLabelText('サイドバーを折りたたむ');
    await user.click(toggleButton);

    expect(onCollapseChange).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText('サイドバーを展開')).toBeInTheDocument();

    await user.click(toggleButton);

    expect(onCollapseChange).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText('サイドバーを折りたたむ')).toBeInTheDocument();
  });

  it('should start collapsed when defaultCollapsed is true', () => {
    renderSidebar('/', { defaultCollapsed: true });

    expect(screen.getByLabelText('サイドバーを展開')).toBeInTheDocument();
    expect(screen.queryByText('メニュー')).not.toBeInTheDocument();
  });

  it('should navigate when navigation item is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const homeButton = screen.getByLabelText('ホーム');
    await user.click(homeButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should highlight active navigation item', () => {
    renderSidebar('/chat/tester');

    const chatTesterButton = screen.getByLabelText('Chat Tester');
    expect(chatTesterButton).toHaveClass('active');
    expect(chatTesterButton).toHaveAttribute('aria-current', 'page');
  });

  it('should highlight active navigation item for nested paths', () => {
    renderSidebar('/security/events');

    const securityEventsButton = screen.getByLabelText('セキュリティイベント');
    expect(securityEventsButton).toHaveClass('active');
  });

  it('should apply custom className', () => {
    const { container } = renderSidebar('/', { className: 'custom-sidebar' });

    expect(container.firstChild).toHaveClass('app-sidebar', 'custom-sidebar');
  });

  it('should hide navigation labels when collapsed', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const toggleButton = screen.getByLabelText('サイドバーを折りたたむ');
    await user.click(toggleButton);

    expect(screen.queryByText('ホーム')).not.toBeInTheDocument();
    expect(screen.queryByText('Chat Tester')).not.toBeInTheDocument();
  });
});
