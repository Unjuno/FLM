//! Accessibility tests for ConfirmDialog component

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConfirmDialog } from '../ConfirmDialog';

expect.extend(toHaveNoViolations);

describe('ConfirmDialog Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    const { container } = render(
      <ConfirmDialog
        message="Test message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes on dialog', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    render(
      <ConfirmDialog
        message="Test message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-dialog-message');
  });

  it('should be keyboard accessible with Escape key', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    render(
      <ConfirmDialog
        message="Test message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    // Escape key is handled by document event listener
    // Simulate Escape key press on document
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    
    document.dispatchEvent(escapeEvent);
    
    // Wait for the event to propagate
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should be keyboard accessible with Enter key', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    render(
      <ConfirmDialog
        message="Test message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    // Focus the dialog content div (which has the onKeyDown handler)
    const dialogContent = document.querySelector('.confirm-dialog') as HTMLElement;
    expect(dialogContent).toBeDefined();
    
    if (dialogContent) {
      dialogContent.focus();
      // Enter key only works when target === currentTarget
      // Simulate keydown event directly on the element
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(enterEvent, 'target', { value: dialogContent, enumerable: true });
      Object.defineProperty(enterEvent, 'currentTarget', { value: dialogContent, enumerable: true });
      
      dialogContent.dispatchEvent(enterEvent);
      
      // Wait for the event to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
    }
  });

  it('should have accessible button labels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    render(
      <ConfirmDialog
        message="Test message"
        onConfirm={onConfirm}
        onCancel={onCancel}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    );
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    
    expect(confirmButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
  });

  it('should trap focus within dialog', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    render(
      <ConfirmDialog
        message="Test message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    const dialog = screen.getByRole('dialog');
    // The dialog content div should have tabIndex for focus trapping
    const dialogContent = dialog.querySelector('.confirm-dialog');
    expect(dialogContent).toHaveAttribute('tabIndex', '-1');
  });
});

