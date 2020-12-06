let { Octokit } = require("@octokit/rest");
Octokit = Octokit.plugin(require("octokit-fetch-all-repos"));

const sodium = require("tweetsodium");
const debug = require("debug")("github-update-secret");

module.exports = async function (argv) {
  const { target, value } = argv;
  const name = argv.name.toLowerCase();

  // Fetch list of repos
  const token = argv.pat || process.env.GITHUB_TOKEN;

  const octokit = new Octokit({
    auth: token,
  });

  // List all repos
  debug("Fetching repo list");
  let repos = await octokit.repos.fetchAll({
    owner: target,
    visibility: "all",
    minimum_access: "admin",
    include_forks: false,
    include_archived: false,
    include_templates: false,
  });

  // Reformat into the format we need
  repos = repos.map((r) => {
    return {
      repo: r.name,
      owner: r.owner.login,
    };
  });
  debug("Processed repo list");

  // Filter down to repos that have the secret that we're looking for
  debug(`Building list of repos using [${name}]`);
  const reposWithSecret = await repos.reduce(async (acc, { owner, repo }) => {
    const { data: secrets } = await octokit.actions.listRepoSecrets({
      owner,
      repo,
    });

    const matching = secrets.secrets.filter((s) => {
      return s.name.toLowerCase() === name;
    });

    if (matching.length === 0) {
      return acc;
    }

    return (await acc).concat({ owner, repo });
  }, []);
  debug(`Found [${reposWithSecret.length}] repos with the secret [${name}]`);

  // For each repo that does have the secret, update it
  for (let { owner, repo } of reposWithSecret) {
    debug(`Updating ${repo}`);
    const key = await getKeyForRepo(octokit, owner, repo);
    const encrypted_value = encrypt(key.key, value);

    await octokit.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: name,
      encrypted_value,
      key_id: key.key_id,
    });
    debug(`Updated ${repo}`);
  }

  // If this is an org, we need to check org secrets too
  debug("Check if provided user is an org");
  const {
    data: { type: owner_type },
  } = await octokit.users.getByUsername({
    username: target,
  });

  if (owner_type !== "Organization") {
    debug("User is not an org. Skipping org secret update");
    return;
  }

  try {
    // Does the org have this secret? Octokit will throw if not
    debug("Secret exists?");
    const { data: secret } = await octokit.actions.getOrgSecret({
      org: target,
      secret_name: name,
    });

    debug("Fetch org public key");
    const { data: key } = await octokit.actions.getOrgPublicKey({
      org: target,
    });

    const encrypted_value = encrypt(key.key, value);

    debug("Update org secret");
    await octokit.actions.createOrUpdateOrgSecret({
      org: target,
      secret_name: name,
      encrypted_value,
      key_id: key.key_id,
      visibility: secret.visibility,
    });
    debug("Org secret updated");
  } catch (e) {
    // The secret doesn't exist on the org
    if (e.status !== 404) {
      throw e;
    }
    debug("Org secret does not exist");
  }
};

async function getKeyForRepo(octokit, owner, repo) {
  const { data: key } = await octokit.actions.getRepoPublicKey({
    owner,
    repo,
  });

  return key;
}

function encrypt(key, value) {
  // Convert the message and key to Uint8Array's (Buffer implements that interface)
  const messageBytes = Buffer.from(value);
  const keyBytes = Buffer.from(key, "base64");

  // Encrypt using LibSodium.
  const encryptedBytes = sodium.seal(messageBytes, keyBytes);

  // Base64 the encrypted secret
  return Buffer.from(encryptedBytes).toString("base64");
}
