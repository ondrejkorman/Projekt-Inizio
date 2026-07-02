export const MAX_QUERY_LENGTH = 200;

export type QueryValidationResult =
  | { valid: true; query: string }
  | { valid: false; error: string };

/**
 * Validuje vyhledávací dotaz z query parametru q.
 */
export function validateSearchQuery(raw: unknown): QueryValidationResult {
  if (typeof raw !== 'string') {
    return {
      valid: false,
      error: 'Chybí parametr q – zadejte vyhledávací dotaz.',
    };
  }

  const query = raw.trim();

  if (!query) {
    return {
      valid: false,
      error: 'Chybí parametr q – zadejte vyhledávací dotaz.',
    };
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return {
      valid: false,
      error: `Dotaz je příliš dlouhý – maximum je ${MAX_QUERY_LENGTH} znaků.`,
    };
  }

  return { valid: true, query };
}
