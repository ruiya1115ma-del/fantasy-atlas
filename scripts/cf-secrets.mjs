const token = process.env.CLOUDFLARE_API_TOKEN;
const acct = "bc48736d167f425e8eed813bfd9c8084";
const script = "fantasy-atlas";

const secrets = {
  ADMIN_USER: "admin",
  ADMIN_PASSWORD: "mry2001",
  ADMIN_SECRET: "fa-cf-session-3c9d1a7b62e84f5190a7d2c4be81f356",
};

for (const [name, text] of Object.entries(secrets)) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acct}/workers/scripts/${script}/secrets`,
    {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name, text, type: "secret_text" }),
    },
  );
  const j = await r.json();
  console.log(name, r.status, j.success ? "ok" : JSON.stringify(j.errors));
}
