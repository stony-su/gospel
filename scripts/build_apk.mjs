/**
 * A release APK, signed, and put where the landing site can serve it.
 *
 *   npm run apk                # build, sign, write site/download/
 *   npm run apk -- --manifest  # rewrite build.js for the APK already there
 *
 * Runs `expo prebuild` for Android, builds the release variant with Gradle,
 * then re-signs the result with the app's own release key and copies it to
 * site/download/ with a small manifest the site reads for the file name,
 * size and checksum.
 *
 * The signing key is the part that matters. Expo's template signs release
 * builds with the shared Android debug key, which any machine on earth can
 * reproduce, and the key an APK is first signed with is the app's identity
 * for the life of every install. So the first run of this script makes a
 * proper key at credentials/gospel-release.jks with a password it writes to
 * .env as GOSPEL_KEYSTORE_PASSWORD. Both are gitignored. Keep them: an APK
 * signed with any other key will not install over this one.
 *
 * `--manifest` exists because two builds are not byte-identical. Once an APK
 * has been published, the page's checksum has to describe that file, so a
 * change to the manifest alone - a new GOSPEL_APK_URL, say - is written from
 * the APK on disk without building another.
 *
 * Needs the Android SDK (ANDROID_HOME, or the default Studio location) and a
 * JDK on JAVA_HOME. Real phones are ARM, so the x86 emulator ABIs are left
 * out; that is most of the size difference against a universal build.
 */

import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WINDOWS = process.platform === 'win32';
const MANIFEST_ONLY = process.argv.includes('--manifest');

const ANDROID_HOME =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  (WINDOWS
    ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
    : join(process.env.HOME ?? '', 'Android', 'Sdk'));

const JAVA_HOME = process.env.JAVA_HOME;
const java = JAVA_HOME ? join(JAVA_HOME, 'bin', 'java') : 'java';
const keytool = JAVA_HOME ? join(JAVA_HOME, 'bin', 'keytool') : 'keytool';

// Everything is spawned without a shell, so a path with a space in it is one
// argument rather than two. The .bat wrappers Gradle and apksigner ship are
// one-line calls to java, made here directly.
function run(command, args, options = {}) {
  const shown = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
  console.log(`\n> ${command} ${shown}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    ...options,
    env: {
      ...process.env,
      ANDROID_HOME,
      ANDROID_SDK_ROOT: ANDROID_HOME,
      ...(options.env ?? {}),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status}`);
  }
}

// ---- .env ----------------------------------------------------------------------

const ENV_FILE = join(ROOT, '.env');
const KEY_VAR = 'GOSPEL_KEYSTORE_PASSWORD';

function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const env = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

// ---- where things go --------------------------------------------------------------

const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')).expo;
const ANDROID = join(ROOT, 'android');
const DOWNLOAD = join(ROOT, 'site', 'download');
const BUILD_JS = join(DOWNLOAD, 'build.js');
const fileName = `gospel-${app.version}.apk`;
const target = join(DOWNLOAD, fileName);

/** The previous manifest, if there is one. */
function previousManifest() {
  if (!existsSync(BUILD_JS)) return null;
  const match = /window\.GOSPEL_BUILD = (\{[\s\S]*\});/.exec(readFileSync(BUILD_JS, 'utf8'));
  return match ? JSON.parse(match[1]) : null;
}

// ---- the key ----------------------------------------------------------------

const CREDENTIALS = join(ROOT, 'credentials');
const KEYSTORE = join(CREDENTIALS, 'gospel-release.jks');
const ALIAS = 'gospel';

function signingPassword() {
  let password = process.env[KEY_VAR] ?? readEnv()[KEY_VAR];
  if (!existsSync(KEYSTORE)) {
    if (password) {
      throw new Error(
        `${KEY_VAR} is set but ${KEYSTORE} is missing. If the keystore is lost, ` +
          'installed copies of the app cannot be updated; restore it from backup, ' +
          `or remove ${KEY_VAR} from .env to start a new identity on purpose.`,
      );
    }
    password = randomBytes(24).toString('base64url');
    mkdirSync(CREDENTIALS, { recursive: true });
    run(keytool, [
      '-genkeypair',
      '-v',
      '-keystore', KEYSTORE,
      '-alias', ALIAS,
      '-keyalg', 'RSA',
      '-keysize', '4096',
      '-validity', '10000',
      '-storepass', password,
      '-keypass', password,
      '-dname', 'CN=Gospel, O=Gospel, C=GB',
    ]);
    appendFileSync(
      ENV_FILE,
      `\n# Android release signing key, credentials/gospel-release.jks. Keep both.\n${KEY_VAR}=${password}\n`,
    );
    console.log(`\nMade ${KEYSTORE} and wrote its password to .env. Back them up.`);
  } else if (!password) {
    throw new Error(`${KEYSTORE} exists but ${KEY_VAR} is not in .env or the environment`);
  }
  return password;
}

