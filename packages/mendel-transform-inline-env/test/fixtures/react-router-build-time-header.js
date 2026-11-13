// Excerpt of react-router@7.18.5 dist/development/index.js, built from
// https://github.com/remix-run/react-router/blob/1ad93b4cb4b045366b7d73639de34787812ad5b5/packages/react-router/lib/server-runtime/dev.ts#L23-L24
function getBuildTimeHeader(request, headerName) {
  if (typeof process !== "undefined") {
    try {
      if (process.env.hasOwnProperty("IS_RR_BUILD_REQUEST") && process.env.IS_RR_BUILD_REQUEST === "yes") {
        return request.headers.get(headerName);
      }
    } catch (e) {
    }
  }
  return null;
}
module.exports = getBuildTimeHeader;
