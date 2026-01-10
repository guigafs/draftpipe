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

export interface PipefyCardField {
  field_id: string;
  name: string;
  value: string | null;
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

    interface RawField { field?: { id: string }; name: string; value: string | null }
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
      return parsed.map(v => String(v));
    }
    return [String(parsed)];
  } catch {
    // If not valid JSON, treat as single value
    return [value.trim()];
  }
}

// Find the "Responsável" field ID from a pipe's form definition or phase fields
// This is used as fallback when a card's field doesn't have a valid field_id
function findResponsibleFieldIdFromPipes(pipes: PipefyPipe[]): string | null {
  for (const pipe of pipes) {
    // 1. First, search in start_form_fields
    if (pipe.start_form_fields) {
      const field = pipe.start_form_fields.find(f => {
        const normalizedLabel = normalizeText(f.label);
        return normalizedLabel.includes('responsavel');
      });
      
      if (field?.id) {
        console.log(`[Pipefy] field_id encontrado em start_form_fields do pipe "${pipe.name}": ${field.id} (label: "${field.label}")`);
        return field.id;
      }
    }
    
    // 2. Then, search in phase fields
    if (pipe.phases) {
      for (const phase of pipe.phases) {
        if (!phase.fields) continue;
        
        const field = phase.fields.find(f => {
          const normalizedLabel = normalizeText(f.label);
          return normalizedLabel.includes('responsavel');
        });
        
        if (field?.id) {
          console.log(`[Pipefy] field_id encontrado na fase "${phase.name}" do pipe "${pipe.name}": ${field.id} (label: "${field.label}")`);
          return field.id;
        }
      }
    }
  }
  
  return null;
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

  // Filter by "Responsável" field value (ID or name)
  const normalizedUserName = userName ? normalizeText(userName) : null;
  
  const filteredCards = allCards.filter(card => {
    // Find any field that contains "responsavel" in the name
    const responsavelField = card.fields?.find(f => {
      const normalizedName = normalizeText(f.name);
      return normalizedName.includes('responsavel');
    });
    
    // userId null = search for cards with empty responsible field
    if (userId === null) {
      // Card sem o campo "Responsável" = sem responsável
      if (!responsavelField) return true;
      
      // Card com campo vazio = sem responsável
      const fieldValues = parseResponsibleFieldValue(responsavelField.value);
      return fieldValues.length === 0;
    }
    
    // Para busca por usuário específico, o campo deve existir
    if (!responsavelField) return false;
    
    // Parse the field value as array of user IDs or names
    const fieldValues = parseResponsibleFieldValue(responsavelField.value);
    
    // Check if any value matches the userId OR userName
    return fieldValues.some(value => {
      // Compare with ID directly
      if (value === userId) return true;
      
      // Compare with name (normalized, without accents)
      if (normalizedUserName) {
        const normalizedValue = normalizeText(value);
        // Exact match or partial match for names
        if (normalizedValue === normalizedUserName) return true;
        if (normalizedValue.includes(normalizedUserName)) return true;
        if (normalizedUserName.includes(normalizedValue)) return true;
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
  const cardMutations = validUpdates.map((update, index) => {
    // Format value as JSON array of IDs for Pipefy connection field
    const valueStr = JSON.stringify(update.newFieldValue);
    
    return `
    field_${index}: updateCardField(input: {card_id: "${update.cardId}", field_id: "${update.fieldId}", new_value: ${valueStr}}) {
      success
      card {
        id
        title
      }
    }`;
  }).join('\n');

  const mutation = `mutation { 
    ${inviteMutation}
    ${cardMutations} 
  }`;

  console.log('[Pipefy] Executando mutation:', inviteOptions ? 'com convite ao pipe' : 'sem convite');
  console.log('[Pipefy] Atualizando apenas campos "Responsável", assignees não serão alterados');

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
      const cardId = validUpdates[i].cardId;

      if (data.data?.[key]?.success) {
        console.log(`[Pipefy] Card ${cardId}: Campo "Responsável" atualizado com sucesso`);
        results.succeeded.push(cardId);
      } else {
        // Check for specific error in errors array
        const cardError = data.errors?.find((e: { path?: string[]; message: string }) => 
          e.path?.includes(key)
        );
        console.error(`[Pipefy] Card ${cardId}: Erro ao atualizar campo`, cardError);
        results.failed.push({
          cardId,
          error: cardError?.message || 'Erro ao atualizar campo "Responsável"'
        });
      }
    }
    
    // Mark cards without valid field as failed
    for (const update of fieldUpdates) {
      if (!update.fieldId || !update.newFieldValue) {
        if (!results.succeeded.includes(update.cardId) && !results.failed.some(f => f.cardId === update.cardId)) {
          results.failed.push({
            cardId: update.cardId,
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
  _newResponsibleName: string, // Kept for compatibility but not used
  cards: PipefyCard[],
  pipes: PipefyPipe[], // Used to get field_id fallback from pipe definition
  batchSize: number = 50,
  onProgress?: BatchTransferProgressCallback,
  inviteOptions?: InviteOptions
): Promise<{ succeeded: string[]; failed: { cardId: string; error: string }[]; userInvited?: boolean }> {
  const results = {
    succeeded: [] as string[],
    failed: [] as { cardId: string; error: string }[],
    userInvited: false,
  };

  // Normalize source user name for comparison
  const normalizedSourceName = normalizeText(sourceUserName);

  // Get fallback field_id from pipe definition (for cards with empty field_id)
  const fallbackFieldId = findResponsibleFieldIdFromPipes(pipes);

  // Build field updates with updated user IDs (preserving other responsibles)
  const fieldUpdates: CardFieldUpdate[] = [];
  for (const cardId of cardIds) {
    const card = cards.find(c => c.id === cardId);
    if (card) {
      // First: Find "Responsável" field by name only (don't require valid field_id)
      let responsavelField = card.fields?.find(f => {
        const normalizedName = normalizeText(f.name);
        return normalizedName.includes('responsavel');
      });

      // If field found but has empty field_id, use fallback from pipe
      if (responsavelField && (!responsavelField.field_id || responsavelField.field_id.trim() === '')) {
        if (fallbackFieldId) {
          console.log(`[Pipefy] Card ${cardId}: field_id vazio, usando fallback do pipe: ${fallbackFieldId}`);
          responsavelField = {
            ...responsavelField,
            field_id: fallbackFieldId
          };
        }
      }

      // Now check if we have a valid field_id
      const hasValidFieldId = responsavelField && responsavelField.field_id && responsavelField.field_id.trim() !== '';

      // Debug logging
      if (hasValidFieldId) {
        console.log(`[Pipefy] Campo "Responsável" encontrado no card ${cardId}: "${responsavelField!.name}" (field_id: ${responsavelField!.field_id}, valor: ${responsavelField!.value})`);
      } else if (responsavelField) {
        console.log(`[Pipefy] Campo "Responsável" encontrado mas sem field_id válido no card ${cardId}: "${responsavelField.name}"`);
      } else {
        const fieldNames = card.fields?.map(f => `${f.name} (id: ${f.field_id || 'vazio'})`).join(', ') || 'nenhum';
        console.log(`[Pipefy] Campo "Responsável" NÃO encontrado no card ${cardId}. Campos disponíveis: ${fieldNames}`);
      }
      
      if (hasValidFieldId && responsavelField) {
        // Parse current values from the field (can be IDs or names)
        const currentValues = parseResponsibleFieldValue(responsavelField.value);
        
        // Remove source user by ID OR by name (normalized)
        const filteredValues = currentValues.filter(value => {
          // Skip if it's the source user ID
          if (value === sourceUserId) return false;
          
          // Also check if it matches the source user's name
          if (normalizedSourceName) {
            const normalizedValue = normalizeText(value);
            if (normalizedValue === normalizedSourceName) return false;
            if (normalizedValue.includes(normalizedSourceName)) return false;
            if (normalizedSourceName.includes(normalizedValue)) return false;
          }
          
          return true;
        });
        
        // Add new responsible ID
        const updatedIds = [...filteredValues, newResponsibleId];
        
        // Remove duplicates
        const uniqueIds = [...new Set(updatedIds)];
        
        console.log(`[Pipefy] Card ${cardId}: Valores anteriores: [${currentValues.join(', ')}] -> Novos IDs: [${uniqueIds.join(', ')}]`);
        
        fieldUpdates.push({
          cardId,
          fieldId: responsavelField.field_id,
          newFieldValue: uniqueIds,
        });
      } else {
        // No responsible field found or no valid field_id
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
