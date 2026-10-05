/** 1 問ぶんの判定。probs は options と同じ並び（multiSelect では各選択肢を選ぶ確率）。 */
export type QuestionVerdict = {
  isMulti: boolean
  probs: number[]
  confidence: number | null
}

export type Verdict =
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'done'; questions: QuestionVerdict[] }

declare module 'claude-code' {
  interface PluginState {
    'jev-judge': { verdicts: Record<string, Verdict> }
  }
}
