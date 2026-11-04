import { APP_VERSION, MAX_SCREENSHOTS_PER_TASK } from '../../shared/constants'
import {
  getLocalTimeZone,
  getTodayString,
  isValidDateString,
  isValidTimeString,
  parseNaturalDate,
  toTimeString
} from '../../shared/date'
import { aiExtractionSchema } from '../../shared/schemas'
import type {
  AiConnectionResult,
  AiExtractionError,
  AiExtractionResult,
  AiTaskExtraction
} from '../../shared/types'
import type { MediaService } from './mediaService'
import type { SettingsService } from './settingsService'

const AI_TIMEOUT_MS = 45_000

interface ChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null
      reasoning_content?: string | null
    }
    finish_reason?: string
  }>
  error?: {
    message?: string
    type?: string
  }
}

class AiRequestError extends Error {
  constructor(
    readonly code: AiExtractionError['code'],
    message: string
  ) {
    super(message)
  }
}

function buildEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  return `${trimmed}/chat/completions`
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  if (fenced) return fenced[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}

function normalizeExtraction(raw: unknown): AiTaskExtraction | null {
  const parsed = aiExtractionSchema.safeParse(raw)
  if (!parsed.success) return null
  const data = parsed.data

  const title = (data.title ?? '').trim()
  if (!title) return null

  let dueDate = typeof data.dueDate === 'string' ? data.dueDate.trim() : null
  let dueTime = typeof data.dueTime === 'string' ? data.dueTime.trim() : null

  if (dueDate && !isValidDateString(dueDate)) {
    const natural = parseNaturalDate(`${dueDate} ${dueTime ?? ''}`)
    dueDate = natural.dueDate
    dueTime = dueTime ?? natural.dueTime
  }

  if (dueTime && !isValidTimeString(dueTime)) {
    const natural = parseNaturalDate(dueTime)
    dueTime = natural.dueTime
    if (!dueDate) dueDate = natural.dueDate
  }

  if (!dueDate) {
    dueDate = null
    dueTime = null
  } else if (dueTime && !isValidTimeString(dueTime)) {
    dueTime = null
  }

  return {
    title: title.slice(0, 200),
    content: (data.content ?? '').trim().slice(0, 20_000),
    client: data.client?.trim() || null,
    dueDate,
    dueTime,
    notes: (data.notes ?? '').trim().slice(0, 10_000),
    confidence:
      typeof data.confidence === 'number' && Number.isFinite(data.confidence)
        ? Math.max(0, Math.min(1, data.confidence))
        : null
  }
}

export class AiService {
  constructor(
    private readonly settings: SettingsService,
    private readonly media: MediaService
  ) {}

