# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このリポジトリ

Claude Code のプラグイン marketplace（`kuhaku-plugins`）。ルートの `.claude-plugin/marketplace.json` が marketplace 定義で、各プラグインは `plugins/<name>/` に置く。現在は `jev-judge`（mod + skill）のみ。ビルド工程・package.json は無い。

## コマンド

```bash
claude plugin validate plugins/jev-judge   # plugin.json / hooks / skill の検証
claude plugin test plugins/jev-judge       # tests/ 配下の *.test.ts(x) を全件実行（失敗で exit 1）
```

- `claude plugin test` に個別のテストやファイルを絞り込むオプションは無い（引数はディレクトリだけ）。テストファイルは 1 ファイルごとに別プロセスで実行される。
- テストは `claude-code/testing` の `test` / `expect` / `mock` を使い、`model.fork`・`http.fetch`・`ui.notice`・`ui.toast` などのエンジン側フックを `on(...)` で差し替えて検証する（`tests/judge.test.tsx` の `standIn` が雛形）。
- 型定義 `plugins/*/.claude-plugin/types/` は Claude Code が mod 読み込み時に書き出すもので git 管理外。`tsconfig.json` はそれを extends している。

## 変更をローカルで試す / リリース

インストール済みプラグインはバージョンをキーにした複製から動くため、変更したら:

1. `plugins/<name>/.claude-plugin/plugin.json` と `.claude-plugin/marketplace.json` の **両方の `version`** を上げる（必ず一致させる）
2. commit
3. `claude plugin update <name>@kuhaku-plugins` → `/reload-plugins`

初回はクローンを `/plugin marketplace add <path>` で marketplace として追加してからインストールする。

## jev-judge のアーキテクチャ

function-hooks プラグイン API（early access、2.1.289 で作成・検証。リリース間で変わり得る）を使う mod と、独立した skill の 2 本立て。

### mod（`hooks/register.tsx`、`hooks/hooks.json` で登録）

`AskUserQuestion` の表示に TypeSafe Jev の判定を後から書き込む。2 つのフックが plugin state の atom（`verdicts`、`tool_use_id` → `Verdict`、直近 20 件のみ保持）を介して連携する。

1. `tool.call`（AskUserQuestion）: `next(e)` で **ダイアログを先に開き**、判定は `void judge()` で裏で走らせる。ダイアログを判定待ちでブロックしないことが設計の要。
   - `$.model.fork` で現セッションの fork に質問の英訳と文脈要約（JSON）を作らせる → TypeSafe `/v1/systemone` に送る。単一選択は `choice`、複数選択は選択肢ごとの `noul`（キーは `q{i}` / `q{i}_o{j}`）。
   - 結果を atom に書き、`$.ui.notice` でダイアログ直下にサマリーを出す。失敗時は notice に加えて `$.ui.toast` でも知らせる（直下の行を描かない画面があるため）。回答済みダイアログへの notice はエンジンが拒否するので握りつぶしている。
2. `ui.render`（AskUserQuestion）: atom が `done` なら各 option の **description の先頭に** `【Jev 72%・推奨】` 等を足して再描画する。**label は回答値になるので絶対に変えない。**

- API キーは `userConfig.api_key`（sensitive、キーチェーン保存）を優先し、空なら `$.env.get('TYPESAFE_API_KEY')`。Desktop アプリはシェル環境を読まないため設定を優先している（ただし Desktop は現状非対応）。
- 判定と質問の数・並びがずれたら `zip` / `parseEnglish` が throw して判定を諦める（誤った選択肢に確率を付けないため）。
- `types/index.d.ts` が `Verdict` 型と `PluginState` の module augmentation を持つ。state の形を変えたらここも直す。
- 画面に出す文言は日本語。

### skill（`skills/jev/`）

`/jev-judge:jev` や「Jev に聞いて」で起動。Claude が英語でリクエスト JSON を組み立て、`scripts/ask-jev.sh <request.json>`（curl + jq、`TYPESAFE_API_KEY` 必須）で送り、結果を日本語で返す。mod とはコードを共有していない。

## 規約

- コード内コメント・コミットメッセージは日本語（Conventional Commits、scope はプラグイン名: `feat(jev-judge): ...`）。
- README は英語（`README.md`）と日本語（`README.ja.md`）の 2 本。挙動や要件を変えたら両方を更新する。
