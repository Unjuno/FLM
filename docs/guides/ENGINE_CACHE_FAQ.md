# Engine Detection Cache FAQ

> Status: Reference | Audience: Support / Users | Updated: 2025-11-25

## 1. 何がキャッシュされる？

- `flm engines detect` は `config.db` の `engines_cache` テーブルに検出結果を保存します。
- キャッシュ TTL は 5 分。TTL 内に再実行すると過去結果をそのまま返し、LLM エンジンへは再アクセスしません。

## 2. 典型的な症状

| 症状 | 想定される原因 | 推奨アクション |
| --- | --- | --- |
| 新しく起動したエンジンが CLI/UI に表示されない | キャッシュが古い | `flm engines detect --fresh` を実行してキャッシュを無視する。 |
| エンジンを停止/アンインストールしたのに UI に残っている | キャッシュが TTL 内 | 5 分待つか `--fresh` で再検出。 |
| UI（Tauri IPC）が stale 状態を示す | IPC 経由でも CLI を呼んでいるため同現象 | UI の「再スキャン」ボタンで `fresh=true` を指定する。 |

## 3. `--fresh` の使いどころ

```
flm engines detect --fresh --format json
```

- サポートからの操作指示テンプレート:「エンジン一覧が更新されない場合は、上記コマンドを実行し結果をサポートに共有」
- UI からは `cmd_detect_engines({ fresh: true })`（`cli_bridge::ipc_detect_engines`）を呼び出す。

## 4. 自動リフレッシュの推奨

- UI がバックグラウンドでエンジン状態を監視する場合は、5 分ごとに `fresh=false` でポーリングし、ユーザー操作に応じて `fresh=true` を送る。
- CLI スクリプトで正確な状態が必要な場合（例：CI での環境チェック）は常に `--fresh` を付与する。

## 5. サポート向けチェックリスト

1. `config.db` が正しいパスか (`flm config get paths.config` で確認)。
2. `flm engines detect --format json` の `version` が `"1.0"` であること。
3. `engines_cache` の `cached_at` が 5 分以上前なら、そのまま再検出待ちで解消。
4. どうしても最新が取得できない場合は `config.db` をバックアップし、`DELETE FROM engines_cache;` 実行後に再検出。

