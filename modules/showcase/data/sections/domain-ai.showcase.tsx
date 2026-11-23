'use client';
import type { ShowcaseComponent } from '../showcase.types';
import { ModelProviderBadge } from '@/modules/domains/ai/model/ModelProviderBadge';
import { ModelTypeBadge } from '@/modules/domains/ai/model/ModelTypeBadge';
import { ModelCard } from '@/modules/domains/ai/model/ModelCard';
import { AIJobStatusBadge } from '@/modules/domains/ai/job/AIJobStatusBadge';
import { ChatMessage } from '@/modules/domains/ai/chat/ChatMessage';
import { UsageStatsCard } from '@/modules/domains/ai/usage/UsageStatsCard';
import { ModelComparisonTable, type ModelComparisonRow } from '@/modules/domains/ai/compare/ModelComparisonTable';
import { FeatureCheckCell } from '@/modules/domains/ai/compare/FeatureCheckCell';
import { ModelScoreSparkline } from '@/modules/domains/ai/compare/ModelScoreSparkline';
import type { AIModel, AIChatMessage, AIUsage } from '@/modules/domains/ai/types';
import { useState } from 'react';
import { ChatbotReportView } from '@/modules/domains/ai/report/ChatbotReportView';
import { ChatbotOutcomeBadge } from '@/modules/domains/ai/report/ChatbotOutcomeBadge';
import { ChatbotQuestionsTable, COULD_NOT_ANSWER_FILTER } from '@/modules/domains/ai/report/ChatbotQuestionsTable';
import { ForumHelpBotCard } from '@/modules/domains/ai/report/ForumHelpBotCard';
import { demoChatbotReport } from '@/modules/domains/ai/report/demo';
import { CHATBOT_OUTCOMES } from '@/modules/domains/ai/report/types';

/** The report with its period picker wired to the demo (7, 30 or 90 days). */
function ChatbotReportDemo() {
  const [days, setDays] = useState(30);
  return <ChatbotReportView report={demoChatbotReport({ days })} locale="en-US" siteUrl="https://example.com" rangeOptions={[7, 30, 90]} onRangeChange={setDays} />;
}

/* ─── demo data ─── */

const DEMO_MODEL_TEXT: AIModel = {
  modelId: 'gpt-4o',
  provider: 'OPENAI',
  name: 'GPT-4o',
  type: 'TEXT',
  contextWindow: 128000,
  maxOutputTokens: 4096,
  pricingPromptPer1k: 0.005,
  pricingCompletionPer1k: 0.015,
  active: true,
  createdAt: new Date('2024-05-13'),
};

const DEMO_MODEL_IMAGE: AIModel = {
  modelId: 'dall-e-3',
  provider: 'OPENAI',
  name: 'DALL-E 3',
  type: 'IMAGE',
  contextWindow: null,
  maxOutputTokens: null,
  pricingPromptPer1k: 0.04,
  pricingCompletionPer1k: null,
  active: false,
  createdAt: new Date('2023-10-03'),
};

const DEMO_USER_MESSAGE: AIChatMessage = {
  messageId: 'msg-demo-1',
  sessionId: 'sess-demo',
  role: 'USER',
  content: 'Write a short intro paragraph about AI trends in 2026.',
  tokens: 18,
  createdAt: new Date(),
};

const DEMO_ASSISTANT_MESSAGE: AIChatMessage = {
  messageId: 'msg-demo-2',
  sessionId: 'sess-demo',
  role: 'ASSISTANT',
  content:
    'Artificial intelligence in 2026 is defined by three major shifts: democratisation of frontier models, agentic workflows, and multimodal reasoning as a standard capability.',
  tokens: 42,
  createdAt: new Date(),
};

const DEMO_USAGE: AIUsage = {
  usageId: 'usage-demo',
  userId: 'user-01',
  modelId: 'gpt-4o',
  tokensPrompt: 512,
  tokensCompletion: 1024,
  cost: 0.01792,
  createdAt: new Date(),
};

const DEMO_USAGE_CHEAP: AIUsage = {
  usageId: 'usage-demo-2',
  userId: 'user-01',
  modelId: 'deepseek-chat',
  tokensPrompt: 1000,
  tokensCompletion: 2000,
  cost: 0.00056,
  createdAt: new Date(),
};

