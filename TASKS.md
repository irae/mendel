# Dependency removal tasks

## 1. uuid → crypto.randomUUID()

- [x] `examples/planout-example/app.js` — `require('uuid')` → `crypto.randomUUID()`

## 2. xtend → Object.assign / spread

## 3. urlsafe-base64 → Buffer base64url

## 4. rimraf → fs.rmSync

## 5. glob → fs.globSync / fs.promises.glob

## 6. chalk → util.styleText

## 7. tmp → fs.mkdtempSync

## 8. shasum → crypto.createHash('sha1')
