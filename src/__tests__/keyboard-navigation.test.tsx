//! Keyboard navigation tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { I18nProvider } from '../contexts/I18nContext';

describe('Keyboard Navigation', () => {
  describe('Sidebar', () => {
    it('should navigate with Tab key', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <I18nProvider>
            <Sidebar />
          </I18nProvider>
        </BrowserRouter>
      );
      
      const toggleButton = screen.getByRole('button', { name: /expand|collapse/i });
      toggleButton.focus();
      
      await user.tab();
      
      // Next focusable element should be focused
      const focusedElement = document.activeElement;
      expect(focusedElement).not.toBe(toggleButton);
    });

    it('should navigate with Shift+Tab key', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <I18nProvider>
            <Sidebar />
          </I18nProvider>
        </BrowserRouter>
      );
      
      const navButtons = screen.getAllByRole('button');
      if (navButtons.length > 1) {
        navButtons[1].focus();
        
        await user.tab({ shift: true });
        
        // Previous focusable element should be focused
        const focusedElement = document.activeElement;
        expect(focusedElement).not.toBe(navButtons[1]);
      }
    });

    it('should activate button with Enter key', async () => {
      const user = userEvent.setup();
      const onCollapseChange = vi.fn();
      
      render(
        <BrowserRouter>
          <I18nProvider>
            <Sidebar onCollapseChange={onCollapseChange} />
          </I18nProvider>
        </BrowserRouter>
      );
      
      const toggleButton = screen.getByRole('button', { name: /expand|collapse/i });
      toggleButton.focus();
      
      await user.keyboard('{Enter}');
      
      expect(onCollapseChange).toHaveBeenCalled();
    });

    it('should activate button with Space key', async () => {
      const user = userEvent.setup();
      const onCollapseChange = vi.fn();
      
      render(
        <BrowserRouter>
          <I18nProvider>
            <Sidebar onCollapseChange={onCollapseChange} />
          </I18nProvider>
        </BrowserRouter>
      );
      
      const toggleButton = screen.getByRole('button', { name: /expand|collapse/i });
      toggleButton.focus();
      
      await user.keyboard(' ');
      
      expect(onCollapseChange).toHaveBeenCalled();
    });
  });

  describe('ConfirmDialog', () => {
    it('should close dialog with Escape key', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      
      render(
        <ConfirmDialog
          message="Test message"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );
      
      await user.keyboard('{Escape}');
      
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('should confirm dialog with Enter key', async () => {
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
  });
});

