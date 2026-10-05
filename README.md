# kuhaku-plugins

[日本語](README.ja.md) · English

Claude Code plugins by [kuhku](https://github.com/kuhku): mods, and later skills and other tools.

| Plugin | What it does |
|---|---|
| [jev-judge](#jev-judge) | Shows TypeSafe Jev's judgment on the options of Claude's `AskUserQuestion` dialog |

## Install

Run these inside Claude Code:

```text
/plugin marketplace add kuhku/kuhaku-plugins
/plugin install jev-judge@kuhaku-plugins
```

## jev-judge

When Claude asks you something with `AskUserQuestion`, jev-judge asks [TypeSafe](https://typesafe.ai)'s Jev model which option fits the conversation, and writes the answer onto the dialog itself:

- each option's description starts with Jev's probability, and the top one is marked as recommended (`【Jev 78%・推奨】`)
- one line under the dialog sums it up (`Jev 推奨: runbook「対象外にする」78%（確信度 0.56）`)
- multi-select questions get a per-option probability of being worth selecting (`【Jev 選ぶ 65%・推奨】`)

The dialog opens right away; the judgment is added a few seconds later, while you read. Option labels are never changed, so your answer is unaffected. Labels on screen are in Japanese.

### How it works

1. On `AskUserQuestion`, the mod asks a fork of the current session (`$.model.fork`: same model, transcript served from the prompt cache) to translate the question and options into English and to summarize the context needed to answer.
2. It sends that to the TypeSafe API: a Choice question for single-select, a Noul question per option for multi-select.
3. It redraws the dialog with the probabilities and shows the summary line.

### Requirements

- Claude Code with the function-hooks plugin API (early access; built and tested on 2.1.289). The API may change between releases.
- A TypeSafe API key in the environment as `TYPESAFE_API_KEY`. Without it, the line under the dialog says the key is missing and the dialog is left as is.

### Privacy and cost

- The question, its options and an English summary of the conversation are sent to the TypeSafe API.
- Each question costs one extra call on your Claude model (mostly cache reads) plus one TypeSafe call.

### Development

```text
claude plugin validate plugins/jev-judge
claude plugin test plugins/jev-judge
```

## License

[MIT](LICENSE)
