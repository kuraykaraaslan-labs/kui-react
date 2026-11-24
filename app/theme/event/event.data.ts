import type {
  EventCategory,
  Organizer,
  Venue,
  VenueSection,
  EventWithData,
  EventSectionPricing,
  IssuedTicket,
  Artist,
} from '@/modules/domains/event/types';
import type { SeatInfo, SectionMapShape } from '@/modules/domains/event/SeatMapPicker';

export type UserTicketItem = {
  ticket: IssuedTicket;
  event: { title: string; startAt: Date; venueName?: string; venueCity?: string; image?: string | null };
  section?: { sectionName: string; seatLabel?: string };
  price: number;
  currency: string;
};

/* ================================================================
   CATEGORIES
================================================================ */

export const EVENT_CATEGORIES: EventCategory[] = [
  {
    categoryId: 'cat-music',
    title: 'Müzik',
    slug: 'muzik',
    description: 'Konserler, festivaller ve canlı performanslar',
    image: null,
    createdAt: new Date('2026-01-01'),
  },
  {
    categoryId: 'cat-sports',
    title: 'Spor',
    slug: 'spor',
    description: 'Maçlar, turnuvalar ve spor etkinlikleri',
    image: null,
    createdAt: new Date('2026-01-01'),
  },
  {
    categoryId: 'cat-theater',
    title: 'Tiyatro',
    slug: 'tiyatro',
    description: 'Müzikal, drama ve sahne sanatları',
    image: null,
    createdAt: new Date('2026-01-01'),
  },
  {
    categoryId: 'cat-conference',
    title: 'Konferans',
    slug: 'konferans',
    description: 'Summit, panel ve teknoloji etkinlikleri',
    image: null,
    createdAt: new Date('2026-01-01'),
  },
  {
    categoryId: 'cat-comedy',
    title: 'Stand-up',
    slug: 'standup',
    description: 'Komedi gösterileri ve stand-up performansları',
    image: null,
    createdAt: new Date('2026-01-01'),
  },
  {
    categoryId: 'cat-festival',
    title: 'Festival',
    slug: 'festival',
    description: 'Kültür, sanat ve müzik festivalleri',
    image: null,
    createdAt: new Date('2026-01-01'),
  },
];

/* ================================================================
   ORGANIZERS
================================================================ */

export const ORGANIZERS: Organizer[] = [
  {
    organizerId: 'org-live-nation',
    name: 'Live Nation Turkey',
    slug: 'live-nation-turkey',
    description: 'Türkiye\'nin en büyük konser organizatörü.',
    logo: null,
    website: 'https://example.com',
    email: 'info@livenation.com.tr',
    phone: '+90 212 000 0000',
    verified: true,
    createdAt: new Date('2025-06-01'),
  },
  {
    organizerId: 'org-stadium',
    name: 'İstanbul Stadium Events',
    slug: 'istanbul-stadium',
    description: 'Stadyum ve arena etkinlikleri.',
    logo: null,
    website: 'https://example.com',
    email: null,
    phone: null,
    verified: true,
    createdAt: new Date('2025-06-01'),
  },
  {
    organizerId: 'org-techsummit',
    name: 'TechSummit Organization',
    slug: 'techsummit',
    description: 'Teknoloji konferansları ve summit organizasyonu.',
    logo: null,
    website: 'https://example.com',
    email: 'hello@techsummit.io',
    phone: null,
    verified: true,
    createdAt: new Date('2025-08-01'),
  },
  {
    organizerId: 'org-comedy',
    name: 'Güldür Productions',
    slug: 'guldur-productions',
    description: 'Komedi şovları ve stand-up etkinlikleri.',
    logo: null,
    website: null,
    email: null,
    phone: null,
    verified: false,
    createdAt: new Date('2025-09-01'),
  },
];

/* ================================================================
   VENUES
================================================================ */

export const VENUES: Venue[] = [
  {
    venueId: 'venue-ataturk',
    name: 'Atatürk Olimpiyat Stadyumu',
    slug: 'ataturk-olimpiyat-stadyumu',
    description: '75.000 kişilik olimpiyat stadyumu',
    address: 'Bakırköy, İstanbul',
    city: 'İstanbul',
    country: 'Türkiye',
    image: 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1200&q=80',
    latitude: 41.0038,
    longitude: 28.6741,
    createdAt: new Date('2025-01-01'),
  },
  {
    venueId: 'venue-zorlu',
    name: 'Zorlu PSM',
    slug: 'zorlu-psm',
    description: 'Çok amaçlı sanat ve kültür merkezi',
    address: 'Beşiktaş, İstanbul',
    city: 'İstanbul',
    country: 'Türkiye',
    image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80',
    latitude: 41.0736,
    longitude: 29.0131,
    createdAt: new Date('2025-01-01'),
  },
  {
    venueId: 'venue-haliç',
    name: 'Haliç Kongre Merkezi',
    slug: 'halic-kongre-merkezi',
    description: 'Modern kongre ve fuar alanı',
    address: 'Eyüpsultan, İstanbul',
    city: 'İstanbul',
    country: 'Türkiye',
    image: 'https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&w=1200&q=80',
    latitude: 41.0278,
    longitude: 28.9438,
    createdAt: new Date('2025-01-01'),
  },
  {
    venueId: 'venue-ankara',
    name: 'Congresium Ankara',
    slug: 'congresium-ankara',
    description: 'Ankara kongre ve etkinlik merkezi',
    address: 'Söğütözü, Ankara',
    city: 'Ankara',
    country: 'Türkiye',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    latitude: 39.9033,
    longitude: 32.8597,
    createdAt: new Date('2025-01-01'),
  },
];

