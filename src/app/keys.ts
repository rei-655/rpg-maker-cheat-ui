import { t } from '@/i18n'

const MODIFIERS = ['ctrl', 'alt', 'shift', 'meta'] as const

const DISPLAY: Record<string, string> = {
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  meta: 'Meta'
}

/** 割り当ては `ctrl+shift+KeyC` 形式。修飾キー順 + レイアウト非依存の code。 */
export function comboFrom(event: KeyboardEvent): string {
  if (isModifierKey(event.code)) return ''

  const parts = MODIFIERS.filter((name) => event[`${name}Key` as const])

  return [...parts, event.code].join('+')
}

export function isModifierKey(code: string): boolean {
  return /^(Control|Alt|Shift|Meta|OS)/.test(code)
}

export function formatCombo(combo: string): string {
  if (!combo) return t('keys.unassigned')

  return combo
    .split('+')
    .map((part) => DISPLAY[part] ?? prettyCode(part))
    .join(' + ')
}

function prettyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`
  if (code.startsWith('Arrow')) return code.slice(5)

  const named: Record<string, string> = {
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
    Space: 'Space',
    Escape: 'Esc'
  }

  return named[code] ?? code
}
