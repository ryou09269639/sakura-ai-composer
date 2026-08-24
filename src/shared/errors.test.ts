import { describe, expect, it } from 'vitest'
import { toErrorMessage } from './errors'

describe('toErrorMessage', () => {
  it('Errorインスタンスからmessageを取り出す', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('Error以外の値は文字列化する', () => {
    expect(toErrorMessage('plain string')).toBe('plain string')
    expect(toErrorMessage(42)).toBe('42')
    expect(toErrorMessage(null)).toBe('null')
    expect(toErrorMessage(undefined)).toBe('undefined')
  })
})
