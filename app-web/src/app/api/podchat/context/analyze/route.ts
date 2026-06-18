import { createPodchatContextAnalyzeHandlers } from "./handler";

export const runtime = "nodejs";

const handlers = createPodchatContextAnalyzeHandlers();

export const POST = handlers.POST;
