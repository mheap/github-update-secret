# github-update-secret

This CLI tool allows you to update the value of a GitHub Secret on multiple repositories at once. This is useful if you're using a `user` account and not an `org`, as users do not have the concept of user level secrets

## How it works

- Fetch a list of all repos to which the authenticated user has admin access for the provided user/org
- Fetch the list of secrets on each repository
- For each repository that has a secret named the same as the provided `SECRET_NAME`, update the value of that secret
- Check if the provided target is an organisation.
- If so:
  - Check if there is an org secret named `SECRET_NAME`
  - If there is, update the value

## Usage

```
DEBUG=github-update-secret npx github-update-secret <user/org> <SECRET_NAME> <new_value>
```

Any repos that you do not have `admin` access to will be skipped, as will `forks`, `templates` and `archived` repos.
