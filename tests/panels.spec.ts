import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { setLocale, t } from '@/i18n'
import { PANELS } from '@/app/panels'

import HomePanel from '@/features/home/HomePanel.vue'
import PartyPanel from '@/features/party/PartyPanel.vue'
import InventoryPanel from '@/features/inventory/InventoryPanel.vue'
import CombatPanel from '@/features/combat/CombatPanel.vue'
import UnstuckPanel from '@/features/unstuck/UnstuckPanel.vue'
import DataPanel from '@/features/data/DataPanel.vue'
import VariablesTable from '@/features/data/VariablesTable.vue'
import SwitchesTable from '@/features/data/SwitchesTable.vue'
import TravelPanel from '@/features/travel/TravelPanel.vue'
import SettingsPanel from '@/features/settings/SettingsPanel.vue'

const game = () =>
  globalThis as unknown as {
    $gameVariables: { value(id: number): unknown; setValue(id: number, value: unknown): void }
    $gameSwitches: { value(id: number): boolean; setValue(id: number, value: boolean): void }
    $gameParty: { _gold: number; numItems(item: { id: number }): number }
    __resetGame(): void
  }

/** onMounted でゲームを読むため、最初の描画は 1 tick 後になる。 */
async function open(component: Component): Promise<VueWrapper> {
  const panel = mount(component)
  await nextTick()
  return panel
}

const rowsOf = (panel: VueWrapper) => panel.findAll('tbody tr')

async function setSearch(panel: VueWrapper, value: string): Promise<void> {
  await panel.find('.search input').setValue(value)
}

function clickText(panel: VueWrapper, label: string) {
  const button = panel.findAll('button').find((entry) => entry.text().includes(label))
  if (!button) throw new Error(`no button labelled ${label}`)
  return button.trigger('click')
}

beforeEach(() => {
  setActivePinia(createPinia())
  setLocale('en')
  game().__resetGame()
})

describe('every panel renders', () => {
  const panels = {
    HomePanel,
    PartyPanel,
    InventoryPanel,
    CombatPanel,
    UnstuckPanel,
    DataPanel,
    TravelPanel,
    SettingsPanel
  }

  for (const [name, component] of Object.entries(panels)) {
    it(name, async () => {
      expect((await open(component)).html()).toBeTruthy()
    })
  }
})

describe('menu', () => {
  it('is organised by what the player wants to do, not by engine tables', () => {
    expect(PANELS.map((panel) => panel.id)).toEqual([
      'home',
      'party',
      'inventory',
      'combat',
      'unstuck',
      'data',
      'travel',
      'settings'
    ])
  })

  it('gives every entry a translated label and a one-line explanation', () => {
    for (const panel of PANELS) {
      expect(t(panel.labelKey), panel.id).not.toBe(panel.labelKey)
      expect(t(panel.hintKey), panel.id).not.toBe(panel.hintKey)
    }
  })
})

describe('PartyPanel', () => {
  it('keeps HP, level, parameters and states on one screen', async () => {
    const text = (await open(PartyPanel)).text()

    expect(text).toContain(t('party.params'))
    expect(text).toContain(t('party.states'))
    expect(text).toContain(t('party.level'))
  })

  it('shows a member detail without needing a click', async () => {
    expect((await open(PartyPanel)).find('.detail').exists()).toBe(true)
  })
})

describe('VariablesTable', () => {
  it('lists real variables and skips the engine placeholder at index 0', async () => {
    const panel = await open(VariablesTable)

    expect(panel.text()).toContain('Gold Counter')
    expect(rowsOf(panel)).toHaveLength(3)
  })

  it('filters by value, which the old build could not do at all', async () => {
    game().$gameVariables.setValue(2, 777)

    const panel = await open(VariablesTable)
    await setSearch(panel, '777')

    expect(rowsOf(panel)).toHaveLength(1)
    expect(rowsOf(panel)[0].text()).toContain('Quest Flag')
  })

  it('writes the value back and keeps its numeric type', async () => {
    const panel = await open(VariablesTable)
    const field = panel.findAll('tbody input')[1]

    await field.setValue('777')
    await field.trigger('keydown', { key: 'Enter' })

    expect(game().$gameVariables.value(2)).toBe(777)
    expect(typeof game().$gameVariables.value(2)).toBe('number')
  })

  it('keeps the row being edited even when the filter stops matching it', async () => {
    game().$gameVariables.setValue(2, 500)

    const panel = await open(VariablesTable)
    await setSearch(panel, '=500')
    expect(rowsOf(panel)).toHaveLength(1)

    const field = panel.find('tbody input')
    await field.trigger('focus')
    await field.setValue('1')

    expect(rowsOf(panel)).toHaveLength(1)
  })
})

