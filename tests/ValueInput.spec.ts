import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ValueInput from '@/shared/ui/ValueInput.vue'

const mountField = (value: string | number = 10) => mount(ValueInput, { props: { value } })

describe('ValueInput', () => {
  it('commits on Enter', async () => {
    const field = mountField()

    await field.find('input').setValue('42')
    await field.find('input').trigger('keydown', { key: 'Enter' })

    expect(field.emitted('commit')).toEqual([['42']])
  })

  it('commits on blur, which is what the old build supported', async () => {
    const field = mountField()

    await field.find('input').setValue('42')
    await field.find('input').trigger('blur')

    expect(field.emitted('commit')).toEqual([['42']])
  })

  it('commits on Tab', async () => {
    const field = mountField()

    await field.find('input').setValue('42')
    await field.find('input').trigger('keydown', { key: 'Tab' })

    expect(field.emitted('commit')).toEqual([['42']])
  })

  it('restores the original value on Esc without committing', async () => {
    const field = mountField(10)

    await field.find('input').trigger('focus')
    await field.find('input').setValue('42')
    await field.find('input').trigger('keydown', { key: 'Escape' })

    expect(field.emitted('commit')).toBeUndefined()
    expect(field.find('input').element.value).toBe('10')
  })

  it('does not write back a value that did not change', async () => {
    const field = mountField(10)

    await field.find('input').trigger('keydown', { key: 'Enter' })

    expect(field.emitted('commit')).toBeUndefined()
  })

  it('keeps keystrokes away from the running game', async () => {
    const field = mountField()
    const stop = vi.fn()

    await field.find('input').trigger('keydown', { key: 'a', stopPropagation: stop })

    expect(stop).toHaveBeenCalled()
  })

  it('does not overwrite what is being typed when the panel refreshes', async () => {
    const field = mountField(10)

    await field.find('input').trigger('focus')
    await field.find('input').setValue('4')
    await field.setProps({ value: 99 })

    expect(field.find('input').element.value).toBe('4')
  })

  it('picks up new values once editing has ended', async () => {
    const field = mountField(10)

    await field.find('input').trigger('focus')
    await field.find('input').trigger('blur')
    await field.setProps({ value: 99 })

    expect(field.find('input').element.value).toBe('99')
  })

  it('flashes after a commit', async () => {
    const field = mountField()

    await field.find('input').setValue('42')
    await field.find('input').trigger('keydown', { key: 'Enter' })

    expect(field.find('input').classes()).toContain('input--flash')
  })
})
