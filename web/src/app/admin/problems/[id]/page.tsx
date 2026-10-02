"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProblemEditor from "@/components/admin/ProblemEditor";
import { EmptyState, TraceLoader } from "@/components/bc/States";
import Button from "@/components/ui/Button";
import { adminGetProblem } from "@/lib/api";
import { describeError } from "@/lib/errors";

export default function EditProblemPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ["admin-problem", id], queryFn: () => adminGetProblem(id) });
  if (q.isLoading) return <TraceLoader label="Loading problem" />;
  if (q.isError || !q.data) {
    const e = describeError(q.error, "load this problem");
    return (
      <EmptyState
        tone="error"
        title={e.title}
        body={e.body}
        action={
          <Link href="/admin">
            <Button variant="secondary" size="sm">
              Back to all problems
            </Button>
          </Link>
        }
      />
    );
  }
  // Keyed by id so switching problems never carries an old draft over.
  return <ProblemEditor key={q.data.id} initial={q.data} />;
}
