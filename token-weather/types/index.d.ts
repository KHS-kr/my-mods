export type TokenWeatherReading = { tokens: number; window: number; percent: number }

// The checked-out branch (or short commit when detached) and how the work tree differs.
export type TokenWeatherGit = {
  branch: string
  changed: number
  untracked: number
  ahead: number
  behind: number
}

// The main model, the five-hour session window, and where the session is, as of the last reading.
export type TokenWeatherSession = {
  model: string
  name?: string
  percentUsed?: number
  resetsAt?: string
  cwd: string
  git?: TokenWeatherGit
}

// While a turn runs: when it started and which spinner frame is drawn.
export type TokenWeatherSpin = { since: number; frame: number }

declare module 'claude-code' {
  interface PluginState {
    'token-weather': {
      readings: TokenWeatherReading[]
      session: TokenWeatherSession | null
      spin: TokenWeatherSpin | null
    }
  }
}
