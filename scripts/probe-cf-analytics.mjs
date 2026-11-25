const t = process.env.CF_TOKEN;
const zone = process.env.CF_ZONE || "46daf9ffd45b824186b651f3a340b706";

const query = `
query Traffic($zone: String!, $since: Date!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      httpRequests1dGroups(limit: 7, filter: { date_geq: $since }) {
        dimensions { date }
        sum { requests pageViews bytes }
        uniq { uniques }
      }
    }
  }
}
`;

const run = async () => {
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: "Bearer " + t, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { zone, since: "2026-11-18" } }),
  });
  const j = await r.json();
  console.log("status", r.status);
  console.log(JSON.stringify(j).slice(0, 1200));
};

run();
