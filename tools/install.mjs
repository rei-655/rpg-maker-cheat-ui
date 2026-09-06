/**
 * RPG ツクール MV / MZ のゲームにチート UI を導入する。
 * Windows では tools/install.ps1 を使う。これはそれ以外の環境向け。
 *
 *   node tools/install.mjs "/path/to/Game"
 *   node tools/install.mjs "/path/to/Game" --dry-run
 *
 * 上書きするファイルは `.cheatui-backup-<timestamp>` として控えを残す。
 * js/main.js には一切触れない。
 */
import {
    cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync
} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname, join, resolve} from 'node:path'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_NAME = 'CheatUILoader'
const ASSET_DIR = 'cheat'
const STAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const gameDir = args.find(arg => !arg.startsWith('--'))

if (!gameDir) {
    console.error('usage: node tools/install.mjs <game folder> [--dry-run]')
    process.exit(1)
}

const gameRoot = resolve(gameDir)

if (!existsSync(gameRoot)) {
    console.error(`not found: ${gameRoot}`)
    process.exit(1)
}

/** MV は www/ 配下、MZ はプロジェクト直下。 */
function detectLayout (root) {
    const candidates = [
        {engine: 'MV', contentRoot: join(root, 'www')},
        {engine: 'MZ', contentRoot: root}
    ]

    for (const candidate of candidates) {
        const js = join(candidate.contentRoot, 'js')

        if (!existsSync(join(candidate.contentRoot, 'index.html')) || !existsSync(js)) {
            continue
        }

        const isMz = existsSync(join(js, 'rmmz_core.js'))
        const isMv = existsSync(join(js, 'rpg_core.js'))

        if (!isMz && !isMv) {
            continue
        }

        return {
            engine: isMz ? 'MZ' : 'MV',
            contentRoot: candidate.contentRoot
        }
    }

    return null
}

const layout = detectLayout(gameRoot)

if (!layout) {
    console.error(`could not find an RPG Maker MV/MZ game in ${gameRoot}`)
    console.error('expected index.html plus js/rmmz_core.js (MZ) or js/rpg_core.js (MV)')
    process.exit(1)
}

console.log(`engine       ${layout.engine}`)
console.log(`content root ${layout.contentRoot}`)
if (dryRun) {
    console.log('mode         DRY RUN (nothing will be written)')
}
console.log()

const actions = []

function backup (path) {
    if (!existsSync(path)) {
        return null
    }

    const target = `${path}.cheatui-backup-${STAMP}`

    if (!dryRun) {
        copyFileSync(path, target)
    }

    return target
}

// アセット
const cheatTarget = join(layout.contentRoot, ASSET_DIR)

if (existsSync(cheatTarget)) {
    actions.push(`replace  ${cheatTarget}`)
    if (!dryRun) {
        rmSync(cheatTarget, {recursive: true, force: true})
    }
} else {
    actions.push(`create   ${cheatTarget}`)
}

if (!dryRun) {
    cpSync(join(PROJECT_ROOT, 'dist'), cheatTarget, {recursive: true})
}

// プラグイン本体
const pluginsDir = join(layout.contentRoot, 'js', 'plugins')
const pluginTarget = join(pluginsDir, `${PLUGIN_NAME}.js`)

if (!existsSync(pluginsDir) && !dryRun) {
    mkdirSync(pluginsDir, {recursive: true})
}

const pluginBackup = backup(pluginTarget)
actions.push(`${existsSync(pluginTarget) ? 'replace ' : 'create  '} ${pluginTarget}`)

if (!dryRun) {
    copyFileSync(join(PROJECT_ROOT, 'plugin', `${PLUGIN_NAME}.js`), pluginTarget)
}

// plugins.js
/**
 * 配列を再シリアライズせず、テキストとして追記する。
 * 既存の項目が 1 バイトも変わらない。tools/install.ps1 と同じ挙動。
 */
