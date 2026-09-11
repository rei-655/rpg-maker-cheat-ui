/**
 * 配布用の zip を作る。
 *
 *   npm run package
 *
 * 中身は導入に必要なものだけ。受け取る人はビルド環境を持たないので、
 * ソース・テスト・設定ファイルは入れない。
 *
 * 構成で気をつけていること:
 *
 *  - zip の中に余分なフォルダを作らない。エクスプローラーの「すべて展開」は
 *    zip 名のフォルダを作るので、中にもう一段あると二重になる。
 *  - ゲームのフォルダに直接展開されても衝突しない名前にする。ツクールの
 *    ゲームは LICENSE や README.md を自分で持っていることがある。
 *  - 入れ物の名前は導入先（cheat-ui）と変える。MZ はゲーム直下が導入先なので、
 *    同じ名前だと導入スクリプトが自分自身を退避してしまう。
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = join(ROOT, 'release')
const PAYLOAD = 'cheat-ui-setup'

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const STAGE = join(RELEASE, `stage-${version}`)
const ZIP = join(RELEASE, `rpg-cheat-ui-${version}.zip`)

/** source in the repo -> path inside the archive */
const FILES = {
  'dist/cheat-ui.js': `${PAYLOAD}/dist/cheat-ui.js`,
  'dist/cheat-ui.css': `${PAYLOAD}/dist/cheat-ui.css`,
  'plugin/CheatUILoader.js': `${PAYLOAD}/plugin/CheatUILoader.js`,
  'tools/install.ps1': `${PAYLOAD}/tools/install.ps1`,
  'tools/install.mjs': `${PAYLOAD}/tools/install.mjs`,
  LICENSE: 'cheat-ui-LICENSE.txt'
}

if (!existsSync(join(ROOT, 'dist', 'cheat-ui.js'))) {
  console.error('dist/ がありません。先に npm run build を実行してください。')
  process.exit(1)
}

rmSync(STAGE, { recursive: true, force: true })
rmSync(ZIP, { force: true })

for (const [source, target] of Object.entries(FILES)) {
  const from = join(ROOT, source)

  if (!existsSync(from)) {
    console.error(`missing: ${source}`)
    process.exit(1)
  }

  const to = join(STAGE, target)
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to)
}

writeFileSync(join(STAGE, 'cheat-ui-install.bat'), launcher(''), 'latin1')
writeFileSync(join(STAGE, 'cheat-ui-uninstall.bat'), launcher(' -Uninstall'), 'latin1')
writeFileSync(join(STAGE, 'cheat-ui-README.md'), readme(version), 'utf-8')

compress()
report()

/**
 * ランチャーはここで組み立てる。リポジトリ内と配布物とで install.ps1 までの
 * 相対パスが違うため。中身は ASCII に保つ（cmd の既定コードページ対策）。
 */
function launcher(extra) {
  return [
    '@echo off',
    'rem  Cheat UI for RPG Maker MV / MZ',
    'rem',
    'rem  Drag your game folder (or Game.exe) onto this file,',
    'rem  or just double-click it.',
    'rem',
    'rem  Needs nothing but the PowerShell that ships with Windows.',
    `powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0${PAYLOAD}\\tools\\install.ps1" -GamePath "%~1"${extra}`,
    'echo.',
    'pause',
    ''
  ].join('\r\n')
}

function compress() {
  // '\*' で中身だけを詰める。フォルダを指定すると一段深くなる。
  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${STAGE}\\*' -DestinationPath '${ZIP}' -Force`
    ])
    return
  }

  execFileSync('zip', ['-qr', ZIP, '.'], { cwd: STAGE })
}

function report() {
  const size = (statSync(ZIP).size / 1024).toFixed(0)
  const entries = [...Object.values(FILES), 'cheat-ui-install.bat', 'cheat-ui-uninstall.bat', 'cheat-ui-README.md']

  console.log(`${ZIP}  (${size} KB)`)
  for (const entry of entries.sort()) console.log(`  ${entry}`)
}

function readme(release) {
  return `# Cheat UI for RPG Maker MV / MZ — ${release}

## English

1. Drag your game folder (or \`Game.exe\`) onto **cheat-ui-install.bat**.
   Double-clicking works too: it looks for a game around itself, and opens a
   file picker if it cannot find one.
2. Start the game and press **Ctrl+C**.

Node.js is not required — the installer only uses the PowerShell that ships
with Windows. On other platforms run
\`node cheat-ui-setup/tools/install.mjs "/path/to/Game"\`.

**cheat-ui-uninstall.bat** removes it the same way.

These files are safe to unpack straight into a game folder: everything is
prefixed with \`cheat-ui\`, so nothing of the game is overwritten. Once the game
runs, you can delete them — the installer has already copied what it needs. The installer
never touches \`js/main.js\`, and anything it replaces is kept next to the
original as \`*.cheatui-backup-<timestamp>\`.

Settings live in \`cheat-settings/\` next to the game: language and window in
\`ui.json\`, key bindings in \`keys.json\`. Delete a file to reset it. The
starting language can also be set with the \`defaultLocale\` plugin parameter
(\`auto\` / \`en\` / \`ja\` / \`ko\`).

## 日本語

1. ゲームのフォルダ（または \`Game.exe\`）を **cheat-ui-install.bat** に
   ドラッグします。ダブルクリックでも構いません。周辺からゲームを探し、
   見つからなければ選択ダイアログが開きます。
2. ゲームを起動して **Ctrl+C** を押します。

Node.js は不要です。Windows 標準の PowerShell だけで動きます。
それ以外の環境では \`node cheat-ui-setup/tools/install.mjs "/path/to/Game"\` を使います。

削除は **cheat-ui-uninstall.bat** です。

ゲームのフォルダにそのまま展開しても構いません。名前はすべて \`cheat-ui\` で
始まるため、ゲームのファイルを上書きしません。導入後は削除して構いません。\`js/main.js\` には触れず、
置き換えるものは \`*.cheatui-backup-<timestamp>\` として元の隣に残します。

設定はゲームの隣の \`cheat-settings/\` に入ります。言語とウィンドウは
\`ui.json\`、キー割り当ては \`keys.json\`。消せば初期値に戻ります。
最初の言語はプラグインの \`defaultLocale\`（\`auto\` / \`en\` / \`ja\` / \`ko\`）でも
指定できます。

---

https://github.com/rei-655/rpg-maker-cheat-ui · MIT (see cheat-ui-LICENSE.txt)
`
}
