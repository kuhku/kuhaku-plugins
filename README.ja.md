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
| 01 | [**jev-judge**](#jev-judge) | mod | Claude の `AskUserQuestion` ダイアログに、TypeSafe Jev の判定を書き添える |

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

```text
 ←  ☐ 英訳モデル   ☐ 表示の追加   ✓ Submit  →

 jev-judge の英訳と文脈要約は、どれにしますか？

 ❯ 1. fork のまま
      【Jev 45%】 会話の文脈まで英語で要約できるので ...
   2. Haiku で英訳だけ
      【Jev 2%】 質問と選択肢だけを英訳する ...
   3. Haiku + 直近の発言
      【Jev 53%・推奨】 直近の数発言を Haiku に渡して ...

                      jev-judge: Jev 推奨: 英訳モデル「Haiku + 直近の発言」53%（確信度 0.30）
```

- **選択肢ごとに** — 説明の先頭に Jev の確率を付け、一番高いものに `推奨` の印を付けます。
- **ダイアログの直下に 1 行** — 推奨と確信度をまとめて出します。
- **複数選択にも対応** — 選択肢ごとに「選ぶべき確率」を出します（`【Jev 選ぶ 65%】`）。
- **邪魔をしない** — ダイアログはすぐに開き、判定は数秒遅れて付きます。
  選択肢の label は変えないので、回答の値は選んだものそのままです。

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
| TypeSafe の API キー | Claude Code を起動する環境（シェルの設定ファイルなど）に `TYPESAFE_API_KEY` を設定します。無いときは、ダイアログ直下にキーが無いと出し、ダイアログはそのまま表示します。 |

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

手元の変更を試すときは、clone したフォルダを marketplace として追加します（`/plugin marketplace add <path>`）。
Claude Code はそのフォルダから直接読み込むので、編集は `/reload-plugins` で反映されます。

<br>

## ライセンス

[MIT](LICENSE) &nbsp;·&nbsp; © 2026 kuhku
