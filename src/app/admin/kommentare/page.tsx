import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { comments, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { MessageSquare } from "lucide-react";
import ApproveCommentButton from "./ApproveCommentButton";

async function getComments() {
  try {
    return await db
      .select({
        id: comments.id,
        content: comments.content,
        isApproved: comments.isApproved,
        createdAt: comments.createdAt,
        photoId: comments.photoId,
        videoId: comments.videoId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .orderBy(desc(comments.createdAt))
      .limit(100);
  } catch {
    return [];
  }
}

export default async function AdminKommentarePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const allComments = await getComments();
  const pending = allComments.filter((c) => !c.isApproved);
  const approved = allComments.filter((c) => c.isApproved);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Kommentare</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {allComments.length} gesamt • {pending.length} ausstehend
        </p>
      </div>

      {/* Ausstehende Kommentare */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-3">
            ⏳ Ausstehend ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        </div>
      )}

      {/* Freigegebene Kommentare */}
      {approved.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Freigegeben ({approved.length})
          </h2>
          <div className="space-y-3">
            {approved.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        </div>
      )}

      {allComments.length === 0 && (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Noch keine Kommentare vorhanden.</p>
        </div>
      )}
    </div>
  );
}

function CommentCard({
  comment,
}: {
  comment: {
    id: number;
    content: string;
    isApproved: boolean;
    createdAt: Date;
    photoId: number | null;
    videoId: number | null;
    userName: string;
    userEmail: string;
  };
}) {
  return (
    <div
      className={`bg-gray-900 border rounded-xl p-4 ${
        comment.isApproved ? "border-gray-800" : "border-amber-500/30 bg-amber-500/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* User-Info */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
              {comment.userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-300">{comment.userName}</span>
            <span className="text-xs text-gray-600">{comment.userEmail}</span>
            <span className="text-xs text-gray-700">•</span>
            <span className="text-xs text-gray-600">
              {new Date(comment.createdAt).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {/* Inhalt */}
          <p className="text-gray-200 text-sm leading-relaxed">{comment.content}</p>
          {/* Bezug */}
          <p className="text-gray-600 text-xs mt-1">
            {comment.photoId ? `Foto #${comment.photoId}` : `Video #${comment.videoId}`}
          </p>
        </div>
        {/* Aktionen */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <ApproveCommentButton
            commentId={comment.id}
            isApproved={comment.isApproved}
          />
        </div>
      </div>
    </div>
  );
}
