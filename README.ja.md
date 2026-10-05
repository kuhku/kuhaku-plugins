<div align="center">

# kuhaku-plugins

**Claude Code のための、小さく静かな道具たち。**

[English](README.md) &nbsp;·&nbsp; [日本語](README.ja.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-222222?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude_Code-2.1.289+-555555?style=flat-square)](https://github.com/anthropics/claude-code)
[![Plugins](https://img.shields.io/badge/plugins-1-888888?style=flat-square)](#プラグイン)

</div>

---

*空白（kuhaku）* の名のとおり、ここにあるプラグインは作業の余白に置くものです。
要るところに少しだけ手がかりを足し、それ以外のときは邪魔をしません。

<br>

## プラグイン

| | プラグイン | 種類 | できること |
|---|---|---|---|
| 01 | [**jev-judge**](#jev-judge) | mod + スキル | Claude の `AskUserQuestion` ダイアログに TypeSafe Jev の判定を書き添え、`/jev-judge:jev` で Jev に直接聞くこともできる |

スキル・mod などは、これから順に足していきます。

<br>

## インストール

Claude Code の中で次を実行します。

```text
/plugin marketplace add kuhku/kuhaku-plugins
/plugin install jev-judge@kuhaku-plugins
```

<br>

## jev-judge

> Claude からの質問の余白に、もうひとつの意見を。

Claude が `AskUserQuestion` で質問してきたとき、ここまでの会話にどの選択肢が合うかを
[TypeSafe](https://typesafe.ai) の **Jev** に聞き、その答えをダイアログそのものに書き添えます。

<p align="center">
  <img src="docs/images/jev-judge-single.png" alt="単一選択の質問での jev-judge" width="100%"><br>
  <sub>単一選択: 選択肢ごとの確率と推奨、ダイアログ直下のまとめの 1 行</sub>
</p>

<p align="center">
  <img src="docs/images/jev-judge-multi.png" alt="複数選択の質問での jev-judge" width="100%"><br>
  <sub>複数選択: 選択肢ごとの「選ぶべき確率」</sub>
</p>

- **選択肢ごとに** — 説明の先頭に Jev の確率を付け、一番高いものに `推奨` の印を付けます。
- **ダイアログの直下に 1 行** — 推奨と確信度をまとめて出します。
- **複数選択にも対応** — 選択肢ごとに「選ぶべき確率」を出します（`【Jev 選ぶ 65%】`）。
- **邪魔をしない** — ダイアログはすぐに開き、判定は数秒遅れて付きます。
  選択肢の label は変えないので、回答の値は選んだものそのままです。

### スキル: `/jev-judge:jev`

会話の中の決めごとを Jev に聞くスキルです。「Jev に聞いて」「jev で判定して」や `/jev-judge:jev` で使えます。
Claude が決めたいことと選択肢を拾い、英語の質問（Choice / Noul / Score）にして同梱の `scripts/ask-jev.sh` で送り、
確率と確信度を日本語で報告します。Claude 自身の見立ては、Jev の結果と分けて書きます。

### 仕組み

```text
AskUserQuestion ──> 今のセッションの fork ──> TypeSafe API（Jev） ──> ダイアログを描き直す
                    英訳と文脈の要約            質問ごとに Choice、
                                               複数選択は選択肢ごとに Noul
```

1. 今のセッションを引き継いだ呼び出し（`$.model.fork`。同じモデルで、会話はプロンプトキャッシュから
   読まれる）に、質問と選択肢の英訳と、判断に要る文脈の英語要約を作らせます。Jev には、得意な英語で聞きます。
2. それを型付きの質問として TypeSafe API に送ります。
3. 確率を付けてダイアログを描き直し、直下に 1 行を出します。

### 必要なもの

| | |
|---|---|
| Claude Code | function hooks のプラグイン API に対応したもの。**2.1.289** で作成・確認しています。API は early access で、リリースの間で変わることがあります。 |
| TypeSafe の API キー | プラグインを有効にするときか、あとから `/plugin configure jev-judge@kuhaku-plugins` で入れます。キーチェーンなどの安全な保存先に置かれ、ターミナルでも Desktop アプリでも使えます。空のときは環境変数 `TYPESAFE_API_KEY` を読みます（Desktop アプリはシェルの設定ファイルを読みません）。キーが無いときや判定に失敗したときは、トーストとダイアログ直下の行で知らせ、ダイアログはそのまま表示します。 |

### 関連: TypeSafe のスキル

jev-judge は TypeSafe の HTTP API を直接呼びます。動かすのに、ほかのプラグインは**要りません**。

設計には、TypeSafe 公式の Claude Code プラグインを使いました。System One の質問（Choice / Noul / Score）・
state・confidence の組み立て方を Claude に教えるスキルです。jev-judge の質問を自分の判断軸に合わせて
作り変えたいときは、入れておくと Claude に手伝わせやすくなります。

```text
/plugin marketplace add typesafe-ai/skills
/plugin install typesafe@typesafe-ai
```

### 送られるデータと費用

- **TypeSafe に送るもの:** 質問・選択肢と、会話の英語要約。
- **1 問ごとに増える呼び出し:** Claude のモデルへの呼び出しが 1 回（大半はプロンプトキャッシュの読み出し）と、TypeSafe への呼び出しが 1 回。

<br>

## 開発

```text
claude plugin validate plugins/jev-judge
claude plugin test plugins/jev-judge
```

手元の変更を試すときは、clone したフォルダを marketplace として追加し、そこからインストールします（`/plugin marketplace add <path>`）。
インストールしたプラグインはバージョンごとの複製から動くので、変更したら `plugin.json` と `.claude-plugin/marketplace.json` の
`version` を両方上げてコミットし、`claude plugin update <plugin>@kuhaku-plugins` と `/reload-plugins` を実行します（Desktop アプリも同じです）。

<br>

## ライセンス

[MIT](LICENSE) &nbsp;·&nbsp; © 2026 kuhku
