import { createWeeklyMissionRouteHandlers } from "./handler";

export const runtime = "nodejs";

const handlers = createWeeklyMissionRouteHandlers();

export const GET = handlers.GET;
export const POST = handlers.POST;
