# rpg-cheat-ui

A cheat overlay for **RPG Maker MV / MZ** games. Vue 3 + TypeScript, bundled to a
single script that a plugin drops into the running game.

**RPG ツクール MV / MZ** 用のチートオーバーレイ。Vue 3 + TypeScript で書き、
1 本のスクリプトにまとめてプラグインからゲームに読み込ませる。

<sub><a href="#english">English</a> · <a href="#日本語">日本語</a></sub>

---

## English

### Install

Use `install.bat`. **Node.js is not required** — it only needs the PowerShell
that ships with Windows.

| How | What happens |
|---|---|
| Drag the game folder (or `Game.exe`) onto `install.bat` | installs into that game |
| Unzip this project inside the game folder, then double-click `install.bat` | finds the game around it and installs |
| Just double-click `install.bat` | opens a file picker — choose `Game.exe` or `index.html` |

No paths to type. `uninstall.bat` works the same way.

Default shortcut: **Ctrl+C** (rebindable under Settings).

<details>
<summary>Command line</summary>

```powershell
powershell -ExecutionPolicy Bypass -File tools/install.ps1 -GamePath "D:/Games/Game" -DryRun
powershell -ExecutionPolicy Bypass -File tools/install.ps1 -GamePath "D:/Games/Game"
powershell -ExecutionPolicy Bypass -File tools/install.ps1 -GamePath "D:/Games/Game" -Uninstall
```

Outside Windows there is an equivalent Node script:
`node tools/install.mjs "/path/to/Game" [--dry-run]`. Both are checked against
each other in the test suite so they cannot drift apart.

</details>

What the installer does:

- detects the MV (`www/`) or MZ (project root) layout
- copies `dist/` next to `index.html`
- installs `plugin/CheatUILoader.js` into `js/plugins/`
- appends the plugin to `js/plugins.js` as **text**, so existing entries keep
  their exact bytes (BOM included)
- validates the result before writing anything; on doubt it writes nothing
- switches off a bundled "cheat launcher" plugin whose target folder does not
  exist — those only produce an `ERR_FILE_NOT_FOUND` window on F9 while
  swallowing the engine's own F9 debug menu

Overwritten files are backed up as `*.cheatui-backup-<timestamp>`.
**`js/main.js` is never touched**: every game ships a different revision of it,
and replacing it drops whatever that revision added.

### Features

| Screen | What it does |
|---|---|
| Index | current gold, party, map and position; gold editing, no-clip, save/load/title |
| Battle | encounter control, forced battle results, per-member HP/MP/TP |
| Status | level, experience, parameters, god mode |
| States | states and buffs per member, apply and clear |
| Items | items, weapons and armors as tabs on one screen |
| Variables | search, edit, and **value scan** |
| Switches | on/off, bulk toggle over the current filter |
| Locations | teleport and saved positions on one screen |
| Settings | shortcuts, language and window options |

**Search grammar**, shared by every list:

```
quest         name
quest flag    several terms, all must match
500           id 500 or any row whose value is 500
#500          id only
>1000 <=200   value comparison
100..200      value in range
on / off      boolean (switches)
```

**Value scan** finds the variable behind a number on screen the way a memory
scanner does: take a snapshot, play a little, then keep the entries that
*changed*, *stayed*, *increased*, *decreased* or now *equal* a value. Two or
three passes usually leave a single candidate.

Editing behaviour: **Enter, Tab and blur all commit**, Esc restores, the border
flashes green on write, the original type is preserved (a numeric variable never
turns into a string), and the row being edited is pinned so narrowing by value
cannot pull it out from under the cursor. Table columns are resizable — drag the
header divider, double-click to reset.

### Language

English, 日本語 and 한국어. Switch under **Settings → General**; the choice is
written to `cheat-settings/ui.json` next to the game and survives restarts.

```json
{ "locale": "ja" }
```

