// nissewyn.com is the address; www and the old Pages address send people there.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.nissewyn.com") {
      url.hostname = "nissewyn.com";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
