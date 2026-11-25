const t = process.env.CF_TOKEN;
const account = process.env.CF_ACCOUNT || "bc48736d167f425e8eed813bfd9c8084";

const query = `
query Workers($account: String!, $since: Date!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      workersInvocationsAdaptive(limit: 100, filter: { date_geq: $since }) {
        dimensions { date }
        sum { requests }
      }
    }
  }
}
`;

const run = async () => {
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: "Bearer " + t, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { account, since: "2026-11-18" } }),
  });
  const j = await r.json();
  console.log("status", r.status);
  console.log(JSON.stringify(j).slice(0, 1500));
};

run();