/* ================================================================
   EVENTS (with data)
================================================================ */

export const EVENTS: EventWithData[] = [
  {
    eventId: 'evt-coldplay',
    title: 'Coldplay – Music of the Spheres World Tour',
    slug: 'coldplay-music-spheres-tour-istanbul',
    description: `
      Coldplay, ikonik "Music of the Spheres World Tour" ile İstanbul'a geliyor!
      Chris Martin ve ekibinin görsel şölene dönüştürdüğü bu tur; çevre dostu sahne tasarımı,
      LED bileklikler ve interaktif ışık gösterileriyle unutulmaz bir deneyim vadediyor.
      Yellow, The Scientist, Fix You ve yeni albümden parçalar eşliğinde geçireceğiniz bir gece
      müzik tarihine geçecek.
    `,
    shortDescription: 'Coldplay\'in efsanevi dünya turu İstanbul\'da!',
    categoryId: 'cat-music',
    organizerId: 'org-live-nation',
    format: 'PHYSICAL',
    startAt: new Date('2026-07-12T20:00:00'),
    endAt: new Date('2026-07-12T23:30:00'),
    timezone: 'Europe/Istanbul',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    minPrice: 1500,
    maxPrice: 8500,
    currency: 'TRY',
    totalCapacity: 75000,
    remainingCapacity: 12400,
    tags: ['coldplay', 'konser', 'rock', 'pop', 'dünya turu'],
    keywords: ['coldplay', 'music of the spheres', 'istanbul konser'],
    publishedAt: new Date('2026-04-01'),
    createdAt: new Date('2026-03-15'),
    category: {
      categoryId: 'cat-music',
      title: 'Müzik',
      slug: 'muzik',
      image: null,
    },
    organizer: {
      organizerId: 'org-live-nation',
      name: 'Live Nation Turkey',
      slug: 'live-nation-turkey',
      logo: null,
      verified: true,
    },
  },
  {
    eventId: 'evt-techsummit',
    title: 'Istanbul Tech Summit 2026',
    slug: 'istanbul-tech-summit-2026',
    description: `
      Türkiye'nin en büyük teknoloji konferansı geri dönüyor! Yapay zekâ, blockchain, cloud computing
      ve girişimcilik alanlarında 80'den fazla konuşmacı ve 5.000+ katılımcı.
      Workshop'lar, networking oturumları ve startuplar için pitch competition ile dolu dolu 2 gün.
    `,
    shortDescription: 'Türkiye\'nin en büyük teknoloji zirvesi.',
    categoryId: 'cat-conference',
    organizerId: 'org-techsummit',
    format: 'HYBRID',
    startAt: new Date('2026-09-15T09:00:00'),
    endAt: new Date('2026-09-16T18:00:00'),
    timezone: 'Europe/Istanbul',
    image: 'https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&w=1600&q=80',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    minPrice: 0,
    maxPrice: 4999,
    currency: 'TRY',
    totalCapacity: 5000,
    remainingCapacity: 2100,
    tags: ['teknoloji', 'yapay zekâ', 'girişimcilik', 'konferans'],
    keywords: ['tech summit', 'istanbul', 'ai', 'startup'],
    publishedAt: new Date('2026-04-10'),
    createdAt: new Date('2026-04-01'),
    category: {
      categoryId: 'cat-conference',
      title: 'Konferans',
      slug: 'konferans',
      image: null,
    },
    organizer: {
      organizerId: 'org-techsummit',
      name: 'TechSummit Organization',
      slug: 'techsummit',
      logo: null,
      verified: true,
    },
  },
  {
    eventId: 'evt-hamilton',
    title: 'Hamilton – The Musical',
    slug: 'hamilton-muzikali-istanbul',
    description: `
      Broadway'in en çok konuşulan müzikali Hamilton, ilk kez Türkçe sahneye taşınıyor!
      Alexander Hamilton'ın efsanevi hayat hikâyesini hip-hop, caz ve Broadway müziğiyle anlatan
      bu muhteşem prodüksiyon 6 hafta boyunca Zorlu PSM'de sahne alacak.
    `,
    shortDescription: 'Broadway\'in efsane müzikali Türkçe sahneye çıkıyor.',
    categoryId: 'cat-theater',
    organizerId: 'org-live-nation',
    format: 'PHYSICAL',
    startAt: new Date('2026-05-20T20:00:00'),
    endAt: new Date('2026-05-20T23:00:00'),
    timezone: 'Europe/Istanbul',
    image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1600&q=80',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    minPrice: 750,
    maxPrice: 3500,
    currency: 'TRY',
    totalCapacity: 2200,
    remainingCapacity: 84,
    tags: ['tiyatro', 'müzikal', 'hamilton', 'broadway'],
    keywords: ['hamilton', 'musical', 'zorlu psm'],
    publishedAt: new Date('2026-03-01'),
    createdAt: new Date('2026-02-15'),
    category: {
      categoryId: 'cat-theater',
      title: 'Tiyatro',
      slug: 'tiyatro',
      image: null,
    },
    organizer: {
      organizerId: 'org-live-nation',
      name: 'Live Nation Turkey',
      slug: 'live-nation-turkey',
      logo: null,
      verified: true,
    },
  },
  {
    eventId: 'evt-formula-e',
    title: 'Formula E – Istanbul ePrix 2026',
    slug: 'formula-e-istanbul-eprix-2026',
    description: `
      Elektrikli araçların Formula 1'i olan Formula E serisi İstanbul sokaklarına geliyor!
      Park Yolu pisti üzerinde düzenlenen bu yarışta dünyanın en hızlı elektrikli araçlarını
      canlı izleme fırsatı yakalayacaksınız.
    `,
    shortDescription: 'Elektrikli Formula yarışı İstanbul\'da!',
    categoryId: 'cat-sports',
    organizerId: 'org-stadium',
    format: 'PHYSICAL',
    startAt: new Date('2026-06-07T14:00:00'),
    endAt: new Date('2026-06-07T17:00:00'),
    timezone: 'Europe/Istanbul',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1600&q=80',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    minPrice: 500,
    maxPrice: 12000,
    currency: 'TRY',
    totalCapacity: 40000,
    remainingCapacity: 8300,
    tags: ['formula e', 'yarış', 'elektrikli', 'spor'],
    keywords: ['formula e', 'eprix', 'istanbul', 'elektrikli yarış'],
    publishedAt: new Date('2026-03-20'),
    createdAt: new Date('2026-03-01'),
    category: {
      categoryId: 'cat-sports',
      title: 'Spor',
      slug: 'spor',
      image: null,
    },
    organizer: {
      organizerId: 'org-stadium',
      name: 'İstanbul Stadium Events',
      slug: 'istanbul-stadium',
      logo: null,
      verified: true,
    },
  },
  {
    eventId: 'evt-standup',
    title: 'Cem Yılmaz – Yaşasın Hayat Turu',
    slug: 'cem-yilmaz-yasasin-hayat-turu',
    description: `
      Türkiye'nin en sevilen stand-up komedyeni Cem Yılmaz, yeni şovu "Yaşasın Hayat" ile sahnede!
      2 saatlik bu stand-up performansında güncel konular, hayat gözlemleri ve Cem'in imza tarzıyla
      buluşacaksınız.
    `,
    shortDescription: 'Cem Yılmaz\'ın yeni stand-up şovu sahnede!',
    categoryId: 'cat-comedy',
    organizerId: 'org-comedy',
    format: 'PHYSICAL',
    startAt: new Date('2026-05-30T21:00:00'),
    endAt: new Date('2026-05-30T23:00:00'),
    timezone: 'Europe/Istanbul',
    image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1600&q=80',
    status: 'SOLD_OUT',
    visibility: 'PUBLIC',
    minPrice: 600,
    maxPrice: 1200,
    currency: 'TRY',
    totalCapacity: 3000,
    remainingCapacity: 0,
    tags: ['standup', 'komedi', 'cem yılmaz'],
    keywords: ['cem yılmaz', 'stand-up', 'komedi'],
    publishedAt: new Date('2026-03-01'),
    createdAt: new Date('2026-02-20'),
    category: {
      categoryId: 'cat-comedy',
      title: 'Stand-up',
      slug: 'standup',
      image: null,
    },
    organizer: {
      organizerId: 'org-comedy',
      name: 'Güldür Productions',
      slug: 'guldur-productions',
      logo: null,
      verified: false,
    },
  },
  {
    eventId: 'evt-istanbul-jazz',
    title: 'İstanbul Caz Festivali 2026',
    slug: 'istanbul-caz-festivali-2026',
    description: `
      30. yılına giren İstanbul Caz Festivali, bu yıl 10 gün boyunca 40'tan fazla konser ile
      şehrin dört bir yanında müzikseverlerle buluşuyor. Dünyadan ve Türkiye'den usta müzisyenler,
      açık hava ve kapalı mekânlarda nefes kesen performanslar sunacak.
    `,
    shortDescription: '30. yılında İstanbul Caz Festivali başlıyor!',
    categoryId: 'cat-festival',
    organizerId: 'org-live-nation',
    format: 'PHYSICAL',
    startAt: new Date('2026-07-01T18:00:00'),
    endAt: new Date('2026-07-10T23:59:00'),
    timezone: 'Europe/Istanbul',
    image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=1600&q=80',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    minPrice: 200,
    maxPrice: 2500,
    currency: 'TRY',
    totalCapacity: null,
    remainingCapacity: null,
    tags: ['caz', 'festival', 'müzik', 'istanbul'],
    keywords: ['istanbul jazz festival', 'caz', 'festival'],
    publishedAt: new Date('2026-04-15'),
    createdAt: new Date('2026-04-01'),
    category: {
      categoryId: 'cat-festival',
      title: 'Festival',
      slug: 'festival',
      image: null,
    },
    organizer: {
      organizerId: 'org-live-nation',
      name: 'Live Nation Turkey',
      slug: 'live-nation-turkey',
      logo: null,
      verified: true,
    },
  },
];

