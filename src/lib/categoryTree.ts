export interface CategoryTreeGroup<T> {
  parent: T;
  children: T[];
}

/**
 * Groups a flat category list into parent+children pairs (a single level of
 * nesting, since the category editor only lets a subcategory sit under a
 * top-level one). A child whose parent got deleted/filtered out is promoted
 * to its own top-level group instead of silently vanishing.
 */
export function groupCategoriesByParent<T extends { _id: string; parentId?: string | null }>(
  categories: T[],
): CategoryTreeGroup<T>[] {
  const byId = new Set(categories.map((c) => c._id));
  const childrenByParent = new Map<string, T[]>();
  const roots: T[] = [];
  for (const c of categories) {
    if (c.parentId && byId.has(c.parentId)) {
      if (!childrenByParent.has(c.parentId)) childrenByParent.set(c.parentId, []);
      childrenByParent.get(c.parentId)!.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots.map((parent) => ({ parent, children: childrenByParent.get(parent._id) ?? [] }));
}

/**
 * Flattens the groups back into one ordered sequence - each parent
 * immediately followed by its children - for contexts (like a dropdown) that
 * need a flat list where every item carries its own nesting depth.
 */
export function flattenCategoryTree<T extends { _id: string; parentId?: string | null }>(
  categories: T[],
): { item: T; depth: 0 | 1 }[] {
  return groupCategoriesByParent(categories).flatMap((g) => [
    { item: g.parent, depth: 0 as const },
    ...g.children.map((c) => ({ item: c, depth: 1 as const })),
  ]);
}