  private headers(): Record<string, string> {
    const key = this.settings.getApiKey()
    if (!key) {
      throw new AiRequestError('NO_KEY', '请先在设置中配置 AI Key')
    }
    const config = this.settings.getPublic().ai
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'User-Agent': `TaskMind/${APP_VERSION}`
    }
    if (config.provider === 'opencode-go') {
      headers['x-opencode-session'] = this.settings.getSessionId()
    }
    return headers
  }

  private async request(body: Record<string, unknown>, timeoutMs = AI_TIMEOUT_MS): Promise<ChatResponse> {
    const config = this.settings.getPublic().ai
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(buildEndpoint(config.baseUrl), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal
      })

      const text = await response.text()
      let data: ChatResponse = {}
      try {
        data = text ? (JSON.parse(text) as ChatResponse) : {}
      } catch {
        data = {}
      }

      if (!response.ok) {
        const upstream = data.error?.message || text.slice(0, 500)
        if (response.status === 401 || response.status === 403) {
          throw new AiRequestError('HTTP', 'AI Key 无效或没有权限，请在设置中检查')
        }
        if (response.status === 429) {
          throw new AiRequestError('HTTP', 'AI 请求太频繁，请稍后再试')
        }
        if (response.status >= 500) {
          throw new AiRequestError('HTTP', `AI 服务暂时不可用（HTTP ${response.status}）`)
        }
        throw new AiRequestError(
          'HTTP',
          `AI 请求失败（HTTP ${response.status}）${upstream ? `：${upstream}` : ''}`
        )
      }

      return data
    } catch (error) {
      if (error instanceof AiRequestError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiRequestError('NETWORK', 'AI 请求超时，请检查网络后重试')
      }
      throw new AiRequestError(
        'NETWORK',
        `AI 请求失败：${error instanceof Error ? error.message : '网络错误'}`
      )
    } finally {
      clearTimeout(timer)
    }
  }

  async extract(imageDataUrls: string[]): Promise<AiExtractionResult> {
    const urls = imageDataUrls
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .slice(0, MAX_SCREENSHOTS_PER_TASK)
    if (urls.length === 0) {
      return {
        ok: false,
        error: { code: 'BAD_RESPONSE', message: '请先添加至少一张截图' }
      }
    }

    const imagePayloads: Array<{ base64: string; mimeType: string }> = []
    try {
      for (const imageDataUrl of urls) {
        imagePayloads.push(await this.media.prepareForAi(imageDataUrl))
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'BAD_RESPONSE',
          message: error instanceof Error ? error.message : '图片读取失败'
        }
      }
    }

    const now = new Date()
    const today = getTodayString(now)
    const nowTime = toTimeString(now)
    const timezone = getLocalTimeZone()

    const systemPrompt = [
      '你是 TaskMind 的任务提取助手。用户会给你一张或多张微信聊天截图。',
      '这些截图属于同一个任务的不同部分或上下文，请综合所有截图提取一个待办任务。',
      '只输出一个 JSON 对象，不要 Markdown 代码块，不要解释。',
      '输出字段：title、content、client、dueDate、dueTime、notes、confidence。',
      'title：不超过 30 字的任务标题；content：任务详情；client：客户或来源，无法判断填 null；',
      'dueDate：YYYY-MM-DD，无法确定填 null，不要编造；dueTime：HH:mm，无法确定填 null；',
      'notes：给用户看的提醒/备注；confidence：0 到 1 之间的小数。',
      '所有截图里的有用细节都要合并进 content 或 notes，不要遗漏，也不要重复。',
      '如果多张截图里有多件事，只提取最紧急、最明确的一件，其余细节放进 content 或 notes。',
      '如果截图不是任务，title 填空字符串。'
    ].join('\n')

    const userPrompt = [
      `当前本地日期：${today}，当前时间：${nowTime}，时区：${timezone}。`,
      `共有 ${imagePayloads.length} 张截图，请综合全部截图按上面的要求提取任务。只输出 JSON。`
    ].join('\n')

    const body = {
      model: this.settings.getPublic().ai.model,
      temperature: 0,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            ...imagePayloads.map((image) => ({
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType};base64,${image.base64}`
              }
            })),
            { type: 'text', text: userPrompt }
          ]
        }
      ]
    }

    let lastError: AiExtractionError = {
      code: 'UNKNOWN',
      message: 'AI 识别失败，请重试或手动填写'
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const data = await this.request(body)
        const content = data.choices?.[0]?.message?.content ?? ''
        if (!content.trim()) {
          lastError = {
            code: 'BAD_RESPONSE',
            message: 'AI 没有返回内容，请重试或手动填写'
          }
          continue
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(stripJsonFence(content))
        } catch {
          lastError = {
            code: 'BAD_RESPONSE',
            message: 'AI 返回的内容不是有效 JSON，请重试'
          }
          continue
        }

        const normalized = normalizeExtraction(parsed)
        if (!normalized) {
          lastError = {
            code: 'NO_TASK',
            message: '没有识别到明确的任务，请手动填写或换一张截图'
          }
          continue
        }

        return { ok: true, data: normalized }
      } catch (error) {
        if (error instanceof AiRequestError) {
          lastError = { code: error.code, message: error.message }
          if (error.code === 'NO_KEY' || (error.code === 'HTTP' && !error.message.includes('5'))) {
            break
          }
        } else {
          lastError = {
            code: 'UNKNOWN',
            message: error instanceof Error ? error.message : 'AI 识别失败'
          }
          break
        }
      }
    }

    return { ok: false, error: lastError }
  }

  async testConnection(): Promise<AiConnectionResult> {
    const start = Date.now()
    try {
      const config = this.settings.getPublic().ai
      const data = await this.request(
        {
          model: config.model,
          temperature: 0,
          max_tokens: 32,
          messages: [{ role: 'user', content: '只回复两个字：可用' }]
        },
        20_000
      )
      const content = data.choices?.[0]?.message?.content ?? ''
      const latencyMs = Date.now() - start
      if (!content.trim()) {
        return { ok: false, message: '连接成功但没有返回内容', latencyMs }
      }
      return {
        ok: true,
        message: `连接成功，模型 ${config.model}`,
        latencyMs
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '连接失败',
        latencyMs: Date.now() - start
      }
    }
  }
}
