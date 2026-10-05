import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const QUESTIONS = [
  {
    question: 'runbook の PIN ケースをどう直しますか？',
    header: 'runbook',
    multiSelect: false,
    options: [
      { label: '残して前提だけ直す', description: '安全境界の検証として残す' },
      { label: '対象外にする', description: '連携テナントでは PIN を使わない' },
    ],
  },
]

const ENGLISH = {
  context: 'Linked tenants should not use PIN sign-in.',
  questions: [
    {
      question: 'How should the PIN cases in the runbook be revised?',
      options: ['Keep: verify the boundary', 'Out of scope: linked tenants do not use PIN'],
    },
  ],
}

const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

/** エンジンの代わり: fork・Jev API・notice を受け、ダイアログは判定が出るまで開いたままにする。 */
const standIn = (on: On, jevBody: unknown) => {
  const sent: { jev?: any; auth?: string; notices: string[]; toasts: string[]; id: string; drawn?: any } = {
    notices: [],
    toasts: [],
    id: '',
  }
  let settle = () => {}
  const judged = new Promise<void>(resolve => (settle = resolve))

  on('model.fork', () => ({ value: { isAnswered: true, text: JSON.stringify(ENGLISH), usage: USAGE } }))
  on('http.fetch', ($, e) => {
    sent.jev = JSON.parse(e.init?.body ?? '{}')
    sent.auth = e.init?.headers?.Authorization
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(jevBody) } }
  })
  on('ui.notice', ($, e) => {
    sent.id = e.tool_use_id
    if (e.text) sent.notices.push(e.text)
    if (e.text && e.text !== 'Jev 判定中…') settle()
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    sent.toasts.push(e.text)
    return { value: undefined }
  })
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    await judged
    return { result: {} as never, text: 'answered' }
  })
  on('ui.render', { component: 'AskUserQuestion' }, ($, e) => {
    sent.drawn = e.props.questions
    const { Text } = $.ui.resolve(e)
    return <Text>dialog</Text>
  })
  return sent
}

const drawnQuestions = async ($: any, sent: { id: string; drawn?: any }) => {
  await $.ui.render({
    surface: 'terminal',
    component: 'AskUserQuestion',
    requestId: sent.id,
    props: { tool: 'AskUserQuestion', questions: QUESTIONS },
  })
  return sent.drawn
}

test('単一選択: 英語で Jev に聞き、日本語で確率と推奨を重ねる', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  const sent = standIn(on, {
    answers: {
      q0: { type: 'choice', choice: 'o1', confidence: 0.56, probabilities: { o0: 0.22, o1: 0.78 } },
    },
  })

  await $.tool.call({ tool: 'AskUserQuestion', questions: QUESTIONS })

  expect(sent.jev.state.context).toBe(ENGLISH.context)
  expect(sent.jev.questions.q0.criteria).toEqual({
    o0: 'Keep: verify the boundary',
    o1: 'Out of scope: linked tenants do not use PIN',
  })
  expect(sent.notices).toEqual(['Jev 判定中…', 'Jev 推奨: runbook「対象外にする」78%（確信度 0.56）'])

  const drawn = await drawnQuestions($, sent)
  expect(drawn[0].options.map((o: any) => o.label)).toEqual(['残して前提だけ直す', '対象外にする'])
  expect(drawn[0].options.map((o: any) => o.description)).toEqual([
    '【Jev 22%】 安全境界の検証として残す',
    '【Jev 78%・推奨】 連携テナントでは PIN を使わない',
  ])
})

test('API キーが無ければ失敗を出し、ダイアログはそのまま描く', async ($, on) => {
  mock.env(on, {})
  const sent = standIn(on, {})

  await $.tool.call({ tool: 'AskUserQuestion', questions: QUESTIONS })

  expect(sent.notices.at(-1)).toBe(
    'Jev 判定に失敗: API キーがありません（/plugin configure jev-judge@kuhaku-plugins で設定）',
  )
  expect(sent.toasts).toEqual([
    'Jev 判定に失敗: API キーがありません（/plugin configure jev-judge@kuhaku-plugins で設定）',
  ])
  const drawn = await drawnQuestions($, sent)
  expect(drawn).toEqual(QUESTIONS)
})

test('複数選択: 選択肢ごとの Noul を「選ぶ ○%」で重ねる', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  const multi = [{ ...QUESTIONS[0]!, multiSelect: true }]
  const sent = standIn(on, {
    answers: { q0_o0: { type: 'noul', noul: 0.3 }, q0_o1: { type: 'noul', noul: 0.9 } },
  })

  await $.tool.call({ tool: 'AskUserQuestion', questions: multi })

  expect(sent.jev.questions.q0_o1.type).toBe('noul')
  expect(sent.notices.at(-1)).toBe('Jev 推奨: runbook「対象外にする」')
})

test('設定の api_key があれば環境変数より優先して使う', { options: { api_key: 'from-config' } }, async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'from-env' })
  const sent = standIn(on, {
    answers: {
      q0: { type: 'choice', choice: 'o1', confidence: 0.56, probabilities: { o0: 0.22, o1: 0.78 } },
    },
  })

  await $.tool.call({ tool: 'AskUserQuestion', questions: QUESTIONS })

  expect(sent.auth).toBe('Bearer from-config')
  expect(sent.toasts).toEqual([])
})

test('設定が無ければ環境変数のキーを使う', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'from-env' })
  const sent = standIn(on, {
    answers: {
      q0: { type: 'choice', choice: 'o1', confidence: 0.56, probabilities: { o0: 0.22, o1: 0.78 } },
    },
  })

  await $.tool.call({ tool: 'AskUserQuestion', questions: QUESTIONS })

  expect(sent.auth).toBe('Bearer from-env')
})
