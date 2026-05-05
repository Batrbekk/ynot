import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db/client';
import { AnnouncementEditForm } from './_components/announcement-edit-form';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export default async function AdminAnnouncementDetailPage({
  params,
}: Ctx): Promise<React.ReactElement> {
  const { id } = await params;
  const a = await prisma.announcementMessage.findUnique({ where: { id } });
  if (!a) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/content/announcements" className="text-neutral-600 underline">
          ← Back to announcements
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">Edit announcement</h2>
      <AnnouncementEditForm
        id={a.id}
        initial={{ text: a.text, sortOrder: a.sortOrder, isActive: a.isActive }}
      />
    </div>
  );
}
