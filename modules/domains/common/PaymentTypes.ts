import { z } from 'zod'
import { IdSchema } from './BaseTypes'
import { CurrencySchema } from './MoneyTypes'
import { CARD_BRANDS } from './payment/cardBrand'

/* =========================================================
   ENUMS
========================================================= */

export const PaymentStatusEnum = z.enum([
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
])

export const PaymentMethodEnum = z.enum([
  'CREDIT_CARD',
  'DEBIT_CARD',
  'BANK_TRANSFER',
  'CASH',
  'WALLET',
  'CRYPTO',
])

/* =========================================================
   PAYMENT BASE SCHEMA
========================================================= */

export const PaymentBaseSchema = z.object({
  paymentId: IdSchema,
  provider: z.string(),
  providerPaymentId: z.string().nullable().optional(),
  method: PaymentMethodEnum.optional(),
  status: PaymentStatusEnum.default('PENDING'),
  amount: z.number().nonnegative(),
  currency: CurrencySchema,
})

export const CardBrandEnum = z.enum(CARD_BRANDS);

export const CreditCardInputSchema = z.object({
  cardholderName: z.string().min(1),
  cardNumber:     z.string().min(13).max(19),
  expiryMonth:    z.string().length(2),
  expiryYear:     z.string().length(2),
  cvv:            z.string().min(3).max(4),
})

export const SavedCardSchema = z.object({
  cardId:        IdSchema,
  last4:         z.string().length(4),
  brand:         CardBrandEnum,
  cardholderName: z.string(),
  expiryMonth:   z.string().length(2),
  expiryYear:    z.string().length(2),
  isDefault:     z.boolean().optional(),
})

/* =========================================================
   TYPES
========================================================= */

export type PaymentStatus    = z.infer<typeof PaymentStatusEnum>
export type PaymentMethod    = z.infer<typeof PaymentMethodEnum>
export type PaymentBase      = z.infer<typeof PaymentBaseSchema>
export type CardBrand        = z.infer<typeof CardBrandEnum>
export type CreditCardInput  = z.infer<typeof CreditCardInputSchema>
export type SavedCard        = z.infer<typeof SavedCardSchema>
