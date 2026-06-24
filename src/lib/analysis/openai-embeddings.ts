import OpenAI from "openai";

const embeddingModel = "text-embedding-3-small";

export const embeddingMetadata = {
  model: embeddingModel,
  dimensions: 1536
};

export async function createEmbeddings(apiKey: string, inputs: string[]) {
  if (inputs.length === 0) {
    return [];
  }

  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({
    model: embeddingModel,
    input: inputs
  });

  return response.data.map((item) => item.embedding);
}

export async function createEmbedding(apiKey: string, input: string) {
  const [embedding] = await createEmbeddings(apiKey, [input]);

  if (!embedding) {
    throw new Error("OpenAI returned no embedding.");
  }

  return embedding;
}

export function toPgVector(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
