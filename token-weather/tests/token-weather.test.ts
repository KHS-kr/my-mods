import { describe, expect, test } from 'claude-code/testing'

describe('token-weather', () => {
  test('the band follows the context window', async ($, on) => {
    let tokens = 36_100
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({
      value: {
        startedAt: 0,
        rateLimits: [{ kind: 'five_hour', percentUsed: 23.5 }],
        context: { tokens, window: 200_000, percent: Math.round(tokens / 2_000) },
      },
    }))
    on('turn.complete', () => ({ text: '' }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.cwd', () => ({ value: '/Users/me/work' }))
    on('session.id', () => ({ value: 'abc' }))
    on('process.run', ($, e) =>
      e.argv[0] === 'git'
        ? {
            value: {
              exitCode: 0,
              stdout:
                '# branch.oid 1234567890\n# branch.head main\n# branch.ab +2 -1\n1 .M N... a\n1 M. N... b\n? c\n',
              stderr: '',
            },
          }
        : {
            value: {
              exitCode: 0,
              stdout:
                '{"type":"ai-title","aiTitle":"Old"}\n{"type":"custom-title","customTitle":"Mods work"}\n{"type":"ai-title","aiTitle":"Newer"}\n',
              stderr: '',
            },
          },
    )

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const ui = await $.ui.mount({
      plugin: 'token-weather',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 },
    } as any)
    expect(await ui.find({ type: 'Text', text: /Clear/ })).toBeDefined()

    tokens = 134_400
    await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1 } as any)
    expect(await ui.find({ type: 'Text', text: /Showers/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: / 67%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /claude-opus-5-5/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: / 23\.5%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /▸ ~\/work/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /⎇ main/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /✎ Mods work/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: / ●2/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: / \?1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: / ↑2/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: / ↓1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /✓ ready/ })).toBeDefined()
    await ui.unmount()
  })

  test('a running turn shows the spinner', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({
      value: { startedAt: 0, rateLimits: [], context: { tokens: 1_000, window: 200_000, percent: 1 } },
    }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.cwd', () => ({ value: '/tmp' }))
    on('session.id', () => ({ value: 'abc' }))
    on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/tmp' } as any)
    const ui = await $.ui.mount({
      plugin: 'token-weather',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 120 },
    } as any)
    expect(await ui.find({ type: 'Text', text: /working \d+s/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Untitled session/ })).toBeDefined()
    await ui.unmount()
  })
})
