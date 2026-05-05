import * as React from 'react';
import Link from 'next/link';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

interface NodeRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  productCount: number;
}

interface TreeNodeProps {
  node: NodeRow;
  depth: number;
  childrenByParent: Map<string | null, NodeRow[]>;
}

function TreeNode({ node, depth, childrenByParent }: TreeNodeProps): React.ReactElement {
  const children = childrenByParent.get(node.id) ?? [];
  return (
    <>
      <tr className="border-t border-neutral-100 hover:bg-neutral-50">
        <td className="px-3 py-2">
          <span style={{ paddingLeft: `${depth * 20}px` }} className="font-medium">
            {depth > 0 ? '↳ ' : ''}
            {node.name}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-neutral-600">{node.slug}</td>
        <td className="px-3 py-2 text-right text-xs text-neutral-600">{node.productCount}</td>
        <td className="px-3 py-2 text-right">
          <Link
            href={`/admin/catalog/categories/${node.id}`}
            className="text-neutral-900 underline text-xs"
          >
            Edit
          </Link>
        </td>
      </tr>
      {children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          childrenByParent={childrenByParent}
        />
      ))}
    </>
  );
}

export default async function AdminCategoriesPage(): Promise<React.ReactElement> {
  const cats = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { products: true } },
    },
  });

  const rows: NodeRow[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    productCount: c._count.products,
  }));

  // Group by parentId so the recursive renderer can walk depth-first.
  const childrenByParent = new Map<string | null, NodeRow[]>();
  for (const row of rows) {
    const list = childrenByParent.get(row.parentId) ?? [];
    list.push(row);
    childrenByParent.set(row.parentId, list);
  }
  const roots = childrenByParent.get(null) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Categories</h2>
        <Link
          href="/admin/catalog/categories/new"
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
        >
          New category
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Slug</th>
              <th className="text-right px-3 py-2">Products</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {roots.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                  No categories yet.
                </td>
              </tr>
            )}
            {roots.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                childrenByParent={childrenByParent}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
