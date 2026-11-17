/**
 * The card schemes, without zod: the payment components import their brand type from here so a host can copy them without
 * the common vertical's schema files. `PaymentTypes.CardBrandEnum` is built from this list.
 */
export const CARD_BRANDS = ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'TROY', 'MIR', 'UNIONPAY', 'JCB', 'UNKNOWN'] as const;

export type CardBrand = (typeof CARD_BRANDS)[number];