/* ================================================================
   SECTION PRICINGS (per event)
================================================================ */

export const PRICINGS: Record<string, EventSectionPricing[]> = {
  'evt-coldplay': [
    {
      eventSectionPricingId: 'price-coldplay-vip',
      eventId: 'evt-coldplay',
      sectionId: 'sec-vip',
      name: 'VIP Tribün',
      description: 'En yakın tribün, özel karşılama, LED bileklik ve hediye çantası dahil.',
      price: 8500,
      currency: 'TRY',
      capacity: 2000,
      soldCount: 1850,
      active: true,
    },
    {
      eventSectionPricingId: 'price-coldplay-gold',
      eventId: 'evt-coldplay',
      sectionId: 'sec-gold',
      name: 'Gold Saha',
      description: 'Sahneye en yakın açık alan, ayakta deneyim.',
      price: 4500,
      currency: 'TRY',
      capacity: 15000,
      soldCount: 13200,
      active: true,
    },
    {
      eventSectionPricingId: 'price-coldplay-standard',
      eventId: 'evt-coldplay',
      sectionId: 'sec-standard',
      name: 'Standart Tribün',
      description: 'Numaralı koltuk, harika görüş açısı.',
      price: 1500,
      currency: 'TRY',
      capacity: 30000,
      soldCount: 24000,
      active: true,
    },
  ],
  'evt-techsummit': [
    {
      eventSectionPricingId: 'price-tech-free',
      eventId: 'evt-techsummit',
      sectionId: 'sec-online',
      name: 'Online Katılım',
      description: 'Tüm konuşmalara canlı yayın erişimi.',
      price: 0,
      currency: 'TRY',
      capacity: null,
      soldCount: 3200,
      active: true,
    },
    {
      eventSectionPricingId: 'price-tech-standard',
      eventId: 'evt-techsummit',
      sectionId: 'sec-general',
      name: 'Standart Bilet',
      description: '2 günlük tam erişim, networking alanı, öğle yemeği dahil.',
      price: 1999,
      currency: 'TRY',
      capacity: 3000,
      soldCount: 1800,
      active: true,
    },
    {
      eventSectionPricingId: 'price-tech-vip',
      eventId: 'evt-techsummit',
      sectionId: 'sec-vip',
      name: 'VIP Pass',
      description: 'Tüm workshop\'lar, VIP networking dinner ve sertifika dahil.',
      price: 4999,
      currency: 'TRY',
      capacity: 200,
      soldCount: 180,
      active: true,
    },
  ],
  'evt-hamilton': [
    {
      eventSectionPricingId: 'price-hamilton-premium',
      eventId: 'evt-hamilton',
      sectionId: 'sec-hamilton-premium',
      name: 'Premium Parket',
      description: 'Sahneye en yakın sıra, merkezi konum.',
      price: 3500,
      currency: 'TRY',
      capacity: 50,
      soldCount: 30,
      active: true,
    },
    {
      eventSectionPricingId: 'price-hamilton-sol-loca',
      eventId: 'evt-hamilton',
      sectionId: 'sec-hamilton-sol-loca',
      name: 'Sol Loca',
      description: 'Sol kanat loca koltuğu.',
      price: 2000,
      currency: 'TRY',
      capacity: 36,
      soldCount: 24,
      active: true,
    },
    {
      eventSectionPricingId: 'price-hamilton-sag-loca',
      eventId: 'evt-hamilton',
      sectionId: 'sec-hamilton-sag-loca',
      name: 'Sağ Loca',
      description: 'Sağ kanat loca koltuğu.',
      price: 2000,
      currency: 'TRY',
      capacity: 36,
      soldCount: 24,
      active: true,
    },
    {
      eventSectionPricingId: 'price-hamilton-balkon',
      eventId: 'evt-hamilton',
      sectionId: 'sec-hamilton-balkon',
      name: 'Balkon',
      description: 'Üst kat balkon, geniş görüş açısı.',
      price: 750,
      currency: 'TRY',
      capacity: 60,
      soldCount: 20,
      active: true,
    },
  ],
  'evt-formula-e': [
    {
      eventSectionPricingId: 'price-fe-genel',
      eventId: 'evt-formula-e',
      sectionId: 'sec-genel-tribun',
      name: 'Genel Tribün',
      description: 'Açık tribün, yarış pistini takip et.',
      price: 500,
      currency: 'TRY',
      capacity: 20000,
      soldCount: 17000,
      active: true,
    },
    {
      eventSectionPricingId: 'price-fe-premium',
      eventId: 'evt-formula-e',
      sectionId: 'sec-premium-tribun',
      name: 'Premium Tribün',
      description: 'Örtülü alan, numaralı koltuk.',
      price: 2500,
      currency: 'TRY',
      capacity: 10000,
      soldCount: 7200,
      active: true,
    },
    {
      eventSectionPricingId: 'price-fe-paddock',
      eventId: 'evt-formula-e',
      sectionId: 'sec-paddock',
      name: 'Paddock Kulübü',
      description: 'Ekip bölgesi ziyareti, kokteyl, özel tribün.',
      price: 12000,
      currency: 'TRY',
      capacity: 200,
      soldCount: 160,
      active: true,
    },
  ],
};

