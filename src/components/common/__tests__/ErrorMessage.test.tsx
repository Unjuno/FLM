import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorMessage } from '../ErrorMessage';

describe('ErrorMessage', () => {
  it('should render error message', () => {
    render(<ErrorMessage message="Test error message" />);

    expect(screen.getByText('エラー:')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<ErrorMessage message="Test error" onDismiss={onDismiss} />);

    const dismissButton = screen.getByLabelText('エラーメッセージを閉じる');
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not show dismiss button when onDismiss is not provided', () => {
    render(<ErrorMessage message="Test error" />);

    expect(
      screen.queryByLabelText('エラーメッセージを閉じる')
    ).not.toBeInTheDocument();
  });

  it('should display details when provided', () => {
    render(
      <ErrorMessage
        message="Test error"
        details="Detailed error information"
      />
    );

    expect(screen.getByText('詳細情報')).toBeInTheDocument();
    expect(screen.getByText('Detailed error information')).toBeInTheDocument();
  });

  it('should not display details section when details is not provided', () => {
    render(<ErrorMessage message="Test error" />);

    expect(screen.queryByText('詳細情報')).not.toBeInTheDocument();
  });

  it('should render details in pre tag', () => {
    render(
      <ErrorMessage
        message="Test error"
        details="Detailed error information"
      />
    );

    const detailsElement = screen.getByText('Detailed error information');
    expect(detailsElement.tagName).toBe('PRE');
  });
});
