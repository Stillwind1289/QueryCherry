
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        app: "QueryCherry"
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { error: "API route not configured yet" },
        { status: 404 }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
