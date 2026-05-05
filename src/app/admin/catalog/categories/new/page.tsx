import * as React from 'react';
import Link from 'next/link';
import { prisma } from '@/server/db/client';
import { CategoryCreateForm } from './_components/category-create-form';

export const dynamic = 'force-dynamic';

interface OptionRow {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
}

/**
 * Walks the category tree breadth-first to produce a flat select list with
 * each entry's depth, so the form can render visual indentation. Skips
 * soft-deleted nodes and any subtree rooted at one of them.
 */
function buildOptions(
  cats: { id: string; name: string; parentId: string | null }[],
): OptionRow[] {
  const childrenByParent = new Map<string | null, { id: string; name: string }[]>();
  for (const c of cats) {
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push({ id: c.id, name: c.name });
    childrenByParent.set(c.parentId, list);
  }
  const out: OptionRow[] = [];
  function walk(parentId: string | null, depth: number): void {
    const kids = childrenByParent.get(parentId) ?? [];
    for (const k of kids) {
      out.push({ id: k.id, name: k.name, parentId, depth });
      walk(k.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

export default async function AdminCategoryNewPage(): Promise<React.ReactElement> {
  const cats = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, parentId: true },
  });
  const options = buildOptions(cats);

  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/catalog/categories" className="text-neutral-600 underline">
          ← Back to categories
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">New category</h2>
      <CategoryCreateForm parentOptions={options} />
    </div>
  );
}
