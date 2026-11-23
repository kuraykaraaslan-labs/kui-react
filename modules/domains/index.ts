// Top-level domain barrel. Re-exports each vertical as a namespace so callers can do:
//
//   import { Commerce, Blog } from '@/modules/domains';
//   const card = <Commerce.ProductCard ... />;
//
// For a flat import, use the vertical's own barrel:
//
//   import { ProductCard } from '@/modules/domains/commerce';

export * as AI from './ai';
export * as Analytics from './analytics';
export * as ApiDoc from './api-doc';
export * as Blog from './blog';
export * as Commerce from './commerce';
export * as Common from './common';
export * as Event from './event';
export * as Fintech from './fintech';
export * as Food from './food';
export * as Forum from './forum';
export * as IoT from './iot';
export * as Jobs from './jobs';
export * as Landing from './landing';
export * as Media from './media';
export * as Nft from './nft';
export * as RealEstate from './real-estate';
export * as Reviews from './reviews';
export * as Social from './social';
export * as Travel from './travel';
