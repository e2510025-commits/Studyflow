import { handlers } from "@/lib/auth/auth";

export const runtime = "edge";

export const { GET, POST } = handlers;
