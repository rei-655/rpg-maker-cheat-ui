import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { HOST_ID, installInputGuards } from './engine/input'
import { installMessageSkip } from './engine/messages'
import { installVisitLog } from './engine/visits'
import { safely } from './engine/safety'
import './shared/styles/base.css'

declare global {
  interface Window {
    __CHEAT_UI__?: boolean
  }
}

/**
 * ホストは body に足す大きさ 0 の fixed 要素。これより大きいと
 * body ボックス基準で中央寄せされるロード表示がずれる。
 */
function mount(): void {
  if (window.__CHEAT_UI__) return
  window.__CHEAT_UI__ = true

  const host = document.createElement('div')
  host.id = HOST_ID
  document.body.appendChild(host)

  // 取り付けは一つずつ包む。一つ転んでも残りとゲームは動く。
  safely('installing the input guards', installInputGuards)
  safely('installing the message skip', installMessageSkip)
  safely('installing the visit log', installVisitLog)

  const app = safely('starting the overlay', () => createApp(App).use(createPinia()).mount(host))

  // 起動に失敗したら痕跡を残さない。空の枠がゲームの上に残るほうが困る。
  if (!app) host.remove()
}

function start(): void {
  safely('mounting the overlay', mount)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