const DEMO_COMPARE_ROWS: ModelComparisonRow[] = [
  {
    model: DEMO_MODEL_TEXT,
    benchmarkScores: [62, 68, 71, 78, 81, 84, 86, 88],
    headlineScore: 88,
    features: { vision: 'yes', tools: 'yes', json: 'yes', streaming: 'yes' },
  },
  {
    model: {
      modelId: 'claude-3.7',
      provider: 'ANTHROPIC',
      name: 'Claude 3.7 Sonnet',
      type: 'TEXT',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      pricingPromptPer1k: 0.003,
      pricingCompletionPer1k: 0.015,
      active: true,
    } as AIModel,
    benchmarkScores: [60, 66, 70, 74, 77, 80, 85, 89],
    headlineScore: 89,
    features: { vision: 'yes', tools: 'yes', json: 'yes', streaming: 'yes' },
  },
  {
    model: {
      modelId: 'gemini-2.0',
      provider: 'GOOGLE',
      name: 'Gemini 2.0 Pro',
      type: 'TEXT',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      pricingPromptPer1k: 0.00125,
      pricingCompletionPer1k: 0.005,
      active: true,
    } as AIModel,
    benchmarkScores: [55, 62, 65, 71, 75, 78, 82, 85],
    headlineScore: 85,
    features: { vision: 'yes', tools: 'partial', json: 'yes', streaming: 'yes' },
  },
];

/* ─── builder ─── */

