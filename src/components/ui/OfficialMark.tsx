"use client";

import React from "react";
import { isAdminUid } from "@/lib/admin";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

export default function OfficialMark({
  uid,
  isOfficial,
  size = 14,
  className,
}: {
  uid?: string | null;
  isOfficial?: boolean;
  size?: number;
  className?: string;
}) {
  return <VerifiedBadge show={Boolean(isOfficial) || isAdminUid(uid)} size={size} className={className} />;
}
