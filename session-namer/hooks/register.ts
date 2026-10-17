// Session Namer: asks for the session's name when it starts or is cleared.
import type { Register } from 'claude-code'

const SKIP = 'Skip'
// A resume, fork or compact keeps the name the session already has.
const ASK_ON = new Set(['startup', 'clear'])

export const register: Register = on => {
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    if (!ASK_ON.has(e.source) || e.agent_type) {
      return result
    }

    const folder = e.cwd.split('/').filter(Boolean).pop() ?? 'session'
    let answer: string
    try {
      answer = await $.ui.ask('What should this session be called?', {
        header: 'Session',
        options: [folder, SKIP],
      })
    } catch {
      return result // dismissed, or a -p run with no one to ask
    }

    const name = answer.trim()
    if (!name || name === SKIP) {
      return result
    }
    return { ...result, sessionTitle: name }
  }).catch(($, e, next) => next(e))
}
