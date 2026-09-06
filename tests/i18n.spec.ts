import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import en from '@/i18n/en'
import ja from '@/i18n/ja'
import ko from '@/i18n/ko'
import { LOCALES, locale, setLocale, t } from '@/i18n'
import { settings } from '@/engine/storage'
import HomePanel from '@/features/home/HomePanel.vue'

const KEYS = Object.keys(en) as (keyof typeof en)[]

beforeEach(() => {
  setActivePinia(createPinia())
  setLocale('en')
})

describe('catalogues', () => {
  it('offers the three languages', () => {
    expect(LOCALES.map((entry) => entry.code)).toEqual(['en', 'ja', 'ko'])
  })

  it.each([
    ['ja', ja],
    ['ko', ko]
  ])('%s covers every key in en', (_name, catalogue) => {
    expect(Object.keys(catalogue).sort()).toEqual(KEYS.slice().sort())
  })

  it.each([
    ['ja', ja],
    ['ko', ko]
  ])('%s leaves no entry empty', (_name, catalogue) => {
    const blank = KEYS.filter((key) => !catalogue[key]?.trim())
    expect(blank).toEqual([])
  })

  it('keeps the same placeholders in every language', () => {
    const holders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()

    for (const key of KEYS) {
      expect(holders(ja[key]), `ja ${key}`).toEqual(holders(en[key]))
      expect(holders(ko[key]), `ko ${key}`).toEqual(holders(en[key]))
    }
  })
})

describe('t', () => {
  it('returns the text of the active language', () => {
    expect(t('common.cancel')).toBe(en['common.cancel'])

    setLocale('ja')
    expect(t('common.cancel')).toBe(ja['common.cancel'])

    setLocale('ko')
    expect(t('common.cancel')).toBe(ko['common.cancel'])
  })

  it('fills placeholders', () => {
    expect(t('toast.saved', { slot: 3 })).toContain('3')
  })

  it('leaves an unknown placeholder untouched', () => {
    expect(t('toast.saved', {})).toContain('{slot}')
  })
})

describe('persistence', () => {
  it('writes the choice to the settings file', () => {
    setLocale('ja')
    expect(settings.get('locale', '')).toBe('ja')
  })
})

describe('components', () => {
  it('re-render when the language changes', async () => {
    const panel = mount(HomePanel)
    await nextTick()

    expect(panel.text()).toContain(en['home.quickActions'])

    setLocale('ja')
    await nextTick()
    expect(panel.text()).toContain(ja['home.quickActions'])

    setLocale('ko')
    await nextTick()
    expect(panel.text()).toContain(ko['home.quickActions'])
    expect(locale.value).toBe('ko')
  })
})
