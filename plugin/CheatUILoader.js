/*:
 * @target MV MZ
 * @plugindesc チート UI オーバーレイのローダー
 * @author rei-655
 *
 * @param assetDir
 * @text アセットフォルダ
 * @desc index.html と同じ階層にある cheat-ui.js / cheat-ui.css の置き場。
 * @type string
 * @default cheat
 *
 * @param defaultLocale
 * @text 既定の言語
 * @desc 初回起動時の表示言語。auto はゲームの表示言語に合わせる。設定画面で変更すると保存される。
 * @type select
 * @option auto
 * @option en
 * @option ja
 * @option ko
 * @default auto
 *
 * @help
 * チート UI を読み込む。ゲーム中に Ctrl+C で開く（Settings で変更可）。
 *
 * ノードは 1 つずつ append する。document.head.innerHTML への代入は head 全体を
 * 再解析させ、読み込み済みのスタイルとスクリプトを再取得させてしまう。
 */
(function () {
  'use strict'

  var params = PluginManager.parameters('CheatUILoader')
  var dir = String(params.assetDir || 'cheat').replace(/\/+$/, '')

  window.__CHEAT_UI_LOCALE__ = String(params.defaultLocale || 'auto')

  var css = document.createElement('link')
  css.rel = 'stylesheet'
  css.href = dir + '/cheat-ui.css'
  document.head.appendChild(css)

  var script = document.createElement('script')
  script.src = dir + '/cheat-ui.js'
  script.async = false
  document.body.appendChild(script)
})()
