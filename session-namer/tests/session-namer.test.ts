import { describe, expect, test } from 'claude-code/testing'

const answering = (answer: string | null) => ($: any, e: any) =>
  answer === null
    ? { deny: 'dismissed' }
    : { result: { questions: e.questions, answers: { [e.questions[0].question]: answer } } }

describe('session-namer', () => {
  test('a typed name becomes the session title on startup', async ($, on) => {
    on('classic.SessionStart', () => ({}))
    on('tool.call', { tool: 'AskUserQuestion' }, answering('Mods work') as any)
    const result = await $.classic.SessionStart({ source: 'startup', cwd: '/Users/me/my-mods' } as any)
    expect(result.sessionTitle).toBe('Mods work')
  })

  test('the folder suggestion is offered and taken on /clear', async ($, on) => {
    on('classic.SessionStart', () => ({}))
    let options: string[] = []
    on('tool.call', { tool: 'AskUserQuestion' }, (($: any, e: any) => {
      options = e.questions[0].options.map((o: any) => o.label)
      return answering('my-mods')($, e)
    }) as any)
    const result = await $.classic.SessionStart({ source: 'clear', cwd: '/Users/me/my-mods' } as any)
    expect(options).toEqual(['my-mods', 'Skip'])
    expect(result.sessionTitle).toBe('my-mods')
  })

  test('Skip, a dismissal or a resume leaves the title alone', async ($, on) => {
    on('classic.SessionStart', () => ({}))
    let asked = 0
    let answer: string | null = 'Skip'
    on('tool.call', { tool: 'AskUserQuestion' }, (($: any, e: any) => {
      asked++
      return answering(answer)($, e)
    }) as any)
    expect((await $.classic.SessionStart({ source: 'startup' } as any)).sessionTitle).toBeUndefined()
    answer = null
    expect((await $.classic.SessionStart({ source: 'startup' } as any)).sessionTitle).toBeUndefined()
    expect((await $.classic.SessionStart({ source: 'resume' } as any)).sessionTitle).toBeUndefined()
    expect(asked).toBe(2)
  })
})
