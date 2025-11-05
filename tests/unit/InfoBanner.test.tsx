// InfoBanner - InfoBannerコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InfoBanner } from '../../src/components/common/InfoBanner';

describe('InfoBanner.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('メッセージを表示する', () => {
      render(<InfoBanner message="情報メッセージ" />);
      expect(screen.getByText('情報メッセージ')).toBeInTheDocument();
    });

    it('タイトルを表示する', () => {
      render(<InfoBanner title="タイトル" message="メッセージ" />);
      expect(screen.getByText('タイトル')).toBeInTheDocument();
    });

    it('タイプに応じたアイコンを表示する', () => {
      render(<InfoBanner message="情報" type="info" />);
      expect(screen.getByText(/ℹ️/i)).toBeInTheDocument();
    });
  });

  describe('バナーのタイプ', () => {
    it('infoタイプを表示する', () => {
      render(<InfoBanner message="情報" type="info" />);
      expect(screen.getByText(/ℹ️/i)).toBeInTheDocument();
    });

    it('tipタイプを表示する', () => {
      render(<InfoBanner message="ヒント" type="tip" />);
      expect(screen.getByText(/💡/i)).toBeInTheDocument();
    });

    it('warningタイプを表示する', () => {
      render(<InfoBanner message="警告" type="warning" />);
      expect(screen.getByText(/⚠️/i)).toBeInTheDocument();
    });

    it('successタイプを表示する', () => {
      render(<InfoBanner message="成功" type="success" />);
      expect(screen.getByText(/✅/i)).toBeInTheDocument();
    });
  });

  describe('閉じる機能', () => {
    it('dismissibleがtrueの場合、閉じるボタンを表示する', () => {
      const onDismiss = jest.fn();
      render(<InfoBanner message="メッセージ" dismissible onDismiss={onDismiss} />);
      
      const closeButton = screen.getByRole('button', { name: /閉じる/i });
      expect(closeButton).toBeInTheDocument();
      
      fireEvent.click(closeButton);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('メッセージ')).not.toBeInTheDocument();
    });

    it('dismissibleがfalseの場合、閉じるボタンを表示しない', () => {
      render(<InfoBanner message="メッセージ" dismissible={false} />);
      expect(screen.queryByRole('button', { name: /閉じる/i })).not.toBeInTheDocument();
    });

    it('閉じた後、コンポーネントが表示されなくなる', () => {
      const onDismiss = jest.fn();
      render(<InfoBanner message="メッセージ" dismissible onDismiss={onDismiss} />);
      
      const closeButton = screen.getByRole('button', { name: /閉じる/i });
      fireEvent.click(closeButton);
      
      expect(screen.queryByText('メッセージ')).not.toBeInTheDocument();
    });
  });
});

