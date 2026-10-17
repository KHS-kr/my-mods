// Token Weather: a live forecast of the context window, above the prompt.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { TokenWeatherGit, TokenWeatherReading, TokenWeatherSession, TokenWeatherSpin } from '../types'

const HISTORY = 12
const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
const FORECAST = [
  { upTo: 25, icon: '☀', word: 'Clear', color: 'yellow' },
  { upTo: 50, icon: '☁', word: 'Cloudy', color: 'cyan' },
  { upTo: 75, icon: '☂', word: 'Showers', color: 'blue' },
  { upTo: 90, icon: '☇', word: 'Storm', color: 'magenta' },
  { upTo: Infinity, icon: '↯', word: 'Compact soon', color: 'red' },
] as const

// Held by the host, so the history survives a hot reload of this file.
const readings = atom({ plugin: 'token-weather', key: 'readings' } as const, [] as TokenWeatherReading[])
const session = atom({ plugin: 'token-weather', key: 'session' } as const, null as TokenWeatherSession | null)
const spin = atom({ plugin: 'token-weather', key: 'spin' } as const, null as TokenWeatherSpin | null)

export const register: Register = on => {
  // The spinner's ticker runs only while a turn does; the band's own isWorking starts and stops it.
  let ticker: Timer | null = null
  let isWorking = false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await takeReading($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      await takeReading($) // main-loop turns only, not subagents
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const history = await read($, readings)
    const now5h = await read($, session)
    if (e.props.hasSurvey || history.length === 0) {
      return next(e)
    }

    isWorking = e.props.isWorking
    if (isWorking && !ticker) {
      ticker = $.clock.every(150, () => {
        if (!isWorking) {
          ticker?.cancel()
          ticker = null
          void update($, spin, () => null)
          return
        }
        void $.clock
          .now()
          .then(at => update($, spin, s => (s ? { ...s, frame: s.frame + 1 } : { since: at, frame: 0 })))
      })
    }
    const spinning = isWorking ? await read($, spin) : null
    const elapsed = spinning ? Math.floor(((await $.clock.now()) - spinning.since) / 1000) : 0

    const { Box, Text } = $.ui.resolve(e)
    const now = history[history.length - 1]
    const f = FORECAST.find(b => now.percent < b.upTo) ?? FORECAST[FORECAST.length - 1]
    const resetsIn = now5h?.resetsAt ? untilReset(now5h.resetsAt, await $.clock.now()) : ''

    const isBoxed = e.props.maxRows >= 5
    const hasMeters = e.props.bodyColumns >= 90
    const model = now5h && <Text color="green">{`◆ ${now5h.model}`}</Text>
    const fiveHour = now5h?.percentUsed !== undefined && (
      <Box flexDirection="row">
        <Text dimColor>{'5h '}</Text>
        {hasMeters && meter(Text, now5h.percentUsed, sessionColor(now5h.percentUsed))}
        <Text color={sessionColor(now5h.percentUsed)}>{` ${now5h.percentUsed}%`}</Text>
        {resetsIn && <Text dimColor>{` · resets in ${resetsIn}`}</Text>}
      </Box>
    )

    return (
      <Box
        flexDirection="column"
        paddingX={1}
        width="100%"
        borderStyle={isBoxed ? 'round' : undefined}
        borderColor={isWorking ? 'white' : f.color}
      >
        {e.props.maxRows >= 3 && (
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold>{`✎ ${now5h?.name ?? 'Untitled session'}`}</Text>
            {isWorking ? (
              <Text color="white" bold>
                {`${SPINNER[(spinning?.frame ?? 0) % SPINNER.length]} working ${duration(elapsed)}`}
              </Text>
            ) : (
              <Text dimColor>{'✓ ready'}</Text>
            )}
          </Box>
        )}
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row">
            <Text color={f.color} bold>{`${f.icon} ${f.word}  `}</Text>
            {hasMeters && meter(Text, now.percent, f.color)}
            <Text bold>{` ${now.percent}%`}</Text>
            <Text dimColor>{`  ${short(now.tokens)} / ${short(now.window)}`}</Text>
          </Box>
          {model}
        </Box>
        {now5h && e.props.maxRows >= 2 && (
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row">
              <Text color="cyan">{`▸ ${tildify(now5h.cwd)}`}</Text>
              {now5h.git && <Text color="magenta">{`  ⎇ ${now5h.git.branch}`}</Text>}
              {now5h.git && gitMarks(Text, now5h.git)}
            </Box>
            {fiveHour}
          </Box>
        )}
      </Box>
    )
  })
}