/* ================================================================
   EXTRA VENUES
================================================================ */

VENUES.push({
  venueId: 'venue-harbiye',
  name: 'Harbiye Açık Hava Tiyatrosu',
  slug: 'harbiye-acik-hava-tiyatrosu',
  description: 'İstanbul\'un simgesi, 15.000 kişilik açık hava sahnesi',
  address: 'Harbiye, Şişli, İstanbul',
  city: 'İstanbul',
  country: 'Türkiye',
  image: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?auto=format&fit=crop&w=1200&q=80',
  latitude: 41.0463,
  longitude: 28.9928,
  createdAt: new Date('2025-01-01'),
});

/* ================================================================
   ARTISTS
================================================================ */

export const ARTISTS: Artist[] = [
  {
    artistId: 'artist-coldplay',
    name: 'Coldplay',
    slug: 'coldplay',
    shortBio: 'Britanya\'nın en çok dinlenen alternatif rock grubu.',
    bio: 'Coldplay, 1996 yılında Londra\'da kurulan İngiliz alternatif rock grubudur. Chris Martin, Jonny Buckland, Guy Berryman ve Will Champion\'dan oluşan grup, Yellow, The Scientist, Fix You, Viva la Vida ve A Sky Full of Stars gibi ikonik parçalarıyla dünyanın en çok dinlenen müzisyenleri arasındadır. "Music of the Spheres World Tour" ile çevre dostu sahne tasarımı ve interaktif LED bileklikler sunan grup, her konserini görsel bir şölene dönüştürmektedir.',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80',
    genres: ['Alternative Rock', 'Pop Rock', 'Art Rock'],
    origin: 'Londra, İngiltere',
    website: 'https://coldplay.com',
    verified: true,
    createdAt: new Date('2026-01-01'),
  },
  {
    artistId: 'artist-cem-yilmaz',
    name: 'Cem Yılmaz',
    slug: 'cem-yilmaz',
    shortBio: 'Türkiye\'nin en sevilen stand-up komedyeni ve oyuncusu.',
    bio: 'Cem Yılmaz, 1973 yılında İstanbul\'da doğmuş Türk komedyen, oyuncu, yazar ve yönetmendir. 1990\'ların sonundan itibaren stand-up gösterileri, sinema filmleri ve televizyon projeleriyle Türkiye\'nin en tanınmış sanatçılarından biri haline gelmiştir. Keskin gözlem yeteneği, özgün anlatım tarzı ve güncel toplumsal yorumlarıyla her yaştan izleyiciye hitap etmektedir.',
    image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=1600&q=80',
    genres: ['Stand-up Komedi', 'Tek Adam Gösterisi'],
    origin: 'İstanbul, Türkiye',
    website: null,
    verified: true,
    createdAt: new Date('2026-01-01'),
  },
  {
    artistId: 'artist-ibrahim-maalouf',
    name: 'Ibrahim Maalouf',
    slug: 'ibrahim-maalouf',
    shortBio: 'Lübnanlı-Fransız trompetçi ve besteci.',
    bio: 'Ibrahim Maalouf, Beyrut doğumlu Fransız trompetçi ve bestecisidir. Klasik müzik eğitimini Paris Konservatuarı\'nda tamamlamış olan Maalouf, Arap müziği ile jazz\'ı harmanlayan benzersiz üslubuyla dünya sahnesinde tanınmaktadır. İstanbul Caz Festivali\'nin en çok beklenen isimlerinden biridir.',
    image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=1600&q=80',
    genres: ['Jazz', 'World Music', 'Klasik'],
    origin: 'Beyrut, Lübnan / Paris, Fransa',
    website: null,
    verified: true,
    createdAt: new Date('2026-01-01'),
  },
  {
    artistId: 'artist-snarky-puppy',
    name: 'Snarky Puppy',
    slug: 'snarky-puppy',
    shortBio: 'Grammy ödüllü funk-jazz kolektifi.',
    bio: 'Snarky Puppy, Dallas\'ta kurulan ve Michael League\'in liderliğinde yürütülen Grammy ödüllü funk-jazz kolektifidir. 40\'tan fazla müzisyenin zaman zaman bir araya geldiği bu topluluğun canlı performansları enerjisi ve doğaçlama anlayışıyla eşsizdir.',
    image: 'https://images.unsplash.com/photo-1501386761578-eaa54b292de9?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1501386761578-eaa54b292de9?auto=format&fit=crop&w=1600&q=80',
    genres: ['Funk', 'Jazz', 'Soul'],
    origin: 'Dallas, ABD',
    website: null,
    verified: true,
    createdAt: new Date('2026-01-01'),
  },
  {
    artistId: 'artist-nils-frahm',
    name: 'Nils Frahm',
    slug: 'nils-frahm',
    shortBio: 'Alman piyanist ve besteci; neo-klasik müziğin öncüsü.',
    bio: 'Nils Frahm, Hamburg doğumlu piyanist ve bestecisi. Klasik piyano ile elektronik sesleri bir araya getiren neo-klasik tarzıyla öne çıkan Frahm, Barbican, Elbphilharmonie ve Royal Albert Hall gibi prestijli mekânlarda sahne almıştır. İstanbul Caz Festivali\'nin özel oturumlarından birini gerçekleştirecektir.',
    image: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=1600&q=80',
    genres: ['Neo-klasik', 'Ambient', 'Elektronik'],
    origin: 'Hamburg, Almanya',
    website: null,
    verified: false,
    createdAt: new Date('2026-01-01'),
  },
];

