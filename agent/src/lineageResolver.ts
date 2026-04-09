import type { EmbeddingEntry } from './embeddingStore';

type FamilyMember = {
  name: string;
  father?: string | null;
  mother?: string | null;
  [key: string]: unknown;
};

type ParentKind = 'father' | 'mother';

type ParentEdge = {
  parentName: string;
  parentKind: ParentKind;
  evidence: string;
};

type RelationRequest = {
  depth: number;
  gender: 'male' | 'female';
  label: string;
};

export type LineageResolution = {
  answer: string;
  targetName: string;
  ancestorName: string;
  relation: string;
  path: string[];
  evidence: string[];
};

const RELATION_REQUESTS: Array<{ regex: RegExp; request: RelationRequest }> = [
  { regex: /\bgreat[- ]grandfather\b/i, request: { depth: 3, gender: 'male', label: 'great-grandfather' } },
  { regex: /\bgreat[- ]grandmother\b/i, request: { depth: 3, gender: 'female', label: 'great-grandmother' } },
  { regex: /\bgrandfather\b/i, request: { depth: 2, gender: 'male', label: 'grandfather' } },
  { regex: /\bgrandmother\b/i, request: { depth: 2, gender: 'female', label: 'grandmother' } },
  { regex: /\bfather\b/i, request: { depth: 1, gender: 'male', label: 'father' } },
  { regex: /\bmother\b/i, request: { depth: 1, gender: 'female', label: 'mother' } }
];

const RAG_PATTERNS = [
  /\b(?<ancestor>[A-Z][a-z]+(?: [A-Z][a-z]+)?) is the father of (?<parent>[A-Z][a-z]+(?: [A-Z][a-z]+)?), who is father of (?<child>[A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/g,
  /\b(?<child>[A-Z][a-z]+(?: [A-Z][a-z]+)?)'s father, (?<parent>[A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/g
];

export function isLineageQuery(query: string): boolean {
  return RELATION_REQUESTS.some(({ regex }) => regex.test(query));
}

export function resolveLineageQuery(
  query: string,
  familyMembers: FamilyMember[],
  embeddings: EmbeddingEntry[]
): LineageResolution | null {
  const relation = RELATION_REQUESTS.find(({ regex }) => regex.test(query))?.request;
  if (!relation) {
    return null;
  }

  const target = findTargetPerson(query, familyMembers);
  if (!target) {
    return null;
  }

  const surnameHints = extractSurnameHints(query, target.name);
  const parentGraph = buildParentGraph(familyMembers, embeddings);

  let frontier = [{
    name: target.name,
    path: [target.name],
    evidence: [] as string[]
  }];

  for (let level = 0; level < relation.depth; level += 1) {
    const next: typeof frontier = [];

    for (const candidate of frontier) {
      const parents = parentGraph.get(normalizeName(candidate.name)) || [];
      for (const parent of parents) {
        next.push({
          name: parent.parentName,
          path: [...candidate.path, parent.parentName],
          evidence: [...candidate.evidence, parent.evidence]
        });
      }
    }

    frontier = dedupeCandidates(next);
    if (frontier.length === 0) {
      return null;
    }
  }

  const matching = frontier.filter((candidate) => {
    const lastEvidence = candidate.evidence.at(-1) || '';
    return relation.gender === 'male'
      ? /father/i.test(lastEvidence)
      : /mother/i.test(lastEvidence);
  });

  const resolved = chooseBestCandidate(matching.length > 0 ? matching : frontier, surnameHints);
  if (!resolved) {
    return null;
  }

  const ancestorName = resolved.path.at(-1) || resolved.name;
  const pathSummary = resolved.path.join(' -> ');
  const answer = `${target.name}'s ${relation.label} is ${ancestorName}. Lineage: ${pathSummary}.`;

  return {
    answer,
    targetName: target.name,
    ancestorName,
    relation: relation.label,
    path: resolved.path,
    evidence: resolved.evidence
  };
}

function buildParentGraph(familyMembers: FamilyMember[], embeddings: EmbeddingEntry[]) {
  const graph = new Map<string, ParentEdge[]>();

  for (const member of familyMembers) {
    if (member.father) {
      addParent(graph, member.name, member.father, 'father', `MCP family roster: ${member.name}'s father is ${member.father}.`);
    }
    if (member.mother) {
      addParent(graph, member.name, member.mother, 'mother', `MCP family roster: ${member.name}'s mother is ${member.mother}.`);
    }
  }

  for (const entry of embeddings) {
    const text = entry.text || '';
    for (const pattern of RAG_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const groups = match.groups || {};
        const snippet = summarizeEvidence(text);

        if (groups.ancestor && groups.parent && groups.child) {
          addParent(graph, groups.child, groups.parent, 'father', `Semantic memory: ${snippet}`);
          addParent(graph, groups.parent, groups.ancestor, 'father', `Semantic memory: ${snippet}`);
          continue;
        }

        if (groups.child && groups.parent) {
          addParent(graph, groups.child, groups.parent, 'father', `Semantic memory: ${snippet}`);
        }
      }
    }
  }

  return graph;
}

function addParent(
  graph: Map<string, ParentEdge[]>,
  childName: string,
  parentName: string,
  parentKind: ParentKind,
  evidence: string
) {
  const keys = buildLookupKeys(childName);
  for (const key of keys) {
    const existing = graph.get(key) || [];
    existing.push({ parentName, parentKind, evidence });
    graph.set(key, existing);
  }
}

function findTargetPerson(query: string, familyMembers: FamilyMember[]) {
  const normalizedQuery = normalizeName(query);

  return [...familyMembers]
    .sort((left, right) => right.name.length - left.name.length)
    .find((member) => new RegExp(`\\b${escapeRegExp(member.name.toLowerCase())}\\b`, 'i').test(normalizedQuery));
}

function buildLookupKeys(name: string): string[] {
  const normalized = normalizeName(name);
  const firstToken = normalized.split(/\s+/)[0];
  return [...new Set([normalized, firstToken])];
}

function dedupeCandidates(candidates: Array<{ name: string; path: string[]; evidence: string[] }>) {
  const byName = new Map<string, { name: string; path: string[]; evidence: string[] }>();

  for (const candidate of candidates) {
    const key = normalizeName(candidate.name);
    if (!byName.has(key) || candidate.evidence.length > (byName.get(key)?.evidence.length || 0)) {
      byName.set(key, candidate);
    }
  }

  return [...byName.values()];
}

function chooseBestCandidate(
  candidates: Array<{ name: string; path: string[]; evidence: string[] }>,
  surnameHints: string[]
) {
  if (candidates.length === 0) {
    return null;
  }

  const scored = candidates.map((candidate) => {
    const lowered = candidate.path.join(' ').toLowerCase();
    const surnameScore = surnameHints.reduce((score, hint) => score + (lowered.includes(hint) ? 1 : 0), 0);
    return { candidate, score: surnameScore * 10 + candidate.evidence.length };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.candidate || null;
}

function extractSurnameHints(query: string, targetName: string): string[] {
  const match = query.match(new RegExp(`${escapeRegExp(targetName)}\\s+([A-Za-z][A-Za-z'-]+)`, 'i'));
  return match?.[1] ? [match[1].toLowerCase()] : [];
}

function summarizeEvidence(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 220);
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}