export function buildAIDomainData(): ShowcaseComponent[] {
  return [
    {
      id: 'ai-model-provider-badge',
      title: 'ModelProviderBadge',
      category: 'Domain',
      abbr: 'MP',
      description: 'Colour-coded badge that maps an AI provider name to a semantic variant.',
      filePath: 'modules/domains/ai/model/ModelProviderBadge.tsx',
      sourceCode: `import { ModelProviderBadge } from '@/modules/domains/ai/model/ModelProviderBadge';
<ModelProviderBadge provider="ANTHROPIC" />`,
      variants: [
        {
          title: 'All providers',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['OPENAI', 'ANTHROPIC', 'GOOGLE', 'XAI', 'DEEPSEEK', 'AZURE_OPENAI', 'CUSTOM'] as const).map((p) => (
                <ModelProviderBadge key={p} provider={p} />
              ))}
            </div>
          ),
          code: `{(['OPENAI', 'ANTHROPIC', 'GOOGLE', 'XAI', 'DEEPSEEK', 'AZURE_OPENAI', 'CUSTOM'] as const).map((p) => (
  <ModelProviderBadge key={p} provider={p} />
))}`,
        },
        {
          title: 'Small size',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['OPENAI', 'ANTHROPIC', 'GOOGLE'] as const).map((p) => (
                <ModelProviderBadge key={p} provider={p} size="sm" />
              ))}
            </div>
          ),
          code: `<ModelProviderBadge provider="OPENAI" size="sm" />`,
        },
      ],
    },
    {
      id: 'ai-model-type-badge',
      title: 'ModelTypeBadge',
      category: 'Domain',
      abbr: 'MT',
      description: 'Badge indicating the modality of an AI model (Text, Image, Embedding, etc.).',
      filePath: 'modules/domains/ai/model/ModelTypeBadge.tsx',
      sourceCode: `import { ModelTypeBadge } from '@/modules/domains/ai/model/ModelTypeBadge';
<ModelTypeBadge type="TEXT" />`,
      variants: [
        {
          title: 'All types',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['TEXT', 'IMAGE', 'EMBEDDING', 'AUDIO', 'VIDEO'] as const).map((t) => (
                <ModelTypeBadge key={t} type={t} />
              ))}
            </div>
          ),
          code: `{(['TEXT', 'IMAGE', 'EMBEDDING', 'AUDIO', 'VIDEO'] as const).map((t) => (
  <ModelTypeBadge key={t} type={t} />
))}`,
        },
        {
          title: 'Small size',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['TEXT', 'IMAGE', 'EMBEDDING'] as const).map((t) => (
                <ModelTypeBadge key={t} type={t} size="sm" />
              ))}
            </div>
          ),
          code: `<ModelTypeBadge type="TEXT" size="sm" />`,
        },
      ],
    },
    {
      id: 'ai-model-card',
      title: 'ModelCard',
      category: 'Domain',
      abbr: 'MC',
      description: 'Card summarising an AI model with provider, type badges, context window, and pricing.',
      filePath: 'modules/domains/ai/model/ModelCard.tsx',
      sourceCode: `import { ModelCard } from '@/modules/domains/ai/model/ModelCard';
<ModelCard model={model} href="/models/gpt-4o" />`,
      variants: [
        {
          title: 'Active text model with link',
          preview: (
            <div className="max-w-sm">
              <ModelCard model={DEMO_MODEL_TEXT} href="#" />
            </div>
          ),
          code: `<ModelCard model={model} href="/models/gpt-4o" />`,
        },
        {
          title: 'Inactive image model',
          preview: (
            <div className="max-w-sm">
              <ModelCard model={DEMO_MODEL_IMAGE} />
            </div>
          ),
          code: `<ModelCard model={model} />`,
        },
      ],
    },
    {
      id: 'ai-job-status-badge',
      title: 'AIJobStatusBadge',
      category: 'Domain',
      abbr: 'AJ',
      description: 'Dot + label badge tracking the lifecycle of an async AI job.',
      filePath: 'modules/domains/ai/job/AIJobStatusBadge.tsx',
      sourceCode: `import { AIJobStatusBadge } from '@/modules/domains/ai/job/AIJobStatusBadge';
<AIJobStatusBadge status="RUNNING" />`,
      variants: [
        {
          title: 'All statuses',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const).map((s) => (
                <AIJobStatusBadge key={s} status={s} />
              ))}
            </div>
          ),
          code: `{(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const).map((s) => (
  <AIJobStatusBadge key={s} status={s} />
))}`,
        },
        {
          title: 'Small size',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const).map((s) => (
                <AIJobStatusBadge key={s} status={s} size="sm" />
              ))}
            </div>
          ),
          code: `<AIJobStatusBadge status="COMPLETED" size="sm" />`,
        },
      ],
    },
    {
      id: 'ai-chat-message',
      title: 'ChatMessage',
      category: 'Domain',
      abbr: 'CM',
      description: 'Chat bubble for AI conversations — USER bubbles are right-aligned (primary bg), ASSISTANT bubbles are left-aligned (surface-raised).',
      filePath: 'modules/domains/ai/chat/ChatMessage.tsx',
      sourceCode: `import { ChatMessage } from '@/modules/domains/ai/chat/ChatMessage';
<ChatMessage message={message} />`,
      variants: [
        {
          title: 'User message',
          layout: 'stack',
          preview: (
            <div className="max-w-lg w-full">
              <ChatMessage message={DEMO_USER_MESSAGE} />
            </div>
          ),
          code: `<ChatMessage message={{ role: 'USER', content: '...' }} />`,
        },
        {
          title: 'Assistant message',
          layout: 'stack',
          preview: (
            <div className="max-w-lg w-full">
              <ChatMessage message={DEMO_ASSISTANT_MESSAGE} />
            </div>
          ),
          code: `<ChatMessage message={{ role: 'ASSISTANT', content: '...' }} />`,
        },
      ],
    },
    {
      id: 'ai-feature-check-cell',
      title: 'FeatureCheckCell',
      category: 'Domain',
      abbr: 'FK',
      description: 'Pill-style indicator for feature-support cells in comparison tables (yes/no/partial/preview).',
      filePath: 'modules/domains/ai/compare/FeatureCheckCell.tsx',
      sourceCode: `import { FeatureCheckCell } from '@/modules/domains/ai/compare/FeatureCheckCell';
<FeatureCheckCell value="yes" />`,
      variants: [
        {
          title: 'All states',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              <FeatureCheckCell value="yes" />
              <FeatureCheckCell value="no" />
              <FeatureCheckCell value="partial" />
              <FeatureCheckCell value="preview" />
            </div>
          ),
          code: `<FeatureCheckCell value="yes" />
<FeatureCheckCell value="no" />
<FeatureCheckCell value="partial" />
<FeatureCheckCell value="preview" />`,
        },
        {
          title: 'Custom labels',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              <FeatureCheckCell value="yes" label="Supported" />
              <FeatureCheckCell value="partial" label="Limited" />
            </div>
          ),
          code: `<FeatureCheckCell value="yes" label="Supported" />`,
        },
      ],
    },
    {
      id: 'ai-model-score-sparkline',
      title: 'ModelScoreSparkline',
      category: 'Domain',
      abbr: 'SS',
      description: 'Compact inline sparkline for AI model benchmark scores over time.',
      filePath: 'modules/domains/ai/compare/ModelScoreSparkline.tsx',
      sourceCode: `import { ModelScoreSparkline } from '@/modules/domains/ai/compare/ModelScoreSparkline';
<ModelScoreSparkline scores={[62, 68, 71, 78, 81, 84, 86, 88]} />`,
      variants: [
        {
          title: 'Upward trend',
          layout: 'stack',
          preview: <ModelScoreSparkline scores={[62, 68, 71, 78, 81, 84, 86, 88]} label="MMLU" />,
          code: `<ModelScoreSparkline scores={[62, 68, 71, 78, 81, 84, 86, 88]} label="MMLU" />`,
        },
        {
          title: 'Wider canvas',
          layout: 'stack',
          preview: (
            <ModelScoreSparkline
              scores={[40, 45, 48, 60, 65, 70, 73, 78, 81, 85]}
              width={220}
              height={48}
              label="GSM8K"
            />
          ),
          code: `<ModelScoreSparkline scores={[…]} width={220} height={48} label="GSM8K" />`,
        },
      ],
    },
    {
      id: 'ai-model-comparison-table',
      title: 'ModelComparisonTable',
      category: 'Domain',
      abbr: 'MX',
      description: 'Side-by-side table comparing AI models across price, context, benchmarks, and feature support.',
      filePath: 'modules/domains/ai/compare/ModelComparisonTable.tsx',
      sourceCode: `import { ModelComparisonTable } from '@/modules/domains/ai/compare/ModelComparisonTable';
<ModelComparisonTable rows={rows} featureKeys={featureKeys} />`,
      variants: [
        {
          title: 'Three models compared',
          layout: 'stack',
          preview: (
            <div className="max-w-5xl w-full overflow-x-auto">
              <ModelComparisonTable
                rows={DEMO_COMPARE_ROWS}
                featureKeys={[
                  { key: 'vision', label: 'Vision' },
                  { key: 'tools', label: 'Tools' },
                  { key: 'json', label: 'JSON' },
                  { key: 'streaming', label: 'Stream' },
                ]}
              />
            </div>
          ),
          code: `<ModelComparisonTable rows={rows} featureKeys={featureKeys} />`,
        },
        {
          title: 'Two models only',
          layout: 'stack',
          preview: (
            <div className="max-w-3xl w-full overflow-x-auto">
              <ModelComparisonTable
                rows={DEMO_COMPARE_ROWS.slice(0, 2)}
                featureKeys={[
                  { key: 'vision', label: 'Vision' },
                  { key: 'tools', label: 'Tools' },
                ]}
              />
            </div>
          ),
          code: `<ModelComparisonTable rows={rows.slice(0, 2)} featureKeys={featureKeys} />`,
        },
      ],
    },
    {
      id: 'ai-usage-stats-card',
      title: 'UsageStatsCard',
      category: 'Domain',
      abbr: 'US',
      description: 'Card displaying prompt tokens, completion tokens, and cost for a single AI usage record.',
      filePath: 'modules/domains/ai/usage/UsageStatsCard.tsx',
      sourceCode: `import { UsageStatsCard } from '@/modules/domains/ai/usage/UsageStatsCard';
<UsageStatsCard usage={usage} />`,
      variants: [
        {
          title: 'GPT-4o usage',
          layout: 'stack',
          preview: (
            <div className="max-w-xl w-full">
              <UsageStatsCard usage={DEMO_USAGE} />
            </div>
          ),
          code: `<UsageStatsCard usage={usage} />`,
        },
        {
          title: 'Low-cost model',
          layout: 'stack',
          preview: (
            <div className="max-w-xl w-full">
              <UsageStatsCard usage={DEMO_USAGE_CHEAP} />
            </div>
          ),
          code: `<UsageStatsCard usage={cheapUsage} />`,
        },
      ],
    },
    {
      id: 'ai-chatbot-report-view',
      title: 'ChatbotReportView',
      category: 'Domain',
      abbr: 'CQ',
      description:
        'How a site\'s AI chat assistant is used and what it could and could not answer: KPIs against the previous period (conversations, questions, answered from pages, handed on, could not answer, declined or held back, errors, estimated cost), how questions ended, questions per day in three groups, languages, the pages chats start on, what the assistant searched for, the questions it could not answer, every stored question (kept 30 days) and the forum help bot.',
      filePath: 'modules/domains/ai/report/ChatbotReportView.tsx',
      sourceCode: `import { ChatbotReportView } from '@/modules/domains/ai';
<ChatbotReportView report={report} locale="en-US" siteUrl="https://example.com" rangeOptions={[7, 30, 90]} onRangeChange={setDays} />`,
      variants: [
        {
          title: '30 days with the period picker, the questions and the forum help bot',
          layout: 'stack',
          preview: <ChatbotReportDemo />,
          code: `<ChatbotReportView report={report} locale="en-US" siteUrl="https://example.com" rangeOptions={[7, 30, 90]} onRangeChange={setDays} />`,
        },
        {
          title: '90 days (lists cover the 30 days questions are kept), forum bot off, translated words',
          layout: 'stack',
          preview: (
            <ChatbotReportView
              report={demoChatbotReport({ days: 90, forumBot: 'off', questionCap: 25 })}
              locale="de-DE"
              messages={{ title: 'KI-Chat-Bericht', conversations: 'Gespräche', questions: 'Fragen' }}
            />
          ),
          code: `<ChatbotReportView report={report} locale="de-DE" messages={{ title: 'KI-Chat-Bericht' }} />`,
        },
        {
          title: 'Nobody has asked yet',
          layout: 'stack',
          preview: <ChatbotReportView report={demoChatbotReport({ days: 7, empty: true, forumBot: 'none' })} locale="en-US" />,
          code: `<ChatbotReportView report={emptyReport} />`,
        },
      ],
    },
    {
      id: 'ai-chatbot-outcome-badge',
      title: 'ChatbotOutcomeBadge',
      category: 'Domain',
      abbr: 'QO',
      description: 'What one AI chat question ended in (answered with or without sources, sent to the forum, offered a quote, pointed to the team, could not answer, declined, held back, error), as an icon and words; status colours only where the outcome is a status.',
      filePath: 'modules/domains/ai/report/ChatbotOutcomeBadge.tsx',
      sourceCode: `<ChatbotOutcomeBadge outcome="forum" />`,
      variants: [
        {
          title: 'Every outcome',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {CHATBOT_OUTCOMES.map((o) => <ChatbotOutcomeBadge key={o} outcome={o} />)}
            </div>
          ),
          code: `{CHATBOT_OUTCOMES.map((o) => <ChatbotOutcomeBadge key={o} outcome={o} />)}`,
        },
        {
          title: 'Small, translated',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              <ChatbotOutcomeBadge outcome="sourced" size="sm" label="Mit Quellen beantwortet" />
              <ChatbotOutcomeBadge outcome="unanswered" size="sm" label="Keine Antwort gefunden" />
              <ChatbotOutcomeBadge outcome="error" size="sm" label="Fehler" />
            </div>
          ),
          code: `<ChatbotOutcomeBadge outcome="unanswered" size="sm" label="Keine Antwort gefunden" />`,
        },
      ],
    },
    {
      id: 'ai-chatbot-questions-table',
      title: 'ChatbotQuestionsTable',
      category: 'Domain',
      abbr: 'QL',
      description: 'The visitors\' questions to the AI chat, newest first: searchable, filtered by outcome or "could not answer", 10 a page; a row opens to the sources shown, what the assistant searched for, the page, conversation, model, tokens and cost.',
      filePath: 'modules/domains/ai/report/ChatbotQuestionsTable.tsx',
      sourceCode: `<ChatbotQuestionsTable questions={report.questions} locale="en-US" siteUrl="https://example.com" />`,
      variants: [
        {
          title: 'All questions',
          layout: 'stack',
          preview: <ChatbotQuestionsTable questions={demoChatbotReport().questions} locale="en-US" siteUrl="https://example.com" />,
          code: `<ChatbotQuestionsTable questions={questions} locale="en-US" siteUrl="https://example.com" />`,
        },
        {
          title: 'Filtered to the questions it could not answer, 5 a page',
          layout: 'stack',
          preview: <ChatbotQuestionsTable questions={demoChatbotReport().questions} locale="en-US" defaultOutcome={COULD_NOT_ANSWER_FILTER} pageSize={5} />,
          code: `<ChatbotQuestionsTable questions={questions} defaultOutcome={COULD_NOT_ANSWER_FILTER} pageSize={5} />`,
        },
      ],
    },
    {
      id: 'ai-forum-help-bot-card',
      title: 'ForumHelpBotCard',
      category: 'Domain',
      abbr: 'HB',
      description: 'The forum help bot in a period: topics it looked at and what it did with each (answered, no sources, not answerable, stopped, errors, skipped, waiting) against the previous period, replies accepted as the solution, and the latest topics with their status.',
      filePath: 'modules/domains/ai/report/ForumHelpBotCard.tsx',
      sourceCode: `<ForumHelpBotCard report={report.forumBot} locale="en-US" />`,
      variants: [
        {
          title: 'On',
          layout: 'stack',
          preview: <ForumHelpBotCard report={demoChatbotReport().forumBot!} locale="en-US" />,
          code: `<ForumHelpBotCard report={forumBot} locale="en-US" />`,
        },
        {
          title: 'Switched off (earlier topics still counted), 7 days',
          layout: 'stack',
          preview: <ForumHelpBotCard report={demoChatbotReport({ days: 7, forumBot: 'off' }).forumBot!} locale="en-US" />,
          code: `<ForumHelpBotCard report={forumBot} />`,
        },
      ],
    },
  ];
}