/* eventId → artistId[] */
export const EVENT_ARTISTS: Record<string, string[]> = {
  'evt-coldplay':       ['artist-coldplay'],
  'evt-standup':        ['artist-cem-yilmaz'],
  'evt-istanbul-jazz':  ['artist-ibrahim-maalouf', 'artist-snarky-puppy', 'artist-nils-frahm'],
};

/* eventId → venueId */
export const EVENT_VENUE: Record<string, string> = {
  'evt-coldplay':      'venue-ataturk',
  'evt-techsummit':    'venue-haliç',
  'evt-hamilton':      'venue-zorlu',
  'evt-formula-e':     'venue-ataturk',
  'evt-standup':       'venue-ankara',
  'evt-istanbul-jazz': 'venue-harbiye',
};

/* ================================================================
   HELPERS
================================================================ */

export function getEventBySlug(slug: string): EventWithData | null {
  return EVENTS.find((e) => e.slug === slug) ?? null;
}

export function getPricingsByEventId(eventId: string): EventSectionPricing[] {
  return PRICINGS[eventId] ?? [];
}

export function getOrganizerById(id: string): Organizer | null {
  return ORGANIZERS.find((o) => o.organizerId === id) ?? null;
}

export function getOrganizerBySlug(slug: string): Organizer | null {
  return ORGANIZERS.find((o) => o.slug === slug) ?? null;
}

export function getEventsByOrganizerId(organizerId: string): EventWithData[] {
  return EVENTS.filter((e) => e.organizerId === organizerId);
}

export function getVenueById(id: string): Venue | null {
  return VENUES.find((v) => v.venueId === id) ?? null;
}

export function getVenueBySlug(slug: string): Venue | null {
  return VENUES.find((v) => v.slug === slug) ?? null;
}

export function getArtistBySlug(slug: string): Artist | null {
  return ARTISTS.find((a) => a.slug === slug) ?? null;
}

