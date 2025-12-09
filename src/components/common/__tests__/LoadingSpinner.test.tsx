import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render loading spinner', () => {
    render(<LoadingSpinner message="読み込み中..." />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<LoadingSpinner message="Custom loading message" />);

    expect(screen.getByText('Custom loading message')).toBeInTheDocument();
  });

  it('should render with small size', () => {
    const { container } = render(<LoadingSpinner size="small" />);

    expect(container.firstChild).toHaveClass('loading-spinner-container', 'small');
  });

  it('should render with medium size by default', () => {
    const { container } = render(<LoadingSpinner />);

    expect(container.firstChild).toHaveClass('loading-spinner-container', 'medium');
  });

  it('should render with large size', () => {
    const { container } = render(<LoadingSpinner size="large" />);

    expect(container.firstChild).toHaveClass('loading-spinner-container', 'large');
  });
});
