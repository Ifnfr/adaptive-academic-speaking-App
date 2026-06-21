import { clerkMiddleware } from "@clerk/nextjs/server";

const handler = clerkMiddleware();
export const proxy = handler;
export default handler;

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
