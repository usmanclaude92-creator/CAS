# Android release signing

The previous build produced "release" APKs that were actually signed with a
throwaway, ad-hoc self-signed certificate generated fresh on every build
(`scripts/package-apk.py` + `scripts/v2_signer.py`), with no real keystore at
all — anyone could produce an APK that looks like an official release. That
script path still exists for local/dev builds, but Gradle release builds now
require a real keystore and refuse to fall back to it silently.

## One-time setup

1. Generate a keystore (keep this file and its passwords secret — losing it
   means you can never publish an update under the same app identity again):

   ```
   keytool -genkeypair -v -keystore cas-release.jks -alias cas -keyalg RSA \
     -keysize 2048 -validity 10000
   ```

2. **Never commit `cas-release.jks` or its passwords to the repository.**
   `*.jks` is already in `.gitignore`.

3. Provide these to the Gradle build via environment variables (preferred for
   CI) or a local, gitignored `gradle.properties`:

   | Variable | Purpose |
   |---|---|
   | `CAS_RELEASE_KEYSTORE` | Path to the `.jks` file |
   | `CAS_RELEASE_STORE_PASSWORD` | Keystore password |
   | `CAS_RELEASE_KEY_ALIAS` | Key alias (e.g. `cas`) |
   | `CAS_RELEASE_KEY_PASSWORD` | Key password |

   Example (local):
   ```
   export CAS_RELEASE_KEYSTORE=/secure/path/cas-release.jks
   export CAS_RELEASE_STORE_PASSWORD=...
   export CAS_RELEASE_KEY_ALIAS=cas
   export CAS_RELEASE_KEY_PASSWORD=...
   ./gradlew assembleRelease
   ```

   In GitHub Actions, store the keystore file base64-encoded as a repository
   secret, decode it to a temp path in the workflow step, and pass the four
   variables above as `env:` from `secrets.*` — never as workflow file
   contents.

4. If none of these are set, the release build type has no `signingConfig`
   and Gradle will fail the build rather than silently signing with a
   throwaway certificate.
