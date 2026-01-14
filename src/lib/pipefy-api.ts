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
  fields?: PipefyPipeField[];
}

export interface ConnectedRepoItem {
  id: string;
  title: string;
}

export interface PipefyCardField {
  field_id: string;
  name: string;
  value: string | null;
  connectedRepoItems?: ConnectedRepoItem[];
}

export interface PipefyCard {
  id: string;
  title: string;
  current_phase: PipefyPhase;
  assignees: PipefyUser[];
  created_at?: string;
  pipeName?: string;
  fields?: PipefyCardField[];
}

export interface PipefyPipeField {
  id: string;
  label: string;
}

export interface PipefyPipe {
  id: string;
  name: string;
  phases?: PipefyPhaseWithDone[];
  start_form_fields?: PipefyPipeField[];
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

// Fetch organization pipes with phases and form fields (cached for search optimization)
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
            fields {
              id
              label
            }
          }
          start_form_fields {
            id
            label
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
                fields {
                  field { id }
                  name
                  value
                  connectedRepoItems {
                    ... on PublicCard {
                      id
                      title
                    }
                    ... on PublicTableRecord {
                      id
                      title
                    }
                  }
                }
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

    interface RawConnectedItem { id: string; title: string }
    interface RawField { field?: { id: string }; name: string; value: string | null; connectedRepoItems?: RawConnectedItem[] }
    interface RawNode { id: string; title: string; current_phase: PipefyPhase; assignees: PipefyUser[]; created_at?: string; fields?: RawField[] }
    
    const cards = data.phase.cards.edges.map(edge => {
      const node = edge.node as unknown as RawNode;
      const card: PipefyCard = {
        id: node.id,
        title: node.title,
        current_phase: node.current_phase,
        assignees: node.assignees,
        created_at: node.created_at,
        fields: node.fields?.map((f) => ({
          field_id: f.field?.id || '',
          name: f.name,
          value: f.value,
          connectedRepoItems: f.connectedRepoItems?.map(item => ({
            id: item.id,
            title: item.title
          })) || [],
        })),
      };
      return card;
    });
    allCards.push(...cards);

    hasNextPage = data.phase.cards.pageInfo.hasNextPage;
    cursor = data.phase.cards.pageInfo.endCursor;
  }

  return allCards;
}

// Normalize text: remove accents and convert to lowercase
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
};

// Parse responsible field value (can be JSON array or single value)
export function parseResponsibleFieldValue(value: string | null): string[] {
  if (!value || value.trim() === '') return [];
  
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      // Filtrar valores vazios, nulos ou undefined
      return parsed
        .map(v => String(v).trim())
        .filter(v => v !== '' && v !== 'null' && v !== 'undefined');
    }
    const strValue = String(parsed).trim();
    return strValue && strValue !== 'null' && strValue !== 'undefined' ? [strValue] : [];
  } catch {
    // If not valid JSON, treat as single value
    const trimmed = value.trim();
    return trimmed && trimmed !== 'null' && trimmed !== 'undefined' ? [trimmed] : [];
  }
}

// Build an index of phaseId -> responsibleFieldId from pipe phase definitions
// This is used when a card doesn't have the "Responsável" field in its payload
function buildPhaseResponsibleFieldIndex(pipes: PipefyPipe[]): Map<string, string> {
  const index = new Map<string, string>();
  
  for (const pipe of pipes) {
    if (!pipe.phases) continue;
    
    for (const phase of pipe.phases) {
      if (!phase.fields) continue;
      
      // Priority: "responsavel pela fase" first, then any "responsavel"
      const priorityField = phase.fields.find(f => {
        const label = normalizeText(f.label);
        return label.includes('responsavel pela fase');
      });
      
      const fallbackField = phase.fields.find(f => {
        const label = normalizeText(f.label);
        return label.includes('responsavel');
      });
      
      const field = priorityField || fallbackField;
      
      if (field?.id) {
        index.set(phase.id, field.id);
        console.log(`[Pipefy] Índice fase->fieldId: "${phase.name}" (${phase.id}) -> ${field.id} (label: "${field.label}")`);
      }
    }
  }
  
  console.log(`[Pipefy] Índice construído com ${index.size} fases`);
  return index;
}

