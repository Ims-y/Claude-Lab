import Anthropic from "@anthropic-ai/sdk";
import type { ComplexityResult, SummaryOptions, SummaryResult } from "../types/index.js";
import { analyze } from "./構造分析器.js";
import type { TemplateData } from "./templates.js";
import { computeMetrics, compositeScore } from "./採点ロジック.js";
import { resolveTemplate, resolveMaxTokens } from "./template-resolver.js";
import { BASE_SYSTEM_PROMPT, buildUserPrompt } from "./prompt-builder.js";

const MODEL = "claude-opus-4-7";

export async function summarize(
  text: string,
  complexity: ComplexityResult,
  opts: SummaryOptions = {},
  onDelta?: (chunk: string) => void,
): Promise<SummaryResult> {
  const client = new Anthropic();
  const analysis = analyze({ text });
  const template = resolveTemplate(opts, complexity, analysis);
  const userPrompt = buildUserPrompt(analysis, opts, template, complexity);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: resolveMaxTokens(complexity),
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: BASE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  let raw = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      raw += event.delta.text;
      onDelta?.(event.delta.text);
    }
  }

  const final = await stream.finalMessage();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Model did not return valid JSON. Raw response:\n${raw}`);
  }
  const data = JSON.parse(jsonMatch[0]) as TemplateData;
  const rendered = template.render(data);
  const metrics = computeMetrics(template, data);

  return {
    rendered,
    cognitiveScore: compositeScore(metrics),
    metrics,
    rawJson: jsonMatch[0],
    model: final.model,
    inputTokens: final.usage.input_tokens,
    outputTokens: final.usage.output_tokens,
    cachedTokens: final.usage.cache_read_input_tokens ?? 0,
  };
}
