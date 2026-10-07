import type { ReactNode } from "react";
import MemorizeWorkspace from "@/components/layout/MemorizeWorkspace";

export default function MemorizeLayout({ children }: { children: ReactNode }) {
  return <MemorizeWorkspace>{children}</MemorizeWorkspace>;
}
