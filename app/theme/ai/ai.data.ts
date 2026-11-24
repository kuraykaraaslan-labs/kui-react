import type { AIModel, AIJob, AIChatSession, AIChatMessage, AIUsage } from '@/modules/domains/ai/types';

/* ─── Models ─── */

export const MODELS: AIModel[] = [
  {
    modelId: 'gokce-5.2',
    provider: 'CUSTOM',
    name: 'Gökçe-5.2',
    type: 'TEXT',
    contextWindow: 256000,
    maxOutputTokens: 8192,
    pricingPromptPer1k: 0.004,
    pricingCompletionPer1k: 0.012,
    active: true,
    createdAt: new Date('2026-03-01'),
  },
  {
    modelId: 'gokce-5.2-mini',
    provider: 'CUSTOM',
    name: 'Gökçe-5.2 Mini',
    type: 'TEXT',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricingPromptPer1k: 0.001,
    pricingCompletionPer1k: 0.004,
    active: true,
    createdAt: new Date('2026-03-15'),
  },
  {
    modelId: 'gokce-4',
    provider: 'CUSTOM',
    name: 'Gökçe-4',
    type: 'TEXT',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricingPromptPer1k: 0.003,
    pricingCompletionPer1k: 0.009,
    active: true,
    createdAt: new Date('2025-09-10'),
  },
  {
    modelId: 'umay-vision',
    provider: 'CUSTOM',
    name: 'Umay Vision',
    type: 'IMAGE',
    contextWindow: null,
    maxOutputTokens: null,
    pricingPromptPer1k: 0.03,
    pricingCompletionPer1k: null,
    active: true,
    createdAt: new Date('2026-01-20'),
  },
  {
    modelId: 'umay-embed',
    provider: 'CUSTOM',
    name: 'Umay Embed',
    type: 'EMBEDDING',
    contextWindow: 16384,
    maxOutputTokens: null,
    pricingPromptPer1k: 0.0001,
    pricingCompletionPer1k: null,
    active: true,
    createdAt: new Date('2026-02-05'),
  },
];

/* ─── Chat Sessions ─── */

export const CHAT_SESSIONS: AIChatSession[] = [
  {
    sessionId: 'sess-01',
    userId: 'user-01',
    title: '2026 yapay zekâ trendleri hakkında blog',
    modelId: 'gokce-5.2',
    createdAt: new Date('2026-05-09T10:00:00Z'),
    updatedAt: new Date('2026-05-09T10:15:00Z'),
  },
  {
    sessionId: 'sess-02',
    userId: 'user-01',
    title: 'Araştırma makalesi özeti',
    modelId: 'gokce-5.2',
    createdAt: new Date('2026-05-08T14:30:00Z'),
    updatedAt: new Date('2026-05-08T14:45:00Z'),
  },
  {
    sessionId: 'sess-03',
    userId: 'user-02',
    title: 'TypeScript kod incelemesi',
    modelId: 'gokce-4',
    createdAt: new Date('2026-05-07T09:20:00Z'),
    updatedAt: new Date('2026-05-07T09:40:00Z'),
  },
];

/* ─── Chat Messages ─── */

export const CHAT_MESSAGES: Record<string, AIChatMessage[]> = {
  'sess-01': [
    {
      messageId: 'msg-01',
      sessionId: 'sess-01',
      role: 'USER',
      content: '2026 yılının en önemli yapay zekâ trendleri hakkında kısa bir giriş paragrafı yazar mısın?',
      tokens: 22,
      createdAt: new Date('2026-05-09T10:01:00Z'),
    },
    {
      messageId: 'msg-02',
      sessionId: 'sess-01',
      role: 'ASSISTANT',
      content:
        '2026 yılında yapay zekâ, üç temel dönüşümle şekilleniyor: açık ağırlıklı modellerin yaygınlaşmasıyla sınır modellere erişimin demokratikleşmesi, birden fazla modeli zincirleme biçimde kullanan otonom iş akışlarının yükselişi ve çok modlu akıl yürütmenin artık premium bir özellik olmaktan çıkıp standart bir kabiliyet hâline gelmesi.',
      tokens: 74,
      createdAt: new Date('2026-05-09T10:01:05Z'),
    },
    {
      messageId: 'msg-03',
      sessionId: 'sess-01',
      role: 'USER',
      content: 'Otonom iş akışları konusunu biraz daha açar mısın?',
      tokens: 15,
      createdAt: new Date('2026-05-09T10:02:00Z'),
    },
    {
      messageId: 'msg-04',
      sessionId: 'sess-01',
      role: 'ASSISTANT',
      content:
        'Otonom iş akışları, yapay zekâ modellerinin karmaşık görevleri alt görevlere ayırmasına, bunları özel araçlara veya alt ajanlara devretmesine ve sonuçları bağımsız biçimde sentezlemesine olanak tanır. Tek bir soru-cevap döngüsü yerine kullanıcı bir hedef tanımlar; sistem planlama, yürütme ve iyileştirme adımlarını kendi başına tamamlar. Bu yaklaşım, her aşamada insan müdahalesi gerekmeksizin gerçekleştirilebileceklerin sınırını önemli ölçüde genişletir.',
      tokens: 92,
      createdAt: new Date('2026-05-09T10:02:10Z'),
    },
  ],
  'sess-02': [
    {
      messageId: 'msg-05',
      sessionId: 'sess-02',
      role: 'USER',
      content: 'Bu araştırma makalesi özetini üç madde hâlinde özetler misin?',
      tokens: 16,
      createdAt: new Date('2026-05-08T14:31:00Z'),
    },
    {
      messageId: 'msg-06',
      sessionId: 'sess-02',
      role: 'ASSISTANT',
      content:
        '• Çalışma, yedi büyük dil modelini çok adımlı akıl yürütme görevlerinde kıyaslıyor.\n• Anayasal YZ ince ayarı, performansı düşürmeksizin zararlı çıktıları tutarlı biçimde azaltıyor.\n• Erişim destekli üretim (RAG), kapalı alan sorularında gerçeklik doğruluğunu %34 oranında artırıyor.',
      tokens: 68,
      createdAt: new Date('2026-05-08T14:31:08Z'),
    },
  ],
  'sess-03': [
    {
      messageId: 'msg-07',
      sessionId: 'sess-03',
      role: 'USER',
      content: 'Bu TypeScript fonksiyonunu olası null dereference sorunları açısından inceleyebilir misin?',
      tokens: 19,
      createdAt: new Date('2026-05-07T09:21:00Z'),
    },
    {
      messageId: 'msg-08',
      sessionId: 'sess-03',
      role: 'ASSISTANT',
      content:
        'İki potansiyel null dereference noktası görüyorum:\n\n1. `user.profile.avatar` — JOIN sonuç döndürmezse `profile` undefined olabilir. Opsiyonel zincirleme ile koruma altına alın: `user.profile?.avatar`.\n\n2. `items[0].id` — dizi boş olabilir; bunun yerine `items[0]?.id ?? null` kullanın.',
      tokens: 85,
      createdAt: new Date('2026-05-07T09:21:12Z'),
    },
  ],
};

