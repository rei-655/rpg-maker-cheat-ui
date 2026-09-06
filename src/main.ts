import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { HOST_ID, installInputGuards } from './engine/input'
import { installMessageSkip } from './engine/messages'
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

  installInputGuards()
  installMessageSkip()

  createApp(App).use(createPinia()).mount(host)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
