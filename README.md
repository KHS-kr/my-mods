# my-mods

A Claude Code plugin marketplace of mods (Claude Code 2.1.287 or later).

| Mod | What it does |
| --- | --- |
| **session-namer** | Asks for a name when a session starts (`claude`) or is cleared (`/clear`): type one under Other, take the folder name, or Skip. Resumes keep their name. |
| **token-weather** | A box above the prompt: the session name and whether a turn is running, how full the context window is (as weather, with a meter), the model, the five-hour session usage and when it resets, the working directory, git branch and work-tree status. |

```
╭──────────────────────────────────────────────────────────────────────────╮
│ ✎ Claude Code mods 세팅                                  ⠹ working 12s │
│ ☂ Showers  ███████░░░ 67%  134.4k / 200k                ◆ claude-opus-5-5 │
│ ▸ ~/my-mods  ⎇ main ●3 ?1 ↑2         5h ██░░░░░░░░ 23.5% · resets in 2h13m │
╰──────────────────────────────────────────────────────────────────────────╯
```

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install token-weather --marketplace KHS-kr/my-mods
/plugin install session-namer --marketplace KHS-kr/my-mods
```

Answer `y` to add the marketplace, then pick a scope: `user` to have it in every project. Run `/reload-plugins` (or restart Claude Code) if a mod does not take effect.

The same from a shell:

```shell
claude plugin marketplace add KHS-kr/my-mods
claude plugin install token-weather@my-mods --scope user
claude plugin install session-namer@my-mods --scope user
```

## Update

```shell
claude plugin marketplace update my-mods
claude plugin update token-weather@my-mods
```

## Uninstall

```shell
claude plugin uninstall token-weather@my-mods
claude plugin marketplace remove my-mods
```

## Adding a mod to this marketplace

1. Put the mod in its own folder at the repository root (`<mod>/.claude-plugin/plugin.json`, `<mod>/hooks/hooks.json`, its module).
2. List it in `.claude-plugin/marketplace.json`:
   ```json
   { "name": "<mod>", "source": "./<mod>" }
   ```
3. Check it: `claude plugin validate ./<mod>` and `claude plugin test ./<mod>`.
4. Commit and push; installs pick it up with `claude plugin marketplace update my-mods`.

## Developing

```shell
claude --plugin-dir ./token-weather
```

The folder is watched: each save reloads the mod without a restart.
