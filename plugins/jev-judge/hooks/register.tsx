import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { QuestionVerdict, Verdict } from '../types'

const JEV_URL = 'https://api.typesafe.ai/v1/systemone'
const KEEP = 20
const NO_KEY = 'API キーがありません（/plugin configure jev-judge@kuhaku-plugins で設定）'

const verdicts = atom({ plugin: 'jev-judge', key: 'verdicts' } as const, {})

type AskOption = { label: string; description: string; preview?: string }
type AskQuestion = { question: string; header: string; options: AskOption[]; multiSelect: boolean }

/** fork が返す英訳。options は元の並びのまま。 */
type English = {
  context: string
  questions: { question: string; options: string[] }[]
}

type JevAnswer =
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'noul'; noul: number }

const pct = (p: number) => `${Math.round(p * 100)}%`

/** 長さがそろっている前提の 2 配列を組にする。ずれていたら判定を諦める。 */
const zip = <A, B>(as: readonly A[], bs: readonly B[]): [A, B][] => {
  if (as.length !== bs.length) throw new Error('判定と質問の数が合いません')
  return as.map((a, i) => [a, bs[i] as B])
}

const topIndex = (probs: number[]) => probs.indexOf(Math.max(...probs))

const forkPrompt = (questions: AskQuestion[]) =>
  [
    'You are about to show the user the following AskUserQuestion dialog (JSON).',
    'Translate it into English and summarize, in English, the conversation context',
    'needed to judge which option is better (goal, constraints, relevant decisions;',
    'at most 150 words). Reply with ONLY a JSON object of this exact shape:',
    '{"context": string, "questions": [{"question": string, "options": [string]}]}',
    'Each option string is "<label>: <description>" in English, in the original order.',
    '',
    JSON.stringify(questions.map(({ question, options }) => ({ question, options }))),
  ].join('\n')

const parseEnglish = (text: string, questions: AskQuestion[]): English => {
  const body = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  const parsed = JSON.parse(body) as English
  const isAligned =
    parsed.questions?.length === questions.length &&
    parsed.questions.every((q, i) => q.options?.length === questions[i]?.options.length)
  if (!isAligned) throw new Error('英訳の形が元の質問と合いません')
  return parsed
}

/** Jev への質問。単一選択は Choice、複数選択は選択肢ごとの Noul。 */
const jevQuestions = (en: English, questions: AskQuestion[]) => {
  const out: Record<string, unknown> = {}
  zip(questions, en.questions).forEach(([q, eq], i) => {
    if (q.multiSelect) {
      eq.options.forEach((option, j) => {
        out[`q${i}_o${j}`] = {
          type: 'noul',
          instructions: {
            question: eq.question,
            option,
            ask: 'Given `context`, should the user select `option` for `question`? Several options may be selected.',
          },
        }
      })
      return
    }
    out[`q${i}`] = {
      type: 'choice',
      instructions: `Given \`context\`, which option is the better answer to this question: ${eq.question}`,
      criteria: Object.fromEntries(eq.options.map((option, j) => [`o${j}`, option])),
    }
  })
  return out
}

const toVerdicts = (answers: Record<string, JevAnswer>, questions: AskQuestion[]): QuestionVerdict[] =>
  questions.map((q, i) => {
    if (q.multiSelect) {
      const probs = q.options.map((_, j) => {
        const a = answers[`q${i}_o${j}`]
        return a?.type === 'noul' ? a.noul : 0
      })
      return { isMulti: true, probs, confidence: null }
    }
    const a = answers[`q${i}`]
    if (a?.type !== 'choice') throw new Error(`q${i} の回答がありません`)
    return {
      isMulti: false,
      probs: q.options.map((_, j) => a.probabilities[`o${j}`] ?? 0),
      confidence: a.confidence,
    }
  })

const summary = (questions: AskQuestion[], result: QuestionVerdict[]) =>
  'Jev 推奨: ' +
  zip(questions, result)
    .map(([q, v]) => {
      const options = zip(q.options, v.probs)
      if (v.isMulti) {
        const picked = options.filter(([, p]) => p >= 0.5).map(([o]) => o.label)
        return `${q.header}「${picked.join('・') || 'なし'}」`
      }
      const [best, p] = options[topIndex(v.probs)] ?? [q.options[0], 0]
      return `${q.header}「${best?.label}」${pct(p)}（確信度 ${v.confidence?.toFixed(2)}）`
    })
    .join(' / ')

/** ダイアログに描く質問。説明の先頭に判定を足すだけで、label は変えない（回答値になるため）。 */
const annotate = (questions: AskQuestion[], result: QuestionVerdict[]): AskQuestion[] =>
  zip(questions, result).map(([q, v]) => {
    const top = topIndex(v.probs)
    return {
      ...q,
      options: zip(q.options, v.probs).map(([o, p], j) => {
        const tag = v.isMulti
          ? `【Jev 選ぶ ${pct(p)}${p >= 0.5 ? '・推奨' : ''}】`
          : `【Jev ${pct(p)}${j === top ? '・推奨' : ''}】`
        return { ...o, description: `${tag} ${o.description}` }
      }),
    }
  })

export const register: Register = (on, options) => {
  const configuredKey = typeof options.api_key === 'string' ? options.api_key : ''

  on('tool.call', { tool: 'AskUserQuestion' }, ($, e, next) => {
    const id = e.tool_use_id
    const questions = e.questions as AskQuestion[]

    const setVerdict = (v: Verdict) =>
      update($, verdicts, all => {
        const kept = Object.entries(all).filter(([key]) => key !== id).slice(-(KEEP - 1))
        return { ...Object.fromEntries(kept), [id]: v }
      })
    // 回答済みのダイアログには出せない（エンジンが拒否する）ので握りつぶす
    const notice = (text: string) => {
      try {
        $.ui.notice(id, text)
      } catch {}
    }

    const judge = async () => {
      await setVerdict({ status: 'pending' })
      notice('Jev 判定中…')
      try {
        // Desktop アプリはシェルの設定を読まないので、設定（キーチェーン）を優先する
        const key = configuredKey || (await $.env.get('TYPESAFE_API_KEY'))
        if (!key) throw new Error(NO_KEY)

        const forked = await $.model.fork({ prompt: forkPrompt(questions) })
        if (!forked.isAnswered) throw new Error(`英訳に失敗しました（${forked.reason}）`)
        const en = parseEnglish(forked.text, questions)

        const res = await $.http.fetch(JEV_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'jev-latest',
            state: { context: en.context },
            questions: jevQuestions(en, questions),
          }),
        })
        if (!res.ok) throw new Error(`Jev API が ${res.status} を返しました`)
        const { answers } = JSON.parse(res.text) as { answers: Record<string, JevAnswer> }

        const result = toVerdicts(answers, questions)
        await setVerdict({ status: 'done', questions: result })
        notice(summary(questions, result))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await setVerdict({ status: 'error', message })
        notice(`Jev 判定に失敗: ${message}`)
        // ダイアログ直下の行を描かない画面もあるので、トーストでも知らせる
        $.ui.toast(`Jev 判定に失敗: ${message}`)
      }
    }

    // ダイアログは待たせずに開き、判定は回答待ちの間に裏で進める
    const ran = next(e)
    void judge()
    return ran
  })

  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const v = (await read($, verdicts))[e.requestId]
    if (v?.status !== 'done') return next(e)
    const questions = e.props.questions as AskQuestion[]
    if (v.questions.length !== questions.length) return next(e)
    return next({ ...e, props: { ...e.props, questions: annotate(questions, v.questions) } })
  })
}