// ---- build and sign ----------------------------------------------------------------

function build() {
  if (!existsSync(ANDROID_HOME)) {
    throw new Error(`Android SDK not found at ${ANDROID_HOME}; set ANDROID_HOME`);
  }
  const password = signingPassword();

  // Prebuild rewrites the `android` and `ios` scripts in package.json to
  // `expo run:*`, which is not how this project is run (the README says
  // `expo start`). Put the file back as it was.
  const PACKAGE_JSON = join(ROOT, 'package.json');
  const packageJsonBefore = readFileSync(PACKAGE_JSON);
  run(process.execPath, [
    join(ROOT, 'node_modules', 'expo', 'bin', 'cli'),
    'prebuild',
    '--platform', 'android',
    '--no-install',
  ]);
  writeFileSync(PACKAGE_JSON, packageJsonBefore);

  writeFileSync(
    join(ANDROID, 'local.properties'),
    `sdk.dir=${ANDROID_HOME.replace(/\\/g, '\\\\')}\n`,
  );

  run(
    java,
    [
      '-Xmx64m',
      '-Xms64m',
      '-Dorg.gradle.appname=gradlew',
      '-classpath', join(ANDROID, 'gradle', 'wrapper', 'gradle-wrapper.jar'),
      'org.gradle.wrapper.GradleWrapperMain',
      'app:assembleRelease',
      '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a',
      '--no-daemon',
    ],
    { cwd: ANDROID },
  );

  const built = join(ANDROID, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (!existsSync(built)) throw new Error(`Gradle finished but ${built} is missing`);

  const buildTools = join(ANDROID_HOME, 'build-tools');
  const latest = readdirSync(buildTools)
    .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  if (!latest) throw new Error(`No build-tools under ${buildTools}`);
  const apksignerJar = join(buildTools, latest, 'lib', 'apksigner.jar');
  const apksigner = (args, options) => run(java, ['-jar', apksignerJar, ...args], options);

  mkdirSync(DOWNLOAD, { recursive: true });
  apksigner(
    [
      'sign',
      '--v4-signing-enabled', 'false', // no .idsig sidecar; nothing here streams installs
      '--ks', KEYSTORE,
      '--ks-key-alias', ALIAS,
      '--ks-pass', `env:${KEY_VAR}`,
      '--key-pass', `env:${KEY_VAR}`,
      '--out', target,
      built,
    ],
    { env: { [KEY_VAR]: password } },
  );
  apksigner(['verify', '--print-certs', target]);
}

/** The minimum Android version, from the merged manifest of the last build. */
function minSdkFromBuild() {
  try {
    const merged = join(ANDROID, 'app', 'build', 'intermediates', 'merged_manifests', 'release');
    const manifest = readdirSync(merged, { recursive: true })
      .map((name) => join(merged, String(name)))
      .find((path) => path.endsWith('AndroidManifest.xml'));
    if (!manifest) return null;
    const match = /android:minSdkVersion="(\d+)"/.exec(readFileSync(manifest, 'utf8'));
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

// ---- go -------------------------------------------------------------------------

const previous = previousManifest();

if (MANIFEST_ONLY) {
  if (!existsSync(target)) {
    throw new Error(`${target} is missing; run without --manifest to build it`);
  }
} else {
  build();
}

const bytes = statSync(target).size;
const sha256 = createHash('sha256').update(readFileSync(target)).digest('hex');

// GitHub refuses files over 100 MB and this one is larger, so a deployment
// from the repository serves the APK from somewhere else - a GitHub Release,
// usually. Set GOSPEL_APK_URL (in .env or the environment) to that address
// and the page links there instead of to download/.
const url = process.env.GOSPEL_APK_URL ?? readEnv().GOSPEL_APK_URL ?? null;

// A manifest-only run describes the same file, so it keeps the file's
// build time and, if the native project is gone, the floor it recorded.
const sameFile = MANIFEST_ONLY && previous?.sha256 === sha256;
const manifest = {
  file: fileName,
  url,
  version: app.version,
  bytes,
  sha256,
  minSdk: minSdkFromBuild() ?? (sameFile ? previous.minSdk : null),
  builtAt: sameFile ? previous.builtAt : new Date().toISOString(),
  abis: ['arm64-v8a', 'armeabi-v7a'],
};

// A script rather than JSON so the page can read it from file:// as well as
// from a server; fetch() is refused on file:// in every browser.
writeFileSync(
  BUILD_JS,
  `// Written by scripts/build_apk.mjs. Do not edit.\nwindow.GOSPEL_BUILD = ${JSON.stringify(manifest, null, 2)};\n`,
);
writeFileSync(join(DOWNLOAD, `${fileName}.sha256`), `${sha256}  ${fileName}\n`);

console.log(`\n${fileName}  ${(bytes / 1048576).toFixed(1)} MB  sha256 ${sha256}`);
if (url) console.log(`Linked from ${url}`);
console.log(`Written to ${DOWNLOAD}`);