// Search cards by "Responsável" field value (userId or userName)
export async function searchCardsByResponsibleField(
  token: string,
  pipeId: string,
  userId: string | null,
  userName: string | null,
  cachedPhases?: PipefyPhaseWithDone[],
  onProgress?: SearchProgressCallback,
  signal?: AbortSignal
): Promise<PipefyCard[]> {
  let activePhases: PipefyPhaseWithDone[];

  // CACHE DE FASES TEMPORARIAMENTE DESABILITADO - sempre buscar da API
  const DISABLE_PHASE_CACHE = true;

  // Use cached phases if available, otherwise fetch from API
  if (!DISABLE_PHASE_CACHE && cachedPhases && cachedPhases.length > 0) {
    activePhases = cachedPhases.filter(phase => !phase.done);
    console.log('[Pipefy] Usando fases do cache:', activePhases.map(p => ({ id: p.id, name: p.name, done: p.done })));
  } else {
    // Fetch phases from API (sempre executado quando DISABLE_PHASE_CACHE = true)
    console.log('[Pipefy] Buscando fases da API para pipe', pipeId);
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

    console.log('[Pipefy] Fases da API:', phasesData.pipe.phases.map(p => ({
      id: p.id,
      name: p.name,
      done: p.done
    })));

    activePhases = phasesData.pipe.phases.filter(phase => !phase.done);
  }

  console.log('[Pipefy] Fases ativas para busca:', {
    pipeId,
    totalFases: activePhases.length,
    fases: activePhases.map(p => ({ id: p.id, name: p.name }))
  });

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
    console.log(`[Pipefy] Fase "${phase.name}": ${phaseCards.length} cards encontrados`);
    allCards.push(...phaseCards);
  }

  // Final progress update
  onProgress?.(totalPhases, totalPhases, 'Filtrando resultados...', allCards.length);

  // Filter by native assignees (responsáveis da fase atual)
  const normalizedUserName = userName ? normalizeText(userName) : null;
  
  const filteredCards = allCards.filter(card => {
    // Usar assignees nativos do card (responsáveis da fase atual)
    const assignees = card.assignees || [];
    
    // userId null = busca cards SEM responsável (assignees vazio)
    if (userId === null) {
      console.log(`[Pipefy DEBUG] Card "${card.title}" (fase: ${card.current_phase?.name}):`, {
        assigneesCount: assignees.length,
        assignees: assignees.map(a => ({ id: a.id, name: a.name })),
        resultadoFiltro: assignees.length === 0
      });
      return assignees.length === 0;
    }
    
    // Busca por usuário específico via ID ou nome nos assignees
    return assignees.some(assignee => {
      // Match por ID
      if (assignee.id === userId) return true;
      
      // Match por nome (normalizado)
      if (normalizedUserName) {
        const normalizedAssigneeName = normalizeText(assignee.name);
        if (normalizedAssigneeName === normalizedUserName) return true;
        if (normalizedAssigneeName.includes(normalizedUserName)) return true;
        if (normalizedUserName.includes(normalizedAssigneeName)) return true;
      }
      
      return false;
    });
  });

  return filteredCards;
}

