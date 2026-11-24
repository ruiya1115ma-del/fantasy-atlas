const base = process.env.SITE || "https://fantasyatlas.online";

const login = await fetch(`${base}/api/admin/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "mry2001" }),
});
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
console.log("login", login.status, cookie ? "cookie ok" : "no cookie");

const home = await fetch(`${base}/api/admin/home`, { headers: { cookie } });
const homeJson = await home.json();
console.log("home config", home.status, "storage:", homeJson.storage, "library:", homeJson.libraryCount);

const movieId = process.argv[2] || "the-neverending-story";
const before = await fetch(`${base}/api/admin/movies/${movieId}`, { headers: { cookie } });
const beforeJson = await before.json();
console.log("movie get", before.status, beforeJson.storage, beforeJson.movie?.chineseTitle);

const originalTitle = beforeJson.movie?.originalTitle ?? "";
const patched = await fetch(`${base}/api/admin/movies/${movieId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ originalTitle: `${originalTitle} [kv-test]` }),
});
const patchedJson = await patched.json();
console.log("movie patch", patched.status, patchedJson.storage, JSON.stringify(patchedJson.movie || patchedJson.error));

const after = await fetch(`${base}/api/admin/movies/${movieId}`, { headers: { cookie } });
const afterJson = await after.json();
console.log("movie get after", after.status, JSON.stringify(afterJson.movie?.originalTitle));

const page = await fetch(`${base}/movies/${movieId}`);
const html = await page.text();
console.log("detail page", page.status, "shows [kv-test]:", html.includes("[kv-test]"));

// 改回去
const revert = await fetch(`${base}/api/admin/movies/${movieId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ originalTitle }),
});
console.log("revert", revert.status);