export function getArtistsByEventId(eventId: string): Artist[] {
  const ids = EVENT_ARTISTS[eventId] ?? [];
  return ids.map((id) => ARTISTS.find((a) => a.artistId === id)).filter(Boolean) as Artist[];
}

export function getEventsByArtistId(artistId: string): EventWithData[] {
  return EVENTS.filter((e) =>
    (EVENT_ARTISTS[e.eventId] ?? []).includes(artistId),
  );
}

export function getEventsByVenueId(venueId: string): EventWithData[] {
  return EVENTS.filter((e) => EVENT_VENUE[e.eventId] === venueId);
}

export function getVenueByEventId(eventId: string): Venue | null {
  const venueId = EVENT_VENUE[eventId];
  return venueId ? getVenueById(venueId) : null;
}

export const FEATURED_EVENT = EVENTS[0];
export const UPCOMING_EVENTS = EVENTS.filter((e) => e.status !== 'ARCHIVED');

/* ================================================================
   SEAT MAP CONFIGS — events with numbered seat selection
================================================================ */

export type SeatMapConfig = {
  sections: VenueSection[];
  seatInfos: SeatInfo[];
  mapShapes: SectionMapShape[];
  mapViewBox: string;
  mapMaxWidth?: number;
  stagePoints?: string;
  stageLabel?: string;
  stageLabelX?: number;
  stageLabelY?: number;
};

/* ── Hamilton seat data (Zorlu PSM) ── */

const HAMILTON_SECTIONS: VenueSection[] = [
  { sectionId: 'sec-hamilton-premium', venueId: 'venue-zorlu', name: 'Premium Parket', label: 'Premium', capacity: 50, sortOrder: 0 },
  { sectionId: 'sec-hamilton-sol-loca', venueId: 'venue-zorlu', name: 'Sol Loca', label: 'Sol Loca', capacity: 36, sortOrder: 1 },
  { sectionId: 'sec-hamilton-sag-loca', venueId: 'venue-zorlu', name: 'Sağ Loca', label: 'Sağ Loca', capacity: 36, sortOrder: 2 },
  { sectionId: 'sec-hamilton-balkon', venueId: 'venue-zorlu', name: 'Balkon', label: 'Balkon', capacity: 60, sortOrder: 3 },
];

function buildSeatRow(
  sectionId: string,
  pricingId: string,
  row: string,
  count: number,
  status: SeatInfo['status'],
  overrides?: Record<string, SeatInfo['status']>,
): SeatInfo[] {
  return Array.from({ length: count }, (_, i) => {
    const num = String(i + 1);
    const seatId = `${sectionId}-${row}${num}`;
    return {
      seat: { seatId, sectionId, row, number: num, label: null, x: null, y: null, accessible: false, companionSeat: false },
      status: overrides?.[seatId] ?? status,
      pricingId,
    };
  });
}

const HAMILTON_SEAT_INFOS: SeatInfo[] = [
  // Premium Parket: 5 rows × 10 seats — A–C sold, D–E available (20 avail)
  ...['A','B','C'].flatMap(r => buildSeatRow('sec-hamilton-premium', 'price-hamilton-premium', r, 10, 'SOLD')),
  ...['D','E']   .flatMap(r => buildSeatRow('sec-hamilton-premium', 'price-hamilton-premium', r, 10, 'AVAILABLE')),

  // Sol Loca: 6 rows × 6 seats — A–D sold, E–F available (12 avail)
  ...['A','B','C','D'].flatMap(r => buildSeatRow('sec-hamilton-sol-loca', 'price-hamilton-sol-loca', r, 6, 'SOLD')),
  ...['E','F']        .flatMap(r => buildSeatRow('sec-hamilton-sol-loca', 'price-hamilton-sol-loca', r, 6, 'AVAILABLE')),

  // Sağ Loca: 6 rows × 6 seats — A–D sold, E held×2, F available (12 avail)
  ...['A','B','C','D'].flatMap(r => buildSeatRow('sec-hamilton-sag-loca', 'price-hamilton-sag-loca', r, 6, 'SOLD')),
  ...buildSeatRow('sec-hamilton-sag-loca', 'price-hamilton-sag-loca', 'E', 6, 'AVAILABLE', {
    'sec-hamilton-sag-loca-E1': 'HELD',
    'sec-hamilton-sag-loca-E2': 'HELD',
  }),
  ...buildSeatRow('sec-hamilton-sag-loca', 'price-hamilton-sag-loca', 'F', 6, 'AVAILABLE'),

  // Balkon: 6 rows × 10 seats — A–B sold, C–F available (40 avail)
  ...['A','B'].flatMap(r => buildSeatRow('sec-hamilton-balkon', 'price-hamilton-balkon', r, 10, 'SOLD')),
  ...['C','D','E','F'].flatMap(r => buildSeatRow('sec-hamilton-balkon', 'price-hamilton-balkon', r, 10, 'AVAILABLE')),
];

const SEAT_MAP_CONFIGS: Record<string, SeatMapConfig> = {
  'evt-hamilton': {
    sections: HAMILTON_SECTIONS,
    seatInfos: HAMILTON_SEAT_INFOS,
    mapShapes: [
      { sectionId: 'sec-hamilton-premium',  points: '190,93 490,93 500,220 180,220',              labelX: 340, labelY: 155, seatGridAngle:   0 },
      { sectionId: 'sec-hamilton-sol-loca', points: '40,93 190,93 180,220 55,280',                labelX: 115, labelY: 178, seatGridAngle:  14 },
      { sectionId: 'sec-hamilton-sag-loca', points: '490,93 640,93 625,280 500,220',              labelX: 565, labelY: 178, seatGridAngle: -14 },
      { sectionId: 'sec-hamilton-balkon',   points: '55,280 180,220 500,220 625,280 640,440 40,440', labelX: 340, labelY: 368, seatGridAngle:   0 },
    ],
    mapViewBox:  '0 0 680 460',
    mapMaxWidth: 540,
    stagePoints: '225,18 455,18 455,88 225,88',
    stageLabel:  'SAHNE',
    stageLabelX: 340,
    stageLabelY: 53,
  },
};

