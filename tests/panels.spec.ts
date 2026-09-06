import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { setLocale, t } from '@/i18n'

import VariablesPanel from '@/features/variables/VariablesPanel.vue'
import SwitchesPanel from '@/features/switches/SwitchesPanel.vue'
import ItemsPanel from '@/features/items/ItemsPanel.vue'
import LocationsPanel from '@/features/locations/LocationsPanel.vue'
import HomePanel from '@/features/home/HomePanel.vue'
import SettingsPanel from '@/features/settings/SettingsPanel.vue'
import StatesPanel from '@/features/states/StatesPanel.vue'
import BattlePanel from '@/features/battle/BattlePanel.vue'
import StatusPanel from '@/features/status/StatusPanel.vue'

const game = () =>
  globalThis as unknown as {
    $gameVariables: { value(id: number): unknown; setValue(id: number, value: unknown): void }
    $gameSwitches: { value(id: number): boolean; setValue(id: number, value: boolean): void }
    $gameParty: { _gold: number; numItems(item: { id: number }): number }
  }

/** onMounted でゲームを読むため、最初の描画は 1 tick 後になる。 */
async function open(component: Component): Promise<VueWrapper> {
  const panel = mount(component)
  await nextTick()
  return panel
}

const rowsOf = (panel: VueWrapper) => panel.findAll('tbody tr')
const namesOf = (panel: VueWrapper) => rowsOf(panel).map((row) => row.text())

async function setSearch(panel: VueWrapper, value: string): Promise<void> {
  await panel.find('.search input').setValue(value)
}

beforeEach(() => {
  setActivePinia(createPinia())
  setLocale('en')
  ;(globalThis as unknown as { __resetGame(): void }).__resetGame()
})

describe('every panel renders', () => {
  const panels = {
    HomePanel,
    BattlePanel,
    StatusPanel,
    StatesPanel,
    ItemsPanel,
    VariablesPanel,
    SwitchesPanel,
    LocationsPanel,
    SettingsPanel
  }

  for (const [name, component] of Object.entries(panels)) {
    it(name, async () => {
      expect((await open(component)).html()).toBeTruthy()
    })
  }
})

describe('VariablesPanel', () => {
  it('lists real variables and skips the engine placeholder at index 0', async () => {
    const panel = await open(VariablesPanel)

    expect(namesOf(panel).join(' ')).toContain('Gold Counter')
    expect(namesOf(panel)[0]).not.toBe('')
    expect(rowsOf(panel)).toHaveLength(3)
  })

  it('filters by name', async () => {
    const panel = await open(VariablesPanel)
    await setSearch(panel, 'quest')

    expect(rowsOf(panel)).toHaveLength(1)
    expect(rowsOf(panel)[0].text()).toContain('Quest Flag')
  })

  it('filters by value, which the old build could not do at all', async () => {
    game().$gameVariables.setValue(2, 777)

    const panel = await open(VariablesPanel)
    await setSearch(panel, '777')

    expect(rowsOf(panel)).toHaveLength(1)
    expect(rowsOf(panel)[0].text()).toContain('Quest Flag')
  })

  it('filters by comparison', async () => {
    game().$gameVariables.setValue(1, 50)
    game().$gameVariables.setValue(2, 500)

    const panel = await open(VariablesPanel)
    await setSearch(panel, '>100')

    expect(rowsOf(panel)).toHaveLength(1)
  })

  it('writes the value back and keeps its numeric type', async () => {
    const panel = await open(VariablesPanel)
    const field = panel.findAll('tbody input')[1]

    await field.setValue('777')
    await field.trigger('keydown', { key: 'Enter' })

    expect(game().$gameVariables.value(2)).toBe(777)
    expect(typeof game().$gameVariables.value(2)).toBe('number')
  })

  it('keeps the row that is being edited even when the filter stops matching it', async () => {
    game().$gameVariables.setValue(2, 500)

    const panel = await open(VariablesPanel)
    await setSearch(panel, '=500')
    expect(rowsOf(panel)).toHaveLength(1)

    const field = panel.find('tbody input')
    await field.trigger('focus')
    await field.setValue('1')

    expect(rowsOf(panel)).toHaveLength(1)
  })
})

describe('SwitchesPanel', () => {
  it('toggles a switch', async () => {
    const panel = await open(SwitchesPanel)

    await panel.findAll('tbody button')[0].trigger('click')

    expect(game().$gameSwitches.value(1)).toBe(true)
  })

  it('filters by state with on and off', async () => {
    game().$gameSwitches.setValue(1, true)

    const panel = await open(SwitchesPanel)
    await setSearch(panel, 'on')

    expect(rowsOf(panel)).toHaveLength(1)
  })
})

describe('ItemsPanel', () => {
  it('clamps an amount to the engine maximum', async () => {
    const panel = await open(ItemsPanel)
    const field = panel.find('tbody input')

    await field.setValue('9999')
    await field.trigger('keydown', { key: 'Enter' })

    expect(game().$gameParty.numItems({ id: 1 })).toBe(99)
  })

  it('restores the real amount instead of writing NaN', async () => {
    const panel = await open(ItemsPanel)
    const field = panel.find('tbody input')

    await field.setValue('abc')
    await field.trigger('keydown', { key: 'Enter' })

    expect(game().$gameParty.numItems({ id: 1 })).toBe(0)
  })

  it('offers items, weapons and armors as tabs on one screen', async () => {
    const panel = await open(ItemsPanel)

    expect(panel.findAll('.tab').map((tab) => tab.text())).toEqual([
      expect.stringContaining(t('items.items')),
      expect.stringContaining(t('items.weapons')),
      expect.stringContaining(t('items.armors'))
    ])
  })
})

describe('LocationsPanel', () => {
  it('shows teleport targets and bookmarks on the same screen', async () => {
    const panel = await open(LocationsPanel)
    const heads = panel.findAll('.section__head').map((head) => head.text())

    expect(heads.join(' ')).toContain(t('locations.saved'))
    expect(heads.join(' ')).toContain(t('locations.maps'))
  })

  it('resolves the map path instead of the bare name', async () => {
    const panel = await open(LocationsPanel)
    expect(panel.text()).toContain('Town / Inn')
  })

  it('survives a cyclic parentId', async () => {
    const panel = await open(LocationsPanel)
    expect(panel.text()).toContain('Loop A')
  })
})

describe('SettingsPanel', () => {
  it('holds the shortcut list, which used to be a top-level menu entry', async () => {
    const panel = await open(SettingsPanel)

    expect(panel.findAll('.tab').map((tab) => tab.text())).toEqual([t('settings.shortcuts'), t('settings.general')])
    expect(panel.text()).toContain(t('action.toggleWindow'))
  })

  it('has no translation settings any more', async () => {
    expect((await open(SettingsPanel)).text()).not.toContain('Translate')
  })
})

describe('HomePanel', () => {
  it('summarises the game state and links to every other panel', async () => {
    const panel = await open(HomePanel)

    expect(panel.text()).toContain('500')
    expect(panel.findAll('.hub__card')).toHaveLength(8)
  })

  it('has no speed controls', async () => {
    const text = (await open(HomePanel)).text()

    expect(text).not.toContain('Speed')
  })
})
