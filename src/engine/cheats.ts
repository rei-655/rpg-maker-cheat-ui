import { asPromise } from './engine'
import { has, inBattle, party, player, rpg, troop } from './globals'
import type { Actor, Battler } from './types'

export const MAX_GOLD = 99999999

export const movement = {
  noClip: () => has('$gamePlayer') && player()._through,

  toggleNoClip(): boolean {
    const next = !player()._through
    player()._through = next
    return next
  }
}

export const wallet = {
  gold: () => (has('$gameParty') ? party()._gold : 0),

  setGold(target: number): void {
    const clamped = Math.min(Math.max(target, 0), MAX_GOLD)
    const diff = clamped - party()._gold

    if (diff > 0) party().gainGold(diff)
    else if (diff < 0) party().loseGold(-diff)
  }
}

export const scenes = {
  toggleSave: () => swapScene('Scene_Save'),
  toggleLoad: () => swapScene('Scene_Load'),

  toTitle(): void {
    rpg('SceneManager').goto(rpg('Scene_Title'))
  },

  quickSave(slot: number): Promise<void> {
    rpg('$gameSystem').onBeforeSave?.()
    return asPromise(rpg('DataManager').saveGame(slot) as Promise<void> | false)
  },

  quickLoad(slot: number): Promise<void> {
    return asPromise(rpg('DataManager').loadGame(slot) as Promise<void> | false).then(() => {
      rpg('$gameSystem').onAfterLoad?.()
      rpg('SceneManager').goto(rpg('Scene_Map'))
    })
  }
}

export const battle = {
  inBattle,

  recover(member: Battler): void {
    member.setHp(member.mhp)
    member.setMp(member.mmp)
    member.setTp(member.maxTp())
  },

  setHpAll(members: Battler[], hp: number): void {
    members.forEach((member) => member.setHp(hp))
  },

  /** HP・MP・TP のどれか 1 つだけを満タンにする。 */
  fillAll(members: Battler[], field: 'hp' | 'mp' | 'tp'): void {
    for (const member of members) {
      if (field === 'hp') member.setHp(member.mhp)
      else if (field === 'mp') member.setMp(member.mmp)
      else member.setTp(member.maxTp())
    }
  },

  recoverAll(members: Battler[]): void {
    members.forEach((member) => battle.recover(member))
  },

  forceEncounter(): void {
    player()._encounterCount = 0
  },

  canFinish(): boolean {
    return inBattle() && rpg('BattleManager')._phase !== 'battleEnd'
  },

  finish(kind: 'victory' | 'defeat' | 'escape' | 'abort'): boolean {
    if (!battle.canFinish()) return false

    const manager = rpg('BattleManager') as Record<string, () => void> & { _escaped?: boolean }

    if (kind === 'victory') {
      troop().members().forEach((enemy) => killed(enemy))
      manager.processVictory?.()
      return true
    }

    if (kind === 'defeat') {
      party().members().forEach((actor) => killed(actor))
      manager.processDefeat?.()
      return true
    }

    party().performEscape()
    rpg('SoundManager').playEscape()
    manager._escaped = true
    ;(kind === 'escape' ? manager.processEscape : manager.processAbort)?.()
    return true
  }
}

/** ランダムエンカウント。canEncounter を差し替えて切り替える。 */
export const encounters = (() => {
  let original: Player['canEncounter'] | null = null

  return {
    disabled: () => original !== null,

    toggle(): boolean {
      if (original) {
        player().canEncounter = original
        original = null
      } else {
        original = player().canEncounter
        player().canEncounter = () => false
      }

      return original !== null
    }
  }
})()

type Player = ReturnType<typeof player>

/** 解除するまで HP/MP/TP を最大に固定し、スキルコストを無効化する。 */
export const godMode = (() => {
  const patched = new Map<Actor, () => void>()
  let timer: ReturnType<typeof setInterval> | null = null

  function tick(): void {
    for (const actor of patched.keys()) {
      actor.gainHp(actor.mhp)
      actor.gainMp(actor.mmp)
      actor.gainTp(actor.maxTp())
    }
  }

  return {
    isOn: (actor: Actor) => patched.has(actor),

    toggle(actor: Actor): boolean {
      if (patched.has(actor)) {
        patched.get(actor)?.()
        patched.delete(actor)

        if (patched.size === 0 && timer) {
          clearInterval(timer)
          timer = null
        }

        return false
      }

      patched.set(actor, patchActor(actor))

      // アクターごとではなく 1 本のタイマーを共有する
      timer ??= setInterval(tick, 1000)
      return true
    }
  }
})()

function patchActor(actor: Actor): () => void {
  const original = {
    gainHp: actor.gainHp,
    setHp: actor.setHp,
    gainMp: actor.gainMp,
    setMp: actor.setMp,
    gainTp: actor.gainTp,
    setTp: actor.setTp,
    paySkillCost: actor.paySkillCost
  }

  actor.gainHp = () => original.gainHp.call(actor, actor.mhp)
  actor.setHp = () => original.setHp.call(actor, actor.mhp)
  actor.gainMp = () => original.gainMp.call(actor, actor.mmp)
  actor.setMp = () => original.setMp.call(actor, actor.mmp)
  actor.gainTp = () => original.gainTp.call(actor, actor.maxTp())
  actor.setTp = () => original.setTp.call(actor, actor.maxTp())
  actor.paySkillCost = () => {}

  return () => Object.assign(actor, original)
}

function killed(member: Battler): void {
  const target = member as unknown as { addNewState?(id: number): void; deathStateId?(): number }
  if (target.addNewState && target.deathStateId) target.addNewState(target.deathStateId())
}

function swapScene(name: 'Scene_Save' | 'Scene_Load'): void {
  const manager = rpg('SceneManager')
  const other = name === 'Scene_Save' ? 'Scene_Load' : 'Scene_Save'
  const current = manager._scene?.constructor

  if (current === rpg(name)) manager.pop()
  else if (current === rpg(other)) manager.goto(rpg(name))
  else manager.push(rpg(name))
}