The **default** — what a fresh install shows before anyone picks — comes from the
plugin parameter `defaultLocale` in the plugin manager:

| `defaultLocale` | Result |
|---|---|
| `auto` (default) | follows the game's display language, falling back to English |
| `en` / `ja` / `ko` | always starts in that language |

Order of precedence: saved choice → `defaultLocale` → display language → English.
Deleting `ui.json` returns everything to the default.

### It does not disturb the game

The overlay lives in a zero-sized `position: fixed` host, and every CSS selector
is scoped to `#cheat-ui-root`. That is enforced by a test which reads the built
stylesheet and fails on any rule that escapes, on `html`/`body`/`*` selectors,
and on `min-height: 100vh`.

Clicks, keys and wheel events are claimed by DOM containment rather than by
comparing the window's rectangle, so moving or resizing the window cannot leak
input into the game. MV and MZ differ in where wheel deltas are stored and in
whether save/load returns a Promise; both are handled.

### Development

```bash
npm install
npm run dev        # Vite dev server
npm run build      # type-check, then bundle to dist/
npm test           # Vitest
npm run lint
npm run typecheck
```

`dist/` is committed on purpose: the installer copies it, so people who just
want to play do not need a toolchain.

```
src/
  engine/     the only place RPG Maker globals are touched
  app/        window frame, menu, actions, hotkeys
  features/   one folder per screen
  i18n/       en · ja · ko message catalogues
  shared/     ui kit, composables, pure helpers
  stores/     pinia: session view state, shortcut bindings
plugin/       the RPG Maker plugin that loads the bundle
tools/        install.ps1 (Windows) and install.mjs (everything else)
tests/        vitest; harness/ boots the bundle in a plain browser
```

---

## 日本語

### 導入

`install.bat` を使う。**Node.js は不要**。Windows 標準の PowerShell だけで動く。

| 方法 | 動き |
|---|---|
| ゲームフォルダ（または `Game.exe`）を `install.bat` にドラッグ | そのゲームに導入 |
| このプロジェクトをゲームフォルダ内に展開して `install.bat` をダブルクリック | 周辺からゲームを探して導入 |
| `install.bat` をダブルクリック | 選択ダイアログが開く。`Game.exe` か `index.html` を選ぶ |

パスを手で打つ必要はない。削除は `uninstall.bat` が同じ手順で動く。

既定のショートカットは **Ctrl+C**（Settings で変更できる）。

<details>
<summary>コマンドライン</summary>

```powershell
powershell -ExecutionPolicy Bypass -File tools/install.ps1 -GamePath "D:/Games/Game" -DryRun
powershell -ExecutionPolicy Bypass -File tools/install.ps1 -GamePath "D:/Games/Game"
powershell -ExecutionPolicy Bypass -File tools/install.ps1 -GamePath "D:/Games/Game" -Uninstall
```

Windows 以外には同じ動きの Node 版がある。
`node tools/install.mjs "/path/to/Game" [--dry-run]`
両者が食い違わないよう、テストで結果を突き合わせている。

</details>

導入時にすること:

- MV（`www/`）と MZ（プロジェクト直下）の配置を自動判別
- `dist/` を `index.html` と同じ階層へコピー
- `plugin/CheatUILoader.js` を `js/plugins/` へ配置
- `js/plugins.js` へ**テキストとして**追記。既存項目は 1 バイトも変わらない（BOM も維持）
- 書き込む前に結果を検証し、少しでも怪しければ何も書かない
- 行き先が存在しない「チートランチャー」系プラグインを無効化する。F9 で
  `ERR_FILE_NOT_FOUND` の窓を出すだけなのに、ツクール本体の F9 デバッグ画面を奪うため

上書きするファイルは `*.cheatui-backup-<timestamp>` に控えを残す。
**`js/main.js` には触れない**。ゲームごとに版が違い、差し替えるとその版で追加された
処理が消えるため。

### 機能

