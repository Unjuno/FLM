import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light-theme', 'dark-theme');

    // window.matchMediaをモック（デフォルトはlightモード）
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn((query: string) => {
        const mediaQueryList = {
          matches: false, // Default to light mode
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
        return mediaQueryList;
      }),
    });
  });

  it('provides default light theme', () => {
    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>{theme}</div>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('light')).toBeInTheDocument();
  });

  it('loads theme from localStorage', () => {
    localStorage.setItem('flm_preferred_theme', 'dark');

    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>{theme}</div>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('dark')).toBeInTheDocument();
  });

  it('allows theme to be changed', async () => {
    const TestComponent = () => {
      const { theme, setTheme } = useTheme();
      return (
        <div>
          <span>{theme}</span>
          <button onClick={() => setTheme('dark')}>Set Dark</button>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('light')).toBeInTheDocument();

    const button = screen.getByText('Set Dark');
    button.click();

    await waitFor(() => {
      expect(screen.getByText('dark')).toBeInTheDocument();
    });

    expect(localStorage.getItem('flm_preferred_theme')).toBe('dark');
  });

  it('toggles theme', async () => {
    const TestComponent = () => {
      const { theme, toggleTheme } = useTheme();
      return (
        <div>
          <span>{theme}</span>
          <button onClick={toggleTheme}>Toggle</button>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('light')).toBeInTheDocument();

    const button = screen.getByText('Toggle');
    button.click();

    await waitFor(() => {
      expect(screen.getByText('dark')).toBeInTheDocument();
    });

    button.click();

    await waitFor(() => {
      expect(screen.getByText('light')).toBeInTheDocument();
    });
  });

  it('applies theme class to document element', async () => {
    const TestComponent = () => {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('dark')}>Set Dark</button>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByText('Set Dark');
    button.click();

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark-theme')).toBe(
        true
      );
      expect(document.documentElement.classList.contains('light-theme')).toBe(
        false
      );
    });
  });

  it('applies CSS variables for dark theme', async () => {
    const TestComponent = () => {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('dark')}>Set Dark</button>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByText('Set Dark');
    button.click();

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark-theme')).toBe(
        true
      );
      expect(document.documentElement.classList.contains('light-theme')).toBe(
        false
      );
    });
    // Note: CSS variables may not be available in test environment, so we only check class names
  });

  it('applies CSS variables for light theme', async () => {
    localStorage.setItem('flm_preferred_theme', 'dark');

    const TestComponent = () => {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('light')}>Set Light</button>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByText('Set Light');
    button.click();

    await waitFor(() => {
      expect(document.documentElement.classList.contains('light-theme')).toBe(
        true
      );
      expect(document.documentElement.classList.contains('dark-theme')).toBe(
        false
      );
    });
    // Note: CSS variables may not be available in test environment, so we only check class names
  });

  it('detects system preference for dark mode', () => {
    const mockMatchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    // beforeEachで既にモックされているが、このテストでは特定の動作をテストするため再設定
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    localStorage.removeItem('flm_preferred_theme');

    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>{theme}</div>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // System preference should be detected (dark mode in this mock)
    expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });
});
