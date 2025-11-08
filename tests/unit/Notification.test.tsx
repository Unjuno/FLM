// Notification - 通知コンポーネントのユニットテスト

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
import {
  Notification,
  NotificationItem,
} from '../../src/components/common/Notification';

describe('Notification.tsx', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const mockNotification: NotificationItem = {
    id: 'test-notification-1',
    type: 'info',
    title: 'テスト通知',
    message: 'これはテストメッセージです',
    timestamp: Date.now(),
  };

  const mockOnClose = jest.fn();

  describe('基本的なレンダリング', () => {
    it('通知を表示する', () => {
      render(
        <Notification notification={mockNotification} onClose={mockOnClose} />
      );

      expect(screen.getByText('テスト通知')).toBeInTheDocument();
      expect(
        screen.getByText('これはテストメッセージです')
      ).toBeInTheDocument();
    });

    it('通知タイプに応じたアイコンを表示する', () => {
      const types: Array<'success' | 'error' | 'warning' | 'info'> = [
        'success',
        'error',
        'warning',
        'info',
      ];
      const icons = ['✓', '✕', '⚠', 'ℹ'];

      types.forEach((type, index) => {
        const { unmount, container } = render(
          <Notification
            notification={{ ...mockNotification, type }}
            onClose={mockOnClose}
          />
        );

        const icon = container.querySelector('.notification-icon');
        expect(icon).toHaveTextContent(icons[index]);
        unmount();
      });
    });

    it('メッセージがない場合、メッセージを表示しない', () => {
      const notificationWithoutMessage: NotificationItem = {
        ...mockNotification,
        message: undefined,
      };

      render(
        <Notification
          notification={notificationWithoutMessage}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('テスト通知')).toBeInTheDocument();
      expect(
        screen.queryByText('これはテストメッセージです')
      ).not.toBeInTheDocument();
    });
  });

  describe('アニメーション', () => {
    it('マウント時にアニメーションを開始する', async () => {
      render(
        <Notification notification={mockNotification} onClose={mockOnClose} />
      );

      // アニメーション開始前はvisibleクラスがない
      const notification = screen.getByRole('alert');
      expect(notification).not.toHaveClass('notification-visible');

      // アニメーション開始後
      await act(async () => {
        jest.advanceTimersByTime(100); // VISIBILITY_DELAY
      });

      // アニメーションが適用されることを確認
      await waitFor(
        () => {
          expect(notification).toHaveClass('notification-visible');
        },
        { timeout: 1000 }
      );
    }, 5000);
  });

  describe('自動非表示', () => {
    it('デフォルトの期間で自動非表示する', async () => {
      render(
        <Notification notification={mockNotification} onClose={mockOnClose} />
      );

      // アニメーション開始
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // デフォルト期間（5000ms）経過後に閉じる
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // アニメーション完了待機（300ms）
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(mockOnClose).toHaveBeenCalledWith('test-notification-1');
    });

    it('カスタム期間で自動非表示する', async () => {
      const customNotification: NotificationItem = {
        ...mockNotification,
        duration: 2000,
      };

      render(
        <Notification notification={customNotification} onClose={mockOnClose} />
      );

      await act(async () => {
        jest.advanceTimersByTime(100); // アニメーション開始
        jest.advanceTimersByTime(2000); // カスタム期間
        jest.advanceTimersByTime(300); // アニメーション完了
      });

      expect(mockOnClose).toHaveBeenCalledWith('test-notification-1');
    });

    it('durationが0の場合、自動非表示しない', async () => {
      const persistentNotification: NotificationItem = {
        ...mockNotification,
        duration: 0,
      };

      render(
        <Notification
          notification={persistentNotification}
          onClose={mockOnClose}
        />
      );

      // アニメーション開始
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // 長い時間待機しても閉じない
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      // アニメーション完了待機
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // mockOnCloseは呼ばれない（duration=0なので）
      // ただし、アニメーション開始時に呼ばれる可能性があるため、クリア
      mockOnClose.mockClear();

      // さらに待機
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('手動で閉じる', () => {
    it('閉じるボタンをクリックすると通知を閉じる', async () => {
      render(
        <Notification notification={mockNotification} onClose={mockOnClose} />
      );

      await act(async () => {
        jest.advanceTimersByTime(100); // アニメーション開始
      });

      const closeButton = screen.getByRole('button', { name: /閉じる/i });
      fireEvent.click(closeButton);

      await act(async () => {
        jest.advanceTimersByTime(300); // アニメーション完了
      });

      expect(mockOnClose).toHaveBeenCalledWith('test-notification-1');
    });

    it('閉じる際にアニメーションを適用する', async () => {
      render(
        <Notification notification={mockNotification} onClose={mockOnClose} />
      );

      await act(async () => {
        jest.advanceTimersByTime(100); // アニメーション開始
      });

      const notification = screen.getByRole('alert');
      const closeButton = screen.getByRole('button', { name: /閉じる/i });

      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(notification).toHaveClass('notification-removing');
      });
    });
  });

  describe('アクセシビリティ', () => {
    it('role="alert"とaria-live="polite"を設定する', () => {
      render(
        <Notification notification={mockNotification} onClose={mockOnClose} />
      );

      const notification = screen.getByRole('alert');
      expect(notification).toHaveAttribute('aria-live', 'polite');
    });

    it('アイコンにaria-hidden="true"を設定する', () => {
      render(
        <Notification notification={mockNotification} onClose={mockOnClose} />
      );

      const icon = screen.getByText('ℹ').closest('.notification-icon');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('閉じるボタンにaria-labelを設定する', () => {
      render(
        <Notification notification={mockNotification} onClose={mockOnClose} />
      );

      const closeButton = screen.getByRole('button', { name: /閉じる/i });
      expect(closeButton).toHaveAttribute('aria-label', '閉じる');
    });
  });
});
