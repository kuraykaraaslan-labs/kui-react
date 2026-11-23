import { insightsFormat, type InsightsFormat } from '@/modules/domains/analytics/insights/format'

export type ChatbotFormat = InsightsFormat & {
  /** An amount of money in the report's currency: 2 decimals, 3 under one unit (a chat costs fractions of a cent). */
  money: (v: number) => string
}

/** The report's number and date formats: the site insights formats (Intl only) plus money. */
export function chatbotFormat(locale?: string, currency = 'USD'): ChatbotFormat {
  const base = insightsFormat(locale)
  const make = (max: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: max })
    } catch {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: max })
    }
  }
  const small = make(3)
  const big = make(2)
  return { ...base, money: (v) => (Math.abs(v) < 1 ? small.format(v) : big.format(v)) }
}
