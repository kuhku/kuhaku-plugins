---
name: jev
description: Ask TypeSafe's Jev model for a quick, calibrated judgment on a decision — which option fits, whether a condition holds, or how strongly something applies — by sending the question in English and reporting the result in Japanese. Use this whenever the user says "Jev に聞いて", "jev で判定", "Jev ならどれ？", "/jev", or asks for a second opinion with probabilities on choices that came up in the conversation (options from AskUserQuestion, naming candidates, licenses, design alternatives, scope decisions), even if they do not name the API. Not for open-ended writing or explanations: Jev returns probabilities, not reasons.
---

# Jev に判定してもらう

Jev（TypeSafe の System One モデル）は、文章を生成せず、型付きの判定と確率だけを返す。理由は返さない。
英語が最も得意なので、質問は英語で組み立て、結果は日本語でユーザーに返す。

## 1. 何を判定するかを決める

会話から、ユーザーが決めたいことと選択肢を拾う。曖昧なら、聞く前に短く確認する。

判定の種類は答えの意味で選ぶ。

| 決めたいこと | 種類 | 返るもの |
|---|---|---|
| 決まった選択肢から 1 つ | `choice` | 選ばれた選択肢、選択肢ごとの確率、confidence |
| ある条件が成り立つか（はい/いいえ） | `noul` | はいの確率（`noul`: 0〜1） |
| 程度（例: 緊急度・適合度） | `score` | 段階ごとの確率と加重平均 |

複数選択の質問は、選択肢ごとに `noul` を 1 つずつ立てる（「この選択肢は選ぶべきか」）。
独立した論点が複数あれば、1 回のリクエストにまとめて並べる。並列に評価され、互いの答えは見えない。
ユーザーが聞いていない前提（例: 「そもそもライブラリが要るか」）も判断に効くなら足してよいが、報告では
「こちらで足した問い」と分けて書く。聞かれたことへの答えを先に出す。

## 2. 英語でリクエストを組み立てる

`state` に判断材料を、`questions` に判定を書く。詳しい仕様が要るときは
[API リファレンス](https://docs.typesafe.ai/api.md) を読む。

- **state:** 目的・制約・既に決まっていること・関連する原文の要旨を、名前付きのフィールドに分けて英語で書く。
  Jev は会話を見ていないので、判断に効く前提はすべてここに入れる。
- **instructions:** 判定の問いを 1 つ、英語で。state のフィールドはバッククォートで参照する（例: `` `issue_goal` ``）。
- **criteria:** 選択肢の英語の説明。キーは短い英語の識別子にし、日本語のラベルとの対応は自分で覚えておく。
- **公平に書く:** 推したい選択肢にだけ理由を書くと、判定がそちらに寄る。各選択肢に同じ程度の説明と根拠を書く。
  ユーザーやペインが付けた「Recommended」は、criteria に書き写さない。

```json
{
  "model": "jev-latest",
  "state": {
    "goal": "...",
    "constraints": ["..."],
    "context": "..."
  },
  "questions": {
    "runbook_option": {
      "type": "choice",
      "instructions": "Given `goal` and `constraints`, which option is the better choice?",
      "criteria": {
        "keep": "Keep the cases and rewrite their premise. Rationale: ...",
        "out_of_scope": "Remove the cases and mark them out of scope. Rationale: ..."
      }
    }
  }
}
```

### 外部に送る内容に気をつける

state は外部の API（TypeSafe）に送られる。秘密情報・認証情報・個人を特定できる情報・顧客名は入れない。
人は役割で書く（"the team lead" など）。社内の固有事情は、判断に必要な範囲だけを一般化して書く。

## 3. 送る

リクエストをスクラッチパッド（無ければ一時ディレクトリ）に JSON ファイルとして書き、同梱のスクリプトで送る。

```bash
<このスキルのディレクトリ>/scripts/ask-jev.sh <request.json>
```

- 環境変数 `TYPESAFE_API_KEY` が要る。未設定なら、スクリプトがそう言って止まるので、ユーザーに設定を頼む。
- 出力は `{model, answers}`。answers のキーは questions のキーと同じ。

## 4. 日本語で報告する

結論を 1 行目に書き、続けて表で確率を見せる。英語の識別子は日本語のラベルに戻す。

```markdown
Jev の判定は「対象外にする」です（0.78 対 0.22、確信度 0.56）。

| 選択肢 | 確率 |
|---|---|
| 対象外にする | **0.78** |
| 残して前提だけ直す | 0.22 |
```

- **確信度の読み方:** confidence は確率分布の集中度で、正しさの保証ではない。目安として、0.8 以上は「明確」、
  0.5〜0.8 は「やや」、0.5 未満は「参考程度」と添える。noul は 0.5 付近なら「どちらとも言えない」と読む。
- **理由は書かない:** Jev は理由を返さない。理由らしきものを Jev の言葉として作らない。
- **自分の見解は分けて書く:** 必要なら、Jev の結果とは別に「自分の見立て」として一言添える。Jev と食い違うときは、
  どの前提が分かれ目かを書く。
- 送った英語の要点（何を state に入れたか）を 1 行で添えると、ユーザーが判定の前提を確かめられる。