async function takeReading($: EngineInterface) {
  const usage = await $.session.usage()
  const fiveHour = usage.rateLimits.find(r => r.kind === 'five_hour')
  const model = await $.session.model()
  const cwd = await $.session.cwd()
  const [git, name] = await Promise.all([gitState($, cwd), sessionName($)])
  await update($, session, () => ({
    model,
    percentUsed: fiveHour?.percentUsed,
    resetsAt: fiveHour?.resetsAt,
    cwd,
    git,
    name,
  }))

  const { context } = usage
  if (!context?.window) return
  const tokens = context.tokens ?? 0
  const percent = context.percent ?? Math.round((tokens / context.window) * 100)
  await update($, readings, history =>
    [...history, { tokens, window: context.window, percent }].slice(-HISTORY),
  )
}

function short(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return String(n)
}

function sessionColor(percent: number) {
  if (percent >= 90) return 'red'
  if (percent >= 75) return 'magenta'
  if (percent >= 50) return 'yellow'
  return 'green'
}

function untilReset(resetsAt: string, nowMs: number) {
  const minutes = Math.max(0, Math.round((Date.parse(resetsAt) - nowMs) / 60_000))
  if (Number.isNaN(minutes)) return ''
  const h = Math.floor(minutes / 60)
  return h > 0 ? `${h}h${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

// The branch and work-tree counts from one `git status`; nothing outside a repository.
async function gitState($: EngineInterface, cwd: string): Promise<TokenWeatherGit | undefined> {
  const status = await $.process
    .run(['git', 'status', '--porcelain=v2', '--branch'], { cwd, timeoutMs: 3000 })
    .catch(() => null)
  if (!status || status.exitCode !== 0) return undefined
  const git: TokenWeatherGit = { branch: '', changed: 0, untracked: 0, ahead: 0, behind: 0 }
  let oid = ''
  for (const line of status.stdout.split('\n')) {
    if (line.startsWith('# branch.head ')) git.branch = line.slice(14)
    else if (line.startsWith('# branch.oid ')) oid = line.slice(13)
    else if (line.startsWith('# branch.ab ')) {
      const [ahead, behind] = line.slice(12).split(' ')
      git.ahead = Math.abs(Number(ahead)) || 0
      git.behind = Math.abs(Number(behind)) || 0
    } else if (line.startsWith('? ')) git.untracked += 1
    else if (/^[12u] /.test(line)) git.changed += 1
  }
  if (git.branch === '(detached)') git.branch = `(${oid.slice(0, 7)})`
  return git
}

// The session's name: the last /rename, else the title Claude Code gave it, read from the transcript.
async function sessionName($: EngineInterface) {
  const id = await $.session.id()
  const found = await $.process
    .run(
      [
        'sh',
        '-c',
        'grep -hE \'"type":"(custom|ai)-title"\' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/projects/*/"$1".jsonl 2>/dev/null',
        'sh',
        id,
      ],
      { timeoutMs: 3000 },
    )
    .catch(() => null)
  let custom: string | undefined
  let ai: string | undefined
  for (const line of found?.stdout.split('\n') ?? []) {
    try {
      const entry = JSON.parse(line)
      if (entry.customTitle) custom = entry.customTitle
      else if (entry.aiTitle) ai = entry.aiTitle
    } catch {}
  }
  return custom ?? ai
}

function tildify(path: string) {
  return path.replace(/^\/(Users|home)\/[^/]+/, '~')
}

// A ten-cell bar: the used part in color, the rest dim.
function meter(Text: any, percent: number, color: string) {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)))
  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(10 - filled)}</Text>
    </Text>
  )
}

// Changed and untracked files, then commits ahead of and behind upstream; a check when clean.
function gitMarks(Text: any, git: TokenWeatherGit) {
  const isClean = git.changed + git.untracked === 0
  return (
    <Text>
      {isClean && <Text color="green">{' ✓'}</Text>}
      {git.changed > 0 && <Text color="yellow">{` ●${git.changed}`}</Text>}
      {git.untracked > 0 && <Text color="red">{` ?${git.untracked}`}</Text>}
      {git.ahead > 0 && <Text color="cyan">{` ↑${git.ahead}`}</Text>}
      {git.behind > 0 && <Text color="cyan">{` ↓${git.behind}`}</Text>}
    </Text>
  )
}

function duration(seconds: number) {
  const m = Math.floor(seconds / 60)
  return m > 0 ? `${m}m${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`
}
