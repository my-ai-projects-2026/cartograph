import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "./auth/paths";

const isPublicRoute = createRouteMatcher([
  `${SIGN_IN_PATH}(.*)`,
  `${SIGN_UP_PATH}(.*)`,
]);

// Protection happens here rather than in a layout so a signed-out request is
// redirected before any page HTML is rendered or sent.
export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  },
  { signInUrl: SIGN_IN_PATH, signUpUrl: SIGN_UP_PATH },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
