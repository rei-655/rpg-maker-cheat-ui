/**
 * 配布用の zip を作る。
 *
 * 中身は導入に必要なものだけ。受け取った人はビルド環境を持たないので、
 * ソース・テスト・設定ファイルは入れない。
 *
 *   npm run package
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = join(ROOT, 'release')

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const NAME = `rpg-cheat-ui-${version}`
const STAGE = join(RELEASE, NAME)
const ZIP = join(RELEASE, `${NAME}.zip`)

const FILES = [
  'install.bat',
  'uninstall.bat',
  'LICENSE',
  'dist/cheat-ui.js',
  'dist/cheat-ui.css',
  'plugin/CheatUILoader.js',
  'tools/install.ps1',
  'tools/install.mjs'
]

if (!existsSync(join(ROOT, 'dist', 'cheat-ui.js'))) {
  console.error('dist/ がありません。先に npm run build を実行してください。')
  process.exit(1)
}

rmSync(STAGE, { recursive: true, force: true })
rmSync(ZIP, { force: true })

for (const file of FILES) {
  const source = join(ROOT, file)

  if (!existsSync(source)) {
    console.error(`missing: ${file}`)
    process.exit(1)
  }

  const target = join(STAGE, file)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target)
}

writeFileSync(join(STAGE, 'README.md'), readme(version), 'utf-8')
compress()

const size = (statSync(ZIP).size / 1024).toFixed(0)

console.log(`${ZIP}  (${size} KB)`)
for (const file of [...FILES, 'README.md'].sort()) console.log(`  ${file}`)

/** Windows なら Compress-Archive、それ以外は zip コマンドを使う。 */
function compress() {
  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${STAGE}' -DestinationPath '${ZIP}' -Force`
    ])
    return
  }

  execFileSync('zip', ['-qr', ZIP, NAME], { cwd: RELEASE })
}

function readme(release) {
  return `# rpg-cheat-ui ${release}

A cheat overlay for RPG Maker MV / MZ games.
RPG ツクール MV / MZ 用のチートオーバーレイ。

## English

1. Unzip anywhere.
2. Drag your game folder (or \`Game.exe\`) onto **install.bat**.
   Double-clicking works too: it looks for a game around itself, and opens a
   file picker if it cannot find one.
3. Start the game and press **Ctrl+C**.

Node.js is not required — the installer only uses the PowerShell that ships
with Windows. On other platforms run \`node tools/install.mjs "/path/to/Game"\`.

**uninstall.bat** removes it the same way.

The installer never touches \`js/main.js\`, and every file it overwrites is
backed up next to the original as \`*.cheatui-backup-<timestamp>\`.

Settings live in \`cheat-settings/\` next to the game: language and window in
\`ui.json\`, key bindings in \`shortcuts.json\`. Delete a file to reset it.
Language can also be pre-set with the \`defaultLocale\` plugin parameter
(\`auto\` / \`en\` / \`ja\` / \`ko\`).

## 日本語

1. どこかに展開します。
2. ゲームのフォルダ（または \`Game.exe\`）を **install.bat** にドラッグします。
   ダブルクリックでも構いません。周辺からゲームを探し、見つからなければ
   選択ダイアログが開きます。
3. ゲームを起動して **Ctrl+C** を押します。

Node.js は不要です。Windows 標準の PowerShell だけで動きます。
それ以外の環境では \`node tools/install.mjs "/path/to/Game"\` を使います。

削除は **uninstall.bat** です。

\`js/main.js\` には触れません。上書きするファイルは
\`*.cheatui-backup-<timestamp>\` として控えを残します。

設定はゲームの隣の \`cheat-settings/\` に入ります。言語とウィンドウは
\`ui.json\`、キー割り当ては \`shortcuts.json\`。消せば初期値に戻ります。
言語はプラグインの \`defaultLocale\`（\`auto\` / \`en\` / \`ja\` / \`ko\`）でも
指定できます。

---

https://github.com/rei-655/rpg-maker-cheat-ui · MIT
`
}