function withPluginEntry (text) {
    const close = text.lastIndexOf(']')

    if (close < 0) {
        console.error('no $plugins array found')
        process.exit(1)
    }

    const head = text.slice(0, close).trimEnd()
    const last = head.slice(-1)
    const separator = (last === '[' || last === ',') ? '\n' : ',\n'
    return head + separator + pluginEntryJson() + '\n' + text.slice(close)
}

function pluginEntryJson () {
    return '{"name":"' + PLUGIN_NAME + '","status":true,'
        + '"description":"Loads the Cheat UI overlay (RPG Maker MV / MZ)",'
        + '"parameters":{"assetDir":"' + ASSET_DIR + '","defaultLocale":"auto"}}'
}

/** 更新時は自分の項目を丸ごと書き直し、古いパラメータを残さない。 */
function replacePluginEntry (text) {
    return text.split('\n').map(line => {
        if (!line.includes(`"name":"${PLUGIN_NAME}"`)) return line

        return pluginEntryJson() + (line.trimEnd().endsWith(',') ? ',' : '')
    }).join('\n')
}

/**
 * 「チートランチャー」系プラグインは F9 で <CheatPath>/index.html を別ウィンドウに
 * 開く。そのフォルダが無いと ERR_FILE_NOT_FOUND が出るだけで、しかもツクール本体の
 * F9 デバッグ画面まで奪う。行き先が実在しないものだけ無効化する。
 */
function disableBrokenLaunchers (text, contentRoot) {
    const disabled = []
    const lines = text.split('\n').map(line => {
        const name = (line.match(/"name"\s*:\s*"([^"]*)"/) || [])[1]

        if (!name || name === PLUGIN_NAME) return line
        if (!/cheat/i.test(name) || !/launch/i.test(name)) return line
        if (!/"status"\s*:\s*true/.test(line)) return line

        const target = (line.match(/"CheatPath"\s*:\s*"([^"]*)"/) || [])[1] || './.cheat'

        if (existsSync(join(contentRoot, target.replace(/^\.\//, '')))) return line

        disabled.push(`${name} (-> ${target} missing)`)
        return line.replace(/"status"\s*:\s*true/, '"status":false')
    })

    return {text: lines.join('\n'), disabled}
}

function assertPluginsJs (text) {
    const open = text.indexOf('[')
    const close = text.lastIndexOf(']')

    try {
        return JSON.parse(text.slice(open, close + 1)).length
    } catch (err) {
        console.error(`refusing to write a broken plugins.js: ${err.message}`)
        process.exit(1)
    }
}

const pluginsJsPath = join(layout.contentRoot, 'js', 'plugins.js')

if (!existsSync(pluginsJsPath)) {
    console.error(`missing ${pluginsJsPath} — cannot register the plugin`)
    process.exit(1)
}

const pluginsJs = readFileSync(pluginsJsPath, 'utf-8')
const registered = pluginsJs.includes(`"${PLUGIN_NAME}"`)

// 先に最終形を作り、検証してから 1 度だけ書く。
// 書けない内容だったときに中途半端な登録を残さないため。
const withEntry = registered ? replacePluginEntry(pluginsJs) : withPluginEntry(pluginsJs)
// 行き先の無いチートランチャーが同梱されていることがある。
const launcher = disableBrokenLaunchers(withEntry, layout.contentRoot)

assertPluginsJs(launcher.text)

if (launcher.text === pluginsJs) {
    actions.push(`skip     ${pluginsJsPath} (unchanged)`)
} else {
    const jsBackup = backup(pluginsJsPath)
    const suffix = jsBackup ? jsBackup.split(/[\\/]/).pop() : 'none'

    actions.push(`${registered ? 'update  ' : 'register'} ${pluginsJsPath}  (backup: ${suffix})`)
    launcher.disabled.forEach(name => actions.push(`disable  ${name}`))

    if (!dryRun) {
        writeFileSync(pluginsJsPath, launcher.text, 'utf-8')
    }
}

actions.forEach(action => console.log(action))

console.log()
console.log(dryRun ? 'dry run complete — nothing written' : 'done. Launch the game and press Ctrl+C.')
if (pluginBackup) {
    console.log(`previous plugin saved as ${pluginBackup}`)
}
