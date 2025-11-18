# FLM Webサイト

FLMの公式Webサイトです。HTML/CSS/JavaScriptのみで構成された静的サイトです。

## 概要

このWebサイトは、FLM（Local LLM API Manager）の公式サイトです。

- **静的サイト**: サーバーサイド処理不要、HTML/CSS/JSのみで動作
- **どこでもホスティング可能**: GitHub Pages、Netlify、Vercelなど、あらゆる静的ホスティングサービスで利用可能
- **パッケージ配布用ではない**: このWebサイトは、どこかのサーバーでホスティングして利用することを想定しています

## ファイル構成

```text
WEB/
├── index.html          # ホームページ
├── features.html       # 機能紹介ページ
├── guide.html          # 使い方ガイド
├── download.html       # ダウンロードページ
├── faq.html           # FAQページ
├── contact.html       # お問い合わせページ
├── privacy.html       # プライバシーポリシー
├── css/               # スタイルシート
│   ├── reset.css
│   ├── style.css
│   └── responsive.css
├── js/                # JavaScriptファイル
│   ├── main.js
│   ├── navigation.js
│   ├── download.js
│   └── contact.js
└── images/            # 画像ファイル
    └── logo.png
```

## ホスティング方法

### GitHub Pages

1. GitHubリポジトリにこの`WEB`フォルダの内容をプッシュ
2. リポジトリのSettings > Pagesで、ソースを`/WEB`フォルダに設定
3. 自動的に`https://yourusername.github.io/repository-name/`で公開されます

### Netlify

1. Netlifyアカウントにログイン
2. "Add new site" > "Deploy manually"を選択
3. `WEB`フォルダをドラッグ&ドロップ
4. 自動的にデプロイされます

### Vercel

1. Vercelアカウントにログイン
2. "Add New Project"をクリック
3. GitHubリポジトリを選択、または`WEB`フォルダをアップロード
4. Root Directoryを`WEB`に設定
5. デプロイを実行

### その他の静的ホスティングサービス

- **Firebase Hosting**: Firebase CLIを使用してデプロイ
- **AWS S3 + CloudFront**: S3バケットにアップロードし、CloudFrontで配信
- **Azure Static Web Apps**: Azure Portalからデプロイ
- **Cloudflare Pages**: Cloudflareダッシュボードからデプロイ

## ローカルでの確認方法

1. この`WEB`フォルダに移動
2. ローカルサーバーを起動（例：Pythonの`http.server`、Node.jsの`http-server`など）

```bash
# Python 3の場合
cd WEB
python -m http.server 8000

# Node.jsの場合（http-serverをインストール済み）
cd WEB
npx http-server -p 8000
```

1. ブラウザで`http://localhost:8000`にアクセス

## 注意事項

- **パッケージ配布用ではない**: このWebサイトは、どこかのサーバーでホスティングして利用することを想定しています
- **静的サイト**: サーバーサイドの処理やデータベースは一切使用していません
- **すべての機能がクライアントサイドで動作**: JavaScriptはすべてクライアントサイドで実行されます
- **APIエンドポイント**: このWebサイト自体はAPIを提供しません。FLMアプリケーションで作成したAPIを利用するための情報を提供します

## カスタマイズ

### スタイルの変更

`css/style.css`を編集することで、デザインをカスタマイズできます。

### コンテンツの変更

各HTMLファイルを編集することで、コンテンツを変更できます。

### JavaScriptの機能追加

`js/`フォルダ内のファイルを編集することで、機能を追加・変更できます。

## ブラウザサポート

- Chrome（最新版）
- Firefox（最新版）
- Safari（最新版）
- Edge（最新版）

## ライセンス

このWebサイトのコードは、FLMプロジェクトのライセンスに準拠します。

## お問い合わせ

Webサイトに関するお問い合わせは、`contact.html`のフォームからお願いします。

---

**重要**: このWebサイトは静的サイトとして配布・ホスティングするためのものです。パッケージとして配布するものではありません。
