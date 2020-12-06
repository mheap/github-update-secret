#!/usr/bin/env node

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const argv = yargs(hideBin(process.argv))
  .option("pat", {
    type: "string",
    description:
      "GitHub Personal Access Token. Required if GITHUB_TOKEN env variable is not set",
  })
  .command(
    "$0 <target> <name> <value>",
    "Update a secret in all repositories that use it",
    (yargs) => {
      yargs
        .positional("target", {
          describe: "The user, org or team to update",
        })
        .positional("name", {
          describe: "The name of the secret to update",
        })
        .positional("value", {
          describe: "The new value for the secret",
        });
    },
    async (argv) => {
      await require(".")(argv);
    }
  )
  .demandOption(["target", "name", "value"]).argv;
