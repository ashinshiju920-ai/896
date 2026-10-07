export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = "aylemlearning.online";
    url.protocol = "https:";

    return Response.redirect(url.toString(), 301);
  },
};