/* ─── Jobs ─── */

export const JOBS: AIJob[] = [
  {
    jobId: 'job-01',
    type: 'TEXT',
    status: 'COMPLETED',
    requestPayload: { prompt: 'Generate a product description for a wireless headphone.' },
    responsePayload: { text: 'Experience pure sound freedom with our latest wireless headphones...' },
    startedAt: new Date('2026-05-07T08:00:05Z'),
    completedAt: new Date('2026-05-07T08:00:07Z'),
    createdAt: new Date('2026-05-07T08:00:00Z'),
  },
  {
    jobId: 'job-02',
    type: 'TEXT',
    status: 'RUNNING',
    requestPayload: { prompt: 'Translate the following document to Spanish.' },
    startedAt: new Date('2026-05-08T09:14:00Z'),
    createdAt: new Date('2026-05-08T09:13:58Z'),
  },
  {
    jobId: 'job-03',
    type: 'IMAGE',
    status: 'PENDING',
    requestPayload: { prompt: 'A futuristic city skyline at dusk, digital art.' },
    createdAt: new Date('2026-05-08T09:15:00Z'),
  },
  {
    jobId: 'job-04',
    type: 'EMBEDDING',
    status: 'FAILED',
    requestPayload: { text: 'Customer review batch #1047' },
    errorMessage: 'Input token limit exceeded (8192).',
    createdAt: new Date('2026-05-07T16:00:00Z'),
  },
  {
    jobId: 'job-05',
    type: 'TEXT',
    status: 'CANCELLED',
    requestPayload: { prompt: 'Write a marketing email for the summer sale.' },
    createdAt: new Date('2026-05-06T12:00:00Z'),
  },
];

/* ─── Usages ─── */

export const USAGES: AIUsage[] = [
  {
    usageId: 'usage-01',
    userId: 'user-01',
    modelId: 'gokce-5.2',
    tokensPrompt: 512,
    tokensCompletion: 1024,
    cost: 0.01792,
    createdAt: new Date('2026-05-07T10:01:05Z'),
  },
  {
    usageId: 'usage-02',
    userId: 'user-01',
    modelId: 'gokce-5.2',
    tokensPrompt: 320,
    tokensCompletion: 640,
    cost: 0.0072,
    createdAt: new Date('2026-05-06T14:31:08Z'),
  },
  {
    usageId: 'usage-03',
    userId: 'user-02',
    modelId: 'gokce-4',
    tokensPrompt: 800,
    tokensCompletion: 1200,
    cost: 0.01540,
    createdAt: new Date('2026-05-05T09:21:12Z'),
  },
  {
    usageId: 'usage-04',
    userId: 'user-01',
    modelId: 'umay-vision',
    tokensPrompt: 50,
    tokensCompletion: 0,
    cost: 0.04,
    createdAt: new Date('2026-05-07T08:00:07Z'),
  },
  {
    usageId: 'usage-05',
    userId: 'user-03',
    modelId: 'gokce-5.2-mini',
    tokensPrompt: 1000,
    tokensCompletion: 2000,
    cost: 0.00056,
    createdAt: new Date('2026-05-04T11:00:00Z'),
  },
  {
    usageId: 'usage-06',
    userId: 'user-02',
    modelId: 'umay-embed',
    tokensPrompt: 4000,
    tokensCompletion: 0,
    cost: 0.00052,
    createdAt: new Date('2026-05-03T15:30:00Z'),
  },
];