describe('SwitchesTable', () => {
  it('toggles a switch', async () => {
    const panel = await open(SwitchesTable)
    await panel.findAll('tbody button')[0].trigger('click')

    expect(game().$gameSwitches.value(1)).toBe(true)
  })

  it('filters by state with on and off', async () => {
    game().$gameSwitches.setValue(1, true)

    const panel = await open(SwitchesTable)
    await setSearch(panel, 'on')

    expect(rowsOf(panel)).toHaveLength(1)
  })
})

describe('InventoryPanel', () => {
  it('puts gold on the same screen as the items', async () => {
    expect((await open(InventoryPanel)).text()).toContain(t('inventory.gold'))
  })

  it('clamps an amount to the engine maximum', async () => {
    const panel = await open(InventoryPanel)
    const field = panel.findAll('tbody input')[0]

    await field.setValue('9999')
    await field.trigger('keydown', { key: 'Enter' })

    expect(game().$gameParty.numItems({ id: 1 })).toBe(99)
  })

  it('offers items, weapons and armors as tabs', async () => {
    const panel = await open(InventoryPanel)

    expect(panel.findAll('.tab').map((tab) => tab.text())).toEqual([
      expect.stringContaining(t('inventory.items')),
      expect.stringContaining(t('inventory.weapons')),
      expect.stringContaining(t('inventory.armors'))
    ])
  })
})

describe('TravelPanel', () => {
  it('leads with saved and visited places, not the raw map list', async () => {
    const heads = (await open(TravelPanel)).findAll('.section__head').map((head) => head.text())

    expect(heads[0]).toContain(t('travel.saved'))
    expect(heads[1]).toContain(t('travel.visited'))
  })

  it('hides the full map list behind a disclosure', async () => {
    expect((await open(TravelPanel)).find('details.more summary').text()).toBe(t('travel.allMaps'))
  })

  it('resolves the map path instead of the bare name', async () => {
    const panel = await open(TravelPanel)
    await panel.find('details.more summary').trigger('click')

    expect(panel.text()).toContain('Town / Inn')
  })
})

describe('UnstuckPanel', () => {
  it('walks through record, try, check', async () => {
    const text = (await open(UnstuckPanel)).text()

    expect(text).toContain(t('unstuck.step1'))
    expect(text).toContain(t('unstuck.step2'))
    expect(text).toContain(t('unstuck.step3'))
  })

  it('shows only what the game changed since the recording', async () => {
    const panel = await open(UnstuckPanel)

    await clickText(panel, t('unstuck.record'))
    game().$gameSwitches.setValue(2, true)
    await clickText(panel, t('unstuck.check'))
    await nextTick()

    expect(panel.text()).toContain(t('unstuck.changes'))
    expect(rowsOf(panel)).toHaveLength(1)
    expect(rowsOf(panel)[0].text()).toContain('Secret Found')
  })
})

describe('SettingsPanel', () => {
  it('holds the shortcut list and the language picker', async () => {
    const panel = await open(SettingsPanel)

    expect(panel.findAll('.tab').map((tab) => tab.text())).toEqual([t('settings.shortcuts'), t('settings.general')])
    expect(panel.text()).toContain(t('action.toggleWindow'))
  })
})

describe('HomePanel', () => {
  it('offers one-click actions rather than tables', async () => {
    const panel = await open(HomePanel)

    expect(panel.findAll('.big').length).toBeGreaterThanOrEqual(4)
    expect(panel.findAll('.hub__card')).toHaveLength(7)
  })

  it('lets you set an exact amount of gold, not only the maximum', async () => {
    const panel = await open(HomePanel)
    const field = panel.find('.section__body input')

    await field.setValue('4321')
    await field.trigger('keydown', { key: 'Enter' })

    expect(game().$gameParty._gold).toBe(4321)
  })

  it('heals HP, MP and TP separately', async () => {
    const panel = await open(HomePanel)
    const members = (globalThis as unknown as { $gameParty: { members(): { hp: number; mp: number }[] } }).$gameParty

    members.members().forEach((member) => {
      member.hp = 1
      member.mp = 1
    })

    await clickText(panel, t('home.fillHp'))
    expect(members.members()[0].hp).toBe(300)
    expect(members.members()[0].mp).toBe(1)

    await clickText(panel, t('home.fillMp'))
    expect(members.members()[0].mp).toBe(40)
  })

  it('has no speed controls', async () => {
    expect((await open(HomePanel)).text()).not.toContain('Speed')
  })
})
