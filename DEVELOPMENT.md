# Mendel Development

Mendel uses `pnpm` instead of `npm` for it's excelent workspace support and its speed.
Mendel also uses `lerna` to help manage/publish all packages.
Lastly, mendel uses `husky` with `commitlint` to achieve semver versioning.

## dependencies

`pnpm install` should install all dependencies in all modules.
use `pnpm lerna clean` to reset all node_modules if needed.

## Linking

To use your local mendel repo in your project, you can do it in two steps:

1. Link all modules to global `pnpm`: `pnpm lerna exec "pnpm link --global"`
2. Use a loop to link all packages you use in your repo.

Caveat: Lerna should follow package topology (dependencies before dependents). For whatever reason, at time of writing you might need to run step 1 multiple times, as it works first on packages without dependencies, then it works on packages with one dep, and so on.

Here is a one liner (for step 2) that links mendel packages to globally linked modules from step 1

```bash
cd ../project-that-uses-mendel/
for mendelmod in `find node_modules -d 1 | grep mendel | grep -v ignored | sed -e s/node_modules\\\///`; pnpm link --global $mendelmod
```

If you want to do it manually, you can:

```bash
pnpm link --global mendel-resolver
pnpm link --global mendel-development
#... etc
```

## Versioning

https://github.com/lerna/lerna/tree/main/libs/commands/version

Use lerna for prerelease/beta:

`pnpm lerna version prerelease`

For real releases we indend to use `--conventional-commits`, which will semver correctly:

Without pushing:
`pnpm lerna version --conventional-commits --no-push`

Final:
`pnpm lerna version --conventional-commits`

## Publishing

Lerna can publish only changed packages by using:

`pnpm lerna publish from-package --otp 123456`

You will need your 2FA code replaced above.
