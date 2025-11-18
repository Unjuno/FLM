// HelpTooltip - ヘルプツールチップコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HelpTooltip } from '../../src/components/common/HelpTooltip';

describe('HelpTooltip.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('デフォルトのヘルプアイコンを表示する', () => {
      render(<HelpTooltip content="ヘルプの内容" />);

      expect(
        screen.getByRole('button', { name: /ヘルプを表示/i })
      ).toBeInTheDocument();
      expect(screen.getByText('❓')).toBeInTheDocument();
    });

    it('カスタム子要素を表示できる', () => {
      render(
        <HelpTooltip content="ヘルプの内容">
          <span>カスタムアイコン</span>
        </HelpTooltip>
      );

      expect(screen.getByText('カスタムアイコン')).toBeInTheDocument();
      expect(screen.queryByText('❓')).not.toBeInTheDocument();
    });

    it('ホバー時にツールチップを表示する', async () => {
      render(<HelpTooltip content="ヘルプの内容" />);

      const button = screen.getByRole('button', { name: /ヘルプを表示/i });
      fireEvent.mouseEnter(button);

      await waitFor(() => {
        expect(screen.getByText('ヘルプの内容')).toBeInTheDocument();
      });
    });

    it('マウスが離れたときにツールチップを非表示にする', async () => {
      render(<HelpTooltip content="ヘルプの内容" />);

      const button = screen.getByRole('button', { name: /ヘルプを表示/i });
      fireEvent.mouseEnter(button);

      await waitFor(() => {
        expect(screen.getByText('ヘルプの内容')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(button);

      await waitFor(() => {
        expect(screen.queryByText('ヘルプの内容')).not.toBeInTheDocument();
      });
    });
  });

  describe('位置指定', () => {
    const positions: Array<'top' | 'bottom' | 'left' | 'right'> = [
      'top',
      'bottom',
      'left',
      'right',
    ];

    positions.forEach(position => {
      it(`${position}位置でツールチップを表示する`, async () => {
        const { container } = render(
          <HelpTooltip content="ヘルプの内容" position={position} />
        );

        const button = screen.getByRole('button', { name: /ヘルプを表示/i });
        fireEvent.mouseEnter(button);

        await waitFor(() => {
          const tooltip = container.querySelector('.help-tooltip');
          expect(tooltip).toHaveClass(`help-tooltip-${position}`);
        });
      });
    });
  });

  describe('タイトル機能', () => {
    it('タイトルが指定されている場合、タイトルを表示する', async () => {
      render(<HelpTooltip content="ヘルプの内容" title="ヘルプタイトル" />);

      const button = screen.getByRole('button', { name: /ヘルプを表示/i });
      fireEvent.mouseEnter(button);

      await waitFor(() => {
        expect(screen.getByText('ヘルプタイトル')).toBeInTheDocument();
        expect(screen.getByText('ヘルプの内容')).toBeInTheDocument();
      });
    });
  });

  describe('フォーカス機能', () => {
    it('フォーカス時にツールチップを表示する', async () => {
      render(<HelpTooltip content="ヘルプの内容" />);

      const button = screen.getByRole('button', { name: /ヘルプを表示/i });
      fireEvent.focus(button);

      await waitFor(() => {
        expect(screen.getByText('ヘルプの内容')).toBeInTheDocument();
      });
    });

    it('フォーカスが外れたときにツールチップを非表示にする', async () => {
      render(<HelpTooltip content="ヘルプの内容" />);

      const button = screen.getByRole('button', { name: /ヘルプを表示/i });
      fireEvent.focus(button);

      await waitFor(() => {
        expect(screen.getByText('ヘルプの内容')).toBeInTheDocument();
      });

      fireEvent.blur(button);

      await waitFor(() => {
        expect(screen.queryByText('ヘルプの内容')).not.toBeInTheDocument();
      });
    });
  });
});
