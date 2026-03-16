import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

let graphClient: Client | null = null;

export function getGraphClient(): Client {
  if (graphClient) return graphClient;

  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID!,
    process.env.AZURE_CLIENT_ID!,
    process.env.AZURE_CLIENT_SECRET!
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  graphClient = Client.initWithMiddleware({
    authProvider,
  });

  return graphClient;
}

// Helper to handle Graph API pagination
export async function getAllPages<T>(
  client: Client,
  url: string,
  select?: string[]
): Promise<T[]> {
  const results: T[] = [];
  let nextLink: string | undefined = url;

  while (nextLink) {
    let request = client.api(nextLink);
    if (select && !nextLink.includes("$skiptoken")) {
      request = request.select(select);
    }
    // Request a large page size to minimize round trips
    if (!nextLink.includes("$top") && !nextLink.includes("$skiptoken")) {
      request = request.top(999);
    }
    const response = await request.get();
    results.push(...(response.value as T[]));
    nextLink = response["@odata.nextLink"];
  }

  return results;
}

// Retry wrapper for Graph API calls with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const graphError = error as { statusCode?: number; code?: string };
      if (
        attempt < maxRetries &&
        (graphError.statusCode === 429 ||
          graphError.statusCode === 503 ||
          graphError.statusCode === 504)
      ) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}
