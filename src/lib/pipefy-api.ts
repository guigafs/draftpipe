// Pipefy GraphQL API Service

const PIPEFY_API_URL = 'https://api.pipefy.com/graphql';

export interface PipefyUser {
  id: string;
  name: string;
  email: string;
  username?: string;
}

export interface PipefyMember {
  role_name: string;
  user: PipefyUser;
}

export interface PipefyPhase {
  id: string;
  name: string;
}

export interface PipefyPhaseWithDone {
  id: string;
  name: string;
  done: boolean;
}

export interface PipefyCard {
  id: string;
  title: string;
  current_phase: PipefyPhase;
  assignees: PipefyUser[];
  created_at?: string;
  pipeName?: string;
}

export interface PipefyPipe {
  id: string;
  name: string;
  phases?: PipefyPhaseWithDone[];
}

export interface PipefyOrganization {
  id: string;
  name: string;
  pipes?: PipefyPipe[];
  members?: PipefyMember[];
}

export interface ApiError {
  message: string;
  code?: string;
}

// Rate limiting helper
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 60; // 60ms between requests (500 requests / 30 seconds)

async function rateLimitedRequest<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
  retries = 3
): Promise<T> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();

  try {
    const response = await fetch(PIPEFY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 401) {
      throw new Error('Token inválido ou expirado. Verifique suas credenciais.');
    }

    if (response.status === 429) {
      if (retries > 0) {
        // Exponential backoff
        const waitTime = Math.pow(2, 4 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return rateLimitedRequest(token, query, variables, retries - 1);
      }
      throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
    }

    if (response.status >= 500) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return rateLimitedRequest(token, query, variables, retries - 1);
      }
      throw new Error('Erro no servidor do Pipefy. Tente novamente mais tarde.');
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0].message || 'Erro na requisição ao Pipefy');
    }

    return data.data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erro de conexão. Verifique sua internet.');
  }
}

// Validate token by fetching user info
export async function validateToken(token: string): Promise<{ valid: boolean; user?: PipefyUser; error?: string }> {
  const query = `
    query {
      me {
        id
        name
        email
      }
    }
  `;

  try {
    const data = await rateLimitedRequest<{ me: PipefyUser }>(token, query);
    return { valid: true, user: data.me };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Erro ao validar token' 
    };
  }
}

// Fetch organization members
export async function fetchOrganizationMembers(
  token: string, 
  organizationId: string
): Promise<PipefyMember[]> {
  const query = `
    query($orgId: ID!) {
      organization(id: $orgId) {
        name
        members {
          role_name
          user {
            id
            name
            email
            username
          }
        }
      }
    }
  `;

  const data = await rateLimitedRequest<{ organization: PipefyOrganization }>(
    token, 
    query, 
    { orgId: organizationId }
  );
  
  return data.organization.members || [];
}

// Fetch organization pipes with phases (cached for search optimization)
export async function fetchPipes(token: string, organizationId: string): Promise<PipefyPipe[]> {
  const query = `
    query($orgId: ID!) {
      organization(id: $orgId) {
        pipes {
          id
          name
          phases {
            id
            name
            done
          }
        }
      }
    }
  `;

  const data = await rateLimitedRequest<{ organization: PipefyOrganization }>(
    token, 
    query, 
    { orgId: organizationId }
  );
  
  return data.organization.pipes || [];
}

// Progress callback type for search
export type SearchProgressCallback = (currentPhase: number, totalPhases: number, phaseName: string, cardsFound: number) => void;

// Progress callback type for all pipes search
export type AllPipesProgressCallback = (
  currentPipe: number,
  totalPipes: number,
  pipeName: string,
  currentPhase: number,
  totalPhases: number,
  phaseName: string,
  cardsFound: number
) => void;

