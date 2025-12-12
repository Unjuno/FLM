import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuccessMessage } from '../SuccessMessage';

describe('SuccessMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render success message', () => {
    render(<SuccessMessage message="Test success message" />);

    expect(screen.getByText('Test success message')).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDismiss = vi.fn();

    render(
      <SuccessMessage message="Test success" onDismiss={onDismiss} />
    );

    const dismissButton = screen.getByLabelText('成功メッセージを閉じる');
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should auto dismiss after specified time', async () => {
    const onDismiss = vi.fn();

    render(
      <SuccessMessage
        message="Test success"
        onDismiss={onDismiss}
        autoDismiss={3000}
      />
    );

    expect(onDismiss).not.toHaveBeenCalled();

    // タイマーを進める
    vi.advanceTimersByTime(3000);
    
    // タイマーが実行されるのを待つ（fake timersの場合は即座に実行される）
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should auto dismiss with default timeout when autoDismiss is not provided', async () => {
    const onDismiss = vi.fn();

    render(
      <SuccessMessage message="Test success" onDismiss={onDismiss} />
    );

    // autoDismissのデフォルト値は3000ms
    expect(onDismiss).not.toHaveBeenCalled();

    // タイマーを進める
    vi.advanceTimersByTime(3000);
    
    // タイマーが実行されるのを待つ（fake timersの場合は即座に実行される）
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not show dismiss button when onDismiss is not provided', () => {
    render(<SuccessMessage message="Test success" />);

    expect(
      screen.queryByLabelText('成功メッセージを閉じる')
    ).not.toBeInTheDocument();
  });
});
