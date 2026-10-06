import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getActor } from "@/lib/auth/session";
import { getUserWithProfile } from "@/modules/identity";
import { UserDetailForm } from "./user-detail-form";

interface UserDetailPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const actor = await getActor();
  const { userId } = await params;

  const user = await getUserWithProfile(userId);
  if (!user || !actor) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Account: ${user.name}`}
        description={`Identity management, assigned roles, and credentials for ${user.email}.`}
      />

      <UserDetailForm
        user={user}
        currentUserId={actor.userId}
        currentUserRoles={actor.roles}
      />
    </div>
  );
}
