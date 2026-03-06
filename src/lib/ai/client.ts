/**
 * Reusable AI Client Module
 *
 * Central entry point for all Anthropic Claude API interactions.
 * Provides structured response generation with:
 * - JSON extraction from mixed-format responses
 * - Zod runtime validation
 * - Automatic retry with error feedback
 * - Consistent ActionResult<T> return pattern
 * - Full logging of prompts + raw responses for debugging
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ZodType, ZodError } from 'zod'
import type { ActionResult } from '@/lib/types/training.types'

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_MAX_RETRIES = 2

// Singleton client — reused across all server action calls
let _client: Anthropic | null = null

function getClient(): Anthropic {
    if (!_client) {
        _client = new Anthropic()
    }
    return _client
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StructuredResponseOptions<T> {
    /** System prompt defining the AI's role and response format */
    systemPrompt: string
    /** User prompt with the specific request / data payload */
    userPrompt: string
    /** Zod schema for runtime validation of the parsed response */
    schema: ZodType<T>
    /** Max retry attempts on parse/validation failure (default: 2) */
    maxRetries?: number
    /** Max tokens for response (default: 4096) */
    maxTokens?: number
    /** Model override (default: claude-sonnet-4-5-20250929) */
    model?: string
    /** Temperature override (default: undefined = API default) */
    temperature?: number
}

export interface AICallMetadata {
    model: string
    inputPayload: { system: string; user: string }
    rawResponse: string
    attempts: number
    durationMs: number
}

export type StructuredResult<T> = ActionResult<T> & {
    metadata?: AICallMetadata
}

// ─── JSON Extraction ─────────────────────────────────────────────────────────

/**
 * Extracts JSON from a Claude response that may contain markdown fences,
 * preamble text, or other wrapper content.
 *
 * Handles:
 * - ```json ... ``` fenced blocks
 * - ``` ... ``` fenced blocks without language tag
 * - Raw JSON objects { ... }
 * - Raw JSON arrays [ ... ]
 */
export function extractJSON(raw: string): string {
    // Try markdown code fence first (with or without language tag)
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    if (fenceMatch?.[1]) {
        return fenceMatch[1].trim()
    }

    // Try to find a top-level JSON object
    const objectMatch = raw.match(/(\{[\s\S]*\})/)
    if (objectMatch?.[1]) {
        return objectMatch[1].trim()
    }

    // Try to find a top-level JSON array
    const arrayMatch = raw.match(/(\[[\s\S]*\])/)
    if (arrayMatch?.[1]) {
        return arrayMatch[1].trim()
    }

    // Return trimmed raw as last resort
    return raw.trim()
}

/**
 * Formats Zod validation errors into a human-readable string
 * that can be fed back to Claude in a retry prompt.
 */
function formatZodErrors(error: ZodError): string {
    return error.issues
        .map((issue) => {
            const path = issue.path.length > 0 ? `at "${issue.path.join('.')}"` : 'at root'
            return `- ${path}: ${issue.message}`
        })
        .join('\n')
}

// ─── Core Function ───────────────────────────────────────────────────────────

/**
 * Generate a structured, validated response from Claude.
 *
 * This is the single entry point all AI features should use.
 * It handles the full lifecycle:
 * 1. Send prompt to Claude
 * 2. Extract JSON from response
 * 3. Validate against Zod schema
 * 4. Retry with error feedback if validation fails
 * 5. Return typed ActionResult<T>
 *
 * @example
 * ```ts
 * const result = await generateStructuredResponse({
 *   systemPrompt: COACH_SYSTEM_PROMPT,
 *   userPrompt: buildCoachUserPrompt(payload),
 *   schema: CoachResponseSchema,
 * })
 *
 * if (result.success) {
 *   // result.data is fully typed and validated
 *   console.log(result.data.triggerType)
 * }
 * ```
 */
export async function generateStructuredResponse<T>(
    options: StructuredResponseOptions<T>
): Promise<StructuredResult<T>> {
    const {
        systemPrompt,
        userPrompt,
        schema,
        maxRetries = DEFAULT_MAX_RETRIES,
        maxTokens = DEFAULT_MAX_TOKENS,
        model = DEFAULT_MODEL,
        temperature,
    } = options

    const client = getClient()
    const startTime = Date.now()
    let lastRawResponse = ''
    let lastError = ''

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        // Build the user message — on retries, include the error feedback
        let currentUserPrompt = userPrompt
        if (attempt > 1 && lastError) {
            currentUserPrompt = `${userPrompt}

IMPORTANT: Your previous response was invalid. The following validation errors occurred:
${lastError}

Previous (invalid) response:
${lastRawResponse.slice(0, 1000)}

Please fix these issues and respond with ONLY valid JSON matching the required schema. No markdown fences, no explanation text — just the JSON object.`
        }

        try {
            // Call Anthropic API
            const message = await client.messages.create({
                model,
                max_tokens: maxTokens,
                ...(temperature !== undefined ? { temperature } : {}),
                system: systemPrompt,
                messages: [{ role: 'user', content: currentUserPrompt }],
            })

            // Extract text content
            const textBlock = message.content.find((b) => b.type === 'text')
            lastRawResponse = textBlock?.text ?? ''

            if (!lastRawResponse) {
                lastError = 'Empty response from AI — no text content returned.'
                console.warn(`[ai/client] Attempt ${attempt}: Empty response`)
                continue
            }

            // Extract and parse JSON
            const jsonStr = extractJSON(lastRawResponse)
            let parsed: unknown
            try {
                parsed = JSON.parse(jsonStr)
            } catch (parseErr) {
                lastError = `JSON parse error: ${parseErr instanceof Error ? parseErr.message : 'Invalid JSON'}. Extracted text was: "${jsonStr.slice(0, 200)}"`
                console.warn(`[ai/client] Attempt ${attempt}: JSON parse failed`)
                continue
            }

            // Validate against Zod schema
            const validation = schema.safeParse(parsed)
            if (!validation.success) {
                lastError = formatZodErrors(validation.error)
                console.warn(
                    `[ai/client] Attempt ${attempt}: Schema validation failed:\n${lastError}`
                )
                continue
            }

            // Success
            const durationMs = Date.now() - startTime
            return {
                success: true,
                data: validation.data,
                metadata: {
                    model,
                    inputPayload: { system: systemPrompt, user: userPrompt },
                    rawResponse: lastRawResponse,
                    attempts: attempt,
                    durationMs,
                },
            }
        } catch (apiErr) {
            const errMsg =
                apiErr instanceof Error ? apiErr.message : 'Unknown API error'
            console.error(`[ai/client] Attempt ${attempt}: API error:`, errMsg)

            // Don't retry on API errors (rate limits, auth failures, etc.)
            // These won't be fixed by retrying with a different prompt
            return {
                success: false,
                error: `AI API call failed: ${errMsg}`,
                metadata: {
                    model,
                    inputPayload: { system: systemPrompt, user: userPrompt },
                    rawResponse: lastRawResponse,
                    attempts: attempt,
                    durationMs: Date.now() - startTime,
                },
            }
        }
    }

    // All retries exhausted
    const durationMs = Date.now() - startTime
    console.error(
        `[ai/client] All ${maxRetries + 1} attempts failed. Last error: ${lastError}`
    )
    return {
        success: false,
        error: `AI response failed validation after ${maxRetries + 1} attempts. Last error: ${lastError}`,
        metadata: {
            model,
            inputPayload: { system: systemPrompt, user: userPrompt },
            rawResponse: lastRawResponse,
            attempts: maxRetries + 1,
            durationMs,
        },
    }
}
