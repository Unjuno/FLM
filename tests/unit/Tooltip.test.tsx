// Tooltip - ツールチップコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { Tooltip } from '../../src/components/common/Tooltip';

describe('Tooltip.tsx', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('基本的なレンダリング', () => {
    it('子要素をレンダリングする', () => {
      render(
        <Tooltip content="ツールチップの内容">
          <button>ボタン</button>
        </Tooltip>
      );

      expect(screen.getByText('ボタン')).toBeInTheDocument();
    });

    it('ホバー時にツールチップを表示する', async () => {
      render(
        <Tooltip content="ツールチップの内容">
          <button>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');

      await act(async () => {
        fireEvent.mouseEnter(button);
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('ツールチップの内容')).toBeInTheDocument();
      });
    });

    it('マウスが離れたときにツールチップを非表示にする', async () => {
      render(
        <Tooltip content="ツールチップの内容">
          <button>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');

      await act(async () => {
        fireEvent.mouseEnter(button);
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.mouseLeave(button);
      });

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
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
        render(
          <Tooltip content="ツールチップの内容" position={position}>
            <button>ボタン</button>
          </Tooltip>
        );

        const button = screen.getByText('ボタン');

        await act(async () => {
          fireEvent.mouseEnter(button);
          jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
          const tooltip = screen.getByRole('tooltip');
          expect(tooltip).toHaveClass(`tooltip-${position}`);
        });
      });
    });
  });

  describe('タイトル機能', () => {
    it('タイトルが指定されている場合、タイトルを表示する', async () => {
      render(
        <Tooltip content="ツールチップの内容" title="タイトル">
          <button>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');

      await act(async () => {
        fireEvent.mouseEnter(button);
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('タイトル')).toBeInTheDocument();
        expect(screen.getByText('ツールチップの内容')).toBeInTheDocument();
      });
    });
  });

  describe('遅延表示', () => {
    it('カスタム遅延時間を設定できる', async () => {
      render(
        <Tooltip content="ツールチップの内容" delay={500}>
          <button>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');

      await act(async () => {
        fireEvent.mouseEnter(button);
        jest.advanceTimersByTime(300);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // 500ms経過後は表示される
      await act(async () => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });
  });

  describe('無効化機能', () => {
    it('disabledがtrueの場合、ツールチップを表示しない', async () => {
      render(
        <Tooltip content="ツールチップの内容" disabled>
          <button>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');

      await act(async () => {
        fireEvent.mouseEnter(button);
        jest.advanceTimersByTime(300);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('フォーカス機能', () => {
    it('フォーカス時にツールチップを表示する', async () => {
      render(
        <Tooltip content="ツールチップの内容">
          <button>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');
      fireEvent.focus(button);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('フォーカスが外れたときにツールチップを非表示にする', async () => {
      render(
        <Tooltip content="ツールチップの内容">
          <button>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');

      await act(async () => {
        fireEvent.focus(button);
      });

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.blur(button);
      });

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('最大幅設定', () => {
    it('カスタム最大幅を設定できる', async () => {
      const { container } = render(
        <Tooltip content="ツールチップの内容" maxWidth={500}>
          <button>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');

      await act(async () => {
        fireEvent.mouseEnter(button);
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        const tooltip = container.querySelector('.tooltip') as HTMLElement;
        if (tooltip) {
          expect(tooltip.style.getPropertyValue('--tooltip-max-width')).toBe(
            '500px'
          );
        }
      });
    });
  });

  describe('既存のイベントハンドラの保持', () => {
    it('子要素の既存のonMouseEnterハンドラを保持する', () => {
      const onMouseEnter = jest.fn();

      render(
        <Tooltip content="ツールチップの内容">
          <button onMouseEnter={onMouseEnter}>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');
      fireEvent.mouseEnter(button);

      expect(onMouseEnter).toHaveBeenCalledTimes(1);
    });

    it('子要素の既存のonFocusハンドラを保持する', () => {
      const onFocus = jest.fn();

      render(
        <Tooltip content="ツールチップの内容">
          <button onFocus={onFocus}>ボタン</button>
        </Tooltip>
      );

      const button = screen.getByText('ボタン');
      fireEvent.focus(button);

      expect(onFocus).toHaveBeenCalledTimes(1);
    });
  });
});
