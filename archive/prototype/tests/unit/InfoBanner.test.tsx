// InfoBanner - 情報バナーコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InfoBanner } from '../../src/components/common/InfoBanner';

describe('InfoBanner.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('メッセージを表示する', () => {
      render(<InfoBanner message="テストメッセージ" />);
      expect(screen.getByText('テストメッセージ')).toBeInTheDocument();
    });

    it('タイトルを表示する', () => {
      render(<InfoBanner title="テストタイトル" message="テストメッセージ" />);
      expect(screen.getByText('テストタイトル')).toBeInTheDocument();
    });

    it('デフォルトでinfoタイプを使用する', () => {
      const { container } = render(<InfoBanner message="テストメッセージ" />);
      expect(container.querySelector('.info-banner-info')).toBeInTheDocument();
    });
  });

  describe('バナータイプ', () => {
    it('infoタイプを表示する', () => {
      const { container } = render(
        <InfoBanner type="info" message="テストメッセージ" />
      );
      expect(container.querySelector('.info-banner-info')).toBeInTheDocument();
      expect(screen.getByText('ℹ️')).toBeInTheDocument();
    });

    it('tipタイプを表示する', () => {
      const { container } = render(
        <InfoBanner type="tip" message="テストメッセージ" />
      );
      expect(container.querySelector('.info-banner-tip')).toBeInTheDocument();
      expect(screen.getByText('💡')).toBeInTheDocument();
    });

    it('warningタイプを表示する', () => {
      const { container } = render(
        <InfoBanner type="warning" message="テストメッセージ" />
      );
      expect(
        container.querySelector('.info-banner-warning')
      ).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('successタイプを表示する', () => {
      const { container } = render(
        <InfoBanner type="success" message="テストメッセージ" />
      );
      expect(
        container.querySelector('.info-banner-success')
      ).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });
  });

  describe('閉じる機能', () => {
    it('dismissibleがfalseの場合、閉じるボタンを表示しない', () => {
      render(<InfoBanner message="テストメッセージ" dismissible={false} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('dismissibleがtrueの場合、閉じるボタンを表示する', () => {
      render(<InfoBanner message="テストメッセージ" dismissible={true} />);
      expect(
        screen.getByRole('button', { name: /閉じる/i })
      ).toBeInTheDocument();
    });

    it('閉じるボタンをクリックするとバナーが非表示になる', () => {
      render(<InfoBanner message="テストメッセージ" dismissible={true} />);
      const button = screen.getByRole('button', { name: /閉じる/i });

      expect(screen.getByText('テストメッセージ')).toBeInTheDocument();
      fireEvent.click(button);
      expect(screen.queryByText('テストメッセージ')).not.toBeInTheDocument();
    });

    it('onDismissコールバックが呼ばれる', () => {
      const onDismiss = jest.fn();
      render(
        <InfoBanner
          message="テストメッセージ"
          dismissible={true}
          onDismiss={onDismiss}
        />
      );

      const button = screen.getByRole('button', { name: /閉じる/i });
      fireEvent.click(button);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('アクセシビリティ', () => {
    it('閉じるボタンに適切なaria-labelを設定する', () => {
      render(<InfoBanner message="テストメッセージ" dismissible={true} />);
      const button = screen.getByRole('button', { name: /閉じる/i });
      expect(button).toHaveAttribute('aria-label');
    });
  });
});
