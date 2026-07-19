const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(process.cwd(), "out");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = path.resolve(root, `.${pathname}`);
  return candidate.startsWith(root) ? candidate : null;
}

const server = http.createServer((request, response) => {
  let filePath = safePath(request.url || "/");
  if (!filePath) {
    response.writeHead(400).end("Bad request");
    return;
  }

  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, "index.html");
  if (!path.extname(filePath)) filePath = path.join(filePath, "index.html");

  fs.stat(filePath, (statError, stats) => {
    const resolvedPath = !statError && stats.isFile() ? filePath : path.join(root, "404.html");
    fs.readFile(resolvedPath, (readError, body) => {
      if (readError) {
        response.writeHead(500).end("Run `npm run build` before `npm start`.");
        return;
      }
      response.writeHead(resolvedPath === filePath ? 200 : 404, {
        "Content-Type": contentTypes[path.extname(resolvedPath)] || "application/octet-stream",
        "Cache-Control": resolvedPath.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable",
      });
      response.end(body);
    });
  });
});

server.listen(port, () => {
  console.log(`CommitPass static build: http://localhost:${port}`);
});