| 画面 | 内容 |
|---|---|
| Index | 所持金・パーティ・マップ・座標の一覧、所持金編集、すり抜け、セーブ / ロード / タイトル |
| Battle | エンカウント制御、戦闘の強制終了、メンバーごとの HP/MP/TP |
| Status | レベル、経験値、能力値、無敵 |
| States | メンバーごとの状態・バフの付与と解除 |
| Items | アイテム・武器・防具をタブで 1 画面に |
| Variables | 検索、値の編集、**値スキャン** |
| Switches | on / off、絞り込み中の一括切り替え |
| Locations | マップ移動と保存済み座標を 1 画面に |
| Settings | ショートカット・言語・ウィンドウ設定 |

全リスト共通の**検索記法**:

```
quest         名前
quest flag    複数語は AND
500           ID 500 または値が 500 の行
#500          ID のみ
>1000 <=200   値の比較
100..200      値の範囲
on / off      真偽値（スイッチ）
```

**値スキャン**はメモリスキャナと同じ考え方で、画面に出ている数値の変数を探す。
まず全値を記録し、少しゲームを進めてから *変わった* / *変わらない* / *増えた* /
*減った* / *この値になった* もので絞り込む。2 〜 3 回で 1 件まで残ることが多い。

編集時の挙動: **Enter・Tab・フォーカス喪失のいずれでも確定**、Esc で取り消し、
書き込むと枠が緑に光る。元の型は保たれる（数値の変数が文字列になることはない）。
編集中の行は固定されるので、値で絞り込んでも入力中の行が消えない。
表の列幅はヘッダの境界をドラッグして変更でき、ダブルクリックで戻る。

### 言語

English・日本語・한국어 に対応。**Settings → 一般**で切り替えると、ゲームの隣の
`cheat-settings/ui.json` に保存され、再起動しても残る。

```json
{ "locale": "ja" }
```

**既定値**（まだ誰も選んでいないときに表示される言語）はプラグイン管理画面の
`defaultLocale` で決める。

| `defaultLocale` | 動作 |
|---|---|
| `auto`（既定） | ゲームの表示言語に合わせる。判別できなければ英語 |
| `en` / `ja` / `ko` | 常にその言語で開く |

優先順位は 保存された選択 → `defaultLocale` → 表示言語 → 英語。
`ui.json` を削除すれば既定値に戻る。

### ゲームを壊さない

UI は大きさ 0 の `position: fixed` 要素の中だけに描画し、CSS セレクタはすべて
`#cheat-ui-root` 起点に限定している。これはテストで担保していて、ビルド済み
スタイルシートを読み、範囲外の規則・`html`/`body`/`*` セレクタ・
`min-height: 100vh` があれば失敗する。

クリック・キー・ホイールは、ウィンドウの矩形座標ではなく DOM の包含関係で
判定する。ウィンドウを動かしてもリサイズしても入力がゲームへ漏れない。
MV と MZ ではホイール量の格納先とセーブ / ロードの戻り値が違うが、どちらも吸収する。

### 開発

```bash
npm install
npm run dev        # Vite の開発サーバ
npm run build      # 型検査のあと dist/ へバンドル
npm test           # Vitest
npm run lint
npm run typecheck
```

`dist/` は意図的にコミットしている。導入スクリプトがそのままコピーするので、
遊ぶだけの人にビルド環境を要求しない。

```
src/
  engine/     ツクールのグローバル変数に触れる唯一の場所
  app/        ウィンドウ枠・メニュー・動作・ホットキー
  features/   画面ごとに 1 フォルダ
  i18n/       en · ja · ko のメッセージ
  shared/     UI 部品・composable・純粋な補助関数
  stores/     pinia。表示状態とショートカット割り当て
plugin/       バンドルを読み込むツクールプラグイン
tools/        install.ps1（Windows）と install.mjs（その他）
tests/        vitest。harness/ は素のブラウザで動かす確認用
```

---

## License

MIT
