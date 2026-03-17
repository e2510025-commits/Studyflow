export type ViolationTargetType = "timeline" | "global_chat";

export async function submitViolationReport(params: {
  targetType: ViolationTargetType;
  targetId: string;
  reason: string;
  detail?: string;
}) {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      detail: params.detail || "",
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "report_submit_failed");
  }
}
