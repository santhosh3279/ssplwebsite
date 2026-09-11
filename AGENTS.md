# Repository workflow

After every successful production build (`npm run build`), commit the task's source changes and regenerated `dist/` files, then push the current branch to `origin`. The user has authorized this workflow; no additional confirmation is needed. Include relevant documentation changes, and leave unrelated changes out of the commit.

If the build fails, fix the failure before committing and pushing. If there are no changes to commit, push any existing unpushed commits. Do not force-push; report any push failure that cannot be resolved safely.