// Fetch all cards from a phase with pagination
async function fetchAllCardsFromPhase(
  token: string,
  phaseId: string,
  signal?: AbortSignal
): Promise<PipefyCard[]> {
  const allCards: PipefyCard[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    if (signal?.aborted) {
      throw new DOMException('Busca cancelada', 'AbortError');
    }
    const query = `
      query($phaseId: ID!, $after: String) {
        phase(id: $phaseId) {
          cards(first: 50, after: $after) {
            edges {
              node {
                id
                title
                current_phase {
                  id
                  name
                }
                assignees {
                  id
                  name
                  email
                }
                created_at
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const data = await rateLimitedRequest<{
      phase: {
        cards: {
          edges: { node: PipefyCard }[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      };
    }>(token, query, { phaseId, after: cursor });

    const cards = data.phase.cards.edges.map(edge => edge.node);
    allCards.push(...cards);

    hasNextPage = data.phase.cards.pageInfo.hasNextPage;
    cursor = data.phase.cards.pageInfo.endCursor;
  }

  return allCards;
}

// Search cards by assignee email (fetching through phases with full pagination)
export async function searchCardsByAssignee(
  token: string,
  pipeId: string,
  email: string,
  cachedPhases?: PipefyPhaseWithDone[],
  onProgress?: SearchProgressCallback,
  signal?: AbortSignal
): Promise<PipefyCard[]> {
  let activePhases: PipefyPhaseWithDone[];

  // Use cached phases if available, otherwise fetch from API
  if (cachedPhases && cachedPhases.length > 0) {
    activePhases = cachedPhases.filter(phase => !phase.done);
  } else {
    // Fallback: fetch phases from API
    const phasesQuery = `
      query($pipeId: ID!) {
        pipe(id: $pipeId) {
          name
          phases {
            id
            name
            done
          }
        }
      }
    `;

    const phasesData = await rateLimitedRequest<{
      pipe: {
        name: string;
        phases: Array<{
          id: string;
          name: string;
          done: boolean;
        }>;
      };
    }>(token, phasesQuery, { pipeId });

    activePhases = phasesData.pipe.phases.filter(phase => !phase.done);
  }

  const totalPhases = activePhases.length;
  const allCards: PipefyCard[] = [];

  // Fetch cards from each active phase with pagination
  for (let i = 0; i < activePhases.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Busca cancelada', 'AbortError');
    }
    
    const phase = activePhases[i];
    
    // Report progress
    onProgress?.(i + 1, totalPhases, phase.name, allCards.length);

    const phaseCards = await fetchAllCardsFromPhase(token, phase.id, signal);
    allCards.push(...phaseCards);
  }

  // Final progress update
  onProgress?.(totalPhases, totalPhases, 'Filtrando resultados...', allCards.length);

  // Filter locally by assignee email
  return allCards.filter(card =>
    card.assignees.some(a => a.email.toLowerCase() === email.toLowerCase())
  );
}

// Search cards in all pipes
export async function searchCardsInAllPipes(
  token: string,
  pipes: PipefyPipe[],
  email: string,
  onProgress?: AllPipesProgressCallback,
  signal?: AbortSignal
): Promise<PipefyCard[]> {
  const allCards: PipefyCard[] = [];

  for (let pipeIndex = 0; pipeIndex < pipes.length; pipeIndex++) {
    if (signal?.aborted) {
      throw new DOMException('Busca cancelada', 'AbortError');
    }
    
    const pipe = pipes[pipeIndex];

    const pipeCards = await searchCardsByAssignee(
      token,
      pipe.id,
      email,
      pipe.phases, // Pass cached phases to avoid extra API request
      (currentPhase, totalPhases, phaseName, cardsFound) => {
        onProgress?.(
          pipeIndex + 1,
          pipes.length,
          pipe.name,
          currentPhase,
          totalPhases,
          phaseName,
          allCards.length + cardsFound
        );
      },
      signal
    );
    // Add pipe name to each card
    const cardsWithPipe = pipeCards.map(card => ({ ...card, pipeName: pipe.name }));
    allCards.push(...cardsWithPipe);
  }

  return allCards;
}

// Search user by email
export async function searchUserByEmail(token: string, email: string): Promise<PipefyUser | null> {
  const query = `
    query($email: String!) {
      findUsers(email: $email) {
        id
        name
        email
      }
    }
  `;

  try {
    const data = await rateLimitedRequest<{ findUsers: PipefyUser[] }>(token, query, { email });
    return data.findUsers && data.findUsers.length > 0 ? data.findUsers[0] : null;
  } catch {
    // Try alternative query
    const altQuery = `
      query {
        me {
          organizations {
            members {
              user {
                id
                name
                email
              }
            }
          }
        }
      }
    `;
    
    try {
      const altData = await rateLimitedRequest<{ 
        me: { 
          organizations: { 
            members: { user: PipefyUser }[] 
          }[] 
        } 
      }>(token, altQuery);
      
      for (const org of altData.me.organizations) {
        const member = org.members.find(m => m.user.email.toLowerCase() === email.toLowerCase());
        if (member) return member.user;
      }
      return null;
    } catch {
      return null;
    }
  }
}

// Update card assignee
export async function updateCardAssignee(
  token: string,
  cardId: string,
  newAssigneeIds: string[]
): Promise<{ success: boolean; card?: PipefyCard; error?: string }> {
  const mutation = `
    mutation($cardId: ID!, $assigneeIds: [ID]) {
      updateCard(input: {id: $cardId, assignee_ids: $assigneeIds}) {
        card {
          id
          title
          assignees {
            id
            email
            name
          }
        }
      }
    }
  `;

  try {
    const data = await rateLimitedRequest<{ updateCard: { card: PipefyCard } }>(
      token,
      mutation,
      { cardId, assigneeIds: newAssigneeIds }
    );
    return { success: true, card: data.updateCard.card };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao atualizar card' 
    };
  }
}

// Helper to split array into chunks
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Options for inviting user to pipe
export interface InviteOptions {
  pipeId: string;
  email: string;
  roleName?: string;
}

// Batch update multiple cards in a single GraphQL request using aliases
// Optionally includes inviteMembers mutation to add user to pipe first
async function batchUpdateCards(
  token: string,
  cardIds: string[],
  newAssigneeId: string,
  inviteOptions?: InviteOptions
): Promise<{ succeeded: string[]; failed: { cardId: string; error: string }[]; userInvited?: boolean }> {
  const results = {
    succeeded: [] as string[],
    failed: [] as { cardId: string; error: string }[],
    userInvited: false,
  };

  // Build invite mutation if options provided
  const inviteMutation = inviteOptions ? `
    inviteMember: inviteMembers(input: {
      pipe_id: ${inviteOptions.pipeId}, 
      emails: [{ email: "${inviteOptions.email}", role_name: "${inviteOptions.roleName || 'member'}" }]
    }) {
      clientMutationId
    }
  ` : '';

  // Build dynamic mutation with aliases for card updates
  const cardMutations = cardIds.map((cardId, index) => `
    card_${index}: updateCard(input: {id: "${cardId}", assignee_ids: ["${newAssigneeId}"]}) {
      card {
        id
        title
        assignees {
          id
          email
        }
      }
    }
  `).join('\n');

  const mutation = `mutation { 
    ${inviteMutation}
    ${cardMutations} 
  }`;

  console.log('[Pipefy] Executando mutation:', inviteOptions ? 'com convite ao pipe' : 'sem convite');

  try {
    const response = await fetch(PIPEFY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation }),
    });

    const data = await response.json();

    console.log('[Pipefy] Resposta da API:', JSON.stringify(data, null, 2));

    // Check if user was invited successfully
    if (inviteOptions && data.data?.inviteMember) {
      results.userInvited = true;
      console.log('[Pipefy] Usuário adicionado ao pipe com sucesso');
    }

    // Process each card result
    for (let i = 0; i < cardIds.length; i++) {
      const key = `card_${i}`;
      const cardId = cardIds[i];

      if (data.data?.[key]?.card) {
        const card = data.data[key].card;
        const assignees = card.assignees || [];
        
        // Validate if new assignee is in the list
        const assigneeFound = assignees.some(
          (a: { id: string }) => a.id === newAssigneeId
        );
        
        if (assigneeFound) {
          console.log(`[Pipefy] Card ${cardId}: Transferência confirmada`);
          results.succeeded.push(cardId);
        } else {
          console.warn(`[Pipefy] Card ${cardId}: Assignee não encontrado na resposta`, assignees);
          results.failed.push({
            cardId,
            error: 'Responsável não foi atribuído corretamente'
          });
        }
      } else {
        // Check for specific error in errors array
        const cardError = data.errors?.find((e: { path?: string[]; message: string }) => 
          e.path?.includes(key)
        );
        console.error(`[Pipefy] Card ${cardId}: Erro na API`, cardError);
        results.failed.push({
          cardId,
          error: cardError?.message || 'Erro ao atualizar card'
        });
      }
    }
  } catch (error) {
    console.error('[Pipefy] Erro na requisição:', error);
    // If the entire request fails, mark all cards as failed
    for (const cardId of cardIds) {
      results.failed.push({
        cardId,
        error: error instanceof Error ? error.message : 'Erro de conexão'
      });
    }
  }

  return results;
}

// Progress callback for batch transfer
export type BatchTransferProgressCallback = (
  completedBatches: number,
  totalBatches: number,
  batchResults: { succeeded: string[]; failed: { cardId: string; error: string }[]; userInvited?: boolean }
) => void;

// Batch transfer cards with optimized mutations (up to 50 per request)
// Optionally invites user to pipe in the first batch if inviteOptions is provided
export async function transferCards(
  token: string,
  cardIds: string[],
  newAssigneeId: string,
  batchSize: number = 50,
  onProgress?: BatchTransferProgressCallback,
  inviteOptions?: InviteOptions
): Promise<{ succeeded: string[]; failed: { cardId: string; error: string }[]; userInvited?: boolean }> {
  const results = {
    succeeded: [] as string[],
    failed: [] as { cardId: string; error: string }[],
    userInvited: false,
  };

  // Split cards into batches
  const batches = chunkArray(cardIds, batchSize);
  const totalBatches = batches.length;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Only include invite in the first batch
    const batchInviteOptions = i === 0 ? inviteOptions : undefined;
    
    const batchResult = await batchUpdateCards(token, batch, newAssigneeId, batchInviteOptions);
    
    // Track if user was invited
    if (batchResult.userInvited) {
      results.userInvited = true;
    }
    
    // Aggregate results
    results.succeeded.push(...batchResult.succeeded);
    results.failed.push(...batchResult.failed);
    
    // Report progress
    onProgress?.(i + 1, totalBatches, batchResult);
    
    // Small delay between batches to respect rate limits
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}