// Search cards in all pipes by "Responsável" field
export async function searchCardsInAllPipes(
  token: string,
  pipes: PipefyPipe[],
  userId: string | null,
  userName: string | null,
  onProgress?: AllPipesProgressCallback,
  signal?: AbortSignal
): Promise<PipefyCard[]> {
  const allCards: PipefyCard[] = [];

  for (let pipeIndex = 0; pipeIndex < pipes.length; pipeIndex++) {
    if (signal?.aborted) {
      throw new DOMException('Busca cancelada', 'AbortError');
    }
    
    const pipe = pipes[pipeIndex];

    const pipeCards = await searchCardsByResponsibleField(
      token,
      pipe.id,
      userId,
      userName,
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

// Helper to chunk array into batches
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Fetch single card details for validation
export async function fetchCardDetails(
  token: string,
  cardId: string
): Promise<PipefyCard | null> {
  const query = `
    query($cardId: ID!) {
      card(id: $cardId) {
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
        fields {
          field { id }
          name
          value
        }
      }
    }
  `;

  try {
    interface RawField { field?: { id: string }; name: string; value: string | null }
    interface RawCard { 
      id: string; 
      title: string; 
      current_phase: PipefyPhase; 
      assignees: PipefyUser[]; 
      fields?: RawField[] 
    }
    
    const data = await rateLimitedRequest<{ card: RawCard }>(token, query, { cardId });
    
    if (!data.card) return null;
    
    const card: PipefyCard = {
      id: data.card.id,
      title: data.card.title,
      current_phase: data.card.current_phase,
      assignees: data.card.assignees,
      fields: data.card.fields?.map((f) => ({
        field_id: f.field?.id || '',
        name: f.name,
        value: f.value,
      })),
    };
    
    return card;
  } catch (error) {
    console.error(`[Pipefy] Erro ao buscar detalhes do card ${cardId}:`, error);
    return null;
  }
}

// Fetch multiple card details for batch validation
export async function fetchMultipleCardDetails(
  token: string,
  cardIds: string[],
  batchSize: number = 20,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, PipefyCard | null>> {
  const results = new Map<string, PipefyCard | null>();
  const batches = chunkArray(cardIds, batchSize);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Fetch cards in parallel within each batch
    const promises = batch.map(cardId => fetchCardDetails(token, cardId));
    const batchResults = await Promise.all(promises);
    
    batch.forEach((cardId, index) => {
      results.set(cardId, batchResults[index]);
    });
    
    onProgress?.(i + 1, batches.length);
    
    // Small delay between batches to avoid rate limits
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return results;
}

// Options for inviting user to pipe
export interface InviteOptions {
  pipeId: string;
  email: string;
  roleName?: string;
}

// Interface for field updates
interface CardFieldUpdate {
  cardId: string;
  fieldId?: string;
  newFieldValue?: string[]; // Array of user IDs
}

// Batch update "Responsável" fields in a single GraphQL request using aliases
// Only updates the field, does NOT modify card assignees
async function batchUpdateCards(
  token: string,
  fieldUpdates: CardFieldUpdate[],
  inviteOptions?: InviteOptions
): Promise<{ succeeded: string[]; failed: { cardId: string; error: string }[]; userInvited?: boolean }> {
  const results = {
    succeeded: [] as string[],
    failed: [] as { cardId: string; error: string }[],
    userInvited: false,
  };

  // Filter only updates that have a valid fieldId and value
  const validUpdates = fieldUpdates.filter(f => f.fieldId && f.newFieldValue);
  
  if (validUpdates.length === 0) {
    // No valid field updates, mark all as failed
    for (const update of fieldUpdates) {
      results.failed.push({
        cardId: update.cardId,
        error: 'Campo "Responsável" não encontrado'
      });
    }
    return results;
  }

  // Build invite mutation if options provided
  const inviteMutation = inviteOptions ? `
    inviteMember: inviteMembers(input: {
      pipe_id: ${inviteOptions.pipeId}, 
      emails: [{ email: "${inviteOptions.email}", role_name: "${inviteOptions.roleName || 'member'}" }]
    }) {
      clientMutationId
    }
  ` : '';

  // Build dynamic mutation with aliases for field updates ONLY (no card assignee updates)
  // Now also returns the updated fields for validation
  const cardMutations = validUpdates.map((update, index) => {
    // Format value as comma-separated quoted strings (not JSON array)
    // Pipefy expects: "id1", "id2" instead of ["id1", "id2"]
    const valueStr = update.newFieldValue.map(v => `"${v}"`).join(', ');
    
    // Log mutation details for debugging
    console.log(`[Pipefy] Mutation field_${index}: card ${update.cardId}, fieldId ${update.fieldId}, new_value ${valueStr}`);
    
    return `
    field_${index}: updateCardField(input: {card_id: "${update.cardId}", field_id: "${update.fieldId}", new_value: [${valueStr}]}) {
      success
      card {
        id
        title
        fields {
          field_id
          name
          value
        }
      }
    }`;
  }).join('\n');

  const mutation = `mutation { 
    ${inviteMutation}
    ${cardMutations} 
  }`;

  console.log('[Pipefy] Executando mutation:', inviteOptions ? 'com convite ao pipe' : 'sem convite');
  console.log('[Pipefy] Atualizando apenas campos "Responsável", assignees não serão alterados');
  console.log('[Pipefy] Mutation completa a ser enviada:', mutation);

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

    // Process each field update result
    for (let i = 0; i < validUpdates.length; i++) {
      const key = `field_${i}`;
      // CRITICAL: Always normalize cardId to string for consistent comparison
      const cardId = String(validUpdates[i].cardId);

      if (data.data?.[key]?.success) {
        console.log(`[Pipefy] Card ${cardId}: Campo "Responsável" atualizado com sucesso`);
        results.succeeded.push(cardId);
      } else {
        // Check for specific error in errors array
        const cardError = data.errors?.find((e: { path?: string[]; message: string }) => 
          e.path?.includes(key)
        );
        // Log ALL errors for this card
        const allCardErrors = data.errors?.filter((e: { path?: string[]; message: string }) => e.path?.includes(key)) || [];
        console.error(`[Pipefy] Card ${cardId}: Falha ao atualizar. Erro principal:`, cardError);
        if (allCardErrors.length > 1) {
          console.error(`[Pipefy] Card ${cardId}: Erros adicionais (${allCardErrors.length - 1}):`, allCardErrors.slice(1));
        }
        results.failed.push({
          cardId,
          error: cardError?.message || 'Erro ao atualizar campo "Responsável"'
        });
      }
    }
    
    // Mark cards without valid field as failed
    for (const update of fieldUpdates) {
      const cardIdStr = String(update.cardId);
      if (!update.fieldId || !update.newFieldValue) {
        // Check using string comparison
        const alreadySucceeded = results.succeeded.some(id => String(id) === cardIdStr);
        const alreadyFailed = results.failed.some(f => String(f.cardId) === cardIdStr);
        if (!alreadySucceeded && !alreadyFailed) {
          results.failed.push({
            cardId: cardIdStr,
            error: 'Campo "Responsável" não encontrado'
          });
        }
      }
    }
  } catch (error) {
    console.error('[Pipefy] Erro na requisição:', error);
    // If the entire request fails, mark all cards as failed
    for (const update of fieldUpdates) {
      results.failed.push({
        cardId: update.cardId,
        error: error instanceof Error ? error.message : 'Erro de conexão'
      });
    }
  }

  return results;
}

/**
 * Normalizes responsible field values to only numeric user IDs.
 * - Keeps values that are already numeric IDs (e.g., "306631269")
 * - Maps names to IDs using the members list (e.g., "Planejamento BHZ" -> "306631269")
 * - Drops values that cannot be mapped
 */
function normalizeResponsibleValues(
  currentValues: string[],
  members: PipefyMember[],
  sourceUserId: string,
  sourceUserName: string
): { normalizedIds: string[]; droppedValues: string[] } {
  const normalizedIds: string[] = [];
  const droppedValues: string[] = [];
  
  // Build name-to-ID map for fast lookup
  const nameToIdMap = new Map<string, string>();
  for (const member of members) {
    const normalized = normalizeText(member.user.name);
    nameToIdMap.set(normalized, member.user.id);
  }
  
  const normalizedSourceName = normalizeText(sourceUserName);
  
  for (const value of currentValues) {
    // Skip source user by ID
    if (value === sourceUserId) continue;
    
    // Skip source user by name (normalized)
    const normalizedValue = normalizeText(value);
    if (normalizedSourceName && (
      normalizedValue === normalizedSourceName ||
      normalizedValue.includes(normalizedSourceName) ||
      normalizedSourceName.includes(normalizedValue)
    )) {
      continue;
    }
    
    // If already a numeric ID, keep it
    if (/^\d+$/.test(value)) {
      normalizedIds.push(value);
      continue;
    }
    
    // Try to map name to ID
    const mappedId = nameToIdMap.get(normalizedValue);
    if (mappedId) {
      normalizedIds.push(mappedId);
      console.log(`[Pipefy] Mapeado "${value}" -> ID ${mappedId}`);
    } else {
      droppedValues.push(value);
      console.warn(`[Pipefy] Valor "${value}" não é ID numérico e não foi mapeado para usuário conhecido`);
    }
  }
  
  return { normalizedIds, droppedValues };
}

// Progress callback for batch transfer
export type BatchTransferProgressCallback = (
  completedBatches: number,
  totalBatches: number,
  batchResults: { succeeded: string[]; failed: { cardId: string; error: string }[]; userInvited?: boolean }
) => void;

// Batch transfer cards - updates ONLY the "Responsável" field, does NOT modify card assignees
// Preserves other user IDs in the field when multiple responsibles exist
export async function transferCards(
  token: string,
  cardIds: string[],
  sourceUserId: string,
  sourceUserName: string, // Name of source user for matching name-based values
  newResponsibleId: string,
  newResponsibleName: string, // Name of new responsible user (used for field update)
  cards: PipefyCard[],
  pipes: PipefyPipe[], // Used to get field_id fallback from pipe definition
  members: PipefyMember[], // Used to normalize names to IDs
  batchSize: number = 50,
  onProgress?: BatchTransferProgressCallback,
  inviteOptions?: InviteOptions
): Promise<{ succeeded: string[]; failed: { cardId: string; error: string }[]; userInvited?: boolean }> {
  const results = {
    succeeded: [] as string[],
    failed: [] as { cardId: string; error: string }[],
    userInvited: false,
  };

  // Build phase -> fieldId index for cards without the field in payload
  const phaseFieldIndex = buildPhaseResponsibleFieldIndex(pipes);

  // Build field updates with updated user IDs (preserving other responsibles)
  const fieldUpdates: CardFieldUpdate[] = [];
  
  console.log(`[Pipefy] Processando ${cardIds.length} cards. IDs recebidos: [${cardIds.join(', ')}]`);
  console.log(`[Pipefy] Cards disponíveis: ${cards.length}. IDs: [${cards.map(c => c.id).join(', ')}]`);
  
  for (const cardId of cardIds) {
    // CRITICAL: Normalize both to string for comparison (API can return number or string)
    const card = cards.find(c => String(c.id) === String(cardId));
    
    if (!card) {
      console.error(`[Pipefy] Card ${cardId} NÃO encontrado no array de cards. Tipos: cardId=${typeof cardId}, cards[0].id=${typeof cards[0]?.id}`);
      results.failed.push({ cardId: String(cardId), error: 'Card não encontrado no array local' });
      continue;
    }
    
    if (card) {
      // Try to find "Responsável" field in card.fields
      const responsavelField = card.fields?.find(f => {
        const normalizedName = normalizeText(f.name);
        return normalizedName.includes('responsavel');
      });

      let fieldId: string | null = null;
      let currentValues: string[] = [];

      if (responsavelField) {
        // Field exists in card payload
        fieldId = responsavelField.field_id && responsavelField.field_id.trim() !== '' 
          ? responsavelField.field_id 
          : null;
        currentValues = parseResponsibleFieldValue(responsavelField.value);
        
        console.log(`[Pipefy] Card ${cardId}: Campo encontrado no payload (field_id: ${fieldId || 'vazio'}, valor: ${responsavelField.value})`);
      } else {
        // Field NOT in card payload (card "sem responsável")
        console.log(`[Pipefy] Card ${cardId}: Campo "Responsável" NÃO está no payload do card`);
      }

      // If no valid fieldId yet, try to get from phase index
      if (!fieldId && card.current_phase?.id) {
        const phaseId = card.current_phase.id;
        const phaseName = card.current_phase.name || 'desconhecida';
        fieldId = phaseFieldIndex.get(phaseId) || null;
        
        if (fieldId) {
          console.log(`[Pipefy] Card ${cardId}: Usando field_id do índice da fase "${phaseName}" (${phaseId}): ${fieldId}`);
        } else {
          console.log(`[Pipefy] Card ${cardId}: Fase "${phaseName}" (${phaseId}) não tem field_id no índice`);
        }
      }

      if (fieldId) {
        // Normalize current values to IDs only (removes source user automatically)
        const { normalizedIds, droppedValues } = normalizeResponsibleValues(
          currentValues,
          members,
          sourceUserId,
          sourceUserName
        );
        
        if (droppedValues.length > 0) {
          console.warn(`[Pipefy] Card ${cardId}: ${droppedValues.length} valor(es) descartado(s): [${droppedValues.join(', ')}]`);
        }
        
        // Add new responsible ID
        const updatedValues = [...normalizedIds, newResponsibleId];
        
        // Remove duplicates
        const uniqueValues = [...new Set(updatedValues)];
        
        console.log(`[Pipefy] Card ${cardId}: [${currentValues.join(', ')}] -> [${uniqueValues.join(', ')}] (somente IDs)`);
        
        fieldUpdates.push({
          cardId,
          fieldId,
          newFieldValue: uniqueValues,
        });
      } else {
        // Could not resolve fieldId
        const phaseInfo = card.current_phase 
          ? `fase "${card.current_phase.name}" (${card.current_phase.id})` 
          : 'fase desconhecida';
        console.error(`[Pipefy] Card ${cardId}: Não foi possível resolver field_id. ${phaseInfo}. Índice tem ${phaseFieldIndex.size} fases.`);
        
        fieldUpdates.push({
          cardId,
          fieldId: undefined,
          newFieldValue: undefined,
        });
      }
    }
  }

  const cardsWithField = fieldUpdates.filter(f => f.fieldId).length;
  console.log(`[Pipefy] Campos "Responsável" encontrados: ${cardsWithField} de ${cardIds.length} cards`);
  if (cardsWithField < cardIds.length) {
    console.log(`[Pipefy] ⚠️ ${cardIds.length - cardsWithField} cards não possuem campo "Responsável" identificado`);
  }

  // Split field updates into batches
  const batches = chunkArray(fieldUpdates, batchSize);
  const totalBatches = batches.length;

  for (let i = 0; i < batches.length; i++) {
    const batchFieldUpdates = batches[i];
    
    // Only include invite in the first batch
    const batchInviteOptions = i === 0 ? inviteOptions : undefined;
    
    const batchResult = await batchUpdateCards(token, batchFieldUpdates, batchInviteOptions);
    
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
