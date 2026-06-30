import { verifySupabaseAccessToken, type VerifiedApiUser } from "./supabase";

export type ApiContext = {
  request: Request;
  accessToken?: string;
  user: VerifiedApiUser | null;
};

export async function createContext(request: Request): Promise<ApiContext> {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length)
    : undefined;
  const user = await verifySupabaseAccessToken(accessToken);

  return { request, accessToken, user };
}