export function getSeatMapConfig(eventId: string): SeatMapConfig | null {
  return SEAT_MAP_CONFIGS[eventId] ?? null;
}

/* ================================================================
   MY TICKETS (demo user's purchased tickets)
================================================================ */

export const MY_TICKETS: UserTicketItem[] = [
  {
    ticket: {
      ticketId: 'TKT-C0LDPL4Y-01',
      orderId: 'ORD-2026001',
      orderItemId: 'OI-C0LDPL4Y-01',
      eventId: 'evt-coldplay',
      sectionId: 'sec-vip',
      seatId: 'seat-vip-A1',
      eventSeatId: 'eseat-vip-A1',
      pricingId: 'price-coldplay-vip',
      attendeeName: 'John Nolan',
      attendeeEmail: 'john.nolan@example.com',
      qrCode: 'COLD-VIP-A1-2026071220',
      status: 'VALID',
      createdAt: new Date('2026-04-05T14:22:00'),
    },
    event: {
      title: 'Coldplay – Music of the Spheres World Tour',
      startAt: new Date('2026-07-12T20:00:00'),
      venueName: 'Atatürk Olimpiyat Stadyumu',
      venueCity: 'İstanbul',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    },
    section: { sectionName: 'VIP Tribün', seatLabel: 'A-1' },
    price: 8500,
    currency: 'TRY',
  },
  {
    ticket: {
      ticketId: 'TKT-C0LDPL4Y-02',
      orderId: 'ORD-2026001',
      orderItemId: 'OI-C0LDPL4Y-02',
      eventId: 'evt-coldplay',
      sectionId: 'sec-vip',
      seatId: 'seat-vip-A2',
      eventSeatId: 'eseat-vip-A2',
      pricingId: 'price-coldplay-vip',
      attendeeName: 'Lucy Chen',
      attendeeEmail: 'lucy.chen@example.com',
      qrCode: 'COLD-VIP-A2-2026071220',
      status: 'VALID',
      createdAt: new Date('2026-04-05T14:22:00'),
    },
    event: {
      title: 'Coldplay – Music of the Spheres World Tour',
      startAt: new Date('2026-07-12T20:00:00'),
      venueName: 'Atatürk Olimpiyat Stadyumu',
      venueCity: 'İstanbul',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    },
    section: { sectionName: 'VIP Tribün', seatLabel: 'A-2' },
    price: 8500,
    currency: 'TRY',
  },
  {
    ticket: {
      ticketId: 'TKT-HAMILTON-01',
      orderId: 'ORD-2026002',
      orderItemId: 'OI-HAMILTON-01',
      eventId: 'evt-hamilton',
      sectionId: 'sec-hamilton-premium',
      seatId: 'seat-ham-D3',
      eventSeatId: 'eseat-ham-D3',
      pricingId: 'price-hamilton-premium',
      attendeeName: 'John Nolan',
      attendeeEmail: 'john.nolan@example.com',
      qrCode: 'HAM-PREM-D3-2026052020',
      status: 'VALID',
      createdAt: new Date('2026-04-10T09:15:00'),
    },
    event: {
      title: 'Hamilton – The Musical',
      startAt: new Date('2026-05-20T20:00:00'),
      venueName: 'Zorlu PSM',
      venueCity: 'İstanbul',
      image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80',
    },
    section: { sectionName: 'Premium Parket', seatLabel: 'D-3' },
    price: 3500,
    currency: 'TRY',
  },
  {
    ticket: {
      ticketId: 'TKT-FORMULE-01',
      orderId: 'ORD-2026003',
      orderItemId: 'OI-FORMULE-01',
      eventId: 'evt-formula-e',
      sectionId: 'sec-formula-tribun',
      seatId: 'seat-form-B7',
      eventSeatId: 'eseat-form-B7',
      pricingId: 'price-formula-tribun',
      attendeeName: 'John Nolan',
      attendeeEmail: 'john.nolan@example.com',
      qrCode: 'FORM-TRIB-B7-2026060714',
      status: 'USED',
      checkedInAt: new Date('2026-06-07T13:45:00'),
      createdAt: new Date('2026-05-01T11:30:00'),
    },
    event: {
      title: 'Formula E – Istanbul ePrix 2026',
      startAt: new Date('2026-06-07T14:00:00'),
      venueName: 'Park Yolu Pisti',
      venueCity: 'İstanbul',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
    },
    section: { sectionName: 'Ana Tribün', seatLabel: 'B-7' },
    price: 3500,
    currency: 'TRY',
  },
  {
    ticket: {
      ticketId: 'TKT-CEMYLMZ-01',
      orderId: 'ORD-2026004',
      orderItemId: 'OI-CEMYLMZ-01',
      eventId: 'evt-standup',
      sectionId: 'sec-standup-genel',
      seatId: 'seat-stan-C12',
      eventSeatId: 'eseat-stan-C12',
      pricingId: 'price-standup-genel',
      attendeeName: 'John Nolan',
      attendeeEmail: 'john.nolan@example.com',
      qrCode: 'STAN-GEN-C12-2026053021',
      status: 'TRANSFERRED',
      transferredAt: new Date('2026-05-10T16:00:00'),
      createdAt: new Date('2026-04-12T20:45:00'),
    },
    event: {
      title: 'Cem Yılmaz – Yaşasın Hayat Turu',
      startAt: new Date('2026-05-30T21:00:00'),
      venueName: 'Congresium Ankara',
      venueCity: 'Ankara',
      image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80',
    },
    section: { sectionName: 'Genel Salon', seatLabel: 'C-12' },
    price: 900,
    currency: 'TRY',
  },
  {
    ticket: {
      ticketId: 'TKT-JAZFEST-01',
      orderId: 'ORD-2026005',
      orderItemId: 'OI-JAZFEST-01',
      eventId: 'evt-istanbul-jazz',
      sectionId: 'sec-jazz-genel',
      seatId: 'seat-jazz-E5',
      eventSeatId: 'eseat-jazz-E5',
      pricingId: 'price-jazz-genel',
      attendeeName: 'John Nolan',
      attendeeEmail: 'john.nolan@example.com',
      qrCode: 'JAZZ-GEN-E5-2026070118',
      status: 'CANCELLED',
      cancelledAt: new Date('2026-04-20T10:00:00'),
      createdAt: new Date('2026-04-16T08:00:00'),
    },
    event: {
      title: 'İstanbul Caz Festivali 2026',
      startAt: new Date('2026-07-01T18:00:00'),
      venueName: 'Harbiye Açık Hava',
      venueCity: 'İstanbul',
      image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=1200&q=80',
    },
    section: { sectionName: 'Genel Giriş' },
    price: 750,
    currency: 'TRY',
  },
];

