// The old address of the site (one.unzoo.ai, Pages project unzoo-one): everything moves to nissewyn.com.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(`https://nissewyn.com${url.pathname}${url.search}`, 301);
  },
};
