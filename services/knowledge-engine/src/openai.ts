import OpenAI from "openai";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import type { ExtractedEntity } from "./types.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: getConfig().OPENAI_API_KEY });
  }
  return client;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const config = getConfig();
  const response = await getClient().embeddings.create({
    model: config.EMBEDDING_MODEL,
    input: text,
    dimensions: config.EMBEDDING_DIMENSIONS,
  });
  return response.data[0].embedding;
}

export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  const config = getConfig();
  const response = await getClient().embeddings.create({
    model: config.EMBEDDING_MODEL,
    input: texts,
    dimensions: config.EMBEDDING_DIMENSIONS,
  });
  return response.data.map((d) => d.embedding);
}

const EXTRACTION_SYSTEM_PROMPT = `You are an entity extractor for a team communication platform.
Extract named entities from the given text. Be precise and only extract clearly mentioned entities.

Entity types:
- Person: team members, contributors (use display names, not @mentions)
- Topic: discussion subjects, project names, features
- Technology: programming languages, frameworks, tools, services
- Component: system components, modules, APIs, databases
- Decision: explicit decisions made ("we decided to...", "let's go with...")

Rules:
- Normalize names: "React.js" -> "React", "k8s" -> "Kubernetes"
- Skip generic terms: "the app", "the team", "the issue"
- Maximum 10 entities per extraction
- For Decision type, use a short summary as the name`;

export async function extractEntities(
  content: string,
): Promise<ExtractedEntity[]> {
  try {
    const config = getConfig();
    const response = await getClient().chat.completions.create({
      model: config.EXTRACTION_MODEL,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_entities",
            description: "Extract named entities from text",
            parameters: {
              type: "object",
              properties: {
                entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      type: {
                        type: "string",
                        enum: [
                          "Person",
                          "Topic",
                          "Technology",
                          "Component",
                          "Decision",
                        ],
                      },
                    },
                    required: ["name", "type"],
                  },
                },
              },
              required: ["entities"],
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "extract_entities" },
      },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    return (parsed.entities ?? []) as ExtractedEntity[];
  } catch (err) {
    logger.warn({ err }, "Entity extraction failed, continuing without entities");
    return [];
  }
}
