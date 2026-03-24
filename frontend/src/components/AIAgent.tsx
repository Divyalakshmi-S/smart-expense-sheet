import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Bot, User, Zap, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { agentApi } from '../services/api'
import type { ChatMessage } from '../types'
import clsx from 'clsx'

const SUGGESTIONS = [
  '📊 Give me a complete financial health check',
  '💡 Where can I save the most money?',
  '📅 What bills are due this month?',
  '📈 How are my investments growing?',
  '⚠️ Any unusual or risky expenses?',
  '🔮 Predict my next month expenses',
  '🏦 Compare my income vs expenses',
  '💰 What is my savings rate?',
]

function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-1">
      <div className="w-2 h-2 bg-brand-400 rounded-full dot-1" />
      <div className="w-2 h-2 bg-brand-400 rounded-full dot-2" />
      <div className="w-2 h-2 bg-brand-400 rounded-full dot-3" />
    </div>
  )
}

function AgentSteps({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false)
  if (!steps.length) return null
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
        <Zap className="w-3 h-3" />
        Agent reasoning ({steps.length} steps)
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {steps.map((s, i) => (
            <div key={i} className="text-xs font-mono bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface MessageBubble extends ChatMessage {
  steps?: string[]
  sources?: string[]
}

export default function AIAgent() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<MessageBubble[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your Smart Expense Analyser AI 🤖\n\nI can analyse your expenses, predict future spending, find savings opportunities, review your investments, and answer any financial questions about your data.\n\nWhat would you like to know?",
    },
  ])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: tools } = useQuery({ queryKey: ['tools'], queryFn: agentApi.tools })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: MessageBubble = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await agentApi.chat(text)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          steps: res.agent_steps,
          sources: res.sources,
        },
      ])
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Could not reach the backend. Make sure the server is running.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-[500px]">
      {/* Tools sidebar row */}
      {tools && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {(tools as { name: string; description: string }[]).map(t => (
            <div key={t.name} className="shrink-0 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-1.5">
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 capitalize">{t.name}</p>
              <p className="text-xs text-slate-500 hidden sm:block">{t.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={clsx('flex gap-3 chat-bubble', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
            {/* Avatar */}
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
              msg.role === 'user'
                ? 'bg-brand-600 text-white'
                : 'bg-gradient-to-br from-violet-500 to-brand-600 text-white'
            )}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div className={clsx(
              'max-w-[82%] rounded-2xl px-4 py-3',
              msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-tr-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-sm'
            )}>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</pre>
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-2">
                  {msg.sources.map(s => (
                    <span key={s} className="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full capitalize">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {msg.steps && <AgentSteps steps={msg.steps} />}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 chat-bubble">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-brand-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div className="flex gap-2 overflow-x-auto py-3 border-t border-slate-200 dark:border-slate-700">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => sendMessage(s)}
            disabled={loading}
            className="shrink-0 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-1">
        <input
          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Ask anything about your expenses..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          disabled={loading}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="btn-primary disabled:opacity-50 flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  )
}
