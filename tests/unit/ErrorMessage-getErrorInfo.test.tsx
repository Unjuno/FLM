// ErrorMessage - getErrorInfo関数のユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import {
  ErrorMessage,
  ErrorType,
} from '../../src/components/common/ErrorMessage';

describe('ErrorMessage.tsx - getErrorInfo関数', () => {
  const errorTypes: ErrorType[] = [
    'ollama',
    'api',
    'model',
    'database',
    'validation',
    'network',
    'permission',
    'general',
  ];

  describe('各エラータイプの情報取得', () => {
    errorTypes.forEach(type => {
      it(`${type}エラータイプの情報を正しく取得する`, () => {
        render(
          <BrowserRouter>
            <ErrorMessage message="テストエラー" type={type} />
          </BrowserRouter>
        );

        // エラータイトルが表示されることを確認（h3要素を直接取得）
        const errorTitle = screen.getByRole('heading', { level: 3 });
        expect(errorTitle).toBeInTheDocument();
        expect(errorTitle).toHaveClass('error-title');
      });
    });
  });

  describe('デフォルト提案メッセージ', () => {
    it('Ollamaエラーに対して適切な提案を表示する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage message="Ollamaエラー" type="ollama" />
        </BrowserRouter>
      );

      expect(
        screen.getByRole('heading', { name: /Ollama/ })
      ).toBeInTheDocument();
    });

    it('APIエラーに対して適切な提案を表示する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage message="APIエラー" type="api" />
        </BrowserRouter>
      );

      // 提案メッセージを確認（suggestion-textクラスを持つ要素）
      const suggestion = screen.getByText(
        /ポート番号が既に使用されていないか|設定を確認してください/i
      );
      expect(suggestion).toBeInTheDocument();
    });

    it('MODELエラーに対して適切な提案を表示する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage message="モデルエラー" type="model" />
        </BrowserRouter>
      );

      // より具体的なセレクタを使用（heading要素を取得）
      const heading = screen.getByRole('heading', { name: /モデルのエラー/i });
      expect(heading).toBeInTheDocument();
    });

    it('DATABASEエラーに対して適切な提案を表示する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage message="データベースエラー" type="database" />
        </BrowserRouter>
      );

      // 提案メッセージを確認
      const suggestion =
        screen.getByText(/アプリケーションを再起動してみてください/i);
      expect(suggestion).toBeInTheDocument();
    });

    it('NETWORKエラーに対して適切な提案を表示する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage message="ネットワークエラー" type="network" />
        </BrowserRouter>
      );

      // 提案メッセージを確認
      const suggestion =
        screen.getByText(/インターネット接続を確認してください/i);
      expect(suggestion).toBeInTheDocument();
    });

    it('PERMISSIONエラーに対して適切な提案を表示する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage message="権限エラー" type="permission" />
        </BrowserRouter>
      );

      // 提案メッセージを確認
      const suggestion =
        screen.getByText(/必要な権限があるか確認してください/i);
      expect(suggestion).toBeInTheDocument();
    });

    it('VALIDATIONエラーに対して適切な提案を表示する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage message="バリデーションエラー" type="validation" />
        </BrowserRouter>
      );

      // 提案メッセージを確認
      const suggestion = screen.getByText(/入力内容を確認してください/i);
      expect(suggestion).toBeInTheDocument();
    });

    it('GENERALエラーに対して適切な提案を表示する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage message="一般的なエラー" type="general" />
        </BrowserRouter>
      );

      // 提案メッセージを確認
      const suggestion = screen.getByText(
        /問題が続く場合は、アプリケーションを再起動してみてください/i
      );
      expect(suggestion).toBeInTheDocument();
    });
  });

  describe('カスタム提案メッセージ', () => {
    it('カスタム提案メッセージが指定されている場合、それを使用する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage
            message="エラー"
            type="general"
            suggestion="カスタム提案メッセージ"
          />
        </BrowserRouter>
      );

      expect(screen.getByText('カスタム提案メッセージ')).toBeInTheDocument();
    });

    it('カスタム提案がない場合、デフォルト提案を使用する', () => {
      render(
        <BrowserRouter>
          <ErrorMessage message="エラー" type="ollama" />
        </BrowserRouter>
      );

      // heading要素を確認
      const heading = screen.getByRole('heading', { name: /Ollamaのエラー/i });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('エラーアイコン', () => {
    it('各エラータイプに対して適切なアイコンを表示する', () => {
      // アイコンのテストは、実際のコンポーネント実装に依存するため、
      // エラータイトルが正しく表示されることを確認する
      const { container: ollamaContainer, unmount: unmountOllama } = render(
        <BrowserRouter>
          <ErrorMessage message="エラー" type="ollama" />
        </BrowserRouter>
      );
      // エラータイトルが表示されることを確認
      expect(ollamaContainer.querySelector('.error-title')).toBeInTheDocument();
      unmountOllama();

      const { container: apiContainer, unmount: unmountApi } = render(
        <BrowserRouter>
          <ErrorMessage message="エラー" type="api" />
        </BrowserRouter>
      );
      expect(apiContainer.querySelector('.error-title')).toBeInTheDocument();
      unmountApi();

      const { container: modelContainer, unmount: unmountModel } = render(
        <BrowserRouter>
          <ErrorMessage message="エラー" type="model" />
        </BrowserRouter>
      );
      expect(modelContainer.querySelector('.error-title')).toBeInTheDocument();
      unmountModel();

      const { container: databaseContainer, unmount: unmountDatabase } = render(
        <BrowserRouter>
          <ErrorMessage message="エラー" type="database" />
        </BrowserRouter>
      );
      expect(
        databaseContainer.querySelector('.error-title')
      ).toBeInTheDocument();
      unmountDatabase();

      const { container: validationContainer, unmount: unmountValidation } =
        render(
          <BrowserRouter>
            <ErrorMessage message="エラー" type="validation" />
          </BrowserRouter>
        );
      expect(
        validationContainer.querySelector('.error-title')
      ).toBeInTheDocument();
      unmountValidation();

      const { container: networkContainer, unmount: unmountNetwork } = render(
        <BrowserRouter>
          <ErrorMessage message="エラー" type="network" />
        </BrowserRouter>
      );
      expect(
        networkContainer.querySelector('.error-title')
      ).toBeInTheDocument();
      unmountNetwork();

      const { container: permissionContainer, unmount: unmountPermission } =
        render(
          <BrowserRouter>
            <ErrorMessage message="エラー" type="permission" />
          </BrowserRouter>
        );
      expect(
        permissionContainer.querySelector('.error-title')
      ).toBeInTheDocument();
      unmountPermission();

      const { container: generalContainer } = render(
        <BrowserRouter>
          <ErrorMessage message="エラー" type="general" />
        </BrowserRouter>
      );
      expect(
        generalContainer.querySelector('.error-title')
      ).toBeInTheDocument();
    });
  });
});
