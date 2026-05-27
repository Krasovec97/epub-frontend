import { streamSessionEpub } from "@/lib/download";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; sessionId: string }> },
) {
  const { sessionId } = await params;
  return streamSessionEpub(sessionId);
}
