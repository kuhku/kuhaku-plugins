# kuhaku-plugins

日本語 · [English](README.md)

[kuhku](https://github.com/kuhku) の Claude Code プラグイン集です。今は mod が 1 つで、スキルなども順に足していきます。

| プラグイン | できること |
|---|---|
| [jev-judge](#jev-judge) | Claude の `AskUserQuestion` ダイアログの選択肢に、TypeSafe Jev の判定を重ねて表示する |

## インストール

Claude Code の中で次を実行します。

```text
/plugin marketplace add kuhku/kuhaku-plugins
/plugin install jev-judge@kuhaku-plugins
```

## jev-judge

Claude が `AskUserQuestion` で質問してきたとき、どの選択肢が会話の流れに合うかを [TypeSafe](https://typesafe.ai) の Jev に聞き、ダイアログそのものに書き添えます。

- 各選択肢の説明の先頭に Jev の確率を付け、一番高いものに推奨の印を付けます（`【Jev 78%・推奨】`）
- ダイアログの直下に 1 行でまとめます（`Jev 推奨: runbook「対象外にする」78%（確信度 0.56）`）
- 複数選択の質問では、選択肢ごとに「選ぶべき確率」を出します（`【Jev 選ぶ 65%・推奨】`）

ダイアログはすぐに開き、判定は読んでいる間に数秒遅れて付きます。選択肢の label は変えないので、回答の値には影響しません。

### 仕組み

1. `AskUserQuestion` が来たら、今のセッションを引き継いだ呼び出し（`$.model.fork`。同じモデルで、会話はプロンプトキャッシュから読まれる）に、質問と選択肢の英訳と、判断に要る文脈の英語要約を作らせます。
2. それを TypeSafe API に送ります。単一選択は Choice、複数選択は選択肢ごとの Noul で聞きます。
3. 確率を付けてダイアログを描き直し、直下に 1 行を出します。

### 必要なもの

- function hooks のプラグイン API に対応した Claude Code（early access。2.1.289 で作成・確認）。API はリリースの間で変わることがあります。
- 環境変数 `TYPESAFE_API_KEY` に TypeSafe の API キー。無いときは、ダイアログ直下にキーが無いと出し、ダイアログはそのまま表示します。

### 送られるデータと費用

- 質問・選択肢と、会話の英語要約が TypeSafe API に送られます。
- 1 問ごとに、Claude のモデルへの呼び出しが 1 回（大半はキャッシュ読み）と、TypeSafe への呼び出しが 1 回増えます。

### 開発

```text
claude plugin validate plugins/jev-judge
claude plugin test plugins/jev-judge
```

## ライセンス

[MIT](LICENSE)
