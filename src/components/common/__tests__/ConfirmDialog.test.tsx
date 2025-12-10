import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('should render confirm dialog with message', () => {
    render(
      <ConfirmDialog
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const confirmButton = screen.getByText('確認');
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByText('キャンセル');
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should call onCancel when overlay is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const overlay = container.querySelector('.confirm-dialog-overlay');
    if (overlay) {
      await user.click(overlay);
    }

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should not call onCancel when dialog content is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const dialog = container.querySelector('.confirm-dialog');
    if (dialog) {
      await user.click(dialog);
    }

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('should use custom confirm text', () => {
    render(
      <ConfirmDialog
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirmText="Yes"
      />
    );

    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.queryByText('確認')).not.toBeInTheDocument();
  });

  it('should use custom cancel text', () => {
    render(
      <ConfirmDialog
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        cancelText="No"
      />
    );

    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.queryByText('キャンセル')).not.toBeInTheDocument();
  });

  it('should apply danger class when danger prop is true', () => {
    render(
      <ConfirmDialog
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        danger={true}
      />
    );

    const confirmButton = screen.getByText('確認');
    const cancelButton = screen.getByText('キャンセル');

    expect(confirmButton).toHaveClass('button-primary', 'button-danger');
    expect(cancelButton).toHaveClass('button-secondary', 'button-danger');
  });

  it('should not apply danger class when danger prop is false', () => {
    render(
      <ConfirmDialog
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        danger={false}
      />
    );

    const confirmButton = screen.getByText('確認');
    const cancelButton = screen.getByText('キャンセル');

    expect(confirmButton).toHaveClass('button-primary');
    expect(confirmButton).not.toHaveClass('button-danger');
    expect(cancelButton).toHaveClass('button-secondary');
    expect(cancelButton).not.toHaveClass('button-danger');
  });
});
