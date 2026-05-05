import * as React from 'react';
import Link from 'next/link';
import { AnnouncementCreateForm } from './_components/announcement-create-form';

export const dynamic = 'force-dynamic';

export default function AdminAnnouncementNewPage(): React.ReactElement {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/content/announcements" className="text-neutral-600 underline">
          ← Back to announcements
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">New announcement</h2>
      <AnnouncementCreateForm />
    </div>
  );
}
