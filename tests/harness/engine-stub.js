// ビルド済みバンドルを素のブラウザで起動するための最小 MZ スタブ。
window.Utils = { isNwjs: () => false, RPGMAKER_NAME: 'MZ' }
window.PluginManager = { parameters: () => ({ assetDir: '../../dist' }) }

window.TouchInput = {
  _events: { wheelX: 0, wheelY: 0 },
  _newState: { wheelX: 0, wheelY: 0 },
  _onWheel() {}, _onMouseDown() {}, _onMouseMove() {}, _onMouseUp() {}
}
window.Input = {
  _lastKeyDown: false,
  _onKeyDown() { window.Input._lastKeyDown = true },
  _onKeyUp() {}
}

const names = ['', 'Gold Counter', 'Quest Flag', 'Affection', '', 'Reputation']
window.$dataSystem = {
  variables: names,
  switches: ['', 'Opening Done', 'Secret Found', ''],
  terms: { params: ['MHP', 'MMP', 'ATK', 'DEF', 'MAT', 'MDF', 'AGI', 'LUK'] }
}
window.$dataItems = [null,
  { id: 1, name: 'Potion', description: 'Heals 100 HP' },
  { id: 2, name: 'Elixir', description: 'Full recovery' },
  { id: 3, name: 'Antidote', description: 'Cures poison' }]
window.$dataWeapons = [null, { id: 1, name: 'Sword', description: 'Sharp' }]
window.$dataArmors = [null, { id: 1, name: 'Shield', description: 'Sturdy' }]
window.$dataStates = [null, { id: 1, name: 'Poison' }, { id: 2, name: 'Sleep' }]
window.$dataMapInfos = [null,
  { id: 1, name: 'Town', parentId: 0 },
  { id: 2, name: 'Inn', parentId: 1 }]

const vars = {}
window.$gameVariables = {
  value: (id) => vars[id] ?? 0,
  setValue: (id, v) => { vars[id] = v }
}
const sws = {}
window.$gameSwitches = { value: (id) => !!sws[id], setValue: (id, v) => { sws[id] = v } }

function actor(name, id) {
  return {
    _actorId: id, _name: name, _paramPlus: [0,0,0,0,0,0,0,0],
    hp: 120, mhp: 300, mp: 10, mmp: 40, tp: 5, level: 12,
    name: () => name, maxTp: () => 100, maxLevel: () => 99,
    currentExp: () => 1200, param: (i) => 40 + i,
    addParam() {}, changeLevel() {}, changeExp() {},
    setHp(v) { this.hp = v }, setMp(v) { this.mp = v }, setTp(v) { this.tp = v },
    gainHp() {}, gainMp() {}, gainTp() {}, paySkillCost() {},
    states: () => [{ id: 1, name: 'Poison' }], buff: () => 0,
    addState() {}, removeState() {}, clearStates() {}, removeBuff() {}, removeAllBuffs() {}
  }
}

const items = {}
window.$gameParty = {
  _gold: 12345,
  members: () => [actor('Harold', 1), actor('Therese', 2)],
  numItems: (item) => items[item.id] ?? 0,
  maxItems: () => 99,
  gainItem: (item, n) => { items[item.id] = Math.max(0, (items[item.id] ?? 0) + n) },
  gainGold(n) { this._gold += n }, loseGold(n) { this._gold -= n },
  performEscape() {}
}
window.$gameTroop = { members: () => [] }
window.$gameMap = { mapId: () => 2 }
window.$gamePlayer = {
  _through: false, _encounterCount: 5, x: 12, y: 8,
  direction: () => 2, canEncounter: () => true,
  reserveTransfer() {}, setPosition() {}
}
window.$gameSystem = {}
window.DataManager = { maxSavefiles: () => 20, saveGame: () => Promise.resolve(), loadGame: () => Promise.resolve() }
window.SceneManager = { _scene: null, goto() {}, push() {}, pop() {} }
window.BattleManager = {}
window.SoundManager = { playEscape() {} }
window.Scene_Battle = function () {}
window.Scene_Map = function () {}
window.Scene_Save = function () {}
window.Scene_Load = function () {}
window.Scene_Title = function () {}

// レイアウト計測
window.measureLayout = function () {
  const spinner = document.getElementById('loadingSpinner')
  const canvas = document.getElementById('gameCanvas')
  const rect = spinner?.getBoundingClientRect()
  return {
    spinner: rect ? { top: Math.round(rect.top), left: Math.round(rect.left) } : null,
    canvasBox: canvas ? getComputedStyle(canvas).boxSizing : null,
    bodyBox: getComputedStyle(document.body).boxSizing,
    bodyScrollHeight: document.body.scrollHeight,
    htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
    htmlFontSize: getComputedStyle(document.documentElement).fontSize,
    innerWidth: window.innerWidth
  }
}
window.compareLayout = function () {
  const after = window.measureLayout()
  const diffs = Object.keys(after).filter(
    (k) => JSON.stringify(after[k]) !== JSON.stringify(window.__baseline[k])
  ).map((k) => `${k}: ${JSON.stringify(window.__baseline[k])} -> ${JSON.stringify(after[k])}`)
  return { diffs, ok: diffs.length === 0 }
}