export function getTicketById(ticketId: string): UserTicketItem | null {
  return MY_TICKETS.find((e) => e.ticket.ticketId === ticketId) ?? null;
}

/* ================================================================
   MY ORDERS (demo user's order history)
================================================================ */

export type UserOrderEntry = {
  orderId: string;
  status: 'PAID' | 'CANCELLED' | 'REFUNDED';
  subtotal: number;
  serviceFee: number;
  total: number;
  currency: string;
  createdAt: Date;
  paidAt: Date | null;
  event: { eventId: string; title: string; startAt: Date; image?: string | null; slug: string };
  tickets: UserTicketItem[];
};

export const MY_ORDERS: UserOrderEntry[] = [
  {
    orderId: 'ORD-2026001',
    status: 'PAID',
    subtotal: 17000,
    serviceFee: 850,
    total: 17850,
    currency: 'TRY',
    createdAt: new Date('2026-04-05T14:22:00'),
    paidAt: new Date('2026-04-05T14:23:41'),
    event: {
      eventId: 'evt-coldplay',
      title: 'Coldplay – Music of the Spheres World Tour',
      startAt: new Date('2026-07-12T20:00:00'),
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      slug: 'coldplay-music-spheres-tour-istanbul',
    },
    tickets: MY_TICKETS.filter((t) => t.ticket.orderId === 'ORD-2026001'),
  },
  {
    orderId: 'ORD-2026002',
    status: 'PAID',
    subtotal: 3500,
    serviceFee: 175,
    total: 3675,
    currency: 'TRY',
    createdAt: new Date('2026-04-10T09:15:00'),
    paidAt: new Date('2026-04-10T09:16:22'),
    event: {
      eventId: 'evt-hamilton',
      title: 'Hamilton – The Musical',
      startAt: new Date('2026-05-20T20:00:00'),
      image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80',
      slug: 'hamilton-muzikali-istanbul',
    },
    tickets: MY_TICKETS.filter((t) => t.ticket.orderId === 'ORD-2026002'),
  },
  {
    orderId: 'ORD-2026003',
    status: 'PAID',
    subtotal: 3500,
    serviceFee: 175,
    total: 3675,
    currency: 'TRY',
    createdAt: new Date('2026-05-01T11:30:00'),
    paidAt: new Date('2026-05-01T11:31:05'),
    event: {
      eventId: 'evt-formula-e',
      title: 'Formula E – Istanbul ePrix 2026',
      startAt: new Date('2026-06-07T14:00:00'),
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
      slug: 'formula-e-istanbul-eprix-2026',
    },
    tickets: MY_TICKETS.filter((t) => t.ticket.orderId === 'ORD-2026003'),
  },
  {
    orderId: 'ORD-2026004',
    status: 'PAID',
    subtotal: 900,
    serviceFee: 45,
    total: 945,
    currency: 'TRY',
    createdAt: new Date('2026-04-12T20:45:00'),
    paidAt: new Date('2026-04-12T20:46:18'),
    event: {
      eventId: 'evt-standup',
      title: 'Cem Yılmaz – Yaşasın Hayat Turu',
      startAt: new Date('2026-05-30T21:00:00'),
      image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80',
      slug: 'cem-yilmaz-yasasin-hayat-turu',
    },
    tickets: MY_TICKETS.filter((t) => t.ticket.orderId === 'ORD-2026004'),
  },
  {
    orderId: 'ORD-2026005',
    status: 'REFUNDED',
    subtotal: 750,
    serviceFee: 0,
    total: 750,
    currency: 'TRY',
    createdAt: new Date('2026-04-16T08:00:00'),
    paidAt: new Date('2026-04-16T08:01:30'),
    event: {
      eventId: 'evt-istanbul-jazz',
      title: 'İstanbul Caz Festivali 2026',
      startAt: new Date('2026-07-01T18:00:00'),
      image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=1200&q=80',
      slug: 'istanbul-caz-festivali-2026',
    },
    tickets: MY_TICKETS.filter((t) => t.ticket.orderId === 'ORD-2026005'),
  },
];

export function getOrderById(orderId: string): UserOrderEntry | null {
  return MY_ORDERS.find((o) => o.orderId === orderId) ?? null;
}
