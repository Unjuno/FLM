// SkeletonLoader - SkeletonLoaderコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SkeletonLoader } from '../../src/components/common/SkeletonLoader';

describe('SkeletonLoader.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('デフォルトのテキストスケルトンを表示する', () => {
      const { container } = render(<SkeletonLoader />);
      expect(container.querySelector('.skeleton')).toBeInTheDocument();
    });

    it('タイプに応じたスケルトンを表示する', () => {
      const { container } = render(<SkeletonLoader type="title" />);
      expect(container.querySelector('.skeleton-title')).toBeInTheDocument();
    });
  });

  describe('スナップショットテスト', () => {
    it('テキストスケルトンのスナップショット', () => {
      const { container } = render(<SkeletonLoader type="text" />);
      expect(container).toMatchSnapshot();
    });

    it('タイトルスケルトンのスナップショット', () => {
      const { container } = render(<SkeletonLoader type="title" />);
      expect(container).toMatchSnapshot();
    });

    it('段落スケルトンのスナップショット', () => {
      const { container } = render(
        <SkeletonLoader type="paragraph" count={3} />
      );
      expect(container).toMatchSnapshot();
    });

    it('アバタースケルトンのスナップショット', () => {
      const { container } = render(<SkeletonLoader type="avatar" rounded />);
      expect(container).toMatchSnapshot();
    });

    it('ボタンスケルトンのスナップショット', () => {
      const { container } = render(<SkeletonLoader type="button" />);
      expect(container).toMatchSnapshot();
    });

    it('カードスケルトンのスナップショット', () => {
      const { container } = render(<SkeletonLoader type="card" />);
      expect(container).toMatchSnapshot();
    });

    it('テーブルスケルトンのスナップショット', () => {
      const { container } = render(<SkeletonLoader type="table" count={5} />);
      expect(container).toMatchSnapshot();
    });

    it('リストスケルトンのスナップショット', () => {
      const { container } = render(<SkeletonLoader type="list" count={3} />);
      expect(container).toMatchSnapshot();
    });

    it('APIリストスケルトンのスナップショット', () => {
      const { container } = render(
        <SkeletonLoader type="api-list" count={2} />
      );
      expect(container).toMatchSnapshot();
    });

    it('フォームスケルトンのスナップショット', () => {
      const { container } = render(<SkeletonLoader type="form" count={4} />);
      expect(container).toMatchSnapshot();
    });

    it('カスタムスケルトンのスナップショット', () => {
      const { container } = render(
        <SkeletonLoader type="custom" width="200px" height="50px" />
      );
      expect(container).toMatchSnapshot();
    });

    it('アニメーション無効のスケルトンのスナップショット', () => {
      const { container } = render(<SkeletonLoader type="text" noAnimation />);
      expect(container).toMatchSnapshot();
    });
  });
});
